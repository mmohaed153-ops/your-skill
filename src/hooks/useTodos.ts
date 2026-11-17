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
  writeBatch,
} from 'firebase/firestore';
import { createStarterTodosData } from '../data/presets';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { TodoLinkRef, TodoPriority, TodoTask } from '../types/workspace';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_TODOS_KEY = 'masar_todos_v1';

const EMPTY_LINK: TodoLinkRef = {
  type: 'none',
  targetId: '',
  parentId: '',
  label: '',
};

function loadLocalTodos(): TodoTask[] {
  try {
    const raw = localStorage.getItem(LOCAL_TODOS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as TodoTask[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterTodosData();
}

function saveLocalTodos(todos: TodoTask[]): void {
  try {
    localStorage.setItem(LOCAL_TODOS_KEY, JSON.stringify(todos));
  } catch {
    // ignore storage quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function normalizeLink(raw: Partial<TodoLinkRef> | undefined): TodoLinkRef {
  if (!raw || !raw.type) return { ...EMPTY_LINK };
  return {
    type: raw.type,
    targetId: String(raw.targetId || '').slice(0, 128),
    parentId: String(raw.parentId || '').slice(0, 128),
    label: String(raw.label || '').slice(0, 200),
  };
}

export interface SaveTodoPayload {
  title: string;
  description?: string;
  priority: TodoPriority;
  dueDate?: string;
  link?: TodoLinkRef;
}

export function useTodos(user: User | null, authReady: boolean) {
  const [localTodos, setLocalTodos] = useState<TodoTask[]>(() => loadLocalTodos());
  const [cloudTodos, setCloudTodos] = useState<TodoTask[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [todosMessage, setTodosMessage] = useState<string | null>(null);
  const [todosError, setTodosError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalTodos(localTodos);
  }, [localTodos]);

  const showToast = useCallback((msg: string) => {
    setTodosMessage(msg);
    setTimeout(() => {
      setTodosMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const seedCloudTodosIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/todos`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;

      const currentLocal = loadLocalTodos();
      if (currentLocal.length === 0) return;

      const batch = writeBatch(db);
      for (const task of currentLocal) {
        const todoId = createSafeId('todo');
        batch.set(doc(db, `${collectionPath}/${todoId}`), {
          id: todoId,
          ownerId: uid,
          title: task.title.slice(0, 200),
          description: task.description.slice(0, 1200),
          priority: task.priority,
          dueDate: task.dueDate.slice(0, 40),
          completed: Boolean(task.completed),
          completedAt: task.completedAt.slice(0, 64),
          link: normalizeLink(task.link),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, collectionPath);
    }
  }, []);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudTodos([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/todos`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: TodoTask[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              priority: (data.priority as TodoPriority) || 'medium',
              dueDate: String(data.dueDate || ''),
              completed: Boolean(data.completed),
              completedAt: String(data.completedAt || ''),
              link: normalizeLink(data.link as Partial<TodoLinkRef> | undefined),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (list.length === 0) {
          void seedCloudTodosIfEmpty(user.uid);
        }
        setCloudTodos(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudTodosIfEmpty]);

  const todos = user ? cloudTodos : localTodos;

  const createTodo = useCallback(
    async (payload: SaveTodoPayload): Promise<TodoTask> => {
      setTodosError(null);
      const todoId = createSafeId('todo');
      const nowIso = new Date().toISOString();
      const task: TodoTask = {
        id: todoId,
        ownerId: user?.uid || 'local',
        title: payload.title.trim().slice(0, 200),
        description: (payload.description || '').trim().slice(0, 1200),
        priority: payload.priority,
        dueDate: (payload.dueDate || '').trim().slice(0, 40),
        completed: false,
        completedAt: '',
        link: normalizeLink(payload.link),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalTodos((prev) => [task, ...prev]);
        showToast(`تمت إضافة المهمة "${task.title}" إلى قائمة المهام.`);
        return task;
      }

      const todoPath = `users/${user.uid}/todos/${todoId}`;
      try {
        await setDoc(doc(db, todoPath), {
          id: task.id,
          ownerId: user.uid,
          title: task.title,
          description: task.description,
          priority: task.priority,
          dueDate: task.dueDate,
          completed: false,
          completedAt: '',
          link: task.link,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`تمت إضافة المهمة "${task.title}" وحفظها في حسابك.`);
        return task;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, todoPath);
        return task;
      }
    },
    [user, showToast]
  );

  const updateTodo = useCallback(
    async (todoId: string, payload: SaveTodoPayload): Promise<void> => {
      setTodosError(null);
      const existing = todos.find((t) => t.id === todoId);
      const title = payload.title.trim().slice(0, 200);
      const description = (payload.description || '').trim().slice(0, 1200);
      const dueDate = (payload.dueDate || '').trim().slice(0, 40);
      const link = normalizeLink(payload.link);
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalTodos((prev) =>
          prev.map((t) =>
            t.id === todoId
              ? { ...t, title, description, priority: payload.priority, dueDate, link, updatedAt: nowIso }
              : t
          )
        );
        showToast(`تم تحديث المهمة "${title}".`);
        return;
      }

      const todoPath = `users/${user.uid}/todos/${todoId}`;
      try {
        await updateDoc(doc(db, todoPath), {
          title,
          description,
          priority: payload.priority,
          dueDate,
          completed: existing ? existing.completed : false,
          completedAt: existing ? existing.completedAt : '',
          link,
          updatedAt: serverTimestamp(),
        });
        showToast(`تم تحديث المهمة "${title}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, todoPath);
      }
    },
    [user, todos, showToast]
  );

  const toggleTodoCompleted = useCallback(
    async (task: TodoTask): Promise<void> => {
      setTodosError(null);
      const nextCompleted = !task.completed;
      const nowIso = new Date().toISOString();
      const completedAt = nextCompleted ? nowIso : '';

      if (!user) {
        setLocalTodos((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, completed: nextCompleted, completedAt, updatedAt: nowIso }
              : t
          )
        );
        return;
      }

      const todoPath = `users/${user.uid}/todos/${task.id}`;
      try {
        await updateDoc(doc(db, todoPath), {
          completed: nextCompleted,
          completedAt,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, todoPath);
      }
    },
    [user]
  );

  const deleteTodo = useCallback(
    async (task: TodoTask): Promise<void> => {
      setTodosError(null);
      if (!user) {
        setLocalTodos((prev) => prev.filter((t) => t.id !== task.id));
        showToast(`تم حذف المهمة "${task.title}".`);
        return;
      }

      const todoPath = `users/${user.uid}/todos/${task.id}`;
      try {
        await deleteDoc(doc(db, todoPath));
        showToast(`تم حذف المهمة "${task.title}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, todoPath);
      }
    },
    [user, showToast]
  );

  return {
    todos,
    cloudLoading,
    todosMessage,
    todosError,
    dismissTodosError: () => setTodosError(null),
    createTodo,
    updateTodo,
    toggleTodoCompleted,
    deleteTodo,
  };
}
