import { useCallback, useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  deleteStoredBlobs,
  downloadSingleStoredFile,
  storeFiles,
} from '../lib/fileStorage';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  PracticalProject,
  PracticalProjectStage,
  PracticalProjectStatus,
} from '../types/platform';
import {
  INITIAL_UPLOAD_PROGRESS,
  type StoredFileRef,
  type UploadProgressState,
} from '../types/workspace';
import { XP_REWARDS } from '../utils/gamificationLogic';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_PRACTICAL_PROJECTS_KEY = 'masar_practical_projects_v1';

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function createDefaultStarterProjects(): PracticalProject[] {
  const nowIso = new Date().toISOString();
  return [
    {
      id: 'pproj_starter_platformer',
      ownerId: 'local',
      title: 'تطبيق عملي: نموذج حركة منصة 2D متجاوب',
      description:
        'مشروع عملي لتطبيق فيزياء الحركة، القفز المتغير، والـ Coyote Time وربطها بمشاهد جاهزة للاختبار.',
      requirements:
        '1. بناء مشهد لاعب بشخصية متحركة.\n2. إضافة أرضيات وعوائق تصادم.\n3. إرفاق لقطة شاشة أو ملف المشروع النهائي.',
      requiredSkills: ['حركة الشخصية', 'التصادمات', 'إدارة المشاهد'],
      linkedPathId: '',
      linkedPathTitle: '',
      status: 'not_started',
      stages: [
        {
          id: 'stg_1',
          title: 'إعداد المشهد وإضافة الشخصية',
          instructions: 'أنشئ مشهد Player مع CharacterBody2D وCollisionShape2D.',
          completed: false,
        },
        {
          id: 'stg_2',
          title: 'برمجة الجاذبية والقفز السلس',
          instructions: 'أضف الجاذبية، القفز، وذاكرة الحافة لتحكم ممتع.',
          completed: false,
        },
        {
          id: 'stg_3',
          title: 'الاختبار ورفع الملف النهائي',
          instructions: 'اختبر المستوى وارفع الكود أو الصور النهائية للمشروع.',
          completed: false,
        },
      ],
      files: [],
      totalSizeBytes: 0,
      projectUrl: '',
      xpReward: XP_REWARDS.project_complete,
      completedAt: '',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

function loadLocalProjects(): PracticalProject[] {
  try {
    const raw = localStorage.getItem(LOCAL_PRACTICAL_PROJECTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PracticalProject[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return createDefaultStarterProjects();
}

function saveLocalProjects(items: PracticalProject[]): void {
  try {
    localStorage.setItem(LOCAL_PRACTICAL_PROJECTS_KEY, JSON.stringify(items));
  } catch {
    // ignore storage quota
  }
}

export interface SavePracticalProjectPayload {
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string[];
  linkedPathId: string;
  linkedPathTitle: string;
  status: PracticalProjectStatus;
  stages: PracticalProjectStage[];
  projectUrl: string;
  newFiles: File[];
  keepFiles: StoredFileRef[];
}

export function usePracticalProjects(user: User | null, authReady: boolean) {
  const [localProjects, setLocalProjects] = useState<PracticalProject[]>(() => loadLocalProjects());
  const [cloudProjects, setCloudProjects] = useState<PracticalProject[]>([]);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>(INITIAL_UPLOAD_PROGRESS);
  const [projectError, setProjectError] = useState<string | null>(null);

  useEffect(() => {
    saveLocalProjects(localProjects);
  }, [localProjects]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudProjects([]);
      return;
    }

    const colPath = `users/${user.uid}/practicalProjects`;
    const unsub = onSnapshot(
      query(collection(db, colPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: PracticalProject[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              requirements: String(data.requirements || ''),
              requiredSkills: Array.isArray(data.requiredSkills)
                ? data.requiredSkills.map(String)
                : [],
              linkedPathId: String(data.linkedPathId || ''),
              linkedPathTitle: String(data.linkedPathTitle || ''),
              status: (data.status as PracticalProjectStatus) || 'not_started',
              stages: Array.isArray(data.stages) ? (data.stages as PracticalProjectStage[]) : [],
              files: Array.isArray(data.files) ? (data.files as StoredFileRef[]) : [],
              totalSizeBytes: typeof data.totalSizeBytes === 'number' ? data.totalSizeBytes : 0,
              projectUrl: String(data.projectUrl || ''),
              xpReward:
                typeof data.xpReward === 'number' ? data.xpReward : XP_REWARDS.project_complete,
              completedAt: String(data.completedAt || ''),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setCloudProjects(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, colPath)
    );

    return unsub;
  }, [authReady, user]);

  const projects = user ? cloudProjects : localProjects;

  const saveProject = useCallback(
    async (payload: SavePracticalProjectPayload, editingProjectId?: string) => {
      setProjectError(null);
      let uploadedRefs: StoredFileRef[] = [];

      if (payload.newFiles.length > 0) {
        const totalBytes = payload.newFiles.reduce((s, f) => s + Math.max(0, f.size), 0);
        setUploadProgress({
          active: true,
          percent: 3,
          fileName: payload.newFiles[0]?.name || '',
          currentFileIndex: 1,
          totalFiles: payload.newFiles.length,
          bytesUploaded: 0,
          totalBytes,
          phase: 'uploading',
          errorMessage: null,
        });
        try {
          uploadedRefs = await storeFiles(payload.newFiles, user?.uid || null, (prog) =>
            setUploadProgress(prog)
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'تعذر رفع ملفات المشروع العملي.';
          setUploadProgress((prev) => ({
            ...prev,
            active: false,
            phase: 'error',
            errorMessage: msg,
          }));
          setProjectError(msg);
          throw err;
        }
      }

      const existing = editingProjectId
        ? projects.find((p) => p.id === editingProjectId) || null
        : null;
      const projectId = existing?.id || createSafeId('pproj');
      const nowIso = new Date().toISOString();
      const combinedFiles = [...payload.keepFiles, ...uploadedRefs].slice(0, 100);
      const totalSizeBytes = combinedFiles.reduce((sum, f) => sum + (f.size || 0), 0);

      const allStagesDone =
        payload.stages.length > 0 && payload.stages.every((s) => s.completed);
      const resolvedStatus: PracticalProjectStatus =
        payload.status === 'completed' || allStagesDone ? 'completed' : payload.status;
      const completedAt =
        resolvedStatus === 'completed' ? existing?.completedAt || nowIso : '';

      const project: PracticalProject = {
        id: projectId,
        ownerId: user?.uid || 'local',
        title: payload.title.trim().slice(0, 180),
        description: payload.description.trim().slice(0, 1500),
        requirements: payload.requirements.trim().slice(0, 2000),
        requiredSkills: payload.requiredSkills.map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 20),
        linkedPathId: payload.linkedPathId.slice(0, 128),
        linkedPathTitle: payload.linkedPathTitle.slice(0, 180),
        status: resolvedStatus,
        stages: payload.stages.slice(0, 30),
        files: combinedFiles,
        totalSizeBytes,
        projectUrl: payload.projectUrl.trim().slice(0, 2048),
        xpReward: existing?.xpReward || XP_REWARDS.project_complete,
        completedAt,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      setUploadProgress(INITIAL_UPLOAD_PROGRESS);

      if (!user) {
        setLocalProjects((prev) =>
          existing
            ? prev.map((p) => (p.id === project.id ? project : p))
            : [project, ...prev]
        );
        return { project, newlyCompleted: resolvedStatus === 'completed' && existing?.status !== 'completed' };
      }

      const docPath = `users/${user.uid}/practicalProjects/${project.id}`;
      try {
        if (existing) {
          await updateDoc(doc(db, docPath), {
            title: project.title,
            description: project.description,
            requirements: project.requirements,
            requiredSkills: project.requiredSkills,
            linkedPathId: project.linkedPathId,
            linkedPathTitle: project.linkedPathTitle,
            status: project.status,
            stages: project.stages,
            files: project.files,
            totalSizeBytes: project.totalSizeBytes,
            projectUrl: project.projectUrl,
            xpReward: project.xpReward,
            completedAt: project.completedAt,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            ...project,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return {
          project,
          newlyCompleted: resolvedStatus === 'completed' && existing?.status !== 'completed',
        };
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, docPath);
        return { project, newlyCompleted: false };
      }
    },
    [projects, user]
  );

  const toggleStageCompleted = useCallback(
    async (
      project: PracticalProject,
      stageId: string
    ): Promise<{ newlyCompleted: boolean; updated: PracticalProject }> => {
      const nextStages = project.stages.map((s) =>
        s.id === stageId ? { ...s, completed: !s.completed } : s
      );
      const anyDone = nextStages.some((s) => s.completed);
      const allDone = nextStages.length > 0 && nextStages.every((s) => s.completed);
      const nextStatus: PracticalProjectStatus = allDone
        ? 'completed'
        : anyDone
          ? 'in_progress'
          : 'not_started';
      const nowIso = new Date().toISOString();
      const newlyCompleted = nextStatus === 'completed' && project.status !== 'completed';
      const updated: PracticalProject = {
        ...project,
        stages: nextStages,
        status: nextStatus,
        completedAt: nextStatus === 'completed' ? project.completedAt || nowIso : '',
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalProjects((prev) => prev.map((p) => (p.id === project.id ? updated : p)));
        return { newlyCompleted, updated };
      }

      const docPath = `users/${user.uid}/practicalProjects/${project.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          stages: nextStages,
          status: nextStatus,
          completedAt: updated.completedAt,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
      return { newlyCompleted, updated };
    },
    [user]
  );

  const setProjectStatus = useCallback(
    async (
      project: PracticalProject,
      nextStatus: PracticalProjectStatus
    ): Promise<{ newlyCompleted: boolean }> => {
      const nowIso = new Date().toISOString();
      const newlyCompleted = nextStatus === 'completed' && project.status !== 'completed';
      const completedAt = nextStatus === 'completed' ? project.completedAt || nowIso : '';

      if (!user) {
        setLocalProjects((prev) =>
          prev.map((p) =>
            p.id === project.id
              ? { ...p, status: nextStatus, completedAt, updatedAt: nowIso }
              : p
          )
        );
        return { newlyCompleted };
      }

      const docPath = `users/${user.uid}/practicalProjects/${project.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          status: nextStatus,
          completedAt,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
      return { newlyCompleted };
    },
    [user]
  );

  const deleteProject = useCallback(
    async (project: PracticalProject) => {
      if (!user) {
        await deleteStoredBlobs(project.files, null);
        setLocalProjects((prev) => prev.filter((p) => p.id !== project.id));
        return;
      }

      const docPath = `users/${user.uid}/practicalProjects/${project.id}`;
      try {
        await deleteDoc(doc(db, docPath));
        await deleteStoredBlobs(project.files, user.uid);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user]
  );

  const downloadProjectAttachment = useCallback(
    async (fileRef: StoredFileRef) => {
      await downloadSingleStoredFile(fileRef, user?.uid || null);
    },
    [user]
  );

  return {
    projects,
    uploadProgress,
    resetUploadProgress: () => setUploadProgress(INITIAL_UPLOAD_PROGRESS),
    projectError,
    dismissProjectError: () => setProjectError(null),
    saveProject,
    toggleStageCompleted,
    setProjectStatus,
    deleteProject,
    downloadProjectAttachment,
  };
}
