import type {
  GameJamMode,
  GameJamSearchResult,
  GameJamStatus,
  GameJamUpdateKind,
  OrganizedVideoItem,
  SavedGameJam,
  VideoCollection,
} from '../types/workspace';
import { createSafeId, isValidHttpUrl, normalizeUrl } from './pathLogic';

export const GAME_JAM_STATUS_LABELS: Record<GameJamStatus, string> = {
  upcoming: 'قريباً',
  active: 'جارية الآن',
  newly_announced: 'معلنة حديثاً',
  ended: 'منتهية',
};

export const GAME_JAM_MODE_LABELS: Record<GameJamMode, string> = {
  online: 'أونلاين',
  in_person: 'حضوري',
  hybrid: 'هجين (أونلاين + حضوري)',
};

export const GAME_JAM_UPDATE_TYPE_LABELS: Record<GameJamUpdateKind, string> = {
  newly_announced: 'إعلان جديد',
  starting_soon: 'يبدأ قريباً',
  active_now: 'نشط الآن',
  theme_update: 'إعلان الموضوع / الثيم',
  deadline: 'موعد تسليم قريب',
};

export const DEFAULT_VIDEO_COLLECTION_CATEGORIES = [
  'تطوير الألعاب',
  'البرمجة وتطوير الويب',
  'التصميم والنمذجة 3D',
  'مقتطفات سريعة ومهارات',
  'شروحات ومتفرقات',
];

export interface ParsedJamQueryIntent {
  cleanQuery: string;
  inferredStatus: 'all' | 'upcoming' | 'active' | 'newly_announced';
  inferredMode: 'all' | 'online' | 'in_person';
  inferredLocation: string;
  beginnerOnly: boolean;
}

export function parseNaturalJamQuery(rawQuery: string): ParsedJamQueryIntent {
  const cleanQuery = rawQuery.trim();
  const lower = cleanQuery.toLowerCase();

  let inferredStatus: ParsedJamQueryIntent['inferredStatus'] = 'all';
  if (
    /(currently active|active right now|happening right now|in progress|نشط|جارية الآن|تحدث الآن|حالية)/.test(
      lower
    )
  ) {
    inferredStatus = 'active';
  } else if (/(upcoming|starting soon|next|قريباً|قادمة|القادمة)/.test(lower)) {
    inferredStatus = 'upcoming';
  } else if (/(newly announced|recent|new jam|أعلنت حديثاً|معلنة حديثاً|جديدة)/.test(lower)) {
    inferredStatus = 'newly_announced';
  }

  let inferredMode: ParsedJamQueryIntent['inferredMode'] = 'all';
  if (/(online|remote|عبر الإنترنت|أونلاين|اونلاين)/.test(lower)) {
    inferredMode = 'online';
  } else if (/(in-person|in person|near me|\bnear\b|local|حضوري|قريب مني|بالقرب من|محلي)/.test(lower)) {
    inferredMode = 'in_person';
  }

  let inferredLocation = '';
  const nearMatch = cleanQuery.match(/(?:in|near|at|في|بالقرب من)\s+([a-zA-Z\u0600-\u06FF\s]{2,40})$/i);
  if (nearMatch?.[1]) {
    const candidate = nearMatch[1].trim();
    if (!/^(me|the world|beginners|online|مبتدئين|أونلاين)$/i.test(candidate)) {
      inferredLocation = candidate;
      if (inferredMode === 'all') {
        inferredMode = 'in_person';
      }
    }
  }

  const beginnerOnly = /(beginner|beginners|first jam|starter|مبتدئ|للمبتدئين|بسيط)/.test(lower);

  return {
    cleanQuery,
    inferredStatus,
    inferredMode,
    inferredLocation,
    beginnerOnly,
  };
}

export function computeEndDateFromDuration(startIso: string, durationText: string): string {
  if (!startIso) return '';
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return '';

  const match = durationText.trim().match(/(\d+(?:\.\d+)?)\s*(hour|day|week|month)/i);
  if (!match) return '';

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  let hours = 0;
  if (unit.startsWith('hour')) hours = amount;
  else if (unit.startsWith('day')) hours = amount * 24;
  else if (unit.startsWith('week')) hours = amount * 24 * 7;
  else if (unit.startsWith('month')) hours = amount * 24 * 30;

  if (hours <= 0) return '';
  const end = new Date(start.getTime() + hours * 3600 * 1000);
  return end.toISOString();
}

export function formatJamDateLabel(isoOrRaw: string): string {
  const clean = (isoOrRaw || '').trim();
  if (!clean) return 'غير محدد';
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) return clean.slice(0, 40);
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parsed);
  } catch {
    return clean.slice(0, 10);
  }
}

export function deriveJamCountdownLabel(
  jam: Pick<GameJamSearchResult, 'startDate' | 'endDate' | 'status'>,
  nowMs = Date.now()
): string {
  const startMs = jam.startDate ? new Date(jam.startDate).getTime() : NaN;
  const endMs = jam.endDate ? new Date(jam.endDate).getTime() : NaN;

  if (!Number.isNaN(startMs) && startMs > nowMs) {
    const diffDays = Math.ceil((startMs - nowMs) / (1000 * 60 * 60 * 24));
    if (diffDays <= 1) return 'تبدأ خلال أقل من 24 ساعة';
    return `تبدأ خلال ${diffDays} يوم`;
  }

  if (!Number.isNaN(endMs)) {
    if (endMs < nowMs) return 'انتهت المسابقة';
    const diffHours = Math.ceil((endMs - nowMs) / (1000 * 60 * 60));
    if (diffHours < 48) return `متبقي ${diffHours} ساعة للتسليم`;
    const diffDays = Math.ceil(diffHours / 24);
    return `متبقي ${diffDays} يوم للتسليم`;
  }

  return GAME_JAM_STATUS_LABELS[jam.status];
}

export function filterSavedGameJams(
  jams: SavedGameJam[],
  options: {
    searchQuery: string;
    statusFilter: GameJamStatus | 'all';
  }
): SavedGameJam[] {
  const q = options.searchQuery.trim().toLowerCase();
  return jams.filter((jam) => {
    if (options.statusFilter !== 'all' && jam.status !== options.statusFilter) {
      return false;
    }
    if (!q) return true;
    return (
      jam.name.toLowerCase().includes(q) ||
      jam.description.toLowerCase().includes(q) ||
      jam.platform.toLowerCase().includes(q) ||
      jam.location.toLowerCase().includes(q) ||
      jam.theme.toLowerCase().includes(q) ||
      jam.personalNotes.toLowerCase().includes(q)
    );
  });
}

export function filterVideoCollections(
  collections: VideoCollection[],
  options: {
    searchQuery: string;
    categoryFilter: string;
    platformFilter: string;
  }
): VideoCollection[] {
  const q = options.searchQuery.trim().toLowerCase();
  return collections.filter((col) => {
    if (options.categoryFilter !== 'all' && col.category !== options.categoryFilter) {
      return false;
    }
    if (
      options.platformFilter !== 'all' &&
      !col.videos.some((v) => v.platformId === options.platformFilter)
    ) {
      return false;
    }
    if (!q) return true;
    return (
      col.title.toLowerCase().includes(q) ||
      col.description.toLowerCase().includes(q) ||
      col.category.toLowerCase().includes(q) ||
      col.tags.some((t) => t.toLowerCase().includes(q)) ||
      col.videos.some(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.platformName.toLowerCase().includes(q) ||
          v.notes.toLowerCase().includes(q) ||
          v.tags.some((t) => t.toLowerCase().includes(q))
      )
    );
  });
}

export function filterVideosInsideCollection(
  videos: OrganizedVideoItem[],
  options: {
    searchQuery: string;
    platformFilter: string;
    completionFilter: 'all' | 'completed' | 'pending';
  }
): OrganizedVideoItem[] {
  const q = options.searchQuery.trim().toLowerCase();
  return videos.filter((v) => {
    if (options.platformFilter !== 'all' && v.platformId !== options.platformFilter) {
      return false;
    }
    if (options.completionFilter === 'completed' && !v.completed) return false;
    if (options.completionFilter === 'pending' && v.completed) return false;
    if (!q) return true;
    return (
      v.title.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.notes.toLowerCase().includes(q) ||
      v.platformName.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q) ||
      v.tags.some((t) => t.toLowerCase().includes(q))
    );
  });
}

export function validateVideoCollectionInput(input: { title: string }): string | null {
  if (!input.title.trim()) return 'يرجى إدخال عنوان مجموعة الفيديوهات.';
  return null;
}

export function validateOrganizedVideoInput(input: {
  title: string;
  videoUrl: string;
}): string | null {
  if (!input.videoUrl.trim()) return 'يرجى لصق رابط الفيديو.';
  if (!isValidHttpUrl(input.videoUrl)) {
    return 'يرجى إدخال رابط فيديو صحيح (يبدأ بـ https:// أو اسم نطاق صالح).';
  }
  if (!input.title.trim()) return 'يرجى إدخال عنوان للفيديو.';
  return null;
}

export function buildJamResourceLink(title: string, url: string): {
  id: string;
  title: string;
  url: string;
} | null {
  const cleanUrl = normalizeUrl(url);
  if (!isValidHttpUrl(cleanUrl)) return null;
  const cleanTitle = title.trim() || cleanUrl;
  return {
    id: createSafeId('jres'),
    title: cleanTitle.slice(0, 140),
    url: cleanUrl.slice(0, 2048),
  };
}
