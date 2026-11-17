import { useState } from 'react';
import { Award, BarChart3, CheckCircle2, Clock, Film, Route } from 'lucide-react';
import type { CertificateRecord } from '../../types/platform';
import type { AppSection } from '../../types/workspace';
import type { LearningStatisticsSummary } from '../../utils/gamificationLogic';
import { SectionHeroBanner } from '../SectionHeroBanner';

interface StatisticsViewProps {
  stats: LearningStatisticsSummary;
  certificates: CertificateRecord[];
  onOpenPath: (pathId: string) => void;
  onNavigateSection: (section: AppSection) => void;
}

type ChartWindow = 'daily' | 'weekly' | 'monthly';

export function StatisticsView({
  stats,
  certificates,
  onOpenPath,
  onNavigateSection,
}: StatisticsViewProps) {
  const [chartWindow, setChartWindow] = useState<ChartWindow>('daily');

  const buckets =
    chartWindow === 'daily'
      ? stats.dailyBuckets
      : chartWindow === 'weekly'
        ? stats.weeklyBuckets
        : stats.monthlyBuckets;

  const maxMinutes = Math.max(20, ...buckets.map((b) => b.minutesLearned));

  return (
    <div data-testid="statistics-view" className="space-y-6">
      <SectionHeroBanner
        testId="stats-hero"
        kicker={<span>تحليلات حقيقية مرتبطة بتقدمك الفعلي · {stats.totalHours} ساعة تعلم</span>}
        title="إحصائيات التعلم — قياس أدائك اليومي والشهري"
        description="تُحتسب جميع الساعات، الفيديوهات المكتملة، المسارات المنتهية، والمهام المنجزة تلقائياً بناءً على نشاطك الفعلي داخل المنصة."
        progress={{
          label: 'نسبة الإنجاز الإجمالية في المسارات',
          percentage: stats.overallCompletionPercent,
        }}
        actions={[
          {
            id: 'open-certs',
            label: `الشهادات المكتسبة (${certificates.length})`,
            icon: <Award className="w-4 h-4" aria-hidden="true" />,
            onClick: () => onNavigateSection('achievements'),
            tone: 'crimson',
          },
        ]}
      />

      {/* KPI Metrics Grid */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>إجمالي ساعات التعلم</span>
            <Clock className="w-4 h-4 text-[#062D4C] dark:text-sky-400" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#062D4C] dark:text-white mt-1 tabular-nums">
            {stats.totalHours} ساعة
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {stats.totalMinutes} دقيقة مسجلة
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>الفيديوهات المكتملة</span>
            <Film className="w-4 h-4 text-[#B92622]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#B92622] dark:text-rose-400 mt-1 tabular-nums">
            {stats.completedVideosCount}
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            من أصل {stats.totalVideosCount} فيديو
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>المسارات المكتملة</span>
            <Route className="w-4 h-4 text-[#15803D]" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#15803D] dark:text-emerald-400 mt-1 tabular-nums">
            {stats.completedPathsCount}
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            من أصل {stats.totalPathsCount} مسارات
          </p>
        </div>

        <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]">
          <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
            <span>المهام والاختبارات</span>
            <CheckCircle2 className="w-4 h-4 text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-2xl font-black text-[#062D4C] dark:text-white mt-1 tabular-nums">
            {stats.completedTasksCount} مهمة
          </p>
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {stats.completedCoursesCount} كورسات منتهية
          </p>
        </div>
      </section>

      {/* Interactive Activity Chart */}
      <section className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#062D4C] dark:text-sky-400" aria-hidden="true" />
            <h2 className="text-base sm:text-lg font-black text-[#062D4C] dark:text-white">
              منحنى النشاط والتقدم
            </h2>
          </div>

          <div className="inline-flex rounded-xl border-2 border-[#062D4C] dark:border-slate-600 p-0.5 bg-slate-100 dark:bg-slate-950">
            {(
              [
                { id: 'daily', label: 'يومي (14 يوماً)' },
                { id: 'weekly', label: 'أسبوعي (6 أسابيع)' },
                { id: 'monthly', label: 'شهري (6 أشهر)' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChartWindow(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                  chartWindow === tab.id
                    ? 'bg-[#062D4C] text-white'
                    : 'text-[#062D4C] dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-52 flex items-end gap-2 pt-4 pb-1 border-b-2 border-[#062D4C]/15 dark:border-slate-700">
          {buckets.map((bucket) => {
            const pct = Math.max(4, Math.round((bucket.minutesLearned / maxMinutes) * 100));
            return (
              <div
                key={bucket.key}
                className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full group"
              >
                <span className="text-[10px] font-black text-[#15803D] dark:text-emerald-400 tabular-nums opacity-80 group-hover:opacity-100">
                  {bucket.minutesLearned > 0 ? `${bucket.minutesLearned}د` : ''}
                </span>
                <div
                  title={`${bucket.label}: ${bucket.minutesLearned} دقيقة · ${bucket.xpEarned} XP`}
                  className={`w-full max-w-[38px] rounded-t-lg border border-[#062D4C]/30 transition-all ${
                    bucket.minutesLearned > 0
                      ? 'bg-gradient-to-t from-[#062D4C] to-[#1D4ED8] dark:from-sky-600 dark:to-sky-400'
                      : 'bg-slate-200 dark:bg-slate-800'
                  }`}
                  style={{ height: `${pct}%` }}
                />
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 tabular-nums truncate max-w-full">
                  {bucket.label}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Per-Path Progress Breakdown */}
      <section className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
        <h2 className="text-base sm:text-lg font-black text-[#062D4C] dark:text-white">
          نسبة الإنجاز حسب كل مسار
        </h2>
        <div className="space-y-3">
          {stats.perPathProgress.map((p) => (
            <div
              key={p.pathId}
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 p-3.5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onOpenPath(p.pathId)}
                  className="text-sm font-black text-[#062D4C] dark:text-white hover:underline cursor-pointer"
                >
                  {p.title}
                </button>
                <span className="text-xs font-black text-[#15803D] dark:text-emerald-400 tabular-nums">
                  {p.completed} / {p.total} درس ({p.percentage}%)
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[#15803D] to-emerald-400 transition-all"
                  style={{ width: `${p.percentage}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
