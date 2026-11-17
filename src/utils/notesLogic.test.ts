import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildNotePlainPreview,
  extractPlainTextFromHtml,
  filterAndSortNotes,
  getNotesLinkedToTarget,
  normalizeSafeLinkHref,
  removeNoteLink,
  sanitizeNoteHtml,
  upsertNoteLink,
} from './notesLogic';
import type { WorkspaceNote } from '../types/workspace';

function makeNote(overrides: Partial<WorkspaceNote> & { id: string }): WorkspaceNote {
  return {
    ownerId: 'local',
    title: 'ملاحظة تجريبية',
    contentHtml: '<p>محتوى الملاحظة</p>',
    plainPreview: 'محتوى الملاحظة',
    folder: 'ملاحظات عامة',
    tags: [],
    pinned: false,
    links: [],
    createdAt: '2026-11-10T10:00:00.000Z',
    updatedAt: '2026-11-10T10:00:00.000Z',
    ...overrides,
  };
}

test('sanitizeNoteHtml strips scripts and dangerous attributes while preserving rich formatting', () => {
  const dirty =
    '<h1>عنوان</h1><p onclick="alert(1)">نص <strong>غامق</strong> و<em>مائل</em></p><script>evil()</script><a href="javascript:alert(1)">خطر</a><pre dir="ltr"><code>let x = 1;</code></pre>';
  const clean = sanitizeNoteHtml(dirty);
  assert.ok(!clean.includes('<script>'));
  assert.ok(!clean.includes('onclick'));
  assert.ok(!clean.includes('javascript:'));
  assert.ok(clean.includes('<h1>عنوان</h1>'));
  assert.ok(clean.includes('<strong>غامق</strong>'));
  assert.ok(clean.includes('<pre dir="ltr"><code>let x = 1;</code></pre>'));
});

test('extractPlainTextFromHtml and buildNotePlainPreview flatten HTML cleanly', () => {
  const html = '<h2>خطة اليوم</h2><ul><li>بند أول</li><li>بند ثاني</li></ul>';
  const plain = extractPlainTextFromHtml(html);
  assert.ok(plain.includes('خطة اليوم'));
  assert.ok(plain.includes('بند أول'));

  const longHtml = `<p>${'كلمة '.repeat(100)}</p>`;
  const preview = buildNotePlainPreview(longHtml, 60);
  assert.ok(preview.length <= 60);
  assert.ok(preview.endsWith('...'));
});

test('filterAndSortNotes prioritizes pinned notes and supports updated, created, and alphabetical sorting', () => {
  const notes: WorkspaceNote[] = [
    makeNote({
      id: 'n1',
      title: 'بناء واجهة',
      folder: 'ملاحظات البرمجة',
      tags: ['react', 'ui'],
      pinned: false,
      createdAt: '2026-11-01T10:00:00.000Z',
      updatedAt: '2026-11-14T12:00:00.000Z',
    }),
    makeNote({
      id: 'n2',
      title: 'أفكار اللعبة',
      folder: 'تطوير الألعاب',
      tags: ['godot'],
      pinned: true,
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-11T10:00:00.000Z',
    }),
    makeNote({
      id: 'n3',
      title: 'تجربة الصوت',
      folder: 'تصميم وأصول',
      tags: ['audio'],
      pinned: false,
      createdAt: '2026-11-12T10:00:00.000Z',
      updatedAt: '2026-11-12T10:00:00.000Z',
    }),
  ];

  const byUpdated = filterAndSortNotes(notes, {
    searchQuery: '',
    folderFilter: 'all',
    sortBy: 'updated_desc',
  });
  // Pinned note n2 must stay first, then n1 (Nov 14), then n3 (Nov 12)
  assert.deepEqual(
    byUpdated.map((n) => n.id),
    ['n2', 'n1', 'n3']
  );

  const byAlpha = filterAndSortNotes(notes, {
    searchQuery: '',
    folderFilter: 'all',
    sortBy: 'title_asc',
  });
  assert.deepEqual(
    byAlpha.map((n) => n.id),
    ['n2', 'n1', 'n3']
  );

  const byCreated = filterAndSortNotes(notes, {
    searchQuery: '',
    folderFilter: 'all',
    sortBy: 'created_desc',
  });
  assert.deepEqual(
    byCreated.map((n) => n.id),
    ['n2', 'n3', 'n1']
  );

  const searchTag = filterAndSortNotes(notes, {
    searchQuery: 'react',
    folderFilter: 'all',
    sortBy: 'updated_desc',
  });
  assert.deepEqual(
    searchTag.map((n) => n.id),
    ['n1']
  );
});

test('upsertNoteLink, removeNoteLink, getNotesLinkedToTarget, and normalizeSafeLinkHref behave deterministically', () => {
  const link1 = {
    type: 'vault_project' as const,
    targetId: 'proj_1',
    parentId: '',
    label: 'مشروع المنصات',
  };
  const link2 = {
    type: 'library_asset' as const,
    targetId: 'asset_1',
    parentId: '',
    label: 'صندوق خيال علمي',
  };

  let links = upsertNoteLink([], link1);
  links = upsertNoteLink(links, link2);
  links = upsertNoteLink(links, { ...link1, label: 'مشروع المنصات المحدث' });
  assert.equal(links.length, 2);
  assert.equal(links[0].label, 'مشروع المنصات المحدث');

  const n1 = makeNote({ id: 'n1', links: [link1] });
  const n2 = makeNote({ id: 'n2', links: [link2] });
  assert.deepEqual(
    getNotesLinkedToTarget([n1, n2], 'vault_project', 'proj_1').map((n) => n.id),
    ['n1']
  );

  const afterRemove = removeNoteLink(links, 'vault_project', 'proj_1');
  assert.equal(afterRemove.length, 1);
  assert.equal(afterRemove[0].targetId, 'asset_1');

  const courseLink = {
    type: 'course' as const,
    targetId: 'course_1',
    parentId: '',
    label: 'كورس تطوير الألعاب',
  };
  const pathLink = {
    type: 'learning_path' as const,
    targetId: 'path_1',
    parentId: '',
    label: 'مسار تطوير الويب',
  };
  const n3 = makeNote({ id: 'n3', links: [courseLink, pathLink] });
  assert.equal(getNotesLinkedToTarget([n1, n2, n3], 'course', 'course_1')[0].id, 'n3');
  assert.equal(getNotesLinkedToTarget([n1, n2, n3], 'learning_path', 'path_1')[0].id, 'n3');

  assert.equal(normalizeSafeLinkHref('godotengine.org/docs'), 'https://godotengine.org/docs');
  assert.equal(normalizeSafeLinkHref('javascript:alert(1)'), null);
});
