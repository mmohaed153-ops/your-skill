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
  CalendarEvent,
  CalendarEventCategory,
  CalendarLinkTargetType,
} from '../types/workspace';
import {
  CALENDAR_CATEGORY_META,
  createStarterCalendarEvents,
} from '../utils/calendarLogic';
import { createSafeId } from '../utils/pathLogic';

const LOCAL_CALENDAR_KEY = 'masar_calendar_events_v1';

function loadLocalEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_CALENDAR_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CalendarEvent[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterCalendarEvents();
}

function saveLocalEvents(events: CalendarEvent[]): void {
  try {
    localStorage.setItem(LOCAL_CALENDAR_KEY, JSON.stringify(events));
  } catch {
    // ignore quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export interface SaveCalendarEventInput {
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  category: CalendarEventCategory;
  colorHex: string;
  reminderMinutes: number;
  reminderEnabled: boolean;
  linkedType?: CalendarLinkTargetType;
  linkedId?: string;
  linkedParentId?: string;
  linkedLabel?: string;
}

export function useCalendarEvents(user: User | null, authReady: boolean) {
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>(() => loadLocalEvents());
  const [cloudEvents, setCloudEvents] = useState<CalendarEvent[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [calendarMessage, setCalendarMessage] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalEvents(localEvents);
  }, [localEvents]);

  const showToast = useCallback((msg: string) => {
    setCalendarMessage(msg);
    window.setTimeout(() => {
      setCalendarMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const seedCloudEventsIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/calendarEvents`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;
      const locals = loadLocalEvents();
      for (const ev of locals) {
        const eventId = createSafeId('cal');
        await setDoc(doc(db, `${collectionPath}/${eventId}`), {
          id: eventId,
          ownerId: uid,
          title: ev.title.slice(0, 200),
          description: ev.description.slice(0, 1500),
          date: ev.date,
          startTime: ev.startTime.slice(0, 10),
          endTime: ev.endTime.slice(0, 10),
          category: ev.category,
          colorHex: ev.colorHex.slice(0, 16),
          reminderMinutes: ev.reminderMinutes,
          reminderEnabled: Boolean(ev.reminderEnabled),
          completed: Boolean(ev.completed),
          linkedType: ev.linkedType,
          linkedId: ev.linkedId.slice(0, 128),
          linkedParentId: ev.linkedParentId.slice(0, 128),
          linkedLabel: ev.linkedLabel.slice(0, 200),
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
      setCloudEvents([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/calendarEvents`;
    const q = query(collection(db, collectionPath), where('ownerId', '==', user.uid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CalendarEvent[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            const cat = (data.category as CalendarEventCategory) || 'personal';
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              date: String(data.date || ''),
              startTime: String(data.startTime || ''),
              endTime: String(data.endTime || ''),
              category: cat,
              colorHex: String(data.colorHex || CALENDAR_CATEGORY_META[cat].colorHex),
              reminderMinutes: typeof data.reminderMinutes === 'number' ? data.reminderMinutes : 30,
              reminderEnabled: Boolean(data.reminderEnabled),
              completed: Boolean(data.completed),
              linkedType: (data.linkedType as CalendarLinkTargetType) || 'none',
              linkedId: String(data.linkedId || ''),
              linkedParentId: String(data.linkedParentId || ''),
              linkedLabel: String(data.linkedLabel || ''),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));

        if (list.length === 0) {
          void seedCloudEventsIfEmpty(user.uid);
        }
        setCloudEvents(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudEventsIfEmpty]);

  const events = user ? cloudEvents : localEvents;

  const createEvent = useCallback(
    async (input: SaveCalendarEventInput): Promise<CalendarEvent> => {
      setCalendarError(null);
      const nowIso = new Date().toISOString();
      const eventId = createSafeId('cal');
      const item: CalendarEvent = {
        id: eventId,
        ownerId: user?.uid || 'local',
        title: input.title.trim().slice(0, 200),
        description: input.description.trim().slice(0, 1500),
        date: input.date.slice(0, 10),
        startTime: (input.startTime || '').slice(0, 10),
        endTime: (input.endTime || '').slice(0, 10),
        category: input.category,
        colorHex: (input.colorHex || CALENDAR_CATEGORY_META[input.category].colorHex).slice(0, 16),
        reminderMinutes: input.reminderMinutes,
        reminderEnabled: Boolean(input.reminderEnabled && input.reminderMinutes >= 0),
        completed: false,
        linkedType: input.linkedType || 'none',
        linkedId: (input.linkedId || '').slice(0, 128),
        linkedParentId: (input.linkedParentId || '').slice(0, 128),
        linkedLabel: (input.linkedLabel || '').slice(0, 200),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalEvents((prev) =>
          [...prev, item].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        );
        showToast(`تمت جدولة "${item.title}" في التقويم.`);
        return item;
      }

      const docPath = `users/${user.uid}/calendarEvents/${eventId}`;
      try {
        await setDoc(doc(db, docPath), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`تم حفظ الحدث "${item.title}" في تقويمك السحابي.`);
        return item;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
        throw err;
      }
    },
    [user, showToast]
  );

  const updateEvent = useCallback(
    async (eventId: string, input: Partial<SaveCalendarEventInput> & { completed?: boolean }) => {
      setCalendarError(null);
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalEvents((prev) =>
          prev
            .map((ev) =>
              ev.id === eventId
                ? {
                    ...ev,
                    ...(input.title !== undefined ? { title: input.title.trim().slice(0, 200) } : {}),
                    ...(input.description !== undefined
                      ? { description: input.description.trim().slice(0, 1500) }
                      : {}),
                    ...(input.date !== undefined ? { date: input.date.slice(0, 10) } : {}),
                    ...(input.startTime !== undefined ? { startTime: input.startTime.slice(0, 10) } : {}),
                    ...(input.endTime !== undefined ? { endTime: input.endTime.slice(0, 10) } : {}),
                    ...(input.category !== undefined ? { category: input.category } : {}),
                    ...(input.colorHex !== undefined ? { colorHex: input.colorHex.slice(0, 16) } : {}),
                    ...(input.reminderMinutes !== undefined
                      ? { reminderMinutes: input.reminderMinutes }
                      : {}),
                    ...(input.reminderEnabled !== undefined
                      ? { reminderEnabled: input.reminderEnabled }
                      : {}),
                    ...(input.completed !== undefined ? { completed: input.completed } : {}),
                    ...(input.linkedType !== undefined ? { linkedType: input.linkedType } : {}),
                    ...(input.linkedId !== undefined ? { linkedId: input.linkedId.slice(0, 128) } : {}),
                    ...(input.linkedParentId !== undefined
                      ? { linkedParentId: input.linkedParentId.slice(0, 128) }
                      : {}),
                    ...(input.linkedLabel !== undefined ? { linkedLabel: input.linkedLabel.slice(0, 200) } : {}),
                    updatedAt: nowIso,
                  }
                : ev
            )
            .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
        );
        showToast('تم تحديث الحدث في التقويم.');
        return;
      }

      const docPath = `users/${user.uid}/calendarEvents/${eventId}`;
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (input.title !== undefined) patch.title = input.title.trim().slice(0, 200);
      if (input.description !== undefined) patch.description = input.description.trim().slice(0, 1500);
      if (input.date !== undefined) patch.date = input.date.slice(0, 10);
      if (input.startTime !== undefined) patch.startTime = input.startTime.slice(0, 10);
      if (input.endTime !== undefined) patch.endTime = input.endTime.slice(0, 10);
      if (input.category !== undefined) patch.category = input.category;
      if (input.colorHex !== undefined) patch.colorHex = input.colorHex.slice(0, 16);
      if (input.reminderMinutes !== undefined) patch.reminderMinutes = input.reminderMinutes;
      if (input.reminderEnabled !== undefined) patch.reminderEnabled = input.reminderEnabled;
      if (input.completed !== undefined) patch.completed = input.completed;
      if (input.linkedType !== undefined) patch.linkedType = input.linkedType;
      if (input.linkedId !== undefined) patch.linkedId = input.linkedId.slice(0, 128);
      if (input.linkedParentId !== undefined) patch.linkedParentId = input.linkedParentId.slice(0, 128);
      if (input.linkedLabel !== undefined) patch.linkedLabel = input.linkedLabel.slice(0, 200);

      try {
        await updateDoc(doc(db, docPath), patch);
        showToast('تم تحديث الحدث في التقويم.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const moveEventDate = useCallback(
    async (event: CalendarEvent, nextDateIso: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDateIso)) return;
      if (!user) {
        await updateEvent(event.id, { date: nextDateIso });
        return;
      }
      const docPath = `users/${user.uid}/calendarEvents/${event.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          date: nextDateIso,
          startTime: event.startTime,
          endTime: event.endTime,
          updatedAt: serverTimestamp(),
        });
        showToast(`تم نقل "${event.title}" إلى ${nextDateIso}.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, updateEvent, showToast]
  );

  const toggleEventCompleted = useCallback(
    async (event: CalendarEvent) => {
      if (!user) {
        await updateEvent(event.id, { completed: !event.completed });
        return;
      }
      const docPath = `users/${user.uid}/calendarEvents/${event.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          completed: !event.completed,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, updateEvent]
  );

  const deleteEvent = useCallback(
    async (event: CalendarEvent) => {
      setCalendarError(null);
      if (!user) {
        setLocalEvents((prev) => prev.filter((e) => e.id !== event.id));
        showToast(`تم حذف "${event.title}" من التقويم.`);
        return;
      }
      const docPath = `users/${user.uid}/calendarEvents/${event.id}`;
      try {
        await deleteDoc(doc(db, docPath));
        showToast(`تم حذف "${event.title}" من التقويم.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, showToast]
  );

  return {
    events,
    cloudLoading,
    calendarMessage,
    calendarError,
    dismissCalendarError: () => setCalendarError(null),
    createEvent,
    updateEvent,
    moveEventDate,
    toggleEventCompleted,
    deleteEvent,
  };
}
