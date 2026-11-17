import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateLearningStats,
  applyXpGrant,
  buildRewardKey,
  createInitialGamificationProfile,
  evaluateBadges,
  evaluateStreak,
  getLevelProgress,
  getWeekKey,
  XP_REWARDS,
} from './gamificationLogic';
import type { LearningPath, VideoStep } from '../types/learning';
import type { DailyActivityRecord, XpTransaction } from '../types/platform';

describe('gamificationLogic', () => {
  it('computes progressive level thresholds starting at Level 1', () => {
    const l1 = getLevelProgress(0);
    assert.equal(l1.level, 1);
    assert.equal(l1.nextLevelXp, 100);
    assert.equal(l1.progressPercent, 0);

    const l2 = getLevelProgress(100);
    assert.equal(l2.level, 2);
    assert.equal(l2.currentLevelFloorXp, 100);
    assert.equal(l2.nextLevelXp, 250);

    const l3 = getLevelProgress(250);
    assert.equal(l3.level, 3);
  });

  it('grants XP once per deterministic rewardKey and prevents duplicate XP farming', () => {
    const profile = createInitialGamificationProfile('user_1', new Date('2026-04-10T10:00:00Z'));
    const txList: XpTransaction[] = [];

    const first = applyXpGrant({
      profile,
      transactions: txList,
      actionKind: 'lesson_complete',
      targetId: 'step_abc',
      points: XP_REWARDS.lesson_complete,
      title: 'إتمام الدرس 1',
      now: new Date('2026-04-10T10:00:00Z'),
    });

    assert.equal(first.granted, true);
    assert.equal(first.nextProfile.totalXp, 30);
    assert.ok(first.transaction);
    assert.equal(first.transaction.rewardKey, buildRewardKey('lesson_complete', 'step_abc'));

    txList.push(first.transaction);

    const duplicate = applyXpGrant({
      profile: first.nextProfile,
      transactions: txList,
      actionKind: 'lesson_complete',
      targetId: 'step_abc',
      points: XP_REWARDS.lesson_complete,
      title: 'إتمام الدرس 1',
      now: new Date('2026-04-10T10:05:00Z'),
    });

    assert.equal(duplicate.granted, false);
    assert.equal(duplicate.transaction, null);
    assert.equal(duplicate.nextProfile.totalXp, 30);
  });

  it('resets weeklyXp cleanly when weekKey changes while preserving totalXp', () => {
    const p = createInitialGamificationProfile('user_1', new Date('2026-04-06T10:00:00Z'));
    const r1 = applyXpGrant({
      profile: p,
      transactions: [],
      actionKind: 'quiz_pass',
      targetId: 'quiz_1',
      points: 100,
      title: 'اجتياز اختبار',
      now: new Date('2026-04-06T10:00:00Z'),
    });
    assert.equal(r1.leveledUp, true);
    assert.equal(r1.newLevel, 2);
    assert.equal(r1.nextProfile.weeklyXp, 100);

    const nextWeekDate = new Date('2026-04-20T10:00:00Z');
    assert.notEqual(getWeekKey(nextWeekDate), r1.nextProfile.weekKey);

    const r2 = applyXpGrant({
      profile: r1.nextProfile,
      transactions: [r1.transaction!],
      actionKind: 'video_watch',
      targetId: 'step_2',
      points: 15,
      title: 'مشاهدة فيديو',
      now: nextWeekDate,
    });

    assert.equal(r2.granted, true);
    assert.equal(r2.nextProfile.totalXp, 115);
    assert.equal(r2.nextProfile.weeklyXp, 15);
  });

  it('evaluates consecutive daily streak, longest record, and milestone triggers', () => {
    const activities: DailyActivityRecord[] = [
      {
        id: '2026-04-08',
        ownerId: 'u',
        dateIso: '2026-04-08',
        minutesLearned: 20,
        videosWatched: 1,
        lessonsCompleted: 1,
        tasksCompleted: 0,
        quizzesCompleted: 0,
        reviewsCompleted: 0,
        xpEarned: 30,
        updatedAt: '2026-04-08T12:00:00Z',
      },
      {
        id: '2026-04-09',
        ownerId: 'u',
        dateIso: '2026-04-09',
        minutesLearned: 25,
        videosWatched: 1,
        lessonsCompleted: 1,
        tasksCompleted: 0,
        quizzesCompleted: 0,
        reviewsCompleted: 0,
        xpEarned: 30,
        updatedAt: '2026-04-09T12:00:00Z',
      },
      {
        id: '2026-04-10',
        ownerId: 'u',
        dateIso: '2026-04-10',
        minutesLearned: 30,
        videosWatched: 1,
        lessonsCompleted: 1,
        tasksCompleted: 0,
        quizzesCompleted: 0,
        reviewsCompleted: 0,
        xpEarned: 45,
        updatedAt: '2026-04-10T12:00:00Z',
      },
    ];

    const streak = evaluateStreak({
      activities,
      transactions: [],
      steps: [],
      previousLongestStreak: 2,
      todayIso: '2026-04-10',
    });

    assert.equal(streak.currentStreak, 3);
    assert.equal(streak.longestStreak, 3);
    assert.equal(streak.isNewRecord, true);
    assert.ok(streak.newlyReachedMilestones.some((m) => m.days === 3));
  });

  it('evaluates badges accurately and detects newly unlocked ones', () => {
    const res = evaluateBadges({
      metrics: {
        completedLessonsCount: 1,
        longestStreak: 7,
        currentStreak: 7,
        completedPathsCount: 1,
        completedProjectsCount: 1,
        passedQuizzesCount: 0,
        masteredReviewsCount: 0,
        favoritesCount: 0,
        completedSkillsCount: 0,
      },
      unlockedBadgeIds: [],
      badgeUnlockedAt: {},
      nowIso: '2026-04-10T12:00:00Z',
    });

    const ids = res.newlyUnlocked.map((b) => b.id);
    assert.ok(ids.includes('first_lesson'));
    assert.ok(ids.includes('streak_7'));
    assert.ok(ids.includes('master_student'));
    assert.ok(ids.includes('project_creator'));
    assert.ok(!ids.includes('fast_learner'));
  });

  it('aggregates real statistics from paths, steps, todos, courses, and activities', () => {
    const paths: LearningPath[] = [
      {
        id: 'p1',
        ownerId: 'u',
        title: 'مسار 1',
        description: '',
        coverImage: '',
        createdAt: '',
        updatedAt: '',
      },
    ];
    const stepsByPath: Record<string, VideoStep[]> = {
      p1: [
        {
          id: 's1',
          pathId: 'p1',
          ownerId: 'u',
          title: 'درس 1',
          description: '',
          videoUrl: 'https://youtube.com/watch?v=abc',
          thumbnailUrl: '',
          order: 0,
          completed: true,
          completedAt: '2026-04-10T10:00:00Z',
          targetDate: '',
          quickNotes: '',
          quickNotesUpdatedAt: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
    };

    const stats = aggregateLearningStats({
      paths,
      stepsByPath,
      todos: [],
      courses: [],
      activities: [],
      todayIso: '2026-04-10',
    });

    assert.equal(stats.completedVideosCount, 1);
    assert.equal(stats.completedPathsCount, 1);
    assert.equal(stats.overallCompletionPercent, 100);
    assert.equal(stats.dailyBuckets.length, 14);
  });
});
