import { useState } from 'react';
import { Award, Flame, Trophy } from 'lucide-react';
import type { LeaderboardEntry, LeaderboardLimit, LeaderboardPeriod } from '../../types/platform';
import { SectionHeroBanner } from '../SectionHeroBanner';

interface LeaderboardViewProps {
  entries: LeaderboardEntry[];
  currentUserId: string;
}

export function LeaderboardView({ entries, currentUserId }: LeaderboardViewProps) {
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [limit, setLimit] = useState<LeaderboardLimit>(10);

  const getXpValue = (entry: LeaderboardEntry): number => {
    if (period === 'weekly') return entry.weeklyXp;
    if (period === 'monthly') return entry.monthlyXp;
    return entry.totalXp;
  };

  const sorted = [...entries].sort(
    (a, b) => getXpValue(b) - getXpValue(a) || b.totalXp - a.totalXp || b.level - a.level
  );
  const topList = sorted.slice(0, limit);
  const myIndex = sorted.findIndex((e) => e.uid === currentUserId);
  const myRank = myIndex >= 0 ? myIndex + 1 : 1;
  const myEntry = myIndex >= 0 ? sorted[myIndex] : sorted[0];

  return (
    <div data-testid="leaderboard-view" className="space-y-6">
      <SectionHeroBanner
        testId="leaderboard-hero"
        kicker={
          <span>
            الترتيب التنافسي الحقيقي · ترتيبك الحالي #{myRank} من أصل {sorted.length}
          </span>
        }
        title="لوحة المتصدرين — الترتيب والتحدي المستمر"
        description="يتحدث ترتيب المتعلمين تلقائياً مع كل نقطة خبرة تكتسبها، مع تصفية أسبوعية وشهرية وإجمالية لأفضل 10 أو 50 أو 100 متعلم."
        bottomExtra={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border-2 border-[#062D4C] dark:border-slate-600 p-0.5 bg-white dark:bg-slate-900">
              {(
                [
                  { id: 'weekly', label: 'أسبوعي' },
                  { id: 'monthly', label: 'شهري' },
                  { id: 'all_time', label: 'الإجمالي العام' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${
                    period === p.id
                      ? 'bg-[#062D4C] text-white'
                      : 'text-[#062D4C] dark:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl border-2 border-[#062D4C] dark:border-slate-600 p-0.5 bg-white dark:bg-slate-900">
              {([10, 50, 100] as const).map((lim) => (
                <button
                  key={lim}
                  type="button"
                  onClick={() => setLimit(lim)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer tabular-nums ${
                    limit === lim
                      ? 'bg-[#B92622] text-white'
                      : 'text-[#062D4C] dark:text-slate-300'
                  }`}
                >
                  أفضل {lim}
                </button>
              ))}
            </div>
          </div>
        }
      />

      {myEntry && (
        <section className="rounded-2xl border-2 border-[#B92622] bg-amber-50/60 dark:bg-slate-900 p-4 shadow-[0_4px_0_#B92622] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-[#B92622] text-white font-black text-base flex items-center justify-center tabular-nums">
              #{myRank}
            </span>
            <div>
              <p className="text-sm font-black text-[#062D4C] dark:text-white">
                موقعك الحالي: {myEntry.displayName}
              </p>
              <p className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                المستوى {myEntry.level} · سلسلة {myEntry.currentStreak} يوم · {myEntry.badgesCount} شارة
              </p>
            </div>
          </div>
          <span className="text-lg font-black text-[#15803D] dark:text-emerald-400 tabular-nums">
            {getXpValue(myEntry)} XP
          </span>
        </section>
      )}

      <section className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] overflow-hidden">
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {topList.map((entry, idx) => {
            const rank = idx + 1;
            const isMe = entry.uid === currentUserId;
            return (
              <div
                key={entry.uid}
                className={`px-4 py-3.5 flex items-center justify-between gap-3 ${
                  isMe ? 'bg-sky-50/70 dark:bg-slate-800/80' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center tabular-nums shrink-0 ${
                      rank === 1
                        ? 'bg-amber-500 text-white'
                        : rank === 2
                          ? 'bg-slate-400 text-white'
                          : rank === 3
                            ? 'bg-orange-700 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-[#062D4C] dark:text-slate-200'
                    }`}
                  >
                    {rank <= 3 ? <Trophy className="w-4 h-4" aria-hidden="true" /> : rank}
                  </span>

                  <span className="w-9 h-9 rounded-full bg-[#062D4C] text-white font-black text-sm flex items-center justify-center shrink-0">
                    {entry.avatarLetter}
                  </span>

                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#062D4C] dark:text-white truncate">
                      {entry.displayName}{' '}
                      {isMe && (
                        <span className="text-xs font-black text-[#B92622] dark:text-amber-300">
                          (أنت)
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-2 tabular-nums">
                      <span>المستوى {entry.level}</span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Flame className="w-3 h-3 text-orange-600" aria-hidden="true" />
                        {entry.currentStreak}
                      </span>
                      <span>·</span>
                      <span className="inline-flex items-center gap-0.5">
                        <Award className="w-3 h-3 text-amber-600" aria-hidden="true" />
                        {entry.badgesCount}
                      </span>
                    </p>
                  </div>
                </div>

                <span className="text-sm sm:text-base font-black text-[#15803D] dark:text-emerald-400 tabular-nums shrink-0">
                  {getXpValue(entry)} XP
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
