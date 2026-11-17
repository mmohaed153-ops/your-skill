export type StepStatus = 'completed' | 'current' | 'upcoming';

export interface LearningPath {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  coverImage: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoStep {
  id: string;
  pathId: string;
  ownerId: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  order: number;
  completed: boolean;
  completedAt: string;
  targetDate: string;
  quickNotes: string;
  quickNotesUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PathProgress {
  total: number;
  completedCount: number;
  percentage: number;
  currentStepIndex: number;
  nextStep: VideoStep | null;
}

export type VideoPlatformId =
  | 'youtube'
  | 'tiktok'
  | 'facebook'
  | 'vimeo'
  | 'twitch'
  | 'loom'
  | 'dailymotion'
  | 'x_twitter'
  | 'direct'
  | 'external';

export interface VideoEmbedInfo {
  provider: 'youtube' | 'vimeo' | 'tiktok' | 'facebook' | 'loom' | 'dailymotion' | 'direct' | 'external';
  platformId: VideoPlatformId;
  platformName: string;
  embedUrl: string | null;
  autoThumbnailUrl: string | null;
  normalizedUrl: string;
}
