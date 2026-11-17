import type { StoredFileRef } from './workspace';

export type PlatformSection =
  | 'dashboard'
  | 'skills'
  | 'projects'
  | 'review'
  | 'stats'
  | 'achievements'
  | 'leaderboard'
  | 'favorites';

// ==================== XP & Level Progression ====================

export type XpActionKind =
  | 'video_watch'
  | 'lesson_complete'
  | 'quiz_pass'
  | 'todo_complete'
  | 'project_complete'
  | 'path_complete'
  | 'badge_unlock'
  | 'streak_milestone'
  | 'review_mastery';

export interface XpTransaction {
  id: string; // deterministic rewardKey for idempotency
  ownerId: string;
  rewardKey: string;
  actionKind: XpActionKind;
  points: number;
  title: string;
  detail: string;
  relatedId: string;
  dateIso: string; // YYYY-MM-DD
  createdAt: string;
}

export interface LevelProgressSummary {
  level: number;
  totalXp: number;
  currentLevelFloorXp: number;
  nextLevelXp: number;
  xpIntoCurrentLevel: number;
  xpNeededForNextLevel: number;
  progressPercent: number;
  rankTitle: string;
}

export interface GamificationProfileState {
  id: string; // 'profile'
  ownerId: string;
  totalXp: number;
  weeklyXp: number;
  monthlyXp: number;
  weekKey: string;
  monthKey: string;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string; // YYYY-MM-DD or ''
  unlockedBadgeIds: string[];
  badgeUnlockedAt: Record<string, string>;
  totalVideosWatched: number;
  totalQuizzesPassed: number;
  totalReviewsCompleted: number;
  updatedAt: string;
}

// ==================== Daily Learning Activity & Streak ====================

export interface DailyActivityRecord {
  id: string; // YYYY-MM-DD
  ownerId: string;
  dateIso: string; // YYYY-MM-DD
  minutesLearned: number;
  videosWatched: number;
  lessonsCompleted: number;
  tasksCompleted: number;
  quizzesCompleted: number;
  reviewsCompleted: number;
  xpEarned: number;
  updatedAt: string;
}

export interface StreakMilestoneDef {
  days: number;
  title: string;
  bonusXp: number;
  badgeId: string;
}

export interface StreakEvaluationResult {
  currentStreak: number;
  longestStreak: number;
  isNewRecord: boolean;
  newlyReachedMilestones: StreakMilestoneDef[];
  activeDatesSet: string[];
}

// ==================== Achievement Badges ====================

export type BadgeCategory = 'learning' | 'streak' | 'quiz' | 'projects' | 'mastery';

export interface AchievementBadgeDef {
  id: string;
  title: string;
  description: string;
  category: BadgeCategory;
  bonusXp: number;
  targetValue: number;
  unitLabel: string;
  accentTone: 'crimson' | 'navy' | 'emerald' | 'amber';
  iconName:
    | 'book'
    | 'zap'
    | 'flame'
    | 'crown'
    | 'hammer'
    | 'award'
    | 'target'
    | 'brain'
    | 'compass'
    | 'star'
    | 'shield'
    | 'sparkles';
}

export interface EvaluatedBadgeStatus {
  badge: AchievementBadgeDef;
  unlocked: boolean;
  unlockedAt: string;
  currentValue: number;
  progressPercent: number;
}

// ==================== Certificates ====================

export interface CertificateRecord {
  id: string;
  ownerId: string;
  pathId: string;
  pathTitle: string;
  recipientName: string;
  verificationCode: string;
  lessonsCount: number;
  totalHoursLabel: string;
  completedAt: string;
  issuedAt: string;
}

// ==================== Skill Tree ====================

export type SkillNodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface SkillNode {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  levelNumber: number; // 1 to 4
  columnIndex: number; // visual order within level
  category: string;
  prerequisiteIds: string[];
  linkedPathIds: string[];
  linkedCourseIds: string[];
  linkedProjectIds: string[];
  xpReward: number;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EvaluatedSkillNode {
  node: SkillNode;
  status: SkillNodeStatus;
  progressPercent: number;
  completedSourcesCount: number;
  totalSourcesCount: number;
  prerequisitesMet: boolean;
}

// ==================== Interactive Quizzes & Smart Review ====================

export type QuizQuestionType = 'multiple_choice' | 'true_false';

export interface QuizQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LessonQuiz {
  id: string;
  ownerId: string;
  stepId: string;
  pathId: string;
  stepTitle: string;
  title: string;
  passPercent: number;
  source: 'ai' | 'manual';
  questions: QuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface QuizQuestionResult {
  questionId: string;
  prompt: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface QuizAttempt {
  id: string;
  ownerId: string;
  quizId: string;
  stepId: string;
  pathId: string;
  stepTitle: string;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  results: QuizQuestionResult[];
  createdAt: string;
}

export interface ReviewItem {
  id: string;
  ownerId: string;
  questionId: string;
  quizId: string;
  stepId: string;
  pathId: string;
  stepTitle: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  wrongCount: number;
  correctCount: number;
  mastered: boolean;
  lastWrongAt: string;
  lastReviewedAt: string;
  updatedAt: string;
}

// ==================== Favorites ====================

export type FavoriteTargetType =
  | 'video_step'
  | 'learning_path'
  | 'course'
  | 'collection_video';

export interface FavoriteItem {
  id: string;
  ownerId: string;
  targetType: FavoriteTargetType;
  targetId: string;
  parentId: string;
  title: string;
  subtitle: string;
  url: string;
  thumbnailUrl: string;
  createdAt: string;
}

// ==================== Practical Projects ====================

export type PracticalProjectStatus = 'not_started' | 'in_progress' | 'completed';

export interface PracticalProjectStage {
  id: string;
  title: string;
  instructions: string;
  completed: boolean;
}

export interface PracticalProject {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  requirements: string;
  requiredSkills: string[];
  linkedPathId: string;
  linkedPathTitle: string;
  status: PracticalProjectStatus;
  stages: PracticalProjectStage[];
  files: StoredFileRef[];
  totalSizeBytes: number;
  projectUrl: string;
  xpReward: number;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Leaderboard (Zero PII) ====================

export type LeaderboardPeriod = 'weekly' | 'monthly' | 'all_time';
export type LeaderboardLimit = 10 | 50 | 100;

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  username: string;
  avatarLetter: string;
  level: number;
  totalXp: number;
  weeklyXp: number;
  monthlyXp: number;
  weekKey: string;
  monthKey: string;
  currentStreak: number;
  badgesCount: number;
  updatedAt: string;
}

// ==================== Notifications Center ====================

export type NotificationKind =
  | 'xp'
  | 'level_up'
  | 'badge'
  | 'streak'
  | 'quiz'
  | 'project'
  | 'certificate'
  | 'leaderboard';

export interface PlatformNotification {
  id: string;
  ownerId: string;
  kind: NotificationKind;
  title: string;
  message: string;
  read: boolean;
  targetSection: AppSectionAlias;
  createdAt: string;
}

export type AppSectionAlias =
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
