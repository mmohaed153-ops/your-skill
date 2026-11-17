import type { ReactNode } from 'react';

export type HeroActionTone =
  | 'crimson'
  | 'emerald'
  | 'amber'
  | 'blue'
  | 'slate'
  | 'navy'
  | 'burgundy'
  | 'light';

export interface HeroActionItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  tone?: HeroActionTone;
  disabled?: boolean;
  ariaLabel?: string;
  title?: string;
  testId?: string;
}

export interface HeroProgressConfig {
  label: string;
  percentage: number;
  ariaLabel?: string;
}

interface SectionHeroBannerProps {
  kicker?: ReactNode;
  title: string;
  description?: string;
  progress?: HeroProgressConfig;
  actions?: HeroActionItem[];
  topExtra?: ReactNode;
  bottomExtra?: ReactNode;
  testId?: string;
}

const TONE_CLASSES: Record<HeroActionTone, string> = {
  crimson:
    'bg-[#B92622] hover:bg-[#9E1E1B] text-white border-[#062D4C] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  emerald:
    'bg-[#15803D] hover:bg-[#166534] text-white border-[#062D4C] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  amber:
    'bg-[#D97706] hover:bg-[#B45309] text-white border-[#062D4C] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  blue:
    'bg-[#1D4ED8] hover:bg-[#1E40AF] text-white border-[#062D4C] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  slate:
    'bg-[#1E293B] hover:bg-[#0F172A] text-white border-[#062D4C] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  navy:
    'bg-[#062D4C] hover:bg-[#093C66] text-white border-[#041E34] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  burgundy:
    'bg-[#7F1D1D] hover:bg-[#691414] text-white border-[#062D4C] dark:border-slate-950 shadow-[0_3px_0_#041E34]',
  light:
    'bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#062D4C] dark:text-slate-100 border-[#062D4C] dark:border-slate-600 shadow-[0_3px_0_#062D4C] dark:shadow-[0_3px_0_#020617]',
};

function renderFormattedHeroTitle(rawTitle: string) {
  const match = rawTitle.match(/^(.*?)\s+(\([A-Za-z0-9\s\-&/]+\))$/);
  if (!match) return rawTitle;
  return (
    <>
      <span>{match[1]}</span>{' '}
      <bdi
        dir="ltr"
        className="inline-block whitespace-nowrap text-[0.72em] font-extrabold text-[#062D4C]/70 dark:text-slate-300 align-baseline"
      >
        {match[2]}
      </bdi>
    </>
  );
}

export function SectionHeroBanner({
  kicker,
  title,
  description,
  progress,
  actions = [],
  topExtra,
  bottomExtra,
  testId,
}: SectionHeroBannerProps) {
  const safePercent = Math.max(0, Math.min(100, Math.round(progress?.percentage ?? 0)));

  return (
    <section
      data-testid={testId}
      className="relative overflow-hidden rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-hero-grid shadow-[0_5px_0_#062D4C] dark:shadow-[0_5px_0_#020617]"
    >
      {/* Pure CSS Diagonal Geometric Crimson + Navy Accent Strip (Trailing Left in RTL) - Zero Art */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-28 sm:w-72 md:w-88 overflow-hidden select-none"
      >
        {/* Outer diagonal crimson stripe */}
        <div
          className="absolute inset-0 bg-[#B92622] opacity-15 sm:opacity-95"
          style={{ clipPath: 'polygon(0 0, 74% 0, 48% 100%, 0 100%)' }}
        />
        {/* Primary diagonal deep navy block */}
        <div
          className="absolute inset-0 bg-[#062D4C] opacity-15 sm:opacity-100"
          style={{ clipPath: 'polygon(0 0, 62% 0, 36% 100%, 0 100%)' }}
        />
        {/* Subtle secondary inner geometric navy facet */}
        <div
          className="hidden sm:block absolute inset-0 bg-gradient-to-br from-[#0A416E] to-[#041E34]"
          style={{ clipPath: 'polygon(0 0, 46% 0, 20% 100%, 0 100%)' }}
        />
        {/* Sharp secondary trailing crimson ribbon */}
        <div
          className="hidden sm:block absolute inset-0 bg-[#B92622]"
          style={{ clipPath: 'polygon(14% 0, 22% 0, 0 82%, 0 54%)' }}
        />
      </div>

      {/* Main Content Foreground */}
      <div className="relative z-10 p-5 sm:p-7 flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 sm:pl-36 md:pl-44">
          <div className="space-y-2.5 max-w-2xl">
            {kicker && (
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-extrabold text-[#062D4C]/80 dark:text-slate-300">
                {kicker}
              </div>
            )}

            <h1 className="text-2xl sm:text-3xl font-black text-[#062D4C] dark:text-white leading-snug tracking-tight">
              {renderFormattedHeroTitle(title)}
            </h1>

            {description && (
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl font-medium">
                {description}
              </p>
            )}

            {progress && (
              <div className="pt-2 max-w-md space-y-1.5">
                <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-slate-100">
                  <span>{progress.label}</span>
                  <span className="tabular-nums text-[#15803D] dark:text-emerald-400">
                    {safePercent}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={safePercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={progress.ariaLabel || progress.label}
                  className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-[#062D4C] dark:border-slate-500 overflow-hidden p-0.5"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400 transition-all duration-300"
                    style={{ width: `${safePercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {topExtra && <div className="shrink-0 z-10">{topExtra}</div>}
        </div>

        {(actions.length > 0 || bottomExtra) && (
          <div className="pt-4 border-t border-[#062D4C]/12 dark:border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
            {actions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5">
                {actions.map((action) => {
                  const tone = action.tone ?? 'navy';
                  return (
                    <button
                      key={action.id}
                      type="button"
                      data-testid={action.testId}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      aria-label={action.ariaLabel}
                      title={action.title}
                      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-extrabold rounded-xl border-2 transition-transform active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer ${TONE_CLASSES[tone]}`}
                    >
                      {action.icon}
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {bottomExtra && <div className="flex flex-wrap items-center gap-2">{bottomExtra}</div>}
          </div>
        )}
      </div>
    </section>
  );
}
