import { Award, Bell, CheckCircle2, Flame, FolderKanban, Sparkles, Trophy, X } from 'lucide-react';
import type { CelebrationAlert } from '../../hooks/usePlatformGamification';
import type { AppSection } from '../../types/workspace';

interface CelebrationBannerProps {
  celebration: CelebrationAlert | null;
  onDismiss: () => void;
  onOpenSection: (section: AppSection) => void;
}

const KIND_STYLES = {
  xp: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-[0_4px_0_#15803D]',
  level_up: 'bg-amber-50 dark:bg-amber-950/90 border-amber-600 text-amber-950 dark:text-amber-100 shadow-[0_4px_0_#B45309]',
  badge: 'bg-white dark:bg-slate-900 border-[#062D4C] text-[#062D4C] dark:text-white shadow-[0_4px_0_#062D4C]',
  streak: 'bg-orange-50 dark:bg-orange-950/90 border-orange-600 text-orange-950 dark:text-orange-100 shadow-[0_4px_0_#C2410C]',
  quiz: 'bg-blue-50 dark:bg-blue-950/90 border-blue-700 text-blue-950 dark:text-blue-100 shadow-[0_4px_0_#1D4ED8]',
  project: 'bg-emerald-50 dark:bg-emerald-950/90 border-emerald-700 text-emerald-950 dark:text-emerald-100 shadow-[0_4px_0_#15803D]',
  certificate: 'bg-white dark:bg-slate-900 border-[#B92622] text-[#062D4C] dark:text-white shadow-[0_4px_0_#B92622]',
  leaderboard: 'bg-amber-50 dark:bg-amber-950/90 border-amber-600 text-amber-950 dark:text-amber-100 shadow-[0_4px_0_#D97706]',
} as const;

export function CelebrationBanner({
  celebration,
  onDismiss,
  onOpenSection,
}: CelebrationBannerProps) {
  if (!celebration) return null;

  const Icon =
    celebration.kind === 'streak'
      ? Flame
      : celebration.kind === 'certificate' || celebration.kind === 'badge'
        ? Award
        : celebration.kind === 'level_up' || celebration.kind === 'leaderboard'
          ? Trophy
          : celebration.kind === 'project'
            ? FolderKanban
            : celebration.kind === 'quiz'
              ? CheckCircle2
              : celebration.kind === 'xp'
                ? Sparkles
                : Bell;

  return (
    <div
      role="status"
      data-testid="celebration-banner"
      className={`animate-masar-pop rounded-2xl border-2 px-4 py-3 flex flex-wrap items-center justify-between gap-3 ${KIND_STYLES[celebration.kind]}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="w-9 h-9 rounded-xl bg-[#062D4C] text-white flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-amber-300" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black">{celebration.title}</p>
            {typeof celebration.xpDelta === 'number' && celebration.xpDelta > 0 && (
              <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-[#15803D] text-white tabular-nums">
                +{celebration.xpDelta} XP
              </span>
            )}
          </div>
          <p className="text-xs font-semibold opacity-85 truncate sm:whitespace-normal">
            {celebration.message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {celebration.targetSection && (
          <button
            type="button"
            onClick={() => {
              onOpenSection(celebration.targetSection as AppSection);
              onDismiss();
            }}
            className="px-3 py-1.5 rounded-lg border-2 border-[#062D4C] bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-100 text-xs font-extrabold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
          >
            عرض التفاصيل
          </button>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="إغلاق الإشعار الاحتفالي"
          className="p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
