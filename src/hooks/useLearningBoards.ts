import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { createStarterBoardsData } from '../data/presets';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  BoardCard,
  BoardConnection,
  BoardDrawingStroke,
  BoardViewport,
  LearningBoard,
  StoredFileRef,
} from '../types/workspace';
import { deleteStoredBlobs } from '../lib/fileStorage';
import { BOARD_MAX_CARDS, BOARD_MAX_CONNECTIONS, sanitizeLearningBoard } from '../utils/boardLogic';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_BOARDS_KEY = 'masar_learning_boards_v1';
const ACTIVE_BOARD_KEY = 'masar_active_board_id_v1';

function loadLocalBoards(): LearningBoard[] {
  try {
    const raw = localStorage.getItem(LOCAL_BOARDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LearningBoard[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(sanitizeLearningBoard);
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterBoardsData().map(sanitizeLearningBoard);
}

function saveLocalBoards(boards: LearningBoard[]): void {
  try {
    localStorage.setItem(LOCAL_BOARDS_KEY, JSON.stringify(boards));
  } catch {
    // ignore quota errors
  }
}

function loadActiveBoardId(): string {
  try {
    return localStorage.getItem(ACTIVE_BOARD_KEY) || '';
  } catch {
    return '';
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export interface BoardLayoutPatch {
  title?: string;
  description?: string;
  cards?: BoardCard[];
  connections?: BoardConnection[];
  drawings?: BoardDrawingStroke[];
  viewport?: BoardViewport;
}

export function useLearningBoards(user: User | null, authReady: boolean) {
  const [localBoards, setLocalBoards] = useState<LearningBoard[]>(() => loadLocalBoards());
  const [cloudBoards, setCloudBoards] = useState<LearningBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>(() => loadActiveBoardId());
  const [cloudLoading, setCloudLoading] = useState(false);
  const [boardMessage, setBoardMessage] = useState<string | null>(null);
  const [boardError, setBoardError] = useState<string | null>(null);

  const seededForUidRef = useRef<string | null>(null);
  const debounceTimersRef = useRef<Record<string, number>>({});
  const pendingCloudIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    saveLocalBoards(localBoards);
  }, [localBoards]);

  useEffect(() => {
    try {
      if (activeBoardId) {
        localStorage.setItem(ACTIVE_BOARD_KEY, activeBoardId);
      }
    } catch {
      // ignore
    }
  }, [activeBoardId]);

  const showToast = useCallback((msg: string) => {
    setBoardMessage(msg);
    window.setTimeout(() => {
      setBoardMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const seedCloudBoardsIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/learningBoards`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;

      const starters = loadLocalBoards();
      for (const b of starters) {
        const boardId = createSafeId('board');
        const clean = sanitizeLearningBoard({ ...b, id: boardId, ownerId: uid });
        await setDoc(doc(db, `${collectionPath}/${boardId}`), {
          id: clean.id,
          ownerId: uid,
          title: clean.title,
          description: clean.description,
          cards: clean.cards,
          connections: clean.connections,
          drawings: clean.drawings,
          viewport: clean.viewport,
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
      setCloudBoards([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/learningBoards`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: LearningBoard[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return sanitizeLearningBoard({
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || 'لوحة تعلم'),
              description: String(data.description || ''),
              cards: Array.isArray(data.cards) ? (data.cards as BoardCard[]) : [],
              connections: Array.isArray(data.connections)
                ? (data.connections as BoardConnection[])
                : [],
              drawings: Array.isArray(data.drawings)
                ? (data.drawings as BoardDrawingStroke[])
                : [],
              viewport: (data.viewport as BoardViewport) || { panX: 0, panY: 0, zoom: 1 },
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            });
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        if (list.length === 0) {
          void seedCloudBoardsIfEmpty(user.uid);
        }

        setCloudBoards((prev) => {
          // Preserve locally edited optimistic state while debounce save is still in flight
          const prevMap = new Map(prev.map((b) => [b.id, b]));
          return list.map((serverBoard) =>
            pendingCloudIdsRef.current.has(serverBoard.id) && prevMap.has(serverBoard.id)
              ? prevMap.get(serverBoard.id)!
              : serverBoard
          );
        });
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudBoardsIfEmpty]);

  useEffect(() => {
    return () => {
      for (const timer of Object.values(debounceTimersRef.current)) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const boards = user ? cloudBoards : localBoards;

  const activeBoard = useMemo(() => {
    if (boards.length === 0) return null;
    return boards.find((b) => b.id === activeBoardId) || boards[0];
  }, [boards, activeBoardId]);

  useEffect(() => {
    if (activeBoard && activeBoard.id !== activeBoardId) {
      setActiveBoardId(activeBoard.id);
    }
  }, [activeBoard, activeBoardId]);

  const selectBoard = useCallback((boardId: string) => {
    setActiveBoardId(boardId);
  }, []);

  const createBoard = useCallback(
    async (input: { title: string; description?: string }): Promise<LearningBoard> => {
      setBoardError(null);
      const boardId = createSafeId('board');
      const nowIso = new Date().toISOString();
      const newBoard = sanitizeLearningBoard({
        id: boardId,
        ownerId: user?.uid || 'local',
        title: input.title.trim() || 'لوحة تعلم جديدة',
        description: (input.description || '').trim(),
        cards: [],
        connections: [],
        drawings: [],
        viewport: { panX: 0, panY: 0, zoom: 1 },
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      if (!user) {
        setLocalBoards((prev) => [newBoard, ...prev]);
        setActiveBoardId(newBoard.id);
        showToast(`تم إنشاء لوحة التعلم "${newBoard.title}".`);
        return newBoard;
      }

      const docPath = `users/${user.uid}/learningBoards/${boardId}`;
      try {
        await setDoc(doc(db, docPath), {
          id: newBoard.id,
          ownerId: user.uid,
          title: newBoard.title,
          description: newBoard.description,
          cards: [],
          connections: [],
          drawings: [],
          viewport: newBoard.viewport,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setActiveBoardId(newBoard.id);
        showToast(`تم إنشاء لوحة التعلم "${newBoard.title}" وحفظها في حسابك.`);
        return newBoard;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
        return newBoard;
      }
    },
    [user, showToast]
  );

  const persistCloudBoard = useCallback(
    async (board: LearningBoard) => {
      if (!user) return;
      const docPath = `users/${user.uid}/learningBoards/${board.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          title: board.title,
          description: board.description,
          cards: board.cards,
          connections: board.connections,
          drawings: board.drawings,
          viewport: board.viewport,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      } finally {
        pendingCloudIdsRef.current.delete(board.id);
      }
    },
    [user]
  );

  const saveBoardLayout = useCallback(
    (boardId: string, patch: BoardLayoutPatch, options?: { immediate?: boolean }) => {
      setBoardError(null);
      const nowIso = new Date().toISOString();
      let updatedBoardSnapshot: LearningBoard | null = null;

      const applyPatch = (list: LearningBoard[]) =>
        list.map((b) => {
          if (b.id !== boardId) return b;
          const merged = sanitizeLearningBoard({
            ...b,
            title: patch.title !== undefined ? patch.title : b.title,
            description: patch.description !== undefined ? patch.description : b.description,
            cards: patch.cards !== undefined ? patch.cards : b.cards,
            connections: patch.connections !== undefined ? patch.connections : b.connections,
            drawings: patch.drawings !== undefined ? patch.drawings : b.drawings,
            viewport: patch.viewport !== undefined ? patch.viewport : b.viewport,
            updatedAt: nowIso,
          });
          updatedBoardSnapshot = merged;
          return merged;
        });

      if (!user) {
        setLocalBoards(applyPatch);
        return;
      }

      pendingCloudIdsRef.current.add(boardId);
      setCloudBoards(applyPatch);

      if (debounceTimersRef.current[boardId]) {
        window.clearTimeout(debounceTimersRef.current[boardId]);
        delete debounceTimersRef.current[boardId];
      }

      if (options?.immediate) {
        if (updatedBoardSnapshot) {
          void persistCloudBoard(updatedBoardSnapshot);
        }
        return;
      }

      debounceTimersRef.current[boardId] = window.setTimeout(() => {
        delete debounceTimersRef.current[boardId];
        if (updatedBoardSnapshot) {
          void persistCloudBoard(updatedBoardSnapshot);
        } else {
          pendingCloudIdsRef.current.delete(boardId);
        }
      }, 380);
    },
    [user, persistCloudBoard]
  );

  const renameBoard = useCallback(
    (boardId: string, title: string, description?: string) => {
      saveBoardLayout(
        boardId,
        { title: title.trim() || 'لوحة تعلم', description },
        { immediate: true }
      );
      showToast(`تم تحديث اسم اللوحة إلى "${title.trim()}".`);
    },
    [saveBoardLayout, showToast]
  );

  const deleteBoard = useCallback(
    async (boardId: string) => {
      setBoardError(null);
      if (debounceTimersRef.current[boardId]) {
        window.clearTimeout(debounceTimersRef.current[boardId]);
        delete debounceTimersRef.current[boardId];
      }
      pendingCloudIdsRef.current.delete(boardId);

      const allBoards = user ? cloudBoards : localBoards;
      const targetBoard = allBoards.find((b) => b.id === boardId);
      const otherBlobIds = new Set(
        allBoards
          .filter((b) => b.id !== boardId)
          .flatMap((b) => b.cards.map((c) => c.originalFileRef?.blobId).filter(Boolean))
      );
      const exclusiveRefs: StoredFileRef[] = (targetBoard?.cards || [])
        .map((c) => c.originalFileRef)
        .filter((ref): ref is StoredFileRef => Boolean(ref && !otherBlobIds.has(ref.blobId)));

      if (!user) {
        setLocalBoards((prev) => {
          const remaining = prev.filter((b) => b.id !== boardId);
          return remaining.length > 0 ? remaining : createStarterBoardsData();
        });
        if (exclusiveRefs.length > 0) {
          void deleteStoredBlobs(exclusiveRefs, null);
        }
        showToast('تم حذف لوحة التعلم.');
        return;
      }

      const docPath = `users/${user.uid}/learningBoards/${boardId}`;
      try {
        await deleteDoc(doc(db, docPath));
        if (exclusiveRefs.length > 0) {
          void deleteStoredBlobs(exclusiveRefs, user.uid);
        }
        showToast('تم حذف لوحة التعلم من حسابك.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, cloudBoards, localBoards, showToast]
  );

  const appendCardsToBoard = useCallback(
    async (
      boardId: string | null,
      newCards: BoardCard[],
      newConnections: BoardConnection[] = []
    ): Promise<string> => {
      let target =
        (boardId ? boards.find((b) => b.id === boardId) : null) || activeBoard || null;

      if (!target) {
        target = await createBoard({ title: 'لوحة التعلم الرئيسية' });
      }

      const mergedCards = [...target.cards, ...newCards].slice(0, BOARD_MAX_CARDS);
      const mergedConns = [...target.connections, ...newConnections].slice(
        0,
        BOARD_MAX_CONNECTIONS
      );

      saveBoardLayout(
        target.id,
        { cards: mergedCards, connections: mergedConns },
        { immediate: true }
      );
      setActiveBoardId(target.id);
      showToast(
        `تمت إضافة ${newCards.length} ${newCards.length === 1 ? 'بطاقة' : 'بطاقات'} إلى لوحة "${target.title}".`
      );
      return target.id;
    },
    [boards, activeBoard, createBoard, saveBoardLayout, showToast]
  );

  return {
    boards,
    activeBoard,
    activeBoardId: activeBoard?.id || '',
    cloudLoading,
    boardMessage,
    boardError,
    dismissBoardError: () => setBoardError(null),
    selectBoard,
    createBoard,
    renameBoard,
    deleteBoard,
    saveBoardLayout,
    appendCardsToBoard,
  };
}
