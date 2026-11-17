import type { VideoPlatformId } from './learning';

export type AppSection =
  | 'dashboard'
  | 'path'
  | 'skills'
  | 'projects'
  | 'review'
  | 'stats'
  | 'achievements'
  | 'leaderboard'
  | 'favorites'
  | 'courses'
  | 'board'
  | 'videos'
  | 'jams'
  | 'calendar'
  | 'todos'
  | 'vault'
  | 'assets'
  | 'notes'
  | 'shared';

export interface StoredFileRef {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  extension: string;
  blobId: string;
  chunkCount: number;
}

export interface UploadProgressState {
  active: boolean;
  percent: number;
  fileName: string;
  currentFileIndex: number;
  totalFiles: number;
  bytesUploaded: number;
  totalBytes: number;
  phase: 'idle' | 'uploading' | 'saving' | 'error';
  errorMessage?: string | null;
}

export const INITIAL_UPLOAD_PROGRESS: UploadProgressState = {
  active: false,
  percent: 0,
  fileName: '',
  currentFileIndex: 0,
  totalFiles: 0,
  bytesUploaded: 0,
  totalBytes: 0,
  phase: 'idle',
  errorMessage: null,
};

export interface VaultVersion {
  id: string;
  projectId: string;
  ownerId: string;
  versionNumber: number;
  versionLabel: string;
  notes: string;
  totalSizeBytes: number;
  files: StoredFileRef[];
  createdAt: string;
  updatedAt: string;
}

export interface VaultProject {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  folder: string;
  fileType: string;
  previewImage: string;
  latestVersionNumber: number;
  latestBackupAt: string;
  linkedJamId?: string;
  createdAt: string;
  updatedAt: string;
}

export type AssetCategory =
  | '3d_model'
  | 'material'
  | 'texture'
  | 'image'
  | 'audio'
  | 'animation'
  | 'addon'
  | 'game_asset'
  | 'other';

export interface PbrMaterialSpec {
  colorHex: string;
  roughness: number;
  metalness: number;
  tiling: number;
  baseColorFileId?: string;
  normalFileId?: string;
  roughnessFileId?: string;
  metallicFileId?: string;
  heightFileId?: string;
}

export interface LibraryAsset {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  category: AssetCategory;
  folder: string;
  tags: string[];
  previewImage: string;
  fileCount: number;
  totalSizeBytes: number;
  primaryExtension: string;
  files: StoredFileRef[];
  materialSpec?: PbrMaterialSpec;
  createdAt: string;
  updatedAt: string;
}

export type NoteLinkTargetType =
  | 'vault_project'
  | 'library_asset'
  | 'learning_step'
  | 'learning_path'
  | 'course'
  | 'learning_board'
  | 'game_jam'
  | 'video_collection';

export interface NoteLinkRef {
  type: NoteLinkTargetType;
  targetId: string;
  parentId: string;
  label: string;
}

export type NoteSortOption = 'updated_desc' | 'created_desc' | 'title_asc';
export type NoteViewMode = 'cards' | 'list';

export interface WorkspaceNote {
  id: string;
  ownerId: string;
  title: string;
  contentHtml: string;
  plainPreview: string;
  folder: string;
  tags: string[];
  pinned: boolean;
  links: NoteLinkRef[];
  createdAt: string;
  updatedAt: string;
}

export type TodoPriority = 'high' | 'medium' | 'low';

export type TodoLinkType =
  | 'none'
  | 'project'
  | 'learning_path'
  | 'learning_step'
  | 'course'
  | 'asset'
  | 'creative'
  | 'learning_board'
  | 'game_jam'
  | 'video_collection';

export interface TodoLinkRef {
  type: TodoLinkType;
  targetId: string;
  parentId: string;
  label: string;
}

export interface TodoTask {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  priority: TodoPriority;
  dueDate: string;
  completed: boolean;
  completedAt: string;
  link: TodoLinkRef;
  createdAt: string;
  updatedAt: string;
}

export type CourseStatus = 'active' | 'completed' | 'wishlist';

export interface CourseVideoItem {
  id: string;
  title: string;
  videoUrl: string;
  duration: string;
}

export interface CourseItem {
  id: string;
  ownerId: string;
  title: string;
  url: string;
  thumbnailUrl: string;
  description: string;
  platform: string;
  category: string;
  status: CourseStatus;
  progressPercent: number;
  linkedPathId: string;
  videos: CourseVideoItem[];
  createdAt: string;
  updatedAt: string;
}

export interface DiscoveredCourseLesson {
  title: string;
  url: string;
  duration?: string;
}

export interface DiscoveredCourseResult {
  id: string;
  title: string;
  description: string;
  platform: string;
  url: string;
  thumbnailUrl: string;
  level: 'beginner' | 'intermediate' | 'advanced' | 'all';
  cost: 'free' | 'freemium' | 'paid';
  language: string;
  duration: string;
  whyRecommended: string;
  lessons: DiscoveredCourseLesson[];
}

export interface GroundingSourceLink {
  title: string;
  url: string;
}

export type BoardCardKind = 'video' | 'todo_widget' | 'idea_note' | 'image';
export type BoardAccentColor = 'crimson' | 'navy' | 'emerald' | 'amber';
export type BoardSourceRefType =
  | 'url'
  | 'course'
  | 'learning_step'
  | 'game_jam'
  | 'video_collection'
  | 'none';

export type BoardDrawingTool = 'pen' | 'highlighter';
export type BoardInteractionTool = 'select' | 'pen' | 'highlighter' | 'eraser';

export interface BoardDrawingPoint {
  x: number;
  y: number;
}

export interface BoardDrawingStroke {
  id: string;
  tool: BoardDrawingTool;
  color: string;
  size: number;
  opacity: number;
  points: BoardDrawingPoint[];
}

export interface BoardCard {
  id: string;
  kind: BoardCardKind;
  x: number;
  y: number;
  width: number;
  height?: number;
  rotation?: number;
  zIndex?: number;
  title: string;
  sourceLabel: string;
  videoUrl: string;
  thumbnailUrl: string;
  originalFileRef?: StoredFileRef;
  completed: boolean;
  noteText: string;
  noteExpanded: boolean;
  linkedNoteId: string;
  sourceRefType: BoardSourceRefType;
  sourceRefId: string;
  sourceParentId: string;
  attachedToCardId: string;
  accentColor: BoardAccentColor;
}

export interface BoardConnection {
  id: string;
  fromCardId: string;
  toCardId: string;
  label: string;
  color: BoardAccentColor;
}

export interface BoardViewport {
  panX: number;
  panY: number;
  zoom: number;
}

export interface LearningBoard {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  cards: BoardCard[];
  connections: BoardConnection[];
  drawings: BoardDrawingStroke[];
  viewport: BoardViewport;
  createdAt: string;
  updatedAt: string;
}

// ==================== Game Jam Finder & Saved Jams ====================

export type GameJamStatus = 'upcoming' | 'active' | 'newly_announced' | 'ended';
export type GameJamMode = 'online' | 'in_person' | 'hybrid';

export interface GameJamSearchResult {
  id: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: GameJamStatus;
  mode: GameJamMode;
  location: string;
  theme: string;
  platform: string;
  organizer: string;
  officialUrl: string;
  thumbnailUrl: string;
  participantsCount: number;
  tags: string[];
  beginnerFriendly: boolean;
  sourceName: string;
  sourceUrl: string;
  infoUpdatedAt: string;
}

export type GameJamUpdateKind =
  | 'newly_announced'
  | 'starting_soon'
  | 'active_now'
  | 'theme_update'
  | 'deadline';

export interface GameJamUpdateItem {
  id: string;
  title: string;
  summary: string;
  updateType: GameJamUpdateKind;
  jamName: string;
  officialUrl: string;
  platform: string;
  updateDate: string;
  sourceName: string;
}

export interface SavedGameJamResource {
  id: string;
  title: string;
  url: string;
}

export interface SavedGameJam {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  status: GameJamStatus;
  mode: GameJamMode;
  location: string;
  theme: string;
  platform: string;
  organizer: string;
  officialUrl: string;
  thumbnailUrl: string;
  personalNotes: string;
  linkedProjectId: string;
  linkedBoardId: string;
  resources: SavedGameJamResource[];
  infoUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Multi-Platform Video Collections ====================

export interface ResolvedVideoMetadata {
  resolved: boolean;
  url: string;
  platformId: VideoPlatformId;
  platformName: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  authorName: string;
}

export interface OrganizedVideoItem {
  id: string;
  title: string;
  videoUrl: string;
  platformId: VideoPlatformId;
  platformName: string;
  thumbnailUrl: string;
  description: string;
  notes: string;
  completed: boolean;
  tags: string[];
  category: string;
  addedAt: string;
}

export interface VideoCollection {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  coverImage: string;
  videos: OrganizedVideoItem[];
  createdAt: string;
  updatedAt: string;
}

// ==================== Calendar Section ====================

export type CalendarViewMode = 'month' | 'week' | 'day';

export type CalendarEventCategory =
  | 'study'
  | 'course'
  | 'game_jam'
  | 'project'
  | 'todo'
  | 'board'
  | 'personal';

export type CalendarLinkTargetType =
  | 'none'
  | 'course'
  | 'learning_path'
  | 'learning_step'
  | 'game_jam'
  | 'project'
  | 'todo'
  | 'learning_board';

export interface CalendarEvent {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm or ''
  endTime: string; // HH:mm or ''
  category: CalendarEventCategory;
  colorHex: string;
  reminderMinutes: number; // -1 = disabled, 0 = on time, 15, 60, 1440
  reminderEnabled: boolean;
  completed: boolean;
  linkedType: CalendarLinkTargetType;
  linkedId: string;
  linkedParentId: string;
  linkedLabel: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Social Sharing & Friends ====================

export type SharePermissionRole = 'viewer' | 'collaborator' | 'owner';

export type ShareableItemType =
  | 'learning_path'
  | 'course'
  | 'saved_game_jam'
  | 'vault_project'
  | 'learning_board'
  | 'note'
  | 'library_asset'
  | 'video_collection';

export interface UserPublicProfile {
  uid: string;
  username: string;
  usernameLower: string;
  displayName: string;
  bio: string;
  avatarLetter: string;
  updatedAt: string;
}

export interface FriendContact {
  id: string;
  ownerId: string;
  friendUid: string;
  username: string;
  displayName: string;
  addedAt: string;
}

export interface SharedItemRecord {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  recipientUid: string; // empty string when open invite link
  recipientUsername: string;
  itemType: ShareableItemType;
  itemId: string;
  itemTitle: string;
  itemSummary: string;
  itemThumbnail: string;
  role: SharePermissionRole;
  shareCode: string;
  revoked: boolean;
  allowCopy: boolean;
  includePersonalNotes: boolean;
  payloadJson: string;
  createdAt: string;
  updatedAt: string;
}
