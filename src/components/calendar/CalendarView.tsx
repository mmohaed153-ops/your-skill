import { useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  CalendarPlus,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  MoveRight,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { SectionHeroBanner } from '../SectionHeroBanner';
import type { SaveCalendarEventInput } from '../../hooks/useCalendarEvents';
import type { LearningPath, VideoStep } from '../../types/learning';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CalendarLinkTargetType,
  CalendarViewMode,
  CourseItem,
  LearningBoard,
  SavedGameJam,
  TodoTask,
  VaultProject,
} from '../../types/workspace';
import {
  addDaysIso,
  ARABIC_WEEKDAYS_SAT_START,
  buildMonthGrid,
  buildWeekDays,
  CALENDAR_CATEGORY_META,
  collectUnifiedCalendarItems,
  formatDayHeaderArabic,
  formatMonthTitleArabic,
  getItemsForDate,
  getUpcomingReminders,
  parseDateIso,
  toDateIso,
  type UnifiedCalendarItem,
} from '../../utils/calendarLogic';
import { CalendarEventModal } from './CalendarEventModal';

interface CalendarViewProps {
  events: CalendarEvent[];
  todos: TodoTask[];
  paths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  courses: CourseItem[];
  savedJams: SavedGameJam[];
  projects: VaultProject[];
  boards: LearningBoard[];
  cloudLoading: boolean;
  onCreateEvent: (input: SaveCalendarEventInput) => Promise<CalendarEvent>;
  onUpdateEvent: (
    eventId: string,
    input: Partial<SaveCalendarEventInput> & { completed?: boolean }
  ) => Promise<void>;
  onMoveEventDate: (event: CalendarEvent, nextDateIso: string) => Promise<void>;
  onToggleEventCompleted: (event: CalendarEvent) => Promise<void>;
  onDeleteEvent: (event: CalendarEvent) => Promise<void>;
  onToggleTodo?: (todo: TodoTask) => void;
  onCreateTodoFromCalendarItem?: (item: UnifiedCalendarItem) => void;
  onNavigateToLinkedItem?: (
    linkedType: CalendarLinkTargetType,
    linkedId: string,
    linkedParentId: string
  ) => void;
}

export function CalendarView({
  events,
  todos,
  paths,
  stepsByPath,
  courses,
  savedJams,
  projects,
  boards,
  cloudLoading,
  onCreateEvent,
  onUpdateEvent,
  onMoveEventDate,
  onToggleEventCompleted,
  onDeleteEvent,
  onToggleTodo,
  onCreateTodoFromCalendarItem,
  onNavigateToLinkedItem,
}: CalendarViewProps) {
  const todayIso = useMemo(() => toDateIso(new Date()), []);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedDateIso, setSelectedDateIso] = useState<string>(todayIso);
  const [categoryFilter, setCategoryFilter] = useState<CalendarEventCategory | 'all'>('all');
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    target: CalendarEvent | null;
    defaultDate: string;
  }>({ open: false, mode: 'create', target: null, defaultDate: todayIso });
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [moveNextDate, setMoveNextDate] = useState<string>(todayIso);

  const pathTitleById = useMemo(
    () => Object.fromEntries(paths.map((p) => [p.id, p.title])),
    [paths]
  );

  const allUnifiedItems = useMemo(
    () =>
      collectUnifiedCalendarItems({
        events,
        todos,
        stepsByPath,
        pathTitleById,
        savedJams,
      }),
    [events, todos, stepsByPath, pathTitleById, savedJams]
  );

  const filteredItems = useMemo(
    () =>
      categoryFilter === 'all'
        ? allUnifiedItems
        : allUnifiedItems.filter((item) => item.category === categoryFilter),
    [allUnifiedItems, categoryFilter]
  );

  const upcomingReminders = useMemo(
    () => getUpcomingReminders(allUnifiedItems, todayIso, 3),
    [allUnifiedItems, todayIso]
  );

  const anchorDate = useMemo(() => parseDateIso(selectedDateIso), [selectedDateIso]);
  const monthGrid = useMemo(
    () => buildMonthGrid(anchorDate.getFullYear(), anchorDate.getMonth()),
    [anchorDate]
  );
  const weekDays = useMemo(() => buildWeekDays(selectedDateIso), [selectedDateIso]);
  const selectedDayItems = useMemo(
    () => getItemsForDate(filteredItems, selectedDateIso),
    [filteredItems, selectedDateIso]
  );

  const stepPeriod = (dir: -1 | 1) => {
    if (viewMode === 'day') {
      setSelectedDateIso((prev) => addDaysIso(prev, dir));
    } else if (viewMode === 'week') {
      setSelectedDateIso((prev) => addDaysIso(prev, dir * 7));
    } else {
      const dt = parseDateIso(selectedDateIso);
      dt.setMonth(dt.getMonth() + dir);
      setSelectedDateIso(toDateIso(dt));
    }
  };

  const handleToggleItem = (item: UnifiedCalendarItem) => {
    if (item.source === 'event' && item.rawEvent) {
      void onToggleEventCompleted(item.rawEvent);
    } else if (item.source === 'todo' && onToggleTodo) {
      const matched = todos.find((t) => t.id === item.linkedId);
      if (matched) onToggleTodo(matched);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <SectionHeroBanner
        testId="calendar-hero-banner"
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
              <CalendarIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>جدولة موحدة للتعلم والمشاريع والمسابقات</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-200">
              {allUnifiedItems.length} عنصر مجدول · {upcomingReminders.length} تذكير قريب
            </span>
          </>
        }
        title="التقويم (Calendar)"
        description="نظم جلسات الدراسة والكورسات ومواعيد Game Jams ومهام المشاريع في عروض شهرية وأسبوعية ويومية مع مزامنة تلقائية من كافة أقسام حسابك وتنبيهات ذكية."
        actions={[
          {
            id: 'add-calendar-event',
            label: 'إضافة حدث جديد',
            icon: <CalendarPlus className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () =>
              setModalState({
                open: true,
                mode: 'create',
                target: null,
                defaultDate: selectedDateIso,
              }),
            testId: 'calendar-add-event-btn',
            tone: 'crimson',
          },
        ]}
      />

      {/* Upcoming Reminders Strip */}
      {upcomingReminders.length > 0 && (
        <section
          aria-label="التذكيرات والمواعيد القادمة"
          className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-slate-50 dark:bg-slate-900 p-4 shadow-[0_3px_0_#D97706] space-y-2.5"
        >
          <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#B92622] dark:text-amber-300">
            <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>تنبيهات ومواعيد قادمة خلال 3 أيام ({upcomingReminders.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {upcomingReminders.slice(0, 6).map((rem) => (
              <button
                key={rem.id}
                type="button"
                onClick={() => setSelectedDateIso(rem.date)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#062D4C]/25 bg-white dark:bg-slate-800 text-xs font-bold text-[#062D4C] dark:text-white hover:border-[#B92622] cursor-pointer text-right"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: rem.colorHex }}
                />
                <span>{rem.title}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap shrink-0">
                  ({rem.date === todayIso ? 'اليوم' : rem.date})
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* View Switcher & Date Navigation + Category Color Legend */}
      <section className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stepPeriod(-1)}
              aria-label="الفترة السابقة"
              className="p-2 rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#062D4C] dark:text-white cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setSelectedDateIso(todayIso)}
              className="px-3 py-1.5 rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 text-xs font-extrabold text-[#062D4C] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => stepPeriod(1)}
              aria-label="الفترة التالية"
              className="p-2 rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-[#062D4C] dark:text-white cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            <h2 className="text-base sm:text-lg font-extrabold text-[#062D4C] dark:text-white mr-2">
              {viewMode === 'day'
                ? formatDayHeaderArabic(selectedDateIso)
                : formatMonthTitleArabic(anchorDate.getFullYear(), anchorDate.getMonth())}
            </h2>
          </div>

          {/* Monthly / Weekly / Daily Switcher */}
          <div className="inline-flex rounded-xl border-2 border-[#062D4C] dark:border-slate-600 overflow-hidden bg-slate-100 dark:bg-slate-800">
            {(
              [
                { id: 'month', label: 'شهري' },
                { id: 'week', label: 'أسبوعي' },
                { id: 'day', label: 'يومي' },
              ] as { id: CalendarViewMode; label: string }[]
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                data-testid={`calendar-view-${mode.id}`}
                onClick={() => setViewMode(mode.id)}
                className={`px-3.5 py-1.5 text-xs sm:text-sm font-extrabold cursor-pointer transition-colors ${
                  viewMode === mode.id
                    ? 'bg-[#B92622] text-white'
                    : 'text-[#062D4C] dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#062D4C]/10 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1 text-xs font-bold rounded-lg border-2 cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
            }`}
          >
            جميع الفئات ({allUnifiedItems.length})
          </button>
          {Object.values(CALENDAR_CATEGORY_META).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryFilter(cat.id)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-bold rounded-lg border-2 cursor-pointer ${
                categoryFilter === cat.id
                  ? 'bg-[#062D4C] text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.colorHex }} />
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </section>

      {cloudLoading && events.length === 0 ? (
        <div className="py-12 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل التقويم...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Calendar Main View */}
          <div className="lg:col-span-8">
            {viewMode === 'month' && (
              <div
                data-testid="calendar-month-grid"
                className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[5px_6px_0_#062D4C] overflow-hidden"
              >
                <div className="grid grid-cols-7 bg-[#062D4C] text-white text-center text-xs font-extrabold py-2.5">
                  {ARABIC_WEEKDAYS_SAT_START.map((day) => (
                    <div key={day} className="truncate px-1">{day}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 divide-x divide-x-reverse divide-y divide-[#062D4C]/15 dark:divide-slate-800">
                  {monthGrid.map((cell) => {
                    const dayItems = getItemsForDate(filteredItems, cell.dateIso);
                    const isSelected = cell.dateIso === selectedDateIso;
                    const isToday = cell.dateIso === todayIso;
                    return (
                      <div
                        key={cell.dateIso}
                        onClick={() => setSelectedDateIso(cell.dateIso)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedDateIso(cell.dateIso);
                          }
                        }}
                        className={`min-h-[88px] sm:min-h-[104px] p-1.5 text-right cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-sky-100/80 dark:bg-sky-950/50 ring-2 ring-inset ring-[#B92622]'
                            : cell.inCurrentMonth
                              ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              : 'bg-slate-50/80 dark:bg-slate-950/60 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 text-xs font-extrabold rounded-full tabular-nums ${
                              isToday
                                ? 'bg-[#B92622] text-white'
                                : 'text-[#062D4C] dark:text-slate-200'
                            }`}
                          >
                            {cell.dayNumber}
                          </span>
                          {dayItems.length > 0 && (
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                              {dayItems.length}
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          {dayItems.slice(0, 2).map((item) => (
                            <div
                              key={item.id}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded truncate text-white ${
                                item.completed ? 'opacity-55 line-through' : ''
                              }`}
                              style={{ backgroundColor: item.colorHex }}
                            >
                              {item.title}
                            </div>
                          ))}
                          {dayItems.length > 2 && (
                            <div className="text-[10px] font-extrabold text-[#B92622] dark:text-amber-300">
                              +{dayItems.length - 2} أخرى
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'week' && (
              <div data-testid="calendar-week-grid" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-7 gap-3">
                {weekDays.map((cell, idx) => {
                  const dayItems = getItemsForDate(filteredItems, cell.dateIso);
                  const isSelected = cell.dateIso === selectedDateIso;
                  return (
                    <div
                      key={cell.dateIso}
                      onClick={() => setSelectedDateIso(cell.dateIso)}
                      className={`rounded-xl border-2 p-3 space-y-2 cursor-pointer ${
                        isSelected
                          ? 'border-[#B92622] bg-slate-50 dark:bg-slate-800 shadow-[0_3px_0_#B92622]'
                          : 'border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="border-b border-[#062D4C]/15 pb-1.5">
                        <div className="text-xs font-extrabold text-[#B92622] dark:text-amber-300">
                          {ARABIC_WEEKDAYS_SAT_START[idx]}
                        </div>
                        <div className="text-sm font-black text-[#062D4C] dark:text-white tabular-nums">
                          {cell.dateIso}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        {dayItems.length === 0 ? (
                          <p className="text-[11px] text-slate-400">لا توجد أحداث</p>
                        ) : (
                          dayItems.map((item) => (
                            <div
                              key={item.id}
                              className={`p-1.5 rounded-lg text-[11px] font-bold text-white ${
                                item.completed ? 'opacity-55 line-through' : ''
                              }`}
                              style={{ backgroundColor: item.colorHex }}
                            >
                              {item.startTime && <span className="block text-[10px] opacity-90 tabular-nums">{item.startTime}</span>}
                              <span className="line-clamp-2">{item.title}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {viewMode === 'day' && (
              <div
                data-testid="calendar-day-view"
                className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#062D4C]/15 pb-3">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#062D4C] dark:text-white">
                    جدول يوم {formatDayHeaderArabic(selectedDateIso)}
                  </h3>
                  <button
                    type="button"
                    onClick={() =>
                      setModalState({
                        open: true,
                        mode: 'create',
                        target: null,
                        defaultDate: selectedDateIso,
                      })
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-[#B92622] rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إضافة في هذا اليوم</span>
                  </button>
                </div>

                {selectedDayItems.length === 0 ? (
                  <p className="py-8 text-center text-sm font-bold text-slate-600 dark:text-slate-300">
                    يوم هادئ — لا توجد أحداث أو مهام مجدولة لهذا اليوم.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {selectedDayItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className="w-3 h-3 rounded-full mt-1.5 shrink-0"
                            style={{ backgroundColor: item.colorHex }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                              {item.title}
                            </div>
                            {item.startTime && (
                              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                                <Clock className="w-3 h-3 inline ml-1" aria-hidden="true" />
                                {item.startTime}{item.endTime ? ` - ${item.endTime}` : ''}
                              </div>
                            )}
                            {item.description && (
                              <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {item.linkedType !== 'none' && onNavigateToLinkedItem && (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToLinkedItem(item.linkedType, item.linkedId, item.linkedParentId)
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#062D4C] dark:text-sky-300 bg-white dark:bg-slate-900 border border-[#062D4C]/30 rounded-lg cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>فتح المصدر</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Selected Day Agenda Inspector & Actions */}
          <aside className="lg:col-span-4 rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-[0_4px_0_#062D4C] space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#062D4C]/15 pb-3">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white">
                  أحداث {formatDayHeaderArabic(selectedDateIso)}
                </h2>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                  {selectedDayItems.length} عناصر مجدولة
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setModalState({
                    open: true,
                    mode: 'create',
                    target: null,
                    defaultDate: selectedDateIso,
                  })
                }
                aria-label="إضافة حدث في هذا اليوم"
                className="p-2 rounded-lg bg-[#B92622] text-white cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="py-6 text-center space-y-2.5">
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  لا توجد أحداث مسجلة في {selectedDateIso}.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setModalState({
                      open: true,
                      mode: 'create',
                      target: null,
                      defaultDate: selectedDateIso,
                    })
                  }
                  className="px-3.5 py-2 text-xs font-extrabold text-white bg-[#062D4C] rounded-lg cursor-pointer"
                >
                  جدولة حدث الآن
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full mt-1 shrink-0"
                          style={{ backgroundColor: item.colorHex }}
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-[#B92622] dark:text-amber-300">
                            {CALENDAR_CATEGORY_META[item.category].label}
                            {item.source !== 'event' && ' · مزامنة تلقائية'}
                          </div>
                          <h3
                            className={`text-sm font-extrabold text-[#062D4C] dark:text-white ${
                              item.completed ? 'line-through opacity-60' : ''
                            }`}
                          >
                            {item.title}
                          </h3>
                        </div>
                      </div>

                      {(item.source === 'event' || item.source === 'todo') && (
                        <button
                          type="button"
                          onClick={() => handleToggleItem(item)}
                          aria-label={item.completed ? 'إلغاء الإكمال' : 'تحديد كمكتمل'}
                          className={`p-1 rounded-lg cursor-pointer ${
                            item.completed ? 'text-emerald-600' : 'text-slate-400 hover:text-[#062D4C]'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>

                    {item.startTime && (
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        {item.startTime}{item.endTime ? ` — ${item.endTime}` : ''}
                      </div>
                    )}

                    {item.description && (
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {item.description}
                      </p>
                    )}

                    {/* Quick move date inline UI for native events */}
                    {item.source === 'event' && item.rawEvent && moveTargetId === item.id && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="date"
                          value={moveNextDate}
                          onChange={(e) => setMoveNextDate(e.target.value)}
                          className="flex-1 rounded-lg border border-[#062D4C]/30 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-bold"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            await onMoveEventDate(item.rawEvent!, moveNextDate);
                            setMoveTargetId(null);
                            setSelectedDateIso(moveNextDate);
                          }}
                          className="px-2.5 py-1 text-xs font-extrabold text-white bg-emerald-600 rounded-lg cursor-pointer"
                        >
                          نقل
                        </button>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-xs">
                      <div className="flex flex-wrap items-center gap-1">
                        {item.linkedType !== 'none' && onNavigateToLinkedItem && (
                          <button
                            type="button"
                            onClick={() =>
                              onNavigateToLinkedItem(item.linkedType, item.linkedId, item.linkedParentId)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#062D4C] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <ExternalLink className="w-3 h-3" aria-hidden="true" />
                            <span>انتقال</span>
                          </button>
                        )}
                        {onCreateTodoFromCalendarItem && item.source !== 'todo' && (
                          <button
                            type="button"
                            onClick={() => onCreateTodoFromCalendarItem(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <CheckSquare className="w-3 h-3" aria-hidden="true" />
                            <span>كمهمة</span>
                          </button>
                        )}
                      </div>

                      {item.source === 'event' && item.rawEvent && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setMoveTargetId((prev) => (prev === item.id ? null : item.id));
                              setMoveNextDate(item.date);
                            }}
                            aria-label="نقل التاريخ"
                            title="نقل الحدث إلى يوم آخر"
                            className="p-1.5 text-[#062D4C] dark:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <MoveRight className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setModalState({
                                open: true,
                                mode: 'edit',
                                target: item.rawEvent!,
                                defaultDate: item.date,
                              })
                            }
                            aria-label="تعديل الحدث"
                            className="p-1.5 text-[#062D4C] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteEvent(item.rawEvent!)}
                            aria-label="حذف الحدث"
                            className="p-1.5 text-[#B92622] hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </aside>
        </div>
      )}

      <CalendarEventModal
        open={modalState.open}
        mode={modalState.mode}
        initialEvent={modalState.target}
        defaultDate={modalState.defaultDate}
        paths={paths}
        courses={courses}
        savedJams={savedJams}
        projects={projects}
        todos={todos}
        boards={boards}
        onClose={() =>
          setModalState({ open: false, mode: 'create', target: null, defaultDate: selectedDateIso })
        }
        onSubmit={async (input) => {
          if (modalState.mode === 'edit' && modalState.target) {
            await onUpdateEvent(modalState.target.id, input);
          } else {
            await onCreateEvent(input);
          }
          setSelectedDateIso(input.date);
        }}
      />
    </div>
  );
}
