import type { LearningPath, VideoStep } from '../types/learning';
import type {
  AchievementBadgeDef,
  DailyActivityRecord,
  EvaluatedBadgeStatus,
  GamificationProfileState,
  LevelProgressSummary,
  StreakEvaluationResult,
  StreakMilestoneDef,
  XpActionKind,
  XpTransaction,
} from '../types/platform';
import type { CourseItem, TodoTask } from '../types/workspace';

export const XP_REWARDS: Record<Exclude<XpActionKind, 'badge_unlock' | 'streak_milestone'>, number> = {
  video_watch: 15,
  lesson_complete: 30,
  quiz_pass: 50,
  todo_complete: 15,
  project_complete: 120,
  path_complete: 150,
  review_mastery: 20,
};

export const STREAK_MILESTONES: StreakMilestoneDef[] = [
  { days: 3, title: 'بداية متواصلة (3 أيام)', bonusXp: 35, badgeId: 'streak_3' },
  { days: 7, title: 'أسبوع تعلم متواصل (7 أيام)', bonusXp: 80, badgeId: 'streak_7' },
  { days: 14, title: 'انضباط أسبوعين (14 يوماً)', bonusXp: 160, badgeId: 'streak_14' },
  { days: 30, title: 'ثبات شهر كامل (30 يوماً)', bonusXp: 350, badgeId: 'streak_30' },
];

export const ACHIEVEMENT_BADGES: AchievementBadgeDef[] = [
  {
    id: 'first_lesson',
    title: 'First Lesson — الدرس الأول',
    description: 'أكملت أول درس فيديو في رحلتك التعليمية.',
    category: 'learning',
    bonusXp: 25,
    targetValue: 1,
    unitLabel: 'درس',
    accentTone: 'emerald',
    iconName: 'book',
  },
  {
    id: 'fast_learner',
    title: 'Fast Learner — متعلم سريع',
    description: 'أتممت 10 دروس تعليمية بنجاح.',
    category: 'learning',
    bonusXp: 75,
    targetValue: 10,
    unitLabel: 'دروس',
    accentTone: 'crimson',
    iconName: 'zap',
  },
  {
    id: 'streak_3',
    title: 'انطلاقة 3 أيام',
    description: 'حافظت على سلسلة التعلم لمدة 3 أيام متتالية.',
    category: 'streak',
    bonusXp: 35,
    targetValue: 3,
    unitLabel: 'أيام',
    accentTone: 'amber',
    iconName: 'flame',
  },
  {
    id: 'streak_7',
    title: '7 Days Streak — بطل الأسبوع',
    description: 'تعلمت دون انقطاع لمدة 7 أيام متتالية.',
    category: 'streak',
    bonusXp: 80,
    targetValue: 7,
    unitLabel: 'أيام',
    accentTone: 'amber',
    iconName: 'flame',
  },
  {
    id: 'streak_14',
    title: 'التزام 14 يوماً',
    description: 'حققت سلسلة تعلم متواصلة لمدة 14 يوماً.',
    category: 'streak',
    bonusXp: 150,
    targetValue: 14,
    unitLabel: 'أيام',
    accentTone: 'navy',
    iconName: 'shield',
  },
  {
    id: 'streak_30',
    title: 'أسطورة الـ 30 يوماً',
    description: 'سلسلة تعلم استثنائية لمدة 30 يوماً متتالية.',
    category: 'streak',
    bonusXp: 300,
    targetValue: 30,
    unitLabel: 'أيام',
    accentTone: 'crimson',
    iconName: 'star',
  },
  {
    id: 'master_student',
    title: 'Master Student — الطالب المتقن',
    description: 'أتممت مساراً تعليمياً كاملاً بنسبة 100%.',
    category: 'mastery',
    bonusXp: 100,
    targetValue: 1,
    unitLabel: 'مسار',
    accentTone: 'navy',
    iconName: 'crown',
  },
  {
    id: 'project_creator',
    title: 'Project Creator — صانع المشاريع',
    description: 'أنهيت أول مشروع عملي تطبيقي بالكامل.',
    category: 'projects',
    bonusXp: 90,
    targetValue: 1,
    unitLabel: 'مشروع',
    accentTone: 'emerald',
    iconName: 'hammer',
  },
  {
    id: 'quiz_master',
    title: 'Quiz Master — متقن الاختبارات',
    description: 'اجتزت 3 اختبارات تفاعلية بنجاح.',
    category: 'quiz',
    bonusXp: 80,
    targetValue: 3,
    unitLabel: 'اختبارات',
    accentTone: 'crimson',
    iconName: 'award',
  },
  {
    id: 'smart_reviewer',
    title: 'بطل المراجعة الذكية',
    description: 'أصلحت وأتقنت 5 أسئلة من أخطائك السابقة في المراجعة الذكية.',
    category: 'quiz',
    bonusXp: 60,
    targetValue: 5,
    unitLabel: 'إتقان',
    accentTone: 'navy',
    iconName: 'brain',
  },
  {
    id: 'knowledge_collector',
    title: 'جامع المعرفة',
    description: 'أضفت 5 عناصر تعليمية إلى قائمة المفضلة للرجوع السريع.',
    category: 'learning',
    bonusXp: 30,
    targetValue: 5,
    unitLabel: 'عناصر',
    accentTone: 'amber',
    iconName: 'sparkles',
  },
  {
    id: 'skill_explorer',
    title: 'مستكشف شجرة المهارات',
    description: 'أكملت 3 مهارات متصلة داخل شجرة المهارات.',
    category: 'mastery',
    bonusXp: 85,
    targetValue: 3,
    unitLabel: 'مهارات',
    accentTone: 'emerald',
    iconName: 'compass',
  },
];

export function toLocalDateIso(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysIso(dateIso: string, deltaDays: number): string {
  const parts = dateIso.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return dateIso;
  }
  const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2] + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function getWeekKey(date = new Date()): string {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function getMonthKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function sanitizeRewardId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96) || 'item';
}

export function buildRewardKey(kind: XpActionKind, targetId: string): string {
  return sanitizeRewardId(`xp_${kind}__${targetId}`);
}

export function getFloorXpForLevel(level: number): number {
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel === 1) return 0;
  return 25 * (safeLevel - 1) * (safeLevel + 2);
}

export function getRankTitleForLevel(level: number): string {
  if (level >= 15) return 'خبير متمرس';
  if (level >= 10) return 'مطور محترف';
  if (level >= 6) return 'متعلم متقدم';
  if (level >= 3) return 'باحث نشط';
  return 'مبتدئ طموح';
}

export function getLevelProgress(totalXpInput: number): LevelProgressSummary {
  const totalXp = Math.max(0, Math.floor(totalXpInput || 0));
  let level = 1;
  while (getFloorXpForLevel(level + 1) <= totalXp && level < 99) {
    level += 1;
  }
  const currentLevelFloorXp = getFloorXpForLevel(level);
  const nextLevelXp = getFloorXpForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelFloorXp);
  const xpIntoCurrentLevel = Math.max(0, totalXp - currentLevelFloorXp);
  const xpNeededForNextLevel = Math.max(0, nextLevelXp - totalXp);
  const progressPercent = Math.min(100, Math.round((xpIntoCurrentLevel / span) * 100));

  return {
    level,
    totalXp,
    currentLevelFloorXp,
    nextLevelXp,
    xpIntoCurrentLevel,
    xpNeededForNextLevel,
    progressPercent,
    rankTitle: getRankTitleForLevel(level),
  };
}

export function createInitialGamificationProfile(
  ownerId = 'local',
  now = new Date()
): GamificationProfileState {
  return {
    id: 'profile',
    ownerId,
    totalXp: 0,
    weeklyXp: 0,
    monthlyXp: 0,
    weekKey: getWeekKey(now),
    monthKey: getMonthKey(now),
    level: 1,
    currentStreak: 0,
    longestStreak: 0,
    lastActiveDate: '',
    unlockedBadgeIds: [],
    badgeUnlockedAt: {},
    totalVideosWatched: 0,
    totalQuizzesPassed: 0,
    totalReviewsCompleted: 0,
    updatedAt: now.toISOString(),
  };
}

export function applyXpGrant(params: {
  profile: GamificationProfileState;
  transactions: XpTransaction[];
  actionKind: XpActionKind;
  targetId: string;
  points: number;
  title: string;
  detail?: string;
  relatedId?: string;
  now?: Date;
}): {
  granted: boolean;
  transaction: XpTransaction | null;
  nextProfile: GamificationProfileState;
  leveledUp: boolean;
  previousLevel: number;
  newLevel: number;
} {
  const now = params.now || new Date();
  const rewardKey = buildRewardKey(params.actionKind, params.targetId);
  const alreadyClaimed = params.transactions.some(
    (t) => t.id === rewardKey || t.rewardKey === rewardKey
  );
  if (alreadyClaimed || params.points <= 0) {
    return {
      granted: false,
      transaction: null,
      nextProfile: params.profile,
      leveledUp: false,
      previousLevel: params.profile.level,
      newLevel: params.profile.level,
    };
  }

  const currentWeekKey = getWeekKey(now);
  const currentMonthKey = getMonthKey(now);
  const dateIso = toLocalDateIso(now);
  const points = Math.max(1, Math.round(params.points));

  const baseWeeklyXp = params.profile.weekKey === currentWeekKey ? params.profile.weeklyXp : 0;
  const baseMonthlyXp = params.profile.monthKey === currentMonthKey ? params.profile.monthlyXp : 0;

  const nextTotalXp = params.profile.totalXp + points;
  const prevLevelSummary = getLevelProgress(params.profile.totalXp);
  const nextLevelSummary = getLevelProgress(nextTotalXp);

  const tx: XpTransaction = {
    id: rewardKey,
    ownerId: params.profile.ownerId,
    rewardKey,
    actionKind: params.actionKind,
    points,
    title: params.title.slice(0, 160),
    detail: (params.detail || '').slice(0, 300),
    relatedId: (params.relatedId || params.targetId).slice(0, 128),
    dateIso,
    createdAt: now.toISOString(),
  };

  const nextProfile: GamificationProfileState = {
    ...params.profile,
    totalXp: nextTotalXp,
    weeklyXp: baseWeeklyXp + points,
    monthlyXp: baseMonthlyXp + points,
    weekKey: currentWeekKey,
    monthKey: currentMonthKey,
    level: nextLevelSummary.level,
    lastActiveDate:
      !params.profile.lastActiveDate || dateIso > params.profile.lastActiveDate
        ? dateIso
        : params.profile.lastActiveDate,
    totalVideosWatched:
      params.profile.totalVideosWatched + (params.actionKind === 'video_watch' ? 1 : 0),
    totalQuizzesPassed:
      params.profile.totalQuizzesPassed + (params.actionKind === 'quiz_pass' ? 1 : 0),
    totalReviewsCompleted:
      params.profile.totalReviewsCompleted + (params.actionKind === 'review_mastery' ? 1 : 0),
    updatedAt: now.toISOString(),
  };

  return {
    granted: true,
    transaction: tx,
    nextProfile,
    leveledUp: nextLevelSummary.level > prevLevelSummary.level,
    previousLevel: prevLevelSummary.level,
    newLevel: nextLevelSummary.level,
  };
}

export function evaluateStreak(params: {
  activities: DailyActivityRecord[];
  transactions: XpTransaction[];
  steps: VideoStep[];
  previousLongestStreak?: number;
  todayIso?: string;
}): StreakEvaluationResult {
  const todayIso = params.todayIso || toLocalDateIso(new Date());
  const dateSet = new Set<string>();

  for (const act of params.activities) {
    if (
      act.dateIso &&
      (act.minutesLearned > 0 ||
        act.videosWatched > 0 ||
        act.lessonsCompleted > 0 ||
        act.tasksCompleted > 0 ||
        act.quizzesCompleted > 0 ||
        act.reviewsCompleted > 0 ||
        act.xpEarned > 0)
    ) {
      dateSet.add(act.dateIso.slice(0, 10));
    }
  }

  for (const step of params.steps) {
    if (step.completed && step.completedAt) {
      dateSet.add(step.completedAt.slice(0, 10));
    }
  }

  for (const tx of params.transactions) {
    if (tx.dateIso) {
      dateSet.add(tx.dateIso.slice(0, 10));
    }
  }

  const yesterdayIso = addDaysIso(todayIso, -1);
  let cursor = dateSet.has(todayIso)
    ? todayIso
    : dateSet.has(yesterdayIso)
      ? yesterdayIso
      : '';

  let currentStreak = 0;
  while (cursor && dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysIso(cursor, -1);
  }

  const sortedDates = Array.from(dateSet).sort();
  let historicalMax = 0;
  let running = 0;
  let prev = '';
  for (const d of sortedDates) {
    if (prev && addDaysIso(prev, 1) === d) {
      running += 1;
    } else {
      running = 1;
    }
    if (running > historicalMax) historicalMax = running;
    prev = d;
  }

  const prevBest = Math.max(0, params.previousLongestStreak || 0);
  const longestStreak = Math.max(prevBest, currentStreak, historicalMax);
  const isNewRecord = currentStreak > 0 && currentStreak > prevBest;

  const claimedKeys = new Set(params.transactions.map((t) => t.rewardKey));
  const newlyReachedMilestones = STREAK_MILESTONES.filter(
    (m) =>
      currentStreak >= m.days &&
      !claimedKeys.has(buildRewardKey('streak_milestone', `days_${m.days}`))
  );

  return {
    currentStreak,
    longestStreak,
    isNewRecord,
    newlyReachedMilestones,
    activeDatesSet: sortedDates,
  };
}

export interface BadgeEvaluationMetrics {
  completedLessonsCount: number;
  longestStreak: number;
  currentStreak: number;
  completedPathsCount: number;
  completedProjectsCount: number;
  passedQuizzesCount: number;
  masteredReviewsCount: number;
  favoritesCount: number;
  completedSkillsCount: number;
}

export function evaluateBadges(params: {
  metrics: BadgeEvaluationMetrics;
  unlockedBadgeIds: string[];
  badgeUnlockedAt: Record<string, string>;
  nowIso?: string;
}): {
  statuses: EvaluatedBadgeStatus[];
  newlyUnlocked: AchievementBadgeDef[];
  nextUnlockedIds: string[];
  nextBadgeUnlockedAt: Record<string, string>;
} {
  const nowIso = params.nowIso || new Date().toISOString();
  const alreadySet = new Set(params.unlockedBadgeIds);
  const nextUnlockedAt = { ...params.badgeUnlockedAt };
  const newlyUnlocked: AchievementBadgeDef[] = [];

  const getMetricValue = (badgeId: string): number => {
    switch (badgeId) {
      case 'first_lesson':
      case 'fast_learner':
        return params.metrics.completedLessonsCount;
      case 'streak_3':
      case 'streak_7':
      case 'streak_14':
      case 'streak_30':
        return Math.max(params.metrics.longestStreak, params.metrics.currentStreak);
      case 'master_student':
        return params.metrics.completedPathsCount;
      case 'project_creator':
        return params.metrics.completedProjectsCount;
      case 'quiz_master':
        return params.metrics.passedQuizzesCount;
      case 'smart_reviewer':
        return params.metrics.masteredReviewsCount;
      case 'knowledge_collector':
        return params.metrics.favoritesCount;
      case 'skill_explorer':
        return params.metrics.completedSkillsCount;
      default:
        return 0;
    }
  };

  const statuses: EvaluatedBadgeStatus[] = ACHIEVEMENT_BADGES.map((badge) => {
    const currentValue = Math.max(0, getMetricValue(badge.id));
    const wasUnlocked = alreadySet.has(badge.id);
    const meetsTarget = currentValue >= badge.targetValue;
    const unlocked = wasUnlocked || meetsTarget;

    if (meetsTarget && !wasUnlocked) {
      alreadySet.add(badge.id);
      nextUnlockedAt[badge.id] = nowIso;
      newlyUnlocked.push(badge);
    } else if (unlocked && !nextUnlockedAt[badge.id]) {
      nextUnlockedAt[badge.id] = nowIso;
    }

    const progressPercent = unlocked
      ? 100
      : Math.min(99, Math.round((currentValue / Math.max(1, badge.targetValue)) * 100));

    return {
      badge,
      unlocked,
      unlockedAt: nextUnlockedAt[badge.id] || '',
      currentValue: Math.min(currentValue, badge.targetValue),
      progressPercent,
    };
  });

  return {
    statuses,
    newlyUnlocked,
    nextUnlockedIds: Array.from(alreadySet),
    nextBadgeUnlockedAt: nextUnlockedAt,
  };
}

export interface ActivityChartBucket {
  key: string;
  label: string;
  minutesLearned: number;
  xpEarned: number;
  actionsCount: number;
}

export interface LearningStatisticsSummary {
  totalHours: number;
  totalMinutes: number;
  completedVideosCount: number;
  totalVideosCount: number;
  completedPathsCount: number;
  totalPathsCount: number;
  completedTasksCount: number;
  completedCoursesCount: number;
  overallCompletionPercent: number;
  perPathProgress: Array<{
    pathId: string;
    title: string;
    completed: number;
    total: number;
    percentage: number;
  }>;
  dailyBuckets: ActivityChartBucket[];
  weeklyBuckets: ActivityChartBucket[];
  monthlyBuckets: ActivityChartBucket[];
}

export function aggregateLearningStats(params: {
  paths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  todos: TodoTask[];
  courses: CourseItem[];
  activities: DailyActivityRecord[];
  todayIso?: string;
}): LearningStatisticsSummary {
  const todayIso = params.todayIso || toLocalDateIso(new Date());
  const allSteps = params.paths.flatMap((p) => params.stepsByPath[p.id] || []);
  const completedSteps = allSteps.filter((s) => s.completed);

  const perPathProgress = params.paths.map((p) => {
    const pSteps = params.stepsByPath[p.id] || [];
    const total = pSteps.length;
    const completed = pSteps.filter((s) => s.completed).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { pathId: p.id, title: p.title, completed, total, percentage };
  });

  const completedPathsCount = perPathProgress.filter(
    (p) => p.total > 0 && p.completed === p.total
  ).length;
  const completedTasksCount = params.todos.filter((t) => t.completed).length;
  const completedCoursesCount = params.courses.filter((c) => c.status === 'completed').length;

  const overallCompletionPercent =
    allSteps.length > 0 ? Math.round((completedSteps.length / allSteps.length) * 100) : 0;

  const activityMinutes = params.activities.reduce(
    (sum, a) => sum + Math.max(0, a.minutesLearned || 0),
    0
  );
  // Real derived fallback if user completed steps before dailyActivities started tracking
  const stepDerivedMinutes = completedSteps.length * 18;
  const totalMinutes = Math.max(activityMinutes, stepDerivedMinutes);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  const actByDate = new Map<string, DailyActivityRecord>();
  for (const act of params.activities) {
    actByDate.set(act.dateIso.slice(0, 10), act);
  }

  // Last 14 days
  const dailyBuckets: ActivityChartBucket[] = [];
  for (let offset = -13; offset <= 0; offset += 1) {
    const dIso = addDaysIso(todayIso, offset);
    const act = actByDate.get(dIso);
    const stepMatches = completedSteps.filter(
      (s) => s.completedAt && s.completedAt.slice(0, 10) === dIso
    ).length;
    const minutes = act ? act.minutesLearned : stepMatches * 18;
    const actionsCount = act
      ? act.videosWatched + act.lessonsCompleted + act.tasksCompleted + act.quizzesCompleted
      : stepMatches;
    dailyBuckets.push({
      key: dIso,
      label: dIso.slice(5),
      minutesLearned: minutes,
      xpEarned: act ? act.xpEarned : stepMatches * XP_REWARDS.lesson_complete,
      actionsCount,
    });
  }

  // Last 6 weeks
  const weeklyBuckets: ActivityChartBucket[] = [];
  for (let wOffset = -5; wOffset <= 0; wOffset += 1) {
    const endIso = addDaysIso(todayIso, wOffset * 7);
    const startIso = addDaysIso(endIso, -6);
    let mins = 0;
    let xp = 0;
    let actions = 0;
    for (const act of params.activities) {
      if (act.dateIso >= startIso && act.dateIso <= endIso) {
        mins += act.minutesLearned;
        xp += act.xpEarned;
        actions +=
          act.videosWatched + act.lessonsCompleted + act.tasksCompleted + act.quizzesCompleted;
      }
    }
    weeklyBuckets.push({
      key: `${startIso}_${endIso}`,
      label: `${startIso.slice(5)}`,
      minutesLearned: mins,
      xpEarned: xp,
      actionsCount: actions,
    });
  }

  // Last 6 months
  const monthlyBuckets: ActivityChartBucket[] = [];
  const baseDate = new Date(`${todayIso}T00:00:00Z`);
  for (let mOffset = -5; mOffset <= 0; mOffset += 1) {
    const d = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + mOffset, 1));
    const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    let mins = 0;
    let xp = 0;
    let actions = 0;
    for (const act of params.activities) {
      if (act.dateIso.startsWith(mKey)) {
        mins += act.minutesLearned;
        xp += act.xpEarned;
        actions +=
          act.videosWatched + act.lessonsCompleted + act.tasksCompleted + act.quizzesCompleted;
      }
    }
    monthlyBuckets.push({
      key: mKey,
      label: mKey,
      minutesLearned: mins,
      xpEarned: xp,
      actionsCount: actions,
    });
  }

  return {
    totalHours,
    totalMinutes,
    completedVideosCount: completedSteps.length,
    totalVideosCount: allSteps.length,
    completedPathsCount,
    totalPathsCount: params.paths.length,
    completedTasksCount,
    completedCoursesCount,
    overallCompletionPercent,
    perPathProgress,
    dailyBuckets,
    weeklyBuckets,
    monthlyBuckets,
  };
}
