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
import type { OrganizedVideoItem, VideoCollection } from '../types/workspace';
import { DEFAULT_VIDEO_COLLECTION_CATEGORIES } from '../utils/gameJamLogic';
import { createSafeId, normalizeUrl, parseVideoUrl } from '../utils/pathLogic';

const LOCAL_VIDEO_COLLECTIONS_KEY = 'masar_video_collections_v1';

function createStarterVideoCollections(): VideoCollection[] {
  const now = '2026-11-15T08:00:00.000Z';
  return [
    {
      id: 'vcol_gamedev_shorts_mix',
      ownerId: 'local',
      title: 'حيل ونصائح تطوير الألعاب والتصميم (متعدد المنصات)',
      description:
        'مجموعة تجمع شروحات عميقة من YouTube، حيل سريعة من TikTok، وورش عملية من Facebook في مكان واحد منظم.',
      category: DEFAULT_VIDEO_COLLECTION_CATEGORIES[0],
      tags: ['Godot', 'GameDev', 'UI', 'متنوع'],
      coverImage: '',
      videos: [
        {
          id: 'ovid_yt_godot',
          title: 'Godot 4 Complete Crash Course — Nodes, Scenes & Physics',
          videoUrl: 'https://www.youtube.com/watch?v=LOhfqjmasi0',
          platformId: 'youtube',
          platformName: 'YouTube',
          thumbnailUrl: 'https://i.ytimg.com/vi/LOhfqjmasi0/hqdefault.jpg',
          description: 'مرجع شامل لبناء أول نموذج لعبة داخل Godot 4 مع تنظيم المشاهد.',
          notes: 'التركيز على فصل سكريبت الحركة عن سكريبت الرسوميات.',
          completed: true,
          tags: ['Godot', 'YouTube'],
          category: 'تطوير الألعاب',
          addedAt: now,
        },
        {
          id: 'ovid_tiktok_lighting',
          title: 'حركة كاميرا وإضاءة سريعة للمشاهد 2D (مقطع تيك توك)',
          videoUrl: 'https://www.tiktok.com/@tiktok/video/7106594312292453675',
          platformId: 'tiktok',
          platformName: 'TikTok',
          thumbnailUrl: '',
          description: 'مثال تطبيقي لمقطع تعليمي قصير محفوظ من TikTok مع إمكانية المتابعة والملاحظات.',
          notes: 'تجربة إضافة اهتزاز خفيف للكاميرا عند التصادم.',
          completed: false,
          tags: ['TikTok', 'GameFeel'],
          category: 'مقتطفات سريعة ومهارات',
          addedAt: now,
        },
        {
          id: 'ovid_fb_jam_prep',
          title: 'تخطيط لعبة كاملة خلال 48 ساعة لمسابقات Game Jam',
          videoUrl: 'https://www.facebook.com/watch/?v=10153231379946729',
          platformId: 'facebook',
          platformName: 'Facebook',
          thumbnailUrl: '',
          description: 'محاضرة مسجلة على فيسبوك حول إدارة النطاق والوقت في الـ Game Jams.',
          notes: 'تحديد آلية لعب واحدة أساسية قبل بناء أي مراحل إضافية.',
          completed: false,
          tags: ['Facebook', 'GameJam'],
          category: 'تطوير الألعاب',
          addedAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function loadLocalCollections(): VideoCollection[] {
  try {
    const raw = localStorage.getItem(LOCAL_VIDEO_COLLECTIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as VideoCollection[];
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore corrupt cache
  }
  return createStarterVideoCollections();
}

function saveLocalCollections(items: VideoCollection[]): void {
  try {
    localStorage.setItem(LOCAL_VIDEO_COLLECTIONS_KEY, JSON.stringify(items));
  } catch {
    // ignore quota errors
  }
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

export interface SaveVideoCollectionInput {
  title: string;
  description: string;
  category: string;
  tags: string[];
  coverImage: string;
}

export interface SaveOrganizedVideoInput {
  title: string;
  videoUrl: string;
  platformId?: OrganizedVideoItem['platformId'];
  platformName?: string;
  thumbnailUrl?: string;
  description?: string;
  notes?: string;
  tags?: string[];
  category?: string;
}

export function useVideoCollections(user: User | null, authReady: boolean) {
  const [localCollections, setLocalCollections] = useState<VideoCollection[]>(() =>
    loadLocalCollections()
  );
  const [cloudCollections, setCloudCollections] = useState<VideoCollection[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [videosMessage, setVideosMessage] = useState<string | null>(null);
  const [videosError, setVideosError] = useState<string | null>(null);
  const seededForUidRef = useRef<string | null>(null);

  useEffect(() => {
    saveLocalCollections(localCollections);
  }, [localCollections]);

  const showToast = useCallback((msg: string) => {
    setVideosMessage(msg);
    window.setTimeout(() => {
      setVideosMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }, []);

  const seedCloudCollectionsIfEmpty = useCallback(async (uid: string) => {
    if (seededForUidRef.current === uid) return;
    seededForUidRef.current = uid;
    const collectionPath = `users/${uid}/videoCollections`;
    try {
      const snap = await getDocs(
        query(collection(db, collectionPath), where('ownerId', '==', uid))
      );
      if (!snap.empty) return;
      const starters = loadLocalCollections();
      for (const col of starters) {
        const colId = createSafeId('vcol');
        await setDoc(doc(db, `${collectionPath}/${colId}`), {
          id: colId,
          ownerId: uid,
          title: col.title.slice(0, 180),
          description: col.description.slice(0, 1200),
          category: (col.category || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]).slice(0, 60),
          tags: col.tags.slice(0, 15),
          coverImage: (col.coverImage || '').slice(0, 350000),
          videos: col.videos.slice(0, 60),
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
      setCloudCollections([]);
      seededForUidRef.current = null;
      return;
    }

    setCloudLoading(true);
    const collectionPath = `users/${user.uid}/videoCollections`;
    const q = query(
      collection(db, collectionPath),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: VideoCollection[] = snapshot.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              category: String(data.category || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]),
              tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
              coverImage: String(data.coverImage || ''),
              videos: Array.isArray(data.videos) ? (data.videos as OrganizedVideoItem[]) : [],
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (list.length === 0) {
          void seedCloudCollectionsIfEmpty(user.uid);
        }
        setCloudCollections(list);
        setCloudLoading(false);
      },
      (err) => {
        setCloudLoading(false);
        handleFirestoreError(err, OperationType.LIST, collectionPath);
      }
    );

    return unsubscribe;
  }, [authReady, user, seedCloudCollectionsIfEmpty]);

  const collections = user ? cloudCollections : localCollections;

  const createCollection = useCallback(
    async (input: SaveVideoCollectionInput): Promise<VideoCollection> => {
      setVideosError(null);
      const nowIso = new Date().toISOString();
      const colId = createSafeId('vcol');
      const item: VideoCollection = {
        id: colId,
        ownerId: user?.uid || 'local',
        title: input.title.trim().slice(0, 180),
        description: input.description.trim().slice(0, 1200),
        category: (input.category.trim() || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]).slice(0, 60),
        tags: input.tags.slice(0, 15),
        coverImage: (input.coverImage || '').slice(0, 350000),
        videos: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalCollections((prev) => [item, ...prev]);
        showToast(`تم إنشاء مجموعة الفيديو "${item.title}".`);
        return item;
      }

      const docPath = `users/${user.uid}/videoCollections/${colId}`;
      try {
        await setDoc(doc(db, docPath), {
          ...item,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        showToast(`تم حفظ مجموعة الفيديو "${item.title}" في حسابك.`);
        return item;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
        throw err;
      }
    },
    [user, showToast]
  );

  const updateCollection = useCallback(
    async (collectionId: string, input: Partial<SaveVideoCollectionInput>) => {
      setVideosError(null);
      const nowIso = new Date().toISOString();
      if (!user) {
        setLocalCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  title: input.title !== undefined ? input.title.trim().slice(0, 180) : c.title,
                  description:
                    input.description !== undefined
                      ? input.description.trim().slice(0, 1200)
                      : c.description,
                  category:
                    input.category !== undefined ? input.category.trim().slice(0, 80) : c.category,
                  tags: input.tags !== undefined ? input.tags.slice(0, 15) : c.tags,
                  coverImage:
                    input.coverImage !== undefined
                      ? input.coverImage.slice(0, 350000)
                      : c.coverImage,
                  updatedAt: nowIso,
                }
              : c
          )
        );
        showToast('تم تحديث بيانات مجموعة الفيديوهات.');
        return;
      }

      const docPath = `users/${user.uid}/videoCollections/${collectionId}`;
      const patch: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (input.title !== undefined) patch.title = input.title.trim().slice(0, 180);
      if (input.description !== undefined) patch.description = input.description.trim().slice(0, 1200);
      if (input.category !== undefined) patch.category = input.category.trim().slice(0, 80);
      if (input.tags !== undefined) patch.tags = input.tags.slice(0, 15);
      if (input.coverImage !== undefined) patch.coverImage = input.coverImage.slice(0, 350000);

      try {
        await updateDoc(doc(db, docPath), patch);
        showToast('تم تحديث بيانات مجموعة الفيديوهات.');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const persistVideosList = useCallback(
    async (collectionId: string, nextVideos: OrganizedVideoItem[], toastMsg?: string) => {
      const cleanList = nextVideos.slice(0, 80);
      const nowIso = new Date().toISOString();

      if (!user) {
        setLocalCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId ? { ...c, videos: cleanList, updatedAt: nowIso } : c
          )
        );
        if (toastMsg) showToast(toastMsg);
        return;
      }

      const docPath = `users/${user.uid}/videoCollections/${collectionId}`;
      try {
        await updateDoc(doc(db, docPath), {
          videos: cleanList,
          updatedAt: serverTimestamp(),
        });
        if (toastMsg) showToast(toastMsg);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [user, showToast]
  );

  const addVideoToCollection = useCallback(
    async (col: VideoCollection, input: SaveOrganizedVideoInput): Promise<OrganizedVideoItem> => {
      const normalized = normalizeUrl(input.videoUrl);
      const parsed = parseVideoUrl(normalized);
      const platformId = input.platformId || parsed.platformId;
      const platformName = (input.platformName || parsed.platformName || 'منصة فيديو').slice(0, 120);

      const newVideo: OrganizedVideoItem = {
        id: createSafeId('ovid'),
        title: input.title.trim().slice(0, 200),
        videoUrl: normalized.slice(0, 2048),
        platformId,
        platformName,
        thumbnailUrl: (input.thumbnailUrl || parsed.autoThumbnailUrl || '').slice(0, 350000),
        description: (input.description || '').trim().slice(0, 1000),
        notes: (input.notes || '').trim().slice(0, 3000),
        completed: false,
        tags: (input.tags || []).slice(0, 15),
        category: (input.category || col.category || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]).slice(
          0,
          80
        ),
        addedAt: new Date().toISOString(),
      };

      await persistVideosList(
        col.id,
        [newVideo, ...col.videos],
        `تمت إضافة الفيديو "${newVideo.title}" (${platformName}) بنجاح.`
      );
      return newVideo;
    },
    [persistVideosList]
  );

  const updateVideoInCollection = useCallback(
    async (
      col: VideoCollection,
      videoId: string,
      patch: Partial<OrganizedVideoItem>,
      silent = false
    ) => {
      const nextVideos = col.videos.map((v) => {
        if (v.id !== videoId) return v;
        const nextUrl = patch.videoUrl ? normalizeUrl(patch.videoUrl) : v.videoUrl;
        const parsed = parseVideoUrl(nextUrl);
        return {
          ...v,
          ...patch,
          videoUrl: nextUrl.slice(0, 2048),
          platformId: patch.platformId || (patch.videoUrl ? parsed.platformId : v.platformId),
          platformName: (
            patch.platformName ||
            (patch.videoUrl ? parsed.platformName : v.platformName)
          ).slice(0, 120),
          title: (patch.title !== undefined ? patch.title : v.title).trim().slice(0, 200),
          description: (
            patch.description !== undefined ? patch.description : v.description
          ).slice(0, 1000),
          notes: (patch.notes !== undefined ? patch.notes : v.notes).slice(0, 3000),
          thumbnailUrl: (
            patch.thumbnailUrl !== undefined ? patch.thumbnailUrl : v.thumbnailUrl
          ).slice(0, 350000),
          tags: (patch.tags !== undefined ? patch.tags : v.tags).slice(0, 15),
          category: (patch.category !== undefined ? patch.category : v.category).slice(0, 80),
        };
      });
      await persistVideosList(col.id, nextVideos, silent ? undefined : 'تم تحديث بيانات الفيديو.');
    },
    [persistVideosList]
  );

  const toggleVideoCompleted = useCallback(
    async (col: VideoCollection, videoId: string) => {
      const target = col.videos.find((v) => v.id === videoId);
      if (!target) return;
      await updateVideoInCollection(col, videoId, { completed: !target.completed }, true);
    },
    [updateVideoInCollection]
  );

  const removeVideoFromCollection = useCallback(
    async (col: VideoCollection, videoId: string) => {
      const nextVideos = col.videos.filter((v) => v.id !== videoId);
      await persistVideosList(col.id, nextVideos, 'تمت إزالة الفيديو من المجموعة.');
    },
    [persistVideosList]
  );

  const deleteCollection = useCallback(
    async (col: VideoCollection) => {
      setVideosError(null);
      if (!user) {
        setLocalCollections((prev) => prev.filter((c) => c.id !== col.id));
        showToast(`تم حذف مجموعة "${col.title}".`);
        return;
      }

      const docPath = `users/${user.uid}/videoCollections/${col.id}`;
      try {
        await deleteDoc(doc(db, docPath));
        showToast(`تم حذف مجموعة "${col.title}".`);
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [user, showToast]
  );

  return {
    collections,
    cloudLoading,
    videosMessage,
    videosError,
    dismissVideosError: () => setVideosError(null),
    createCollection,
    updateCollection,
    addVideoToCollection,
    updateVideoInCollection,
    toggleVideoCompleted,
    removeVideoFromCollection,
    deleteCollection,
  };
}
