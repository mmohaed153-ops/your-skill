import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { AssetDetailModal } from './components/assets/AssetDetailModal';
import { AssetFormModal } from './components/assets/AssetFormModal';
import { AssetLibraryView } from './components/assets/AssetLibraryView';
import { LearningBoardView } from './components/board/LearningBoardView';
import { CalendarEventModal } from './components/calendar/CalendarEventModal';
import { CalendarView } from './components/calendar/CalendarView';
import { ConfirmModal } from './components/ConfirmModal';
import { CourseDetailModal } from './components/courses/CourseDetailModal';
import { CourseFormModal } from './components/courses/CourseFormModal';
import { CoursesView } from './components/courses/CoursesView';
import { Header } from './components/Header';
import { GameJamFinderView } from './components/jams/GameJamFinderView';
import { NotesView, type LearningStepChoice } from './components/notes/NotesView';
import { PathFormModal } from './components/PathFormModal';
import { PathHeroBar } from './components/PathHeroBar';
import { PathsDirectoryModal } from './components/PathsDirectoryModal';
import { SharedItemDetailModal } from './components/sharing/SharedItemDetailModal';
import { SharedWithMeView } from './components/sharing/SharedWithMeView';
import { ShareItemModal, type ShareTargetDescriptor } from './components/sharing/ShareItemModal';
import { TodaysLearningCard } from './components/TodaysLearningCard';
import { TodoFormModal } from './components/todos/TodoFormModal';
import { TodosView } from './components/todos/TodosView';
import { ProjectVaultView } from './components/vault/ProjectVaultView';
import { VaultProjectModal } from './components/vault/VaultProjectModal';
import { VaultRestoreModal } from './components/vault/VaultRestoreModal';
import { VideoFormModal } from './components/VideoFormModal';
import { VideoPathTimeline } from './components/VideoPathTimeline';
import { VideoCollectionsView } from './components/videos/VideoCollectionsView';
import { VideoWatchModal } from './components/VideoWatchModal';
import { BadgesStreakXpView } from './components/platform/BadgesStreakXpView';
import { CelebrationBanner } from './components/platform/CelebrationBanner';
import { DashboardView } from './components/platform/DashboardView';
import { FavoritesView } from './components/platform/FavoritesView';
import { LeaderboardView } from './components/platform/LeaderboardView';
import { NotificationsDrawer } from './components/platform/NotificationsDrawer';
import { PracticalProjectsView } from './components/platform/PracticalProjectsView';
import { QuizModal } from './components/platform/QuizModal';
import { SkillTreeView } from './components/platform/SkillTreeView';
import { SmartReviewView } from './components/platform/SmartReviewView';
import { StatisticsView } from './components/platform/StatisticsView';
import { useAssetLibrary } from './hooks/useAssetLibrary';
import { useCalendarEvents } from './hooks/useCalendarEvents';
import { useCourses } from './hooks/useCourses';
import { useFavorites } from './hooks/useFavorites';
import { useLearningBoards } from './hooks/useLearningBoards';
import { useLearningPaths, type PathInitialStepInput } from './hooks/useLearningPaths';
import { useNotes } from './hooks/useNotes';
import { usePlatformGamification } from './hooks/usePlatformGamification';
import { usePracticalProjects } from './hooks/usePracticalProjects';
import { useProjectVault } from './hooks/useProjectVault';
import { useQuizzesAndReview } from './hooks/useQuizzesAndReview';
import { useSavedGameJams } from './hooks/useSavedGameJams';
import { useSocialSharing } from './hooks/useSocialSharing';
import { useTodos } from './hooks/useTodos';
import { useVideoCollections } from './hooks/useVideoCollections';
import type { LearningPath, VideoStep } from './types/learning';
import type { FavoriteItem } from './types/platform';
import type {
  AppSection,
  BoardCard,
  CalendarEvent,
  CalendarLinkTargetType,
  CourseItem,
  DiscoveredCourseResult,
  LearningBoard,
  LibraryAsset,
  NoteLinkRef,
  OrganizedVideoItem,
  SavedGameJam,
  SharedItemRecord,
  TodoLinkRef,
  TodoTask,
  VaultProject,
  VideoCollection,
  WorkspaceNote,
} from './types/workspace';
import {
  buildCardsFromCourse,
  buildCardsFromLearningPath,
  createVideoBoardCard,
  findNextFreeSpot,
} from './utils/boardLogic';
import {
  buildJamCalendarDrafts,
  CALENDAR_CATEGORY_META,
  createCourseScheduleTitle,
  toDateIso,
} from './utils/calendarLogic';
import { calculatePathProgress, createSafeId } from './utils/pathLogic';
import {
  extractShareParamsFromSearch,
  type SharedPayloadBundle,
} from './utils/sharingLogic';
import {
  calculateStorageSummary,
  DEFAULT_VAULT_FOLDERS,
} from './utils/workspaceLogic';

export default function App() {
  const {
    user,
    authReady,
    cloudLoading,
    syncMessage,
    errorBanner,
    dismissError,
    paths,
    stepsByPath,
    activePath,
    steps,
    pathProgressMap,
    selectPath,
    signInWithGoogle,
    logout,
    createPath,
    updatePath,
    deletePath,
    addVideoStep,
    updateVideoStep,
    toggleStepCompleted,
    updateStepQuickNotes,
    reorderSteps,
    reorderStepsByIdOrder,
    deleteVideoStep,
  } = useLearningPaths();

  const vault = useProjectVault(user, authReady);
  const assetLib = useAssetLibrary(user, authReady);
  const notesApi = useNotes(user, authReady);
  const todosApi = useTodos(user, authReady);
  const coursesApi = useCourses(user, authReady);
  const boardApi = useLearningBoards(user, authReady);
  const jamsApi = useSavedGameJams(user, authReady);
  const videosApi = useVideoCollections(user, authReady);
  const calendarApi = useCalendarEvents(user, authReady);
  const sharingApi = useSocialSharing(user, authReady);
  const quizzesApi = useQuizzesAndReview(user, authReady);
  const favoritesApi = useFavorites(user, authReady);
  const practicalProjectsApi = usePracticalProjects(user, authReady);
  const gamification = usePlatformGamification({
    user,
    authReady,
    paths,
    stepsByPath,
    todos: todosApi.todos,
    courses: coursesApi.courses,
    projects: practicalProjectsApi.projects,
    passedQuizzesCount: quizzesApi.passedQuizzesCount,
    masteredReviewsCount: quizzesApi.masteredReviewsCount,
    favoritesCount: favoritesApi.favorites.length,
    publicUsername: sharingApi.myProfile?.username || '',
  });

  const [activeSection, setActiveSection] = useState<AppSection>('dashboard');

  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem('masar_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem('masar_theme', isDark ? 'dark' : 'light');
    } catch {
      // ignore storage errors
    }
  }, [isDark]);

  // Video Learning Path Modals
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [videoModalMode, setVideoModalMode] = useState<'add' | 'edit'>('add');
  const [editingStep, setEditingStep] = useState<VideoStep | null>(null);
  const [pathModalOpen, setPathModalOpen] = useState(false);
  const [pathModalMode, setPathModalMode] = useState<'create' | 'edit'>('create');
  const [editingPath, setEditingPath] = useState<LearningPath | null>(null);
  const [directoryModalOpen, setDirectoryModalOpen] = useState(false);
  const [watchingState, setWatchingState] = useState<{
    stepId: string;
    focusNotes: boolean;
  } | null>(null);
  const [confirmDeleteStep, setConfirmDeleteStep] = useState<VideoStep | null>(null);
  const [confirmDeletePathTarget, setConfirmDeletePathTarget] = useState<LearningPath | null>(null);

  // Project Vault Modals
  const [vaultModalOpen, setVaultModalOpen] = useState(false);
  const [vaultModalMode, setVaultModalMode] = useState<'create' | 'edit_meta' | 'backup'>('create');
  const [selectedVaultProject, setSelectedVaultProject] = useState<VaultProject | null>(null);
  const [vaultPreset, setVaultPreset] = useState<{
    name?: string;
    description?: string;
    folder?: string;
    linkedJamId?: string;
  } | null>(null);
  const [pendingVaultJamId, setPendingVaultJamId] = useState<string | null>(null);
  const [restoreProjectId, setRestoreProjectId] = useState<string | null>(null);
  const [confirmDeleteVaultProject, setConfirmDeleteVaultProject] = useState<VaultProject | null>(null);

  // Asset Library Modals
  const [assetModalOpen, setAssetModalOpen] = useState(false);
  const [assetModalMode, setAssetModalMode] = useState<'create' | 'edit'>('create');
  const [editingAsset, setEditingAsset] = useState<LibraryAsset | null>(null);
  const [inspectingAssetId, setInspectingAssetId] = useState<string | null>(null);
  const [confirmDeleteAsset, setConfirmDeleteAsset] = useState<LibraryAsset | null>(null);

  // Notes Workspace State
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<WorkspaceNote | null>(null);

  // To-Do Modals
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [todoModalMode, setTodoModalMode] = useState<'create' | 'edit'>('create');
  const [editingTodo, setEditingTodo] = useState<TodoTask | null>(null);
  const [todoInitialLink, setTodoInitialLink] = useState<TodoLinkRef | null>(null);
  const [todoInitialTitle, setTodoInitialTitle] = useState('');
  const [confirmDeleteTodoTarget, setConfirmDeleteTodoTarget] = useState<TodoTask | null>(null);

  // Courses Modals
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [courseModalMode, setCourseModalMode] = useState<'create' | 'edit'>('create');
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null);
  const [inspectingCourseId, setInspectingCourseId] = useState<string | null>(null);
  const [confirmDeleteCourseTarget, setConfirmDeleteCourseTarget] = useState<CourseItem | null>(null);
  const [watchingBoardCard, setWatchingBoardCard] = useState<{
    boardId: string;
    cardId: string;
  } | null>(null);

  // Calendar Quick Scheduling Modal (for Courses / Learning Boards)
  const [calendarQuickOpen, setCalendarQuickOpen] = useState(false);
  const [calendarQuickPreset, setCalendarQuickPreset] = useState<CalendarEvent | null>(null);

  // Social Sharing Modals
  const [shareTarget, setShareTarget] = useState<ShareTargetDescriptor | null>(null);
  const [inspectingShare, setInspectingShare] = useState<SharedItemRecord | null>(null);
  const [copyToastMessage, setCopyToastMessage] = useState<string | null>(null);
  const handledShareKeyRef = useRef<string>('');

  // Platform Learning System Modals
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [quizStep, setQuizStep] = useState<VideoStep | null>(null);

  // Auto-redeem ?share=...&code=... invite links once auth settles
  useEffect(() => {
    if (!authReady) return;
    const params = extractShareParamsFromSearch(window.location.search);
    if (!params) return;

    const attemptKey = `${params.shareId}:${params.shareCode}:${user?.uid || 'anon'}`;
    if (handledShareKeyRef.current === attemptKey) return;
    handledShareKeyRef.current = attemptKey;

    void (async () => {
      const record = await sharingApi.redeemShareInvite(params.shareId, params.shareCode);
      if (record) {
        setActiveSection('shared');
        setInspectingShare(record);
        const url = new URL(window.location.href);
        url.searchParams.delete('share');
        url.searchParams.delete('code');
        window.history.replaceState({}, '', url.pathname + url.search + url.hash);
      }
    })();
  }, [authReady, user?.uid, sharingApi]);

  const progress = useMemo(() => calculatePathProgress(steps), [steps]);
  const watchingBoardVideoStep = useMemo<VideoStep | null>(() => {
    if (!watchingBoardCard) return null;
    const targetBoard = boardApi.boards.find((b) => b.id === watchingBoardCard.boardId);
    const card = targetBoard?.cards.find((c) => c.id === watchingBoardCard.cardId);
    if (!card) return null;
    return {
      id: card.id,
      pathId: targetBoard!.id,
      ownerId: targetBoard!.ownerId,
      title: card.title,
      description: card.sourceLabel ? `المصدر: ${card.sourceLabel}` : '',
      videoUrl: card.videoUrl,
      thumbnailUrl: card.thumbnailUrl,
      order: 0,
      completed: card.completed,
      completedAt: '',
      targetDate: '',
      quickNotes: card.noteText,
      quickNotesUpdatedAt: targetBoard!.updatedAt,
      createdAt: targetBoard!.createdAt,
      updatedAt: targetBoard!.updatedAt,
    };
  }, [watchingBoardCard, boardApi.boards]);

  const watchingStep = useMemo(() => {
    if (watchingBoardVideoStep) return watchingBoardVideoStep;
    return watchingState ? steps.find((s) => s.id === watchingState.stepId) || null : null;
  }, [watchingBoardVideoStep, steps, watchingState]);

  const restoreProjectTarget = useMemo(
    () => (restoreProjectId ? vault.projects.find((p) => p.id === restoreProjectId) || null : null),
    [restoreProjectId, vault.projects]
  );

  const inspectingAsset = useMemo(
    () => (inspectingAssetId ? assetLib.assets.find((a) => a.id === inspectingAssetId) || null : null),
    [inspectingAssetId, assetLib.assets]
  );

  const inspectingCourse = useMemo(
    () => (inspectingCourseId ? coursesApi.courses.find((c) => c.id === inspectingCourseId) || null : null),
    [inspectingCourseId, coursesApi.courses]
  );

  const storageSummary = useMemo(
    () =>
      calculateStorageSummary(vault.projects, vault.versionsByProject, assetLib.assets),
    [vault.projects, vault.versionsByProject, assetLib.assets]
  );

  const activeToastMessage =
    copyToastMessage ||
    syncMessage ||
    vault.vaultMessage ||
    assetLib.assetMessage ||
    notesApi.notesMessage ||
    todosApi.todosMessage ||
    coursesApi.coursesMessage ||
    boardApi.boardMessage ||
    jamsApi.jamsMessage ||
    videosApi.videosMessage ||
    calendarApi.calendarMessage ||
    sharingApi.shareMessage;

  const activeErrorMessage =
    errorBanner ||
    vault.vaultError ||
    assetLib.assetError ||
    notesApi.notesError ||
    todosApi.todosError ||
    coursesApi.coursesError ||
    boardApi.boardError ||
    jamsApi.jamsError ||
    videosApi.videosError ||
    calendarApi.calendarError ||
    sharingApi.shareError ||
    practicalProjectsApi.projectError;

  const showLocalToast = (msg: string) => {
    setCopyToastMessage(msg);
    window.setTimeout(() => {
      setCopyToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const vaultFolders = useMemo(
    () => Array.from(new Set(vault.projects.map((p) => p.folder).filter(Boolean))),
    [vault.projects]
  );

  const assetFolders = useMemo(
    () => Array.from(new Set(assetLib.assets.map((a) => a.folder).filter(Boolean))),
    [assetLib.assets]
  );

  const learningStepChoices = useMemo<LearningStepChoice[]>(() => {
    const items: LearningStepChoice[] = [];
    for (const p of paths) {
      const pSteps = stepsByPath[p.id] || [];
      for (const s of pSteps) {
        items.push({ step: s, pathTitle: p.title });
      }
    }
    return items;
  }, [paths, stepsByPath]);

  const handleOpenAddVideo = () => {
    setVideoModalMode('add');
    setEditingStep(null);
    setVideoModalOpen(true);
  };

  const handleOpenEditVideo = (step: VideoStep) => {
    setVideoModalMode('edit');
    setEditingStep(step);
    setVideoModalOpen(true);
  };

  const handleOpenCreatePath = () => {
    setPathModalMode('create');
    setEditingPath(null);
    setPathModalOpen(true);
  };

  const handleOpenEditPath = (pathToEdit: LearningPath) => {
    setPathModalMode('edit');
    setEditingPath(pathToEdit);
    setPathModalOpen(true);
  };

  const handleChangeSection = (section: AppSection) => {
    setActiveSection(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStepCompleted = async (pathId: string, step: VideoStep, nextCompleted: boolean) => {
    await toggleStepCompleted(pathId, step.id, nextCompleted);
    if (nextCompleted) {
      await gamification.recordLessonCompleted(step.id, step.title);
    }
  };

  const handleToggleTodoCompleted = async (task: TodoTask) => {
    const willComplete = !task.completed;
    await todosApi.toggleTodoCompleted(task);
    if (willComplete) {
      await gamification.recordTodoCompleted(task.id, task.title);
    }
  };

  const handleOpenFavorite = (item: FavoriteItem) => {
    if (item.targetType === 'learning_path') {
      if (paths.some((p) => p.id === item.targetId)) {
        selectPath(item.targetId);
      }
      handleChangeSection('path');
      return;
    }
    if (item.targetType === 'video_step') {
      handleNavigateToLinkedItem({
        type: 'learning_step',
        targetId: item.targetId,
        parentId: item.parentId,
        label: item.title,
      });
      return;
    }
    if (item.targetType === 'course') {
      handleNavigateToLinkedItem({
        type: 'course',
        targetId: item.targetId,
        parentId: '',
        label: item.title,
      });
      return;
    }
    handleChangeSection('videos');
  };

  const handleOpenNoteInWorkspace = (noteId: string) => {
    setRestoreProjectId(null);
    setInspectingAssetId(null);
    setInspectingCourseId(null);
    setWatchingState(null);
    setSelectedNoteId(noteId);
    setActiveSection('notes');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateLinkedNote = async (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => {
    const folderByType: Record<NoteLinkRef['type'], string> = {
      vault_project: 'توثيق المشاريع',
      library_asset: 'الأصول والنماذج',
      learning_step: 'ملخصات الدروس',
      learning_path: 'ملخصات الدروس',
      course: 'ملخصات الدروس',
      learning_board: 'ملاحظات لوحة التعلم',
      game_jam: 'مسابقات الألعاب',
      video_collection: 'مكتبة الفيديو',
    };
    return notesApi.createNote({
      title: input.title,
      contentHtml: input.contentHtml,
      folder: folderByType[input.link.type],
      links: [input.link],
    });
  };

  const handleNavigateToLinkedItem = (link: NoteLinkRef) => {
    if (link.type === 'vault_project') {
      const target = vault.projects.find((p) => p.id === link.targetId);
      setActiveSection('vault');
      if (target) setRestoreProjectId(target.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'library_asset') {
      const target = assetLib.assets.find((a) => a.id === link.targetId);
      setActiveSection('assets');
      if (target) setInspectingAssetId(target.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'course') {
      const target = coursesApi.courses.find((c) => c.id === link.targetId);
      setActiveSection('courses');
      if (target) setInspectingCourseId(target.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'learning_path') {
      setActiveSection('path');
      if (paths.some((p) => p.id === link.targetId)) {
        selectPath(link.targetId);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'learning_board') {
      if (link.parentId && boardApi.boards.some((b) => b.id === link.parentId)) {
        boardApi.selectBoard(link.parentId);
      } else if (boardApi.boards.some((b) => b.id === link.targetId)) {
        boardApi.selectBoard(link.targetId);
      }
      setActiveSection('board');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'game_jam') {
      setActiveSection('jams');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'video_collection') {
      setActiveSection('videos');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (link.type === 'learning_step') {
      setActiveSection('path');
      if (link.parentId && paths.some((p) => p.id === link.parentId)) {
        selectPath(link.parentId);
      } else {
        for (const p of paths) {
          if ((stepsByPath[p.id] || []).some((s) => s.id === link.targetId)) {
            selectPath(p.id);
            break;
          }
        }
      }
      setWatchingState({ stepId: link.targetId, focusNotes: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleNavigateFromTodo = (link: TodoLinkRef) => {
    if (link.type === 'game_jam') {
      setActiveSection('jams');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (link.type === 'video_collection') {
      setActiveSection('videos');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (link.type === 'learning_board') {
      handleNavigateToLinkedItem({
        type: 'learning_board',
        targetId: link.targetId,
        parentId: link.parentId,
        label: link.label,
      });
      return;
    }
    if (link.type === 'project') {
      handleNavigateToLinkedItem({
        type: 'vault_project',
        targetId: link.targetId,
        parentId: '',
        label: link.label,
      });
      return;
    }
    if (link.type === 'asset') {
      handleNavigateToLinkedItem({
        type: 'library_asset',
        targetId: link.targetId,
        parentId: '',
        label: link.label,
      });
      return;
    }
    if (link.type === 'course') {
      handleNavigateToLinkedItem({
        type: 'course',
        targetId: link.targetId,
        parentId: '',
        label: link.label,
      });
      return;
    }
    if (link.type === 'learning_path') {
      handleNavigateToLinkedItem({
        type: 'learning_path',
        targetId: link.targetId,
        parentId: '',
        label: link.label,
      });
      return;
    }
    if (link.type === 'learning_step') {
      handleNavigateToLinkedItem({
        type: 'learning_step',
        targetId: link.targetId,
        parentId: link.parentId,
        label: link.label,
      });
    }
  };

  const handleNavigateFromCalendar = (
    linkedType: CalendarLinkTargetType,
    linkedId: string,
    linkedParentId: string
  ) => {
    if (linkedType === 'none') return;
    if (linkedType === 'todo') {
      setActiveSection('todos');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (linkedType === 'project') {
      handleNavigateToLinkedItem({
        type: 'vault_project',
        targetId: linkedId,
        parentId: '',
        label: '',
      });
      return;
    }
    handleNavigateToLinkedItem({
      type: linkedType,
      targetId: linkedId,
      parentId: linkedParentId,
      label: '',
    });
  };

  const openLinkedTodoModal = (presetLink?: TodoLinkRef, presetTitle?: string) => {
    setTodoModalMode('create');
    setEditingTodo(null);
    setTodoInitialLink(presetLink || null);
    setTodoInitialTitle(presetTitle || '');
    setTodoModalOpen(true);
  };

  const buildInitialStepsFromCourse = (course: {
    title: string;
    url: string;
    thumbnailUrl: string;
    videos: { title: string; videoUrl: string }[];
  }): PathInitialStepInput[] => {
    if (course.videos.length > 0) {
      return course.videos.map((v) => ({
        title: v.title,
        description: `من كورس: ${course.title}`,
        videoUrl: v.videoUrl,
        thumbnailUrl: course.thumbnailUrl || '',
      }));
    }
    return [
      {
        title: course.title,
        description: 'الدرس الرئيسي للكورس',
        videoUrl: course.url,
        thumbnailUrl: course.thumbnailUrl || '',
      },
    ];
  };

  const handleSaveDiscoveredCourse = async (result: DiscoveredCourseResult): Promise<CourseItem> => {
    return coursesApi.createCourse({
      title: result.title,
      url: result.url,
      thumbnailUrl: result.thumbnailUrl || '',
      description: result.description,
      platform: result.platform,
      category: 'البرمجة وتطوير الويب',
      status: 'active',
      progressPercent: 0,
      videos: result.lessons.map((l) => ({
        id: createSafeId('cvid'),
        title: l.title,
        videoUrl: l.url || result.url,
        duration: l.duration || '',
      })),
    });
  };

  const handleCreatePathFromDiscoveredCourse = async (result: DiscoveredCourseResult) => {
    const savedCourse =
      coursesApi.courses.find((c) => c.url === result.url) ||
      (await handleSaveDiscoveredCourse(result));

    const initialSteps = buildInitialStepsFromCourse({
      title: savedCourse.title,
      url: savedCourse.url,
      thumbnailUrl: savedCourse.thumbnailUrl,
      videos: savedCourse.videos,
    });

    const newPathId = await createPath({
      title: savedCourse.title,
      description: savedCourse.description,
      coverImage: savedCourse.thumbnailUrl || '',
      initialSteps,
    });
    await coursesApi.linkCourseToPath(savedCourse.id, newPathId);
    selectPath(newPathId);
    setActiveSection('path');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddCourseVideosToNewPath = async (course: CourseItem): Promise<string> => {
    const initialSteps = buildInitialStepsFromCourse(course);
    const newPathId = await createPath({
      title: course.title,
      description: course.description,
      coverImage: course.thumbnailUrl || '',
      initialSteps,
    });
    await coursesApi.linkCourseToPath(course.id, newPathId);
    return newPathId;
  };

  const handleAddCourseVideosToExistingPath = async (
    course: CourseItem,
    pathId: string
  ): Promise<void> => {
    const existingSteps = stepsByPath[pathId] || [];
    const baseOrder = existingSteps.length + 1;
    const toAdd = buildInitialStepsFromCourse(course);
    for (let i = 0; i < toAdd.length; i++) {
      await addVideoStep(pathId, {
        title: toAdd[i].title,
        description: toAdd[i].description || '',
        videoUrl: toAdd[i].videoUrl,
        thumbnailUrl: toAdd[i].thumbnailUrl || '',
        order1Based: baseOrder + i,
        targetDate: '',
      });
    }
    if (!course.linkedPathId) {
      await coursesApi.linkCourseToPath(course.id, pathId);
    }
  };

  const handleSendCourseToBoard = async (course: CourseItem) => {
    const existingCards = boardApi.activeBoard?.cards || [];
    const built = buildCardsFromCourse(course, existingCards);
    await boardApi.appendCardsToBoard(boardApi.activeBoardId || null, built.cards, built.connections);
    setInspectingCourseId(null);
    setActiveSection('board');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSendPathToBoard = async (path: LearningPath) => {
    const pathSteps = stepsByPath[path.id] || [];
    if (pathSteps.length === 0) return;
    const existingCards = boardApi.activeBoard?.cards || [];
    const built = buildCardsFromLearningPath(path, pathSteps, existingCards);
    await boardApi.appendCardsToBoard(boardApi.activeBoardId || null, built.cards, built.connections);
    setActiveSection('board');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleWatchBoardCardVideo = (card: BoardCard) => {
    if (!boardApi.activeBoard) return;
    setWatchingBoardCard({
      boardId: boardApi.activeBoard.id,
      cardId: card.id,
    });
  };

  // Game Jam Cross-Feature Handlers
  const handleAddJamToCalendar = async (jam: SavedGameJam) => {
    const drafts = buildJamCalendarDrafts(jam);
    for (const draft of drafts) {
      await calendarApi.createEvent({
        title: draft.title,
        description: draft.description,
        date: draft.date,
        startTime: '18:00',
        endTime: '20:00',
        category: draft.category,
        colorHex: draft.colorHex,
        reminderMinutes: 60,
        reminderEnabled: true,
        linkedType: draft.linkedType,
        linkedId: draft.linkedId,
        linkedParentId: '',
        linkedLabel: draft.linkedLabel,
      });
    }
  };

  const handleCreateVaultProjectForJam = (jam: SavedGameJam) => {
    setSelectedVaultProject(null);
    setVaultModalMode('create');
    setVaultPreset({
      name: `${jam.name} (Game Jam)`,
      description: jam.theme ? `الثيم: ${jam.theme}\n${jam.description}` : jam.description,
      folder: DEFAULT_VAULT_FOLDERS[0],
      linkedJamId: jam.id,
    });
    setPendingVaultJamId(jam.id);
    setVaultModalOpen(true);
  };

  const handleCreateBoardCardForJam = async (jam: SavedGameJam) => {
    const targetBoard =
      (jam.linkedBoardId ? boardApi.boards.find((b) => b.id === jam.linkedBoardId) : null) ||
      boardApi.activeBoard;
    const pos = findNextFreeSpot(targetBoard?.cards || [], 80, 70);
    const card = createVideoBoardCard(
      {
        title: `مسابقة: ${jam.name}`,
        videoUrl: jam.officialUrl,
        thumbnailUrl: jam.thumbnailUrl || '',
        sourceLabel: `${jam.platform} · Game Jam`,
        noteText: jam.personalNotes || (jam.theme ? `الثيم: ${jam.theme}` : jam.description),
        sourceRefType: 'url',
        accentColor: 'crimson',
      },
      pos
    );
    const updatedBoardId = await boardApi.appendCardsToBoard(targetBoard?.id || null, [card], []);
    await jamsApi.updateSavedJam(jam.id, { linkedBoardId: updatedBoardId }, true);
    setActiveSection('board');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenJamNotesModal = async (jam: SavedGameJam) => {
    const existing = notesApi.notes.find((n) =>
      n.links.some((l) => l.type === 'game_jam' && l.targetId === jam.id)
    );
    if (existing) {
      handleOpenNoteInWorkspace(existing.id);
      return;
    }
    const created = await handleCreateLinkedNote({
      title: `ملاحظات مسابقة: ${jam.name}`,
      contentHtml: jam.personalNotes
        ? `<p>${jam.personalNotes}</p>`
        : `<p>خطة العمل، الأفكار الأساسية، وقائمة الموارد لمسابقة <strong>${jam.name}</strong>.</p>`,
      link: {
        type: 'game_jam',
        targetId: jam.id,
        parentId: '',
        label: jam.name,
      },
    });
    handleOpenNoteInWorkspace(created.id);
  };

  const handleSendVideoToBoard = async (video: OrganizedVideoItem, collection: VideoCollection) => {
    const pos = findNextFreeSpot(boardApi.activeBoard?.cards || [], 80, 70);
    const card = createVideoBoardCard(
      {
        title: video.title,
        videoUrl: video.videoUrl,
        thumbnailUrl: video.thumbnailUrl,
        sourceLabel: video.platformName || collection.title,
        completed: video.completed,
        noteText: video.notes,
        sourceRefType: 'url',
        accentColor: 'navy',
      },
      pos
    );
    await boardApi.appendCardsToBoard(boardApi.activeBoardId || null, [card], []);
    setActiveSection('board');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Calendar Quick Scheduling from Course / Board
  const handleScheduleCourse = (course: CourseItem) => {
    const todayIso = toDateIso(new Date());
    const nowIso = new Date().toISOString();
    setInspectingCourseId(null);
    setCalendarQuickPreset({
      id: '',
      ownerId: user?.uid || 'local',
      title: createCourseScheduleTitle(course),
      description: course.description || `متابعة الدروس التطبيقية لكورس ${course.title}`,
      date: todayIso,
      startTime: '18:00',
      endTime: '19:30',
      category: 'course',
      colorHex: CALENDAR_CATEGORY_META.course.colorHex,
      reminderMinutes: 30,
      reminderEnabled: true,
      completed: false,
      linkedType: 'course',
      linkedId: course.id,
      linkedParentId: '',
      linkedLabel: course.title,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    setCalendarQuickOpen(true);
  };

  const handleScheduleBoard = (board: LearningBoard) => {
    const todayIso = toDateIso(new Date());
    const nowIso = new Date().toISOString();
    setCalendarQuickPreset({
      id: '',
      ownerId: user?.uid || 'local',
      title: `جلسة لوحة التعلم: ${board.title}`,
      description: board.description || `تنظيم بطاقات وملاحظات لوحة ${board.title}`,
      date: todayIso,
      startTime: '19:00',
      endTime: '20:30',
      category: 'board',
      colorHex: CALENDAR_CATEGORY_META.board.colorHex,
      reminderMinutes: 30,
      reminderEnabled: true,
      completed: false,
      linkedType: 'learning_board',
      linkedId: board.id,
      linkedParentId: '',
      linkedLabel: board.title,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    setCalendarQuickOpen(true);
  };

  // Social Sharing Openers
  const openSharePath = (path: LearningPath) => {
    setShareTarget({
      itemType: 'learning_path',
      itemId: path.id,
      title: path.title,
      sourceData: {
        path,
        pathSteps: stepsByPath[path.id] || [],
      },
    });
  };

  const openShareCourse = (course: CourseItem) => {
    setShareTarget({
      itemType: 'course',
      itemId: course.id,
      title: course.title,
      sourceData: { course },
    });
  };

  const openShareJam = (jam: SavedGameJam) => {
    setShareTarget({
      itemType: 'saved_game_jam',
      itemId: jam.id,
      title: jam.name,
      sourceData: { jam },
    });
  };

  const openShareProject = (project: VaultProject) => {
    setShareTarget({
      itemType: 'vault_project',
      itemId: project.id,
      title: project.name,
      sourceData: {
        project,
        projectVersions: vault.versionsByProject[project.id] || [],
      },
    });
  };

  const openShareBoard = (board: LearningBoard) => {
    setShareTarget({
      itemType: 'learning_board',
      itemId: board.id,
      title: board.title,
      sourceData: { board },
    });
  };

  const openShareNote = (note: WorkspaceNote) => {
    setShareTarget({
      itemType: 'note',
      itemId: note.id,
      title: note.title,
      sourceData: { note },
    });
  };

  const openShareAsset = (asset: LibraryAsset) => {
    setShareTarget({
      itemType: 'library_asset',
      itemId: asset.id,
      title: asset.name,
      sourceData: { asset },
    });
  };

  const openShareVideoCollection = (col: VideoCollection) => {
    setShareTarget({
      itemType: 'video_collection',
      itemId: col.id,
      title: col.title,
      sourceData: { videoCollection: col },
    });
  };

  // Save a shared item as an independent copy in the current user's account
  const handleSaveSharedCopy = async (
    _share: SharedItemRecord,
    bundle: SharedPayloadBundle
  ): Promise<void> => {
    switch (bundle.itemType) {
      case 'learning_path': {
        if (!bundle.learningPath) return;
        const newPathId = await createPath({
          title: `${bundle.learningPath.path.title} (نسخة)`,
          description: bundle.learningPath.path.description,
          coverImage: bundle.learningPath.path.coverImage || '',
          initialSteps: bundle.learningPath.steps.map((s) => ({
            title: s.title,
            description: s.description,
            videoUrl: s.videoUrl,
            thumbnailUrl: s.thumbnailUrl || '',
            targetDate: s.targetDate,
          })),
        });
        selectPath(newPathId);
        showLocalToast(`تم حفظ نسخة من مسار "${bundle.learningPath.path.title}" في حسابك.`);
        return;
      }

      case 'course': {
        if (!bundle.course) return;
        await coursesApi.createCourse({
          title: `${bundle.course.title} (نسخة)`,
          url: bundle.course.url,
          thumbnailUrl: bundle.course.thumbnailUrl || '',
          description: bundle.course.description,
          platform: bundle.course.platform,
          category: bundle.course.category,
          status: 'active',
          progressPercent: 0,
          videos: bundle.course.videos.map((v) => ({
            ...v,
            id: createSafeId('cvid'),
          })),
        });
        showLocalToast(`تم حفظ نسخة من كورس "${bundle.course.title}" في كورساتك.`);
        return;
      }

      case 'saved_game_jam': {
        if (!bundle.savedGameJam) return;
        const j = bundle.savedGameJam;
        const saved = await jamsApi.saveGameJam({
          id: createSafeId('jam_copy'),
          name: j.name,
          description: j.description,
          startDate: j.startDate,
          endDate: j.endDate,
          status: j.status,
          mode: j.mode,
          location: j.location,
          theme: j.theme,
          platform: j.platform,
          organizer: j.organizer,
          officialUrl: j.officialUrl,
          thumbnailUrl: j.thumbnailUrl || '',
          participantsCount: 0,
          tags: [],
          beginnerFriendly: true,
          sourceName: j.platform,
          sourceUrl: j.officialUrl,
          infoUpdatedAt: new Date().toISOString(),
        });
        if (j.personalNotes) {
          await jamsApi.updateSavedJam(saved.id, { personalNotes: j.personalNotes }, true);
        }
        showLocalToast(`تم حفظ مسابقة "${j.name}" في مسابقاتك.`);
        return;
      }

      case 'learning_board': {
        if (!bundle.learningBoard) return;
        const created = await boardApi.createBoard({
          title: `${bundle.learningBoard.title} (نسخة)`,
          description: bundle.learningBoard.description,
        });
        boardApi.saveBoardLayout(
          created.id,
          {
            cards: bundle.learningBoard.cards.map((c) => ({ ...c, id: createSafeId('bcard') })),
            connections: [],
            drawings: bundle.learningBoard.drawings || [],
            viewport: bundle.learningBoard.viewport,
          },
          { immediate: true }
        );
        showLocalToast(`تم حفظ نسخة من لوحة "${bundle.learningBoard.title}" في حسابك.`);
        return;
      }

      case 'note': {
        if (!bundle.note) return;
        await notesApi.createNote({
          title: `${bundle.note.title} (نسخة)`,
          contentHtml: bundle.note.contentHtml,
          folder: bundle.note.folder || 'ملاحظات مشتركة',
          tags: bundle.note.tags,
        });
        showLocalToast(`تم حفظ الملاحظة "${bundle.note.title}" في ملاحظاتك.`);
        return;
      }

      case 'video_collection': {
        if (!bundle.videoCollection) return;
        const col = await videosApi.createCollection({
          title: `${bundle.videoCollection.title} (نسخة)`,
          description: bundle.videoCollection.description,
          category: bundle.videoCollection.category,
          tags: bundle.videoCollection.tags,
          coverImage: bundle.videoCollection.coverImage || '',
        });
        for (const v of bundle.videoCollection.videos) {
          await videosApi.addVideoToCollection(col, {
            title: v.title,
            videoUrl: v.videoUrl,
            platformId: v.platformId,
            platformName: v.platformName,
            thumbnailUrl: v.thumbnailUrl,
            description: v.description,
            notes: '',
            tags: v.tags,
            category: v.category,
          });
        }
        showLocalToast(`تم حفظ مجموعة "${bundle.videoCollection.title}" في حسابك.`);
        return;
      }

      case 'vault_project': {
        if (!bundle.vaultProject) return;
        const summaryFile = new File(
          [JSON.stringify(bundle.vaultProject, null, 2)],
          'shared-project-summary.json',
          { type: 'application/json' }
        );
        await vault.createProject({
          name: `${bundle.vaultProject.project.name} (نسخة)`,
          description: bundle.vaultProject.project.description,
          folder: bundle.vaultProject.project.folder || DEFAULT_VAULT_FOLDERS[0],
          previewImage: bundle.vaultProject.project.previewImage || '',
          notes: 'نسخة محفوظة من مشاركة صديق (ملخص المواصفات والإصدارات).',
          files: [summaryFile],
        });
        showLocalToast(`تم حفظ ملخص مشروع "${bundle.vaultProject.project.name}" في خزنتك.`);
        return;
      }

      case 'library_asset': {
        if (!bundle.libraryAsset) return;
        const summaryFile = new File(
          [JSON.stringify(bundle.libraryAsset, null, 2)],
          'shared-asset-manifest.json',
          { type: 'application/json' }
        );
        await assetLib.createAsset({
          name: `${bundle.libraryAsset.name} (نسخة)`,
          description: bundle.libraryAsset.description,
          category: bundle.libraryAsset.category,
          folder: bundle.libraryAsset.folder || 'موارد عامة',
          tags: bundle.libraryAsset.tags,
          previewImage: bundle.libraryAsset.previewImage || '',
          newFiles: [summaryFile],
          materialSpec: bundle.libraryAsset.materialSpec,
        });
        showLocalToast(`تم حفظ بطاقة الأصل "${bundle.libraryAsset.name}" في مكتبتك.`);
        return;
      }
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col text-[#062D4C] dark:text-slate-100">
      <Header
        activeSection={activeSection}
        onChangeSection={handleChangeSection}
        user={user}
        isDark={isDark}
        onToggleTheme={() => setIsDark((prev) => !prev)}
        onSignIn={signInWithGoogle}
        onSignOut={logout}
        userLevel={gamification.levelSummary.level}
        currentStreak={gamification.streakResult.currentStreak}
        unreadNotificationsCount={gamification.unreadNotificationsCount}
        pendingReviewCount={quizzesApi.pendingReviewCount}
        onOpenNotifications={() => setNotificationsOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-5 sm:py-7 space-y-8">
        <CelebrationBanner
          celebration={gamification.activeCelebration}
          onDismiss={gamification.dismissCelebration}
          onOpenSection={handleChangeSection}
        />

        {/* Global Status / Error Banners */}
        {activeToastMessage && (
          <div
            role="status"
            className="rounded-xl border-2 border-[#062D4C] bg-emerald-50 dark:bg-emerald-950/60 px-4 py-3 text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2 shadow-[3px_4px_0_#059669]"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{activeToastMessage}</span>
          </div>
        )}

        {activeErrorMessage && (
          <div
            role="alert"
            className="rounded-xl border-2 border-[#062D4C] bg-rose-50 dark:bg-rose-950/60 px-4 py-3 text-sm font-bold text-rose-900 dark:text-rose-200 flex items-center justify-between gap-3 shadow-[3px_4px_0_#B92622]"
          >
            <span>{activeErrorMessage}</span>
            <button
              type="button"
              onClick={() => {
                dismissError();
                vault.dismissVaultError();
                assetLib.dismissAssetError();
                notesApi.dismissNotesError();
                todosApi.dismissTodosError();
                coursesApi.dismissCoursesError();
                boardApi.dismissBoardError();
                jamsApi.dismissJamsError();
                videosApi.dismissVideosError();
                calendarApi.dismissCalendarError();
                sharingApi.dismissShareError();
                practicalProjectsApi.dismissProjectError();
              }}
              aria-label="إغلاق التنبيه"
              className="p-1 text-rose-700 dark:text-rose-300 hover:text-rose-950 cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        )}

        {activeSection === 'dashboard' && (
          <DashboardView
            userName={user?.displayName || 'متعلم منصة مسار'}
            userUid={user?.uid || 'local'}
            levelSummary={gamification.levelSummary}
            currentStreak={gamification.streakResult.currentStreak}
            longestStreak={gamification.streakResult.longestStreak}
            todos={todosApi.todos}
            paths={paths}
            stepsByPath={stepsByPath}
            pathProgressMap={pathProgressMap}
            statsSummary={gamification.statsSummary}
            badges={gamification.badges}
            leaderboardEntries={gamification.leaderboardEntries}
            practicalProjects={practicalProjectsApi.projects}
            pendingReviewCount={quizzesApi.pendingReviewCount}
            favoritesCount={favoritesApi.favorites.length}
            onToggleTodo={(task) => void handleToggleTodoCompleted(task)}
            onSelectPath={(pathId) => {
              if (paths.some((p) => p.id === pathId)) selectPath(pathId);
              handleChangeSection('path');
            }}
            onNavigateSection={handleChangeSection}
          />
        )}

        {activeSection === 'path' && (
          <>
            {cloudLoading && !activePath ? (
              <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
                جاري تحميل مساراتك التعليمية...
              </div>
            ) : activePath ? (
              <>
                <PathHeroBar
                  paths={paths}
                  activePath={activePath}
                  progress={progress}
                  isFavorite={favoritesApi.isFavorited('learning_path', activePath.id)}
                  hasCertificate={gamification.certificates.some(
                    (c) => c.pathId === activePath.id
                  )}
                  onSelectPath={selectPath}
                  onViewAllPaths={() => setDirectoryModalOpen(true)}
                  onCreatePath={handleOpenCreatePath}
                  onEditPath={() => handleOpenEditPath(activePath)}
                  onCreateTodoForPath={(path) =>
                    openLinkedTodoModal(
                      {
                        type: 'learning_path',
                        targetId: path.id,
                        parentId: '',
                        label: path.title,
                      },
                      `إتمام الدرس التالي في ${path.title}`
                    )
                  }
                  onSendPathToBoard={(path) => void handleSendPathToBoard(path)}
                  onSharePath={openSharePath}
                  onToggleFavoritePath={(path) =>
                    void favoritesApi.toggleFavorite({
                      targetType: 'learning_path',
                      targetId: path.id,
                      title: path.title,
                      subtitle: path.description,
                      thumbnailUrl: path.coverImage,
                    })
                  }
                  onOpenCertificate={() => handleChangeSection('achievements')}
                  onDeletePath={() => setConfirmDeletePathTarget(activePath)}
                  onAddVideo={handleOpenAddVideo}
                />

                <TodaysLearningCard
                  progress={progress}
                  onWatch={(step) => setWatchingState({ stepId: step.id, focusNotes: false })}
                  onOpenQuickNotes={(step) =>
                    setWatchingState({ stepId: step.id, focusNotes: true })
                  }
                  onMarkCompleted={(step) =>
                    void handleToggleStepCompleted(activePath.id, step, true)
                  }
                  onAddVideo={handleOpenAddVideo}
                />

                <VideoPathTimeline
                  steps={steps}
                  progress={progress}
                  isStepFavorite={(stepId) => favoritesApi.isFavorited('video_step', stepId)}
                  hasStepQuiz={(stepId) => quizzesApi.quizzes.some((q) => q.stepId === stepId)}
                  onToggleStepFavorite={(step) =>
                    void favoritesApi.toggleFavorite({
                      targetType: 'video_step',
                      targetId: step.id,
                      parentId: step.pathId,
                      title: step.title,
                      subtitle: activePath.title,
                      url: step.videoUrl,
                      thumbnailUrl: step.thumbnailUrl,
                    })
                  }
                  onOpenStepQuiz={(step) => setQuizStep(step)}
                  onWatch={(step) => setWatchingState({ stepId: step.id, focusNotes: false })}
                  onOpenQuickNotes={(step) =>
                    setWatchingState({ stepId: step.id, focusNotes: true })
                  }
                  onToggleComplete={(step) =>
                    void handleToggleStepCompleted(activePath.id, step, !step.completed)
                  }
                  onEdit={handleOpenEditVideo}
                  onDelete={(step) => setConfirmDeleteStep(step)}
                  onReorder={(fromIndex, toIndex) =>
                    void reorderSteps(activePath.id, fromIndex, toIndex)
                  }
                  onCommitOrder={(orderedIds) =>
                    void reorderStepsByIdOrder(activePath.id, orderedIds)
                  }
                  onAddVideo={handleOpenAddVideo}
                />
              </>
            ) : null}
          </>
        )}

        {activeSection === 'skills' && (
          <SkillTreeView
            skills={gamification.skills}
            paths={paths}
            courses={coursesApi.courses}
            projects={practicalProjectsApi.projects}
            onUpdateSkillLinks={gamification.updateSkillLinks}
            onCreateCustomSkill={gamification.createCustomSkill}
            onOpenLinkedPath={(pathId) => {
              if (paths.some((p) => p.id === pathId)) selectPath(pathId);
              handleChangeSection('path');
            }}
          />
        )}

        {activeSection === 'projects' && (
          <PracticalProjectsView
            projects={practicalProjectsApi.projects}
            paths={paths}
            uid={user?.uid || null}
            uploadProgress={practicalProjectsApi.uploadProgress}
            onSaveProject={practicalProjectsApi.saveProject}
            onToggleStage={practicalProjectsApi.toggleStageCompleted}
            onSetStatus={practicalProjectsApi.setProjectStatus}
            onDeleteProject={practicalProjectsApi.deleteProject}
            onDownloadFile={practicalProjectsApi.downloadProjectAttachment}
            onProjectCompletedReward={(project) =>
              gamification.recordProjectCompleted(project.id, project.title, project.xpReward)
            }
            onOpenLinkedPath={(pathId) => {
              if (paths.some((p) => p.id === pathId)) selectPath(pathId);
              handleChangeSection('path');
            }}
          />
        )}

        {activeSection === 'review' && (
          <SmartReviewView
            reviewItems={quizzesApi.reviewItems}
            summary={quizzesApi.reviewSummary}
            onAnswerReviewItem={quizzesApi.answerReviewItem}
            onMasteredXpReward={(item) =>
              gamification.recordReviewMastered(item.id, item.prompt)
            }
            onDeleteReviewItem={quizzesApi.deleteReviewItem}
          />
        )}

        {activeSection === 'stats' && (
          <StatisticsView
            stats={gamification.statsSummary}
            certificates={gamification.certificates}
            onOpenPath={(pathId) => {
              if (paths.some((p) => p.id === pathId)) selectPath(pathId);
              handleChangeSection('path');
            }}
            onNavigateSection={handleChangeSection}
          />
        )}

        {activeSection === 'achievements' && (
          <BadgesStreakXpView
            levelSummary={gamification.levelSummary}
            streakResult={gamification.streakResult}
            badges={gamification.badges}
            transactions={gamification.transactions}
            certificates={gamification.certificates}
            onVerifyCertificate={gamification.verifyCertificateByCode}
          />
        )}

        {activeSection === 'leaderboard' && (
          <LeaderboardView
            entries={gamification.leaderboardEntries}
            currentUserId={user?.uid || 'local'}
          />
        )}

        {activeSection === 'favorites' && (
          <FavoritesView
            favorites={favoritesApi.favorites}
            onOpenFavorite={handleOpenFavorite}
            onRemoveFavorite={favoritesApi.removeFavorite}
          />
        )}

        {activeSection === 'courses' && (
          <CoursesView
            courses={coursesApi.courses}
            cloudLoading={coursesApi.cloudLoading}
            onAddManualCourse={() => {
              setEditingCourse(null);
              setCourseModalMode('create');
              setCourseModalOpen(true);
            }}
            onInspectCourse={(course) => setInspectingCourseId(course.id)}
            onEditCourse={(course) => {
              setEditingCourse(course);
              setCourseModalMode('edit');
              setCourseModalOpen(true);
            }}
            onDeleteCourse={(course) => setConfirmDeleteCourseTarget(course)}
            onShareCourse={openShareCourse}
            onScheduleCourse={handleScheduleCourse}
            isCourseFavorite={(courseId) => favoritesApi.isFavorited('course', courseId)}
            onToggleFavoriteCourse={(course) =>
              void favoritesApi.toggleFavorite({
                targetType: 'course',
                targetId: course.id,
                title: course.title,
                subtitle: course.platform || course.category,
                url: course.url,
                thumbnailUrl: course.thumbnailUrl,
              })
            }
            onOpenLearningPath={(pathId) => {
              if (paths.some((p) => p.id === pathId)) {
                selectPath(pathId);
              }
              setActiveSection('path');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onSaveDiscoveredCourse={handleSaveDiscoveredCourse}
            onCreatePathFromDiscoveredCourse={handleCreatePathFromDiscoveredCourse}
          />
        )}

        {activeSection === 'board' && (
          <LearningBoardView
            uid={user?.uid || null}
            boards={boardApi.boards}
            activeBoard={boardApi.activeBoard}
            cloudLoading={boardApi.cloudLoading}
            courses={coursesApi.courses}
            learningPaths={paths}
            stepsByPath={stepsByPath}
            todos={todosApi.todos}
            notes={notesApi.notes}
            onSelectBoard={boardApi.selectBoard}
            onCreateBoard={boardApi.createBoard}
            onRenameBoard={boardApi.renameBoard}
            onDeleteBoard={boardApi.deleteBoard}
            onSaveBoardLayout={boardApi.saveBoardLayout}
            onWatchBoardVideo={handleWatchBoardCardVideo}
            onCreateTodo={todosApi.createTodo}
            onToggleTodoCompleted={handleToggleTodoCompleted}
            onDeleteTodo={todosApi.deleteTodo}
            onCreateNote={notesApi.createNote}
            onUpdateNote={notesApi.updateNote}
            onOpenNoteInWorkspace={handleOpenNoteInWorkspace}
            onShareBoard={openShareBoard}
            onScheduleBoard={handleScheduleBoard}
          />
        )}

        {activeSection === 'videos' && (
          <VideoCollectionsView
            collections={videosApi.collections}
            notes={notesApi.notes}
            cloudLoading={videosApi.cloudLoading}
            onCreateCollection={videosApi.createCollection}
            onUpdateCollection={videosApi.updateCollection}
            onDeleteCollection={videosApi.deleteCollection}
            onAddVideo={videosApi.addVideoToCollection}
            onUpdateVideo={videosApi.updateVideoInCollection}
            onToggleVideoCompleted={videosApi.toggleVideoCompleted}
            onRemoveVideo={videosApi.removeVideoFromCollection}
            onSendVideoToBoard={(video, col) => void handleSendVideoToBoard(video, col)}
            onCreateTodoForVideo={(video, col) =>
              openLinkedTodoModal(
                {
                  type: 'video_collection',
                  targetId: col.id,
                  parentId: '',
                  label: col.title,
                },
                `مشاهدة وتطبيق: ${video.title}`
              )
            }
            onShareCollection={openShareVideoCollection}
            onOpenNoteInWorkspace={handleOpenNoteInWorkspace}
            onCreateLinkedNote={handleCreateLinkedNote}
            isVideoFavorite={(videoId) => favoritesApi.isFavorited('collection_video', videoId)}
            onToggleFavoriteVideo={(video, col) =>
              void favoritesApi.toggleFavorite({
                targetType: 'collection_video',
                targetId: video.id,
                parentId: col.id,
                title: video.title,
                subtitle: col.title,
                url: video.videoUrl,
                thumbnailUrl: video.thumbnailUrl,
              })
            }
          />
        )}

        {activeSection === 'jams' && (
          <GameJamFinderView
            savedJams={jamsApi.savedJams}
            notes={notesApi.notes}
            cloudLoading={jamsApi.cloudLoading}
            onSaveJam={jamsApi.saveGameJam}
            onUpdateSavedJam={jamsApi.updateSavedJam}
            onAddJamResource={jamsApi.addJamResource}
            onRemoveJamResource={jamsApi.removeJamResource}
            onDeleteSavedJam={jamsApi.deleteSavedJam}
            onCreateVaultProjectForJam={handleCreateVaultProjectForJam}
            onCreateTodoForJam={(jam) =>
              openLinkedTodoModal(
                {
                  type: 'game_jam',
                  targetId: jam.id,
                  parentId: '',
                  label: jam.name,
                },
                `تجهيز نموذج اللعبة لمسابقة ${jam.name}`
              )
            }
            onCreateBoardCardForJam={(jam) => void handleCreateBoardCardForJam(jam)}
            onAddJamToCalendar={handleAddJamToCalendar}
            onShareJam={openShareJam}
            onOpenJamNotesModal={(jam) => void handleOpenJamNotesModal(jam)}
          />
        )}

        {activeSection === 'calendar' && (
          <CalendarView
            events={calendarApi.events}
            todos={todosApi.todos}
            paths={paths}
            stepsByPath={stepsByPath}
            courses={coursesApi.courses}
            savedJams={jamsApi.savedJams}
            projects={vault.projects}
            boards={boardApi.boards}
            cloudLoading={calendarApi.cloudLoading}
            onCreateEvent={calendarApi.createEvent}
            onUpdateEvent={calendarApi.updateEvent}
            onMoveEventDate={calendarApi.moveEventDate}
            onToggleEventCompleted={calendarApi.toggleEventCompleted}
            onDeleteEvent={calendarApi.deleteEvent}
            onToggleTodo={(task) => void handleToggleTodoCompleted(task)}
            onCreateTodoFromCalendarItem={(item) =>
              openLinkedTodoModal(
                item.linkedType !== 'none' && item.linkedType !== 'todo'
                  ? {
                      type:
                        item.linkedType === 'project'
                          ? 'project'
                          : item.linkedType === 'course'
                            ? 'course'
                            : item.linkedType === 'learning_path'
                              ? 'learning_path'
                              : item.linkedType === 'learning_board'
                                ? 'learning_board'
                                : 'game_jam',
                      targetId: item.linkedId,
                      parentId: item.linkedParentId,
                      label: item.linkedLabel || item.title,
                    }
                  : undefined,
                item.title
              )
            }
            onNavigateToLinkedItem={handleNavigateFromCalendar}
          />
        )}

        {activeSection === 'todos' && (
          <TodosView
            todos={todosApi.todos}
            cloudLoading={todosApi.cloudLoading}
            onQuickCreateTodo={todosApi.createTodo}
            onOpenCreateModal={() => openLinkedTodoModal()}
            onOpenEditModal={(task) => {
              setEditingTodo(task);
              setTodoModalMode('edit');
              setTodoInitialLink(null);
              setTodoInitialTitle('');
              setTodoModalOpen(true);
            }}
            onToggleCompleted={handleToggleTodoCompleted}
            onDeleteTodo={(task) => setConfirmDeleteTodoTarget(task)}
            onNavigateToLink={handleNavigateFromTodo}
          />
        )}

        {activeSection === 'vault' && (
          <ProjectVaultView
            projects={vault.projects}
            versionsByProject={vault.versionsByProject}
            notes={notesApi.notes}
            savedGameJams={jamsApi.savedJams}
            storageSummary={storageSummary}
            cloudLoading={vault.cloudLoading}
            onCreateProject={() => {
              setSelectedVaultProject(null);
              setVaultPreset(null);
              setPendingVaultJamId(null);
              setVaultModalMode('create');
              setVaultModalOpen(true);
            }}
            onEditProjectMeta={(project) => {
              setSelectedVaultProject(project);
              setVaultPreset(null);
              setVaultModalMode('edit_meta');
              setVaultModalOpen(true);
            }}
            onAddOrReplaceBackup={(project) => {
              setSelectedVaultProject(project);
              setVaultPreset(null);
              setVaultModalMode('backup');
              setVaultModalOpen(true);
            }}
            onOpenRestore={(project) => setRestoreProjectId(project.id)}
            onCreateTodoForProject={(project) =>
              openLinkedTodoModal(
                {
                  type: 'project',
                  targetId: project.id,
                  parentId: '',
                  label: project.name,
                },
                `تحديث وحفظ نسخة جديدة لمشروع ${project.name}`
              )
            }
            onShareProject={openShareProject}
            onDeleteProject={(project) => setConfirmDeleteVaultProject(project)}
          />
        )}

        {activeSection === 'assets' && (
          <AssetLibraryView
            assets={assetLib.assets}
            notes={notesApi.notes}
            storageSummary={storageSummary}
            cloudLoading={assetLib.cloudLoading}
            onAddAsset={() => {
              setEditingAsset(null);
              setAssetModalMode('create');
              setAssetModalOpen(true);
            }}
            onEditAsset={(asset) => {
              setEditingAsset(asset);
              setAssetModalMode('edit');
              setAssetModalOpen(true);
            }}
            onInspectAsset={(asset) => setInspectingAssetId(asset.id)}
            onDownloadAsset={(asset) => void assetLib.downloadAssetBundle(asset)}
            onCreateTodoForAsset={(asset) =>
              openLinkedTodoModal(
                {
                  type: 'asset',
                  targetId: asset.id,
                  parentId: '',
                  label: asset.name,
                },
                `مراجعة وتجهيز أصل ${asset.name}`
              )
            }
            onShareAsset={openShareAsset}
            onDeleteAsset={(asset) => setConfirmDeleteAsset(asset)}
          />
        )}

        {activeSection === 'notes' && (
          <NotesView
            notes={notesApi.notes}
            cloudLoading={notesApi.cloudLoading}
            selectedNoteId={selectedNoteId}
            onSelectNoteId={setSelectedNoteId}
            vaultProjects={vault.projects}
            libraryAssets={assetLib.assets}
            learningStepChoices={learningStepChoices}
            learningPaths={paths}
            courses={coursesApi.courses}
            learningBoards={boardApi.boards}
            savedGameJams={jamsApi.savedJams}
            videoCollections={videosApi.collections}
            onCreateNote={notesApi.createNote}
            onUpdateNote={notesApi.updateNote}
            onTogglePinNote={notesApi.togglePinNote}
            onDeleteNote={(note) => setConfirmDeleteNote(note)}
            onNavigateToLinkedItem={handleNavigateToLinkedItem}
            onShareNote={openShareNote}
          />
        )}

        {activeSection === 'shared' && (
          <SharedWithMeView
            myProfile={sharingApi.myProfile}
            friends={sharingApi.friends}
            outgoingShares={sharingApi.outgoingShares}
            incomingShares={sharingApi.incomingShares}
            cloudLoading={sharingApi.cloudLoading}
            onClaimUsername={sharingApi.claimUsername}
            onLookupUsername={sharingApi.lookupUserByUsername}
            onAddFriend={sharingApi.addFriend}
            onRemoveFriend={sharingApi.removeFriend}
            onOpenSharedItem={(share) => setInspectingShare(share)}
            onSaveCopyToMyAccount={handleSaveSharedCopy}
            onUpdateSharePermissions={sharingApi.updateSharePermissions}
            onDeleteShare={sharingApi.deleteShare}
            onRedeemShareInvite={sharingApi.redeemShareInvite}
          />
        )}
      </main>

      <footer className="border-t-2 border-[#062D4C]/20 dark:border-slate-800 bg-white/75 dark:bg-slate-900/80 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-wrap items-center justify-between gap-4 text-xs sm:text-sm font-bold text-[#062D4C]/80 dark:text-slate-400">
          <span>
            منصة مسار التعلم · مسارات الفيديو، كورساتي، لوحة التعلم، الفيديوهات، مسابقات الألعاب،
            التقويم والمشاركات
          </span>
          <span>حفظ متزامن للتقدم والملفات والمهام والمواعيد</span>
        </div>
      </footer>

      {/* Video Path Modals */}
      {activePath && (
        <VideoFormModal
          open={videoModalOpen}
          mode={videoModalMode}
          initialStep={editingStep}
          totalSteps={steps.length}
          onClose={() => setVideoModalOpen(false)}
          onSubmit={async (payload) => {
            if (videoModalMode === 'edit' && editingStep) {
              await updateVideoStep(activePath.id, editingStep.id, payload);
            } else {
              await addVideoStep(activePath.id, payload);
            }
          }}
        />
      )}

      <PathFormModal
        open={pathModalOpen}
        mode={pathModalMode}
        initialPath={pathModalMode === 'edit' ? editingPath : null}
        existingPaths={paths}
        onClose={() => setPathModalOpen(false)}
        onSubmit={async (payload) => {
          if (pathModalMode === 'edit' && editingPath) {
            await updatePath(editingPath.id, payload);
          } else {
            await createPath(payload);
          }
        }}
      />

      {activePath && (
        <PathsDirectoryModal
          open={directoryModalOpen}
          paths={paths}
          activePathId={activePath.id}
          progressMap={pathProgressMap}
          onSelectPath={selectPath}
          onCreatePath={handleOpenCreatePath}
          onEditPath={handleOpenEditPath}
          onDeletePath={(p) => setConfirmDeletePathTarget(p)}
          onClose={() => setDirectoryModalOpen(false)}
        />
      )}

      <VideoWatchModal
        step={watchingStep}
        focusNotes={Boolean(watchingState?.focusNotes)}
        notes={notesApi.notes}
        onOpenNoteInWorkspace={handleOpenNoteInWorkspace}
        onCreateLinkedNote={handleCreateLinkedNote}
        onOpenQuizForStep={
          watchingBoardCard
            ? undefined
            : (step) => {
                setWatchingState(null);
                setQuizStep(step);
              }
        }
        isFavorite={
          watchingStep && !watchingBoardCard
            ? favoritesApi.isFavorited('video_step', watchingStep.id)
            : false
        }
        onToggleFavorite={
          watchingBoardCard
            ? undefined
            : (step) =>
                void favoritesApi.toggleFavorite({
                  targetType: 'video_step',
                  targetId: step.id,
                  parentId: step.pathId,
                  title: step.title,
                  subtitle: activePath?.title || '',
                  url: step.videoUrl,
                  thumbnailUrl: step.thumbnailUrl,
                })
        }
        onVideoWatched={(step) => void gamification.recordVideoWatch(step.id, step.title)}
        onCreateTodoForStep={(step) => {
          setWatchingState(null);
          setWatchingBoardCard(null);
          openLinkedTodoModal(
            watchingBoardCard
              ? {
                  type: 'learning_board',
                  targetId: watchingBoardCard.cardId,
                  parentId: watchingBoardCard.boardId,
                  label: step.title,
                }
              : {
                  type: 'learning_step',
                  targetId: step.id,
                  parentId: step.pathId,
                  label: step.title,
                },
            `مشاهدة وتطبيق: ${step.title}`
          );
        }}
        onClose={() => {
          setWatchingState(null);
          setWatchingBoardCard(null);
        }}
        onMarkCompleted={(step) => {
          if (watchingBoardCard) {
            const targetBoard = boardApi.boards.find((b) => b.id === watchingBoardCard.boardId);
            if (targetBoard) {
              boardApi.saveBoardLayout(
                targetBoard.id,
                {
                  cards: targetBoard.cards.map((c) =>
                    c.id === watchingBoardCard.cardId ? { ...c, completed: true } : c
                  ),
                },
                { immediate: true }
              );
            }
          } else if (activePath) {
            void handleToggleStepCompleted(activePath.id, step, true);
          }
        }}
        onSaveQuickNotes={async (step, notesText) => {
          if (watchingBoardCard) {
            const targetBoard = boardApi.boards.find((b) => b.id === watchingBoardCard.boardId);
            if (targetBoard) {
              boardApi.saveBoardLayout(
                targetBoard.id,
                {
                  cards: targetBoard.cards.map((c) =>
                    c.id === watchingBoardCard.cardId ? { ...c, noteText: notesText } : c
                  ),
                },
                { immediate: true }
              );
            }
          } else if (activePath) {
            await updateStepQuickNotes(activePath.id, step.id, notesText);
          }
        }}
      />

      {/* Courses Modals */}
      <CourseFormModal
        open={courseModalOpen}
        mode={courseModalMode}
        initialCourse={courseModalMode === 'edit' ? editingCourse : null}
        onClose={() => setCourseModalOpen(false)}
        onSubmit={async (payload) => {
          if (courseModalMode === 'edit' && editingCourse) {
            await coursesApi.updateCourse(editingCourse.id, payload);
          } else {
            await coursesApi.createCourse(payload);
          }
        }}
      />

      <CourseDetailModal
        course={inspectingCourse}
        learningPaths={paths}
        todos={todosApi.todos}
        notes={notesApi.notes}
        onClose={() => setInspectingCourseId(null)}
        onEditCourse={(course) => {
          setEditingCourse(course);
          setCourseModalMode('edit');
          setCourseModalOpen(true);
        }}
        onUpdateProgress={coursesApi.updateCourseProgress}
        onAddVideosToNewPath={handleAddCourseVideosToNewPath}
        onAddVideosToExistingPath={handleAddCourseVideosToExistingPath}
        onOpenLearningPath={(pathId) => {
          if (paths.some((p) => p.id === pathId)) {
            selectPath(pathId);
          }
          setActiveSection('path');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onSendCourseToBoard={handleSendCourseToBoard}
        onCreateTodoForCourse={(course) =>
          openLinkedTodoModal(
            {
              type: 'course',
              targetId: course.id,
              parentId: '',
              label: course.title,
            },
            `متابعة درس جديد من كورس ${course.title}`
          )
        }
        onShareCourse={openShareCourse}
        onScheduleCourse={handleScheduleCourse}
        onToggleTodoCompleted={handleToggleTodoCompleted}
        onOpenNoteInWorkspace={handleOpenNoteInWorkspace}
        onCreateLinkedNote={handleCreateLinkedNote}
      />

      {/* To-Do Modal */}
      <TodoFormModal
        open={todoModalOpen}
        mode={todoModalMode}
        initialTask={todoModalMode === 'edit' ? editingTodo : null}
        initialLink={todoInitialLink}
        initialTitle={todoInitialTitle}
        learningPaths={paths}
        learningStepChoices={learningStepChoices}
        courses={coursesApi.courses}
        vaultProjects={vault.projects}
        libraryAssets={assetLib.assets}
        learningBoards={boardApi.boards}
        savedGameJams={jamsApi.savedJams}
        videoCollections={videosApi.collections}
        onClose={() => setTodoModalOpen(false)}
        onSubmit={async (payload) => {
          if (todoModalMode === 'edit' && editingTodo) {
            await todosApi.updateTodo(editingTodo.id, payload);
          } else {
            await todosApi.createTodo(payload);
          }
        }}
      />

      {/* Project Vault Modals */}
      <VaultProjectModal
        open={vaultModalOpen}
        mode={vaultModalMode}
        project={selectedVaultProject}
        initialPreset={vaultPreset}
        versions={
          selectedVaultProject ? vault.versionsByProject[selectedVaultProject.id] || [] : []
        }
        existingFolders={vaultFolders}
        uploadProgress={vault.uploadProgress}
        onResetUploadState={vault.resetUploadProgress}
        onClose={() => {
          setVaultModalOpen(false);
          setVaultPreset(null);
          setPendingVaultJamId(null);
        }}
        onCreateProject={async (payload) => {
          const newId = await vault.createProject(payload);
          if (pendingVaultJamId) {
            await jamsApi.updateSavedJam(pendingVaultJamId, { linkedProjectId: newId }, true);
            setPendingVaultJamId(null);
          }
          setVaultPreset(null);
        }}
        onUpdateProjectMeta={vault.updateProjectMeta}
        onAddOrReplaceBackup={vault.addOrReplaceBackup}
      />

      <VaultRestoreModal
        open={Boolean(restoreProjectTarget)}
        uid={user?.uid || null}
        project={restoreProjectTarget}
        versions={
          restoreProjectTarget ? vault.versionsByProject[restoreProjectTarget.id] || [] : []
        }
        notes={notesApi.notes}
        onOpenNoteInWorkspace={handleOpenNoteInWorkspace}
        onCreateLinkedNote={handleCreateLinkedNote}
        onCreateTodoForProject={(project) => {
          setRestoreProjectId(null);
          openLinkedTodoModal(
            {
              type: 'project',
              targetId: project.id,
              parentId: '',
              label: project.name,
            },
            `تحديث وحفظ نسخة جديدة لمشروع ${project.name}`
          );
        }}
        onShareProject={openShareProject}
        onClose={() => setRestoreProjectId(null)}
        onRestoreVersion={vault.restoreProjectBundle}
        onDownloadFile={vault.downloadProjectFile}
      />

      {/* Asset Library Modals */}
      <AssetFormModal
        open={assetModalOpen}
        mode={assetModalMode}
        initialAsset={assetModalMode === 'edit' ? editingAsset : null}
        existingFolders={assetFolders}
        uploadProgress={assetLib.uploadProgress}
        onResetUploadState={assetLib.resetUploadProgress}
        onClose={() => setAssetModalOpen(false)}
        onSubmit={async (payload) => {
          if (assetModalMode === 'edit' && editingAsset) {
            await assetLib.updateAsset(editingAsset, payload);
          } else {
            await assetLib.createAsset(payload);
          }
        }}
      />

      <AssetDetailModal
        uid={user?.uid || null}
        asset={inspectingAsset}
        notes={notesApi.notes}
        onOpenNoteInWorkspace={handleOpenNoteInWorkspace}
        onCreateLinkedNote={handleCreateLinkedNote}
        onCreateTodoForAsset={(asset) => {
          setInspectingAssetId(null);
          openLinkedTodoModal(
            {
              type: 'asset',
              targetId: asset.id,
              parentId: '',
              label: asset.name,
            },
            `مراجعة وتجهيز أصل ${asset.name}`
          );
        }}
        onShareAsset={openShareAsset}
        onClose={() => setInspectingAssetId(null)}
        onDownloadBundle={assetLib.downloadAssetBundle}
        onDownloadFile={assetLib.downloadAssetSingleFile}
        onEditAsset={(asset) => {
          setEditingAsset(asset);
          setAssetModalMode('edit');
          setAssetModalOpen(true);
        }}
      />

      {/* Quick Calendar Scheduling Modal (Courses / Boards) */}
      <CalendarEventModal
        open={calendarQuickOpen}
        mode="create"
        initialEvent={calendarQuickPreset}
        paths={paths}
        courses={coursesApi.courses}
        savedJams={jamsApi.savedJams}
        projects={vault.projects}
        todos={todosApi.todos}
        boards={boardApi.boards}
        onClose={() => {
          setCalendarQuickOpen(false);
          setCalendarQuickPreset(null);
        }}
        onSubmit={async (input) => {
          await calendarApi.createEvent(input);
        }}
      />

      {/* Social Sharing Modals */}
      <ShareItemModal
        open={Boolean(shareTarget)}
        target={shareTarget}
        myProfile={sharingApi.myProfile}
        friends={sharingApi.friends}
        existingShares={sharingApi.outgoingShares}
        onClose={() => setShareTarget(null)}
        onClaimUsername={sharingApi.claimUsername}
        onLookupUsername={sharingApi.lookupUserByUsername}
        onAddFriend={sharingApi.addFriend}
        onCreateShare={sharingApi.createShare}
        onUpdateSharePermissions={sharingApi.updateSharePermissions}
      />

      <SharedItemDetailModal
        share={inspectingShare}
        currentUid={user?.uid || null}
        onClose={() => setInspectingShare(null)}
        onSaveCollaborativeUpdate={async (shareId, updatedBundle) => {
          await sharingApi.updateSharedPayload(shareId, updatedBundle);
          setInspectingShare((prev) =>
            prev && prev.id === shareId
              ? {
                  ...prev,
                  itemTitle: updatedBundle.title,
                  itemSummary: updatedBundle.summary,
                  payloadJson: JSON.stringify(updatedBundle),
                }
              : prev
          );
        }}
        onSaveCopyToMyAccount={handleSaveSharedCopy}
      />

      {/* Shared Confirmations */}
      <ConfirmModal
        open={Boolean(confirmDeleteStep)}
        title="حذف الفيديو من المسار"
        message={
          confirmDeleteStep
            ? `هل أنت متأكد من حذف "${confirmDeleteStep.title}" من مسارك؟ سيتم إعادة ترتيب الخطوات المتبقية تلقائياً.`
            : ''
        }
        confirmLabel="نعم، احذف الفيديو"
        onCancel={() => setConfirmDeleteStep(null)}
        onConfirm={() => {
          if (activePath && confirmDeleteStep) {
            void deleteVideoStep(activePath.id, confirmDeleteStep.id);
          }
          setConfirmDeleteStep(null);
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDeletePathTarget)}
        title="حذف المسار التعليمي"
        message={
          confirmDeletePathTarget
            ? `هل أنت متأكد من حذف مسار "${confirmDeletePathTarget.title}" وجميع الفيديوهات المرتبطة به؟`
            : ''
        }
        confirmLabel="نعم، احذف المسار"
        onCancel={() => setConfirmDeletePathTarget(null)}
        onConfirm={() => {
          if (confirmDeletePathTarget) {
            void deletePath(confirmDeletePathTarget.id);
          }
          setConfirmDeletePathTarget(null);
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteVaultProject)}
        title="حذف المشروع من الخزنة"
        message={
          confirmDeleteVaultProject
            ? `هل أنت متأكد من حذف المشروع "${confirmDeleteVaultProject.name}" وجميع نسخه الاحتياطية نهائياً؟`
            : ''
        }
        confirmLabel="نعم، احذف المشروع"
        onCancel={() => setConfirmDeleteVaultProject(null)}
        onConfirm={() => {
          if (confirmDeleteVaultProject) {
            void vault.deleteProject(confirmDeleteVaultProject);
          }
          setConfirmDeleteVaultProject(null);
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteAsset)}
        title="حذف الأصل من المكتبة"
        message={
          confirmDeleteAsset
            ? `هل أنت متأكد من حذف "${confirmDeleteAsset.name}" وجميع ملفاته المرفقة نهائياً؟`
            : ''
        }
        confirmLabel="نعم، احذف الأصل"
        onCancel={() => setConfirmDeleteAsset(null)}
        onConfirm={() => {
          if (confirmDeleteAsset) {
            void assetLib.deleteAsset(confirmDeleteAsset);
          }
          setConfirmDeleteAsset(null);
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteNote)}
        title="حذف الملاحظة"
        message={
          confirmDeleteNote
            ? `هل أنت متأكد من حذف ملاحظة "${confirmDeleteNote.title}" نهائياً؟`
            : ''
        }
        confirmLabel="نعم، احذف الملاحظة"
        onCancel={() => setConfirmDeleteNote(null)}
        onConfirm={() => {
          if (confirmDeleteNote) {
            const targetId = confirmDeleteNote.id;
            void notesApi.deleteNote(targetId);
            if (selectedNoteId === targetId) {
              setSelectedNoteId(null);
            }
          }
          setConfirmDeleteNote(null);
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteTodoTarget)}
        title="حذف المهمة"
        message={
          confirmDeleteTodoTarget
            ? `هل أنت متأكد من حذف مهمة "${confirmDeleteTodoTarget.title}" من قائمة المهام؟`
            : ''
        }
        confirmLabel="نعم، احذف المهمة"
        onCancel={() => setConfirmDeleteTodoTarget(null)}
        onConfirm={() => {
          if (confirmDeleteTodoTarget) {
            void todosApi.deleteTodo(confirmDeleteTodoTarget);
          }
          setConfirmDeleteTodoTarget(null);
        }}
      />

      <ConfirmModal
        open={Boolean(confirmDeleteCourseTarget)}
        title="حذف الكورس"
        message={
          confirmDeleteCourseTarget
            ? `هل أنت متأكد من حذف كورس "${confirmDeleteCourseTarget.title}" من كورساتي؟`
            : ''
        }
        confirmLabel="نعم، احذف الكورس"
        onCancel={() => setConfirmDeleteCourseTarget(null)}
        onConfirm={() => {
          if (confirmDeleteCourseTarget) {
            const target = confirmDeleteCourseTarget;
            void coursesApi.deleteCourse(target);
            if (inspectingCourseId === target.id) {
              setInspectingCourseId(null);
            }
          }
          setConfirmDeleteCourseTarget(null);
        }}
      />

      {/* Platform Learning System Modals */}
      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        notifications={gamification.notifications}
        unreadCount={gamification.unreadNotificationsCount}
        onMarkRead={(id) => void gamification.markNotificationRead(id)}
        onMarkAllRead={() => void gamification.markAllNotificationsRead()}
        onNavigateSection={handleChangeSection}
      />

      <QuizModal
        key={
          quizStep
            ? `${quizStep.id}:${quizzesApi.quizzes.find((q) => q.stepId === quizStep.id)?.id || 'new'}`
            : 'closed-quiz'
        }
        open={Boolean(quizStep)}
        step={quizStep}
        existingQuiz={
          quizStep ? quizzesApi.quizzes.find((q) => q.stepId === quizStep.id) || null : null
        }
        attempts={
          quizStep ? quizzesApi.attempts.filter((a) => a.stepId === quizStep.id) : []
        }
        onClose={() => setQuizStep(null)}
        onSaveQuiz={quizzesApi.saveQuiz}
        onSubmitAttempt={quizzesApi.submitQuizAttempt}
        onQuizAttemptCompleted={async ({ quiz, attempt }) => {
          if (attempt.passed) {
            await gamification.recordQuizPassed(quiz.id, quiz.title, attempt.percentage);
          }
        }}
      />
    </div>
  );
}
