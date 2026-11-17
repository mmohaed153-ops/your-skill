import { useEffect, useRef, useState } from 'react';
import { Flag, Plus, Sparkles } from 'lucide-react';
import { Reorder } from 'motion/react';
import type { PathProgress, VideoStep } from '../types/learning';
import { getStepStatus } from '../utils/pathLogic';
import { VideoStepCard } from './VideoStepCard';

interface VideoPathTimelineProps {
  steps: VideoStep[];
  progress: PathProgress;
  isStepFavorite?: (stepId: string) => boolean;
  hasStepQuiz?: (stepId: string) => boolean;
  onToggleStepFavorite?: (step: VideoStep) => void;
  onOpenStepQuiz?: (step: VideoStep) => void;
  onWatch: (step: VideoStep) => void;
  onOpenQuickNotes: (step: VideoStep) => void;
  onToggleComplete: (step: VideoStep) => void;
  onEdit: (step: VideoStep) => void;
  onDelete: (step: VideoStep) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onCommitOrder: (orderedIds: string[]) => void;
  onAddVideo: () => void;
}

export function VideoPathTimeline({
  steps,
  progress,
  isStepFavorite,
  hasStepQuiz,
  onToggleStepFavorite,
  onOpenStepQuiz,
  onWatch,
  onOpenQuickNotes,
  onToggleComplete,
  onEdit,
  onDelete,
  onReorder,
  onCommitOrder,
  onAddVideo,
}: VideoPathTimelineProps) {
  const [orderedSteps, setOrderedSteps] = useState<VideoStep[]>(steps);
  const latestOrderRef = useRef<VideoStep[]>(steps);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (!isDraggingRef.current) {
      setOrderedSteps(steps);
      latestOrderRef.current = steps;
    }
  }, [steps]);

  const handleLiveReorder = (nextOrder: VideoStep[]) => {
    setOrderedSteps(nextOrder);
    latestOrderRef.current = nextOrder;
  };

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDragEnd = () => {
    isDraggingRef.current = false;
    const nextIds = latestOrderRef.current.map((s) => s.id);
    const prevIds = steps.map((s) => s.id);
    if (nextIds.join(',') !== prevIds.join(',')) {
      onCommitOrder(nextIds);
    }
  };

  if (steps.length === 0) {
    return (
      <section
        id="learning-path"
        className="max-w-md mx-auto rounded-2xl border-2 border-dashed border-[#062D4C]/40 dark:border-slate-600 bg-white dark:bg-slate-900 p-10 text-center space-y-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]"
      >
        <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] text-[#B92622] dark:text-amber-300 flex items-center justify-center">
          <Sparkles className="w-7 h-7" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-extrabold text-[#062D4C] dark:text-white">
            ابدأ بناء مسارك التعليمي
          </h2>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            أضف أول رابط فيديو مع العنوان والملاحظات ليظهر كالمرحلة الأولى في خريطة التعلم.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddVideo}
          className="inline-flex items-center gap-2 px-5 py-3 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl transition-transform active:translate-y-0.5 cursor-pointer"
        >
          <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>إضافة فيديو إلى مساري</span>
        </button>
      </section>
    );
  }

  return (
    <section
      id="learning-path"
      aria-labelledby="path-timeline-heading"
      className="max-w-md mx-auto space-y-6"
    >
      <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 px-5 py-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="path-timeline-heading" className="text-lg sm:text-xl font-extrabold text-[#062D4C] dark:text-white">
            خريطة المسار التعليمي
          </h2>
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
            اسحب البطاقات عمودياً لإعادة ترتيب المراحل
          </p>
        </div>
        <div className="text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-emerald-300 tabular-nums">
          {progress.completedCount} / {progress.total} ({progress.percentage}%)
        </div>
      </div>

      {/* Top Entry Arrow into Step 1 (just like the photo!) */}
      <div aria-hidden="true" className="flex justify-center -mb-2 pointer-events-none select-none">
        <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
          <line x1="12" y1="0" x2="12" y2="24" stroke="#64748B" strokeWidth="2.5" />
          <polygon points="12,31 6,21 18,21" fill="#60A5FA" stroke="#062D4C" strokeWidth="1.5" />
        </svg>
      </div>

      <Reorder.Group
        axis="y"
        values={orderedSteps}
        onReorder={handleLiveReorder}
        data-testid="video-path-list"
        className="flex flex-col items-stretch list-none p-0 m-0"
      >
        {orderedSteps.map((step, index) => {
          const liveFirstUncompleted = orderedSteps.findIndex((s) => !s.completed);
          const status = getStepStatus(step, index, liveFirstUncompleted);
          const isCompletedConnector = step.completed;

          return (
            <Reorder.Item
              key={step.id}
              value={step}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              whileDrag={{
                scale: 1.02,
                zIndex: 20,
              }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="flex flex-col items-stretch relative"
            >
              <VideoStepCard
                step={step}
                stepNumber={index + 1}
                totalSteps={orderedSteps.length}
                status={status}
                isFavorite={isStepFavorite ? isStepFavorite(step.id) : false}
                hasQuiz={hasStepQuiz ? hasStepQuiz(step.id) : false}
                onToggleFavorite={onToggleStepFavorite}
                onOpenQuiz={onOpenStepQuiz}
                onWatch={onWatch}
                onOpenQuickNotes={onOpenQuickNotes}
                onToggleComplete={onToggleComplete}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveUp={() => onReorder(index, index - 1)}
                onMoveDown={() => onReorder(index, index + 1)}
              />

              {/* Crisp SVG Pathway Line & Arrowhead matching the reference photo */}
              <div
                aria-hidden="true"
                className="flex justify-center py-0.5 select-none pointer-events-none"
              >
                <svg width="28" height="46" viewBox="0 0 28 46" fill="none">
                  <line
                    x1="14"
                    y1="0"
                    x2="14"
                    y2="37"
                    stroke={isCompletedConnector ? '#059669' : '#64748B'}
                    strokeWidth="2.5"
                  />
                  <polygon
                    points="14,45 7,34 21,34"
                    fill={isCompletedConnector ? '#34D399' : '#60A5FA'}
                    stroke="#062D4C"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>

      {/* Final Game Goal / Trophy Node */}
      <div className="flex justify-center">
        <div
          className={`w-full rounded-xl border-2 border-[#062D4C] px-6 py-4 flex items-center justify-center gap-3 text-center transition-colors ${
            progress.percentage === 100
              ? 'bg-emerald-600 text-white shadow-[5px_6px_0_#062D4C]'
              : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-white shadow-[5px_6px_0_#062D4C] dark:shadow-[5px_6px_0_#334155]'
          }`}
        >
          <Flag className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="text-sm sm:text-base font-extrabold">
            {progress.percentage === 100
              ? 'تهانينا! تم إتمام المسار التعليمي بالكامل'
              : 'الهدف النهائي: إتمام المسار التعليمي'}
          </div>
        </div>
      </div>
    </section>
  );
}
