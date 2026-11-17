import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  GripVertical,
  Heart,
  NotebookPen,
  Pencil,
  Play,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { resolveMediaUrl } from '../data/presets';
import type { StepStatus, VideoStep } from '../types/learning';
import { formatQuickNotesPreview } from '../utils/pathLogic';

interface VideoStepCardProps {
  step: VideoStep;
  stepNumber: number;
  totalSteps: number;
  status: StepStatus;
  isFavorite?: boolean;
  hasQuiz?: boolean;
  onToggleFavorite?: (step: VideoStep) => void;
  onOpenQuiz?: (step: VideoStep) => void;
  onWatch: (step: VideoStep) => void;
  onOpenQuickNotes: (step: VideoStep) => void;
  onToggleComplete: (step: VideoStep) => void;
  onEdit: (step: VideoStep) => void;
  onDelete: (step: VideoStep) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function VideoStepCard({
  step,
  stepNumber,
  totalSteps,
  status,
  isFavorite = false,
  hasQuiz = false,
  onToggleFavorite,
  onOpenQuiz,
  onWatch,
  onOpenQuickNotes,
  onToggleComplete,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: VideoStepCardProps) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);

  const savedQuickNotes = (step.quickNotes || '').trim();
  const quickNotesPreview = formatQuickNotesPreview(savedQuickNotes, 140);

  const resolvedThumb = resolveMediaUrl(step.thumbnailUrl);

  const cardShadowClass =
    status === 'completed'
      ? 'border-[#062D4C] dark:border-emerald-500/70 shadow-[0_5px_0_#059669]'
      : status === 'current'
        ? 'border-[#062D4C] dark:border-rose-400 shadow-[0_5px_0_#B92622] ring-4 ring-[#B92622]/15'
        : 'border-[#062D4C] dark:border-slate-600 shadow-[0_5px_0_#062D4C] dark:shadow-[0_5px_0_#020617]';

  const statusText =
    status === 'completed'
      ? 'مكتمل'
      : status === 'current'
        ? 'المهمة الحالية'
        : 'خطوة قادمة';

  const statusTextClass =
    status === 'completed'
      ? 'text-emerald-700 dark:text-emerald-400'
      : status === 'current'
        ? 'text-[#B92622] dark:text-rose-400'
        : 'text-slate-600 dark:text-slate-400';

  const stopDrag = (e: React.PointerEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      data-testid={`video-step-card-${stepNumber}`}
      data-step-id={step.id}
      data-status={status}
      className={`relative rounded-xl border-2 bg-white dark:bg-slate-900 overflow-hidden transition-shadow duration-200 select-none cursor-grab active:cursor-grabbing ${cardShadowClass}`}
    >
      {/* Top Flush 16:9 Video Thumbnail */}
      <div className="relative aspect-video w-full bg-slate-100 dark:bg-slate-800 border-b-2 border-[#062D4C] dark:border-slate-700 overflow-hidden">
        {!thumbFailed && resolvedThumb ? (
          <img
            src={resolvedThumb}
            alt={step.title}
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setThumbFailed(true)}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#062D4C] via-[#0B3B61] to-[#1E293B] flex items-center justify-center">
            <div className="w-12 h-12 rounded-xl bg-[#B92622] border-2 border-white/80 text-white flex items-center justify-center shadow-[0_3px_0_#041E34]">
              <Play className="w-6 h-6 fill-white" aria-hidden="true" />
            </div>
          </div>
        )}

        {/* Completed Checkmark Stamp Overlay */}
        {status === 'completed' && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-emerald-950/25 flex items-center justify-center"
          >
            <span className="w-12 h-12 rounded-xl bg-emerald-600 border-2 border-white text-white flex items-center justify-center shadow-[3px_4px_0_#062D4C]">
              <Check className="w-6 h-6 stroke-[3]" />
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 space-y-3.5">
        {/* Step Square Badge + Status + Drag/Reorder Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-bold">
            {/* Dark Navy Square Step Badge like photo */}
            {status === 'completed' ? (
              <span
                className="w-7 h-7 rounded-md bg-emerald-600 text-white flex items-center justify-center shrink-0"
                aria-hidden="true"
              >
                <Check className="w-4 h-4 stroke-[2.5]" />
              </span>
            ) : (
              <span
                className={`w-7 h-7 rounded-md text-white flex items-center justify-center text-xs font-extrabold tabular-nums shrink-0 ${
                  status === 'current' ? 'bg-[#B92622]' : 'bg-[#062D4C] dark:bg-slate-700'
                }`}
                aria-hidden="true"
              >
                {stepNumber}
              </span>
            )}

            <span className="text-[#062D4C] dark:text-slate-100 tabular-nums">
              الخطوة {stepNumber}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className={`inline-flex items-center gap-1 ${statusTextClass}`}>
              {status === 'completed' ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : status === 'current' ? (
                <Play className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{statusText}</span>
            </span>

            {step.targetDate && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-400 tabular-nums font-semibold">
                  <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{step.targetDate}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onPointerDown={stopDrag}
              onClick={onMoveUp}
              disabled={stepNumber === 1}
              aria-label={`تحريك "${step.title}" للأعلى`}
              title="تحريك للأعلى"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#062D4C] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
            >
              <ArrowUp className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onPointerDown={stopDrag}
              onClick={onMoveDown}
              disabled={stepNumber === totalSteps}
              aria-label={`تحريك "${step.title}" للأسفل`}
              title="تحريك للأسفل"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-[#062D4C] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none rounded-lg transition-colors cursor-pointer"
            >
              <ArrowDown className="w-4 h-4" aria-hidden="true" />
            </button>
            <span
              title="اضغط مطولاً واسحب لإعادة الترتيب"
              aria-label="مقبض السحب لإعادة الترتيب"
              className="p-1.5 text-slate-400 hover:text-[#062D4C] dark:hover:text-white rounded-lg inline-flex items-center"
            >
              <GripVertical className="w-4 h-4" aria-hidden="true" />
            </span>
          </div>
        </div>

        {/* Title & Notes */}
        <div className="space-y-1.5 select-text">
          <h3 className="text-lg font-extrabold text-[#062D4C] dark:text-white leading-snug">
            {step.title}
          </h3>
          {step.description && (
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
              {step.description}
            </p>
          )}
        </div>

        {/* Accessible Quick Notes saved for this video step */}
        {savedQuickNotes && (
          <div
            data-testid={`step-quick-notes-${stepNumber}`}
            className="pt-3 border-t border-[#062D4C]/15 dark:border-slate-700 space-y-1.5 select-text"
          >
            <div className="flex items-center justify-between gap-2 text-xs font-extrabold text-[#062D4C] dark:text-amber-300">
              <span className="inline-flex items-center gap-1.5">
                <NotebookPen className="w-3.5 h-3.5 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                <span>ملاحظات سريعة</span>
              </span>
              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => onOpenQuickNotes(step)}
                aria-label={`تعديل الملاحظات السريعة لـ "${step.title}"`}
                className="text-xs font-bold text-[#B92622] dark:text-rose-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                تعديل الملاحظات
              </button>
            </div>
            <p className="text-xs sm:text-sm font-medium text-[#062D4C]/90 dark:text-slate-200 whitespace-pre-line leading-relaxed">
              {notesExpanded ? savedQuickNotes : quickNotesPreview.text}
            </p>
            {quickNotesPreview.truncated && (
              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => setNotesExpanded((prev) => !prev)}
                className="text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline cursor-pointer"
              >
                {notesExpanded ? 'عرض أقل' : 'عرض الملاحظة كاملة'}
              </button>
            )}
          </div>
        )}

        {/* Game Action Buttons */}
        <div className="pt-1 space-y-2.5">
          <button
            type="button"
            onPointerDown={stopDrag}
            onClick={() => onWatch(step)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-lg transition-transform active:translate-y-0.5 cursor-pointer"
          >
            <Play className="w-4 h-4 fill-white shrink-0" aria-hidden="true" />
            <span>مشاهدة الفيديو</span>
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <button
              type="button"
              onPointerDown={stopDrag}
              onClick={() => onToggleComplete(step)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold rounded-xl border-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                step.completed
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 border-emerald-600 dark:border-emerald-500/60'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-[#062D4C] dark:text-slate-200 border-[#062D4C] dark:border-slate-600'
              }`}
            >
              {step.completed ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>إلغاء الإنجاز</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                  <span>تم الإنجاز</span>
                </>
              )}
            </button>

            <div className="flex flex-wrap items-center gap-1">
              {onOpenQuiz && (
                <button
                  type="button"
                  data-testid={`open-step-quiz-${stepNumber}`}
                  onPointerDown={stopDrag}
                  onClick={() => onOpenQuiz(step)}
                  aria-label={`اختبار درس "${step.title}"`}
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-extrabold text-[#1D4ED8] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ClipboardCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{hasQuiz ? 'الاختبار' : 'إنشاء اختبار'}</span>
                </button>
              )}
              {onToggleFavorite && (
                <button
                  type="button"
                  data-testid={`favorite-step-${stepNumber}`}
                  onPointerDown={stopDrag}
                  onClick={() => onToggleFavorite(step)}
                  aria-label={isFavorite ? `إزالة "${step.title}" من المفضلة` : `إضافة "${step.title}" للمفضلة`}
                  title={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                  className={`p-2 rounded-lg transition-colors cursor-pointer ${
                    isFavorite
                      ? 'text-[#B92622] bg-rose-50 dark:bg-rose-950/40'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#B92622]' : ''}`} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => onOpenQuickNotes(step)}
                aria-label={`ملاحظات سريعة لـ "${step.title}"`}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-[#062D4C] dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <NotebookPen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>ملاحظات سريعة</span>
              </button>
              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => onEdit(step)}
                aria-label={`تعديل "${step.title}"`}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-[#062D4C] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>تعديل</span>
              </button>
              <button
                type="button"
                onPointerDown={stopDrag}
                onClick={() => onDelete(step)}
                aria-label={`حذف "${step.title}"`}
                className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>حذف</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
