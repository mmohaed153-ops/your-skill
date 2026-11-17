import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ListTodo,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { SectionHeroBanner } from '../SectionHeroBanner';
import type { SaveTodoPayload } from '../../hooks/useTodos';
import type {
  TodoLinkRef,
  TodoLinkType,
  TodoPriority,
  TodoTask,
} from '../../types/workspace';
import {
  calculateTodoStats,
  filterAndSortTodos,
  isTodoOverdue,
  TODO_LINK_TYPE_LABELS,
  TODO_PRIORITY_LABELS,
} from '../../utils/workspaceLogic';

interface TodosViewProps {
  todos: TodoTask[];
  cloudLoading: boolean;
  onQuickCreateTodo: (payload: SaveTodoPayload) => Promise<TodoTask>;
  onOpenCreateModal: () => void;
  onOpenEditModal: (task: TodoTask) => void;
  onToggleCompleted: (task: TodoTask) => Promise<void>;
  onDeleteTodo: (task: TodoTask) => void;
  onNavigateToLink: (link: TodoLinkRef) => void;
}

export function TodosView({
  todos,
  cloudLoading,
  onQuickCreateTodo,
  onOpenCreateModal,
  onOpenEditModal,
  onToggleCompleted,
  onDeleteTodo,
  onNavigateToLink,
}: TodosViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<TodoPriority | 'all'>('all');
  const [linkTypeFilter, setLinkTypeFilter] = useState<TodoLinkType | 'all'>('all');
  const [viewTab, setViewTab] = useState<'split' | 'pending' | 'completed'>('split');

  // Quick Add Inline Bar
  const [quickTitle, setQuickTitle] = useState('');
  const [quickPriority, setQuickPriority] = useState<TodoPriority>('medium');
  const [quickDueDate, setQuickDueDate] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);

  const stats = useMemo(() => calculateTodoStats(todos), [todos]);
  const { pending, completed } = useMemo(
    () =>
      filterAndSortTodos(todos, {
        searchQuery,
        priorityFilter,
        linkTypeFilter,
      }),
    [todos, searchQuery, priorityFilter, linkTypeFilter]
  );

  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;
    setQuickSaving(true);
    try {
      await onQuickCreateTodo({
        title: quickTitle,
        description: '',
        priority: quickPriority,
        dueDate: quickDueDate,
      });
      setQuickTitle('');
      setQuickDueDate('');
    } finally {
      setQuickSaving(false);
    }
  };

  const renderTaskRow = (task: TodoTask) => {
    const overdue = isTodoOverdue(task);
    const priorityColor =
      task.priority === 'high'
        ? 'text-[#B92622] dark:text-rose-400'
        : task.priority === 'medium'
          ? 'text-[#062D4C] dark:text-amber-300'
          : 'text-emerald-700 dark:text-emerald-400';

    return (
      <article
        key={task.id}
        data-testid={`todo-item-${task.id}`}
        className={`rounded-xl border-2 bg-white dark:bg-slate-900 p-4 transition-shadow flex items-start justify-between gap-3 ${
          task.completed
            ? 'border-[#062D4C]/40 dark:border-slate-700 opacity-85 shadow-[3px_4px_0_#059669]'
            : task.priority === 'high'
              ? 'border-[#062D4C] dark:border-rose-400/70 shadow-[4px_5px_0_#B92622]'
              : 'border-[#062D4C] dark:border-slate-600 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155]'
        }`}
      >
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={task.completed}
            data-testid={`todo-checkbox-${task.id}`}
            aria-label={
              task.completed
                ? `إلغاء إتمام مهمة "${task.title}"`
                : `تحديد مهمة "${task.title}" كمكتملة`
            }
            onClick={() => void onToggleCompleted(task)}
            className={`mt-0.5 w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
              task.completed
                ? 'bg-emerald-600 border-emerald-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 border-[#062D4C] dark:border-slate-500 hover:bg-emerald-50'
            }`}
          >
            {task.completed && <Check className="w-4 h-4 stroke-[3]" aria-hidden="true" />}
          </button>

          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Unboxed Clean Metadata Line */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
              <span className={priorityColor}>{TODO_PRIORITY_LABELS[task.priority]}</span>
              {task.dueDate && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 tabular-nums ${
                      overdue
                        ? 'text-[#B92622] dark:text-rose-400 font-extrabold'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {overdue ? (
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{overdue ? `متأخرة (${task.dueDate})` : task.dueDate}</span>
                  </span>
                </>
              )}
              {task.link.type !== 'none' && (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {TODO_LINK_TYPE_LABELS[task.link.type]}
                  </span>
                </>
              )}
            </div>

            <h3
              className={`text-base font-extrabold leading-snug ${
                task.completed
                  ? 'line-through text-slate-500 dark:text-slate-400'
                  : 'text-[#062D4C] dark:text-white'
              }`}
            >
              {task.title}
            </h3>

            {task.description && (
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                {task.description}
              </p>
            )}

            {task.link.type !== 'none' && task.link.label && (
              <div className="pt-0.5">
                {task.link.type === 'creative' ? (
                  <span className="text-xs font-bold text-[#062D4C] dark:text-amber-300">
                    التصنيف: {task.link.label}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onNavigateToLink(task.link)}
                    className="inline-flex items-center gap-1 text-xs font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline cursor-pointer"
                  >
                    <span>الانتقال إلى: {task.link.label}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onOpenEditModal(task)}
            aria-label={`تعديل مهمة "${task.title}"`}
            className="p-2 text-slate-500 dark:text-slate-300 hover:text-[#062D4C] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <Pencil className="w-4 h-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDeleteTodo(task)}
            aria-label={`حذف مهمة "${task.title}"`}
            className="p-2 text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner with Real Progress Indicator */}
      <SectionHeroBanner
        testId="todos-hero-banner"
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
              <ListTodo className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>التنظيم اليومي والمتابعة</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span data-testid="todos-stats-summary" className="tabular-nums text-[#062D4C] dark:text-slate-200">
              {stats.completedCount} من {stats.total} مكتملة ({stats.completionPercent}%)
            </span>
            {stats.highPriorityPendingCount > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                  ·
                </span>
                <span className="tabular-nums text-[#B92622] dark:text-rose-300">
                  {stats.highPriorityPendingCount} أولوية عالية قيد التنفيذ
                </span>
              </>
            )}
          </>
        }
        title="قائمة المهام (To-Do List)"
        description="نظّم مهامك اليومية، حدد الأولويات ومواعيد التسليم، واربط كل مهمة بمسارك التعليمي أو كورساتك أو مشاريعك وأصولك الإبداعية."
        progress={{
          label: 'مؤشر الإنجاز العام',
          percentage: stats.completionPercent,
          ariaLabel: 'مؤشر الإنجاز العام للمهام',
        }}
        actions={[
          {
            id: 'new-connected-todo',
            label: 'إضافة مهمة متصلة',
            icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: onOpenCreateModal,
            testId: 'todos-new-modal-btn',
            tone: 'crimson',
          },
        ]}
      />

      {/* Quick Inline Task Creation */}
      <form
        onSubmit={handleQuickAdd}
        aria-label="إضافة مهمة سريعة"
        className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] flex flex-col md:flex-row items-stretch md:items-center gap-3"
      >
        <input
          type="text"
          data-testid="todo-quick-title-input"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="أضف مهمة سريعة (مثال: إنهاء فيديو البرمجة التالي)..."
          aria-label="عنوان المهمة السريعة"
          className="flex-1 rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            aria-label="أولوية المهمة السريعة"
            value={quickPriority}
            onChange={(e) => setQuickPriority(e.target.value as TodoPriority)}
            className="rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
          >
            <option value="high">أولوية عالية</option>
            <option value="medium">أولوية متوسطة</option>
            <option value="low">أولوية عادية</option>
          </select>

          <input
            type="date"
            aria-label="تاريخ الاستحقاق للمهمة السريعة"
            value={quickDueDate}
            onChange={(e) => setQuickDueDate(e.target.value)}
            className="rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white"
          />

          <button
            type="submit"
            data-testid="todo-quick-add-btn"
            disabled={quickSaving || !quickTitle.trim()}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] disabled:opacity-50 border-2 border-[#062D4C] rounded-xl cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>إضافة</span>
          </button>
        </div>
      </form>

      {/* Filter & View Switcher Bar */}
      <section
        aria-label="تصفية المهام"
        className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في المهام أو المشاريع والكورسات المرتبطة..."
              aria-label="البحث في المهام"
              className="w-full rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="تصفية حسب الأولوية"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TodoPriority | 'all')}
              className="px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-700 rounded-lg"
            >
              <option value="all">كل الأولويات</option>
              <option value="high">أولوية عالية</option>
              <option value="medium">أولوية متوسطة</option>
              <option value="low">أولوية عادية</option>
            </select>

            <select
              aria-label="تصفية حسب الارتباط"
              value={linkTypeFilter}
              onChange={(e) => setLinkTypeFilter(e.target.value as TodoLinkType | 'all')}
              className="px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-700 rounded-lg"
            >
              <option value="all">كل الارتباطات</option>
              <option value="learning_board">لوحة التعلم</option>
              <option value="game_jam">مسابقات الألعاب</option>
              <option value="video_collection">مجموعات الفيديو</option>
              <option value="learning_path">مسارات التعلم</option>
              <option value="learning_step">دروس الفيديو</option>
              <option value="course">كورساتي</option>
              <option value="project">خزنة المشاريع</option>
              <option value="asset">مكتبة الأصول</option>
              <option value="creative">مهام إبداعية</option>
              <option value="none">مهام عامة</option>
            </select>
          </div>
        </div>

        {/* Separate Pending / Completed View Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#062D4C]/10 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setViewTab('split')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border-2 cursor-pointer transition-colors ${
                viewTab === 'split'
                  ? 'bg-[#062D4C] text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
              }`}
            >
              عرض منفصل (قيد التنفيذ والمكتملة)
            </button>
            <button
              type="button"
              onClick={() => setViewTab('pending')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border-2 cursor-pointer transition-colors tabular-nums ${
                viewTab === 'pending'
                  ? 'bg-[#B92622] text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
              }`}
            >
              قيد التنفيذ فقط ({pending.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab('completed')}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-lg border-2 cursor-pointer transition-colors tabular-nums ${
                viewTab === 'completed'
                  ? 'bg-emerald-600 text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
              }`}
            >
              المكتملة فقط ({completed.length})
            </button>
          </div>
        </div>
      </section>

      {cloudLoading && todos.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل قائمة المهام...
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Tasks Section */}
          {(viewTab === 'split' || viewTab === 'pending') && (
            <section data-testid="todos-pending-section" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-black text-[#062D4C] dark:text-white flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                  <span>المهام قيد التنفيذ</span>
                  <span className="text-sm font-bold text-slate-600 dark:text-slate-400 tabular-nums">
                    ({pending.length})
                  </span>
                </h2>
              </div>

              {pending.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/90 dark:bg-slate-900 p-8 text-center space-y-2">
                  <p className="text-sm font-bold text-[#062D4C] dark:text-white">
                    {todos.length === 0
                      ? 'لا توجد مهام في قائمتك بعد — أضف أول مهمة الآن!'
                      : 'لا توجد مهام معلقة مطابقة للتصفية الحالية.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">{pending.map(renderTaskRow)}</div>
              )}
            </section>
          )}

          {/* Completed Tasks Section */}
          {(viewTab === 'split' || viewTab === 'completed') && (
            <section data-testid="todos-completed-section" className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg sm:text-xl font-black text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden="true" />
                  <span>المهام المكتملة</span>
                  <span className="text-sm font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    ({completed.length})
                  </span>
                </h2>
              </div>

              {completed.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/25 dark:border-slate-700 bg-white/75 dark:bg-slate-900/70 p-6 text-center text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                  عند إتمام أي مهمة بالضغط على مربع الاختيار، ستنتقل تلقائياً إلى هذا القسم.
                </div>
              ) : (
                <div className="space-y-3">{completed.map(renderTaskRow)}</div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
