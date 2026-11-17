import type {
  NoteLinkRef,
  NoteLinkTargetType,
  NoteSortOption,
  WorkspaceNote,
} from '../types/workspace';

export const NOTE_TITLE_MAX = 200;
export const NOTE_HTML_MAX = 40000;
export const NOTE_PREVIEW_MAX = 240;
export const NOTE_FOLDER_MAX = 80;
export const NOTE_MAX_LINKS = 10;

export const DEFAULT_NOTE_FOLDERS = [
  'ملاحظات عامة',
  'ملاحظات لوحة التعلم',
  'ملاحظات البرمجة',
  'تطوير الألعاب',
  'تصميم وأصول',
  'أفكار ومهام',
];

export const NOTE_LINK_TYPE_LABELS: Record<NoteLinkTargetType, string> = {
  vault_project: 'مشروع في الخزنة',
  library_asset: 'أصل في المكتبة',
  learning_step: 'فيديو في المسار',
  learning_path: 'مسار تعليمي',
  course: 'كورس في كورساتي',
  learning_board: 'بطاقة في لوحة التعلم',
  game_jam: 'مسابقة ألعاب محفوظة',
  video_collection: 'مجموعة فيديوهات',
};

export function sanitizeNoteHtml(rawHtml: string): string {
  if (!rawHtml) return '';
  let cleaned = rawHtml
    // Strip dangerous containers and inline scripts/styles
    .replace(/<\s*(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*\/?>/gi, '')
    // Strip inline event handlers (onclick=, onerror=, etc.)
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    // Neutralize javascript: or data: URLs in href/src
    .replace(/(href|src)\s*=\s*(?:"\s*(?:javascript|vbscript|data):[^"]*"|'\s*(?:javascript|vbscript|data):[^']*')/gi, '$1="#"');

  if (cleaned.length > NOTE_HTML_MAX) {
    cleaned = cleaned.slice(0, NOTE_HTML_MAX);
  }
  return cleaned;
}

export function extractPlainTextFromHtml(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/\s*(p|div|h1|h2|h3|li|pre|blockquote)\s*>/gi, '\n');

  const stripped = withBreaks
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return stripped
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

export function buildNotePlainPreview(html: string, maxChars = NOTE_PREVIEW_MAX): string {
  const plain = extractPlainTextFromHtml(html).replace(/\s+/g, ' ').trim();
  if (!plain) return '';
  if (plain.length <= maxChars) return plain;
  return `${plain.slice(0, maxChars - 3).trimEnd()}...`;
}

export function filterAndSortNotes(
  notes: WorkspaceNote[],
  options: {
    searchQuery: string;
    folderFilter: string;
    onlyPinned?: boolean;
    linkTypeFilter?: NoteLinkTargetType | 'all';
    sortBy: NoteSortOption;
  }
): WorkspaceNote[] {
  const q = options.searchQuery.trim().toLowerCase();
  const filtered = notes.filter((note) => {
    if (options.folderFilter !== 'all' && note.folder !== options.folderFilter) {
      return false;
    }
    if (options.onlyPinned && !note.pinned) {
      return false;
    }
    if (
      options.linkTypeFilter &&
      options.linkTypeFilter !== 'all' &&
      !note.links.some((link) => link.type === options.linkTypeFilter)
    ) {
      return false;
    }
    if (!q) return true;
    const plain = extractPlainTextFromHtml(note.contentHtml).toLowerCase();
    return (
      note.title.toLowerCase().includes(q) ||
      plain.includes(q) ||
      note.folder.toLowerCase().includes(q) ||
      note.tags.some((t) => t.toLowerCase().includes(q)) ||
      note.links.some((l) => l.label.toLowerCase().includes(q))
    );
  });

  return [...filtered].sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return a.pinned ? -1 : 1;
    }
    if (options.sortBy === 'title_asc') {
      return a.title.localeCompare(b.title, 'ar');
    }
    if (options.sortBy === 'created_desc') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export function getNotesLinkedToTarget(
  notes: WorkspaceNote[],
  type: NoteLinkTargetType,
  targetId: string
): WorkspaceNote[] {
  return notes
    .filter((note) => note.links.some((l) => l.type === type && l.targetId === targetId))
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
}

export function upsertNoteLink(links: NoteLinkRef[], nextLink: NoteLinkRef): NoteLinkRef[] {
  const cleanLabel = nextLink.label.trim().slice(0, 200) || 'عنصر مرتبط';
  const normalized: NoteLinkRef = {
    type: nextLink.type,
    targetId: nextLink.targetId,
    parentId: nextLink.parentId || '',
    label: cleanLabel,
  };
  const filtered = links.filter(
    (l) => !(l.type === normalized.type && l.targetId === normalized.targetId)
  );
  return [normalized, ...filtered].slice(0, NOTE_MAX_LINKS);
}

export function removeNoteLink(
  links: NoteLinkRef[],
  type: NoteLinkTargetType,
  targetId: string
): NoteLinkRef[] {
  return links.filter((l) => !(l.type === type && l.targetId === targetId));
}

export function normalizeSafeLinkHref(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname.includes('.')) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}
