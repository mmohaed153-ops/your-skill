import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  calculateReviewSummary,
  gradeQuizSubmission,
  mergeReviewItemsFromAttempt,
  recordReviewAnswer,
  validateQuizInput,
} from './quizLogic';
import type { LessonQuiz, ReviewItem } from '../types/platform';

const SAMPLE_QUIZ: LessonQuiz = {
  id: 'quiz_1',
  ownerId: 'u1',
  stepId: 'step_1',
  pathId: 'path_1',
  stepTitle: 'مقدمة في GDScript',
  title: 'اختبار أساسيات المتغيرات',
  passPercent: 60,
  source: 'manual',
  questions: [
    {
      id: 'q1',
      type: 'multiple_choice',
      prompt: 'أي كلمة مفتاحية تُستخدم لتعريف متغير في GDScript؟',
      options: ['var', 'func', 'class', 'signal'],
      correctIndex: 0,
      explanation: 'تُستخدم كلمة var لتعريف المتغيرات.',
    },
    {
      id: 'q2',
      type: 'true_false',
      prompt: 'الإشارات (Signals) تساعد على فصل مكونات اللعبة عن بعضها.',
      options: ['صح', 'خطأ'],
      correctIndex: 0,
      explanation: 'الإشارات هي النمط الأساسي للتواصل بين العقد دون اقتران مباشر.',
    },
  ],
  createdAt: '2026-04-10T10:00:00Z',
  updatedAt: '2026-04-10T10:00:00Z',
};

describe('quizLogic', () => {
  it('validates manual quiz inputs accurately', () => {
    assert.ok(validateQuizInput({ title: '', questions: SAMPLE_QUIZ.questions }));
    assert.ok(validateQuizInput({ title: 'اختبار', questions: [] }));
    assert.equal(validateQuizInput({ title: 'اختبار جاهز', questions: SAMPLE_QUIZ.questions }), null);
  });

  it('grades submissions, computes pass status, and moves wrong answers ONLY into Smart Review', () => {
    const attempt = gradeQuizSubmission({
      quiz: SAMPLE_QUIZ,
      selectedAnswers: { q1: 1, q2: 0 }, // q1 wrong, q2 correct -> 50% (fail < 60%)
      ownerId: 'u1',
      nowIso: '2026-04-10T11:00:00Z',
    });

    assert.equal(attempt.score, 1);
    assert.equal(attempt.totalQuestions, 2);
    assert.equal(attempt.percentage, 50);
    assert.equal(attempt.passed, false);

    const reviewQueue = mergeReviewItemsFromAttempt({
      existingItems: [],
      attempt,
      ownerId: 'u1',
    });

    assert.equal(reviewQueue.length, 1);
    assert.equal(reviewQueue[0].questionId, 'q1');
    assert.equal(reviewQueue[0].wrongCount, 1);
    assert.equal(reviewQueue[0].mastered, false);

    // Repeat mistake increases priority count
    const queue2 = mergeReviewItemsFromAttempt({
      existingItems: reviewQueue,
      attempt,
      ownerId: 'u1',
    });
    assert.equal(queue2[0].wrongCount, 2);
  });

  it('updates Smart Review mastery and accuracy when learner answers correctly during review', () => {
    const item: ReviewItem = {
      id: 'rev_1',
      ownerId: 'u1',
      questionId: 'q1',
      quizId: 'quiz_1',
      stepId: 'step_1',
      pathId: 'path_1',
      stepTitle: 'مقدمة',
      prompt: 'سؤال؟',
      options: ['أ', 'ب'],
      correctIndex: 0,
      explanation: 'توضيح',
      wrongCount: 2,
      correctCount: 0,
      mastered: false,
      lastWrongAt: '2026-04-10T10:00:00Z',
      lastReviewedAt: '',
      updatedAt: '2026-04-10T10:00:00Z',
    };

    const res = recordReviewAnswer({ item, selectedIndex: 0, nowIso: '2026-04-10T12:00:00Z' });
    assert.equal(res.isCorrect, true);
    assert.equal(res.newlyMastered, true);
    assert.equal(res.updatedItem.mastered, true);
    assert.equal(res.updatedItem.correctCount, 1);

    const summary = calculateReviewSummary([res.updatedItem]);
    assert.equal(summary.masteredCount, 1);
    assert.equal(summary.pendingCount, 0);
  });
});
