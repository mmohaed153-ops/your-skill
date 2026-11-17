import type { VideoStep } from '../types/learning';
import type {
  CalendarEvent,
  CalendarEventCategory,
  CourseItem,
  SavedGameJam,
  TodoTask,
  VaultProject,
} from '../types/workspace';
import { createSafeId } from './pathLogic';

export interface CalendarCategoryMeta {
  id: CalendarEventCategory;
  label: string;
  colorHex: string;
  badgeClass: string;
}

export const CALENDAR_CATEGORY_META: Record<CalendarEventCategory, CalendarCategoryMeta> = {
  study: {
    id: 'study',
    label: 'جلسة تعلم / مسار',
    colorHex: '#062D4C',
    badgeClass: 'bg-[#062D4C] text-white',
  },
  course: {
    id: 'course',
    label: 'كورس تدريبي',
    colorHex: '#0284C7',
    badgeClass: 'bg-sky-600 text-white',
  },
  game_jam: {
    id: 'game_jam',
    label: 'مسابقة Game Jam',
    colorHex: '#B92622',
    badgeClass: 'bg-[#B92622] text-white',
  },
  project: {
    id: 'project',
    label: 'مشروع ومعلم تطوير',
    colorHex: '#059669',
    badgeClass: 'bg-emerald-600 text-white',
  },
  todo: {
    id: 'todo',
    label: 'مهمة وموعد تسليم',
    colorHex: '#D97706',
    badgeClass: 'bg-amber-600 text-white',
  },
  board: {
    id: 'board',
    label: 'لوحة التعلم',
    colorHex: '#7C3AED',
    badgeClass: 'bg-violet-600 text-white',
  },
  personal: {
    id: 'personal',
    label: 'تذكير شخصي',
    colorHex: '#475569',
    badgeClass: 'bg-slate-600 text-white',
  },
};

export const CALENDAR_COLOR_CHOICES = [
  { hex: '#062D4C', label: 'أزرق كحلي' },
  { hex: '#B92622', label: 'أحمر قرمزي' },
  { hex: '#059669', label: 'أخضر زمردي' },
  { hex: '#0284C7', label: 'أزرق سماوي' },
  { hex: '#D97706', label: 'كهرماني' },
  { hex: '#7C3AED', label: 'بنفسجي' },
  { hex: '#475569', label: 'رمادي داكن' },
];

export interface CalendarGridCell {
  dateIso: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

export function toDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateIso(dateIso: string): Date {
  const clean = (dateIso || '').slice(0, 10);
  const match = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return new Date();
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function addDaysIso(dateIso: string, days: number): string {
  const dt = parseDateIso(dateIso);
  dt.setDate(dt.getDate() + days);
  return toDateIso(dt);
}

/**
 * Builds a 42-cell calendar grid (6 rows x 7 cols) starting on Saturday (day 6).
 */
export function buildMonthGrid(year: number, monthZeroBased: number): CalendarGridCell[] {
  const firstOfMonth = new Date(year, monthZeroBased, 1);
  // Saturday-first offset: Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
  const startOffset = (firstOfMonth.getDay() + 1) % 7;
  const gridStart = new Date(year, monthZeroBased, 1 - startOffset);
  const cells: CalendarGridCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({
      dateIso: toDateIso(cellDate),
      dayNumber: cellDate.getDate(),
      inCurrentMonth: cellDate.getMonth() === monthZeroBased,
    });
  }
  return cells;
}

export function buildWeekDays(anchorDateIso: string): CalendarGridCell[] {
  const anchor = parseDateIso(anchorDateIso);
  const offsetToSaturday = (anchor.getDay() + 1) % 7;
  const saturday = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - offsetToSaturday);
  const days: CalendarGridCell[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(saturday.getFullYear(), saturday.getMonth(), saturday.getDate() + i);
    days.push({
      dateIso: toDateIso(d),
      dayNumber: d.getDate(),
      inCurrentMonth: d.getMonth() === anchor.getMonth(),
    });
  }
  return days;
}

export const ARABIC_WEEKDAYS_SAT_START = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

export function formatMonthTitleArabic(year: number, monthZeroBased: number): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', { month: 'long', year: 'numeric' }).format(
      new Date(year, monthZeroBased, 1)
    );
  } catch {
    return `${year}-${String(monthZeroBased + 1).padStart(2, '0')}`;
  }
}

export function formatDayHeaderArabic(dateIso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(parseDateIso(dateIso));
  } catch {
    return dateIso;
  }
}

export interface UnifiedCalendarItem {
  id: string;
  source: 'event' | 'todo' | 'path_step' | 'game_jam';
  title: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  category: CalendarEventCategory;
  colorHex: string;
  completed: boolean;
  reminderEnabled: boolean;
  reminderMinutes: number;
  linkedType: CalendarEvent['linkedType'];
  linkedId: string;
  linkedParentId: string;
  linkedLabel: string;
  rawEvent?: CalendarEvent;
}

export function collectUnifiedCalendarItems(params: {
  events: CalendarEvent[];
  todos?: TodoTask[];
  stepsByPath?: Record<string, VideoStep[]>;
  pathTitleById?: Record<string, string>;
  savedJams?: SavedGameJam[];
}): UnifiedCalendarItem[] {
  const items: UnifiedCalendarItem[] = [];
  const linkedTodoIds = new Set<string>();

  for (const ev of params.events) {
    if (ev.linkedType === 'todo' && ev.linkedId) {
      linkedTodoIds.add(ev.linkedId);
    }
    items.push({
      id: ev.id,
      source: 'event',
      title: ev.title,
      description: ev.description,
      date: ev.date,
      startTime: ev.startTime,
      endTime: ev.endTime,
      category: ev.category,
      colorHex: ev.colorHex || CALENDAR_CATEGORY_META[ev.category].colorHex,
      completed: ev.completed,
      reminderEnabled: ev.reminderEnabled,
      reminderMinutes: ev.reminderMinutes,
      linkedType: ev.linkedType,
      linkedId: ev.linkedId,
      linkedParentId: ev.linkedParentId,
      linkedLabel: ev.linkedLabel,
      rawEvent: ev,
    });
  }

  // Include Todo tasks with due dates (avoid duplicating if already bound to a calendar event)
  for (const todo of params.todos || []) {
    const date = (todo.dueDate || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    if (linkedTodoIds.has(todo.id)) continue;
    items.push({
      id: `sync_todo_${todo.id}`,
      source: 'todo',
      title: `مهمة: ${todo.title}`,
      description: todo.description,
      date,
      startTime: '',
      endTime: '',
      category: 'todo',
      colorHex: CALENDAR_CATEGORY_META.todo.colorHex,
      completed: todo.completed,
      reminderEnabled: !todo.completed,
      reminderMinutes: 60,
      linkedType: 'todo',
      linkedId: todo.id,
      linkedParentId: '',
      linkedLabel: todo.link.label || 'قائمة المهام',
    });
  }

  // Include Learning Path steps with targetDate
  if (params.stepsByPath) {
    for (const [pathId, pathSteps] of Object.entries(params.stepsByPath)) {
      const pathTitle = params.pathTitleById?.[pathId] || 'مسار التعلم';
      for (const step of pathSteps) {
        const date = (step.targetDate || '').slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        items.push({
          id: `sync_step_${step.id}`,
          source: 'path_step',
          title: `درس: ${step.title}`,
          description: step.description,
          date,
          startTime: '',
          endTime: '',
          category: 'study',
          colorHex: CALENDAR_CATEGORY_META.study.colorHex,
          completed: step.completed,
          reminderEnabled: false,
          reminderMinutes: -1,
          linkedType: 'learning_step',
          linkedId: step.id,
          linkedParentId: pathId,
          linkedLabel: pathTitle,
        });
      }
    }
  }

  // Include Saved Game Jam start & end dates automatically if valid YYYY-MM-DD
  const eventJamKeys = new Set(
    params.events
      .filter((e) => e.linkedType === 'game_jam')
      .map((e) => `${e.linkedId}_${e.date}`)
  );
  for (const jam of params.savedJams || []) {
    const startIso = jam.startDate ? jam.startDate.slice(0, 10) : '';
    const endIso = jam.endDate ? jam.endDate.slice(0, 10) : '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(startIso) && !eventJamKeys.has(`${jam.id}_${startIso}`)) {
      items.push({
        id: `sync_jam_start_${jam.id}`,
        source: 'game_jam',
        title: `بداية مسابقة: ${jam.name}`,
        description: jam.theme ? `الثيم: ${jam.theme}` : jam.description,
        date: startIso,
        startTime: '',
        endTime: '',
        category: 'game_jam',
        colorHex: CALENDAR_CATEGORY_META.game_jam.colorHex,
        completed: jam.status === 'ended',
        reminderEnabled: true,
        reminderMinutes: 1440,
        linkedType: 'game_jam',
        linkedId: jam.id,
        linkedParentId: '',
        linkedLabel: jam.platform,
      });
    }
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(endIso) &&
      endIso !== startIso &&
      !eventJamKeys.has(`${jam.id}_${endIso}`)
    ) {
      items.push({
        id: `sync_jam_end_${jam.id}`,
        source: 'game_jam',
        title: `آخر موعد تسليم: ${jam.name}`,
        description: 'الموعد النهائي لتسليم المشروع في المسابقة',
        date: endIso,
        startTime: '',
        endTime: '',
        category: 'game_jam',
        colorHex: '#9E1E1B',
        completed: jam.status === 'ended',
        reminderEnabled: true,
        reminderMinutes: 1440,
        linkedType: 'game_jam',
        linkedId: jam.id,
        linkedParentId: '',
        linkedLabel: jam.platform,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    if (a.startTime && b.startTime) return a.startTime.localeCompare(b.startTime);
    if (a.startTime && !b.startTime) return -1;
    if (!a.startTime && b.startTime) return 1;
    return a.title.localeCompare(b.title);
  });
}

export function getItemsForDate(items: UnifiedCalendarItem[], dateIso: string): UnifiedCalendarItem[] {
  return items.filter((item) => item.date === dateIso);
}

export function getUpcomingReminders(
  items: UnifiedCalendarItem[],
  todayIso: string,
  daysAhead = 3
): UnifiedCalendarItem[] {
  const maxDate = addDaysIso(todayIso, daysAhead);
  return items.filter(
    (item) =>
      !item.completed &&
      item.reminderEnabled &&
      item.date >= todayIso &&
      item.date <= maxDate
  );
}

export function validateCalendarEventInput(input: {
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
}): string | null {
  if (!input.title.trim()) return 'يرجى إدخال عنوان الحدث أو التذكير.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test((input.date || '').trim())) {
    return 'يرجى تحديد تاريخ صحيح بصيغة YYYY-MM-DD.';
  }
  if (input.startTime && input.endTime && input.endTime < input.startTime) {
    return 'وقت النهاية يجب أن يكون بعد وقت البداية.';
  }
  return null;
}

export function createStarterCalendarEvents(): CalendarEvent[] {
  const today = toDateIso(new Date());
  const tomorrow = addDaysIso(today, 1);
  const inThreeDays = addDaysIso(today, 3);
  const nowIso = new Date().toISOString();
  return [
    {
      id: createSafeId('cal'),
      ownerId: 'local',
      title: 'جلسة تطبيق React Hooks وبناء النماذج',
      description: 'مشاهدة الفيديو الثاني وتجربة حفظ التقدم السحابي.',
      date: today,
      startTime: '18:00',
      endTime: '19:30',
      category: 'study',
      colorHex: CALENDAR_CATEGORY_META.study.colorHex,
      reminderMinutes: 30,
      reminderEnabled: true,
      completed: false,
      linkedType: 'learning_path',
      linkedId: 'path_web_foundations',
      linkedParentId: '',
      linkedLabel: 'مسار تطوير واجهات الويب التفاعلية',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: createSafeId('cal'),
      ownerId: 'local',
      title: 'مراجعة أصول Godot وتجهيز مرحلة الاختبار',
      description: 'تحديث النسخة الاحتياطية في الخزنة واختبار فيزياء الحركة.',
      date: tomorrow,
      startTime: '20:00',
      endTime: '21:00',
      category: 'project',
      colorHex: CALENDAR_CATEGORY_META.project.colorHex,
      reminderMinutes: 60,
      reminderEnabled: true,
      completed: false,
      linkedType: 'project',
      linkedId: 'vault_platformer_quest',
      linkedParentId: '',
      linkedLabel: 'لعبة المغامرة ثنائية الأبعاد (Godot 4)',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: createSafeId('cal'),
      ownerId: 'local',
      title: 'متابعة كورس تطوير الألعاب في Godot 4',
      description: 'مراجعة شجرة العقد وتجربة المشهد الأول.',
      date: inThreeDays,
      startTime: '17:00',
      endTime: '18:30',
      category: 'course',
      colorHex: CALENDAR_CATEGORY_META.course.colorHex,
      reminderMinutes: 15,
      reminderEnabled: true,
      completed: false,
      linkedType: 'course',
      linkedId: 'course_godot_3d_craft',
      linkedParentId: '',
      linkedLabel: 'أساسيات بناء الألعاب ثنائية وثلاثية الأبعاد في Godot 4',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

export function buildJamCalendarDrafts(
  jam: Pick<SavedGameJam, 'id' | 'name' | 'startDate' | 'endDate' | 'theme' | 'platform'>,
  todayIso = toDateIso(new Date())
): Array<{
  title: string;
  description: string;
  date: string;
  category: CalendarEventCategory;
  colorHex: string;
  linkedType: CalendarEvent['linkedType'];
  linkedId: string;
  linkedLabel: string;
}> {
  const drafts: Array<{
    title: string;
    description: string;
    date: string;
    category: CalendarEventCategory;
    colorHex: string;
    linkedType: CalendarEvent['linkedType'];
    linkedId: string;
    linkedLabel: string;
  }> = [];

  const startDate = jam.startDate && /^\d{4}-\d{2}-\d{2}/.test(jam.startDate)
    ? jam.startDate.slice(0, 10)
    : todayIso;

  drafts.push({
    title: `بداية مسابقة: ${jam.name}`,
    description: jam.theme ? `الثيم: ${jam.theme}` : `انطلاق المسابقة على ${jam.platform}`,
    date: startDate,
    category: 'game_jam',
    colorHex: '#B92622',
    linkedType: 'game_jam',
    linkedId: jam.id,
    linkedLabel: jam.name,
  });

  if (jam.endDate && /^\d{4}-\d{2}-\d{2}/.test(jam.endDate)) {
    const endDate = jam.endDate.slice(0, 10);
    if (endDate !== startDate) {
      drafts.push({
        title: `الموعد النهائي للتسليم: ${jam.name}`,
        description: 'موعد رفع اللعبة النهائية وصفحة المسابقة.',
        date: endDate,
        category: 'game_jam',
        colorHex: '#9E1E1B',
        linkedType: 'game_jam',
        linkedId: jam.id,
        linkedLabel: jam.name,
      });
    }
  }

  return drafts;
}

export function createTodoTitleForProject(project: Pick<VaultProject, 'name'>): string {
  return `معلم المشروع: ${project.name}`;
}

export function createCourseScheduleTitle(course: Pick<CourseItem, 'title'>): string {
  return `جلسة دراسة: ${course.title}`;
}
