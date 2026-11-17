import test from 'node:test';
import assert from 'node:assert/strict';
import type { VideoStep } from '../types/learning';
import type { CalendarEvent, SavedGameJam, TodoTask } from '../types/workspace';
import {
  buildJamCalendarDrafts,
  buildMonthGrid,
  buildWeekDays,
  collectUnifiedCalendarItems,
  getItemsForDate,
  getUpcomingReminders,
  validateCalendarEventInput,
} from './calendarLogic';

test('buildMonthGrid generates 42 days covering the month starting on Saturday', () => {
  const cells = buildMonthGrid(2026, 10); // November 2026
  assert.equal(cells.length, 42);
  const novDays = cells.filter((c) => c.inCurrentMonth);
  assert.equal(novDays.length, 30);
  assert.equal(novDays[0].dateIso, '2026-11-01');
  assert.equal(novDays[29].dateIso, '2026-11-30');
});

test('buildWeekDays builds 7 consecutive days starting Saturday around anchor date', () => {
  const week = buildWeekDays('2026-11-18'); // Wednesday
  assert.equal(week.length, 7);
  assert.equal(week[0].dateIso, '2026-11-14'); // Saturday
  assert.equal(week[6].dateIso, '2026-11-20'); // Friday
});

test('collectUnifiedCalendarItems merges events, todos, learning steps, and game jams cleanly', () => {
  const events: CalendarEvent[] = [
    {
      id: 'cal_1',
      ownerId: 'u1',
      title: 'جلسة تعلم React',
      description: '',
      date: '2026-11-16',
      startTime: '18:00',
      endTime: '19:00',
      category: 'study',
      colorHex: '#062D4C',
      reminderMinutes: 30,
      reminderEnabled: true,
      completed: false,
      linkedType: 'learning_path',
      linkedId: 'p1',
      linkedParentId: '',
      linkedLabel: 'مسار الويب',
      createdAt: '',
      updatedAt: '',
    },
  ];
  const todos: TodoTask[] = [
    {
      id: 'todo_1',
      ownerId: 'u1',
      title: 'إكمال التصميم',
      description: '',
      priority: 'high',
      dueDate: '2026-11-17',
      completed: false,
      completedAt: '',
      link: { type: 'project', targetId: 'proj_1', parentId: '', label: 'لعبة 2D' },
      createdAt: '',
      updatedAt: '',
    },
  ];
  const stepsByPath: Record<string, VideoStep[]> = {
    p1: [
      {
        id: 'step_1',
        pathId: 'p1',
        ownerId: 'u1',
        title: 'فهم Props',
        description: '',
        videoUrl: 'https://youtube.com/watch?v=123',
        thumbnailUrl: '',
        order: 0,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-16',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: '',
        updatedAt: '',
      },
    ],
  };
  const savedJams: SavedGameJam[] = [
    {
      id: 'jam_1',
      ownerId: 'u1',
      name: 'Kenney Jam',
      description: '',
      startDate: '2026-11-18T12:00:00Z',
      endDate: '2026-11-20T12:00:00Z',
      status: 'upcoming',
      mode: 'online',
      location: 'أونلاين',
      theme: 'Growth',
      platform: 'itch.io',
      organizer: 'Kenney',
      officialUrl: 'https://itch.io/jams',
      thumbnailUrl: '',
      personalNotes: '',
      linkedProjectId: '',
      linkedBoardId: '',
      resources: [],
      infoUpdatedAt: '',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const items = collectUnifiedCalendarItems({
    events,
    todos,
    stepsByPath,
    pathTitleById: { p1: 'مسار الويب' },
    savedJams,
  });

  assert.equal(items.length, 5); // 1 event + 1 todo + 1 step + 2 jam boundary dates
  assert.equal(getItemsForDate(items, '2026-11-16').length, 2);
  assert.equal(getItemsForDate(items, '2026-11-18')[0].category, 'game_jam');

  const reminders = getUpcomingReminders(items, '2026-11-16', 2);
  assert.equal(reminders.length, 3); // cal_1 (16), todo_1 (17), jam_start (18)
});

test('validateCalendarEventInput and buildJamCalendarDrafts validate inputs cleanly', () => {
  assert.ok(validateCalendarEventInput({ title: '', date: '2026-11-16' }));
  assert.ok(validateCalendarEventInput({ title: 'حدث', date: 'bad-date' }));
  assert.ok(
    validateCalendarEventInput({
      title: 'حدث',
      date: '2026-11-16',
      startTime: '19:00',
      endTime: '18:00',
    })
  );
  assert.equal(
    validateCalendarEventInput({
      title: 'جلسة',
      date: '2026-11-16',
      startTime: '18:00',
      endTime: '19:30',
    }),
    null
  );

  const drafts = buildJamCalendarDrafts({
    id: 'jam_x',
    name: 'GMTK Jam',
    startDate: '2026-11-21T16:00:00Z',
    endDate: '2026-11-23T16:00:00Z',
    theme: 'Scale',
    platform: 'itch.io',
  });
  assert.equal(drafts.length, 2);
  assert.equal(drafts[0].date, '2026-11-21');
  assert.equal(drafts[1].date, '2026-11-23');
});
