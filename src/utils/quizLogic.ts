import type {
  LessonQuiz,
  QuizAttempt,
  QuizQuestion,
  QuizQuestionResult,
  ReviewItem,
} from '../types/platform';
import { createSafeId } from './pathLogic';

export function validateQuizInput(input: {
  title: string;
  questions: QuizQuestion[];
}): string | null {
  if (!input.title.trim()) return 'يرجى إدخال عنوان الاختبار.';
  if (!Array.isArray(input.questions) || input.questions.length === 0) {
    return 'يجب إضافة سؤال واحد على الأقل للاختبار.';
  }
  for (let i = 0; i < input.questions.length; i += 1) {
    const q = input.questions[i];
    if (!q.prompt.trim()) return `يرجى كتابة نص السؤال رقم ${i + 1}.`;
    const validOpts = q.options.filter((o) => o.trim().length > 0);
    if (validOpts.length < 2) {
      return `السؤال رقم ${i + 1} يجب أن يحتوي على خيارين صحيحين على الأقل.`;
    }
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length || !q.options[q.correctIndex]?.trim()) {
      return `يرجى تحديد الإجابة الصحيحة للسؤال رقم ${i + 1}.`;
    }
  }
  return null;
}

export function gradeQuizSubmission(params: {
  quiz: LessonQuiz;
  selectedAnswers: Record<string, number>;
  ownerId?: string;
  nowIso?: string;
}): QuizAttempt {
  const nowIso = params.nowIso || new Date().toISOString();
  const results: QuizQuestionResult[] = params.quiz.questions.map((q) => {
    const selectedIndex =
      typeof params.selectedAnswers[q.id] === 'number' ? params.selectedAnswers[q.id] : -1;
    const isCorrect = selectedIndex === q.correctIndex;
    return {
      questionId: q.id,
      prompt: q.prompt,
      options: q.options,
      selectedIndex,
      correctIndex: q.correctIndex,
      isCorrect,
      explanation: q.explanation || `الإجابة الصحيحة: ${q.options[q.correctIndex] || ''}`,
    };
  });

  const score = results.filter((r) => r.isCorrect).length;
  const totalQuestions = results.length;
  const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
  const passed = totalQuestions > 0 && percentage >= (params.quiz.passPercent || 60);

  return {
    id: createSafeId('qatt'),
    ownerId: params.ownerId || params.quiz.ownerId,
    quizId: params.quiz.id,
    stepId: params.quiz.stepId,
    pathId: params.quiz.pathId,
    stepTitle: params.quiz.stepTitle,
    quizTitle: params.quiz.title,
    score,
    totalQuestions,
    percentage,
    passed,
    results,
    createdAt: nowIso,
  };
}

export function mergeReviewItemsFromAttempt(params: {
  existingItems: ReviewItem[];
  attempt: QuizAttempt;
  ownerId: string;
}): ReviewItem[] {
  const nowIso = params.attempt.createdAt || new Date().toISOString();
  const map = new Map<string, ReviewItem>();
  for (const item of params.existingItems) {
    map.set(item.questionId, item);
  }

  for (const r of params.attempt.results) {
    if (r.isCorrect) continue;
    const existing = map.get(r.questionId);
    if (existing) {
      map.set(r.questionId, {
        ...existing,
        prompt: r.prompt,
        options: r.options,
        correctIndex: r.correctIndex,
        explanation: r.explanation,
        wrongCount: existing.wrongCount + 1,
        mastered: false,
        lastWrongAt: nowIso,
        updatedAt: nowIso,
      });
    } else {
      map.set(r.questionId, {
        id: createSafeId('rev'),
        ownerId: params.ownerId,
        questionId: r.questionId,
        quizId: params.attempt.quizId,
        stepId: params.attempt.stepId,
        pathId: params.attempt.pathId,
        stepTitle: params.attempt.stepTitle,
        prompt: r.prompt,
        options: r.options,
        correctIndex: r.correctIndex,
        explanation: r.explanation,
        wrongCount: 1,
        correctCount: 0,
        mastered: false,
        lastWrongAt: nowIso,
        lastReviewedAt: '',
        updatedAt: nowIso,
      });
    }
  }

  return sortReviewQueue(Array.from(map.values()));
}

export function recordReviewAnswer(params: {
  item: ReviewItem;
  selectedIndex: number;
  nowIso?: string;
}): {
  isCorrect: boolean;
  updatedItem: ReviewItem;
  newlyMastered: boolean;
} {
  const nowIso = params.nowIso || new Date().toISOString();
  const isCorrect = params.selectedIndex === params.item.correctIndex;
  const nextCorrectCount = isCorrect ? params.item.correctCount + 1 : params.item.correctCount;
  const nextWrongCount = isCorrect ? params.item.wrongCount : params.item.wrongCount + 1;
  const mastered = isCorrect;
  const newlyMastered = mastered && !params.item.mastered;

  return {
    isCorrect,
    newlyMastered,
    updatedItem: {
      ...params.item,
      correctCount: nextCorrectCount,
      wrongCount: nextWrongCount,
      mastered,
      lastWrongAt: isCorrect ? params.item.lastWrongAt : nowIso,
      lastReviewedAt: nowIso,
      updatedAt: nowIso,
    },
  };
}

export function sortReviewQueue(items: ReviewItem[]): ReviewItem[] {
  return [...items].sort((a, b) => {
    if (a.mastered !== b.mastered) return a.mastered ? 1 : -1;
    if (a.wrongCount !== b.wrongCount) return b.wrongCount - a.wrongCount;
    return b.lastWrongAt.localeCompare(a.lastWrongAt);
  });
}

export function calculateReviewSummary(items: ReviewItem[]): {
  totalTracked: number;
  pendingCount: number;
  masteredCount: number;
  accuracyPercent: number;
  repeatMistakesCount: number;
} {
  const totalTracked = items.length;
  const masteredCount = items.filter((i) => i.mastered).length;
  const pendingCount = totalTracked - masteredCount;
  const repeatMistakesCount = items.filter((i) => !i.mastered && i.wrongCount > 1).length;
  const totalCorrect = items.reduce((s, i) => s + i.correctCount, 0);
  const totalWrong = items.reduce((s, i) => s + i.wrongCount, 0);
  const totalAnswers = totalCorrect + totalWrong;
  const accuracyPercent = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  return {
    totalTracked,
    pendingCount,
    masteredCount,
    accuracyPercent,
    repeatMistakesCount,
  };
}
