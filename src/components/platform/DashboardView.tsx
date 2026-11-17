import {
  ArrowLeft,
  Award,
  BarChart3,
  Brain,
  CheckCircle2,
  CheckSquare,
  Flame,
  FolderKanban,
  GitBranch,
  Heart,
  Play,
  Route,
  Sparkles,
  Trophy,
} from 'lucide-react';
import type { LearningPath, PathProgress, VideoStep } from '../../types/learning';
import type {
  EvaluatedBadgeStatus,
  LeaderboardEntry,
  LevelProgressSummary,
  PracticalProject,
} from '../../types/platform';
import type { AppSection, TodoTask } from '../../types/workspace';
import type { LearningStatisticsSummary } from '../../utils/gamificationLogic';
import { SectionHeroBanner } from '../SectionHeroBanner';

interface DashboardViewProps {
  userName: string;
  userUid: string;
  levelSummary: LevelProgressSummary;
  currentStreak: number;
  longestStreak: number;
  todos: TodoTask[];
  paths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  pathProgressMap: Record<string, PathProgress>;
  statsSummary: LearningStatisticsSummary;
  badges: EvaluatedBadgeStatus[];
  leaderboardEntries: LeaderboardEntry[];
  practicalProjects: PracticalProject[];
  pendingReviewCount: number;
  favoritesCount: number;
  onToggleTodo: (task: TodoTask) => void;
  onSelectPath: (pathId: string) => void;
  onNavigateSection: (section: AppSection) => void;
}

export function DashboardView({
  userName,
  userUid,
  levelSummary,
  currentStreak,
  longestStreak,
  todos,
  paths,
  stepsByPath,
  pathProgressMap,
  statsSummary,
  badges,
  leaderboardEntries,
  practicalProjects,
  pendingReviewCount,
  favoritesCount,
  onToggleTodo,
  onSelectPath,
  onNavigateSection,
}: DashboardViewProps) {
  const pendingTodos = todos.filter((t) => !t.completed).slice(0, 4);
  const recentPaths = paths.slice(0, 4);
  const earnedBadges = badges.filter((b) => b.unlocked).slice(0, 4);

  const sortedBoard = [...leaderboardEntries].sort(
    (a, b) => b.totalXp - a.totalXp || b.level - a.level
  );
  const userRankIndex = sortedBoard.findIndex((e) => e.uid === userUid);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : 1;

  const activeProjects = practicalProjects
    .filter((p) => p.status !== 'completed')
    .slice(0, 3);
  const last7Daily = statsSummary.dailyBuckets.slice(-7);
  const weeklyMinutes = last7Daily.reduce((s, d) => s + d.minutesLearned, 0);
  const weeklyXp = last7Daily.reduce((s, d) => s + d.xpEarned, 0);

  return (
    <div data-testid="dashboard-view" className="space-y-6">
      {/* Main Hero Overview with Level, XP Bar & Overall Completion */}
      <SectionHeroBanner
        testId="dashboard-hero"
        kicker={
          <span>
            أهلاً {userName} · المستوى {levelSummary.level} ({levelSummary.rankTitle})
          </span>
        }
        title="لوحة التحكم الرئيسية — مركز رحلتك التعليمية"
        description="تابع مستواك، نقاط الخبرة، سلسلة أيام التعلم المتواصلة، مهام اليوم، ومساراتك ومشاريعك العملية من مكان واحد."
        progress={{
          label: `التقدم نحو المستوى ${levelSummary.level + 1} (${levelSummary.xpIntoCurrentLevel} / ${levelSummary.xpIntoCurrentLevel + levelSummary.xpNeededForNextLevel} XP)`,
          percentage: levelSummary.progressPercent,
        }}
        actions={[
          {
            id: 'go-path',
            label: 'متابعة المسار التعليمي',
            icon: <Play className="w-4 h-4" aria-hidden="true" />,
            onClick: () => onNavigateSection('path'),
            tone: 'crimson',
          },
          {
            id: 'go-skills',
            label: 'شجرة المهارات',
            icon: <GitBranch className="w-4 h-4" aria-hidden="true" />,
            onClick: () => onNavigateSection('skills'),
            tone: 'emerald',
          },
          {
            id: 'go-projects',
            label: 'المشاريع العملية',
            icon: <FolderKanban className="w-4 h-4" aria-hidden="true" />,
            onClick: () => onNavigateSection('projects'),
            tone: 'amber',
          },
          {
            id: 'go-stats',
            label: 'الإحصائيات والشهادات',
            icon: <BarChart3 className="w-4 h-4" aria-hidden="true" />,
            onClick: () => onNavigateSection('stats'),
            tone: 'light',
          },
        ]}
      />

      {/* Row 1: Core Gamification KPI Strip (Level, XP, Streak, Overall %, Leaderboard Rank) */}
      <section aria-label="ملخص التقدم والمستوى" className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>المستوى الحالي</span>
            <Trophy className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#062D4C] dark:text-white mt-1 tabular-nums">
            المستوى {levelSummary.level}
          </p>
          <p className="text-xs font-bold text-[#B92622] dark:text-amber-300 mt-0.5">
            {levelSummary.rankTitle}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>نقاط الخبرة (XP)</span>
            <Sparkles className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p
            data-testid="dashboard-total-xp"
            className="text-2xl font-black text-[#15803D] dark:text-emerald-400 mt-1 tabular-nums"
          >
            {levelSummary.totalXp} XP
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            متبقي {levelSummary.xpNeededForNextLevel} للمستوى التالي
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>أيام التعلم المتتالية</span>
            <Flame className="w-4 h-4 text-orange-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-orange-600 dark:text-amber-300 mt-1 tabular-nums">
            {currentStreak} يوم
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            أطول سلسلة: {longestStreak} يوم
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>نسبة الإنجاز الكلية</span>
            <CheckCircle2 className="w-4 h-4 text-[#062D4C] dark:text-sky-400" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#062D4C] dark:text-white mt-1 tabular-nums">
            {statsSummary.overallCompletionPercent}%
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {statsSummary.completedVideosCount} من {statsSummary.totalVideosCount} درساً
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigateSection('leaderboard')}
          className="col-span-2 lg:col-span-1 text-right rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] cursor-pointer transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>ترتيبك في المتصدرين</span>
            <Trophy className="w-4 h-4 text-[#B92622]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#B92622] dark:text-rose-400 mt-1 tabular-nums">
            #{userRank}
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            من أصل {sortedBoard.length} متعلم
          </p>
        </button>
      </section>

      {/* Row 2: Learning Paths + Today's Tasks */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Learning Paths (7 cols) */}
        <div className="lg:col-span-7 rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-[#B92622]" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-black text-[#062D4C] dark:text-white">
                آخر المسارات التعليمية
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('path')}
              className="text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>كل المسارات</span>
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentPaths.map((path) => {
              const pProg = pathProgressMap[path.id];
              const pSteps = stepsByPath[path.id] || [];
              const pct = pProg?.percentage ?? 0;
              return (
                <button
                  key={path.id}
                  type="button"
                  onClick={() => {
                    onSelectPath(path.id);
                    onNavigateSection('path');
                  }}
                  className="text-right rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C] dark:hover:border-sky-400 bg-slate-50/70 dark:bg-slate-950 p-3.5 space-y-2 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-black text-[#062D4C] dark:text-white line-clamp-1">
                      {path.title}
                    </h3>
                    <span className="text-xs font-black text-[#15803D] dark:text-emerald-400 tabular-nums shrink-0">
                      {pct}%
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 line-clamp-1">
                    {pSteps.filter((s) => s.completed).length} مكتمل من {pSteps.length} فيديو
                  </p>
                  <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-[#15803D] rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Today's Tasks (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
              <h2 className="text-base sm:text-lg font-black text-[#062D4C] dark:text-white">
                مهام اليوم ({pendingTodos.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('todos')}
              className="text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>قائمة المهام</span>
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          {pendingTodos.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center space-y-1">
              <p className="text-sm font-black text-[#062D4C] dark:text-white">
                لا توجد مهام معلقة حالياً
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                أضف مهام جديدة وربطها بمساراتك لتحصد نقاط XP إضافية.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pendingTodos.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => onToggleTodo(task)}
                    aria-label={`تحديد المهمة ${task.title}`}
                    className="w-4 h-4 accent-[#15803D] cursor-pointer shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-[#062D4C] dark:text-white truncate">
                      {task.title}
                    </p>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                      {task.link?.label || (task.dueDate ? `موعد: ${task.dueDate}` : 'مهمة سريعة')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Row 3: Weekly Learning Stats + Active Practical Projects + Latest Earned Badges */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Weekly Learning Stats */}
        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-[#062D4C] dark:text-sky-400" aria-hidden="true" />
              <h2 className="text-base font-black text-[#062D4C] dark:text-white">
                ملخص التعلم الأسبوعي
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('stats')}
              className="text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline cursor-pointer"
            >
              التفاصيل
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
            <span>{weeklyMinutes} دقيقة تعلم</span>
            <span>+{weeklyXp} XP هذا الأسبوع</span>
          </div>

          <div className="h-24 flex items-end gap-1.5 pt-2">
            {last7Daily.map((d) => {
              const maxVal = Math.max(20, ...last7Daily.map((x) => x.minutesLearned));
              const hPct = Math.max(8, Math.round((d.minutesLearned / maxVal) * 100));
              return (
                <div key={d.key} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    title={`${d.label}: ${d.minutesLearned} دقيقة`}
                    className="w-full rounded-t-md bg-[#062D4C] dark:bg-sky-500 transition-all"
                    style={{ height: `${hPct}%` }}
                  />
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    {d.label.slice(3)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Practical Projects */}
        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-[#B92622]" aria-hidden="true" />
              <h2 className="text-base font-black text-[#062D4C] dark:text-white">
                المشاريع العملية الحالية
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('projects')}
              className="text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline cursor-pointer"
            >
              الكل ({practicalProjects.length})
            </button>
          </div>

          {activeProjects.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-4 text-center space-y-1.5">
              <p className="text-xs font-black text-[#062D4C] dark:text-white">
                كل مشاريعك الحالية مكتملة أو لم تبدأ مشروعاً جديداً
              </p>
              <button
                type="button"
                onClick={() => onNavigateSection('projects')}
                className="text-xs font-extrabold text-[#B92622] dark:text-amber-300 hover:underline cursor-pointer"
              >
                فتح المشاريع العملية
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeProjects.map((proj) => {
                const done = proj.stages.filter((s) => s.completed).length;
                const total = proj.stages.length;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => onNavigateSection('projects')}
                    className="w-full text-right rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#062D4C] bg-slate-50 dark:bg-slate-950 p-3 space-y-1 cursor-pointer"
                  >
                    <p className="text-xs font-black text-[#062D4C] dark:text-white truncate">
                      {proj.title}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {proj.status === 'in_progress' ? 'قيد التنفيذ' : 'لم يبدأ'} · {done}/{total} مراحل · +{proj.xpReward} XP
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Latest Earned Badges + Quick Shortcuts */}
        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-600" aria-hidden="true" />
              <h2 className="text-base font-black text-[#062D4C] dark:text-white">
                أحدث الشارات ({badges.filter((b) => b.unlocked).length}/{badges.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateSection('achievements')}
              className="text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline cursor-pointer"
            >
              جميع الشارات
            </button>
          </div>

          {earnedBadges.length === 0 ? (
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 leading-relaxed">
              أكمل أول درس فيديو أو اجتز اختباراً لتفتح شارتك الأولى وتحصل على مكافأة XP فورية.
            </p>
          ) : (
            <div className="space-y-2">
              {earnedBadges.map((b) => (
                <div
                  key={b.badge.id}
                  className="rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2 flex items-center justify-between gap-2"
                >
                  <span className="text-xs font-black text-[#062D4C] dark:text-amber-200 truncate">
                    {b.badge.title}
                  </span>
                  <span className="text-[11px] font-black text-[#15803D] dark:text-emerald-400 tabular-nums shrink-0">
                    +{b.badge.bonusXp} XP
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onNavigateSection('review')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-2 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 cursor-pointer tabular-nums"
            >
              <Brain className="w-3.5 h-3.5 text-[#B92622]" aria-hidden="true" />
              <span>المراجعة ({pendingReviewCount})</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigateSection('favorites')}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 px-2.5 py-2 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 cursor-pointer tabular-nums"
            >
              <Heart className="w-3.5 h-3.5 text-[#B92622]" aria-hidden="true" />
              <span>المفضلة ({favoritesCount})</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
