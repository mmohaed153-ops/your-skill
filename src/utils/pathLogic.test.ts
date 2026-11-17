import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAllPathsProgress,
  calculatePathProgress,
  createSafeId,
  formatQuickNotesPreview,
  getStepStatus,
  insertStepAtOrder,
  isValidHttpUrl,
  parseVideoUrl,
  QUICK_NOTES_MAX,
  removeStepAndReindex,
  reorderStepsByIds,
  reorderStepsByIndices,
  sanitizeQuickNotes,
  validatePathInput,
  validateQuickNotes,
  validateVideoInput,
} from './pathLogic';
import type { VideoStep } from '../types/learning';

function makeStep(id: string, order: number, completed = false): VideoStep {
  return {
    id,
    pathId: 'path_1',
    ownerId: 'local',
    title: `Video ${id}`,
    description: 'Notes',
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    thumbnailUrl: '/src/assets/images/thumb_react_basics_1794668550211.jpg',
    order,
    completed,
    completedAt: completed ? '2026-11-14T10:00:00Z' : '',
    targetDate: '',
    quickNotes: '',
    quickNotesUpdatedAt: '',
    createdAt: '2026-11-14T10:00:00Z',
    updatedAt: '2026-11-14T10:00:00Z',
  };
}

test('parseVideoUrl detects YouTube watch, short, and youtu.be links', () => {
  const watch = parseVideoUrl('https://www.youtube.com/watch?v=abcDEF12345');
  assert.equal(watch.provider, 'youtube');
  assert.equal(watch.embedUrl, 'https://www.youtube.com/embed/abcDEF12345?rel=0');
  assert.equal(watch.autoThumbnailUrl, 'https://i.ytimg.com/vi/abcDEF12345/hqdefault.jpg');

  const shortLink = parseVideoUrl('https://youtu.be/xyz98765432');
  assert.equal(shortLink.provider, 'youtube');
  assert.equal(shortLink.embedUrl, 'https://www.youtube.com/embed/xyz98765432?rel=0');
});

test('parseVideoUrl detects Vimeo, TikTok, Facebook, Loom, Dailymotion, Twitch, direct video, and generic links', () => {
  const vimeo = parseVideoUrl('https://vimeo.com/123456789');
  assert.equal(vimeo.provider, 'vimeo');
  assert.equal(vimeo.platformName, 'Vimeo');
  assert.equal(vimeo.embedUrl, 'https://player.vimeo.com/video/123456789');

  const tiktok = parseVideoUrl('https://www.tiktok.com/@tiktok/video/7106594312292453675');
  assert.equal(tiktok.provider, 'tiktok');
  assert.equal(tiktok.platformId, 'tiktok');
  assert.equal(tiktok.platformName, 'TikTok');
  assert.equal(tiktok.embedUrl, 'https://www.tiktok.com/player/v1/7106594312292453675');

  const fb = parseVideoUrl('https://www.facebook.com/watch/?v=1234567890');
  assert.equal(fb.provider, 'facebook');
  assert.equal(fb.platformId, 'facebook');
  assert.equal(fb.platformName, 'Facebook');
  assert.ok(fb.embedUrl?.includes('facebook.com/plugins/video.php'));

  const loom = parseVideoUrl('https://www.loom.com/share/abcdef1234567890');
  assert.equal(loom.provider, 'loom');
  assert.equal(loom.embedUrl, 'https://www.loom.com/embed/abcdef1234567890');

  const dm = parseVideoUrl('https://www.dailymotion.com/video/x8abcde');
  assert.equal(dm.provider, 'dailymotion');
  assert.equal(dm.embedUrl, 'https://www.dailymotion.com/embed/video/x8abcde');

  const twitch = parseVideoUrl('https://www.twitch.tv/videos/123456789');
  assert.equal(twitch.platformId, 'twitch');
  assert.equal(twitch.platformName, 'Twitch');

  const mp4 = parseVideoUrl('https://cdn.example.com/lesson.mp4');
  assert.equal(mp4.provider, 'direct');

  const generic = parseVideoUrl('example.com/course/lesson-1');
  assert.equal(generic.provider, 'external');
  assert.equal(generic.platformName, 'example.com');
  assert.equal(generic.normalizedUrl, 'https://example.com/course/lesson-1');
});

test('calculatePathProgress computes completion percentage and next uncompleted step', () => {
  const empty = calculatePathProgress([]);
  assert.equal(empty.percentage, 0);
  assert.equal(empty.nextStep, null);

  const steps = [
    makeStep('s1', 0, true),
    makeStep('s2', 1, false),
    makeStep('s3', 2, false),
    makeStep('s4', 3, false),
  ];

  const progress = calculatePathProgress(steps);
  assert.equal(progress.total, 4);
  assert.equal(progress.completedCount, 1);
  assert.equal(progress.percentage, 25);
  assert.equal(progress.currentStepIndex, 1);
  assert.equal(progress.nextStep?.id, 's2');

  assert.equal(getStepStatus(steps[0], 0, progress.currentStepIndex), 'completed');
  assert.equal(getStepStatus(steps[1], 1, progress.currentStepIndex), 'current');
  assert.equal(getStepStatus(steps[2], 2, progress.currentStepIndex), 'upcoming');
});

test('insertStepAtOrder inserts at chosen 1-based position and re-indexes', () => {
  const steps = [makeStep('s1', 0), makeStep('s2', 1), makeStep('s3', 2)];
  const inserted = insertStepAtOrder(steps, makeStep('s_new', 99), 2);
  assert.deepEqual(
    inserted.map((s) => [s.id, s.order]),
    [
      ['s1', 0],
      ['s_new', 1],
      ['s2', 2],
      ['s3', 3],
    ]
  );
});

test('reorderStepsByIndices and reorderStepsByIds move steps cleanly and re-index', () => {
  const steps = [makeStep('s1', 0), makeStep('s2', 1), makeStep('s3', 2)];
  const reordered = reorderStepsByIndices(steps, 0, 2);
  assert.deepEqual(
    reordered.map((s) => [s.id, s.order]),
    [
      ['s2', 0],
      ['s3', 1],
      ['s1', 2],
    ]
  );

  const byIds = reorderStepsByIds(steps, ['s3', 's1', 's2']);
  assert.deepEqual(
    byIds.map((s) => [s.id, s.order]),
    [
      ['s3', 0],
      ['s1', 1],
      ['s2', 2],
    ]
  );
});

test('calculateAllPathsProgress computes independent stats per path', () => {
  const stats = calculateAllPathsProgress(
    [{ id: 'p1' }, { id: 'p2' }],
    {
      p1: [makeStep('a', 0, true), makeStep('b', 1, true)],
      p2: [makeStep('c', 0, false), makeStep('d', 1, true)],
    }
  );
  assert.equal(stats.p1.percentage, 100);
  assert.equal(stats.p2.percentage, 50);
  assert.equal(stats.p2.nextStep?.id, 'c');
});

test('removeStepAndReindex removes target step and preserves contiguous order', () => {
  const steps = [makeStep('s1', 0), makeStep('s2', 1), makeStep('s3', 2)];
  const remaining = removeStepAndReindex(steps, 's2');
  assert.deepEqual(
    remaining.map((s) => [s.id, s.order]),
    [
      ['s1', 0],
      ['s3', 1],
    ]
  );
});

test('validateVideoInput & validatePathInput enforce unique path names and valid URLs', () => {
  assert.equal(isValidHttpUrl('https://youtube.com/watch?v=123456'), true);
  assert.equal(isValidHttpUrl('not a url'), false);

  const badVideo = validateVideoInput({ title: '', videoUrl: 'invalid', description: '' });
  assert.equal(badVideo.valid, false);
  assert.ok(badVideo.errors.title);
  assert.ok(badVideo.errors.videoUrl);

  const goodVideo = validateVideoInput({
    title: 'الدرس الأول',
    videoUrl: 'https://youtu.be/dQw4w9WgXcQ',
    description: 'ملاحظات سريعة',
  });
  assert.equal(goodVideo.valid, true);

  const badPath = validatePathInput({ title: '  ', description: '' });
  assert.equal(badPath.valid, false);

  const duplicatePath = validatePathInput({
    title: 'مسار الويب',
    description: '',
    existingPaths: [{ id: 'p1', title: 'مسار الويب' }],
  });
  assert.equal(duplicatePath.valid, false);
  assert.ok(duplicatePath.errors.title);

  const editingSamePath = validatePathInput({
    title: 'مسار الويب',
    description: '',
    existingPaths: [{ id: 'p1', title: 'مسار الويب' }],
    excludePathId: 'p1',
  });
  assert.equal(editingSamePath.valid, true);

  const safeId = createSafeId('step!');
  assert.match(safeId, /^[a-zA-Z0-9_-]+$/);
});

test('Quick Notes sanitization, validation, and preview formatting work cleanly', () => {
  assert.equal(sanitizeQuickNotes('  ملاحظة مهمة\nالسطر الثاني  '), 'ملاحظة مهمة\nالسطر الثاني');
  assert.equal(validateQuickNotes('نص قصير للمذاكرة').valid, true);

  const oversized = 'أ'.repeat(QUICK_NOTES_MAX + 5);
  const invalidRes = validateQuickNotes(oversized);
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.error);
  assert.equal(sanitizeQuickNotes(oversized).length, QUICK_NOTES_MAX);

  const shortPreview = formatQuickNotesPreview('ملخص الدرس', 40);
  assert.equal(shortPreview.truncated, false);
  assert.equal(shortPreview.text, 'ملخص الدرس');

  const longPreview = formatQuickNotesPreview('كلمة '.repeat(40), 50);
  assert.equal(longPreview.truncated, true);
  assert.ok(longPreview.text.endsWith('...'));
});
