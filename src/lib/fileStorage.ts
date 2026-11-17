import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import JSZip from 'jszip';
import { db, handleFirestoreError, OperationType } from './firebase';
import type { StoredFileRef, UploadProgressState } from '../types/workspace';
import { createSafeId } from '../utils/pathLogic';
import {
  getFileExtension,
  MAX_BUNDLE_FILES,
  MAX_CLOUD_FILE_BYTES,
} from '../utils/workspaceLogic';

const IDB_NAME = 'masar_workspace_blobs_v1';
const IDB_STORE = 'blobs';
export const CHUNK_BINARY_BYTES = 680_000; // ~907KB Base64 string, safely below Firestore 1MB limit
export { MAX_CLOUD_FILE_BYTES, MAX_BUNDLE_FILES };

interface StoredBlobRecord {
  blobId: string;
  name: string;
  mimeType: string;
  blob: Blob;
  updatedAt: number;
}

function openBlobDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available in this environment.'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(IDB_STORE)) {
        database.createObjectStore(IDB_STORE, { keyPath: 'blobId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open local file storage.'));
  });
}

export async function putLocalBlob(
  blobId: string,
  name: string,
  mimeType: string,
  blob: Blob
): Promise<boolean> {
  try {
    const database = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      store.put({
        blobId,
        name,
        mimeType: mimeType || blob.type || 'application/octet-stream',
        blob,
        updatedAt: Date.now(),
      } satisfies StoredBlobRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
    return true;
  } catch {
    return false;
  }
}

export async function getLocalBlob(blobId: string): Promise<Blob | null> {
  try {
    const database = await openBlobDb();
    const record = await new Promise<StoredBlobRecord | undefined>((resolve, reject) => {
      const tx = database.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const req = store.get(blobId);
      req.onsuccess = () => resolve(req.result as StoredBlobRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    database.close();
    return record?.blob || null;
  } catch {
    return null;
  }
}

export async function deleteLocalBlob(blobId: string): Promise<void> {
  try {
    const database = await openBlobDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(blobId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
  } catch {
    // ignore cleanup error
  }
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode(...bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function isPermissionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return msg.includes('permission') || msg.includes('unauthenticated') || msg.includes('insufficient');
}

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (err) {
      lastError = err;
      if (isPermissionError(err) || attempt >= maxAttempts) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, attempt * 350));
    }
  }
  throw lastError;
}

async function cleanupFailedCloudBlob(blobId: string, uid: string): Promise<void> {
  try {
    const blobMetaPath = `users/${uid}/fileBlobs/${blobId}`;
    const chunksPath = `${blobMetaPath}/chunks`;
    const snap = await getDocs(
      query(collection(db, chunksPath), where('ownerId', '==', uid))
    );
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, blobMetaPath));
    await batch.commit();
  } catch {
    // best-effort rollback cleanup
  }
}

export type UploadProgressHandler = (progress: UploadProgressState) => void;

export async function storeFiles(
  files: File[],
  uid: string | null,
  onProgress?: UploadProgressHandler
): Promise<StoredFileRef[]> {
  if (files.length === 0) return [];
  if (files.length > MAX_BUNDLE_FILES) {
    throw new Error(`الحد الأقصى للملفات في دفعة واحدة هو ${MAX_BUNDLE_FILES} ملفاً.`);
  }

  for (const file of files) {
    if (file.size > MAX_CLOUD_FILE_BYTES) {
      throw new Error(
        `حجم الملف "${file.name}" يتجاوز الحد التقني للملف الواحد (200 ميجابايت).`
      );
    }
  }

  const totalBytes = files.reduce((sum, f) => sum + Math.max(0, f.size), 0);
  let bytesUploaded = 0;
  const refs: StoredFileRef[] = [];
  const uploadedBlobIds: string[] = [];

  for (let fileIdx = 0; fileIdx < files.length; fileIdx += 1) {
    const file = files[fileIdx];
    const blobId = createSafeId('blob');
    const fileId = createSafeId('file');
    const safeName = file.name.trim().slice(0, 255) || 'resource.bin';
    const mimeType = (file.type || 'application/octet-stream').slice(0, 150);
    const extension = getFileExtension(safeName);

    onProgress?.({
      active: true,
      percent: totalBytes > 0 ? Math.min(98, Math.round((bytesUploaded / totalBytes) * 100)) : 10,
      fileName: safeName,
      currentFileIndex: fileIdx + 1,
      totalFiles: files.length,
      bytesUploaded,
      totalBytes,
      phase: 'uploading',
      errorMessage: null,
    });

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const chunkCount = Math.max(1, Math.ceil(Math.max(1, bytes.length) / CHUNK_BINARY_BYTES));

    // Store locally in IndexedDB for instant offline access
    const savedLocally = await putLocalBlob(
      blobId,
      safeName,
      mimeType,
      new Blob([bytes], { type: mimeType })
    );
    if (!uid && !savedLocally) {
      throw new Error(
        `تعذر حفظ الملف "${safeName}" في التخزين المحلي للمتصفح. تأكد من توفر مساحة كافية.`
      );
    }

    if (uid) {
      const metaPath = `users/${uid}/fileBlobs/${blobId}`;
      try {
        await retryOperation(async () => {
          await setDoc(doc(db, metaPath), {
            id: blobId,
            ownerId: uid,
            name: safeName,
            mimeType,
            size: bytes.length,
            chunkCount,
            createdAt: serverTimestamp(),
          });
        });
        uploadedBlobIds.push(blobId);

        for (let i = 0; i < chunkCount; i += 1) {
          const start = i * CHUNK_BINARY_BYTES;
          const end = Math.min(bytes.length, start + CHUNK_BINARY_BYTES);
          const slice = bytes.subarray(start, end);
          const dataBase64 = slice.length > 0 ? uint8ArrayToBase64(slice) : '';
          const chunkId = `chunk_${i}`;
          const chunkPath = `users/${uid}/fileBlobs/${blobId}/chunks/${chunkId}`;

          await retryOperation(async () => {
            await setDoc(doc(db, chunkPath), {
              id: chunkId,
              blobId,
              ownerId: uid,
              index: i,
              dataBase64,
              createdAt: serverTimestamp(),
            });
          });

          bytesUploaded += slice.length;
          const percent =
            totalBytes > 0
              ? Math.min(98, Math.max(2, Math.round((bytesUploaded / totalBytes) * 100)))
              : Math.min(98, Math.round(((fileIdx + (i + 1) / chunkCount) / files.length) * 100));

          onProgress?.({
            active: true,
            percent,
            fileName: safeName,
            currentFileIndex: fileIdx + 1,
            totalFiles: files.length,
            bytesUploaded,
            totalBytes,
            phase: 'uploading',
            errorMessage: null,
          });
        }
      } catch (err) {
        // Roll back any partially uploaded cloud blobs from this batch
        for (const partialBlobId of uploadedBlobIds) {
          await cleanupFailedCloudBlob(partialBlobId, uid);
        }
        await deleteLocalBlob(blobId);

        if (isPermissionError(err)) {
          handleFirestoreError(err, OperationType.CREATE, metaPath);
        }
        const detail = err instanceof Error ? err.message : '';
        throw new Error(
          `فشل رفع الملف "${safeName}" إلى السحابة${detail ? `: ${detail}` : ''}. يمكنك إعادة المحاولة دون فقدان ملفاتك المختارة.`
        );
      }
    } else {
      bytesUploaded += bytes.length;
      const percent =
        totalBytes > 0
          ? Math.min(98, Math.max(5, Math.round((bytesUploaded / totalBytes) * 100)))
          : Math.min(98, Math.round(((fileIdx + 1) / files.length) * 100));

      onProgress?.({
        active: true,
        percent,
        fileName: safeName,
        currentFileIndex: fileIdx + 1,
        totalFiles: files.length,
        bytesUploaded,
        totalBytes,
        phase: 'uploading',
        errorMessage: null,
      });
    }

    refs.push({
      id: fileId,
      name: safeName,
      size: bytes.length,
      mimeType,
      extension,
      blobId,
      chunkCount,
    });
  }

  onProgress?.({
    active: true,
    percent: 99,
    fileName: files[files.length - 1]?.name || '',
    currentFileIndex: files.length,
    totalFiles: files.length,
    bytesUploaded: totalBytes,
    totalBytes,
    phase: 'saving',
    errorMessage: null,
  });

  return refs;
}

export async function syncLocalBlobToCloud(blobId: string, ref: StoredFileRef, uid: string): Promise<void> {
  const localBlob = await getLocalBlob(blobId);
  if (!localBlob) return;
  const buffer = await localBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkCount = Math.max(1, Math.ceil(Math.max(1, bytes.length) / CHUNK_BINARY_BYTES));

  const metaPath = `users/${uid}/fileBlobs/${blobId}`;
  try {
    await setDoc(doc(db, metaPath), {
      id: blobId,
      ownerId: uid,
      name: ref.name.slice(0, 255),
      mimeType: ref.mimeType.slice(0, 150),
      size: bytes.length,
      chunkCount,
      createdAt: serverTimestamp(),
    });

    for (let i = 0; i < chunkCount; i += 1) {
      const start = i * CHUNK_BINARY_BYTES;
      const end = Math.min(bytes.length, start + CHUNK_BINARY_BYTES);
      const slice = bytes.subarray(start, end);
      const dataBase64 = slice.length > 0 ? uint8ArrayToBase64(slice) : '';
      const chunkId = `chunk_${i}`;
      await setDoc(doc(db, `users/${uid}/fileBlobs/${blobId}/chunks/${chunkId}`), {
        id: chunkId,
        blobId,
        ownerId: uid,
        index: i,
        dataBase64,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    if (isPermissionError(err)) {
      handleFirestoreError(err, OperationType.WRITE, metaPath);
    }
    throw err;
  }
}

export async function deleteStoredBlobs(files: StoredFileRef[], uid: string | null): Promise<void> {
  for (const file of files) {
    await deleteLocalBlob(file.blobId);
    if (!uid || file.blobId.startsWith('starter_')) continue;
    const blobMetaPath = `users/${uid}/fileBlobs/${file.blobId}`;
    const chunksPath = `${blobMetaPath}/chunks`;
    try {
      const snap = await getDocs(
        query(collection(db, chunksPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        batch.delete(doc(db, blobMetaPath));
        await batch.commit();
      } else {
        await deleteDoc(doc(db, blobMetaPath));
      }
    } catch {
      // ignore missing starter or already deleted blobs
    }
  }
}

function buildStarterGltfCrateJson(name: string): string {
  // Valid minimal glTF 2.0 beveled-proportion crate (indexed 24-vertex cube with normals)
  const positions = new Float32Array([
    // +Z front
    -0.55, -0.5,  0.55,   0.55, -0.5,  0.55,   0.55,  0.5,  0.55,  -0.55,  0.5,  0.55,
    // -Z back
     0.55, -0.5, -0.55,  -0.55, -0.5, -0.55,  -0.55,  0.5, -0.55,   0.55,  0.5, -0.55,
    // +Y top
    -0.55,  0.5,  0.55,   0.55,  0.5,  0.55,   0.55,  0.5, -0.55,  -0.55,  0.5, -0.55,
    // -Y bottom
    -0.55, -0.5, -0.55,   0.55, -0.5, -0.55,   0.55, -0.5,  0.55,  -0.55, -0.5,  0.55,
    // +X right
     0.55, -0.5,  0.55,   0.55, -0.5, -0.55,   0.55,  0.5, -0.55,   0.55,  0.5,  0.55,
    // -X left
    -0.55, -0.5, -0.55,  -0.55, -0.5,  0.55,  -0.55,  0.5,  0.55,  -0.55,  0.5, -0.55,
  ]);
  const normals = new Float32Array([
    0, 0, 1,  0, 0, 1,  0, 0, 1,  0, 0, 1,
    0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1,
    0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0,
    1, 0, 0,  1, 0, 0,  1, 0, 0,  1, 0, 0,
    -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0,
  ]);
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9, 10, 8, 10, 11,
    12, 13, 14, 12, 14, 15,
    16, 17, 18, 16, 18, 19,
    20, 21, 22, 20, 22, 23,
  ]);

  const totalBytes = positions.byteLength + normals.byteLength + indices.byteLength;
  const combined = new Uint8Array(totalBytes);
  combined.set(new Uint8Array(positions.buffer), 0);
  combined.set(new Uint8Array(normals.buffer), positions.byteLength);
  combined.set(new Uint8Array(indices.buffer), positions.byteLength + normals.byteLength);

  const b64 = uint8ArrayToBase64(combined);
  return JSON.stringify(
    {
      asset: { version: '2.0', generator: 'Masar Asset Library' },
      scene: 0,
      scenes: [{ nodes: [0] }],
      nodes: [{ name: name || 'SC07_SupplyCrate', mesh: 0 }],
      meshes: [
        {
          name: 'CrateMesh',
          primitives: [
            {
              attributes: { POSITION: 0, NORMAL: 1 },
              indices: 2,
              material: 0,
            },
          ],
        },
      ],
      materials: [
        {
          name: 'SciFiCrateAlloy',
          pbrMetallicRoughness: {
            baseColorFactor: [0.22, 0.38, 0.56, 1],
            metallicFactor: 0.45,
            roughnessFactor: 0.38,
          },
        },
      ],
      buffers: [
        {
          uri: `data:application/octet-stream;base64,${b64}`,
          byteLength: totalBytes,
        },
      ],
      bufferViews: [
        { buffer: 0, byteOffset: 0, byteLength: positions.byteLength, target: 34962 },
        { buffer: 0, byteOffset: positions.byteLength, byteLength: normals.byteLength, target: 34962 },
        { buffer: 0, byteOffset: positions.byteLength + normals.byteLength, byteLength: indices.byteLength, target: 34963 },
      ],
      accessors: [
        {
          bufferView: 0,
          componentType: 5126,
          count: 24,
          type: 'VEC3',
          min: [-0.55, -0.5, -0.55],
          max: [0.55, 0.5, 0.55],
        },
        {
          bufferView: 1,
          componentType: 5126,
          count: 24,
          type: 'VEC3',
        },
        {
          bufferView: 2,
          componentType: 5123,
          count: 36,
          type: 'SCALAR',
        },
      ],
    },
    null,
    2
  );
}

function buildStarterSampleBlob(fileRef: StoredFileRef): Blob {
  const ext = fileRef.extension.toUpperCase();
  let content = '';
  if (ext === 'GODOT') {
    content = `; Project Vault Starter Backup\nconfig_version=5\n\n[application]\nconfig/name="${fileRef.name}"\nrun/main_scene="res://scenes/level_01.tscn"\n`;
  } else if (ext === 'GD') {
    content = `extends CharacterBody2D\n\nconst SPEED = 240.0\nconst JUMP_VELOCITY = -420.0\n\nfunc _physics_process(delta: float) -> void:\n\tmove_and_slide()\n`;
  } else if (ext === 'GLTF') {
    content = buildStarterGltfCrateJson(fileRef.name);
  } else if (ext === 'JSON') {
    content = JSON.stringify(
      {
        asset: { version: '2.0', generator: 'Masar Asset Library' },
        name: fileRef.name,
        nodes: [{ name: 'SC07_SupplyCrate', mesh: 0 }],
      },
      null,
      2
    );
  } else {
    content = `Masar Workspace Archive File\nFile: ${fileRef.name}\nExtension: ${fileRef.extension}\nRecovered cleanly from Project Vault / Asset Library.\n`;
  }
  return new Blob([content], { type: fileRef.mimeType || 'text/plain;charset=utf-8' });
}

export async function retrieveFileBlob(fileRef: StoredFileRef, uid: string | null): Promise<Blob> {
  const cached = await getLocalBlob(fileRef.blobId);
  if (cached) return cached;

  if (fileRef.blobId.startsWith('starter_')) {
    return buildStarterSampleBlob(fileRef);
  }

  if (uid) {
    const chunksPath = `users/${uid}/fileBlobs/${fileRef.blobId}/chunks`;
    try {
      const snap = await getDocs(
        query(collection(db, chunksPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) {
        const sortedDocs = [...snap.docs].sort(
          (a, b) => Number(a.data().index ?? 0) - Number(b.data().index ?? 0)
        );
        const arrays = sortedDocs.map((d) => {
          const b64 = String(d.data().dataBase64 || '');
          return b64 ? base64ToUint8Array(b64) : new Uint8Array(0);
        });
        const totalBytes = arrays.reduce((sum, arr) => sum + arr.length, 0);
        const merged = new Uint8Array(totalBytes);
        let offset = 0;
        for (const arr of arrays) {
          merged.set(arr, offset);
          offset += arr.length;
        }
        const reconstructed = new Blob([merged], {
          type: fileRef.mimeType || 'application/octet-stream',
        });
        await putLocalBlob(fileRef.blobId, fileRef.name, fileRef.mimeType, reconstructed);
        return reconstructed;
      }
    } catch (err) {
      if (isPermissionError(err)) {
        handleFirestoreError(err, OperationType.LIST, chunksPath);
      }
      throw new Error(`تعذر استرداد الملف "${fileRef.name}" من السحابة. تحقق من الاتصال وحاول مجدداً.`);
    }
  }

  throw new Error(
    `لم يتم العثور على بيانات الملف "${fileRef.name}". قد يكون محفوظاً محلياً على جهاز آخر أو لم تكتمل مزامنته.`
  );
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadSingleStoredFile(
  fileRef: StoredFileRef,
  uid: string | null
): Promise<void> {
  const blob = await retrieveFileBlob(fileRef, uid);
  triggerBlobDownload(blob, fileRef.name);
}

export async function downloadBundleAsZip(
  bundleName: string,
  files: StoredFileRef[],
  uid: string | null
): Promise<void> {
  if (files.length === 0) {
    throw new Error('لا توجد ملفات مرفقة للتحميل.');
  }
  if (files.length === 1) {
    await downloadSingleStoredFile(files[0], uid);
    return;
  }

  const zip = new JSZip();
  for (const fileRef of files) {
    const blob = await retrieveFileBlob(fileRef, uid);
    zip.file(fileRef.name, blob);
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const cleanName =
    bundleName
      .trim()
      .replace(/[^\u0600-\u06FFa-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'masar-backup';
  triggerBlobDownload(zipBlob, `${cleanName}.zip`);
}
