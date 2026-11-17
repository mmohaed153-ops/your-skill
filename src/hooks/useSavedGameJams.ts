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
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  GameJamSearchResult,
  SavedGameJam,
  SavedGameJamResource,
} from '../types/workspace';
import { buildJamResourceLink } from '../utils/gameJamLogic';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_SAVED_JAMS_KEY = 'masar_saved_jams_v1';

function loadLocalSavedJams(): SavedGameJam[] {
  try {
    const raw = localStorage.getItem(LOCAL_SAVED_JAMS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SavedGameJam[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return [];
}

function saveLocalSavedJams(jams: SavedGameJam[]): void {
  try {
    localStorage.setItem(LOCAL_SAVED_JAMS_KEY, JSON.stringify(jams));
  } catch {
    // ignore quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export function useSavedGameJams(user: User | null, authReady: boolean) {
  const [localJams, setLocalJams] = useState<SavedGameJam[]>(() => loadLocalSavedJams());
  const [cloudJams, setCloudJams] = useState<SavedGameJam[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [jamsMessage, setJamsMessage] = useState<string | null>(null);
  const [jamsError, setJamsError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalSavedJams(localJams);
  }, [localJams]);

  const showToast = useCallback((msg: string) => {
    setJamsMessage(msg);
    window.setTimeout(() => {
      setJamsMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const syncLocalJamsToCloudIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/savedGameJams`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;
      const locals = loadLocalSavedJams();
      for (const jam of locals) {
        const jamId = jam.id.startsWith('jam_') ? jam.id : createSafeId('jam');
        await setDoc(doc(db, `${collectionPath}/${jamId}`), {
          id: jamId,
          ownerId: uid,
          name: jam.name.slice(0, 200),
          description: jam.description.slice(0, 2000),
          startDate: jam.startDate.slice(0, 64),
          endDate: jam.endDate.slice(0, 64),
          status: jam.status,
          mode: jam.mode,
          location: jam.location.slice(0, 160),
          theme: jam.theme.slice(0, 200),
          platform: jam.platform.slice(0, 120),
          organizer: jam.organizer.slice(0, 160),
          officialUrl: jam.officialUrl.slice(0, 2048),
          thumbnailUrl: (jam.thumbnailUrl || '').slice(0, 350000),
          personalNotes: (jam.personalNotes || '').slice(0, 5000),
          linkedProjectId: (jam.linkedProjectId || '').slice(0, 128),
          linkedBoardId: (jam.linkedBoardId || '').slice(0, 128),
          resources: (jam.resources || []).slice(0, 30),
          infoUpdatedAt: (jam.infoUpdatedAt || new Date().toISOString()).slice(0, 64),
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
      setCloudJams([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/savedGameJams`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: SavedGameJam[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              name: String(data.name || ''),
              description: String(data.description || ''),
              startDate: String(data.startDate || ''),
              endDate: String(data.endDate || ''),
              status: (data.status as SavedGameJam['status']) || 'upcoming',
              mode: (data.mode as SavedGameJam['mode']) || 'online',
              location: String(data.location || 'أونلاين عالمياً'),
              theme: String(data.theme || ''),
              platform: String(data.platform || 'itch.io'),
              organizer: String(data.organizer || ''),
              officialUrl: String(data.officialUrl || ''),
              thumbnailUrl: String(data.thumbnailUrl || ''),
              personalNotes: String(data.personalNotes || ''),
              linkedProjectId: String(data.linkedProjectId || ''),
              linkedBoardId: String(data.linkedBoardId || ''),
              resources: Array.isArray(data.resources)
                ? (data.resources as SavedGameJamResource[])
                : [],
              infoUpdatedAt: String(data.infoUpdatedAt || ''),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (list.length === 0) {
          void syncLocalJamsToCloudIfEmpty(user.uid);
        }
        setCloudJams(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, syncLocalJamsToCloudIfEmpty]);

  const savedJams = user ? cloudJams : localJams;

  const saveGameJam = useCallback(
    async (result: GameJamSearchResult): Promise<SavedGameJam> => {
      setJamsError(null);
      const existing = savedJams.find(
        (j) => j.officialUrl === result.officialUrl || j.name.toLowerCase() === result.name.toLowerCase()
      );
      if (existing) {
        showToast(`المسابقة "${existing.name}" محفوظة بالفعل في قائمتك.`);
        return existing;
      }

      const nowIso = new Date().toISOString();
      const jamId = createSafeId('jam');
      const item: SavedGameJam = {
        id: jamId,
        ownerId: user?.uid || 'local',
        name: result.name.trim().slice(0, 200),
        description: result.description.trim().slice(0, 2000),
        startDate: (result.startDate || '').slice(0, 64),
        endDate: (result.endDate || '').slice(0, 64),
        status: result.status,
        mode: result.mode,
        location: (result.location || 'أونلاين عالمياً').slice(0, 160),
        theme: (result.theme || '').slice(0, 200),
        platform: (result.platform || 'itch.io').slice(0, 120),
        organizer: (result.organizer || result.platform || '').slice(0, 160),
        officialUrl: result.officialUrl.slice(0, 2048),
        thumbnailUrl: (result.thumbnailUrl || '').slice(0, 350000),
        personalNotes: '',
        linkedProjectId: '',
        linkedBoardId: '',
        resources: [],
        infoUpdatedAt: (result.infoUpdatedAt || nowIso).slice(0, 64),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalJams((prev) => [item, ...prev]);
        showToast(`تم حفظ مسابقة "${item.name}" في مسابقاتي المحفوظة.`);
        return item;
      }

      const docPath = `users/${user.uid}/savedGameJams/${jamId}`;
      try {
        await setDoc(doc(db, docPath), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`تم حفظ مسابقة "${item.name}" في حسابك.`);
        return item;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
        throw err;
      }
    },
    [savedJams, user, showToast]
  );

  const updateSavedJam = useCallback(
    async (
      jamId: string,
      patch: Partial<
        Pick<
          SavedGameJam,
          | 'personalNotes'
          | 'theme'
          | 'startDate'
          | 'endDate'
          | 'linkedProjectId'
          | 'linkedBoardId'
          | 'resources'
        >
      >,
      silent = false
    ) => {
      setJamsError(null);
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalJams((prev) =>
          prev.map((j) => (j.id === jamId ? { ...j, ...patch, updatedAt: nowIso } : j))
        );
        if (!silent) showToast('تم تحديث بيانات المسابقة المحفوظة.');
        return;
      }

      const docPath = `users/${user.uid}/savedGameJams/${jamId}`;
      const cleanPatch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (typeof patch.personalNotes === 'string') {
        cleanPatch.personalNotes = patch.personalNotes.slice(0, 5000);
      }
      if (typeof patch.theme === 'string') cleanPatch.theme = patch.theme.slice(0, 200);
      if (typeof patch.startDate === 'string') cleanPatch.startDate = patch.startDate.slice(0, 64);
      if (typeof patch.endDate === 'string') cleanPatch.endDate = patch.endDate.slice(0, 64);
      if (typeof patch.linkedProjectId === 'string') {
        cleanPatch.linkedProjectId = patch.linkedProjectId.slice(0, 128);
      }
      if (typeof patch.linkedBoardId === 'string') {
        cleanPatch.linkedBoardId = patch.linkedBoardId.slice(0, 128);
      }
      if (Array.isArray(patch.resources)) {
        cleanPatch.resources = patch.resources.slice(0, 30);
      }

      try {
        await updateDoc(doc(db, docPath), cleanPatch);
        if (!silent) showToast('تم حفظ تحديثات المسابقة في حسابك.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const addJamResource = useCallback(
    async (jam: SavedGameJam, title: string, url: string) => {
      const resource = buildJamResourceLink(title, url);
      if (!resource) {
        setJamsError('يرجى إدخال رابط مورد صالح (يبدأ بـ https:// أو اسم نطاق).');
        return false;
      }
      const nextResources = [...jam.resources, resource].slice(0, 30);
      await updateSavedJam(jam.id, { resources: nextResources }, false);
      return true;
    },
    [updateSavedJam]
  );

  const removeJamResource = useCallback(
    async (jam: SavedGameJam, resourceId: string) => {
      const nextResources = jam.resources.filter((r) => r.id !== resourceId);
      await updateSavedJam(jam.id, { resources: nextResources }, true);
      showToast('تمت إزالة الرابط من موارد المسابقة.');
    },
    [updateSavedJam, showToast]
  );

  const deleteSavedJam = useCallback(
    async (jam: SavedGameJam) => {
      setJamsError(null);
      if (!user) {
        setLocalJams((prev) => prev.filter((j) => j.id !== jam.id));
        showToast(`تم حذف "${jam.name}" من المسابقات المحفوظة.`);
        return;
      }

      const docPath = `users/${user.uid}/savedGameJams/${jam.id}`;
      try {
        await deleteDoc(doc(db, docPath));
        showToast(`تم حذف "${jam.name}" من المسابقات المحفوظة.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, showToast]
  );

  return {
    savedJams,
    cloudLoading,
    jamsMessage,
    jamsError,
    dismissJamsError: () => setJamsError(null),
    saveGameJam,
    updateSavedJam,
    addJamResource,
    removeJamResource,
    deleteSavedJam,
  };
}
