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
import { createStarterNotesData } from '../data/presets';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { NoteLinkRef, WorkspaceNote } from '../types/workspace';
import {
  buildNotePlainPreview,
  NOTE_FOLDER_MAX,
  NOTE_MAX_LINKS,
  NOTE_TITLE_MAX,
  sanitizeNoteHtml,
} from '../utils/notesLogic';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_NOTES_KEY = 'masar_workspace_notes_v1';

function loadLocalNotes(): WorkspaceNote[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WorkspaceNote[];
      if (Array.isArray(parsed)) {
        return parsed.map((n) => ({
          ...n,
          tags: Array.isArray(n.tags) ? n.tags : [],
          links: Array.isArray(n.links) ? n.links : [],
          pinned: Boolean(n.pinned),
          plainPreview: n.plainPreview || buildNotePlainPreview(n.contentHtml || ''),
        }));
      }
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterNotesData();
}

function saveLocalNotes(notes: WorkspaceNote[]): void {
  try {
    localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(notes));
  } catch {
    // ignore storage quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export interface CreateNoteInput {
  title?: string;
  contentHtml?: string;
  folder?: string;
  tags?: string[];
  pinned?: boolean;
  links?: NoteLinkRef[];
}

export interface UpdateNotePatch {
  title?: string;
  contentHtml?: string;
  folder?: string;
  tags?: string[];
  pinned?: boolean;
  links?: NoteLinkRef[];
}

export function useNotes(user: User | null, authReady: boolean) {
  const [localNotes, setLocalNotes] = useState<WorkspaceNote[]>(() => loadLocalNotes());
  const [cloudNotes, setCloudNotes] = useState<WorkspaceNote[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [notesMessage, setNotesMessage] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalNotes(localNotes);
  }, [localNotes]);

  const showToast = useCallback((msg: string) => {
    setNotesMessage(msg);
    setTimeout(() => {
      setNotesMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const seedCloudNotesIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/notes`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;

      const currentLocal = loadLocalNotes();
      for (const note of currentLocal) {
        const noteId = createSafeId('note');
        const sanitizedHtml = sanitizeNoteHtml(note.contentHtml || '');
        const plainPreview = buildNotePlainPreview(sanitizedHtml).slice(0, 400);
        await setDoc(doc(db, `${collectionPath}/${noteId}`), {
          id: noteId,
          ownerId: uid,
          title: (note.title.trim() || 'ملاحظة بدون عنوان').slice(0, NOTE_TITLE_MAX),
          contentHtml: sanitizedHtml,
          plainPreview,
          folder: (note.folder.trim() || 'ملاحظات عامة').slice(0, NOTE_FOLDER_MAX),
          tags: (note.tags || []).slice(0, 15).map((t) => String(t).slice(0, 40)),
          pinned: Boolean(note.pinned),
          links: (note.links || []).slice(0, NOTE_MAX_LINKS).map((l) => ({
            type: l.type,
            targetId: l.targetId,
            parentId: String(l.parentId || '').slice(0, 128),
            label: String(l.label || 'عنصر مرتبط').slice(0, 200),
          })),
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
      setCloudNotes([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/notes`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loaded: WorkspaceNote[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            const contentHtml = String(data.contentHtml || '');
            const linksRaw = Array.isArray(data.links) ? data.links : [];
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || 'ملاحظة بدون عنوان'),
              contentHtml,
              plainPreview: String(data.plainPreview || buildNotePlainPreview(contentHtml)),
              folder: String(data.folder || 'ملاحظات عامة'),
              tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
              pinned: Boolean(data.pinned),
              links: linksRaw.map((l: Record<string, unknown>) => ({
                type: l.type as NoteLinkRef['type'],
                targetId: String(l.targetId || ''),
                parentId: String(l.parentId || ''),
                label: String(l.label || ''),
              })),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

        if (loaded.length === 0) {
          void seedCloudNotesIfEmpty(user.uid);
        }

        setCloudNotes(loaded);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudNotesIfEmpty]);

  const notes = user ? cloudNotes : localNotes;

  const createNote = useCallback(
    async (input?: CreateNoteInput): Promise<WorkspaceNote> => {
      setNotesError(null);
      const id = createSafeId('note');
      const nowIso = new Date().toISOString();
      const title = (input?.title?.trim() || 'ملاحظة جديدة').slice(0, NOTE_TITLE_MAX);
      const contentHtml = sanitizeNoteHtml(input?.contentHtml ?? '<p></p>');
      const plainPreview = buildNotePlainPreview(contentHtml).slice(0, 400);
      const folder = (input?.folder?.trim() || 'ملاحظات عامة').slice(0, NOTE_FOLDER_MAX);
      const tags = (input?.tags || []).slice(0, 15).map((t) => t.trim().slice(0, 40)).filter(Boolean);
      const pinned = Boolean(input?.pinned);
      const links = (input?.links || []).slice(0, NOTE_MAX_LINKS).map((l) => ({
        type: l.type,
        targetId: l.targetId,
        parentId: String(l.parentId || '').slice(0, 128),
        label: String(l.label || 'عنصر مرتبط').slice(0, 200),
      }));

      const newNote: WorkspaceNote = {
        id,
        ownerId: user?.uid || 'local',
        title,
        contentHtml,
        plainPreview,
        folder,
        tags,
        pinned,
        links,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalNotes((prev) => [newNote, ...prev]);
        return newNote;
      }

      const docPath = `users/${user.uid}/notes/${id}`;
      try {
        await setDoc(doc(db, docPath), {
          id,
          ownerId: user.uid,
          title,
          contentHtml,
          plainPreview,
          folder,
          tags,
          pinned,
          links,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }

      return newNote;
    },
    [user]
  );

  const updateNote = useCallback(
    async (noteId: string, patch: UpdateNotePatch) => {
      setNotesError(null);
      const current = notes.find((n) => n.id === noteId);
      if (!current) return;

      const title =
        patch.title !== undefined
          ? (patch.title.trim() || 'ملاحظة بدون عنوان').slice(0, NOTE_TITLE_MAX)
          : current.title;
      const contentHtml =
        patch.contentHtml !== undefined
          ? sanitizeNoteHtml(patch.contentHtml)
          : current.contentHtml;
      const plainPreview = buildNotePlainPreview(contentHtml).slice(0, 400);
      const folder =
        patch.folder !== undefined
          ? (patch.folder.trim() || 'ملاحظات عامة').slice(0, NOTE_FOLDER_MAX)
          : current.folder;
      const tags =
        patch.tags !== undefined
          ? patch.tags.slice(0, 15).map((t) => t.trim().slice(0, 40)).filter(Boolean)
          : current.tags;
      const pinned = patch.pinned !== undefined ? patch.pinned : current.pinned;
      const links =
        patch.links !== undefined
          ? patch.links.slice(0, NOTE_MAX_LINKS).map((l) => ({
              type: l.type,
              targetId: l.targetId,
              parentId: String(l.parentId || '').slice(0, 128),
              label: String(l.label || 'عنصر مرتبط').slice(0, 200),
            }))
          : current.links;
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  title,
                  contentHtml,
                  plainPreview,
                  folder,
                  tags,
                  pinned,
                  links,
                  updatedAt: nowIso,
                }
              : n
          )
        );
        return;
      }

      const docPath = `users/${user.uid}/notes/${noteId}`;
      try {
        await updateDoc(doc(db, docPath), {
          title,
          contentHtml,
          plainPreview,
          folder,
          tags,
          pinned,
          links,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [notes, user]
  );

  const togglePinNote = useCallback(
    async (note: WorkspaceNote) => {
      setNotesError(null);
      const nextPinned = !note.pinned;

      if (!user) {
        setLocalNotes((prev) =>
          prev.map((n) =>
            n.id === note.id
              ? { ...n, pinned: nextPinned, updatedAt: new Date().toISOString() }
              : n
          )
        );
        showToast(nextPinned ? 'تم تثبيت الملاحظة في الأعلى.' : 'تم إلغاء تثبيت الملاحظة.');
        return;
      }

      const docPath = `users/${user.uid}/notes/${note.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          pinned: nextPinned,
          updatedAt: serverTimestamp(),
        });
        showToast(nextPinned ? 'تم تثبيت الملاحظة في الأعلى.' : 'تم إلغاء تثبيت الملاحظة.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const deleteNote = useCallback(
    async (noteId: string) => {
      setNotesError(null);
      if (!user) {
        setLocalNotes((prev) => prev.filter((n) => n.id !== noteId));
        showToast('تم حذف الملاحظة بنجاح.');
        return;
      }

      const docPath = `users/${user.uid}/notes/${noteId}`;
      try {
        await deleteDoc(doc(db, docPath));
        showToast('تم حذف الملاحظة بنجاح.');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, showToast]
  );

  return {
    notes,
    cloudLoading,
    notesMessage,
    notesError,
    dismissNotesError: () => setNotesError(null),
    createNote,
    updateNote,
    togglePinNote,
    deleteNote,
  };
}
