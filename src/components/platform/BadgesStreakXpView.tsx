import { useState } from 'react';
import { Award, CheckCircle2, Flame, Lock, Sparkles, Trophy } from 'lucide-react';
import type {
  CertificateRecord,
  EvaluatedBadgeStatus,
  LevelProgressSummary,
  StreakEvaluationResult,
  XpTransaction,
} from '../../types/platform';
import { addDaysIso, STREAK_MILESTONES, toLocalDateIso } from '../../utils/gamificationLogic';
import { SectionHeroBanner } from '../SectionHeroBanner';
import { CertificatesView } from './CertificatesView';

interface BadgesStreakXpViewProps {
  levelSummary: LevelProgressSummary;
  streakResult: StreakEvaluationResult;
  badges: EvaluatedBadgeStatus[];
  transactions: XpTransaction[];
  certificates: CertificateRecord[];
  onVerifyCertificate: (code: string) => Promise<{
    found: boolean;
    verificationCode: string;
    recipientName: string;
    pathTitle: string;
    lessonsCount: number;
    completedAt: string;
  } | null>;
}

type AchievementsTab = 'badges' | 'certificates' | 'streak' | 'xp';

export function BadgesStreakXpView({
  levelSummary,
  streakResult,
  badges,
  transactions,
  certificates,
  onVerifyCertificate,
}: BadgesStreakXpViewProps) {
  const [activeTab, setActiveTab] = useState<AchievementsTab>('badges');

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const activeSet = new Set(streakResult.activeDatesSet);
  const todayIso = toLocalDateIso(new Date());
  const calendarDays = Array.from({ length: 35 }, (_, idx) => {
    const dIso = addDaysIso(todayIso, idx - 34);
    return {
      dateIso: dIso,
      active: activeSet.has(dIso),
      isToday: dIso === todayIso,
    };
  });

  return (
    <div data-testid="achievements-view" className="space-y-6">
      <SectionHeroBanner
        testId="achievements-hero"
        kicker={
          <span>
            المستوى {levelSummary.level} ({levelSummary.rankTitle}) · {unlockedCount} من{' '}
            {badges.length} شارة · {certificates.length} شهادة
          </span>
        }
        title="الإنجازات، الشهادات، وسلسلة التعلم"
        description="احصد نقاط الخبرة، حافظ على سلسلة تعلم يومية متواصلة، افتح شارات الإنجاز الـ 12، واحصل على شهادات إتمام رسمية عند إنهاء كل مسار."
        progress={{
          label: `نقاط الخبرة: ${levelSummary.totalXp} XP · متبقي ${levelSummary.xpNeededForNextLevel} للمستوى ${levelSummary.level + 1}`,
          percentage: levelSummary.progressPercent,
        }}
        bottomExtra={
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'badges', label: `الشارات (${unlockedCount}/${badges.length})` },
                { id: 'certificates', label: `الشهادات (${certificates.length})` },
                { id: 'streak', label: `السلسلة (${streakResult.currentStreak} يوم)` },
                { id: 'xp', label: `سجل الخبرة (${transactions.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                data-testid={`achievements-tab-${t.id}`}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer transition-colors ${
                  activeTab === t.id
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-100 border-[#062D4C]/40 dark:border-slate-600'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {activeTab === 'badges' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {badges.map((item) => (
            <article
              key={item.badge.id}
              data-testid={`badge-card-${item.badge.id}`}
              className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 ${
                item.unlocked
                  ? 'border-[#15803D] bg-emerald-50/70 dark:bg-emerald-950/35 shadow-[0_4px_0_#15803D]'
                  : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 opacity-90'
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black ${
                      item.unlocked
                        ? 'bg-[#15803D] text-white'
                        : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {item.unlocked ? (
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <Lock className="w-3 h-3" aria-hidden="true" />
                    )}
                    <span>{item.unlocked ? 'مفتوحة' : 'مغلقة'}</span>
                  </span>
                  <span className="text-xs font-black text-[#B92622] dark:text-amber-300 tabular-nums">
                    +{item.badge.bonusXp} XP
                  </span>
                </div>

                <h3 className="text-sm sm:text-base font-black text-[#062D4C] dark:text-white">
                  {item.badge.title}
                </h3>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  {item.badge.description}
                </p>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-extrabold tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">
                    {item.currentValue} / {item.badge.targetValue} {item.badge.unitLabel}
                  </span>
                  <span className="text-[#15803D] dark:text-emerald-400">
                    {item.progressPercent}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      item.unlocked ? 'bg-[#15803D]' : 'bg-[#062D4C] dark:bg-sky-500'
                    }`}
                    style={{ width: `${item.progressPercent}%` }}
                  />
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === 'certificates' && (
        <CertificatesView certificates={certificates} onVerifyCode={onVerifyCertificate} />
      )}

      {activeTab === 'streak' && (
        <section className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C]">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
                <span>السلسلة الحالية</span>
                <Flame className="w-5 h-5 text-orange-600" aria-hidden="true" />
              </div>
              <p className="text-3xl font-black text-orange-600 dark:text-amber-300 mt-1 tabular-nums">
                {streakResult.currentStreak} يوم
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C]">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
                <span>أطول سلسلة قياسية</span>
                <Trophy className="w-5 h-5 text-amber-600" aria-hidden="true" />
              </div>
              <p className="text-3xl font-black text-[#062D4C] dark:text-white mt-1 tabular-nums">
                {streakResult.longestStreak} يوم
              </p>
            </div>
            <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C]">
              <div className="flex items-center justify-between text-xs font-extrabold text-slate-500 dark:text-slate-400">
                <span>إجمالي أيام النشاط</span>
                <Award className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
              </div>
              <p className="text-3xl font-black text-[#15803D] dark:text-emerald-400 mt-1 tabular-nums">
                {streakResult.activeDatesSet.length} يوم
              </p>
            </div>
          </div>

          {/* 35-Day Visual Activity Calendar */}
          <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] space-y-4">
            <h3 className="text-base font-black text-[#062D4C] dark:text-white">
              تقويم النشاط اليومي (آخر 35 يوماً)
            </h3>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day) => (
                <div
                  key={day.dateIso}
                  title={`${day.dateIso}: ${day.active ? 'نشط' : 'بلا نشاط'}`}
                  className={`rounded-xl border p-2 text-center text-[11px] font-bold tabular-nums ${
                    day.active
                      ? 'bg-[#15803D] border-[#15803D] text-white'
                      : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
                  } ${day.isToday ? 'ring-2 ring-[#B92622]' : ''}`}
                >
                  {day.dateIso.slice(5)}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {STREAK_MILESTONES.map((m) => {
                const reached = streakResult.longestStreak >= m.days;
                return (
                  <div
                    key={m.days}
                    className={`rounded-xl border p-3 text-xs font-bold ${
                      reached
                        ? 'border-[#15803D] bg-emerald-50 dark:bg-emerald-950/30 text-[#062D4C] dark:text-emerald-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <p className="font-black">{m.title}</p>
                    <p className="tabular-nums mt-0.5">مكافأة: +{m.bonusXp} XP</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {activeTab === 'xp' && (
        <section className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
              <h3 className="text-base font-black text-[#062D4C] dark:text-white">
                سجل نقاط الخبرة (XP Ledger)
              </h3>
            </div>
            <span className="text-xs font-black text-[#15803D] dark:text-emerald-400 tabular-nums">
              الإجمالي: {levelSummary.totalXp} XP
            </span>
          </div>

          {transactions.length === 0 ? (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 py-8 text-center">
              لم تسجل عمليات XP بعد — ابدأ بمشاهدة درس أو إتمام مهمة أو اختبار.
            </p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {transactions.map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#062D4C] dark:text-white truncate">
                      {tx.title}
                    </p>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                      {tx.dateIso} {tx.detail ? `· ${tx.detail}` : ''}
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-[#15803D] dark:text-emerald-300 text-xs font-black tabular-nums shrink-0">
                    +{tx.points} XP
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
