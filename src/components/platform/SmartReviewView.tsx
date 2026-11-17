import { useState } from 'react';
import { Brain, CheckCircle2, Play, RotateCcw, Trash2, XCircle } from 'lucide-react';
import type { ReviewItem } from '../../types/platform';
import { SectionHeroBanner } from '../SectionHeroBanner';

interface SmartReviewViewProps {
  reviewItems: ReviewItem[];
  summary: {
    totalTracked: number;
    pendingCount: number;
    masteredCount: number;
    accuracyPercent: number;
    repeatMistakesCount: number;
  };
  onAnswerReviewItem: (
    item: ReviewItem,
    selectedIndex: number
  ) => Promise<{ isCorrect: boolean; newlyMastered: boolean; updatedItem: ReviewItem }>;
  onMasteredXpReward: (item: ReviewItem) => Promise<void>;
  onDeleteReviewItem: (reviewId: string) => Promise<void>;
}

export function SmartReviewView({
  reviewItems,
  summary,
  onAnswerReviewItem,
  onMasteredXpReward,
  onDeleteReviewItem,
}: SmartReviewViewProps) {
  const [tab, setTab] = useState<'pending' | 'mastered'>('pending');
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{
    answered: boolean;
    isCorrect: boolean;
    explanation: string;
  } | null>(null);

  const pendingItems = reviewItems.filter((i) => !i.mastered);
  const masteredItems = reviewItems.filter((i) => i.mastered);
  const activeItem = activeReviewId
    ? reviewItems.find((i) => i.id === activeReviewId) || null
    : null;

  const startSession = () => {
    const first = pendingItems[0];
    if (!first) return;
    setActiveReviewId(first.id);
    setSelectedIndex(null);
    setFeedback(null);
  };

  const handleSubmitReview = async () => {
    if (!activeItem || selectedIndex === null) return;
    const res = await onAnswerReviewItem(activeItem, selectedIndex);
    setFeedback({
      answered: true,
      isCorrect: res.isCorrect,
      explanation: activeItem.explanation,
    });
    if (res.newlyMastered) {
      await onMasteredXpReward(activeItem);
    }
  };

  const advanceNext = () => {
    const remaining = reviewItems.filter((i) => !i.mastered && i.id !== activeItem?.id);
    const next = remaining[0] || pendingItems[0] || null;
    setActiveReviewId(next ? next.id : null);
    setSelectedIndex(null);
    setFeedback(null);
  };

  return (
    <div data-testid="smart-review-view" className="space-y-6">
      <SectionHeroBanner
        testId="review-hero"
        kicker={
          <span>
            المراجعة الذكية من أخطائك الحقيقية · دقة الاسترجاع {summary.accuracyPercent}%
          </span>
        }
        title="المراجعة الذكية — تحويل الأخطاء إلى نقاط قوة"
        description="تُضاف هنا تلقائياً فقط الأسئلة التي أخطأت فيها أثناء الاختبارات مع ترتيب الأولوية للأخطاء المتكررة، دون أي أسئلة وهمية."
        actions={
          pendingItems.length > 0
            ? [
                {
                  id: 'start-review-session',
                  label: `بدء جلسة مراجعة (${pendingItems.length} سؤال)`,
                  icon: <Play className="w-4 h-4" aria-hidden="true" />,
                  onClick: startSession,
                  tone: 'crimson',
                },
              ]
            : []
        }
        bottomExtra={
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setTab('pending')}
              className={`px-3.5 py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer tabular-nums ${
                tab === 'pending'
                  ? 'bg-[#062D4C] text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-100 border-[#062D4C]/40'
              }`}
            >
              قيد المراجعة ({pendingItems.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('mastered')}
              className={`px-3.5 py-2 rounded-xl border-2 text-xs font-extrabold cursor-pointer tabular-nums ${
                tab === 'mastered'
                  ? 'bg-[#15803D] text-white border-[#15803D]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-100 border-[#062D4C]/40'
              }`}
            >
              تم إتقانها ({masteredItems.length})
            </button>
          </div>
        }
      />

      {/* Active Interactive Review Runner */}
      {activeItem && (
        <section
          data-testid="active-review-card"
          className="rounded-2xl border-2 border-[#B92622] bg-white dark:bg-slate-900 p-5 shadow-[0_5px_0_#B92622] space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-[#B92622]" aria-hidden="true" />
              <span className="text-xs font-black text-[#B92622] dark:text-amber-300">
                الدرس: {activeItem.stepTitle} · أُخطئ فيه {activeItem.wrongCount} مرة
              </span>
            </div>
            <button
              type="button"
              onClick={() => setActiveReviewId(null)}
              className="text-xs font-extrabold text-slate-500 hover:underline cursor-pointer"
            >
              إنهاء الجلسة
            </button>
          </div>

          <h3 className="text-base sm:text-lg font-black text-[#062D4C] dark:text-white">
            {activeItem.prompt}
          </h3>

          <div className="space-y-2">
            {activeItem.options.map((opt, idx) => (
              <label
                key={idx}
                className={`flex items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold cursor-pointer ${
                  selectedIndex === idx
                    ? 'border-[#062D4C] bg-sky-50 dark:bg-slate-800'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950'
                }`}
              >
                <input
                  type="radio"
                  name="review_choice"
                  disabled={Boolean(feedback)}
                  checked={selectedIndex === idx}
                  onChange={() => setSelectedIndex(idx)}
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>

          {feedback && (
            <div
              className={`rounded-xl border-2 p-3.5 text-xs sm:text-sm font-bold space-y-1 ${
                feedback.isCorrect
                  ? 'border-[#15803D] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                  : 'border-[#B92622] bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
              }`}
            >
              <p className="flex items-center gap-1.5 font-black">
                {feedback.isCorrect ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {feedback.isCorrect
                    ? 'إجابة صحيحة! تم إتقان السؤال وحصلت على +20 XP.'
                    : `إجابة غير صحيحة — الإجابة الصحيحة هي: ${activeItem.options[activeItem.correctIndex]}`}
                </span>
              </p>
              {feedback.explanation && <p className="font-medium">{feedback.explanation}</p>}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            {!feedback ? (
              <button
                type="button"
                disabled={selectedIndex === null}
                onClick={() => void handleSubmitReview()}
                className="rounded-xl bg-[#15803D] hover:bg-[#166534] text-white px-5 py-2.5 text-xs font-black cursor-pointer disabled:opacity-50"
              >
                تحقق من الإجابة
              </button>
            ) : (
              <button
                type="button"
                onClick={advanceNext}
                className="rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-5 py-2.5 text-xs font-black cursor-pointer"
              >
                السؤال التالي
              </button>
            )}
          </div>
        </section>
      )}

      {/* Queue List */}
      {(() => {
        const list = tab === 'pending' ? pendingItems : masteredItems;
        if (list.length === 0) {
          return (
            <div
              data-testid="review-empty"
              className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-8 text-center space-y-2"
            >
              <Brain className="w-10 h-10 text-[#062D4C] dark:text-sky-400 mx-auto" />
              <h3 className="text-base font-black text-[#062D4C] dark:text-white">
                {tab === 'pending'
                  ? 'لا توجد أخطاء متراكمة للمراجعة حالياً'
                  : 'لم يتم إتقان أسئلة مراجعة بعد'}
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                عند الإجابة بشكل خاطئ على أي سؤال في اختبارات الدروس، يظهر هنا تلقائياً لمراجعته وتصحيحه.
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {list.map((item) => (
              <article
                key={item.id}
                data-testid={`review-item-${item.questionId}`}
                className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                    <span className="text-slate-500 dark:text-slate-400 truncate">
                      {item.stepTitle}
                    </span>
                    <span className="text-[#B92622] dark:text-amber-300 tabular-nums shrink-0">
                      أخطاء: {item.wrongCount}
                    </span>
                  </div>
                  <h3 className="text-sm font-black text-[#062D4C] dark:text-white leading-snug">
                    {item.prompt}
                  </h3>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReviewId(item.id);
                      setSelectedIndex(null);
                      setFeedback(null);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-3 py-1.5 text-xs font-extrabold cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{item.mastered ? 'إعادة التدريب' : 'مراجعة السؤال'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDeleteReviewItem(item.id)}
                    aria-label="حذف من المراجعة"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#B92622] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
