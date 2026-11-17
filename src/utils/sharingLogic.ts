import type { LearningPath, VideoStep } from '../types/learning';
import type {
  CourseItem,
  LearningBoard,
  LibraryAsset,
  SavedGameJam,
  ShareableItemType,
  SharedItemRecord,
  SharePermissionRole,
  VaultProject,
  VaultVersion,
  VideoCollection,
  WorkspaceNote,
} from '../types/workspace';

export const SHARE_ROLE_LABELS: Record<SharePermissionRole, string> = {
  viewer: 'عرض فقط (Viewer)',
  collaborator: 'متعاون — تعديل وتنظيم (Collaborator)',
  owner: 'صلاحية كاملة للملكية المشتركة (Owner)',
};

export const SHARE_ROLE_DESCRIPTIONS: Record<SharePermissionRole, string> = {
  viewer: 'يمكنه استعراض المحتوى وحفظ نسخة مستقلة في حسابه دون تعديل الأصل.',
  collaborator: 'يمكنه عرض المحتوى وتعديل عناصر التعاون المشتركة وحفظ نسخة لحسابه.',
  owner: 'يمتلك صلاحيات التعاون الكاملة وإدارة التحديثات المشتركة.',
};

export const SHARE_ITEM_TYPE_LABELS: Record<ShareableItemType, string> = {
  learning_path: 'مسار تعليمي',
  course: 'كورس تدريبي',
  saved_game_jam: 'مسابقة Game Jam',
  vault_project: 'مشروع تطوير',
  learning_board: 'لوحة تعلم تفاعلية',
  note: 'ملاحظة مختارة',
  library_asset: 'أصل / مادة إبداعية',
  video_collection: 'مجموعة فيديوهات',
};

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/^@+/, '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 32);
}

export function validateUsername(raw: string): string | null {
  const clean = normalizeUsername(raw);
  if (clean.length < 3) {
    return 'اسم المستخدم يجب أن يتكون من 3 أحرف إنجليزية أو أرقام على الأقل.';
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,31}$/.test(clean)) {
    return 'يُسمح فقط بالأحرف الإنجليزية والأرقام والرموز (. _ -).';
  }
  return null;
}

export function canViewShare(share: Pick<SharedItemRecord, 'ownerId' | 'recipientUid' | 'revoked'>, uid: string | null): boolean {
  if (!uid) return false;
  if (share.ownerId === uid) return true;
  if (share.revoked) return false;
  return share.recipientUid === uid || share.recipientUid === '';
}

export function canCollaborateOnShare(
  share: Pick<SharedItemRecord, 'ownerId' | 'recipientUid' | 'revoked' | 'role'>,
  uid: string | null
): boolean {
  if (!uid) return false;
  if (share.ownerId === uid) return true;
  if (share.revoked) return false;
  if (share.recipientUid && share.recipientUid !== uid) return false;
  return share.role === 'collaborator' || share.role === 'owner';
}

export function isShareOwner(share: Pick<SharedItemRecord, 'ownerId'>, uid: string | null): boolean {
  return Boolean(uid && share.ownerId === uid);
}

export interface SharedPayloadBundle {
  itemType: ShareableItemType;
  title: string;
  summary: string;
  thumbnail: string;
  learningPath?: {
    path: Pick<LearningPath, 'title' | 'description' | 'coverImage'>;
    steps: Array<Pick<VideoStep, 'id' | 'title' | 'description' | 'videoUrl' | 'thumbnailUrl' | 'order' | 'targetDate'>>;
  };
  course?: Pick<
    CourseItem,
    'title' | 'url' | 'thumbnailUrl' | 'description' | 'platform' | 'category' | 'status' | 'progressPercent' | 'videos'
  >;
  savedGameJam?: Pick<
    SavedGameJam,
    'name' | 'description' | 'startDate' | 'endDate' | 'status' | 'mode' | 'location' | 'theme' | 'platform' | 'organizer' | 'officialUrl' | 'thumbnailUrl' | 'resources'
  > & { personalNotes?: string };
  vaultProject?: {
    project: Pick<VaultProject, 'name' | 'description' | 'folder' | 'fileType' | 'previewImage'>;
    versionsSummary: Array<Pick<VaultVersion, 'versionLabel' | 'notes' | 'totalSizeBytes'> & { fileNames: string[] }>;
  };
  learningBoard?: Pick<LearningBoard, 'title' | 'description' | 'cards' | 'connections' | 'viewport'> & {
    drawings?: LearningBoard['drawings'];
  };
  note?: Pick<WorkspaceNote, 'title' | 'contentHtml' | 'plainPreview' | 'folder' | 'tags'>;
  libraryAsset?: Pick<
    LibraryAsset,
    'name' | 'description' | 'category' | 'folder' | 'tags' | 'previewImage' | 'primaryExtension' | 'totalSizeBytes' | 'materialSpec'
  > & { fileSummaries: Array<{ name: string; extension: string; size: number }> };
  videoCollection?: Pick<
    VideoCollection,
    'title' | 'description' | 'category' | 'tags' | 'coverImage'
  > & {
    videos: Array<{
      id: string;
      title: string;
      videoUrl: string;
      platformId: VideoCollection['videos'][number]['platformId'];
      platformName: string;
      thumbnailUrl: string;
      description: string;
      tags: string[];
      category: string;
    }>;
  };
}

export function buildSanitizedShareBundle(params: {
  itemType: ShareableItemType;
  includePersonalNotes?: boolean;
  path?: LearningPath;
  pathSteps?: VideoStep[];
  course?: CourseItem;
  jam?: SavedGameJam;
  project?: VaultProject;
  projectVersions?: VaultVersion[];
  board?: LearningBoard;
  note?: WorkspaceNote;
  asset?: LibraryAsset;
  videoCollection?: VideoCollection;
}): SharedPayloadBundle {
  const includeNotes = Boolean(params.includePersonalNotes);

  switch (params.itemType) {
    case 'learning_path': {
      const p = params.path!;
      const steps = (params.pathSteps || []).slice(0, 40).map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        videoUrl: s.videoUrl,
        thumbnailUrl: s.thumbnailUrl.startsWith('data:') ? '' : s.thumbnailUrl,
        order: s.order,
        targetDate: s.targetDate,
      }));
      return {
        itemType: 'learning_path',
        title: p.title,
        summary: p.description || `${steps.length} خطوات تعليمية`,
        thumbnail: p.coverImage.startsWith('data:') ? '' : p.coverImage,
        learningPath: {
          path: {
            title: p.title,
            description: p.description,
            coverImage: p.coverImage.startsWith('data:') ? '' : p.coverImage,
          },
          steps,
        },
      };
    }

    case 'course': {
      const c = params.course!;
      return {
        itemType: 'course',
        title: c.title,
        summary: `${c.platform} · ${c.videos.length} فيديو`,
        thumbnail: c.thumbnailUrl.startsWith('data:') ? '' : c.thumbnailUrl,
        course: {
          title: c.title,
          url: c.url,
          thumbnailUrl: c.thumbnailUrl.startsWith('data:') ? '' : c.thumbnailUrl,
          description: c.description,
          platform: c.platform,
          category: c.category,
          status: c.status,
          progressPercent: c.progressPercent,
          videos: c.videos.slice(0, 40),
        },
      };
    }

    case 'saved_game_jam': {
      const j = params.jam!;
      return {
        itemType: 'saved_game_jam',
        title: j.name,
        summary: `${j.platform} · ${j.location}`,
        thumbnail: j.thumbnailUrl.startsWith('data:') ? '' : j.thumbnailUrl,
        savedGameJam: {
          name: j.name,
          description: j.description,
          startDate: j.startDate,
          endDate: j.endDate,
          status: j.status,
          mode: j.mode,
          location: j.location,
          theme: j.theme,
          platform: j.platform,
          organizer: j.organizer,
          officialUrl: j.officialUrl,
          thumbnailUrl: j.thumbnailUrl.startsWith('data:') ? '' : j.thumbnailUrl,
          resources: j.resources.slice(0, 20),
          // Personal notes are NEVER included unless explicitly toggled by the user
          ...(includeNotes && j.personalNotes ? { personalNotes: j.personalNotes } : {}),
        },
      };
    }

    case 'vault_project': {
      const proj = params.project!;
      const versionsSummary = (params.projectVersions || []).slice(0, 10).map((v) => ({
        versionLabel: v.versionLabel,
        notes: v.notes,
        totalSizeBytes: v.totalSizeBytes,
        fileNames: v.files.slice(0, 30).map((f) => f.name),
      }));
      return {
        itemType: 'vault_project',
        title: proj.name,
        summary: `${proj.fileType} · ${proj.folder}`,
        thumbnail: proj.previewImage.startsWith('data:') ? '' : proj.previewImage,
        vaultProject: {
          project: {
            name: proj.name,
            description: proj.description,
            folder: proj.folder,
            fileType: proj.fileType,
            previewImage: proj.previewImage.startsWith('data:') ? '' : proj.previewImage,
          },
          versionsSummary,
        },
      };
    }

    case 'learning_board': {
      const b = params.board!;
      // Strip private card noteText unless user explicitly includes personal notes
      const cleanCards = b.cards.slice(0, 60).map((c) => {
        const copy = {
          ...c,
          thumbnailUrl: c.thumbnailUrl.startsWith('data:') ? '' : c.thumbnailUrl,
          noteText: includeNotes || c.kind === 'image' ? c.noteText : '',
        };
        delete copy.originalFileRef;
        return copy;
      });
      const cleanDrawings = (b.drawings || []).slice(0, 100);
      return {
        itemType: 'learning_board',
        title: b.title,
        summary: b.description || `${cleanCards.length} بطاقة على اللوحة`,
        thumbnail: '',
        learningBoard: {
          title: b.title,
          description: b.description,
          cards: cleanCards,
          connections: b.connections.slice(0, 100),
          drawings: cleanDrawings,
          viewport: b.viewport,
        },
      };
    }

    case 'note': {
      const n = params.note!;
      return {
        itemType: 'note',
        title: n.title,
        summary: n.plainPreview.slice(0, 180) || n.folder,
        thumbnail: '',
        note: {
          title: n.title,
          contentHtml: n.contentHtml.slice(0, 20000),
          plainPreview: n.plainPreview.slice(0, 350),
          folder: n.folder,
          tags: n.tags.slice(0, 15),
        },
      };
    }

    case 'library_asset': {
      const a = params.asset!;
      return {
        itemType: 'library_asset',
        title: a.name,
        summary: `${a.folder} · ${a.primaryExtension}`,
        thumbnail: a.previewImage.startsWith('data:') ? '' : a.previewImage,
        libraryAsset: {
          name: a.name,
          description: a.description,
          category: a.category,
          folder: a.folder,
          tags: a.tags.slice(0, 15),
          previewImage: a.previewImage.startsWith('data:') ? '' : a.previewImage,
          primaryExtension: a.primaryExtension,
          totalSizeBytes: a.totalSizeBytes,
          materialSpec: a.materialSpec,
          fileSummaries: a.files.slice(0, 30).map((f) => ({
            name: f.name,
            extension: f.extension,
            size: f.size,
          })),
        },
      };
    }

    case 'video_collection': {
      const vc = params.videoCollection!;
      return {
        itemType: 'video_collection',
        title: vc.title,
        summary: `${vc.category} · ${vc.videos.length} فيديو`,
        thumbnail: vc.coverImage.startsWith('data:') ? '' : vc.coverImage,
        videoCollection: {
          title: vc.title,
          description: vc.description,
          category: vc.category,
          tags: vc.tags.slice(0, 15),
          coverImage: vc.coverImage.startsWith('data:') ? '' : vc.coverImage,
          // Keep personal notes out of collection share unless explicitly included
          videos: vc.videos.slice(0, 40).map((v) => ({
            id: v.id,
            title: v.title,
            videoUrl: v.videoUrl,
            platformId: v.platformId,
            platformName: v.platformName,
            thumbnailUrl: v.thumbnailUrl.startsWith('data:') ? '' : v.thumbnailUrl,
            description: v.description,
            tags: v.tags,
            category: v.category,
          })),
        },
      };
    }
  }
}

export function parseSharePayload(json: string): SharedPayloadBundle | null {
  try {
    const parsed = JSON.parse(json) as SharedPayloadBundle;
    if (!parsed || typeof parsed !== 'object' || !parsed.itemType) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function buildShareInviteUrl(origin: string, shareId: string, shareCode: string): string {
  const base = origin.replace(/\/+$/, '');
  return `${base}/?share=${encodeURIComponent(shareId)}&code=${encodeURIComponent(shareCode)}`;
}

export function extractShareParamsFromSearch(search: string): {
  shareId: string;
  shareCode: string;
} | null {
  const params = new URLSearchParams(search);
  const shareId = (params.get('share') || '').trim();
  if (!shareId) return null;
  return {
    shareId,
    shareCode: (params.get('code') || '').trim(),
  };
}
