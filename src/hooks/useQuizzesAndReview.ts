import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  LessonQuiz,
  QuizAttempt,
  QuizQuestion,
  ReviewItem,
} from '../types/platform';
import { createSafeId } from '../utils/pathLogic';
import {
  calculateReviewSummary,
  gradeQuizSubmission,
  mergeReviewItemsFromAttempt,
  recordReviewAnswer,
  sortReviewQueue,
} from '../utils/quizLogic';

const LOCAL_QUIZ_REVIEW_KEY = 'masar_quizzes_review_v1';

interface LocalQuizReviewState {
  quizzes: LessonQuiz[];
  attempts: QuizAttempt[];
  reviewItems: ReviewItem[];
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function loadLocalQuizState(): LocalQuizReviewState {
  try {
    const raw = localStorage.getItem(LOCAL_QUIZ_REVIEW_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalQuizReviewState>;
      return {
        quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        reviewItems: Array.isArray(parsed.reviewItems) ? sortReviewQueue(parsed.reviewItems) : [],
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return { quizzes: [], attempts: [], reviewItems: [] };
}

function saveLocalQuizState(state: LocalQuizReviewState): void {
  try {
    localStorage.setItem(LOCAL_QUIZ_REVIEW_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota
  }
}

export function useQuizzesAndReview(user: User | null, authReady: boolean) {
  const [localState, setLocalState] = useState<LocalQuizReviewState>(() => loadLocalQuizState());
  const [cloudQuizzes, setCloudQuizzes] = useState<LessonQuiz[]>([]);
  const [cloudAttempts, setCloudAttempts] = useState<QuizAttempt[]>([]);
  const [cloudReviewItems, setCloudReviewItems] = useState<ReviewItem[]>([]);

  useEffect(() => {
    saveLocalQuizState(localState);
  }, [localState]);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudQuizzes([]);
      setCloudAttempts([]);
      setCloudReviewItems([]);
      return;
    }

    const qPath = `users/${user.uid}/quizzes`;
    const unsubQ = onSnapshot(
      query(collection(db, qPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: LessonQuiz[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              stepId: String(data.stepId || ''),
              pathId: String(data.pathId || ''),
              stepTitle: String(data.stepTitle || ''),
              title: String(data.title || ''),
              passPercent: typeof data.passPercent === 'number' ? data.passPercent : 60,
              source: (data.source === 'ai' ? 'ai' : 'manual') as 'ai' | 'manual',
              questions: Array.isArray(data.questions) ? (data.questions as QuizQuestion[]) : [],
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        setCloudQuizzes(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, qPath)
    );

    const aPath = `users/${user.uid}/quizAttempts`;
    const unsubA = onSnapshot(
      query(collection(db, aPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: QuizAttempt[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              quizId: String(data.quizId || ''),
              stepId: String(data.stepId || ''),
              pathId: String(data.pathId || ''),
              stepTitle: String(data.stepTitle || ''),
              quizTitle: String(data.quizTitle || ''),
              score: typeof data.score === 'number' ? data.score : 0,
              totalQuestions: typeof data.totalQuestions === 'number' ? data.totalQuestions : 1,
              percentage: typeof data.percentage === 'number' ? data.percentage : 0,
              passed: Boolean(data.passed),
              results: Array.isArray(data.results) ? data.results : [],
              createdAt: toIsoString(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCloudAttempts(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, aPath)
    );

    const rPath = `users/${user.uid}/reviewItems`;
    const unsubR = onSnapshot(
      query(collection(db, rPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: ReviewItem[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            ownerId: String(data.ownerId || user.uid),
            questionId: String(data.questionId || ''),
            quizId: String(data.quizId || ''),
            stepId: String(data.stepId || ''),
            pathId: String(data.pathId || ''),
            stepTitle: String(data.stepTitle || ''),
            prompt: String(data.prompt || ''),
            options: Array.isArray(data.options) ? data.options.map(String) : [],
            correctIndex: typeof data.correctIndex === 'number' ? data.correctIndex : 0,
            explanation: String(data.explanation || ''),
            wrongCount: typeof data.wrongCount === 'number' ? data.wrongCount : 1,
            correctCount: typeof data.correctCount === 'number' ? data.correctCount : 0,
            mastered: Boolean(data.mastered),
            lastWrongAt: String(data.lastWrongAt || ''),
            lastReviewedAt: String(data.lastReviewedAt || ''),
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setCloudReviewItems(sortReviewQueue(list));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, rPath)
    );

    return () => {
      unsubQ();
      unsubA();
      unsubR();
    };
  }, [authReady, user]);

  const quizzes = user ? cloudQuizzes : localState.quizzes;
  const attempts = user ? cloudAttempts : localState.attempts;
  const reviewItems = user ? cloudReviewItems : localState.reviewItems;

  const saveQuiz = useCallback(
    async (input: {
      quizId?: string;
      stepId: string;
      pathId: string;
      stepTitle: string;
      title: string;
      passPercent: number;
      source: 'ai' | 'manual';
      questions: QuizQuestion[];
    }): Promise<LessonQuiz> => {
      const nowIso = new Date().toISOString();
      const quizId = input.quizId || createSafeId('quiz');
      const existing = quizzes.find((q) => q.id === quizId);

      const sanitizedQuestions: QuizQuestion[] = input.questions.slice(0, 30).map((q) => ({
        id: (q.id || createSafeId('qq')).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96),
        type: q.type === 'true_false' ? 'true_false' : 'multiple_choice',
        prompt: q.prompt.trim().slice(0, 420),
        options: q.options.slice(0, 6).map((o) => o.trim().slice(0, 200)),
        correctIndex: Math.max(0, Math.min(q.correctIndex, Math.max(0, q.options.length - 1))),
        explanation: (q.explanation || '').trim().slice(0, 520),
      }));

      const quiz: LessonQuiz = {
        id: quizId,
        ownerId: user?.uid || 'local',
        stepId: input.stepId.slice(0, 128),
        pathId: input.pathId.slice(0, 128),
        stepTitle: input.stepTitle.trim().slice(0, 200),
        title: input.title.trim().slice(0, 200),
        passPercent: Math.max(1, Math.min(100, Math.round(input.passPercent || 60))),
        source: input.source,
        questions: sanitizedQuestions,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          quizzes: [quiz, ...prev.quizzes.filter((q) => q.id !== quiz.id)],
        }));
        return quiz;
      }

      const path = `users/${user.uid}/quizzes/${quiz.id}`;
      try {
        if (existing) {
          await updateDoc(doc(db, path), {
            stepId: quiz.stepId,
            pathId: quiz.pathId,
            stepTitle: quiz.stepTitle,
            title: quiz.title,
            passPercent: quiz.passPercent,
            source: quiz.source,
            questions: quiz.questions,
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, path), {
            ...quiz,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        return quiz;
      } catch (err) {
        handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, path);
        return quiz;
      }
    },
    [quizzes, user]
  );

  const submitQuizAttempt = useCallback(
    async (
      quiz: LessonQuiz,
      selectedAnswers: Record<string, number>
    ): Promise<{ attempt: QuizAttempt; wrongCount: number }> => {
      const attempt = gradeQuizSubmission({
        quiz,
        selectedAnswers,
        ownerId: user?.uid || 'local',
      });
      const wrongCount = attempt.results.filter((r) => !r.isCorrect).length;

      const updatedQueue = mergeReviewItemsFromAttempt({
        existingItems: reviewItems,
        attempt,
        ownerId: user?.uid || 'local',
      });

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          attempts: [attempt, ...prev.attempts],
          reviewItems: updatedQueue,
        }));
        return { attempt, wrongCount };
      }

      try {
        const batch = writeBatch(db);
        batch.set(doc(db, `users/${user.uid}/quizAttempts/${attempt.id}`), {
          ...attempt,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });

        for (const r of attempt.results) {
          if (r.isCorrect) continue;
          const matched = updatedQueue.find((item) => item.questionId === r.questionId);
          if (!matched) continue;
          batch.set(doc(db, `users/${user.uid}/reviewItems/${matched.id}`), {
            ...matched,
            ownerId: user.uid,
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();
        return { attempt, wrongCount };
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.CREATE,
          `users/${user.uid}/quizAttempts/${attempt.id}`
        );
        return { attempt, wrongCount };
      }
    },
    [reviewItems, user]
  );

  const answerReviewItem = useCallback(
    async (item: ReviewItem, selectedIndex: number) => {
      const res = recordReviewAnswer({ item, selectedIndex });

      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          reviewItems: sortReviewQueue(
            prev.reviewItems.map((r) => (r.id === item.id ? res.updatedItem : r))
          ),
        }));
        return res;
      }

      const path = `users/${user.uid}/reviewItems/${item.id}`;
      try {
        await setDoc(doc(db, path), {
          ...res.updatedItem,
          ownerId: user.uid,
          updatedAt: serverTimestamp(),
        });
        return res;
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
        return res;
      }
    },
    [user]
  );

  const deleteReviewItem = useCallback(
    async (reviewId: string) => {
      if (!user) {
        setLocalState((prev) => ({
          ...prev,
          reviewItems: prev.reviewItems.filter((r) => r.id !== reviewId),
        }));
        return;
      }

      const path = `users/${user.uid}/reviewItems/${reviewId}`;
      try {
        await deleteDoc(doc(db, path));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const reviewSummary = useMemo(() => calculateReviewSummary(reviewItems), [reviewItems]);
  const passedQuizzesCount = useMemo(
    () => new Set(attempts.filter((a) => a.passed).map((a) => a.quizId)).size,
    [attempts]
  );
  const pendingReviewCount = reviewSummary.pendingCount;

  return {
    quizzes,
    attempts,
    reviewItems,
    reviewSummary,
    passedQuizzesCount,
    masteredReviewsCount: reviewSummary.masteredCount,
    pendingReviewCount,
    saveQuiz,
    submitQuizAttempt,
    answerReviewItem,
    deleteReviewItem,
  };
}
