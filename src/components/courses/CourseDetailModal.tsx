import { useEffect, useState } from 'react';
import {
  ArrowUpRight,
  CalendarPlus,
  Check,
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  GraduationCap,
  LayoutDashboard,
  Pencil,
  Plus,
  Route,
  Share2,
  Video,
  X,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import type { LearningPath } from '../../types/learning';
import type {
  CourseItem,
  CourseStatus,
  NoteLinkRef,
  TodoTask,
  WorkspaceNote,
} from '../../types/workspace';
import { normalizeUrl } from '../../utils/pathLogic';
import { COURSE_STATUS_LABELS, formatShortDate } from '../../utils/workspaceLogic';
import { RelatedNotesSection } from '../notes/RelatedNotesSection';

interface CourseDetailModalProps {
  course: CourseItem | null;
  learningPaths: LearningPath[];
  todos: TodoTask[];
  notes: WorkspaceNote[];
  onClose: () => void;
  onEditCourse: (course: CourseItem) => void;
  onUpdateProgress: (
    course: CourseItem,
    progressPercent: number,
    nextStatus?: CourseStatus
  ) => Promise<void>;
  onAddVideosToNewPath: (course: CourseItem) => Promise<string>;
  onAddVideosToExistingPath: (course: CourseItem, pathId: string) => Promise<void>;
  onOpenLearningPath: (pathId: string) => void;
  onSendCourseToBoard?: (course: CourseItem) => Promise<void>;
  onScheduleCourse?: (course: CourseItem) => void;
  onShareCourse?: (course: CourseItem) => void;
  onCreateTodoForCourse: (course: CourseItem) => void;
  onToggleTodoCompleted: (task: TodoTask) => Promise<void>;
  onOpenNoteInWorkspace: (noteId: string) => void;
  onCreateLinkedNote: (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => Promise<WorkspaceNote>;
}

export function CourseDetailModal({
  course,
  learningPaths,
  todos,
  notes,
  onClose,
  onEditCourse,
  onUpdateProgress,
  onAddVideosToNewPath,
  onAddVideosToExistingPath,
  onOpenLearningPath,
  onSendCourseToBoard,
  onScheduleCourse,
  onShareCourse,
  onCreateTodoForCourse,
  onToggleTodoCompleted,
  onOpenNoteInWorkspace,
  onCreateLinkedNote,
}: CourseDetailModalProps) {
  const [selectedPathId, setSelectedPathId] = useState(learningPaths[0]?.id || '');
  const [pathActionBusy, setPathActionBusy] = useState(false);
  const [pathActionFeedback, setPathActionFeedback] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setPathActionFeedback(null);
    setImgFailed(false);
    if (course?.linkedPathId && learningPaths.some((p) => p.id === course.linkedPathId)) {
      setSelectedPathId(course.linkedPathId);
    } else if (learningPaths.length > 0 && !selectedPathId) {
      setSelectedPathId(learningPaths[0].id);
    }
  }, [course?.id, course?.linkedPathId, learningPaths, selectedPathId]);

  if (!course) return null;

  const courseTodos = todos.filter(
    (t) => t.link.type === 'course' && t.link.targetId === course.id
  );
  const linkedPath = course.linkedPathId
    ? learningPaths.find((p) => p.id === course.linkedPathId) || null
    : null;
  const lessonCount = course.videos.length > 0 ? course.videos.length : 1;

  const handleCreateNewPath = async () => {
    setPathActionBusy(true);
    setPathActionFeedback(null);
    try {
      await onAddVideosToNewPath(course);
      setPathActionFeedback(
        `تم إنشاء مسار تعليمي جديد وإضافة ${lessonCount} ${lessonCount === 1 ? 'فيديو' : 'فيديوهات'} بنجاح.`
      );
    } finally {
      setPathActionBusy(false);
    }
  };

  const handleAppendToExistingPath = async () => {
    if (!selectedPathId) return;
    setPathActionBusy(true);
    setPathActionFeedback(null);
    try {
      await onAddVideosToExistingPath(course, selectedPathId);
      const targetName =
        learningPaths.find((p) => p.id === selectedPathId)?.title || 'المسار المحدد';
      setPathActionFeedback(`تمت إضافة دروس الكورس إلى مسار "${targetName}".`);
    } finally {
      setPathActionBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-bold text-amber-300">
              {course.platform} · {course.category} · {COURSE_STATUS_LABELS[course.status]}
            </div>
            <h2 id="course-detail-title" className="text-base sm:text-lg font-extrabold truncate">
              {course.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل الكورس"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
          {/* Top Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-start">
            <div className="sm:col-span-2 rounded-xl border-2 border-[#062D4C] overflow-hidden aspect-video bg-slate-900">
              {!imgFailed && resolveMediaUrl(course.thumbnailUrl) ? (
                <img
                  src={resolveMediaUrl(course.thumbnailUrl)}
                  alt={course.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#062D4C] to-[#0B3D63] flex items-center justify-center">
                  <GraduationCap className="w-10 h-10 text-amber-300/70" aria-hidden="true" />
                </div>
              )}
            </div>

            <div className="sm:col-span-3 space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-200 leading-relaxed">
                {course.description || 'لا يوجد وصف مسجل لهذا الكورس.'}
              </p>

              <div className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                آخر تحديث: {formatShortDate(course.updatedAt)}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={normalizeUrl(course.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>زيارة رابط الكورس</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditCourse(course);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer"
                >
                  <Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>تعديل</span>
                </button>

                {onSendCourseToBoard && (
                  <button
                    type="button"
                    data-testid="course-to-board-btn"
                    onClick={() => {
                      void onSendCourseToBoard(course);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] rounded-xl cursor-pointer"
                  >
                    <LayoutDashboard className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                    <span>إرسال إلى لوحة التعلم</span>
                  </button>
                )}

                {onScheduleCourse && (
                  <button
                    type="button"
                    onClick={() => onScheduleCourse(course)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-sky-300 bg-sky-50 dark:bg-slate-800 hover:bg-sky-100 border-2 border-[#062D4C]/30 rounded-xl cursor-pointer"
                  >
                    <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>جدولة</span>
                  </button>
                )}

                {onShareCourse && (
                  <button
                    type="button"
                    onClick={() => onShareCourse(course)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 border-2 border-[#062D4C] rounded-xl cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>مشاركة</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Progress Tracking */}
          <section className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                تتبع تقدمك في الكورس
              </span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                {course.progressPercent}% مكتمل
              </span>
            </div>

            <div className="h-3 w-full rounded-lg bg-white dark:bg-slate-900 border border-[#062D4C]/30 overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-200"
                style={{ width: `${course.progressPercent}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 25, 50, 75, 100].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => void onUpdateProgress(course, val)}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border cursor-pointer tabular-nums ${
                      course.progressPercent === val
                        ? 'bg-[#062D4C] text-white border-[#062D4C]'
                        : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
                    }`}
                  >
                    {val}%
                  </button>
                ))}
              </div>

              <select
                aria-label="تحديث حالة الكورس"
                value={course.status}
                onChange={(e) =>
                  void onUpdateProgress(
                    course,
                    course.progressPercent,
                    e.target.value as CourseStatus
                  )
                }
                className="px-3 py-1.5 text-xs font-bold text-[#062D4C] dark:text-white bg-white dark:bg-slate-900 border border-[#062D4C]/30 rounded-lg"
              >
                {(['active', 'completed', 'wishlist'] as CourseStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {COURSE_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Add Course Videos to Learning Path */}
          <section className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-extrabold text-[#062D4C] dark:text-white">
                <Route className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                <span>إضافة فيديوهات الكورس إلى مسار التعلم ({lessonCount})</span>
              </div>
              {linkedPath && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenLearningPath(linkedPath.id);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  <span>فتح المسار المرتبط: {linkedPath.title}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {course.videos.length > 0 && (
              <ul className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                {course.videos.map((v, i) => (
                  <li
                    key={v.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-1.5"
                  >
                    <span className="inline-flex items-center gap-1.5 font-bold text-[#062D4C] dark:text-white truncate">
                      <Video className="w-3.5 h-3.5 text-[#B92622] shrink-0" aria-hidden="true" />
                      <span className="truncate">
                        {i + 1}. {v.title}
                      </span>
                    </span>
                    {v.duration && (
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                        {v.duration}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {pathActionFeedback && (
              <div className="rounded-lg border border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{pathActionFeedback}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                data-testid="course-to-new-path-btn"
                disabled={pathActionBusy}
                onClick={() => void handleCreateNewPath()}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] rounded-xl cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>إنشاء مسار تعلم جديد</span>
              </button>

              {learningPaths.length > 0 && (
                <div className="flex flex-1 items-center gap-2">
                  <select
                    aria-label="اختر مسار التعلم للإضافة إليه"
                    value={selectedPathId}
                    onChange={(e) => setSelectedPathId(e.target.value)}
                    className="flex-1 min-w-0 rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-[#062D4C] dark:text-white"
                  >
                    {learningPaths.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    data-testid="course-to-existing-path-btn"
                    disabled={pathActionBusy || !selectedPathId}
                    onClick={() => void handleAppendToExistingPath()}
                    className="px-3.5 py-2 text-xs font-extrabold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer whitespace-nowrap disabled:opacity-50"
                  >
                    إضافة للمسار
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* Linked To-Do Tasks Section */}
          <section className="pt-4 border-t-2 border-[#062D4C]/15 dark:border-slate-700 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[#062D4C] dark:text-white">
                <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                <span>مهام الكورس في قائمة المهام ({courseTodos.length})</span>
              </div>
              <button
                type="button"
                data-testid="course-create-todo-btn"
                onClick={() => onCreateTodoForCourse(course)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 border-2 border-[#062D4C] rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>إنشاء مهمة لهذا الكورس</span>
              </button>
            </div>

            {courseTodos.length === 0 ? (
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                لا توجد مهام مرتبطة بهذا الكورس بعد — أضف مهمة لمتابعة إنجاز دروسه.
              </p>
            ) : (
              <ul className="space-y-2">
                {courseTodos.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => void onToggleTodoCompleted(t)}
                      className="flex items-center gap-2.5 min-w-0 text-right cursor-pointer"
                    >
                      <span
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                          t.completed
                            ? 'bg-emerald-600 border-emerald-700 text-white'
                            : 'bg-white dark:bg-slate-900 border-[#062D4C]'
                        }`}
                      >
                        {t.completed && <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />}
                      </span>
                      <span
                        className={`text-xs sm:text-sm font-bold truncate ${
                          t.completed
                            ? 'line-through text-slate-500'
                            : 'text-[#062D4C] dark:text-white'
                        }`}
                      >
                        {t.title}
                      </span>
                    </button>
                    {t.dueDate && (
                      <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
                        {t.dueDate}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Linked Notes Section */}
          <RelatedNotesSection
            targetType="course"
            targetId={course.id}
            targetLabel={course.title}
            notes={notes}
            onOpenNoteInWorkspace={onOpenNoteInWorkspace}
            onCreateLinkedNote={onCreateLinkedNote}
          />
        </div>
      </div>
    </div>
  );
}
