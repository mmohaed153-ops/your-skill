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
import { createStarterCoursesData } from '../data/presets';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { CourseItem, CourseStatus, CourseVideoItem } from '../types/workspace';
import { createSafeId, normalizeUrl } from '../utils/pathLogic';
import { normalizeCourseProgress } from '../utils/workspaceLogic';

const LOCAL_COURSES_KEY = 'masar_my_courses_v1';

function loadLocalCourses(): CourseItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_COURSES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CourseItem[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterCoursesData();
}

function saveLocalCourses(courses: CourseItem[]): void {
  try {
    localStorage.setItem(LOCAL_COURSES_KEY, JSON.stringify(courses));
  } catch {
    // ignore storage quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function sanitizeVideos(videos: CourseVideoItem[] | undefined): CourseVideoItem[] {
  if (!Array.isArray(videos)) return [];
  return videos
    .filter((v) => v && v.title?.trim() && v.videoUrl?.trim())
    .slice(0, 60)
    .map((v) => ({
      id: v.id && /^[a-zA-Z0-9_-]+$/.test(v.id) ? v.id : createSafeId('cvid'),
      title: v.title.trim().slice(0, 200),
      videoUrl: normalizeUrl(v.videoUrl).slice(0, 2048),
      duration: (v.duration || '').trim().slice(0, 40),
    }));
}

export interface SaveCoursePayload {
  title: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  platform: string;
  category: string;
  status: CourseStatus;
  progressPercent: number;
  linkedPathId?: string;
  videos?: CourseVideoItem[];
}

export function useCourses(user: User | null, authReady: boolean) {
  const [localCourses, setLocalCourses] = useState<CourseItem[]>(() => loadLocalCourses());
  const [cloudCourses, setCloudCourses] = useState<CourseItem[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [coursesMessage, setCoursesMessage] = useState<string | null>(null);
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalCourses(localCourses);
  }, [localCourses]);

  const showToast = useCallback((msg: string) => {
    setCoursesMessage(msg);
    setTimeout(() => {
      setCoursesMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }, []);

  const seedCloudCoursesIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/courses`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;

      const currentLocal = loadLocalCourses();
      if (currentLocal.length === 0) return;

      const batch = writeBatch(db);
      for (const course of currentLocal) {
        const courseId = createSafeId('course');
        batch.set(doc(db, `${collectionPath}/${courseId}`), {
          id: courseId,
          ownerId: uid,
          title: course.title.slice(0, 200),
          url: course.url.slice(0, 2048),
          thumbnailUrl: (course.thumbnailUrl || '').slice(0, 350000),
          description: course.description.slice(0, 1500),
          platform: course.platform.slice(0, 120),
          category: course.category.slice(0, 80),
          status: course.status,
          progressPercent: Math.max(0, Math.min(100, Math.round(course.progressPercent))),
          linkedPathId: (course.linkedPathId || '').slice(0, 128),
          videos: sanitizeVideos(course.videos),
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
      setCloudCourses([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/courses`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: CourseItem[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              url: String(data.url || ''),
              thumbnailUrl: String(data.thumbnailUrl || ''),
              description: String(data.description || ''),
              platform: String(data.platform || ''),
              category: String(data.category || 'البرمجة وتطوير الويب'),
              status: (data.status as CourseStatus) || 'active',
              progressPercent:
                typeof data.progressPercent === 'number' ? data.progressPercent : 0,
              linkedPathId: String(data.linkedPathId || ''),
              videos: Array.isArray(data.videos) ? (data.videos as CourseVideoItem[]) : [],
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (list.length === 0) {
          void seedCloudCoursesIfEmpty(user.uid);
        }
        setCloudCourses(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudCoursesIfEmpty]);

  const courses = user ? cloudCourses : localCourses;

  const createCourse = useCallback(
    async (payload: SaveCoursePayload): Promise<CourseItem> => {
      setCoursesError(null);
      const courseId = createSafeId('course');
      const nowIso = new Date().toISOString();
      const normalized = normalizeCourseProgress(payload.progressPercent);
      const item: CourseItem = {
        id: courseId,
        ownerId: user?.uid || 'local',
        title: payload.title.trim().slice(0, 200),
        url: normalizeUrl(payload.url).slice(0, 2048),
        thumbnailUrl: (payload.thumbnailUrl || '').slice(0, 350000),
        description: payload.description.trim().slice(0, 1500),
        platform: payload.platform.trim().slice(0, 120) || 'منصة تعليمية',
        category: payload.category.trim().slice(0, 80) || 'البرمجة وتطوير الويب',
        status: normalized.statusHint || payload.status,
        progressPercent: normalized.progressPercent,
        linkedPathId: (payload.linkedPathId || '').slice(0, 128),
        videos: sanitizeVideos(payload.videos),
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalCourses((prev) => [item, ...prev]);
        showToast(`تم حفظ كورس "${item.title}" في كورساتي.`);
        return item;
      }

      const coursePath = `users/${user.uid}/courses/${courseId}`;
      try {
        await setDoc(doc(db, coursePath), {
          id: item.id,
          ownerId: user.uid,
          title: item.title,
          url: item.url,
          thumbnailUrl: item.thumbnailUrl,
          description: item.description,
          platform: item.platform,
          category: item.category,
          status: item.status,
          progressPercent: item.progressPercent,
          linkedPathId: item.linkedPathId,
          videos: item.videos,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`تم حفظ كورس "${item.title}" في حسابك.`);
        return item;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, coursePath);
        return item;
      }
    },
    [user, showToast]
  );

  const updateCourse = useCallback(
    async (courseId: string, payload: SaveCoursePayload): Promise<void> => {
      setCoursesError(null);
      const existing = courses.find((c) => c.id === courseId);
      const normalized = normalizeCourseProgress(payload.progressPercent);
      const nextStatus: CourseStatus =
        normalized.progressPercent >= 100 ? 'completed' : payload.status;
      const nowIso = new Date().toISOString();
      const updatedFields = {
        title: payload.title.trim().slice(0, 200),
        url: normalizeUrl(payload.url).slice(0, 2048),
        thumbnailUrl: (
          payload.thumbnailUrl ??
          existing?.thumbnailUrl ??
          ''
        ).slice(0, 350000),
        description: payload.description.trim().slice(0, 1500),
        platform: payload.platform.trim().slice(0, 120) || 'منصة تعليمية',
        category: payload.category.trim().slice(0, 80) || 'البرمجة وتطوير الويب',
        status: nextStatus,
        progressPercent: normalized.progressPercent,
        linkedPathId: (
          payload.linkedPathId !== undefined ? payload.linkedPathId : existing?.linkedPathId || ''
        ).slice(0, 128),
        videos: payload.videos !== undefined ? sanitizeVideos(payload.videos) : existing?.videos || [],
      };

      if (!user) {
        setLocalCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, ...updatedFields, updatedAt: nowIso } : c))
        );
        showToast(`تم تحديث كورس "${updatedFields.title}".`);
        return;
      }

      const coursePath = `users/${user.uid}/courses/${courseId}`;
      try {
        await updateDoc(doc(db, coursePath), {
          ...updatedFields,
          updatedAt: serverTimestamp(),
        });
        showToast(`تم تحديث كورس "${updatedFields.title}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, coursePath);
      }
    },
    [user, courses, showToast]
  );

  const updateCourseProgress = useCallback(
    async (course: CourseItem, progressPercent: number, nextStatus?: CourseStatus): Promise<void> => {
      setCoursesError(null);
      const normalized = normalizeCourseProgress(progressPercent);
      const resolvedStatus: CourseStatus =
        nextStatus ||
        (normalized.progressPercent >= 100
          ? 'completed'
          : course.status === 'completed'
            ? 'active'
            : course.status);
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalCourses((prev) =>
          prev.map((c) =>
            c.id === course.id
              ? {
                  ...c,
                  progressPercent: normalized.progressPercent,
                  status: resolvedStatus,
                  updatedAt: nowIso,
                }
              : c
          )
        );
        return;
      }

      const coursePath = `users/${user.uid}/courses/${course.id}`;
      try {
        await updateDoc(doc(db, coursePath), {
          progressPercent: normalized.progressPercent,
          status: resolvedStatus,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, coursePath);
      }
    },
    [user]
  );

  const linkCourseToPath = useCallback(
    async (courseId: string, pathId: string): Promise<void> => {
      setCoursesError(null);
      const nowIso = new Date().toISOString();
      if (!user) {
        setLocalCourses((prev) =>
          prev.map((c) => (c.id === courseId ? { ...c, linkedPathId: pathId, updatedAt: nowIso } : c))
        );
        return;
      }
      const coursePath = `users/${user.uid}/courses/${courseId}`;
      try {
        await updateDoc(doc(db, coursePath), {
          linkedPathId: pathId.slice(0, 128),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, coursePath);
      }
    },
    [user]
  );

  const deleteCourse = useCallback(
    async (course: CourseItem): Promise<void> => {
      setCoursesError(null);
      if (!user) {
        setLocalCourses((prev) => prev.filter((c) => c.id !== course.id));
        showToast(`تم حذف كورس "${course.title}" من كورساتي.`);
        return;
      }

      const coursePath = `users/${user.uid}/courses/${course.id}`;
      try {
        await deleteDoc(doc(db, coursePath));
        showToast(`تم حذف كورس "${course.title}" من كورساتي.`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, coursePath);
      }
    },
    [user, showToast]
  );

  return {
    courses,
    cloudLoading,
    coursesMessage,
    coursesError,
    dismissCoursesError: () => setCoursesError(null),
    createCourse,
    updateCourse,
    updateCourseProgress,
    linkCourseToPath,
    deleteCourse,
  };
}
