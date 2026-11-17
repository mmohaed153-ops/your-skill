import { useCallback, useEffect, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
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
  writeBatch,
} from 'firebase/firestore';
import { createStarterData } from '../data/presets';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import type { LearningPath, VideoStep } from '../types/learning';
import {
  calculateAllPathsProgress,
  createSafeId,
  insertStepAtOrder,
  normalizeUrl,
  removeStepAndReindex,
  reorderStepsByIds,
  reorderStepsByIndices,
  sanitizeQuickNotes,
  sortSteps,
} from '../utils/pathLogic';

const LOCAL_STORAGE_KEY = 'masar_learning_paths_v1';

interface LocalState {
  paths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  activePathId: string;
}

function loadLocalState(): LocalState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalState>;
      if (Array.isArray(parsed.paths) && parsed.paths.length > 0 && parsed.stepsByPath) {
        const activePathId =
          parsed.activePathId && parsed.paths.some((p) => p.id === parsed.activePathId)
            ? parsed.activePathId
            : parsed.paths[0].id;
        const normalizedStepsByPath: Record<string, VideoStep[]> = {};
        for (const [pId, stepList] of Object.entries(parsed.stepsByPath)) {
          normalizedStepsByPath[pId] = Array.isArray(stepList)
            ? stepList.map((s) => ({
                ...s,
                quickNotes: typeof s.quickNotes === 'string' ? s.quickNotes : '',
                quickNotesUpdatedAt:
                  typeof s.quickNotesUpdatedAt === 'string' ? s.quickNotesUpdatedAt : '',
              }))
            : [];
        }
        return {
          paths: parsed.paths,
          stepsByPath: normalizedStepsByPath,
          activePathId,
        };
      }
    }
  } catch {
    // Fall back to starter data if localStorage is corrupt or unavailable
  }

  const starter = createStarterData();
  return {
    paths: starter.paths,
    stepsByPath: starter.stepsByPath,
    activePathId: starter.paths[0].id,
  };
}

function saveLocalState(state: LocalState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

export interface VideoInputPayload {
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  order1Based: number;
  targetDate: string;
}

export interface PathInitialStepInput {
  title: string;
  description?: string;
  videoUrl: string;
  thumbnailUrl?: string;
  targetDate?: string;
}

export interface PathInputPayload {
  title: string;
  description: string;
  coverImage: string;
  initialSteps?: PathInitialStepInput[];
}

export function useLearningPaths() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const [localState, setLocalState] = useState<LocalState>(() => loadLocalState());
  const [cloudPaths, setCloudPaths] = useState<LearningPath[]>([]);
  const [cloudStepsByPath, setCloudStepsByPath] = useState<Record<string, VideoStep[]>>({});
  const [cloudActivePathId, setCloudActivePathId] = useState<string>('');
  const seededForUidRef = useRef<string | null>(null);

  // Persist local state whenever it updates
  useEffect(() => {
    saveLocalState(localState);
  }, [localState]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setCloudPaths([]);
        setCloudStepsByPath({});
        setCloudActivePathId('');
        seededForUidRef.current = null;
      }
    });
    return unsubscribe;
  }, []);

  // Seed or migrate local paths when an authenticated user has 0 cloud paths
  const seedCloudAccountIfEmpty = useCallback(
    async (uid: string) => {
      if (seededForUidRef.current === uid) return;
      seededForUidRef.current = uid;
      const pathsCollectionPath = `users/${uid}/paths`;
      try {
        const snapshot = await getDocs(
          query(collection(db, pathsCollectionPath), where('ownerId', '==', uid))
        );
        if (!snapshot.empty) return;

        const batch = writeBatch(db);
        const currentLocal = loadLocalState();
        for (const p of currentLocal.paths) {
          const pathId = createSafeId('path');
          const pathRef = doc(db, `users/${uid}/paths/${pathId}`);
          batch.set(pathRef, {
            id: pathId,
            ownerId: uid,
            title: p.title.slice(0, 160),
            description: p.description.slice(0, 600),
            coverImage: p.coverImage || '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          const pathSteps = sortSteps(currentLocal.stepsByPath[p.id] || []);
          pathSteps.forEach((step, idx) => {
            const stepId = createSafeId('step');
            const stepRef = doc(db, `users/${uid}/paths/${pathId}/steps/${stepId}`);
            batch.set(stepRef, {
              id: stepId,
              pathId,
              ownerId: uid,
              title: step.title.slice(0, 180),
              description: step.description.slice(0, 1000),
              videoUrl: step.videoUrl.slice(0, 2048),
              thumbnailUrl: step.thumbnailUrl || '',
              order: idx,
              completed: Boolean(step.completed),
              completedAt: step.completedAt || '',
              targetDate: step.targetDate || '',
              quickNotes: sanitizeQuickNotes(step.quickNotes || ''),
              quickNotesUpdatedAt: step.quickNotesUpdatedAt || '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, pathsCollectionPath);
      }
    },
    []
  );

  // Subscribe to cloud paths when signed in
  useEffect(() => {
    if (!authReady || !user) return;
    setCloudLoading(true);
    const pathsCollectionPath = `users/${user.uid}/paths`;
    const q = query(
      collection(db, pathsCollectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: LearningPath[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              coverImage: String(data.coverImage || ''),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

        if (loaded.length === 0) {
          void seedCloudAccountIfEmpty(user.uid);
        }

        setCloudPaths(loaded);
        setCloudActivePathId((prev) => {
          if (prev && loaded.some((p) => p.id === prev)) return prev;
          return loaded[0]?.id || '';
        });
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, pathsCollectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudAccountIfEmpty]);

  // Subscribe to steps for ALL cloud paths so independent counts and percentages stay live
  const cloudPathIdsKey = cloudPaths.map((p) => p.id).join(',');
  useEffect(() => {
    if (!authReady || !user || cloudPaths.length === 0) return;

    const unsubscribers = cloudPaths.map((p) => {
      const stepsCollectionPath = `users/${user.uid}/paths/${p.id}/steps`;
      const q = query(
        collection(db, stepsCollectionPath),
        where('ownerId', '==', user.uid)
      );
      return onSnapshot(
        q,
        (snapshot) => {
          const steps: VideoStep[] = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              pathId: String(data.pathId || p.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              videoUrl: String(data.videoUrl || ''),
              thumbnailUrl: String(data.thumbnailUrl || ''),
              order: typeof data.order === 'number' ? data.order : 0,
              completed: Boolean(data.completed),
              completedAt: String(data.completedAt || ''),
              targetDate: String(data.targetDate || ''),
              quickNotes: String(data.quickNotes || ''),
              quickNotesUpdatedAt: String(data.quickNotesUpdatedAt || ''),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          });
          setCloudStepsByPath((prev) => ({
            ...prev,
            [p.id]: sortSteps(steps),
          }));
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, stepsCollectionPath);
        }
      );
    });

    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [authReady, user, cloudPathIdsKey]);

  const isCloud = Boolean(user);
  const paths = isCloud ? cloudPaths : localState.paths;
  const stepsByPath = isCloud ? cloudStepsByPath : localState.stepsByPath;
  const activePathId = isCloud ? cloudActivePathId : localState.activePathId;
  const activePath = paths.find((p) => p.id === activePathId) || paths[0] || null;
  const steps = sortSteps((activePath ? stepsByPath[activePath.id] : []) || []);
  const pathProgressMap = calculateAllPathsProgress(paths, stepsByPath);

  const selectPath = useCallback(
    (pathId: string) => {
      if (isCloud) {
        setCloudActivePathId(pathId);
      } else {
        setLocalState((prev) => ({ ...prev, activePathId: pathId }));
      }
    },
    [isCloud]
  );

  const signInWithGoogle = useCallback(async () => {
    setErrorBanner(null);
    try {
      await signInWithPopup(auth, googleProvider);
      setSyncMessage('تم ربط حسابك وحفظ جميع مساراتك في السحابة.');
      setTimeout(() => setSyncMessage(null), 4000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (!msg.includes('popup-closed-by-user')) {
        setErrorBanner('تعذر تسجيل الدخول عبر جوجل. يرجى المحاولة مرة أخرى.');
      }
    }
  }, []);

  const logout = useCallback(async () => {
    setErrorBanner(null);
    await signOut(auth);
  }, []);

  const createPath = useCallback(
    async (payload: PathInputPayload): Promise<string> => {
      setErrorBanner(null);
      const id = createSafeId('path');
      const nowIso = new Date().toISOString();
      const title = payload.title.trim().slice(0, 160);
      const description = payload.description.trim().slice(0, 600);
      const coverImage = (payload.coverImage ?? '').slice(0, 350000);
      const starterInputs = Array.isArray(payload.initialSteps) ? payload.initialSteps : [];

      const createdSteps: VideoStep[] = starterInputs
        .filter((s) => s.title.trim() && s.videoUrl.trim())
        .map((s, idx) => ({
          id: createSafeId('step'),
          pathId: id,
          ownerId: user?.uid || 'local',
          title: s.title.trim().slice(0, 180),
          description: (s.description || '').trim().slice(0, 1000),
          videoUrl: normalizeUrl(s.videoUrl).slice(0, 2048),
          thumbnailUrl: (s.thumbnailUrl || '').slice(0, 350000),
          order: idx,
          completed: false,
          completedAt: '',
          targetDate: (s.targetDate || '').trim().slice(0, 40),
          quickNotes: '',
          quickNotesUpdatedAt: '',
          createdAt: nowIso,
          updatedAt: nowIso,
        }));

      if (!user) {
        const newPath: LearningPath = {
          id,
          ownerId: 'local',
          title,
          description,
          coverImage,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setLocalState((prev) => ({
          paths: [...prev.paths, newPath],
          stepsByPath: { ...prev.stepsByPath, [id]: createdSteps },
          activePathId: id,
        }));
        return id;
      }

      const pathDocRef = `users/${user.uid}/paths/${id}`;
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, pathDocRef), {
          id,
          ownerId: user.uid,
          title,
          description,
          coverImage,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        for (const step of createdSteps) {
          batch.set(doc(db, `users/${user.uid}/paths/${id}/steps/${step.id}`), {
            id: step.id,
            pathId: id,
            ownerId: user.uid,
            title: step.title,
            description: step.description,
            videoUrl: step.videoUrl,
            thumbnailUrl: step.thumbnailUrl,
            order: step.order,
            completed: false,
            completedAt: '',
            targetDate: step.targetDate,
            quickNotes: '',
            quickNotesUpdatedAt: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
        setCloudActivePathId(id);
        return id;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, pathDocRef);
        return id;
      }
    },
    [user]
  );

  const updatePath = useCallback(
    async (pathId: string, payload: PathInputPayload) => {
      setErrorBanner(null);
      const title = payload.title.trim().slice(0, 160);
      const description = payload.description.trim().slice(0, 600);
      const coverImage = payload.coverImage ?? '';

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          paths: prev.paths.map((p) =>
            p.id === pathId
              ? { ...p, title, description, coverImage, updatedAt: new Date().toISOString() }
              : p
          ),
        }));
        return;
      }

      const pathDocRef = `users/${user.uid}/paths/${pathId}`;
      try {
        await updateDoc(doc(db, pathDocRef), {
          title,
          description,
          coverImage,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, pathDocRef);
      }
    },
    [user]
  );

  const deletePath = useCallback(
    async (pathId: string) => {
      setErrorBanner(null);
      if (!user) {
        setLocalState((prev) => {
          const remaining = prev.paths.filter((p) => p.id !== pathId);
          const nextSteps = { ...prev.stepsByPath };
          delete nextSteps[pathId];
          if (remaining.length === 0) {
            const fallbackId = createSafeId('path');
            const now = new Date().toISOString();
            const fallbackPath: LearningPath = {
              id: fallbackId,
              ownerId: 'local',
              title: 'مساري التعليمي الجديد',
              description: 'أضف فيديوهاتك التعليمية لبناء مسار مخصص.',
              coverImage: '',
              createdAt: now,
              updatedAt: now,
            };
            return {
              paths: [fallbackPath],
              stepsByPath: { [fallbackId]: [] },
              activePathId: fallbackId,
            };
          }
          return {
            paths: remaining,
            stepsByPath: nextSteps,
            activePathId:
              prev.activePathId === pathId ? remaining[0].id : prev.activePathId,
          };
        });
        return;
      }

      const stepsPath = `users/${user.uid}/paths/${pathId}/steps`;
      const pathDocRef = `users/${user.uid}/paths/${pathId}`;
      try {
        const snap = await getDocs(
          query(collection(db, stepsPath), where('ownerId', '==', user.uid))
        );
        const batch = writeBatch(db);
        snap.docs.forEach((stepDoc) => batch.delete(stepDoc.ref));
        batch.delete(doc(db, pathDocRef));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, pathDocRef);
      }
    },
    [user]
  );

  const addVideoStep = useCallback(
    async (pathId: string, payload: VideoInputPayload) => {
      setErrorBanner(null);
      const id = createSafeId('step');
      const nowIso = new Date().toISOString();
      const newStep: VideoStep = {
        id,
        pathId,
        ownerId: user?.uid || 'local',
        title: payload.title.trim().slice(0, 180),
        description: payload.description.trim().slice(0, 1000),
        videoUrl: normalizeUrl(payload.videoUrl).slice(0, 2048),
        thumbnailUrl: payload.thumbnailUrl || '',
        order: Math.max(0, payload.order1Based - 1),
        completed: false,
        completedAt: '',
        targetDate: payload.targetDate.trim().slice(0, 40),
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalState((prev) => {
          const currentSteps = prev.stepsByPath[pathId] || [];
          const reindexed = insertStepAtOrder(currentSteps, newStep, payload.order1Based);
          return {
            ...prev,
            stepsByPath: { ...prev.stepsByPath, [pathId]: reindexed },
          };
        });
        return;
      }

      const currentSteps = cloudStepsByPath[pathId] || [];
      const reindexed = insertStepAtOrder(currentSteps, newStep, payload.order1Based);
      const stepCollectionPath = `users/${user.uid}/paths/${pathId}/steps`;

      try {
        const batch = writeBatch(db);
        for (const step of reindexed) {
          const stepRef = doc(db, `${stepCollectionPath}/${step.id}`);
          if (step.id === id) {
            batch.set(stepRef, {
              id: step.id,
              pathId,
              ownerId: user.uid,
              title: step.title,
              description: step.description,
              videoUrl: step.videoUrl,
              thumbnailUrl: step.thumbnailUrl,
              order: step.order,
              completed: false,
              completedAt: '',
              targetDate: step.targetDate,
              quickNotes: '',
              quickNotesUpdatedAt: '',
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(stepRef, {
              order: step.order,
              updatedAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, stepCollectionPath);
      }
    },
    [user, cloudStepsByPath]
  );

  const updateVideoStep = useCallback(
    async (pathId: string, stepId: string, payload: VideoInputPayload) => {
      setErrorBanner(null);
      const existingSteps = (user ? cloudStepsByPath[pathId] : localState.stepsByPath[pathId]) || [];
      const target = existingSteps.find((s) => s.id === stepId);
      if (!target) return;

      const updatedStep: VideoStep = {
        ...target,
        title: payload.title.trim().slice(0, 180),
        description: payload.description.trim().slice(0, 1000),
        videoUrl: normalizeUrl(payload.videoUrl).slice(0, 2048),
        thumbnailUrl: payload.thumbnailUrl || target.thumbnailUrl,
        targetDate: payload.targetDate.trim().slice(0, 40),
        updatedAt: new Date().toISOString(),
      };

      const reindexed = insertStepAtOrder(existingSteps, updatedStep, payload.order1Based);

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          stepsByPath: { ...prev.stepsByPath, [pathId]: reindexed },
        }));
        return;
      }

      const stepCollectionPath = `users/${user.uid}/paths/${pathId}/steps`;
      try {
        const batch = writeBatch(db);
        for (const step of reindexed) {
          const stepRef = doc(db, `${stepCollectionPath}/${step.id}`);
          if (step.id === stepId) {
            batch.update(stepRef, {
              title: step.title,
              description: step.description,
              videoUrl: step.videoUrl,
              thumbnailUrl: step.thumbnailUrl,
              order: step.order,
              targetDate: step.targetDate,
              updatedAt: serverTimestamp(),
            });
          } else {
            batch.update(stepRef, {
              order: step.order,
              updatedAt: serverTimestamp(),
            });
          }
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${stepCollectionPath}/${stepId}`);
      }
    },
    [user, cloudStepsByPath, localState.stepsByPath]
  );

  const toggleStepCompleted = useCallback(
    async (pathId: string, stepId: string, nextCompleted: boolean) => {
      setErrorBanner(null);
      const completedAt = nextCompleted ? new Date().toISOString() : '';

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          stepsByPath: {
            ...prev.stepsByPath,
            [pathId]: (prev.stepsByPath[pathId] || []).map((step) =>
              step.id === stepId
                ? {
                    ...step,
                    completed: nextCompleted,
                    completedAt,
                    updatedAt: new Date().toISOString(),
                  }
                : step
            ),
          },
        }));
        return;
      }

      const stepDocPath = `users/${user.uid}/paths/${pathId}/steps/${stepId}`;
      try {
        await updateDoc(doc(db, stepDocPath), {
          completed: nextCompleted,
          completedAt,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, stepDocPath);
      }
    },
    [user]
  );

  const updateStepQuickNotes = useCallback(
    async (pathId: string, stepId: string, rawNotes: string) => {
      setErrorBanner(null);
      const quickNotes = sanitizeQuickNotes(rawNotes);
      const nowIso = new Date().toISOString();
      const quickNotesUpdatedAt = quickNotes ? nowIso : '';

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          stepsByPath: {
            ...prev.stepsByPath,
            [pathId]: (prev.stepsByPath[pathId] || []).map((step) =>
              step.id === stepId
                ? {
                    ...step,
                    quickNotes,
                    quickNotesUpdatedAt,
                    updatedAt: nowIso,
                  }
                : step
            ),
          },
        }));
        return;
      }

      const stepDocPath = `users/${user.uid}/paths/${pathId}/steps/${stepId}`;
      try {
        await updateDoc(doc(db, stepDocPath), {
          quickNotes,
          quickNotesUpdatedAt,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, stepDocPath);
      }
    },
    [user]
  );

  const commitReorderedSteps = useCallback(
    async (pathId: string, reindexed: VideoStep[]) => {
      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          stepsByPath: { ...prev.stepsByPath, [pathId]: reindexed },
        }));
        return;
      }

      const stepCollectionPath = `users/${user.uid}/paths/${pathId}/steps`;
      try {
        const batch = writeBatch(db);
        for (const step of reindexed) {
          batch.update(doc(db, `${stepCollectionPath}/${step.id}`), {
            order: step.order,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, stepCollectionPath);
      }
    },
    [user]
  );

  const reorderSteps = useCallback(
    async (pathId: string, fromIndex: number, toIndex: number) => {
      setErrorBanner(null);
      const currentSteps = (user ? cloudStepsByPath[pathId] : localState.stepsByPath[pathId]) || [];
      const reindexed = reorderStepsByIndices(currentSteps, fromIndex, toIndex);
      await commitReorderedSteps(pathId, reindexed);
    },
    [user, cloudStepsByPath, localState.stepsByPath, commitReorderedSteps]
  );

  const reorderStepsByIdOrder = useCallback(
    async (pathId: string, orderedIds: string[]) => {
      setErrorBanner(null);
      const currentSteps = (user ? cloudStepsByPath[pathId] : localState.stepsByPath[pathId]) || [];
      const reindexed = reorderStepsByIds(currentSteps, orderedIds);
      await commitReorderedSteps(pathId, reindexed);
    },
    [user, cloudStepsByPath, localState.stepsByPath, commitReorderedSteps]
  );

  const deleteVideoStep = useCallback(
    async (pathId: string, stepId: string) => {
      setErrorBanner(null);
      const currentSteps = (user ? cloudStepsByPath[pathId] : localState.stepsByPath[pathId]) || [];
      const remaining = removeStepAndReindex(currentSteps, stepId);

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          stepsByPath: { ...prev.stepsByPath, [pathId]: remaining },
        }));
        return;
      }

      const stepCollectionPath = `users/${user.uid}/paths/${pathId}/steps`;
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, `${stepCollectionPath}/${stepId}`));
        for (const step of remaining) {
          batch.update(doc(db, `${stepCollectionPath}/${step.id}`), {
            order: step.order,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${stepCollectionPath}/${stepId}`);
      }
    },
    [user, cloudStepsByPath, localState.stepsByPath]
  );

  return {
    user,
    authReady,
    cloudLoading,
    syncMessage,
    errorBanner,
    dismissError: () => setErrorBanner(null),
    paths,
    stepsByPath,
    activePath,
    steps,
    pathProgressMap,
    selectPath,
    signInWithGoogle,
    logout,
    createPath,
    updatePath,
    deletePath,
    addVideoStep,
    updateVideoStep,
    toggleStepCompleted,
    updateStepQuickNotes,
    reorderSteps,
    reorderStepsByIdOrder,
    deleteVideoStep,
  };
}
