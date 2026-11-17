import type {
  PathProgress,
  StepStatus,
  VideoEmbedInfo,
  VideoPlatformId,
  VideoStep,
} from '../types/learning';

export const PATH_TITLE_MAX = 160;
export const PATH_DESCRIPTION_MAX = 600;
export const STEP_TITLE_MAX = 180;
export const STEP_DESCRIPTION_MAX = 1000;
export const QUICK_NOTES_MAX = 3000;
export const VIDEO_URL_MAX = 2048;

export const VIDEO_PLATFORM_LABELS: Record<VideoPlatformId, string> = {
  youtube: 'YouTube',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  vimeo: 'Vimeo',
  twitch: 'Twitch',
  loom: 'Loom',
  dailymotion: 'Dailymotion',
  x_twitter: 'X / Twitter',
  direct: 'ملف فيديو مباشر',
  external: 'منصة فيديو خارجية',
};

export function createSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '') || 'item';
  const timePart = Date.now().toString(36);
  const randPart = Math.random().toString(36).slice(2, 8);
  return `${cleanPrefix}_${timePart}_${randPart}`;
}

export function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function isValidHttpUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > VIDEO_URL_MAX) return false;
  try {
    const candidate = normalizeUrl(trimmed);
    const parsed = new URL(candidate);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
      parsed.hostname.includes('.')
    );
  } catch {
    return false;
  }
}

export function extractYouTubeId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null;
    }

    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{6,20}$/.test(vParam)) {
        return vParam;
      }
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && ['embed', 'shorts', 'live', 'v'].includes(parts[0])) {
        const id = parts[1];
        return id && /^[a-zA-Z0-9_-]{6,20}$/.test(id) ? id : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function extractVimeoId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const last = parts[parts.length - 1];
      return last && /^\d{5,15}$/.test(last) ? last : null;
    }
    return null;
  } catch {
    return null;
  }
}

export function extractTikTokVideoId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (
      host === 'tiktok.com' ||
      host.endsWith('.tiktok.com')
    ) {
      const match = parsed.pathname.match(/\/video\/(\d{6,25})/i);
      if (match?.[1]) return match[1];
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts[0] === 'v' && parts[1] && /^\d{6,25}$/.test(parts[1])) {
        return parts[1];
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function extractLoomId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'loom.com') {
      const match = parsed.pathname.match(/\/(?:share|embed)\/([a-zA-Z0-9]{12,48})/);
      if (match?.[1]) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function extractDailymotionId(url: string): string | null {
  try {
    const parsed = new URL(normalizeUrl(url));
    const host = parsed.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'dai.ly') {
      const first = parsed.pathname.split('/').filter(Boolean)[0];
      return first && /^[a-zA-Z0-9]+$/.test(first) ? first : null;
    }
    if (host === 'dailymotion.com') {
      const match = parsed.pathname.match(/\/video\/([a-zA-Z0-9]+)/);
      if (match?.[1]) return match[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function detectVideoPlatform(url: string): {
  platformId: VideoPlatformId;
  platformName: string;
} {
  const normalizedUrl = normalizeUrl(url);
  if (extractYouTubeId(normalizedUrl)) {
    return { platformId: 'youtube', platformName: 'YouTube' };
  }
  if (extractVimeoId(normalizedUrl)) {
    return { platformId: 'vimeo', platformName: 'Vimeo' };
  }

  try {
    const parsed = new URL(normalizedUrl);
    const host = parsed.hostname.replace(/^(www\.|m\.|mobile\.)/, '').toLowerCase();

    if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
      return { platformId: 'youtube', platformName: 'YouTube' };
    }
    if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) {
      return { platformId: 'tiktok', platformName: 'TikTok' };
    }
    if (
      host === 'facebook.com' ||
      host === 'fb.watch' ||
      host === 'fb.com' ||
      host.endsWith('.facebook.com')
    ) {
      return { platformId: 'facebook', platformName: 'Facebook' };
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      return { platformId: 'vimeo', platformName: 'Vimeo' };
    }
    if (host === 'twitch.tv' || host === 'clips.twitch.tv' || host.endsWith('.twitch.tv')) {
      return { platformId: 'twitch', platformName: 'Twitch' };
    }
    if (host === 'loom.com' || host.endsWith('.loom.com')) {
      return { platformId: 'loom', platformName: 'Loom' };
    }
    if (host === 'dailymotion.com' || host === 'dai.ly') {
      return { platformId: 'dailymotion', platformName: 'Dailymotion' };
    }
    if (host === 'x.com' || host === 'twitter.com') {
      return { platformId: 'x_twitter', platformName: 'X / Twitter' };
    }
    if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(normalizedUrl)) {
      return { platformId: 'direct', platformName: 'ملف فيديو مباشر' };
    }
    return {
      platformId: 'external',
      platformName: host || 'منصة خارجية',
    };
  } catch {
    return { platformId: 'external', platformName: 'رابط فيديو' };
  }
}

export function parseVideoUrl(url: string): VideoEmbedInfo {
  const normalizedUrl = normalizeUrl(url);
  const { platformId, platformName } = detectVideoPlatform(normalizedUrl);

  const ytId = extractYouTubeId(normalizedUrl);
  if (ytId) {
    return {
      provider: 'youtube',
      platformId: 'youtube',
      platformName: 'YouTube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`,
      autoThumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      normalizedUrl,
    };
  }

  const vimeoId = extractVimeoId(normalizedUrl);
  if (vimeoId) {
    return {
      provider: 'vimeo',
      platformId: 'vimeo',
      platformName: 'Vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      autoThumbnailUrl: null,
      normalizedUrl,
    };
  }

  if (platformId === 'tiktok') {
    const ttId = extractTikTokVideoId(normalizedUrl);
    return {
      provider: 'tiktok',
      platformId: 'tiktok',
      platformName: 'TikTok',
      embedUrl: ttId ? `https://www.tiktok.com/player/v1/${ttId}` : null,
      autoThumbnailUrl: null,
      normalizedUrl,
    };
  }

  if (platformId === 'facebook') {
    return {
      provider: 'facebook',
      platformId: 'facebook',
      platformName: 'Facebook',
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(normalizedUrl)}&show_text=false`,
      autoThumbnailUrl: null,
      normalizedUrl,
    };
  }

  const loomId = extractLoomId(normalizedUrl);
  if (loomId) {
    return {
      provider: 'loom',
      platformId: 'loom',
      platformName: 'Loom',
      embedUrl: `https://www.loom.com/embed/${loomId}`,
      autoThumbnailUrl: null,
      normalizedUrl,
    };
  }

  const dmId = extractDailymotionId(normalizedUrl);
  if (dmId) {
    return {
      provider: 'dailymotion',
      platformId: 'dailymotion',
      platformName: 'Dailymotion',
      embedUrl: `https://www.dailymotion.com/embed/video/${dmId}`,
      autoThumbnailUrl: `https://www.dailymotion.com/thumbnail/video/${dmId}`,
      normalizedUrl,
    };
  }

  if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(normalizedUrl)) {
    return {
      provider: 'direct',
      platformId: 'direct',
      platformName: 'ملف فيديو مباشر',
      embedUrl: normalizedUrl,
      autoThumbnailUrl: null,
      normalizedUrl,
    };
  }

  return {
    provider: 'external',
    platformId,
    platformName,
    embedUrl: null,
    autoThumbnailUrl: null,
    normalizedUrl,
  };
}

export function sortSteps(steps: VideoStep[]): VideoStep[] {
  return [...steps].sort((a, b) => a.order - b.order);
}

export function calculatePathProgress(steps: VideoStep[]): PathProgress {
  const ordered = sortSteps(steps);
  const total = ordered.length;
  if (total === 0) {
    return {
      total: 0,
      completedCount: 0,
      percentage: 0,
      currentStepIndex: -1,
      nextStep: null,
    };
  }

  const completedCount = ordered.filter((step) => step.completed).length;
  const percentage = Math.round((completedCount / total) * 100);
  const currentStepIndex = ordered.findIndex((step) => !step.completed);
  const nextStep = currentStepIndex >= 0 ? ordered[currentStepIndex] : null;

  return {
    total,
    completedCount,
    percentage,
    currentStepIndex,
    nextStep,
  };
}

export function getStepStatus(
  step: VideoStep,
  index: number,
  currentStepIndex: number
): StepStatus {
  if (step.completed) return 'completed';
  if (index === currentStepIndex) return 'current';
  return 'upcoming';
}

export function insertStepAtOrder(
  steps: VideoStep[],
  newStep: VideoStep,
  targetPosition1Based: number
): VideoStep[] {
  const ordered = sortSteps(steps).filter((s) => s.id !== newStep.id);
  const clampedIndex = Math.max(0, Math.min(ordered.length, targetPosition1Based - 1));
  const updated = [
    ...ordered.slice(0, clampedIndex),
    newStep,
    ...ordered.slice(clampedIndex),
  ];
  return updated.map((step, index) => ({
    ...step,
    order: index,
  }));
}

export function reorderStepsByIndices(
  steps: VideoStep[],
  fromIndex: number,
  toIndex: number
): VideoStep[] {
  const ordered = sortSteps(steps);
  if (
    fromIndex < 0 ||
    fromIndex >= ordered.length ||
    toIndex < 0 ||
    toIndex >= ordered.length ||
    fromIndex === toIndex
  ) {
    return ordered.map((s, idx) => ({ ...s, order: idx }));
  }

  const copy = [...ordered];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy.map((step, index) => ({
    ...step,
    order: index,
  }));
}

export function reorderStepsByIds(
  steps: VideoStep[],
  orderedIds: string[]
): VideoStep[] {
  const byId = new Map(steps.map((s) => [s.id, s]));
  const result: VideoStep[] = [];
  for (const id of orderedIds) {
    const found = byId.get(id);
    if (found) {
      result.push(found);
      byId.delete(id);
    }
  }
  // Append any remaining steps deterministically
  for (const remaining of sortSteps(Array.from(byId.values()))) {
    result.push(remaining);
  }
  return result.map((step, index) => ({
    ...step,
    order: index,
  }));
}

export function calculateAllPathsProgress(
  paths: { id: string }[],
  stepsByPath: Record<string, VideoStep[]>
): Record<string, PathProgress> {
  const summary: Record<string, PathProgress> = {};
  for (const p of paths) {
    summary[p.id] = calculatePathProgress(stepsByPath[p.id] || []);
  }
  return summary;
}

export function removeStepAndReindex(steps: VideoStep[], stepId: string): VideoStep[] {
  return sortSteps(steps)
    .filter((s) => s.id !== stepId)
    .map((step, index) => ({
      ...step,
      order: index,
    }));
}

export function validateVideoInput(input: {
  title: string;
  videoUrl: string;
  description: string;
}): { valid: boolean; errors: { title?: string; videoUrl?: string; description?: string } } {
  const errors: { title?: string; videoUrl?: string; description?: string } = {};
  const title = input.title.trim();
  const videoUrl = input.videoUrl.trim();
  const description = input.description.trim();

  if (!title) {
    errors.title = 'يرجى إدخال عنوان الفيديو.';
  } else if (title.length > STEP_TITLE_MAX) {
    errors.title = `العنوان طويل جداً (الحد الأقصى ${STEP_TITLE_MAX} حرفاً).`;
  }

  if (!videoUrl) {
    errors.videoUrl = 'يرجى لصق رابط الفيديو.';
  } else if (!isValidHttpUrl(videoUrl)) {
    errors.videoUrl = 'يرجى إدخال رابط فيديو صحيح (يبدأ بـ https:// أو اسم نطاق صالح).';
  }

  if (description.length > STEP_DESCRIPTION_MAX) {
    errors.description = `الوصف طويل جداً (الحد الأقصى ${STEP_DESCRIPTION_MAX} حرفاً).`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validatePathInput(input: {
  title: string;
  description: string;
  existingPaths?: { id: string; title: string }[];
  excludePathId?: string;
}): { valid: boolean; errors: { title?: string; description?: string } } {
  const errors: { title?: string; description?: string } = {};
  const title = input.title.trim();
  const description = input.description.trim();

  if (!title) {
    errors.title = 'يرجى إدخال اسم المسار التعليمي.';
  } else if (title.length > PATH_TITLE_MAX) {
    errors.title = `اسم المسار طويل جداً (الحد الأقصى ${PATH_TITLE_MAX} حرفاً).`;
  } else if (input.existingPaths) {
    const normalized = title.toLocaleLowerCase();
    const duplicate = input.existingPaths.some(
      (p) => p.id !== input.excludePathId && p.title.trim().toLocaleLowerCase() === normalized
    );
    if (duplicate) {
      errors.title = 'يوجد مسار آخر بهذا الاسم بالفعل. يرجى اختيار اسم فريد.';
    }
  }

  if (description.length > PATH_DESCRIPTION_MAX) {
    errors.description = `الوصف طويل جداً (الحد الأقصى ${PATH_DESCRIPTION_MAX} حرفاً).`;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function sanitizeQuickNotes(raw: string): string {
  return raw.trim().slice(0, QUICK_NOTES_MAX);
}

export function validateQuickNotes(raw: string): { valid: boolean; error?: string } {
  if (raw.trim().length > QUICK_NOTES_MAX) {
    return {
      valid: false,
      error: `الملاحظات طويلة جداً (الحد الأقصى ${QUICK_NOTES_MAX} حرفاً).`,
    };
  }
  return { valid: true };
}

export function formatQuickNotesPreview(
  notes: string,
  maxChars = 150
): { text: string; truncated: boolean } {
  const clean = notes.trim();
  if (!clean) return { text: '', truncated: false };
  if (clean.length <= maxChars) return { text: clean, truncated: false };
  return {
    text: `${clean.slice(0, maxChars).trimEnd()}...`,
    truncated: true,
  };
}
