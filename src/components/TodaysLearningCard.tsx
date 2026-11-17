import { useState } from 'react';
import { Calendar, CheckCircle2, Compass, NotebookPen, Play, Plus, Trophy } from 'lucide-react';
import { resolveMediaUrl } from '../data/presets';
import type { PathProgress, VideoStep } from '../types/learning';

interface TodaysLearningCardProps {
  progress: PathProgress;
  onWatch: (step: VideoStep) => void;
  onOpenQuickNotes: (step: VideoStep) => void;
  onMarkCompleted: (step: VideoStep) => void;
  onAddVideo: () => void;
}

export function TodaysLearningCard({
  progress,
  onWatch,
  onOpenQuickNotes,
  onMarkCompleted,
  onAddVideo,
}: TodaysLearningCardProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const nextStep = progress.nextStep;
  const resolvedThumb = nextStep ? resolveMediaUrl(nextStep.thumbnailUrl) : '';

  if (progress.total === 0) {
    return (
      <section
        id="todays-learning"
        className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white">
            تعلم اليوم
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            لم تضف أي فيديو في هذا المسار بعد. ابدأ بإضافة أول درس فيديو لتظهر مهمتك التالية هنا.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddVideo}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>أضف أول فيديو</span>
        </button>
      </section>
    );
  }

  if (!nextStep) {
    return (
      <section
        id="todays-learning"
        className="rounded-2xl border-2 border-[#062D4C] dark:border-emerald-500/60 bg-white dark:bg-slate-900 shadow-[0_4px_0_#059669] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 border-2 border-[#062D4C] text-white flex items-center justify-center shrink-0 shadow-[0_3px_0_#041E34]">
            <Trophy className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <div className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
              تعلم اليوم · المسار مكتمل 100%
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-[#062D4C] dark:text-white">
              أحسنت! أتممت جميع الفيديوهات في هذا المسار
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              يمكنك إضافة فيديوهات جديدة لاستكمال رحلتك أو الانتقال إلى مسار آخر.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddVideo}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#041E34] shadow-[0_3px_0_#059669] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>إضافة فيديو جديد</span>
        </button>
      </section>
    );
  }

  return (
    <section
      id="todays-learning"
      aria-labelledby="todays-learning-heading"
      className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
        {/* Video Thumbnail */}
        <div className="md:col-span-4 relative bg-slate-100 dark:bg-slate-800 min-h-[190px] border-b-2 md:border-b-0 md:border-l-2 border-[#062D4C] dark:border-slate-700">
          {!thumbFailed && resolvedThumb ? (
            <img
              src={resolvedThumb}
              alt={nextStep.title}
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full min-h-[190px] bg-gradient-to-br from-[#062D4C] via-[#0B3B61] to-[#1E293B] flex items-center justify-center">
              <div className="w-14 h-14 rounded-2xl bg-[#B92622] border-2 border-white/80 text-white flex items-center justify-center shadow-[0_3px_0_#041E34]">
                <Play className="w-7 h-7 fill-white" aria-hidden="true" />
              </div>
            </div>
          )}
        </div>

        {/* Content & Next Action */}
        <div className="md:col-span-8 p-6 flex flex-col justify-between gap-5">
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold">
              <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
                <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>تعلم اليوم</span>
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                ·
              </span>
              <span className="tabular-nums text-[#062D4C] dark:text-slate-200">
                الخطوة {progress.currentStepIndex + 1} من {progress.total}
              </span>
              {nextStep.targetDate && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 tabular-nums">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>موعد الدراسة: {nextStep.targetDate}</span>
                  </span>
                </>
              )}
            </div>

            <h2
              id="todays-learning-heading"
              className="text-xl sm:text-2xl font-extrabold text-[#062D4C] dark:text-white leading-snug"
            >
              {nextStep.title}
            </h2>

            {nextStep.description && (
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-2">
                {nextStep.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onWatch(nextStep)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>مشاهدة الفيديو</span>
            </button>

            <button
              type="button"
              onClick={() => onMarkCompleted(nextStep)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#15803D] hover:bg-[#166534] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تم الإنجاز</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenQuickNotes(nextStep)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-[#062D4C] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_3px_0_#062D4C] dark:shadow-[0_3px_0_#020617] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <NotebookPen className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
              <span>
                {nextStep.quickNotes?.trim() ? 'عرض الملاحظات السريعة' : 'ملاحظات سريعة'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
