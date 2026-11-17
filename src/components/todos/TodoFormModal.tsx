import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, CheckSquare, Flag, Link2, Sparkles, X } from 'lucide-react';
import type { SaveTodoPayload } from '../../hooks/useTodos';
import type { LearningPath } from '../../types/learning';
import type {
  CourseItem,
  LearningBoard,
  LibraryAsset,
  SavedGameJam,
  TodoLinkRef,
  TodoLinkType,
  TodoPriority,
  TodoTask,
  VaultProject,
  VideoCollection,
} from '../../types/workspace';
import {
  TODO_LINK_TYPE_LABELS,
  TODO_PRIORITY_LABELS,
  validateTodoInput,
} from '../../utils/workspaceLogic';
import type { LearningStepChoice } from '../notes/NotesView';

interface TodoFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialTask: TodoTask | null;
  initialLink?: TodoLinkRef | null;
  initialTitle?: string;
  learningPaths: LearningPath[];
  learningStepChoices: LearningStepChoice[];
  courses: CourseItem[];
  vaultProjects: VaultProject[];
  libraryAssets: LibraryAsset[];
  learningBoards?: LearningBoard[];
  savedGameJams?: SavedGameJam[];
  videoCollections?: VideoCollection[];
  onClose: () => void;
  onSubmit: (payload: SaveTodoPayload) => Promise<void>;
}

const LINK_TYPE_OPTIONS: TodoLinkType[] = [
  'none',
  'learning_board',
  'game_jam',
  'video_collection',
  'learning_path',
  'learning_step',
  'course',
  'project',
  'asset',
  'creative',
];

export function TodoFormModal({
  open,
  mode,
  initialTask,
  initialLink = null,
  initialTitle = '',
  learningPaths,
  learningStepChoices,
  courses,
  vaultProjects,
  libraryAssets,
  learningBoards = [],
  savedGameJams = [],
  videoCollections = [],
  onClose,
  onSubmit,
}: TodoFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TodoPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [linkType, setLinkType] = useState<TodoLinkType>('none');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [creativeLabel, setCreativeLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setError(null);
      setSubmitting(false);
      if (mode === 'edit' && initialTask) {
        setTitle(initialTask.title);
        setDescription(initialTask.description);
        setPriority(initialTask.priority);
        setDueDate(initialTask.dueDate || '');
        setLinkType(initialTask.link.type || 'none');
        setLinkTargetId(initialTask.link.targetId || '');
        setCreativeLabel(initialTask.link.type === 'creative' ? initialTask.link.label : '');
      } else {
        setTitle(initialTitle || '');
        setDescription('');
        setPriority('medium');
        setDueDate('');
        if (initialLink) {
          setLinkType(initialLink.type);
          setLinkTargetId(initialLink.targetId);
          setCreativeLabel(initialLink.type === 'creative' ? initialLink.label : '');
        } else {
          setLinkType('none');
          setLinkTargetId('');
          setCreativeLabel('');
        }
      }
    }
    wasOpenRef.current = open;
  }, [open, mode, initialTask, initialLink, initialTitle]);

  const targetChoices = useMemo(() => {
    if (linkType === 'project') {
      return vaultProjects.map((p) => ({ id: p.id, parentId: '', label: p.name }));
    }
    if (linkType === 'learning_path') {
      return learningPaths.map((p) => ({ id: p.id, parentId: '', label: p.title }));
    }
    if (linkType === 'learning_step') {
      return learningStepChoices.map((c) => ({
        id: c.step.id,
        parentId: c.step.pathId,
        label: `${c.step.title} (${c.pathTitle})`,
      }));
    }
    if (linkType === 'course') {
      return courses.map((c) => ({ id: c.id, parentId: '', label: c.title }));
    }
    if (linkType === 'asset') {
      return libraryAssets.map((a) => ({ id: a.id, parentId: '', label: a.name }));
    }
    if (linkType === 'learning_board') {
      const items: { id: string; parentId: string; label: string }[] = [];
      for (const b of learningBoards) {
        const widgets = b.cards.filter((c) => c.kind === 'todo_widget' || c.kind === 'video');
        if (widgets.length > 0) {
          for (const card of widgets) {
            items.push({ id: card.id, parentId: b.id, label: `${card.title} (${b.title})` });
          }
        } else {
          items.push({ id: b.id, parentId: b.id, label: b.title });
        }
      }
      return items;
    }
    if (linkType === 'game_jam') {
      return savedGameJams.map((j) => ({ id: j.id, parentId: '', label: j.name }));
    }
    if (linkType === 'video_collection') {
      return videoCollections.map((c) => ({ id: c.id, parentId: '', label: c.title }));
    }
    return [];
  }, [
    linkType,
    vaultProjects,
    learningPaths,
    learningStepChoices,
    courses,
    libraryAssets,
    learningBoards,
    savedGameJams,
    videoCollections,
  ]);

  useEffect(() => {
    if (linkType === 'none' || linkType === 'creative') {
      setLinkTargetId('');
      return;
    }
    if (targetChoices.length > 0 && !targetChoices.some((t) => t.id === linkTargetId)) {
      setLinkTargetId(targetChoices[0].id);
    }
  }, [linkType, targetChoices, linkTargetId]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateTodoInput({ title });
    if (validationErr) {
      setError(validationErr);
      return;
    }

    let resolvedLink: TodoLinkRef = {
      type: linkType,
      targetId: '',
      parentId: '',
      label: '',
    };

    if (linkType === 'creative') {
      resolvedLink = {
        type: 'creative',
        targetId: 'creative_task',
        parentId: '',
        label: creativeLabel.trim() || 'مهمة إبداعية مخصصة',
      };
    } else if (linkType !== 'none') {
      const found = targetChoices.find((t) => t.id === linkTargetId);
      if (found) {
        resolvedLink = {
          type: linkType,
          targetId: found.id,
          parentId: found.parentId,
          label: found.label,
        };
      } else {
        resolvedLink = { type: 'none', targetId: '', parentId: '', label: '' };
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title,
        description,
        priority,
        dueDate,
        link: resolvedLink,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المهمة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="todo-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <h2 id="todo-modal-title" className="text-base sm:text-lg font-extrabold">
              {mode === 'edit' ? 'تعديل المهمة' : 'إنشاء مهمة جديدة'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المهمة"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="rounded-lg border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="todo-title-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              عنوان المهمة *
            </label>
            <input
              id="todo-title-input"
              data-testid="todo-modal-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: إنهاء فيديو البرمجة التالي ومراجعة التطبيق العملي"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="todo-desc-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              تفاصيل المهمة (اختياري)
            </label>
            <textarea
              id="todo-desc-input"
              data-testid="todo-modal-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="خطوات فرعية أو نقاط تركيز لإتمام هذه المهمة..."
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                <Flag className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
                <span>مستوى الأولوية</span>
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['high', 'medium', 'low'] as TodoPriority[]).map((lvl) => {
                  const active = priority === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setPriority(lvl)}
                      className={`py-2 px-2 text-xs font-extrabold rounded-xl border-2 transition-colors cursor-pointer ${
                        active
                          ? lvl === 'high'
                            ? 'bg-[#B92622] text-white border-[#062D4C]'
                            : lvl === 'medium'
                              ? 'bg-[#062D4C] text-white border-[#062D4C]'
                              : 'bg-emerald-600 text-white border-[#062D4C]'
                          : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700'
                      }`}
                    >
                      {lvl === 'high' ? 'عالية' : lvl === 'medium' ? 'متوسطة' : 'عادية'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label
                htmlFor="todo-due-input"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                <Calendar className="w-4 h-4 text-[#062D4C] dark:text-sky-400" aria-hidden="true" />
                <span>تاريخ الاستحقاق (اختياري)</span>
              </label>
              <input
                id="todo-due-input"
                data-testid="todo-modal-due-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
            </div>
          </div>

          {/* Cross-Feature Linking Section */}
          <div className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#062D4C] dark:text-white">
              <Link2 className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
              <span>ربط المهمة بعنصر من مساحة العمل</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="todo-link-type-select" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                  نوع الارتباط
                </label>
                <select
                  id="todo-link-type-select"
                  data-testid="todo-link-type-select"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as TodoLinkType)}
                  className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                >
                  {LINK_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {TODO_LINK_TYPE_LABELS[opt]}
                    </option>
                  ))}
                </select>
              </div>

              {linkType === 'creative' ? (
                <div>
                  <label htmlFor="todo-creative-label" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    تصنيف المهمة الإبداعية
                  </label>
                  <div className="relative">
                    <Sparkles className="w-3.5 h-3.5 text-[#B92622] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                    <input
                      id="todo-creative-label"
                      type="text"
                      value={creativeLabel}
                      onChange={(e) => setCreativeLabel(e.target.value)}
                      placeholder="مثال: تصميم واجهة، نمذجة، رسم"
                      className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 pr-9 pl-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                    />
                  </div>
                </div>
              ) : linkType !== 'none' ? (
                <div>
                  <label htmlFor="todo-link-target-select" className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                    اختر العنصر المرتبط
                  </label>
                  <select
                    id="todo-link-target-select"
                    data-testid="todo-link-target-select"
                    value={linkTargetId}
                    onChange={(e) => setLinkTargetId(e.target.value)}
                    disabled={targetChoices.length === 0}
                    className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none disabled:opacity-50"
                  >
                    {targetChoices.length === 0 ? (
                      <option value="">لا توجد عناصر متاحة</option>
                    ) : (
                      targetChoices.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              ) : (
                <div className="flex items-end pb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {TODO_PRIORITY_LABELS[priority]} · مهمة مستقلة عامة
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              data-testid="todo-modal-submit-btn"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-60 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جاري الحفظ...' : mode === 'edit' ? 'حفظ التعديلات' : 'إضافة المهمة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
