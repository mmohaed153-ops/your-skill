import type { LearningPath, VideoStep } from '../types/learning';
import type {
  BoardAccentColor,
  BoardCard,
  BoardConnection,
  BoardDrawingPoint,
  BoardDrawingStroke,
  BoardViewport,
  CourseItem,
  LearningBoard,
  StoredFileRef,
} from '../types/workspace';
import { createSafeId, isValidHttpUrl, normalizeUrl, parseVideoUrl } from './pathLogic';

export const BOARD_MAX_CARDS = 80;
export const BOARD_MAX_CONNECTIONS = 150;
export const BOARD_MAX_DRAWINGS = 250;
export const BOARD_MAX_STROKE_POINTS = 280;
export const BOARD_MIN_ZOOM = 0.35;
export const BOARD_MAX_ZOOM = 2.0;
export const BOARD_DEFAULT_VIDEO_WIDTH = 310;
export const BOARD_DEFAULT_TODO_WIDTH = 285;
export const BOARD_DEFAULT_NOTE_WIDTH = 265;
export const BOARD_DEFAULT_IMAGE_WIDTH = 300;
export const BOARD_DEFAULT_IMAGE_HEIGHT = 210;
export const BOARD_MIN_IMAGE_WIDTH = 140;
export const BOARD_MAX_IMAGE_WIDTH = 960;
export const BOARD_MIN_IMAGE_HEIGHT = 110;
export const BOARD_MAX_IMAGE_HEIGHT = 900;
export const BOARD_MAX_HISTORY = 40;

export const BOARD_DRAWING_COLORS = [
  '#B92622',
  '#062D4C',
  '#059669',
  '#D97706',
  '#2563EB',
  '#7C3AED',
  '#0F172A',
  '#FFFFFF',
] as const;

export const BOARD_ACCENT_STYLES: Record<
  BoardAccentColor,
  {
    label: string;
    stroke: string;
    pinBg: string;
    border: string;
    shadow: string;
  }
> = {
  crimson: {
    label: 'أحمر مرجعي',
    stroke: '#B92622',
    pinBg: 'bg-[#B92622]',
    border: 'border-[#062D4C]',
    shadow: 'shadow-[5px_6px_0_#B92622]',
  },
  navy: {
    label: 'كحلي أساسي',
    stroke: '#062D4C',
    pinBg: 'bg-[#062D4C]',
    border: 'border-[#062D4C]',
    shadow: 'shadow-[5px_6px_0_#062D4C]',
  },
  emerald: {
    label: 'أخضر إنجاز',
    stroke: '#059669',
    pinBg: 'bg-emerald-600',
    border: 'border-[#062D4C]',
    shadow: 'shadow-[5px_6px_0_#059669]',
  },
  amber: {
    label: 'ذهبي أفكار',
    stroke: '#D97706',
    pinBg: 'bg-amber-600',
    border: 'border-[#062D4C]',
    shadow: 'shadow-[5px_6px_0_#D97706]',
  },
};

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.round(Math.max(BOARD_MIN_ZOOM, Math.min(BOARD_MAX_ZOOM, zoom)) * 100) / 100;
}

export function clampCoord(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(Math.max(-18000, Math.min(18000, val)));
}

export function roundCoord(val: number): number {
  if (!Number.isFinite(val)) return 0;
  return Math.round(Math.max(-18000, Math.min(18000, val)) * 10) / 10;
}

export function clampCardWidth(width: number): number {
  if (!Number.isFinite(width)) return BOARD_DEFAULT_VIDEO_WIDTH;
  return Math.round(Math.max(BOARD_MIN_IMAGE_WIDTH, Math.min(BOARD_MAX_IMAGE_WIDTH, width)));
}

export function clampImageHeight(height: number): number {
  if (!Number.isFinite(height)) return BOARD_DEFAULT_IMAGE_HEIGHT;
  return Math.round(Math.max(BOARD_MIN_IMAGE_HEIGHT, Math.min(BOARD_MAX_IMAGE_HEIGHT, height)));
}

export function normalizeRotationDeg(deg: number): number {
  if (!Number.isFinite(deg)) return 0;
  let normalized = Math.round(deg) % 360;
  if (normalized > 180) normalized -= 360;
  if (normalized < -180) normalized += 360;
  return normalized;
}

const SUPPORTED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const SUPPORTED_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

export function isSupportedBoardImageFile(file: { name: string; type?: string }): boolean {
  const mime = (file.type || '').toLowerCase().trim();
  if (mime && SUPPORTED_IMAGE_MIMES.has(mime)) return true;
  const parts = file.name.toLowerCase().trim().split('.');
  const ext = parts.length > 1 ? parts[parts.length - 1] : '';
  return SUPPORTED_IMAGE_EXTENSIONS.has(ext);
}

export function computeInitialImageDimensions(
  naturalWidth: number,
  naturalHeight: number
): { width: number; height: number } {
  if (!Number.isFinite(naturalWidth) || !Number.isFinite(naturalHeight) || naturalWidth <= 0 || naturalHeight <= 0) {
    return { width: BOARD_DEFAULT_IMAGE_WIDTH, height: BOARD_DEFAULT_IMAGE_HEIGHT };
  }
  const ratio = naturalHeight / naturalWidth;
  let width = Math.max(240, Math.min(340, Math.round(naturalWidth)));
  let height = Math.round(width * ratio);
  if (height > 380) {
    height = 380;
    width = Math.round(height / ratio);
  }
  return {
    width: clampCardWidth(width),
    height: clampImageHeight(height),
  };
}

export function getNextTopZIndex(cards: BoardCard[]): number {
  let maxZ = 0;
  for (const c of cards) {
    const z = typeof c.zIndex === 'number' && Number.isFinite(c.zIndex) ? c.zIndex : 0;
    if (z > maxZ) maxZ = z;
  }
  return Math.min(9999, maxZ + 1);
}

export function bringCardForward(cards: BoardCard[], cardId: string): BoardCard[] {
  const nextZ = getNextTopZIndex(cards);
  return cards.map((c) => (c.id === cardId ? { ...c, zIndex: nextZ } : c));
}

export function sendCardBackward(cards: BoardCard[], cardId: string): BoardCard[] {
  const target = cards.find((c) => c.id === cardId);
  if (!target) return cards;
  const ordered = [...cards].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  const idx = ordered.findIndex((c) => c.id === cardId);
  if (idx <= 0) {
    return cards.map((c) => (c.id === cardId ? { ...c, zIndex: 0 } : c));
  }
  const filtered = ordered.filter((c) => c.id !== cardId);
  const reordered = [target, ...filtered];
  const zMap = new Map<string, number>();
  reordered.forEach((c, i) => zMap.set(c.id, i));
  return cards.map((c) => ({ ...c, zIndex: zMap.get(c.id) ?? 0 }));
}

export function screenToBoardPoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number },
  viewport: BoardViewport
): { x: number; y: number } {
  const zoom = clampZoom(viewport.zoom);
  return {
    x: (clientX - rect.left - viewport.panX) / zoom,
    y: (clientY - rect.top - viewport.panY) / zoom,
  };
}

export function inferVideoSourceLabel(videoUrl: string, fallback = ''): string {
  if (fallback.trim()) return fallback.trim().slice(0, 140);
  const parsed = parseVideoUrl(videoUrl);
  if (parsed.platformName) return parsed.platformName.slice(0, 140);
  try {
    const u = new URL(normalizeUrl(videoUrl));
    return u.hostname.replace(/^www\./, '').slice(0, 140) || 'رابط خارجي';
  } catch {
    return 'فيديو تعليمي';
  }
}

export function validateBoardVideoInput(input: {
  title: string;
  videoUrl: string;
}): string | null {
  if (!input.title.trim()) return 'يرجى إدخال عنوان الفيديو.';
  if (!input.videoUrl.trim()) return 'يرجى لصق رابط الفيديو.';
  if (!isValidHttpUrl(input.videoUrl)) {
    return 'يرجى إدخال رابط فيديو صحيح يبدأ بـ https:// أو اسم نطاق صالح.';
  }
  return null;
}

export function findNextFreeSpot(
  existingCards: BoardCard[],
  preferredX = 80,
  preferredY = 70
): { x: number; y: number } {
  let x = clampCoord(preferredX);
  let y = clampCoord(preferredY);

  for (let attempt = 0; attempt < 24; attempt++) {
    const overlaps = existingCards.some(
      (c) => Math.abs(c.x - x) < 310 && Math.abs(c.y - y) < 420
    );
    if (!overlaps) return { x, y };
    x += 420;
    if ((attempt + 1) % 3 === 0) {
      x = clampCoord(preferredX);
      y += 590;
    }
  }
  return { x, y };
}

export function createVideoBoardCard(
  input: {
    title: string;
    videoUrl: string;
    thumbnailUrl?: string;
    sourceLabel?: string;
    completed?: boolean;
    noteText?: string;
    sourceRefType?: BoardCard['sourceRefType'];
    sourceRefId?: string;
    sourceParentId?: string;
    accentColor?: BoardAccentColor;
    fallbackThumb?: string;
  },
  pos: { x: number; y: number }
): BoardCard {
  const normalizedUrl = normalizeUrl(input.videoUrl);
  const embed = parseVideoUrl(normalizedUrl);
  const resolvedThumb =
    (input.thumbnailUrl || '').trim() ||
    embed.autoThumbnailUrl ||
    input.fallbackThumb ||
    '';

  return {
    id: createSafeId('bcard'),
    kind: 'video',
    x: clampCoord(pos.x),
    y: clampCoord(pos.y),
    width: BOARD_DEFAULT_VIDEO_WIDTH,
    title: input.title.trim().slice(0, 200) || 'فيديو تعليمي',
    sourceLabel: inferVideoSourceLabel(normalizedUrl, input.sourceLabel || ''),
    videoUrl: normalizedUrl.slice(0, 2048),
    thumbnailUrl: resolvedThumb.slice(0, 350000),
    completed: Boolean(input.completed),
    noteText: (input.noteText || '').slice(0, 4000),
    noteExpanded: true,
    linkedNoteId: '',
    sourceRefType: input.sourceRefType || 'url',
    sourceRefId: (input.sourceRefId || '').slice(0, 128),
    sourceParentId: (input.sourceParentId || '').slice(0, 128),
    attachedToCardId: '',
    accentColor: input.accentColor || 'crimson',
  };
}

export function createTodoWidgetBoardCard(
  input: {
    title?: string;
    attachedToCardId?: string;
    sourceLabel?: string;
    accentColor?: BoardAccentColor;
  },
  pos: { x: number; y: number }
): BoardCard {
  return {
    id: createSafeId('bcard'),
    kind: 'todo_widget',
    x: clampCoord(pos.x),
    y: clampCoord(pos.y),
    width: BOARD_DEFAULT_TODO_WIDTH,
    title: (input.title || 'قائمة مهام التطبيق').trim().slice(0, 200),
    sourceLabel: (input.sourceLabel || 'قائمة المهام').slice(0, 140),
    videoUrl: '',
    thumbnailUrl: '',
    completed: false,
    noteText: '',
    noteExpanded: true,
    linkedNoteId: '',
    sourceRefType: 'none',
    sourceRefId: '',
    sourceParentId: '',
    attachedToCardId: (input.attachedToCardId || '').slice(0, 128),
    accentColor: input.accentColor || 'emerald',
  };
}

export function createImageBoardCard(
  input: {
    title: string;
    thumbnailUrl: string;
    originalFileRef: StoredFileRef;
    width?: number;
    height?: number;
    noteText?: string;
    zIndex?: number;
    accentColor?: BoardAccentColor;
  },
  pos: { x: number; y: number }
): BoardCard {
  return {
    id: createSafeId('bcard'),
    kind: 'image',
    x: clampCoord(pos.x),
    y: clampCoord(pos.y),
    width: clampCardWidth(input.width ?? BOARD_DEFAULT_IMAGE_WIDTH),
    height: clampImageHeight(input.height ?? BOARD_DEFAULT_IMAGE_HEIGHT),
    rotation: 0,
    zIndex: Math.max(0, Math.min(9999, Math.round(input.zIndex ?? 1))),
    title: input.title.trim().slice(0, 200) || 'صورة مرجعية',
    sourceLabel: 'صورة مرفوعة',
    videoUrl: '',
    thumbnailUrl: (input.thumbnailUrl || '').slice(0, 350000),
    originalFileRef: { ...input.originalFileRef },
    completed: false,
    noteText: (input.noteText || '').slice(0, 4000),
    noteExpanded: true,
    linkedNoteId: '',
    sourceRefType: 'none',
    sourceRefId: '',
    sourceParentId: '',
    attachedToCardId: '',
    accentColor: input.accentColor || 'navy',
  };
}

export function duplicateBoardCard(
  card: BoardCard,
  existingCards: BoardCard[]
): BoardCard {
  const nextZ = getNextTopZIndex(existingCards);
  const baseTitle = card.title.endsWith('(نسخة)') ? card.title : `${card.title} (نسخة)`;
  return sanitizeBoardCard({
    ...card,
    id: createSafeId('bcard'),
    x: clampCoord(card.x + 36),
    y: clampCoord(card.y + 36),
    zIndex: nextZ,
    title: baseTitle.slice(0, 200),
    originalFileRef: card.originalFileRef ? { ...card.originalFileRef } : undefined,
  });
}

export function createIdeaNoteBoardCard(
  input: {
    title?: string;
    noteText?: string;
    attachedToCardId?: string;
    accentColor?: BoardAccentColor;
  },
  pos: { x: number; y: number }
): BoardCard {
  return {
    id: createSafeId('bcard'),
    kind: 'idea_note',
    x: clampCoord(pos.x),
    y: clampCoord(pos.y),
    width: BOARD_DEFAULT_NOTE_WIDTH,
    title: (input.title || 'فكرة وملاحظة').trim().slice(0, 200),
    sourceLabel: 'بطاقة أفكار',
    videoUrl: '',
    thumbnailUrl: '',
    completed: false,
    noteText: (input.noteText || '').slice(0, 4000),
    noteExpanded: true,
    linkedNoteId: '',
    sourceRefType: 'none',
    sourceRefId: '',
    sourceParentId: '',
    attachedToCardId: (input.attachedToCardId || '').slice(0, 128),
    accentColor: input.accentColor || 'amber',
  };
}

export function buildCardsFromCourse(
  course: CourseItem,
  existingCards: BoardCard[],
  startPos?: { x: number; y: number }
): { cards: BoardCard[]; connections: BoardConnection[] } {
  const origin = startPos || findNextFreeSpot(existingCards, 80, 70);
  const videoEntries =
    course.videos.length > 0
      ? course.videos.map((v) => ({
          id: v.id,
          title: v.title,
          videoUrl: v.videoUrl,
        }))
      : [
          {
            id: course.id,
            title: course.title,
            videoUrl: course.url,
          },
        ];

  const cards: BoardCard[] = [];
  const connections: BoardConnection[] = [];

  for (let i = 0; i < videoEntries.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const card = createVideoBoardCard(
      {
        title: videoEntries[i].title,
        videoUrl: videoEntries[i].videoUrl,
        thumbnailUrl: course.thumbnailUrl,
        sourceLabel: `كورس: ${course.title}`,
        completed: course.status === 'completed',
        sourceRefType: 'course',
        sourceRefId: course.id,
        sourceParentId: videoEntries[i].id,
        accentColor: 'navy',
      },
      {
        x: origin.x + col * 420,
        y: origin.y + row * 590,
      }
    );
    cards.push(card);
    if (i > 0) {
      connections.push({
        id: createSafeId('bconn'),
        fromCardId: cards[i - 1].id,
        toCardId: card.id,
        label: `الدرس ${i + 1}`,
        color: 'navy',
      });
    }
  }

  return { cards, connections };
}

export function buildCardsFromLearningPath(
  path: LearningPath,
  steps: VideoStep[],
  existingCards: BoardCard[],
  startPos?: { x: number; y: number }
): { cards: BoardCard[]; connections: BoardConnection[] } {
  const origin = startPos || findNextFreeSpot(existingCards, 80, 70);
  const ordered = [...steps].sort((a, b) => a.order - b.order);
  const cards: BoardCard[] = [];
  const connections: BoardConnection[] = [];

  for (let i = 0; i < ordered.length; i++) {
    const step = ordered[i];
    const col = i % 3;
    const row = Math.floor(i / 3);
    const card = createVideoBoardCard(
      {
        title: step.title,
        videoUrl: step.videoUrl,
        thumbnailUrl: step.thumbnailUrl,
        sourceLabel: `مسار: ${path.title}`,
        completed: step.completed,
        noteText: step.quickNotes || '',
        sourceRefType: 'learning_step',
        sourceRefId: step.id,
        sourceParentId: path.id,
        accentColor: step.completed ? 'emerald' : 'crimson',
      },
      {
        x: origin.x + col * 420,
        y: origin.y + row * 590,
      }
    );
    cards.push(card);
    if (i > 0) {
      connections.push({
        id: createSafeId('bconn'),
        fromCardId: cards[i - 1].id,
        toCardId: card.id,
        label: `الخطوة ${i + 1}`,
        color: 'crimson',
      });
    }
  }

  return { cards, connections };
}

export function buildCardsFromGameJam(
  jam: {
    id: string;
    name: string;
    theme?: string;
    officialUrl: string;
    thumbnailUrl?: string;
    personalNotes?: string;
    resources?: { title: string; url: string }[];
  },
  existingCards: BoardCard[],
  startPos?: { x: number; y: number }
): { cards: BoardCard[]; connections: BoardConnection[] } {
  const origin = startPos || findNextFreeSpot(existingCards, 80, 70);
  const noteCard: BoardCard = {
    id: createSafeId('bcard'),
    kind: 'idea_note',
    x: clampCoord(origin.x),
    y: clampCoord(origin.y),
    width: BOARD_DEFAULT_VIDEO_WIDTH,
    title: `مسابقة: ${jam.name}`,
    sourceLabel: jam.theme ? `الثيم: ${jam.theme}` : 'Game Jam Finder',
    videoUrl: jam.officialUrl,
    thumbnailUrl: jam.thumbnailUrl || '',
    completed: false,
    noteText:
      jam.personalNotes ||
      `رابط المسابقة الرسمي: ${jam.officialUrl}\nأفكار اللعبة والموارد الأساسية لمسابقة ${jam.name}.`,
    noteExpanded: true,
    linkedNoteId: '',
    sourceRefType: 'game_jam',
    sourceRefId: jam.id,
    sourceParentId: '',
    attachedToCardId: '',
    accentColor: 'amber',
  };

  const todoCard = createTodoWidgetBoardCard(
    {
      title: `خطة تنفيذ: ${jam.name}`,
      attachedToCardId: noteCard.id,
      sourceLabel: 'مهام مسابقة الألعاب',
      accentColor: 'emerald',
    },
    { x: origin.x + 390, y: origin.y }
  );

  const cards: BoardCard[] = [noteCard, todoCard];
  const connections: BoardConnection[] = [
    {
      id: createSafeId('bconn'),
      fromCardId: noteCard.id,
      toCardId: todoCard.id,
      label: 'خطة العمل',
      color: 'emerald',
    },
  ];

  if (jam.resources && jam.resources.length > 0) {
    const firstRes = jam.resources[0];
    const resCard = createVideoBoardCard(
      {
        title: firstRes.title || 'مورد تعليمي للمسابقة',
        videoUrl: firstRes.url,
        thumbnailUrl: jam.thumbnailUrl,
        sourceLabel: `مورد: ${jam.name}`,
        sourceRefType: 'game_jam',
        sourceRefId: jam.id,
        accentColor: 'crimson',
      },
      { x: origin.x, y: origin.y + 320 }
    );
    cards.push(resCard);
    connections.push({
      id: createSafeId('bconn'),
      fromCardId: resCard.id,
      toCardId: noteCard.id,
      label: 'مرجع تحضير',
      color: 'crimson',
    });
  }

  return { cards, connections };
}

export function buildCardFromOrganizedVideo(
  colId: string,
  colTitle: string,
  video: {
    id: string;
    title: string;
    videoUrl: string;
    platformName: string;
    thumbnailUrl?: string;
    completed?: boolean;
    notes?: string;
  },
  existingCards: BoardCard[]
): BoardCard {
  const pos = findNextFreeSpot(existingCards, 80, 70);
  return createVideoBoardCard(
    {
      title: video.title,
      videoUrl: video.videoUrl,
      thumbnailUrl: video.thumbnailUrl,
      sourceLabel: `${video.platformName} · ${colTitle}`,
      completed: Boolean(video.completed),
      noteText: video.notes || '',
      sourceRefType: 'video_collection',
      sourceRefId: colId,
      sourceParentId: video.id,
      accentColor: 'navy',
    },
    pos
  );
}

export function estimateCardHeight(card: BoardCard): number {
  if (card.kind === 'image') return (card.height || BOARD_DEFAULT_IMAGE_HEIGHT) + 96;
  if (card.kind === 'todo_widget') return 290;
  if (card.kind === 'idea_note') return 225;
  return card.noteExpanded ? 540 : 340;
}

export interface ConnectionGeometry {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  pathD: string;
  midX: number;
  midY: number;
}

export function computeConnectionGeometry(
  fromCard: BoardCard,
  toCard: BoardCard,
  measuredHeights?: Record<string, number>
): ConnectionGeometry {
  const fromW = fromCard.width || BOARD_DEFAULT_VIDEO_WIDTH;
  const toW = toCard.width || BOARD_DEFAULT_VIDEO_WIDTH;
  const fromH = measuredHeights?.[fromCard.id] || estimateCardHeight(fromCard);
  const toH = measuredHeights?.[toCard.id] || estimateCardHeight(toCard);

  const fromCx = fromCard.x + fromW / 2;
  const fromCy = fromCard.y + fromH / 2;
  const toCx = toCard.x + toW / 2;
  const toCy = toCard.y + toH / 2;

  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  let c1x: number;
  let c1y: number;
  let c2x: number;
  let c2y: number;

  if (Math.abs(dx) >= Math.abs(dy)) {
    // Horizontal connection
    const goingRight = dx >= 0;
    x1 = goingRight ? fromCard.x + fromW : fromCard.x;
    y1 = fromCy;
    x2 = goingRight ? toCard.x : toCard.x + toW;
    y2 = toCy;
    const curveOffset = Math.max(55, Math.abs(x2 - x1) * 0.45);
    c1x = goingRight ? x1 + curveOffset : x1 - curveOffset;
    c1y = y1;
    c2x = goingRight ? x2 - curveOffset : x2 + curveOffset;
    c2y = y2;
  } else {
    // Vertical connection
    const goingDown = dy >= 0;
    x1 = fromCx;
    y1 = goingDown ? fromCard.y + fromH : fromCard.y;
    x2 = toCx;
    y2 = goingDown ? toCard.y : toCard.y + toH;
    const curveOffset = Math.max(55, Math.abs(y2 - y1) * 0.45);
    c1x = x1;
    c1y = goingDown ? y1 + curveOffset : y1 - curveOffset;
    c2x = x2;
    c2y = goingDown ? y2 - curveOffset : y2 + curveOffset;
  }

  const pathD = `M ${Math.round(x1)} ${Math.round(y1)} C ${Math.round(c1x)} ${Math.round(c1y)}, ${Math.round(c2x)} ${Math.round(c2y)}, ${Math.round(x2)} ${Math.round(y2)}`;
  // Cubic bezier midpoint at t = 0.5
  const midX = 0.125 * x1 + 0.375 * c1x + 0.375 * c2x + 0.125 * x2;
  const midY = 0.125 * y1 + 0.375 * c1y + 0.375 * c2y + 0.125 * y2;

  return {
    x1,
    y1,
    x2,
    y2,
    pathD,
    midX: Math.round(midX),
    midY: Math.round(midY),
  };
}

export function computeFitViewport(
  cards: BoardCard[],
  containerWidth: number,
  containerHeight: number
): BoardViewport {
  if (cards.length === 0 || containerWidth <= 0 || containerHeight <= 0) {
    return { panX: 0, panY: 0, zoom: 1 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of cards) {
    const w = c.width || BOARD_DEFAULT_VIDEO_WIDTH;
    const h = estimateCardHeight(c);
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x + w > maxX) maxX = c.x + w;
    if (c.y + h > maxY) maxY = c.y + h;
  }

  const padding = 56;
  const contentW = Math.max(200, maxX - minX);
  const contentH = Math.max(200, maxY - minY);
  const zoom = clampZoom(
    Math.min(
      1,
      (containerWidth - padding * 2) / contentW,
      (containerHeight - padding * 2) / contentH
    )
  );

  const panX = Math.round((containerWidth - contentW * zoom) / 2 - minX * zoom);
  const panY = Math.round((containerHeight - contentH * zoom) / 2 - minY * zoom);

  return { panX, panY, zoom };
}

// ==================== Freehand Drawing Geometry & Persistence ====================

export function simplifyStrokePoints(
  points: BoardDrawingPoint[],
  minDistance = 2.5,
  maxPoints = BOARD_MAX_STROKE_POINTS
): BoardDrawingPoint[] {
  if (points.length === 0) return [];
  const filtered: BoardDrawingPoint[] = [
    { x: roundCoord(points[0].x), y: roundCoord(points[0].y) },
  ];
  const minDistSq = minDistance * minDistance;
  for (let i = 1; i < points.length; i += 1) {
    const prev = filtered[filtered.length - 1];
    const currX = roundCoord(points[i].x);
    const currY = roundCoord(points[i].y);
    const dx = currX - prev.x;
    const dy = currY - prev.y;
    const isLast = i === points.length - 1;
    if (dx * dx + dy * dy >= minDistSq || (isLast && (dx !== 0 || dy !== 0))) {
      filtered.push({ x: currX, y: currY });
    }
  }
  if (filtered.length <= maxPoints) return filtered;

  const sampled: BoardDrawingPoint[] = [filtered[0]];
  const step = (filtered.length - 1) / (maxPoints - 1);
  for (let i = 1; i < maxPoints - 1; i += 1) {
    sampled.push(filtered[Math.round(i * step)]);
  }
  sampled.push(filtered[filtered.length - 1]);
  return sampled;
}

export function buildSmoothSvgPath(points: BoardDrawingPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y + 0.01}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const midX = roundCoord((points[i].x + points[i + 1].x) / 2);
    const midY = roundCoord((points[i].y + points[i + 1].y) / 2);
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export function distancePointToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const abX = bx - ax;
  const abY = by - ay;
  const lenSq = abX * abX + abY * abY;
  if (lenSq === 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * abX + (py - ay) * abY) / lenSq));
  const projX = ax + t * abX;
  const projY = ay + t * abY;
  return Math.hypot(px - projX, py - projY);
}

export function hitTestDrawingStroke(
  stroke: BoardDrawingStroke,
  x: number,
  y: number,
  extraTolerance = 8
): boolean {
  if (stroke.points.length === 0) return false;
  const threshold = Math.max(6, stroke.size / 2 + extraTolerance);
  if (stroke.points.length === 1) {
    return Math.hypot(x - stroke.points[0].x, y - stroke.points[0].y) <= threshold;
  }
  for (let i = 0; i < stroke.points.length - 1; i += 1) {
    const a = stroke.points[i];
    const b = stroke.points[i + 1];
    if (distancePointToSegment(x, y, a.x, a.y, b.x, b.y) <= threshold) {
      return true;
    }
  }
  return false;
}

export function findHitDrawingStrokes(
  strokes: BoardDrawingStroke[],
  x: number,
  y: number,
  eraserRadius = 10
): string[] {
  const hits: string[] = [];
  for (const stroke of strokes) {
    if (hitTestDrawingStroke(stroke, x, y, eraserRadius)) {
      hits.push(stroke.id);
    }
  }
  return hits;
}

export function translateDrawingStroke(
  stroke: BoardDrawingStroke,
  dx: number,
  dy: number
): BoardDrawingStroke {
  return {
    ...stroke,
    points: stroke.points.map((p) => ({
      x: roundCoord(p.x + dx),
      y: roundCoord(p.y + dy),
    })),
  };
}

export function getStrokeBoundingBox(
  stroke: BoardDrawingStroke
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  if (stroke.points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const pad = Math.max(8, stroke.size / 2 + 4);
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

export interface BoardSnapshot {
  cards: BoardCard[];
  connections: BoardConnection[];
  drawings: BoardDrawingStroke[];
}

export interface BoardHistoryStack {
  past: BoardSnapshot[];
  future: BoardSnapshot[];
}

export function cloneBoardSnapshot(
  cards: BoardCard[],
  connections: BoardConnection[],
  drawings: BoardDrawingStroke[] = []
): BoardSnapshot {
  return {
    cards: cards.map((c) => ({
      ...c,
      originalFileRef: c.originalFileRef ? { ...c.originalFileRef } : undefined,
    })),
    connections: connections.map((conn) => ({ ...conn })),
    drawings: drawings.map((stroke) => ({
      ...stroke,
      points: stroke.points.map((p) => ({ x: p.x, y: p.y })),
    })),
  };
}

export function pushBoardHistory(
  history: BoardHistoryStack,
  currentSnapshot: {
    cards: BoardCard[];
    connections: BoardConnection[];
    drawings?: BoardDrawingStroke[];
  }
): BoardHistoryStack {
  const nextPast = [
    ...history.past,
    cloneBoardSnapshot(
      currentSnapshot.cards,
      currentSnapshot.connections,
      currentSnapshot.drawings || []
    ),
  ];
  if (nextPast.length > BOARD_MAX_HISTORY) {
    nextPast.shift();
  }
  return {
    past: nextPast,
    future: [],
  };
}

export function undoBoardHistory(
  history: BoardHistoryStack,
  currentSnapshot: {
    cards: BoardCard[];
    connections: BoardConnection[];
    drawings?: BoardDrawingStroke[];
  }
): { nextHistory: BoardHistoryStack; restored: BoardSnapshot } | null {
  if (history.past.length === 0) return null;
  const previous = history.past[history.past.length - 1];
  return {
    restored: cloneBoardSnapshot(
      previous.cards,
      previous.connections,
      previous.drawings || []
    ),
    nextHistory: {
      past: history.past.slice(0, -1),
      future: [
        cloneBoardSnapshot(
          currentSnapshot.cards,
          currentSnapshot.connections,
          currentSnapshot.drawings || []
        ),
        ...history.future,
      ].slice(0, BOARD_MAX_HISTORY),
    },
  };
}

export function redoBoardHistory(
  history: BoardHistoryStack,
  currentSnapshot: {
    cards: BoardCard[];
    connections: BoardConnection[];
    drawings?: BoardDrawingStroke[];
  }
): { nextHistory: BoardHistoryStack; restored: BoardSnapshot } | null {
  if (history.future.length === 0) return null;
  const next = history.future[0];
  return {
    restored: cloneBoardSnapshot(next.cards, next.connections, next.drawings || []),
    nextHistory: {
      past: [
        ...history.past,
        cloneBoardSnapshot(
          currentSnapshot.cards,
          currentSnapshot.connections,
          currentSnapshot.drawings || []
        ),
      ].slice(-BOARD_MAX_HISTORY),
      future: history.future.slice(1),
    },
  };
}

export function sanitizeStoredFileRef(ref?: StoredFileRef): StoredFileRef | undefined {
  if (!ref || typeof ref !== 'object' || !ref.id || !ref.blobId) return undefined;
  return {
    id: String(ref.id).slice(0, 128),
    name: String(ref.name || 'image.png').slice(0, 255),
    size: Math.max(0, Math.min(210_000_000, Math.round(Number(ref.size) || 0))),
    mimeType: String(ref.mimeType || 'image/png').slice(0, 150),
    extension: String(ref.extension || 'PNG').slice(0, 30),
    blobId: String(ref.blobId).slice(0, 128),
    chunkCount: Math.max(1, Math.min(320, Math.round(Number(ref.chunkCount) || 1))),
  };
}

export function sanitizeBoardCard(card: BoardCard): BoardCard {
  const kind =
    card.kind === 'todo_widget' || card.kind === 'idea_note' || card.kind === 'image'
      ? card.kind
      : 'video';
  const base: BoardCard = {
    id: card.id,
    kind,
    x: clampCoord(card.x),
    y: clampCoord(card.y),
    width: clampCardWidth(card.width),
    title: (card.title || 'بطاقة تعلم').trim().slice(0, 200) || 'بطاقة تعلم',
    sourceLabel: (card.sourceLabel || '').slice(0, 140),
    videoUrl: (card.videoUrl || '').slice(0, 2048),
    thumbnailUrl: (card.thumbnailUrl || '').slice(0, 350000),
    completed: Boolean(card.completed),
    noteText: (card.noteText || '').slice(0, 4000),
    noteExpanded: Boolean(card.noteExpanded),
    linkedNoteId: (card.linkedNoteId || '').slice(0, 128),
    sourceRefType:
      card.sourceRefType === 'course' ||
      card.sourceRefType === 'learning_step' ||
      card.sourceRefType === 'game_jam' ||
      card.sourceRefType === 'video_collection' ||
      card.sourceRefType === 'url'
        ? card.sourceRefType
        : 'none',
    sourceRefId: (card.sourceRefId || '').slice(0, 128),
    sourceParentId: (card.sourceParentId || '').slice(0, 128),
    attachedToCardId: (card.attachedToCardId || '').slice(0, 128),
    accentColor:
      card.accentColor === 'navy' ||
      card.accentColor === 'emerald' ||
      card.accentColor === 'amber'
        ? card.accentColor
        : 'crimson',
  };

  if (typeof card.height === 'number' && Number.isFinite(card.height)) {
    base.height = clampImageHeight(card.height);
  }
  if (typeof card.rotation === 'number' && Number.isFinite(card.rotation)) {
    base.rotation = normalizeRotationDeg(card.rotation);
  }
  if (typeof card.zIndex === 'number' && Number.isFinite(card.zIndex)) {
    base.zIndex = Math.max(0, Math.min(10000, Math.round(card.zIndex)));
  }
  const cleanFileRef = sanitizeStoredFileRef(card.originalFileRef);
  if (cleanFileRef) {
    base.originalFileRef = cleanFileRef;
  }

  return base;
}

export function sanitizeDrawingStroke(stroke: BoardDrawingStroke): BoardDrawingStroke | null {
  if (!stroke || !stroke.id || !Array.isArray(stroke.points) || stroke.points.length === 0) {
    return null;
  }
  const cleanPoints = simplifyStrokePoints(
    stroke.points.filter(
      (p) => p && typeof p.x === 'number' && typeof p.y === 'number' && Number.isFinite(p.x) && Number.isFinite(p.y)
    ),
    0.5,
    BOARD_MAX_STROKE_POINTS
  );
  if (cleanPoints.length === 0) return null;

  const tool = stroke.tool === 'highlighter' ? 'highlighter' : 'pen';
  const size = Number.isFinite(stroke.size)
    ? Math.max(1, Math.min(64, Math.round(stroke.size)))
    : tool === 'highlighter'
      ? 18
      : 4;
  const opacity = Number.isFinite(stroke.opacity)
    ? Math.round(Math.max(0.05, Math.min(1, stroke.opacity)) * 100) / 100
    : tool === 'highlighter'
      ? 0.42
      : 1;
  const color =
    typeof stroke.color === 'string' && stroke.color.trim().length >= 4 && stroke.color.trim().length <= 16
      ? stroke.color.trim()
      : '#B92622';

  return {
    id: String(stroke.id).slice(0, 128),
    tool,
    color,
    size,
    opacity,
    points: cleanPoints,
  };
}

export function sanitizeLearningBoard(board: LearningBoard): LearningBoard {
  const cleanCards = (board.cards || []).slice(0, BOARD_MAX_CARDS).map(sanitizeBoardCard);
  const validIds = new Set(cleanCards.map((c) => c.id));
  const cleanConnections = (board.connections || [])
    .filter(
      (conn) =>
        conn.fromCardId !== conn.toCardId &&
        validIds.has(conn.fromCardId) &&
        validIds.has(conn.toCardId)
    )
    .slice(0, BOARD_MAX_CONNECTIONS)
    .map(
      (conn): BoardConnection => ({
        id: conn.id,
        fromCardId: conn.fromCardId,
        toCardId: conn.toCardId,
        label: (conn.label || '').slice(0, 120),
        color:
          conn.color === 'navy' ||
          conn.color === 'emerald' ||
          conn.color === 'amber'
            ? conn.color
            : 'crimson',
      })
    );

  const cleanDrawings = (Array.isArray(board.drawings) ? board.drawings : [])
    .slice(0, BOARD_MAX_DRAWINGS)
    .map(sanitizeDrawingStroke)
    .filter((s): s is BoardDrawingStroke => Boolean(s));

  return {
    ...board,
    title: (board.title || 'لوحة تعلم جديدة').trim().slice(0, 160) || 'لوحة تعلم جديدة',
    description: (board.description || '').slice(0, 600),
    cards: cleanCards,
    connections: cleanConnections,
    drawings: cleanDrawings,
    viewport: {
      panX: clampCoord(board.viewport?.panX ?? 0),
      panY: clampCoord(board.viewport?.panY ?? 0),
      zoom: clampZoom(board.viewport?.zoom ?? 1),
    },
  };
}
