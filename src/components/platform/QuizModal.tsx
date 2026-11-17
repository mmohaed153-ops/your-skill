import { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import type { VideoStep } from '../../types/learning';
import type { LessonQuiz, QuizAttempt, QuizQuestion } from '../../types/platform';
import { createSafeId } from '../../utils/pathLogic';
import { validateQuizInput } from '../../utils/quizLogic';

interface QuizModalProps {
  open: boolean;
  step: VideoStep | null;
  existingQuiz: LessonQuiz | null;
  attempts: QuizAttempt[];
  onClose: () => void;
  onSaveQuiz: (input: {
    quizId?: string;
    stepId: string;
    pathId: string;
    stepTitle: string;
    title: string;
    passPercent: number;
    source: 'ai' | 'manual';
    questions: QuizQuestion[];
  }) => Promise<LessonQuiz>;
  onSubmitAttempt: (
    quiz: LessonQuiz,
    selectedAnswers: Record<string, number>
  ) => Promise<{ attempt: QuizAttempt; wrongCount: number }>;
  onQuizAttemptCompleted: (result: {
    quiz: LessonQuiz;
    attempt: QuizAttempt;
    wrongCount: number;
  }) => Promise<void>;
}

type ModalMode = 'take' | 'builder' | 'result';

function makeBlankMcq(): QuizQuestion {
  return {
    id: createSafeId('qq'),
    type: 'multiple_choice',
    prompt: '',
    options: ['', '', ''],
    correctIndex: 0,
    explanation: '',
  };
}

function makeBlankTrueFalse(): QuizQuestion {
  return {
    id: createSafeId('qq'),
    type: 'true_false',
    prompt: '',
    options: ['صحيح', 'خطأ'],
    correctIndex: 0,
    explanation: '',
  };
}

export function QuizModal({
  open,
  step,
  existingQuiz,
  attempts,
  onClose,
  onSaveQuiz,
  onSubmitAttempt,
  onQuizAttemptCompleted,
}: QuizModalProps) {
  const [mode, setMode] = useState<ModalMode>(() => (existingQuiz ? 'take' : 'builder'));
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [lastAttempt, setLastAttempt] = useState<QuizAttempt | null>(null);

  // Builder state
  const [quizTitle, setQuizTitle] = useState(
    () => existingQuiz?.title || (step ? `اختبار درس: ${step.title}` : 'اختبار الدرس')
  );
  const [passPercent, setPassPercent] = useState<number>(() => existingQuiz?.passPercent || 60);
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    () => existingQuiz?.questions || [makeBlankMcq()]
  );
  const [sourceKind, setSourceKind] = useState<'ai' | 'manual'>(
    () => existingQuiz?.source || 'manual'
  );
  const [aiCount, setAiCount] = useState<number>(4);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open || !step) return null;

  const activeQuiz = existingQuiz;

  const handleGenerateAiQuiz = async () => {
    setErrorMsg(null);
    setAiLoading(true);
    try {
      const resp = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonTitle: step.title,
          lessonDescription: step.description,
          quickNotes: step.quickNotes,
          questionCount: aiCount,
        }),
      });
      const json = (await resp.json()) as {
        error?: string;
        title?: string;
        questions?: QuizQuestion[];
      };
      if (!resp.ok || !Array.isArray(json.questions) || json.questions.length === 0) {
        setErrorMsg(json.error || 'تعذر توليد أسئلة بالذكاء الاصطناعي. يمكنك إنشاء الاختبار يدوياً.');
        return;
      }
      setQuizTitle(json.title || `اختبار: ${step.title}`);
      setQuestions(json.questions);
      setSourceKind('ai');
    } catch {
      setErrorMsg('تعذر الاتصال بخدمة التوليد. يمكنك إنشاء الاختبار يدوياً أدناه.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const err = validateQuizInput({ title: quizTitle, questions });
    if (err) {
      setErrorMsg(err);
      return;
    }
    setSaving(true);
    try {
      await onSaveQuiz({
        quizId: existingQuiz?.id,
        stepId: step.id,
        pathId: step.pathId,
        stepTitle: step.title,
        title: quizTitle,
        passPercent,
        source: sourceKind,
        questions,
      });
      setSelectedAnswers({});
      setMode('take');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitAnswers = async () => {
    if (!activeQuiz) return;
    setErrorMsg(null);
    if (activeQuiz.questions.some((q) => typeof selectedAnswers[q.id] !== 'number')) {
      setErrorMsg('يرجى الإجابة على جميع الأسئلة قبل تسليم الاختبار.');
      return;
    }
    setSaving(true);
    try {
      const { attempt, wrongCount } = await onSubmitAttempt(activeQuiz, selectedAnswers);
      setLastAttempt(attempt);
      setMode('result');
      await onQuizAttemptCompleted({ quiz: activeQuiz, attempt, wrongCount });
    } finally {
      setSaving(false);
    }
  };

  const stepAttempts = attempts.filter((a) => a.stepId === step.id);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#062D4C]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="الاختبار التفاعلي للدرس"
      onClick={onClose}
    >
      <div
        data-testid="lesson-quiz-modal"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="text-base font-black truncate">
                {activeQuiz ? activeQuiz.title : `اختبار الدرس: ${step.title}`}
              </h2>
              <p className="text-[11px] font-semibold text-slate-300 tabular-nums">
                عدد المحاولات السابقة: {stepAttempts.length}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeQuiz && mode !== 'builder' && (
              <button
                type="button"
                onClick={() => {
                  setQuizTitle(activeQuiz.title);
                  setPassPercent(activeQuiz.passPercent);
                  setQuestions(activeQuiz.questions);
                  setMode('builder');
                }}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-extrabold cursor-pointer"
              >
                تعديل الأسئلة
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق الاختبار"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {errorMsg && (
            <div className="rounded-xl border border-[#B92622] bg-rose-50 dark:bg-rose-950/40 px-3.5 py-2.5 text-xs font-bold text-[#B92622] dark:text-rose-200">
              {errorMsg}
            </div>
          )}

          {/* MODE: BUILDER */}
          {mode === 'builder' && (
            <form onSubmit={handleSaveBuilder} className="space-y-4">
              <div className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-xs font-black text-[#062D4C] dark:text-white">
                    توليد أسئلة تلقائياً من محتوى الدرس بالذكاء الاصطناعي
                  </p>
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    يعتمد التوليد على عنوان الدرس ووصفه وملاحظاتك السريعة.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={aiCount}
                    onChange={(e) => setAiCount(Number(e.target.value))}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-bold"
                  >
                    <option value={3}>3 أسئلة</option>
                    <option value={4}>4 أسئلة</option>
                    <option value={5}>5 أسئلة</option>
                  </select>
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={() => void handleGenerateAiQuiz()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-3.5 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                    <span>{aiLoading ? 'جاري التوليد...' : 'توليد بالذكاء الاصطناعي'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black mb-1">عنوان الاختبار</label>
                  <input
                    type="text"
                    required
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">نسبة النجاح (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={passPercent}
                    onChange={(e) => setPassPercent(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold tabular-nums"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {questions.map((q, qIdx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-[#062D4C] dark:text-white">
                        السؤال #{qIdx + 1} ({q.type === 'true_false' ? 'صح / خطأ' : 'اختيار من متعدد'})
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuestions((prev) => prev.filter((_, idx) => idx !== qIdx))
                          }
                          aria-label="حذف السؤال"
                          className="text-xs font-bold text-[#B92622] hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      required
                      value={q.prompt}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, idx) =>
                            idx === qIdx ? { ...item, prompt: e.target.value } : item
                          )
                        )
                      }
                      placeholder="اكتب نص السؤال..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-bold"
                    />

                    <div className="space-y-1.5">
                      <p className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                        حدد الإجابة الصحيحة بالضغط على الدائرة:
                      </p>
                      {q.options.map((opt, optIdx) => (
                        <div key={optIdx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`correct_${q.id}`}
                            checked={q.correctIndex === optIdx}
                            onChange={() =>
                              setQuestions((prev) =>
                                prev.map((item, idx) =>
                                  idx === qIdx ? { ...item, correctIndex: optIdx } : item
                                )
                              )
                            }
                            className="accent-[#15803D] cursor-pointer"
                          />
                          <input
                            type="text"
                            required
                            value={opt}
                            readOnly={q.type === 'true_false'}
                            onChange={(e) =>
                              setQuestions((prev) =>
                                prev.map((item, idx) =>
                                  idx === qIdx
                                    ? {
                                        ...item,
                                        options: item.options.map((o, oi) =>
                                          oi === optIdx ? e.target.value : o
                                        ),
                                      }
                                    : item
                                )
                              )
                            }
                            placeholder={`الخيار ${optIdx + 1}`}
                            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold"
                          />
                        </div>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((item, idx) =>
                            idx === qIdx ? { ...item, explanation: e.target.value } : item
                          )
                        )
                      }
                      placeholder="تفسير الإجابة الصحيحة (يظهر بعد الحل والمراجعة الذكية)..."
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-medium"
                    />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => [...prev, makeBlankMcq()])}
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-[#062D4C] px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>سؤال متعدد الخيارات</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestions((prev) => [...prev, makeBlankTrueFalse()])}
                    className="inline-flex items-center gap-1 rounded-xl border-2 border-[#062D4C] px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>سؤال صح / خطأ</span>
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  data-testid="save-quiz-builder-btn"
                  className="rounded-xl bg-[#B92622] hover:bg-[#9E1E1B] text-white px-5 py-2.5 text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ الاختبار والبدء'}
                </button>
              </div>
            </form>
          )}

          {/* MODE: TAKE QUIZ */}
          {mode === 'take' && activeQuiz && (
            <div className="space-y-4">
              {activeQuiz.questions.map((q, idx) => (
                <div
                  key={q.id}
                  data-testid={`quiz-question-${idx}`}
                  className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-950 p-4 space-y-2.5"
                >
                  <p className="text-sm font-black text-[#062D4C] dark:text-white">
                    {idx + 1}. {q.prompt}
                  </p>
                  <div className="space-y-1.5">
                    {q.options.map((opt, optIdx) => {
                      const picked = selectedAnswers[q.id] === optIdx;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-xs font-bold cursor-pointer transition-colors ${
                            picked
                              ? 'border-[#062D4C] bg-sky-50 dark:bg-slate-800 text-[#062D4C] dark:text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`answer_${q.id}`}
                            checked={picked}
                            onChange={() =>
                              setSelectedAnswers((prev) => ({ ...prev, [q.id]: optIdx }))
                            }
                            className="accent-[#062D4C]"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  درجة النجاح المطلوبة: {activeQuiz.passPercent}%
                </span>
                <button
                  type="button"
                  disabled={saving}
                  data-testid="submit-quiz-answers-btn"
                  onClick={() => void handleSubmitAnswers()}
                  className="rounded-xl bg-[#15803D] hover:bg-[#166534] text-white px-5 py-2.5 text-sm font-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري التصحيح...' : 'تصحيح وإرسال الإجابات'}
                </button>
              </div>
            </div>
          )}

          {/* MODE: RESULT */}
          {mode === 'result' && lastAttempt && (
            <div data-testid="quiz-result-panel" className="space-y-4">
              <div
                className={`rounded-2xl border-2 p-4 text-center space-y-1 ${
                  lastAttempt.passed
                    ? 'border-[#15803D] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                    : 'border-[#B92622] bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
                }`}
              >
                <p className="text-xl font-black tabular-nums">
                  النتيجة: {lastAttempt.score} من {lastAttempt.totalQuestions} ({lastAttempt.percentage}%)
                </p>
                <p className="text-xs font-bold">
                  {lastAttempt.passed
                    ? 'أحسنت! اجتزت الاختبار بنجاح.'
                    : 'تحتاج إلى مراجعة الأخطاء — تمت إضافة الأسئلة الخاطئة تلقائياً إلى المراجعة الذكية.'}
                </p>
              </div>

              <div className="space-y-3">
                {lastAttempt.results.map((r, idx) => (
                  <div
                    key={r.questionId}
                    className={`rounded-xl border-2 p-3.5 space-y-1.5 ${
                      r.isCorrect
                        ? 'border-[#15803D]/50 bg-emerald-50/40 dark:bg-emerald-950/20'
                        : 'border-[#B92622]/60 bg-rose-50/40 dark:bg-rose-950/20'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {r.isCorrect ? (
                        <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#B92622] shrink-0 mt-0.5" />
                      )}
                      <p className="text-xs sm:text-sm font-black text-[#062D4C] dark:text-white">
                        {idx + 1}. {r.prompt}
                      </p>
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      إجابتك: {r.options[r.selectedIndex] || 'لم تُختر'} · الصحيح:{' '}
                      <span className="text-[#15803D] dark:text-emerald-400">
                        {r.options[r.correctIndex]}
                      </span>
                    </p>
                    {r.explanation && (
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-white/70 dark:bg-slate-900/70 rounded-lg p-2">
                        {r.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnswers({});
                    setMode('take');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border-2 border-[#062D4C] px-4 py-2 text-xs font-extrabold text-[#062D4C] dark:text-white cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إعادة الاختبار</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl bg-[#062D4C] text-white px-5 py-2 text-xs font-black cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
