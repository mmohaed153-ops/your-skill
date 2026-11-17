import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { createStarterVaultData } from '../data/presets';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  deleteStoredBlobs,
  downloadBundleAsZip,
  downloadSingleStoredFile,
  MAX_BUNDLE_FILES,
  storeFiles,
  syncLocalBlobToCloud,
} from '../lib/fileStorage';
import {
  INITIAL_UPLOAD_PROGRESS,
  type StoredFileRef,
  type UploadProgressState,
  type VaultProject,
  type VaultVersion,
} from '../types/workspace';
import { createSafeId } from '../utils/pathLogic';
import { getNextVersionLabel, inferProjectFileType } from '../utils/workspaceLogic';

const LOCAL_VAULT_KEY = 'masar_project_vault_v1';

interface LocalVaultState {
  projects: VaultProject[];
  versionsByProject: Record<string, VaultVersion[]>;
}

function loadLocalVault(): LocalVaultState {
  try {
    const raw = localStorage.getItem(LOCAL_VAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalVaultState>;
      if (Array.isArray(parsed.projects) && parsed.versionsByProject) {
        return {
          projects: parsed.projects,
          versionsByProject: parsed.versionsByProject,
        };
      }
    }
  } catch {
    // ignore invalid cache
  }
  return createStarterVaultData();
}

function saveLocalVault(state: LocalVaultState): void {
  try {
    localStorage.setItem(LOCAL_VAULT_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export interface CreateVaultProjectPayload {
  name: string;
  description: string;
  folder: string;
  previewImage: string;
  notes: string;
  files: File[];
  linkedJamId?: string;
}

export interface UpdateVaultProjectMetaPayload {
  name: string;
  description: string;
  folder: string;
  previewImage: string;
  linkedJamId?: string;
}

export interface AddOrReplaceBackupPayload {
  mode: 'new_version' | 'replace_version';
  targetVersionId?: string;
  notes: string;
  files: File[];
}

export function useProjectVault(user: User | null, authReady: boolean) {
  const [localState, setLocalState] = useState<LocalVaultState>(() => loadLocalVault());
  const [cloudProjects, setCloudProjects] = useState<VaultProject[]>([]);
  const [cloudVersionsByProject, setCloudVersionsByProject] = useState<
    Record<string, VaultVersion[]>
  >({});
  const [cloudLoading, setCloudLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>(INITIAL_UPLOAD_PROGRESS);
  const [vaultMessage, setVaultMessage] = useState<string | null>(null);
  const [vaultError, setVaultError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalVault(localState);
  }, [localState]);

  const showToast = useCallback((msg: string) => {
    setVaultMessage(msg);
    setTimeout(() => {
      setVaultMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const resetUploadProgress = useCallback(() => {
    setUploadProgress(INITIAL_UPLOAD_PROGRESS);
  }, []);

  const seedCloudVaultIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/vaultProjects`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;

      const currentLocal = loadLocalVault();
      for (const proj of currentLocal.projects) {
        const projectId = createSafeId('proj');
        const versions = currentLocal.versionsByProject[proj.id] || [];
        const batch = writeBatch(db);
        const projRef = doc(db, `users/${uid}/vaultProjects/${projectId}`);
        batch.set(projRef, {
          id: projectId,
          ownerId: uid,
          name: proj.name.slice(0, 160),
          description: proj.description.slice(0, 1000),
          folder: proj.folder.slice(0, 80),
          fileType: proj.fileType.slice(0, 60),
          previewImage: (proj.previewImage || '').slice(0, 350000),
          latestVersionNumber: Math.max(1, proj.latestVersionNumber),
          latestBackupAt: proj.latestBackupAt || new Date().toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        for (const ver of versions) {
          for (const fileRef of ver.files) {
            if (!fileRef.blobId.startsWith('starter_')) {
              await syncLocalBlobToCloud(fileRef.blobId, fileRef, uid);
            }
          }
          const verId = createSafeId('ver');
          batch.set(doc(db, `users/${uid}/vaultProjects/${projectId}/versions/${verId}`), {
            id: verId,
            projectId,
            ownerId: uid,
            versionNumber: Math.max(1, ver.versionNumber),
            versionLabel: ver.versionLabel.slice(0, 40),
            notes: ver.notes.slice(0, 600),
            totalSizeBytes: Math.max(0, ver.totalSizeBytes),
            files: ver.files.slice(0, MAX_BUNDLE_FILES),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, collectionPath);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudProjects([]);
      setCloudVersionsByProject({});
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/vaultProjects`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: VaultProject[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              name: String(data.name || ''),
              description: String(data.description || ''),
              folder: String(data.folder || 'مشاريع الألعاب'),
              fileType: String(data.fileType || 'ARCHIVE'),
              previewImage: String(data.previewImage || ''),
              latestVersionNumber:
                typeof data.latestVersionNumber === 'number' ? data.latestVersionNumber : 1,
              latestBackupAt: String(data.latestBackupAt || toIsoString(data.updatedAt)),
              linkedJamId: typeof data.linkedJamId === 'string' ? data.linkedJamId : '',
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (list.length === 0) {
          void seedCloudVaultIfEmpty(user.uid);
        }
        setCloudProjects(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudVaultIfEmpty]);

  const cloudProjectIdsKey = cloudProjects.map((p) => p.id).join(',');
  useEffect(() => {
    if (!authReady || !user || cloudProjects.length === 0) return;

    const unsubscribers = cloudProjects.map((proj) => {
      const versionsPath = `users/${user.uid}/vaultProjects/${proj.id}/versions`;
      const q = query(
        collection(db, versionsPath),
        where('ownerId', '==', user.uid)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const versions: VaultVersion[] = snapshot.docs
            .map((d) => {
              const data = d.data();
              return {
                id: String(data.id || d.id),
                projectId: String(data.projectId || proj.id),
                ownerId: String(data.ownerId || user.uid),
                versionNumber: typeof data.versionNumber === 'number' ? data.versionNumber : 1,
                versionLabel: String(data.versionLabel || 'v1.0'),
                notes: String(data.notes || ''),
                totalSizeBytes: typeof data.totalSizeBytes === 'number' ? data.totalSizeBytes : 0,
                files: Array.isArray(data.files) ? (data.files as StoredFileRef[]) : [],
                createdAt: toIsoString(data.createdAt),
                updatedAt: toIsoString(data.updatedAt),
              };
            })
            .sort((a, b) => b.versionNumber - a.versionNumber);
          setCloudVersionsByProject((prev) => ({
            ...prev,
            [proj.id]: versions,
          }));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, versionsPath);
        }
      );
    });

    return () => unsubscribers.forEach((unsub) => unsub());
  }, [authReady, user, cloudProjectIdsKey]);

  const projects = user ? cloudProjects : localState.projects;
  const versionsByProject = user ? cloudVersionsByProject : localState.versionsByProject;

  const createProject = useCallback(
    async (payload: CreateVaultProjectPayload) => {
      setVaultError(null);
      const totalBytes = payload.files.reduce((sum, f) => sum + Math.max(0, f.size), 0);
      setUploadProgress({
        active: true,
        percent: 2,
        fileName: payload.files[0]?.name || '',
        currentFileIndex: 1,
        totalFiles: payload.files.length,
        bytesUploaded: 0,
        totalBytes,
        phase: 'uploading',
        errorMessage: null,
      });

      try {
        const storedRefs = await storeFiles(
          payload.files,
          user?.uid || null,
          (progress) => setUploadProgress(progress)
        );

        const nowIso = new Date().toISOString();
        const projectId = createSafeId('proj');
        const versionId = createSafeId('ver');
        const totalSizeBytes = storedRefs.reduce((s, f) => s + f.size, 0);
        const fileType = inferProjectFileType(storedRefs.map((f) => f.name));
        const previewImage = (payload.previewImage || '').slice(0, 350000);
        const name = payload.name.trim().slice(0, 160);
        const description = payload.description.trim().slice(0, 1000);
        const folder = payload.folder.trim().slice(0, 80);
        const notes = (payload.notes.trim() || 'النسخة الاحتياطية الأولى').slice(0, 600);
        const linkedJamId = (payload.linkedJamId || '').trim().slice(0, 128);

        if (!user) {
          const newProject: VaultProject = {
            id: projectId,
            ownerId: 'local',
            name,
            description,
            folder,
            fileType,
            previewImage,
            latestVersionNumber: 1,
            latestBackupAt: nowIso,
            ...(linkedJamId ? { linkedJamId } : {}),
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          const newVersion: VaultVersion = {
            id: versionId,
            projectId,
            ownerId: 'local',
            versionNumber: 1,
            versionLabel: 'v1.0',
            notes,
            totalSizeBytes,
            files: storedRefs,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          setLocalState((prev) => ({
            projects: [newProject, ...prev.projects],
            versionsByProject: { ...prev.versionsByProject, [projectId]: [newVersion] },
          }));
          setUploadProgress(INITIAL_UPLOAD_PROGRESS);
          showToast(`تم حفظ المشروع "${name}" ورفع ${storedRefs.length} ملفات بنجاح.`);
          return projectId;
        }

        const projectPath = `users/${user.uid}/vaultProjects/${projectId}`;
        const versionPath = `${projectPath}/versions/${versionId}`;
        const batch = writeBatch(db);
        batch.set(doc(db, projectPath), {
          id: projectId,
          ownerId: user.uid,
          name,
          description,
          folder,
          fileType,
          previewImage,
          latestVersionNumber: 1,
          latestBackupAt: nowIso,
          ...(linkedJamId ? { linkedJamId } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, versionPath), {
          id: versionId,
          projectId,
          ownerId: user.uid,
          versionNumber: 1,
          versionLabel: 'v1.0',
          notes,
          totalSizeBytes,
          files: storedRefs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        setUploadProgress(INITIAL_UPLOAD_PROGRESS);
        showToast(`تم حفظ المشروع "${name}" في خزنة السحابة بنجاح (${storedRefs.length} ملفات).`);
        return projectId;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'تعذر رفع ملفات المشروع وحفظها.';
        setUploadProgress((prev) => ({
          ...prev,
          active: false,
          phase: 'error',
          errorMessage: message,
        }));
        setVaultError(message);
        throw err;
      }
    },
    [user, showToast]
  );

  const updateProjectMeta = useCallback(
    async (projectId: string, payload: UpdateVaultProjectMetaPayload) => {
      setVaultError(null);
      const name = payload.name.trim().slice(0, 160);
      const description = payload.description.trim().slice(0, 1000);
      const folder = payload.folder.trim().slice(0, 80);
      const previewImage = (payload.previewImage ?? '').slice(0, 350000);
      const linkedJamId =
        payload.linkedJamId !== undefined ? payload.linkedJamId.trim().slice(0, 128) : undefined;

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          projects: prev.projects.map((p) =>
            p.id === projectId
              ? {
                  ...p,
                  name,
                  description,
                  folder,
                  previewImage,
                  ...(linkedJamId !== undefined ? { linkedJamId } : {}),
                  updatedAt: new Date().toISOString(),
                }
              : p
          ),
        }));
        showToast(`تم تحديث بيانات المشروع "${name}".`);
        return;
      }

      const projectPath = `users/${user.uid}/vaultProjects/${projectId}`;
      try {
        await updateDoc(doc(db, projectPath), {
          name,
          description,
          folder,
          previewImage,
          ...(linkedJamId !== undefined ? { linkedJamId } : {}),
          updatedAt: serverTimestamp(),
        });
        showToast(`تم تحديث بيانات المشروع "${name}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, projectPath);
      }
    },
    [user, showToast]
  );

  const addOrReplaceBackup = useCallback(
    async (project: VaultProject, payload: AddOrReplaceBackupPayload) => {
      setVaultError(null);
      const totalBytes = payload.files.reduce((sum, f) => sum + Math.max(0, f.size), 0);
      setUploadProgress({
        active: true,
        percent: 2,
        fileName: payload.files[0]?.name || '',
        currentFileIndex: 1,
        totalFiles: payload.files.length,
        bytesUploaded: 0,
        totalBytes,
        phase: 'uploading',
        errorMessage: null,
      });

      try {
        const storedRefs = await storeFiles(
          payload.files,
          user?.uid || null,
          (progress) => setUploadProgress(progress)
        );
        const nowIso = new Date().toISOString();
        const totalSizeBytes = storedRefs.reduce((s, f) => s + f.size, 0);
        const fileType = inferProjectFileType(storedRefs.map((f) => f.name));
        const existingVersions = versionsByProject[project.id] || [];

        if (payload.mode === 'replace_version') {
          const targetVersion =
            existingVersions.find((v) => v.id === payload.targetVersionId) || existingVersions[0];
          if (!targetVersion) {
            throw new Error('لم يتم العثور على النسخة المستهدفة للاستبدال.');
          }
          const notes = (payload.notes.trim() || targetVersion.notes || 'نسخة محدّثة').slice(0, 600);

          if (!user) {
            await deleteStoredBlobs(targetVersion.files, null);
            setLocalState((prev) => ({
              projects: prev.projects.map((p) =>
                p.id === project.id
                  ? { ...p, fileType, latestBackupAt: nowIso, updatedAt: nowIso }
                  : p
              ),
              versionsByProject: {
                ...prev.versionsByProject,
                [project.id]: (prev.versionsByProject[project.id] || []).map((v) =>
                  v.id === targetVersion.id
                    ? { ...v, notes, totalSizeBytes, files: storedRefs, updatedAt: nowIso }
                    : v
                ),
              },
            }));
            setUploadProgress(INITIAL_UPLOAD_PROGRESS);
            showToast(`تم استبدال النسخة ${targetVersion.versionLabel} للمشروع بنجاح.`);
            return;
          }

          const projectPath = `users/${user.uid}/vaultProjects/${project.id}`;
          const versionPath = `${projectPath}/versions/${targetVersion.id}`;
          const batch = writeBatch(db);
          batch.update(doc(db, versionPath), {
            versionLabel: targetVersion.versionLabel,
            notes,
            totalSizeBytes,
            files: storedRefs,
            updatedAt: serverTimestamp(),
          });
          batch.update(doc(db, projectPath), {
            latestVersionNumber: project.latestVersionNumber,
            latestBackupAt: nowIso,
            fileType,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
          await deleteStoredBlobs(targetVersion.files, user.uid);
          setUploadProgress(INITIAL_UPLOAD_PROGRESS);
          showToast(`تم استبدال النسخة ${targetVersion.versionLabel} للمشروع بنجاح.`);
          return;
        }

        const nextNum = Math.max(project.latestVersionNumber + 1, existingVersions.length + 1);
        const versionId = createSafeId('ver');
        const versionLabel = getNextVersionLabel(nextNum);
        const notes = (payload.notes.trim() || `نسخة احتياطية جديدة ${versionLabel}`).slice(0, 600);

        if (!user) {
          const newVer: VaultVersion = {
            id: versionId,
            projectId: project.id,
            ownerId: 'local',
            versionNumber: nextNum,
            versionLabel,
            notes,
            totalSizeBytes,
            files: storedRefs,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          setLocalState((prev) => ({
            projects: prev.projects.map((p) =>
              p.id === project.id
                ? {
                    ...p,
                    latestVersionNumber: nextNum,
                    latestBackupAt: nowIso,
                    fileType,
                    updatedAt: nowIso,
                  }
                : p
            ),
            versionsByProject: {
              ...prev.versionsByProject,
              [project.id]: [newVer, ...(prev.versionsByProject[project.id] || [])],
            },
          }));
          setUploadProgress(INITIAL_UPLOAD_PROGRESS);
          showToast(`تم حفظ النسخة الاحتياطية ${versionLabel} مع الإبقاء على النسخ السابقة.`);
          return;
        }

        const projectPath = `users/${user.uid}/vaultProjects/${project.id}`;
        const versionPath = `${projectPath}/versions/${versionId}`;
        const batch = writeBatch(db);
        batch.set(doc(db, versionPath), {
          id: versionId,
          projectId: project.id,
          ownerId: user.uid,
          versionNumber: nextNum,
          versionLabel,
          notes,
          totalSizeBytes,
          files: storedRefs,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.update(doc(db, projectPath), {
          latestVersionNumber: nextNum,
          latestBackupAt: nowIso,
          fileType,
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        setUploadProgress(INITIAL_UPLOAD_PROGRESS);
        showToast(`تم حفظ النسخة الاحتياطية ${versionLabel} مع الإبقاء على النسخ السابقة.`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'تعذر رفع ملفات النسخة الاحتياطية.';
        setUploadProgress((prev) => ({
          ...prev,
          active: false,
          phase: 'error',
          errorMessage: message,
        }));
        setVaultError(message);
        throw err;
      }
    },
    [user, versionsByProject, showToast]
  );

  const restoreProjectBundle = useCallback(
    async (project: VaultProject, version: VaultVersion) => {
      setVaultError(null);
      try {
        await downloadBundleAsZip(
          `${project.name}-${version.versionLabel}`,
          version.files,
          user?.uid || null
        );
        showToast(
          `تمت استعادة ملفات "${project.name}" (${version.versionLabel}) وتجهيز التحميل بنجاح.`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر استعادة ملفات المشروع.';
        setVaultError(msg);
      }
    },
    [user, showToast]
  );

  const downloadProjectFile = useCallback(
    async (fileRef: StoredFileRef) => {
      setVaultError(null);
      try {
        await downloadSingleStoredFile(fileRef, user?.uid || null);
        showToast(`تم تنزيل الملف "${fileRef.name}" بنجاح.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر تنزيل الملف.';
        setVaultError(msg);
      }
    },
    [user, showToast]
  );

  const deleteProject = useCallback(
    async (project: VaultProject) => {
      setVaultError(null);
      const versions = versionsByProject[project.id] || [];
      const allFiles = versions.flatMap((v) => v.files);

      if (!user) {
        await deleteStoredBlobs(allFiles, null);
        setLocalState((prev) => {
          const nextVersions = { ...prev.versionsByProject };
          delete nextVersions[project.id];
          return {
            projects: prev.projects.filter((p) => p.id !== project.id),
            versionsByProject: nextVersions,
          };
        });
        showToast(`تم حذف المشروع "${project.name}" من الخزنة.`);
        return;
      }

      const projectPath = `users/${user.uid}/vaultProjects/${project.id}`;
      try {
        const versionsSnap = await getDocs(
          query(collection(db, `${projectPath}/versions`), where('ownerId', '==', user.uid))
        );
        const batch = writeBatch(db);
        versionsSnap.docs.forEach((vDoc) => batch.delete(vDoc.ref));
        batch.delete(doc(db, projectPath));
        await batch.commit();
        await deleteStoredBlobs(allFiles, user.uid);
        showToast(`تم حذف المشروع "${project.name}" ونسخه الاحتياطية.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, projectPath);
      }
    },
    [user, versionsByProject, showToast]
  );

  return {
    projects,
    versionsByProject,
    cloudLoading,
    uploadProgress,
    resetUploadProgress,
    vaultMessage,
    vaultError,
    dismissVaultError: () => setVaultError(null),
    createProject,
    updateProjectMeta,
    addOrReplaceBackup,
    restoreProjectBundle,
    downloadProjectFile,
    deleteProject,
  };
}
