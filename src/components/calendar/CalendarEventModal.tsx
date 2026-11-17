import { useEffect, useState } from 'react';
import { CalendarPlus, X } from 'lucide-react';
import type { SaveCalendarEventInput } from '../../hooks/useCalendarEvents';
import type { LearningPath } from '../../types/learning';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarLinkTargetType,
  CourseItem,
  LearningBoard,
  SavedGameJam,
  TodoTask,
  VaultProject,
} from '../../types/workspace';
import {
  CALENDAR_CATEGORY_META,
  CALENDAR_COLOR_CHOICES,
  toDateIso,
  validateCalendarEventInput,
} from '../../utils/calendarLogic';

interface CalendarEventModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialEvent: CalendarEvent | null;
  defaultDate?: string;
  paths: LearningPath[];
  courses: CourseItem[];
  savedJams: SavedGameJam[];
  projects: VaultProject[];
  todos: TodoTask[];
  boards: LearningBoard[];
  onClose: () => void;
  onSubmit: (input: SaveCalendarEventInput) => Promise<void>;
}

export function CalendarEventModal({
  open,
  mode,
  initialEvent,
  defaultDate,
  paths,
  courses,
  savedJams,
  projects,
  todos,
  boards,
  onClose,
  onSubmit,
}: CalendarEventModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(toDateIso(new Date()));
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [category, setCategory] = useState<CalendarEventCategory>('study');
  const [colorHex, setColorHex] = useState(CALENDAR_CATEGORY_META.study.colorHex);
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [linkedType, setLinkedType] = useState<CalendarLinkTargetType>('none');
  const [linkedId, setLinkedId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    if (initialEvent) {
      setTitle(initialEvent.title);
      setDescription(initialEvent.description);
      setDate(initialEvent.date || defaultDate || toDateIso(new Date()));
      setStartTime(initialEvent.startTime || '18:00');
      setEndTime(initialEvent.endTime || '19:00');
      setCategory(initialEvent.category);
      setColorHex(initialEvent.colorHex || CALENDAR_CATEGORY_META[initialEvent.category].colorHex);
      setReminderMinutes(initialEvent.reminderEnabled ? initialEvent.reminderMinutes : -1);
      setLinkedType(initialEvent.linkedType);
      setLinkedId(initialEvent.linkedId);
    } else {
      setTitle('');
      setDescription('');
      setDate(defaultDate || toDateIso(new Date()));
      setStartTime('18:00');
      setEndTime('19:00');
      setCategory('study');
      setColorHex(CALENDAR_CATEGORY_META.study.colorHex);
      setReminderMinutes(30);
      setLinkedType('none');
      setLinkedId('');
    }
  }, [open, mode, initialEvent, defaultDate]);

  if (!open) return null;

  const linkChoices = (): Array<{ id: string; label: string }> => {
    switch (linkedType) {
      case 'learning_path':
        return paths.map((p) => ({ id: p.id, label: p.title }));
      case 'course':
        return courses.map((c) => ({ id: c.id, label: c.title }));
      case 'game_jam':
        return savedJams.map((j) => ({ id: j.id, label: j.name }));
      case 'project':
        return projects.map((p) => ({ id: p.id, label: p.name }));
      case 'todo':
        return todos.map((t) => ({ id: t.id, label: t.title }));
      case 'learning_board':
        return boards.map((b) => ({ id: b.id, label: b.title }));
      default:
        return [];
    }
  };

  const options = linkChoices();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateCalendarEventInput({ title, date, startTime, endTime });
    if (validationErr) {
      setError(validationErr);
      return;
    }

    const matchedLabel = options.find((o) => o.id === linkedId)?.label || '';
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title,
        description,
        date,
        startTime,
        endTime,
        category,
        colorHex,
        reminderMinutes,
        reminderEnabled: reminderMinutes >= 0,
        linkedType,
        linkedId: linkedType === 'none' ? '' : linkedId,
        linkedParentId: '',
        linkedLabel: linkedType === 'none' ? '' : matchedLabel,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الحدث في التقويم.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 border-b-2 border-[#062D4C]/15 dark:border-slate-700 flex items-center justify-between gap-4">
          <h2 id="calendar-event-modal-title" className="text-lg font-extrabold text-[#062D4C] dark:text-white">
            {mode === 'edit' ? 'تعديل أو نقل الحدث في التقويم' : 'إضافة حدث أو جلسة تعلم للتقويم'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الحدث"
            className="p-2 text-slate-500 hover:text-[#062D4C] dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div role="alert" className="rounded-xl border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-[#B92622] dark:text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="cal-ev-title" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              عنوان الحدث أو الجلسة *
            </label>
            <input
              id="cal-ev-title"
              data-testid="cal-event-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: جلسة تطبيق Shader أو موعد تسليم Game Jam"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="cal-ev-date" className="block text-xs font-bold text-[#062D4C] dark:text-slate-200 mb-1">
                التاريخ *
              </label>
              <input
                id="cal-ev-date"
                data-testid="cal-event-date-input"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="cal-ev-start" className="block text-xs font-bold text-[#062D4C] dark:text-slate-200 mb-1">
                وقت البدء
              </label>
              <input
                id="cal-ev-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="cal-ev-end" className="block text-xs font-bold text-[#062D4C] dark:text-slate-200 mb-1">
                وقت النهاية
              </label>
              <input
                id="cal-ev-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cal-ev-cat" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                الفئة
              </label>
              <select
                id="cal-ev-cat"
                value={category}
                onChange={(e) => {
                  const nextCat = e.target.value as CalendarEventCategory;
                  setCategory(nextCat);
                  setColorHex(CALENDAR_CATEGORY_META[nextCat].colorHex);
                }}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white"
              >
                {Object.values(CALENDAR_CATEGORY_META).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="cal-ev-rem" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                التنبيه والتذكير
              </label>
              <select
                id="cal-ev-rem"
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white"
              >
                <option value={-1}>بدون تذكير</option>
                <option value={0}>في وقت الحدث تماماً</option>
                <option value={15}>قبل الموعد بـ 15 دقيقة</option>
                <option value={30}>قبل الموعد بـ 30 دقيقة</option>
                <option value={60}>قبل الموعد بساعة</option>
                <option value={1440}>قبل الموعد بيوم كامل</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-[#062D4C] dark:text-slate-200">
              لون التمييز في التقويم
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {CALENDAR_COLOR_CHOICES.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => setColorHex(c.hex)}
                  aria-label={c.label}
                  className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform ${
                    colorHex === c.hex ? 'border-[#062D4C] dark:border-white scale-110 ring-2 ring-amber-400' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>

          {/* Link to platform feature */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cal-ev-link-type" className="block text-xs font-bold text-[#062D4C] dark:text-slate-200 mb-1">
                ربط بميزة في المنصة (اختياري)
              </label>
              <select
                id="cal-ev-link-type"
                value={linkedType}
                onChange={(e) => {
                  setLinkedType(e.target.value as CalendarLinkTargetType);
                  setLinkedId('');
                }}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white"
              >
                <option value="none">حدث مستقل</option>
                <option value="learning_path">مسار التعلم</option>
                <option value="course">كورساتي</option>
                <option value="game_jam">مسابقة Game Jam</option>
                <option value="project">مشروع في الخزنة</option>
                <option value="todo">مهمة في قائمة المهام</option>
                <option value="learning_board">لوحة التعلم</option>
              </select>
            </div>

            {linkedType !== 'none' && (
              <div>
                <label htmlFor="cal-ev-link-id" className="block text-xs font-bold text-[#062D4C] dark:text-slate-200 mb-1">
                  اختر العنصر المرتبط
                </label>
                <select
                  id="cal-ev-link-id"
                  value={linkedId}
                  onChange={(e) => setLinkedId(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white"
                >
                  <option value="">اختر عنصراً...</option>
                  {options.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="cal-ev-desc" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              تفاصيل وملاحظات
            </label>
            <textarea
              id="cal-ev-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مهام فرعية، رابط الجلسة، أو ملاحظات سريعة..."
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-medium text-[#062D4C] dark:text-white resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="cal-event-submit-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer disabled:opacity-60"
            >
              <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جاري الحفظ...' : mode === 'edit' ? 'حفظ التعديلات' : 'إضافة للتقويم'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
