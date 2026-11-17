import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { createStarterAssetsData } from '../data/presets';
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
  type AssetCategory,
  type LibraryAsset,
  type PbrMaterialSpec,
  type StoredFileRef,
  type UploadProgressState,
} from '../types/workspace';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_ASSETS_KEY = 'masar_asset_library_v1';

function loadLocalAssets(): LibraryAsset[] {
  try {
    const raw = localStorage.getItem(LOCAL_ASSETS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LibraryAsset[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterAssetsData();
}

function saveLocalAssets(assets: LibraryAsset[]): void {
  try {
    localStorage.setItem(LOCAL_ASSETS_KEY, JSON.stringify(assets));
  } catch {
    // ignore quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export interface SaveAssetPayload {
  name: string;
  description: string;
  category: AssetCategory;
  folder: string;
  tags: string[];
  previewImage: string;
  newFiles: File[];
  fileMode?: 'replace' | 'append';
  materialSpec?: PbrMaterialSpec;
}

export function useAssetLibrary(user: User | null, authReady: boolean) {
  const [localAssets, setLocalAssets] = useState<LibraryAsset[]>(() => loadLocalAssets());
  const [cloudAssets, setCloudAssets] = useState<LibraryAsset[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>(INITIAL_UPLOAD_PROGRESS);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalAssets(localAssets);
  }, [localAssets]);

  const showToast = useCallback((msg: string) => {
    setAssetMessage(msg);
    setTimeout(() => {
      setAssetMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const resetUploadProgress = useCallback(() => {
    setUploadProgress(INITIAL_UPLOAD_PROGRESS);
  }, []);

  const seedCloudAssetsIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/libraryAssets`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;

      const currentLocal = loadLocalAssets();
      for (const asset of currentLocal) {
        for (const f of asset.files) {
          if (!f.blobId.startsWith('starter_')) {
            await syncLocalBlobToCloud(f.blobId, f, uid);
          }
        }
        const assetId = createSafeId('asset');
        await setDoc(doc(db, `${collectionPath}/${assetId}`), {
          id: assetId,
          ownerId: uid,
          name: asset.name.slice(0, 160),
          description: asset.description.slice(0, 1000),
          category: asset.category,
          folder: asset.folder.slice(0, 80),
          tags: asset.tags.slice(0, 15),
          previewImage: (asset.previewImage || '').slice(0, 350000),
          fileCount: Math.max(1, asset.files.length),
          totalSizeBytes: Math.max(0, asset.totalSizeBytes),
          primaryExtension: (asset.primaryExtension || 'FILE').slice(0, 30),
          files: asset.files.slice(0, MAX_BUNDLE_FILES),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, collectionPath);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudAssets([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/libraryAssets`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: LibraryAsset[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            const files = Array.isArray(data.files) ? (data.files as StoredFileRef[]) : [];
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              name: String(data.name || ''),
              description: String(data.description || ''),
              category: (data.category as AssetCategory) || 'other',
              folder: String(data.folder || 'موارد عامة'),
              tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
              previewImage: String(data.previewImage || ''),
              fileCount: typeof data.fileCount === 'number' ? data.fileCount : files.length,
              totalSizeBytes: typeof data.totalSizeBytes === 'number' ? data.totalSizeBytes : 0,
              primaryExtension: String(data.primaryExtension || files[0]?.extension || 'FILE'),
              files,
              ...(data.materialSpec && typeof data.materialSpec === 'object'
                ? { materialSpec: data.materialSpec as PbrMaterialSpec }
                : {}),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (list.length === 0) {
          void seedCloudAssetsIfEmpty(user.uid);
        }
        setCloudAssets(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudAssetsIfEmpty]);

  const assets = user ? cloudAssets : localAssets;

  const createAsset = useCallback(
    async (payload: SaveAssetPayload) => {
      setAssetError(null);
      const totalBytes = payload.newFiles.reduce((sum, f) => sum + Math.max(0, f.size), 0);
      setUploadProgress({
        active: true,
        percent: 2,
        fileName: payload.newFiles[0]?.name || '',
        currentFileIndex: 1,
        totalFiles: payload.newFiles.length,
        bytesUploaded: 0,
        totalBytes,
        phase: 'uploading',
        errorMessage: null,
      });

      try {
        const storedRefs = await storeFiles(
          payload.newFiles,
          user?.uid || null,
          (progress) => setUploadProgress(progress)
        );
        const assetId = createSafeId('asset');
        const nowIso = new Date().toISOString();
        const totalSizeBytes = storedRefs.reduce((s, f) => s + f.size, 0);
        const primaryExtension = storedRefs[0]?.extension || 'FILE';
        const name = payload.name.trim().slice(0, 160);
        const description = payload.description.trim().slice(0, 1000);
        const folder = payload.folder.trim().slice(0, 80);
        const tags = payload.tags.slice(0, 15);
        const previewImage = (payload.previewImage || '').slice(0, 350000);

        if (!user) {
          const item: LibraryAsset = {
            id: assetId,
            ownerId: 'local',
            name,
            description,
            category: payload.category,
            folder,
            tags,
            previewImage,
            fileCount: storedRefs.length,
            totalSizeBytes,
            primaryExtension,
            files: storedRefs,
            ...(payload.materialSpec ? { materialSpec: payload.materialSpec } : {}),
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          setLocalAssets((prev) => [item, ...prev]);
          setUploadProgress(INITIAL_UPLOAD_PROGRESS);
          showToast(`تمت إضافة "${name}" مع ${storedRefs.length} ملفات بنجاح.`);
          return;
        }

        const assetPath = `users/${user.uid}/libraryAssets/${assetId}`;
        await setDoc(doc(db, assetPath), {
          id: assetId,
          ownerId: user.uid,
          name,
          description,
          category: payload.category,
          folder,
          tags,
          previewImage,
          fileCount: storedRefs.length,
          totalSizeBytes,
          primaryExtension,
          files: storedRefs,
          ...(payload.materialSpec ? { materialSpec: payload.materialSpec } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setUploadProgress(INITIAL_UPLOAD_PROGRESS);
        showToast(`تم رفع وحفظ "${name}" في مكتبة الأصول السحابية بنجاح.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر رفع ملفات الأصل وحفظها.';
        setUploadProgress((prev) => ({
          ...prev,
          active: false,
          phase: 'error',
          errorMessage: msg,
        }));
        setAssetError(msg);
        throw err;
      }
    },
    [user, showToast]
  );

  const updateAsset = useCallback(
    async (existingAsset: LibraryAsset, payload: SaveAssetPayload) => {
      setAssetError(null);
      const name = payload.name.trim().slice(0, 160);
      const description = payload.description.trim().slice(0, 1000);
      const folder = payload.folder.trim().slice(0, 80);
      const tags = payload.tags.slice(0, 15);
      const previewImage = (payload.previewImage || existingAsset.previewImage).slice(0, 350000);

      let nextFiles = existingAsset.files;
      let filesToCleanup: StoredFileRef[] = [];

      try {
        if (payload.newFiles.length > 0) {
          const totalBytes = payload.newFiles.reduce((sum, f) => sum + Math.max(0, f.size), 0);
          setUploadProgress({
            active: true,
            percent: 2,
            fileName: payload.newFiles[0]?.name || '',
            currentFileIndex: 1,
            totalFiles: payload.newFiles.length,
            bytesUploaded: 0,
            totalBytes,
            phase: 'uploading',
            errorMessage: null,
          });
          const uploaded = await storeFiles(
            payload.newFiles,
            user?.uid || null,
            (progress) => setUploadProgress(progress)
          );
          if (payload.fileMode === 'append') {
            nextFiles = [...existingAsset.files, ...uploaded].slice(0, MAX_BUNDLE_FILES);
          } else {
            filesToCleanup = existingAsset.files;
            nextFiles = uploaded;
          }
        }

        const totalSizeBytes = nextFiles.reduce((s, f) => s + f.size, 0);
        const primaryExtension = nextFiles[0]?.extension || 'FILE';
        const nowIso = new Date().toISOString();

        if (!user) {
          if (filesToCleanup.length > 0) {
            await deleteStoredBlobs(filesToCleanup, null);
          }
          setLocalAssets((prev) =>
            prev.map((a) =>
              a.id === existingAsset.id
                ? {
                    ...a,
                    name,
                    description,
                    category: payload.category,
                    folder,
                    tags,
                    previewImage,
                    files: nextFiles,
                    fileCount: nextFiles.length,
                    totalSizeBytes,
                    primaryExtension,
                    ...(payload.materialSpec ? { materialSpec: payload.materialSpec } : {}),
                    updatedAt: nowIso,
                  }
                : a
            )
          );
          setUploadProgress(INITIAL_UPLOAD_PROGRESS);
          showToast(`تم تحديث الأصل "${name}" بنجاح.`);
          return;
        }

        const assetPath = `users/${user.uid}/libraryAssets/${existingAsset.id}`;
        await updateDoc(doc(db, assetPath), {
          name,
          description,
          category: payload.category,
          folder,
          tags,
          previewImage,
          files: nextFiles,
          fileCount: nextFiles.length,
          totalSizeBytes,
          primaryExtension,
          ...(payload.materialSpec ? { materialSpec: payload.materialSpec } : {}),
          updatedAt: serverTimestamp(),
        });
        if (filesToCleanup.length > 0) {
          await deleteStoredBlobs(filesToCleanup, user.uid);
        }
        setUploadProgress(INITIAL_UPLOAD_PROGRESS);
        showToast(`تم تحديث الأصل "${name}" بنجاح.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر تحديث الأصل.';
        setUploadProgress((prev) => ({
          ...prev,
          active: false,
          phase: 'error',
          errorMessage: msg,
        }));
        setAssetError(msg);
        throw err;
      }
    },
    [user, showToast]
  );

  const downloadAssetBundle = useCallback(
    async (asset: LibraryAsset) => {
      setAssetError(null);
      try {
        await downloadBundleAsZip(asset.name, asset.files, user?.uid || null);
        showToast(`تم تجهيز وتحميل ملفات "${asset.name}" بنجاح.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل ملفات الأصل.';
        setAssetError(msg);
      }
    },
    [user, showToast]
  );

  const downloadAssetSingleFile = useCallback(
    async (fileRef: StoredFileRef) => {
      setAssetError(null);
      try {
        await downloadSingleStoredFile(fileRef, user?.uid || null);
        showToast(`تم تنزيل "${fileRef.name}" بنجاح.`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر تنزيل الملف.';
        setAssetError(msg);
      }
    },
    [user, showToast]
  );

  const deleteAsset = useCallback(
    async (asset: LibraryAsset) => {
      setAssetError(null);
      if (!user) {
        await deleteStoredBlobs(asset.files, null);
        setLocalAssets((prev) => prev.filter((a) => a.id !== asset.id));
        showToast(`تم حذف الأصل "${asset.name}" من المكتبة.`);
        return;
      }

      const assetPath = `users/${user.uid}/libraryAssets/${asset.id}`;
      try {
        await deleteDoc(doc(db, assetPath));
        await deleteStoredBlobs(asset.files, user.uid);
        showToast(`تم حذف الأصل "${asset.name}" من المكتبة.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, assetPath);
      }
    },
    [user, showToast]
  );

  return {
    assets,
    cloudLoading,
    uploadProgress,
    resetUploadProgress,
    assetMessage,
    assetError,
    dismissAssetError: () => setAssetError(null),
    createAsset,
    updateAsset,
    downloadAssetBundle,
    downloadAssetSingleFile,
    deleteAsset,
  };
}
