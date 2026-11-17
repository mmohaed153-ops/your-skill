import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
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
import type { LearningPath, VideoStep } from '../types/learning';
import type {
  AppSectionAlias,
  CertificateRecord,
  DailyActivityRecord,
  EvaluatedBadgeStatus,
  EvaluatedSkillNode,
  GamificationProfileState,
  LeaderboardEntry,
  NotificationKind,
  PlatformNotification,
  PracticalProject,
  SkillNode,
  XpActionKind,
  XpTransaction,
} from '../types/platform';
import type { CourseItem, TodoTask } from '../types/workspace';
import { buildCertificateForCompletedPath } from '../utils/certificateLogic';
import {
  aggregateLearningStats,
  applyXpGrant,
  buildRewardKey,
  createInitialGamificationProfile,
  evaluateBadges,
  evaluateStreak,
  getLevelProgress,
  getMonthKey,
  getWeekKey,
  toLocalDateIso,
  XP_REWARDS,
} from '../utils/gamificationLogic';
import { createSafeId } from '../utils/pathLogic';
import { createStarterSkillNodes, evaluateSkillTree } from '../utils/skillTreeLogic';

const LOCAL_GAMIFICATION_KEY = 'masar_platform_gamification_v1';

interface LocalGamificationBundle {
  profile: GamificationProfileState;
  transactions: XpTransaction[];
  dailyActivities: DailyActivityRecord[];
  skills: SkillNode[];
  certificates: CertificateRecord[];
  notifications: PlatformNotification[];
}

export interface CelebrationAlert {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  xpDelta?: number;
  targetSection?: AppSectionAlias;
}

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date().toISOString();
}

function loadLocalBundle(): LocalGamificationBundle {
  try {
    const raw = localStorage.getItem(LOCAL_GAMIFICATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalGamificationBundle>;
      if (parsed.profile) {
        return {
          profile: {
            ...createInitialGamificationProfile('local'),
            ...parsed.profile,
          },
          transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
          dailyActivities: Array.isArray(parsed.dailyActivities) ? parsed.dailyActivities : [],
          skills:
            Array.isArray(parsed.skills) && parsed.skills.length > 0
              ? parsed.skills
              : createStarterSkillNodes('local'),
          certificates: Array.isArray(parsed.certificates) ? parsed.certificates : [],
          notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
        };
      }
    }
  } catch {
    // fallback to clean initial state
  }
  return {
    profile: createInitialGamificationProfile('local'),
    transactions: [],
    dailyActivities: [],
    skills: createStarterSkillNodes('local'),
    certificates: [],
    notifications: [],
  };
}

function saveLocalBundle(bundle: LocalGamificationBundle): void {
  try {
    localStorage.setItem(LOCAL_GAMIFICATION_KEY, JSON.stringify(bundle));
  } catch {
    // ignore storage quota errors
  }
}

export interface UsePlatformGamificationParams {
  user: User | null;
  authReady: boolean;
  paths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  todos: TodoTask[];
  courses: CourseItem[];
  projects: PracticalProject[];
  passedQuizzesCount: number;
  masteredReviewsCount: number;
  favoritesCount: number;
  publicUsername?: string;
}

export function usePlatformGamification({
  user,
  authReady,
  paths,
  stepsByPath,
  todos,
  courses,
  projects,
  passedQuizzesCount,
  masteredReviewsCount,
  favoritesCount,
  publicUsername = '',
}: UsePlatformGamificationParams) {
  const [localBundle, setLocalBundle] = useState<LocalGamificationBundle>(() => loadLocalBundle());

  const [cloudProfile, setCloudProfile] = useState<GamificationProfileState | null>(null);
  const [cloudTransactions, setCloudTransactions] = useState<XpTransaction[]>([]);
  const [cloudActivities, setCloudActivities] = useState<DailyActivityRecord[]>([]);
  const [cloudSkills, setCloudSkills] = useState<SkillNode[]>([]);
  const [cloudCertificates, setCloudCertificates] = useState<CertificateRecord[]>([]);
  const [cloudNotifications, setCloudNotifications] = useState<PlatformNotification[]>([]);
  const [cloudLeaderboard, setCloudLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [activeCelebration, setActiveCelebration] = useState<CelebrationAlert | null>(null);
  const seededUidRef = useRef<string | null>(null);
  const processingMetaRef = useRef<boolean>(false);

  useEffect(() => {
    saveLocalBundle(localBundle);
  }, [localBundle]);

  const showCelebration = useCallback((alert: Omit<CelebrationAlert, 'id'>) => {
    const id = createSafeId('cel');
    setActiveCelebration({ ...alert, id });
    window.setTimeout(() => {
      setActiveCelebration((prev) => (prev?.id === id ? null : prev));
    }, 5200);
  }, []);

  const dismissCelebration = useCallback(() => {
    setActiveCelebration(null);
  }, []);

  // Seed cloud profile & starter skills on sign-in if empty
  const seedCloudIfEmpty = useCallback(async (uid: string) => {
    if (seededUidRef.current === uid) return;
    seededUidRef.current = uid;
    try {
      const profileRef = doc(db, `users/${uid}/gamification/profile`);
      const profileSnap = await getDoc(profileRef);
      if (!profileSnap.exists()) {
        const init = createInitialGamificationProfile(uid);
        await setDoc(profileRef, {
          ...init,
          updatedAt: serverTimestamp(),
        });
      }

      const skillsCol = `users/${uid}/skills`;
      const skillsSnap = await getDocs(
        query(collection(db, skillsCol), where('ownerId', '==', uid))
      );
      if (skillsSnap.empty) {
        const starterSkills = createStarterSkillNodes(uid);
        const batch = writeBatch(db);
        for (const s of starterSkills) {
          batch.set(doc(db, `${skillsCol}/${s.id}`), {
            ...s,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${uid}/gamification/profile`);
    }
  }, []);

  // Cloud subscriptions
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setCloudProfile(null);
      setCloudTransactions([]);
      setCloudActivities([]);
      setCloudSkills([]);
      setCloudCertificates([]);
      setCloudNotifications([]);
      setCloudLeaderboard([]);
      seededUidRef.current = null;
      return;
    }

    void seedCloudIfEmpty(user.uid);

    const profilePath = `users/${user.uid}/gamification/profile`;
    const unsubProfile = onSnapshot(
      doc(db, profilePath),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        const now = new Date();
        const currWeek = getWeekKey(now);
        const currMonth = getMonthKey(now);
        const storedWeek = String(d.weekKey || currWeek);
        const storedMonth = String(d.monthKey || currMonth);

        setCloudProfile({
          id: 'profile',
          ownerId: String(d.ownerId || user.uid),
          totalXp: typeof d.totalXp === 'number' ? d.totalXp : 0,
          weeklyXp: storedWeek === currWeek && typeof d.weeklyXp === 'number' ? d.weeklyXp : 0,
          monthlyXp: storedMonth === currMonth && typeof d.monthlyXp === 'number' ? d.monthlyXp : 0,
          weekKey: currWeek,
          monthKey: currMonth,
          level: typeof d.level === 'number' ? d.level : 1,
          currentStreak: typeof d.currentStreak === 'number' ? d.currentStreak : 0,
          longestStreak: typeof d.longestStreak === 'number' ? d.longestStreak : 0,
          lastActiveDate: String(d.lastActiveDate || ''),
          unlockedBadgeIds: Array.isArray(d.unlockedBadgeIds) ? d.unlockedBadgeIds.map(String) : [],
          badgeUnlockedAt:
            d.badgeUnlockedAt && typeof d.badgeUnlockedAt === 'object'
              ? (d.badgeUnlockedAt as Record<string, string>)
              : {},
          totalVideosWatched: typeof d.totalVideosWatched === 'number' ? d.totalVideosWatched : 0,
          totalQuizzesPassed: typeof d.totalQuizzesPassed === 'number' ? d.totalQuizzesPassed : 0,
          totalReviewsCompleted:
            typeof d.totalReviewsCompleted === 'number' ? d.totalReviewsCompleted : 0,
          updatedAt: toIsoString(d.updatedAt),
        });
      },
      (err) => handleFirestoreError(err, OperationType.GET, profilePath)
    );

    const txPath = `users/${user.uid}/xpTransactions`;
    const unsubTx = onSnapshot(
      query(collection(db, txPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: XpTransaction[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              rewardKey: String(data.rewardKey || d.id),
              actionKind: data.actionKind as XpActionKind,
              points: typeof data.points === 'number' ? data.points : 0,
              title: String(data.title || ''),
              detail: String(data.detail || ''),
              relatedId: String(data.relatedId || ''),
              dateIso: String(data.dateIso || ''),
              createdAt: toIsoString(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCloudTransactions(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, txPath)
    );

    const actPath = `users/${user.uid}/dailyActivities`;
    const unsubAct = onSnapshot(
      query(collection(db, actPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: DailyActivityRecord[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: String(data.id || d.id),
            ownerId: String(data.ownerId || user.uid),
            dateIso: String(data.dateIso || d.id),
            minutesLearned: typeof data.minutesLearned === 'number' ? data.minutesLearned : 0,
            videosWatched: typeof data.videosWatched === 'number' ? data.videosWatched : 0,
            lessonsCompleted: typeof data.lessonsCompleted === 'number' ? data.lessonsCompleted : 0,
            tasksCompleted: typeof data.tasksCompleted === 'number' ? data.tasksCompleted : 0,
            quizzesCompleted: typeof data.quizzesCompleted === 'number' ? data.quizzesCompleted : 0,
            reviewsCompleted: typeof data.reviewsCompleted === 'number' ? data.reviewsCompleted : 0,
            xpEarned: typeof data.xpEarned === 'number' ? data.xpEarned : 0,
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setCloudActivities(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, actPath)
    );

    const skillsPath = `users/${user.uid}/skills`;
    const unsubSkills = onSnapshot(
      query(collection(db, skillsPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: SkillNode[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              title: String(data.title || ''),
              description: String(data.description || ''),
              levelNumber: typeof data.levelNumber === 'number' ? data.levelNumber : 1,
              columnIndex: typeof data.columnIndex === 'number' ? data.columnIndex : 0,
              category: String(data.category || 'عام'),
              prerequisiteIds: Array.isArray(data.prerequisiteIds)
                ? data.prerequisiteIds.map(String)
                : [],
              linkedPathIds: Array.isArray(data.linkedPathIds) ? data.linkedPathIds.map(String) : [],
              linkedCourseIds: Array.isArray(data.linkedCourseIds)
                ? data.linkedCourseIds.map(String)
                : [],
              linkedProjectIds: Array.isArray(data.linkedProjectIds)
                ? data.linkedProjectIds.map(String)
                : [],
              xpReward: typeof data.xpReward === 'number' ? data.xpReward : 50,
              isCustom: Boolean(data.isCustom),
              createdAt: toIsoString(data.createdAt),
              updatedAt: toIsoString(data.updatedAt),
            };
          })
          .sort((a, b) => a.levelNumber - b.levelNumber || a.columnIndex - b.columnIndex);
        setCloudSkills(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, skillsPath)
    );

    const certsPath = `users/${user.uid}/certificates`;
    const unsubCerts = onSnapshot(
      query(collection(db, certsPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: CertificateRecord[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              pathId: String(data.pathId || ''),
              pathTitle: String(data.pathTitle || ''),
              recipientName: String(data.recipientName || ''),
              verificationCode: String(data.verificationCode || ''),
              lessonsCount: typeof data.lessonsCount === 'number' ? data.lessonsCount : 1,
              totalHoursLabel: String(data.totalHoursLabel || ''),
              completedAt: String(data.completedAt || ''),
              issuedAt: toIsoString(data.issuedAt),
            };
          })
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
        setCloudCertificates(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, certsPath)
    );

    const notifPath = `users/${user.uid}/notifications`;
    const unsubNotifs = onSnapshot(
      query(collection(db, notifPath), where('ownerId', '==', user.uid)),
      (snap) => {
        const list: PlatformNotification[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: String(data.id || d.id),
              ownerId: String(data.ownerId || user.uid),
              kind: data.kind as NotificationKind,
              title: String(data.title || ''),
              message: String(data.message || ''),
              read: Boolean(data.read),
              targetSection: (data.targetSection || 'dashboard') as AppSectionAlias,
              createdAt: toIsoString(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setCloudNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, notifPath)
    );

    const unsubLb = onSnapshot(
      collection(db, 'leaderboard'),
      (snap) => {
        const currWeek = getWeekKey();
        const currMonth = getMonthKey();
        const list: LeaderboardEntry[] = snap.docs.map((d) => {
          const data = d.data();
          const sameWeek = String(data.weekKey || '') === currWeek;
          const sameMonth = String(data.monthKey || '') === currMonth;
          return {
            uid: String(data.uid || d.id),
            displayName: String(data.displayName || 'متعلم'),
            username: String(data.username || ''),
            avatarLetter: String(data.avatarLetter || 'م'),
            level: typeof data.level === 'number' ? data.level : 1,
            totalXp: typeof data.totalXp === 'number' ? data.totalXp : 0,
            weeklyXp: sameWeek && typeof data.weeklyXp === 'number' ? data.weeklyXp : 0,
            monthlyXp: sameMonth && typeof data.monthlyXp === 'number' ? data.monthlyXp : 0,
            weekKey: currWeek,
            monthKey: currMonth,
            currentStreak: typeof data.currentStreak === 'number' ? data.currentStreak : 0,
            badgesCount: typeof data.badgesCount === 'number' ? data.badgesCount : 0,
            updatedAt: toIsoString(data.updatedAt),
          };
        });
        setCloudLeaderboard(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'leaderboard')
    );

    return () => {
      unsubProfile();
      unsubTx();
      unsubAct();
      unsubSkills();
      unsubCerts();
      unsubNotifs();
      unsubLb();
    };
  }, [authReady, user, seedCloudIfEmpty]);

  const rawProfile = user
    ? cloudProfile || createInitialGamificationProfile(user.uid)
    : localBundle.profile;
  const transactions = user ? cloudTransactions : localBundle.transactions;
  const dailyActivities = user ? cloudActivities : localBundle.dailyActivities;
  const skills = user
    ? cloudSkills.length > 0
      ? cloudSkills
      : createStarterSkillNodes(user.uid)
    : localBundle.skills;
  const certificates = user ? cloudCertificates : localBundle.certificates;
  const notifications = user ? cloudNotifications : localBundle.notifications;

  const allSteps = useMemo(
    () => paths.flatMap((p) => stepsByPath[p.id] || []),
    [paths, stepsByPath]
  );

  const levelSummary = useMemo(
    () => getLevelProgress(rawProfile.totalXp),
    [rawProfile.totalXp]
  );

  const streakResult = useMemo(
    () =>
      evaluateStreak({
        activities: dailyActivities,
        transactions,
        steps: allSteps,
        previousLongestStreak: rawProfile.longestStreak,
      }),
    [dailyActivities, transactions, allSteps, rawProfile.longestStreak]
  );

  const evaluatedSkills = useMemo<EvaluatedSkillNode[]>(
    () =>
      evaluateSkillTree({
        nodes: skills,
        stepsByPath,
        courses,
        projects,
      }),
    [skills, stepsByPath, courses, projects]
  );

  const statsSummary = useMemo(
    () =>
      aggregateLearningStats({
        paths,
        stepsByPath,
        todos,
        courses,
        activities: dailyActivities,
      }),
    [paths, stepsByPath, todos, courses, dailyActivities]
  );

  const badgeEval = useMemo(
    () =>
      evaluateBadges({
        metrics: {
          completedLessonsCount: statsSummary.completedVideosCount,
          longestStreak: streakResult.longestStreak,
          currentStreak: streakResult.currentStreak,
          completedPathsCount: statsSummary.completedPathsCount,
          completedProjectsCount: projects.filter((p) => p.status === 'completed').length,
          passedQuizzesCount,
          masteredReviewsCount,
          favoritesCount,
          completedSkillsCount: evaluatedSkills.filter((s) => s.status === 'completed').length,
        },
        unlockedBadgeIds: rawProfile.unlockedBadgeIds,
        badgeUnlockedAt: rawProfile.badgeUnlockedAt,
      }),
    [
      statsSummary.completedVideosCount,
      statsSummary.completedPathsCount,
      streakResult.longestStreak,
      streakResult.currentStreak,
      projects,
      passedQuizzesCount,
      masteredReviewsCount,
      favoritesCount,
      evaluatedSkills,
      rawProfile.unlockedBadgeIds,
      rawProfile.badgeUnlockedAt,
    ]
  );

  const badges: EvaluatedBadgeStatus[] = badgeEval.statuses;

  // Build notification helper
  const emitNotification = useCallback(
    async (input: {
      kind: NotificationKind;
      title: string;
      message: string;
      targetSection: AppSectionAlias;
      celebrate?: boolean;
      xpDelta?: number;
    }) => {
      const notifId = createSafeId('notif');
      const nowIso = new Date().toISOString();
      const notif: PlatformNotification = {
        id: notifId,
        ownerId: user?.uid || 'local',
        kind: input.kind,
        title: input.title.slice(0, 160),
        message: input.message.slice(0, 400),
        read: false,
        targetSection: input.targetSection,
        createdAt: nowIso,
      };

      if (input.celebrate) {
        showCelebration({
          kind: input.kind,
          title: input.title,
          message: input.message,
          xpDelta: input.xpDelta,
          targetSection: input.targetSection,
        });
      }

      if (!user) {
        setLocalBundle((prev) => ({
          ...prev,
          notifications: [notif, ...prev.notifications].slice(0, 80),
        }));
        return;
      }

      const path = `users/${user.uid}/notifications/${notifId}`;
      try {
        await setDoc(doc(db, path), {
          id: notif.id,
          ownerId: user.uid,
          kind: notif.kind,
          title: notif.title,
          message: notif.message,
          read: false,
          targetSection: notif.targetSection,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [user, showCelebration]
  );

  // Core idempotent XP & Activity writer
  const grantXpAndActivity = useCallback(
    async (params: {
      actionKind: XpActionKind;
      targetId: string;
      points: number;
      title: string;
      detail?: string;
      relatedId?: string;
      minutesDelta?: number;
      videosDelta?: number;
      lessonsDelta?: number;
      tasksDelta?: number;
      quizzesDelta?: number;
      reviewsDelta?: number;
      targetSection?: AppSectionAlias;
      notifKind?: NotificationKind;
      silent?: boolean;
    }): Promise<boolean> => {
      const now = new Date();
      const dateIso = toLocalDateIso(now);

      const grant = applyXpGrant({
        profile: rawProfile,
        transactions,
        actionKind: params.actionKind,
        targetId: params.targetId,
        points: params.points,
        title: params.title,
        detail: params.detail,
        relatedId: params.relatedId,
        now,
      });

      const hasActivityDelta =
        (params.minutesDelta || 0) > 0 ||
        (params.videosDelta || 0) > 0 ||
        (params.lessonsDelta || 0) > 0 ||
        (params.tasksDelta || 0) > 0 ||
        (params.quizzesDelta || 0) > 0 ||
        (params.reviewsDelta || 0) > 0 ||
        grant.granted;

      if (!user) {
        setLocalBundle((prev) => {
          const innerGrant = applyXpGrant({
            profile: prev.profile,
            transactions: prev.transactions,
            actionKind: params.actionKind,
            targetId: params.targetId,
            points: params.points,
            title: params.title,
            detail: params.detail,
            relatedId: params.relatedId,
            now,
          });
          const xpAdded = innerGrant.granted && innerGrant.transaction ? innerGrant.transaction.points : 0;
          const existingAct = prev.dailyActivities.find((a) => a.dateIso === dateIso);
          const nextAct: DailyActivityRecord = existingAct
            ? {
                ...existingAct,
                minutesLearned: existingAct.minutesLearned + (params.minutesDelta || 0),
                videosWatched: existingAct.videosWatched + (params.videosDelta || 0),
                lessonsCompleted: existingAct.lessonsCompleted + (params.lessonsDelta || 0),
                tasksCompleted: existingAct.tasksCompleted + (params.tasksDelta || 0),
                quizzesCompleted: existingAct.quizzesCompleted + (params.quizzesDelta || 0),
                reviewsCompleted: existingAct.reviewsCompleted + (params.reviewsDelta || 0),
                xpEarned: existingAct.xpEarned + xpAdded,
                updatedAt: now.toISOString(),
              }
            : {
                id: dateIso,
                ownerId: 'local',
                dateIso,
                minutesLearned: params.minutesDelta || 0,
                videosWatched: params.videosDelta || 0,
                lessonsCompleted: params.lessonsDelta || 0,
                tasksCompleted: params.tasksDelta || 0,
                quizzesCompleted: params.quizzesDelta || 0,
                reviewsCompleted: params.reviewsDelta || 0,
                xpEarned: xpAdded,
                updatedAt: now.toISOString(),
              };

          const nextActs = hasActivityDelta
            ? [nextAct, ...prev.dailyActivities.filter((a) => a.dateIso !== dateIso)]
            : prev.dailyActivities;

          return {
            ...prev,
            profile: innerGrant.nextProfile,
            transactions:
              innerGrant.granted && innerGrant.transaction
                ? [innerGrant.transaction, ...prev.transactions]
                : prev.transactions,
            dailyActivities: nextActs,
          };
        });

        if (grant.granted) {
          if (!params.silent) {
            void emitNotification({
              kind: params.notifKind || 'xp',
              title: params.title,
              message: `حصلت على +${grant.transaction?.points || params.points} نقطة خبرة (XP).`,
              targetSection: params.targetSection || 'achievements',
              celebrate: true,
              xpDelta: grant.transaction?.points || params.points,
            });
          }
          if (grant.leveledUp) {
            void emitNotification({
              kind: 'level_up',
              title: `ترقية إلى المستوى ${grant.newLevel}!`,
              message: `مبارك! وصلت إلى المستوى ${grant.newLevel} (${getLevelProgress(grant.nextProfile.totalXp).rankTitle}).`,
              targetSection: 'achievements',
              celebrate: true,
            });
          }
        }
        return grant.granted;
      }

      // Cloud path: verify XP ledger doc does not already exist in Firestore
      try {
        let confirmedNewTx = grant.granted && Boolean(grant.transaction);
        const rewardKey = buildRewardKey(params.actionKind, params.targetId);
        if (confirmedNewTx) {
          const existingTxSnap = await getDoc(
            doc(db, `users/${user.uid}/xpTransactions/${rewardKey}`)
          );
          if (existingTxSnap.exists()) {
            confirmedNewTx = false;
          }
        }

        const batch = writeBatch(db);
        const actRef = doc(db, `users/${user.uid}/dailyActivities/${dateIso}`);
        const actSnap = await getDoc(actRef);
        const prevAct = actSnap.exists() ? (actSnap.data() as Partial<DailyActivityRecord>) : {};
        const xpDelta = confirmedNewTx && grant.transaction ? grant.transaction.points : 0;

        if (hasActivityDelta) {
          batch.set(actRef, {
            id: dateIso,
            ownerId: user.uid,
            dateIso,
            minutesLearned: (prevAct.minutesLearned || 0) + (params.minutesDelta || 0),
            videosWatched: (prevAct.videosWatched || 0) + (params.videosDelta || 0),
            lessonsCompleted: (prevAct.lessonsCompleted || 0) + (params.lessonsDelta || 0),
            tasksCompleted: (prevAct.tasksCompleted || 0) + (params.tasksDelta || 0),
            quizzesCompleted: (prevAct.quizzesCompleted || 0) + (params.quizzesDelta || 0),
            reviewsCompleted: (prevAct.reviewsCompleted || 0) + (params.reviewsDelta || 0),
            xpEarned: (prevAct.xpEarned || 0) + xpDelta,
            updatedAt: serverTimestamp(),
          });
        }

        if (confirmedNewTx && grant.transaction) {
          batch.set(doc(db, `users/${user.uid}/xpTransactions/${rewardKey}`), {
            ...grant.transaction,
            ownerId: user.uid,
            createdAt: serverTimestamp(),
          });
          batch.set(doc(db, `users/${user.uid}/gamification/profile`), {
            ...grant.nextProfile,
            ownerId: user.uid,
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();

        if (confirmedNewTx) {
          if (!params.silent) {
            void emitNotification({
              kind: params.notifKind || 'xp',
              title: params.title,
              message: `حصلت على +${xpDelta} نقطة خبرة (XP).`,
              targetSection: params.targetSection || 'achievements',
              celebrate: true,
              xpDelta,
            });
          }
          if (grant.leveledUp) {
            void emitNotification({
              kind: 'level_up',
              title: `ترقية إلى المستوى ${grant.newLevel}!`,
              message: `مبارك! وصلت إلى المستوى ${grant.newLevel} (${getLevelProgress(grant.nextProfile.totalXp).rankTitle}).`,
              targetSection: 'achievements',
              celebrate: true,
            });
          }
        }

        return confirmedNewTx;
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/gamification/profile`);
        return false;
      }
    },
    [rawProfile, transactions, user, emitNotification]
  );

  // Sync newly unlocked badges & streak milestones & sync profile counters + public leaderboard
  useEffect(() => {
    if (!authReady) return;
    if (processingMetaRef.current) return;

    const streakNeedsUpdate =
      streakResult.currentStreak !== rawProfile.currentStreak ||
      streakResult.longestStreak !== rawProfile.longestStreak;
    const hasNewBadges = badgeEval.newlyUnlocked.length > 0;
    const hasNewMilestones = streakResult.newlyReachedMilestones.length > 0;

    if (!streakNeedsUpdate && !hasNewBadges && !hasNewMilestones) return;

    processingMetaRef.current = true;
    void (async () => {
      try {
        if (!user) {
          setLocalBundle((prev) => {
            let nextProf: GamificationProfileState = {
              ...prev.profile,
              currentStreak: streakResult.currentStreak,
              longestStreak: streakResult.longestStreak,
              unlockedBadgeIds: badgeEval.nextUnlockedIds,
              badgeUnlockedAt: badgeEval.nextBadgeUnlockedAt,
              updatedAt: new Date().toISOString(),
            };
            const newTxs: XpTransaction[] = [];

            for (const badge of badgeEval.newlyUnlocked) {
              const g = applyXpGrant({
                profile: nextProf,
                transactions: [...newTxs, ...prev.transactions],
                actionKind: 'badge_unlock',
                targetId: badge.id,
                points: badge.bonusXp,
                title: `فتح شارة: ${badge.title}`,
                detail: badge.description,
                relatedId: badge.id,
              });
              if (g.granted && g.transaction) {
                nextProf = g.nextProfile;
                newTxs.push(g.transaction);
              }
            }

            for (const m of streakResult.newlyReachedMilestones) {
              const g = applyXpGrant({
                profile: nextProf,
                transactions: [...newTxs, ...prev.transactions],
                actionKind: 'streak_milestone',
                targetId: `days_${m.days}`,
                points: m.bonusXp,
                title: `مكافأة السلسلة: ${m.title}`,
                detail: `حافظت على التعلم لمدة ${m.days} أيام متتالية.`,
                relatedId: String(m.days),
              });
              if (g.granted && g.transaction) {
                nextProf = g.nextProfile;
                newTxs.push(g.transaction);
              }
            }

            return {
              ...prev,
              profile: nextProf,
              transactions: [...newTxs, ...prev.transactions],
            };
          });
        } else {
          const batch = writeBatch(db);
          let nextProf: GamificationProfileState = {
            ...rawProfile,
            ownerId: user.uid,
            currentStreak: streakResult.currentStreak,
            longestStreak: streakResult.longestStreak,
            unlockedBadgeIds: badgeEval.nextUnlockedIds,
            badgeUnlockedAt: badgeEval.nextBadgeUnlockedAt,
          };

          for (const badge of badgeEval.newlyUnlocked) {
            const key = buildRewardKey('badge_unlock', badge.id);
            const g = applyXpGrant({
              profile: nextProf,
              transactions,
              actionKind: 'badge_unlock',
              targetId: badge.id,
              points: badge.bonusXp,
              title: `فتح شارة: ${badge.title}`,
              detail: badge.description,
              relatedId: badge.id,
            });
            if (g.granted && g.transaction) {
              nextProf = g.nextProfile;
              batch.set(doc(db, `users/${user.uid}/xpTransactions/${key}`), {
                ...g.transaction,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
              });
            }
          }

          for (const m of streakResult.newlyReachedMilestones) {
            const key = buildRewardKey('streak_milestone', `days_${m.days}`);
            const g = applyXpGrant({
              profile: nextProf,
              transactions,
              actionKind: 'streak_milestone',
              targetId: `days_${m.days}`,
              points: m.bonusXp,
              title: `مكافأة السلسلة: ${m.title}`,
              detail: `حافظت على التعلم لمدة ${m.days} أيام متتالية.`,
              relatedId: String(m.days),
            });
            if (g.granted && g.transaction) {
              nextProf = g.nextProfile;
              batch.set(doc(db, `users/${user.uid}/xpTransactions/${key}`), {
                ...g.transaction,
                ownerId: user.uid,
                createdAt: serverTimestamp(),
              });
            }
          }

          batch.set(doc(db, `users/${user.uid}/gamification/profile`), {
            ...nextProf,
            ownerId: user.uid,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        }

        for (const badge of badgeEval.newlyUnlocked) {
          await emitNotification({
            kind: 'badge',
            title: `شارة إنجاز جديدة: ${badge.title}`,
            message: `${badge.description} (+${badge.bonusXp} XP)`,
            targetSection: 'achievements',
            celebrate: true,
            xpDelta: badge.bonusXp,
          });
        }
        if (streakResult.isNewRecord && streakResult.currentStreak >= 2) {
          await emitNotification({
            kind: 'streak',
            title: `رقم قياسي جديد في السلسلة: ${streakResult.currentStreak} أيام!`,
            message: 'استمر في الحفاظ على وتيرة التعلم اليومية المتواصلة.',
            targetSection: 'achievements',
            celebrate: true,
          });
        }
      } catch (err) {
        if (user) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/gamification/profile`);
        }
      } finally {
        processingMetaRef.current = false;
      }
    })();
  }, [authReady, user, rawProfile, streakResult, badgeEval, transactions, emitNotification]);

  // Sync current authenticated user's zero-PII Leaderboard entry
  const lastLbSigRef = useRef<string>('');
  useEffect(() => {
    if (!authReady || !user) return;
    const displayName = (user.displayName || 'متعلم مسار').trim().slice(0, 120) || 'متعلم مسار';
    const avatarLetter = displayName.charAt(0) || 'م';
    const currWeek = getWeekKey();
    const currMonth = getMonthKey();
    const sig = [
      user.uid,
      displayName,
      publicUsername,
      levelSummary.level,
      rawProfile.totalXp,
      rawProfile.weeklyXp,
      rawProfile.monthlyXp,
      currWeek,
      currMonth,
      streakResult.currentStreak,
      rawProfile.unlockedBadgeIds.length,
    ].join('|');

    if (lastLbSigRef.current === sig) return;
    lastLbSigRef.current = sig;

    const lbRef = doc(db, `leaderboard/${user.uid}`);
    void setDoc(lbRef, {
      uid: user.uid,
      displayName,
      username: publicUsername.slice(0, 40),
      avatarLetter: avatarLetter.slice(0, 4),
      level: levelSummary.level,
      totalXp: rawProfile.totalXp,
      weeklyXp: rawProfile.weeklyXp,
      monthlyXp: rawProfile.monthlyXp,
      weekKey: currWeek,
      monthKey: currMonth,
      currentStreak: streakResult.currentStreak,
      badgesCount: rawProfile.unlockedBadgeIds.length,
      updatedAt: serverTimestamp(),
    }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `leaderboard/${user.uid}`);
    });
  }, [
    authReady,
    user,
    publicUsername,
    levelSummary.level,
    rawProfile.totalXp,
    rawProfile.weeklyXp,
    rawProfile.monthlyXp,
    streakResult.currentStreak,
    rawProfile.unlockedBadgeIds.length,
  ]);

  const leaderboardEntries = useMemo<LeaderboardEntry[]>(() => {
    if (user && cloudLeaderboard.length > 0) {
      return cloudLeaderboard;
    }
    const displayName = (user?.displayName || 'أنت (حساب محلي)').slice(0, 120);
    return [
      {
        uid: user?.uid || 'local',
        displayName,
        username: publicUsername,
        avatarLetter: displayName.charAt(0) || 'م',
        level: levelSummary.level,
        totalXp: rawProfile.totalXp,
        weeklyXp: rawProfile.weeklyXp,
        monthlyXp: rawProfile.monthlyXp,
        weekKey: rawProfile.weekKey,
        monthKey: rawProfile.monthKey,
        currentStreak: streakResult.currentStreak,
        badgesCount: rawProfile.unlockedBadgeIds.length,
        updatedAt: rawProfile.updatedAt,
      },
    ];
  }, [user, cloudLeaderboard, publicUsername, levelSummary.level, rawProfile, streakResult.currentStreak]);

  // Action Recorders
  const recordVideoWatch = useCallback(
    async (stepId: string, title: string) => {
      await grantXpAndActivity({
        actionKind: 'video_watch',
        targetId: stepId,
        points: XP_REWARDS.video_watch,
        title: `مشاهدة درس: ${title}`,
        detail: 'حصلت على نقاط خبرة لفتح ومشاهدة الدرس.',
        relatedId: stepId,
        minutesDelta: 10,
        videosDelta: 1,
        targetSection: 'path',
        notifKind: 'xp',
        silent: true,
      });
    },
    [grantXpAndActivity]
  );

  const recordLessonCompleted = useCallback(
    async (stepId: string, title: string) => {
      await grantXpAndActivity({
        actionKind: 'lesson_complete',
        targetId: stepId,
        points: XP_REWARDS.lesson_complete,
        title: `إتمام الدرس: ${title}`,
        detail: 'تقدم ممتاز في المسار التعليمي.',
        relatedId: stepId,
        minutesDelta: 18,
        lessonsDelta: 1,
        targetSection: 'path',
        notifKind: 'xp',
      });
    },
    [grantXpAndActivity]
  );

  const recordTodoCompleted = useCallback(
    async (todoId: string, title: string) => {
      await grantXpAndActivity({
        actionKind: 'todo_complete',
        targetId: todoId,
        points: XP_REWARDS.todo_complete,
        title: `إنجاز مهمة: ${title}`,
        relatedId: todoId,
        minutesDelta: 10,
        tasksDelta: 1,
        targetSection: 'todos',
        notifKind: 'xp',
      });
    },
    [grantXpAndActivity]
  );

  const recordQuizPassed = useCallback(
    async (quizId: string, title: string, percentage: number) => {
      await grantXpAndActivity({
        actionKind: 'quiz_pass',
        targetId: quizId,
        points: XP_REWARDS.quiz_pass,
        title: `اجتياز اختبار: ${title} (${percentage}%)`,
        relatedId: quizId,
        minutesDelta: 12,
        quizzesDelta: 1,
        targetSection: 'path',
        notifKind: 'quiz',
      });
    },
    [grantXpAndActivity]
  );

  const recordProjectCompleted = useCallback(
    async (projectId: string, title: string, xpReward: number) => {
      await grantXpAndActivity({
        actionKind: 'project_complete',
        targetId: projectId,
        points: xpReward || XP_REWARDS.project_complete,
        title: `إتمام المشروع العملي: ${title}`,
        relatedId: projectId,
        minutesDelta: 45,
        targetSection: 'projects',
        notifKind: 'project',
      });
    },
    [grantXpAndActivity]
  );

  const recordReviewMastered = useCallback(
    async (reviewId: string, prompt: string) => {
      await grantXpAndActivity({
        actionKind: 'review_mastery',
        targetId: reviewId,
        points: XP_REWARDS.review_mastery,
        title: `إتقان سؤال في المراجعة الذكية`,
        detail: prompt.slice(0, 120),
        relatedId: reviewId,
        minutesDelta: 5,
        reviewsDelta: 1,
        targetSection: 'review',
        notifKind: 'xp',
      });
    },
    [grantXpAndActivity]
  );

  // Strict 100% Path Completion Certificate Auto-Issuer
  const issuingCertRef = useRef<Set<string>>(new Set());
  const evaluateAndIssueCertificateForPath = useCallback(
    async (path: LearningPath, pathSteps: VideoStep[]) => {
      if (issuingCertRef.current.has(path.id)) return null;
      const recipientName = user?.displayName || 'متعلم منصة مسار';
      const cert = buildCertificateForCompletedPath({
        path,
        steps: pathSteps,
        ownerId: user?.uid || 'local',
        recipientName,
        existingCertificates: certificates,
      });
      if (!cert) return null;

      issuingCertRef.current.add(path.id);
      try {
        if (!user) {
          setLocalBundle((prev) => {
            if (prev.certificates.some((c) => c.pathId === path.id)) return prev;
            return { ...prev, certificates: [cert, ...prev.certificates] };
          });
        } else {
          const certDocRef = doc(db, `users/${user.uid}/certificates/${cert.id}`);
          const existingSnap = await getDoc(certDocRef);
          if (!existingSnap.exists()) {
            const batch = writeBatch(db);
            batch.set(certDocRef, {
              ...cert,
              ownerId: user.uid,
              issuedAt: serverTimestamp(),
            });
            batch.set(doc(db, `certificateVerifications/${cert.verificationCode}`), {
              verificationCode: cert.verificationCode,
              ownerId: user.uid,
              recipientName: cert.recipientName,
              pathTitle: cert.pathTitle,
              lessonsCount: cert.lessonsCount,
              completedAt: cert.completedAt,
              issuedAt: serverTimestamp(),
            });
            await batch.commit();
          }
        }

        await grantXpAndActivity({
          actionKind: 'path_complete',
          targetId: path.id,
          points: XP_REWARDS.path_complete,
          title: `إتمام مسار بالكامل: ${path.title}`,
          relatedId: path.id,
          minutesDelta: 20,
          targetSection: 'achievements',
          notifKind: 'certificate',
          silent: true,
        });

        await emitNotification({
          kind: 'certificate',
          title: `شهادة إنجاز جديدة: ${path.title}`,
          message: `مبارك! أتممت المسار بنسبة 100% وصدرت شهادتك برمز تحقق ${cert.verificationCode}.`,
          targetSection: 'achievements',
          celebrate: true,
          xpDelta: XP_REWARDS.path_complete,
        });

        return cert;
      } catch (err) {
        if (user) {
          handleFirestoreError(
            err,
            OperationType.CREATE,
            `users/${user.uid}/certificates/${cert.id}`
          );
        }
        return null;
      } finally {
        issuingCertRef.current.delete(path.id);
      }
    },
    [user, certificates, grantXpAndActivity, emitNotification]
  );

  // Automatic check for 100% completed paths that don't yet have a certificate
  useEffect(() => {
    if (!authReady) return;
    for (const p of paths) {
      const pSteps = stepsByPath[p.id] || [];
      if (pSteps.length > 0 && pSteps.every((s) => s.completed)) {
        if (!certificates.some((c) => c.pathId === p.id)) {
          void evaluateAndIssueCertificateForPath(p, pSteps);
        }
      }
    }
  }, [authReady, paths, stepsByPath, certificates, evaluateAndIssueCertificateForPath]);

  // Skill tree management
  const updateSkillLinks = useCallback(
    async (
      skillId: string,
      patch: {
        linkedPathIds?: string[];
        linkedCourseIds?: string[];
        linkedProjectIds?: string[];
      }
    ) => {
      const target = skills.find((s) => s.id === skillId);
      if (!target) return;

      const updated: SkillNode = {
        ...target,
        linkedPathIds: patch.linkedPathIds ?? target.linkedPathIds,
        linkedCourseIds: patch.linkedCourseIds ?? target.linkedCourseIds,
        linkedProjectIds: patch.linkedProjectIds ?? target.linkedProjectIds,
        updatedAt: new Date().toISOString(),
      };

      if (!user) {
        setLocalBundle((prev) => ({
          ...prev,
          skills: prev.skills.map((s) => (s.id === skillId ? updated : s)),
        }));
        return;
      }

      const skillPath = `users/${user.uid}/skills/${skillId}`;
      try {
        await updateDoc(doc(db, skillPath), {
          linkedPathIds: updated.linkedPathIds,
          linkedCourseIds: updated.linkedCourseIds,
          linkedProjectIds: updated.linkedProjectIds,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, skillPath);
      }
    },
    [skills, user]
  );

  const createCustomSkill = useCallback(
    async (input: {
      title: string;
      description: string;
      levelNumber: number;
      category: string;
      prerequisiteIds: string[];
      linkedPathIds: string[];
    }) => {
      const id = createSafeId('skill');
      const nowIso = new Date().toISOString();
      const sameLevelCount = skills.filter((s) => s.levelNumber === input.levelNumber).length;
      const node: SkillNode = {
        id,
        ownerId: user?.uid || 'local',
        title: input.title.trim().slice(0, 160),
        description: input.description.trim().slice(0, 600),
        levelNumber: Math.max(1, Math.min(4, Math.round(input.levelNumber))),
        columnIndex: sameLevelCount,
        category: input.category.trim().slice(0, 80) || 'عام',
        prerequisiteIds: input.prerequisiteIds.slice(0, 20),
        linkedPathIds: input.linkedPathIds.slice(0, 20),
        linkedCourseIds: [],
        linkedProjectIds: [],
        xpReward: 75,
        isCustom: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      if (!user) {
        setLocalBundle((prev) => ({ ...prev, skills: [...prev.skills, node] }));
        return node;
      }

      const skillPath = `users/${user.uid}/skills/${id}`;
      try {
        await setDoc(doc(db, skillPath), {
          ...node,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return node;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, skillPath);
        return node;
      }
    },
    [skills, user]
  );

  const markNotificationRead = useCallback(
    async (notifId: string) => {
      if (!user) {
        setLocalBundle((prev) => ({
          ...prev,
          notifications: prev.notifications.map((n) =>
            n.id === notifId ? { ...n, read: true } : n
          ),
        }));
        return;
      }

      const path = `users/${user.uid}/notifications/${notifId}`;
      try {
        await updateDoc(doc(db, path), { read: true });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const markAllNotificationsRead = useCallback(async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    if (!user) {
      setLocalBundle((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, read: true })),
      }));
      return;
    }

    try {
      const batch = writeBatch(db);
      for (const n of unread) {
        batch.update(doc(db, `users/${user.uid}/notifications/${n.id}`), { read: true });
      }
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/notifications`);
    }
  }, [notifications, user]);

  const verifyCertificateByCode = useCallback(
    async (rawCode: string): Promise<{
      found: boolean;
      verificationCode: string;
      recipientName: string;
      pathTitle: string;
      lessonsCount: number;
      completedAt: string;
    } | null> => {
      const code = rawCode.trim().toUpperCase();
      if (!code) return null;

      const localMatch = certificates.find((c) => c.verificationCode === code);
      if (localMatch) {
        return {
          found: true,
          verificationCode: localMatch.verificationCode,
          recipientName: localMatch.recipientName,
          pathTitle: localMatch.pathTitle,
          lessonsCount: localMatch.lessonsCount,
          completedAt: localMatch.completedAt,
        };
      }

      if (!user) return null;
      try {
        const snap = await getDoc(doc(db, `certificateVerifications/${code}`));
        if (!snap.exists()) return null;
        const d = snap.data();
        return {
          found: true,
          verificationCode: String(d.verificationCode || code),
          recipientName: String(d.recipientName || ''),
          pathTitle: String(d.pathTitle || ''),
          lessonsCount: typeof d.lessonsCount === 'number' ? d.lessonsCount : 1,
          completedAt: String(d.completedAt || ''),
        };
      } catch {
        return null;
      }
    },
    [certificates, user]
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  return {
    profile: rawProfile,
    levelSummary,
    transactions,
    dailyActivities,
    streakResult,
    skills: evaluatedSkills,
    badges,
    certificates,
    statsSummary,
    leaderboardEntries,
    notifications,
    unreadNotificationsCount,
    activeCelebration,
    dismissCelebration,
    recordVideoWatch,
    recordLessonCompleted,
    recordTodoCompleted,
    recordQuizPassed,
    recordProjectCompleted,
    recordReviewMastered,
    evaluateAndIssueCertificateForPath,
    updateSkillLinks,
    createCustomSkill,
    markNotificationRead,
    markAllNotificationsRead,
    verifyCertificateByCode,
  };
}
