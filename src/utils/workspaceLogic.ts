import type {
  AssetCategory,
  CourseItem,
  CourseStatus,
  LibraryAsset,
  PbrMaterialSpec,
  StoredFileRef,
  TodoLinkType,
  TodoPriority,
  TodoTask,
  VaultProject,
  VaultVersion,
} from '../types/workspace';

export const MAX_CLOUD_FILE_BYTES = 200 * 1024 * 1024; // 200 MB per single file
export const MAX_BUNDLE_FILES = 100; // up to 100 files in a single upload batch
export const MAX_BUNDLE_TOTAL_BYTES = 1024 * 1024 * 1024; // 1 GB per bundle/version
export const WORKSPACE_CLOUD_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB account workspace quota

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  '3d_model': 'نموذج ثلاثي الأبعاد',
  material: 'مادة وخامة PBR',
  texture: 'خامة / نسيج',
  image: 'صورة',
  audio: 'ملف صوتي',
  animation: 'حركة / أنيميشن',
  addon: 'إضافة / ملحق',
  game_asset: 'عنصر لعبة',
  other: 'موارد أخرى',
};

export const ASSET_CATEGORY_OPTIONS: { value: AssetCategory; label: string }[] = [
  { value: '3d_model', label: 'نموذج ثلاثي الأبعاد (3D Model)' },
  { value: 'material', label: 'مادة وخامة PBR (Material)' },
  { value: 'texture', label: 'خامة / نسيج (Texture)' },
  { value: 'image', label: 'صورة (Image)' },
  { value: 'audio', label: 'ملف صوتي (Audio)' },
  { value: 'animation', label: 'حركة / أنيميشن (Animation)' },
  { value: 'addon', label: 'إضافة / ملحق (Add-on)' },
  { value: 'game_asset', label: 'عنصر لعبة (Game Asset)' },
  { value: 'other', label: 'موارد أخرى (Other)' },
];

export const DEFAULT_VAULT_FOLDERS = [
  'مشاريع الألعاب',
  'تطبيقات الويب',
  'نماذج ومشاهد 3D',
  'أرشيف هام',
];

export const DEFAULT_ASSET_FOLDERS = [
  'أدوات الشخصيات والبيئة',
  'خامات ومواد PBR',
  'واجهات وأيقونات',
  'صوتيات ومؤثرات',
  'إضافات المحرك',
];

export const DEFAULT_COURSE_CATEGORIES = [
  'البرمجة وتطوير الويب',
  'تطوير الألعاب',
  'النمذجة والتصميم 3D',
  'التصميم وتجربة المستخدم',
  'اللغات والمهارات',
  'العلوم والرياضيات',
];

export type FileCategoryKind =
  | 'project'
  | 'archive'
  | '3d'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'code'
  | 'addon'
  | 'generic';

const FILE_EXT_GROUPS: Record<Exclude<FileCategoryKind, 'generic'>, Set<string>> = {
  project: new Set([
    'GODOT', 'TSCN', 'TRES', 'UNITYPACKAGE', 'UPROJECT', 'BLEND', 'BLEND1',
    'PSD', 'PSB', 'AI', 'FIG', 'XD', 'SKETCH', 'AEP', 'PRPROJ', 'KRA',
    'SLN', 'CSPROJ', 'VCXPROJ', 'PBIX',
  ]),
  archive: new Set(['ZIP', 'RAR', '7Z', 'TAR', 'GZ', 'BZ2', 'XZ', 'TGZ', 'CAB', 'ISO']),
  '3d': new Set(['GLB', 'GLTF', 'FBX', 'OBJ', 'MTL', 'STL', 'DAE', 'PLY', 'USD', 'USDZ', 'ABC', '3DS']),
  image: new Set(['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'SVG', 'BMP', 'ICO', 'EXR', 'HDR', 'TGA', 'TIF', 'TIFF', 'DDS', 'AVIF']),
  audio: new Set(['MP3', 'WAV', 'OGG', 'FLAC', 'AAC', 'M4A', 'OPUS', 'WMA', 'MID', 'MIDI', 'AIFF']),
  video: new Set(['MP4', 'WEBM', 'MOV', 'MKV', 'AVI', 'M4V', 'FLV', 'WMV']),
  document: new Set(['PDF', 'DOC', 'DOCX', 'TXT', 'MD', 'RTF', 'ODT', 'CSV', 'XLS', 'XLSX', 'PPT', 'PPTX', 'EPUB']),
  code: new Set([
    'JS', 'JSX', 'TS', 'TSX', 'MJS', 'CJS', 'PY', 'GD', 'CS', 'CPP', 'C', 'H', 'HPP',
    'RS', 'GO', 'JAVA', 'KT', 'SWIFT', 'PHP', 'RB', 'SH', 'BAT', 'PS1',
    'HTML', 'CSS', 'SCSS', 'LESS', 'JSON', 'YAML', 'YML', 'XML', 'TOML', 'INI', 'ENV', 'SQL', 'GLSL', 'HLSL',
  ]),
  addon: new Set(['ADDON', 'PLUGIN', 'VSIX', 'CRX', 'XPI', 'DLL', 'SO', 'DYLIB', 'WASM', 'PAK', 'PCK']),
};

export const FILE_CATEGORY_LABELS: Record<FileCategoryKind, string> = {
  project: 'ملف مشروع',
  archive: 'أرشيف مضغوط',
  '3d': 'نموذج ثلاثي الأبعاد',
  image: 'صورة / خامة',
  audio: 'ملف صوتي',
  video: 'ملف فيديو',
  document: 'مستند',
  code: 'ملف برمجي',
  addon: 'إضافة / ملحق',
  generic: 'ملف عام',
};

export function getFileCategoryKind(filename: string, mimeType = ''): FileCategoryKind {
  const ext = getFileExtension(filename);
  if (ext !== 'FILE') {
    for (const [kind, set] of Object.entries(FILE_EXT_GROUPS) as [
      Exclude<FileCategoryKind, 'generic'>,
      Set<string>,
    ][]) {
      if (set.has(ext)) return kind;
    }
  }
  const mime = mimeType.toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('model/')) return '3d';
  if (mime.includes('zip') || mime.includes('compressed') || mime.includes('archive')) return 'archive';
  if (mime.includes('pdf') || mime.includes('document') || mime.includes('msword') || mime.includes('spreadsheet')) {
    return 'document';
  }
  if (mime.includes('json') || mime.includes('javascript') || mime.includes('typescript') || mime.includes('xml')) {
    return 'code';
  }
  return 'generic';
}

const THREE_D_PREVIEW_EXTENSIONS = new Set(['GLB', 'GLTF', 'OBJ', 'STL', 'PLY']);

export function getPreviewKind(
  filename: string,
  mimeType = ''
): 'image' | 'audio' | 'video' | 'text' | '3d' | 'none' {
  const kind = getFileCategoryKind(filename, mimeType);
  const ext = getFileExtension(filename);
  if (THREE_D_PREVIEW_EXTENSIONS.has(ext) || mimeType.toLowerCase().includes('gltf')) {
    return '3d';
  }
  if (kind === 'image' && !['EXR', 'HDR', 'TGA', 'DDS', 'TIF', 'TIFF'].includes(ext)) {
    return 'image';
  }
  if (kind === 'audio') return 'audio';
  if (kind === 'video') return 'video';
  if (kind === 'code' || ext === 'TXT' || ext === 'MD' || ext === 'CSV' || ext === 'GODOT' || ext === 'TSCN' || ext === 'TRES') {
    return 'text';
  }
  return 'none';
}

export type PbrMapSlot = 'baseColor' | 'normal' | 'roughness' | 'metallic' | 'height';

export function detectPbrMapSlot(filename: string): PbrMapSlot | null {
  const lower = filename.toLowerCase();
  if (!/\.(png|jpe?g|webp|avif|bmp)$/i.test(lower)) return null;
  if (/(normal|_nrm|_nor|_norm|\bnorm\b)/i.test(lower)) return 'normal';
  if (/(roughness|_rough|\brough\b)/i.test(lower)) return 'roughness';
  if (/(metallic|metalness|_metal|\bmetal\b)/i.test(lower)) return 'metallic';
  if (/(height|bump|displacement|_disp|_hgt|\bdisp\b)/i.test(lower)) return 'height';
  if (/(albedo|basecolor|base_color|diffuse|color|_col|_diff)/i.test(lower)) return 'baseColor';
  return null;
}

export function normalizePbrMaterialSpec(
  spec?: Partial<PbrMaterialSpec>,
  files: StoredFileRef[] = []
): PbrMaterialSpec {
  const normalized: PbrMaterialSpec = {
    colorHex: /^#[0-9a-fA-F]{6}$/.test(spec?.colorHex || '') ? spec!.colorHex! : '#64748b',
    roughness: Math.max(0, Math.min(1, Number.isFinite(spec?.roughness) ? Number(spec!.roughness) : 0.65)),
    metalness: Math.max(0, Math.min(1, Number.isFinite(spec?.metalness) ? Number(spec!.metalness) : 0.1)),
    tiling: Math.max(1, Math.min(8, Math.round(Number.isFinite(spec?.tiling) ? Number(spec!.tiling) : 2))),
    baseColorFileId: spec?.baseColorFileId || '',
    normalFileId: spec?.normalFileId || '',
    roughnessFileId: spec?.roughnessFileId || '',
    metallicFileId: spec?.metallicFileId || '',
    heightFileId: spec?.heightFileId || '',
  };

  for (const file of files) {
    const slot = detectPbrMapSlot(file.name);
    if (!slot) continue;
    if (slot === 'baseColor' && !normalized.baseColorFileId) normalized.baseColorFileId = file.id;
    if (slot === 'normal' && !normalized.normalFileId) normalized.normalFileId = file.id;
    if (slot === 'roughness' && !normalized.roughnessFileId) normalized.roughnessFileId = file.id;
    if (slot === 'metallic' && !normalized.metallicFileId) normalized.metallicFileId = file.id;
    if (slot === 'height' && !normalized.heightFileId) normalized.heightFileId = file.id;
  }

  // If no named albedo was matched but there is at least one previewable image file, bind it as baseColor fallback
  if (!normalized.baseColorFileId) {
    const firstImg = files.find((f) => getPreviewKind(f.name, f.mimeType) === 'image');
    if (firstImg) {
      normalized.baseColorFileId = firstImg.id;
    }
  }

  return normalized;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIdx = 0;
  while (value >= 1024 && unitIdx < units.length - 1) {
    value /= 1024;
    unitIdx += 1;
  }
  return `${unitIdx === 0 ? Math.round(value) : value.toFixed(1)} ${units[unitIdx]}`;
}

export function getFileExtension(filename: string): string {
  const clean = filename.trim().split(/[/\\]/).pop() || '';
  const dotIdx = clean.lastIndexOf('.');
  if (dotIdx <= 0 || dotIdx === clean.length - 1) return 'FILE';
  return clean.slice(dotIdx + 1).toUpperCase().slice(0, 12);
}

export function inferProjectFileType(filenames: string[]): string {
  if (filenames.length === 0) return 'ARCHIVE';
  const extensions = filenames.map((n) => getFileExtension(n));
  if (extensions.includes('ZIP')) return 'ZIP';
  if (extensions.includes('GODOT') || extensions.includes('TSCN') || extensions.includes('GD')) {
    return 'GODOT';
  }
  if (extensions.includes('BLEND')) return 'BLENDER';
  if (extensions.includes('GLB') || extensions.includes('GLTF') || extensions.includes('FBX')) {
    return extensions.find((e) => e === 'GLB' || e === 'GLTF' || e === 'FBX') || '3D';
  }
  if (extensions.includes('UNITYPACKAGE')) return 'UNITY';
  return extensions[0] || 'PROJECT';
}

export function parseTagsInput(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(/[,،\n]+/)) {
    const clean = part.trim().slice(0, 40);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      tags.push(clean);
      if (tags.length >= 15) break;
    }
  }
  return tags;
}

export function formatShortDate(iso: string): string {
  if (!iso) return 'غير محدد';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface StorageSummary {
  vaultBytes: number;
  assetsBytes: number;
  totalUsedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  percentUsed: number;
  vaultFilesCount: number;
  assetsFilesCount: number;
  totalFilesCount: number;
}

export function calculateStorageSummary(
  projects: VaultProject[],
  versionsByProject: Record<string, VaultVersion[]>,
  assets: LibraryAsset[],
  quotaBytes = WORKSPACE_CLOUD_QUOTA_BYTES
): StorageSummary {
  let vaultBytes = 0;
  let vaultFilesCount = 0;
  for (const project of projects) {
    const versions = versionsByProject[project.id] || [];
    for (const version of versions) {
      vaultBytes += Math.max(0, version.totalSizeBytes || 0);
      vaultFilesCount += Array.isArray(version.files) ? version.files.length : 0;
    }
  }

  let assetsBytes = 0;
  let assetsFilesCount = 0;
  for (const asset of assets) {
    assetsBytes += Math.max(0, asset.totalSizeBytes || 0);
    assetsFilesCount += Array.isArray(asset.files) ? asset.files.length : asset.fileCount || 0;
  }

  const totalUsedBytes = vaultBytes + assetsBytes;
  const availableBytes = Math.max(0, quotaBytes - totalUsedBytes);
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((totalUsedBytes / quotaBytes) * 1000) / 10) : 0;

  return {
    vaultBytes,
    assetsBytes,
    totalUsedBytes,
    quotaBytes,
    availableBytes,
    percentUsed,
    vaultFilesCount,
    assetsFilesCount,
    totalFilesCount: vaultFilesCount + assetsFilesCount,
  };
}

export type VaultQuickKindFilter = 'all' | 'games' | 'web' | '3d';

export function isGameVaultProject(project: VaultProject): boolean {
  const text = `${project.folder} ${project.fileType} ${project.name} ${project.description}`.toLowerCase();
  return (
    Boolean(project.linkedJamId) ||
    /(ألعاب|لعبة|godot|unity|unreal|uproject|gdscript|game|itch|jam|phaser|pico)/.test(text)
  );
}

export function filterVaultProjects(
  projects: VaultProject[],
  searchQuery: string,
  folderFilter: string,
  quickKind: VaultQuickKindFilter = 'all'
): VaultProject[] {
  const q = searchQuery.trim().toLowerCase();
  return projects.filter((project) => {
    if (folderFilter !== 'all' && project.folder !== folderFilter) {
      return false;
    }
    if (quickKind === 'games' && !isGameVaultProject(project)) {
      return false;
    }
    if (quickKind === 'web') {
      const text = `${project.folder} ${project.fileType} ${project.name}`.toLowerCase();
      if (!/(ويب|web|react|html|vite|next|js|ts)/.test(text)) return false;
    }
    if (quickKind === '3d') {
      const text = `${project.folder} ${project.fileType} ${project.name}`.toLowerCase();
      if (!/(3d|blend|gltf|glb|fbx|obj|مشاهد)/.test(text)) return false;
    }
    if (!q) return true;
    return (
      project.name.toLowerCase().includes(q) ||
      project.description.toLowerCase().includes(q) ||
      project.fileType.toLowerCase().includes(q) ||
      project.folder.toLowerCase().includes(q)
    );
  });
}

export function filterLibraryAssets(
  assets: LibraryAsset[],
  searchQuery: string,
  categoryFilter: AssetCategory | 'all',
  folderFilter: string
): LibraryAsset[] {
  const q = searchQuery.trim().toLowerCase();
  return assets.filter((asset) => {
    if (categoryFilter !== 'all' && asset.category !== categoryFilter) {
      return false;
    }
    if (folderFilter !== 'all' && asset.folder !== folderFilter) {
      return false;
    }
    if (!q) return true;
    return (
      asset.name.toLowerCase().includes(q) ||
      asset.description.toLowerCase().includes(q) ||
      asset.folder.toLowerCase().includes(q) ||
      asset.primaryExtension.toLowerCase().includes(q) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(q)) ||
      asset.files.some((f) => f.name.toLowerCase().includes(q))
    );
  });
}

export function getNextVersionLabel(versionNumber: number): string {
  return `v${Math.max(1, Math.floor(versionNumber))}.0`;
}

export function validateVaultProjectInput(input: {
  name: string;
  folder: string;
  hasFiles: boolean;
  requiresFiles: boolean;
}): string | null {
  if (!input.name.trim()) return 'يرجى إدخال اسم المشروع.';
  if (!input.folder.trim()) return 'يرجى اختيار أو إدخال اسم المجلد.';
  if (input.requiresFiles && !input.hasFiles) {
    return 'يرجى رفع ملف واحد على الأقل لحفظ النسخة الاحتياطية.';
  }
  return null;
}

export function validateAssetInput(input: {
  name: string;
  folder: string;
  hasFiles: boolean;
  requiresFiles: boolean;
}): string | null {
  if (!input.name.trim()) return 'يرجى إدخال اسم الأصل.';
  if (!input.folder.trim()) return 'يرجى اختيار المجلد أو المجموعة.';
  if (input.requiresFiles && !input.hasFiles) {
    return 'يرجى رفع ملف أو أكثر للأصل قبل الحفظ.';
  }
  return null;
}

// ==================== To-Do List Pure Logic ====================

export const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: 'أولوية عالية',
  medium: 'أولوية متوسطة',
  low: 'أولوية عادية',
};

export const TODO_LINK_TYPE_LABELS: Record<TodoLinkType, string> = {
  none: 'مهمة عامة',
  project: 'مرتبطة بمشروع',
  learning_path: 'مرتبطة بمسار تعلم',
  learning_step: 'مرتبطة بفيديو تعليمي',
  course: 'مرتبطة بكورس',
  asset: 'مرتبطة بأصل إبداعي',
  creative: 'مهمة إبداعية',
  learning_board: 'مرتبطة بلوحة التعلم',
  game_jam: 'مرتبطة بمسابقة ألعاب',
  video_collection: 'مرتبطة بمجموعة فيديو',
};

const PRIORITY_WEIGHT: Record<TodoPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function isTodoOverdue(task: Pick<TodoTask, 'dueDate' | 'completed'>, todayIso?: string): boolean {
  if (task.completed || !task.dueDate) return false;
  const today = todayIso || new Date().toISOString().slice(0, 10);
  return task.dueDate < today;
}

export function filterAndSortTodos(
  todos: TodoTask[],
  options: {
    searchQuery: string;
    priorityFilter: TodoPriority | 'all';
    linkTypeFilter: TodoLinkType | 'all';
  }
): { pending: TodoTask[]; completed: TodoTask[] } {
  const q = options.searchQuery.trim().toLowerCase();
  const filtered = todos.filter((t) => {
    if (options.priorityFilter !== 'all' && t.priority !== options.priorityFilter) {
      return false;
    }
    if (options.linkTypeFilter !== 'all' && t.link.type !== options.linkTypeFilter) {
      return false;
    }
    if (!q) return true;
    return (
      t.title.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      t.link.label.toLowerCase().includes(q)
    );
  });

  const pending = filtered
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const prioDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (prioDiff !== 0) return prioDiff;
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
        return a.dueDate.localeCompare(b.dueDate);
      }
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const completed = filtered
    .filter((t) => t.completed)
    .sort(
      (a, b) =>
        new Date(b.completedAt || b.updatedAt).getTime() -
        new Date(a.completedAt || a.updatedAt).getTime()
    );

  return { pending, completed };
}

export interface TodoStats {
  total: number;
  pendingCount: number;
  completedCount: number;
  highPriorityPendingCount: number;
  overdueCount: number;
  completionPercent: number;
}

export function calculateTodoStats(todos: TodoTask[], todayIso?: string): TodoStats {
  const total = todos.length;
  const completedCount = todos.filter((t) => t.completed).length;
  const pending = todos.filter((t) => !t.completed);
  const highPriorityPendingCount = pending.filter((t) => t.priority === 'high').length;
  const overdueCount = pending.filter((t) => isTodoOverdue(t, todayIso)).length;
  const completionPercent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return {
    total,
    pendingCount: pending.length,
    completedCount,
    highPriorityPendingCount,
    overdueCount,
    completionPercent,
  };
}

export function validateTodoInput(input: { title: string }): string | null {
  if (!input.title.trim()) {
    return 'يرجى كتابة عنوان المهمة.';
  }
  return null;
}

// ==================== My Courses Pure Logic ====================

export const COURSE_STATUS_LABELS: Record<CourseStatus, string> = {
  active: 'قيد المتابعة',
  completed: 'مكتمل',
  wishlist: 'محفوظ لاحقاً',
};

export function normalizeCourseProgress(progress: number): {
  progressPercent: number;
  statusHint?: CourseStatus;
} {
  const clamped = Math.max(0, Math.min(100, Math.round(Number.isFinite(progress) ? progress : 0)));
  return {
    progressPercent: clamped,
    statusHint: clamped >= 100 ? 'completed' : undefined,
  };
}

export function filterCourses(
  courses: CourseItem[],
  options: {
    searchQuery: string;
    statusFilter: CourseStatus | 'all';
    categoryFilter: string;
  }
): CourseItem[] {
  const q = options.searchQuery.trim().toLowerCase();
  return courses.filter((c) => {
    if (options.statusFilter !== 'all' && c.status !== options.statusFilter) return false;
    if (options.categoryFilter !== 'all' && c.category !== options.categoryFilter) return false;
    if (!q) return true;
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.platform.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });
}

export function validateCourseInput(input: { title: string; url: string }): string | null {
  if (!input.title.trim()) return 'يرجى إدخال اسم الكورس.';
  const raw = input.url.trim();
  if (!raw) return 'يرجى إدخال رابط الكورس.';
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname.includes('.')) {
      return 'يرجى إدخال رابط صحيح للكورس (مثل youtube.com أو coursera.org).';
    }
    return null;
  } catch {
    return 'يرجى إدخال رابط صحيح للكورس.';
  }
}
