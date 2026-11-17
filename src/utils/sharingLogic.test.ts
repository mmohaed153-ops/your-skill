import test from 'node:test';
import assert from 'node:assert/strict';
import type { SavedGameJam, WorkspaceNote } from '../types/workspace';
import {
  buildSanitizedShareBundle,
  buildShareInviteUrl,
  canCollaborateOnShare,
  canViewShare,
  extractShareParamsFromSearch,
  isShareOwner,
  normalizeUsername,
  parseSharePayload,
  validateUsername,
} from './sharingLogic';

test('username normalization and validation enforce clean handle rules', () => {
  assert.equal(normalizeUsername(' @Ahmed Dev '), 'Ahmed_Dev');
  assert.ok(validateUsername('ab'));
  assert.equal(validateUsername('ahmed_dev99'), null);
});

test('share permissions enforce owner, collaborator, viewer, and revocation accurately', () => {
  const viewerShare = {
    ownerId: 'owner1',
    recipientUid: 'friend1',
    revoked: false,
    role: 'viewer' as const,
  };
  assert.equal(canViewShare(viewerShare, 'friend1'), true);
  assert.equal(canCollaborateOnShare(viewerShare, 'friend1'), false);
  assert.equal(isShareOwner(viewerShare, 'owner1'), true);
  assert.equal(isShareOwner(viewerShare, 'friend1'), false);

  const collabShare = { ...viewerShare, role: 'collaborator' as const };
  assert.equal(canCollaborateOnShare(collabShare, 'friend1'), true);

  const revokedShare = { ...collabShare, revoked: true };
  assert.equal(canViewShare(revokedShare, 'friend1'), false);
  assert.equal(canCollaborateOnShare(revokedShare, 'friend1'), false);
  assert.equal(canViewShare(revokedShare, 'owner1'), true);
});

test('buildSanitizedShareBundle isolates private notes unless explicitly allowed', () => {
  const jam: SavedGameJam = {
    id: 'jam1',
    ownerId: 'owner1',
    name: 'Godot Wild Jam',
    description: 'مسابقة ألعاب شهرية',
    startDate: '2026-11-20',
    endDate: '2026-11-29',
    status: 'upcoming',
    mode: 'online',
    location: 'أونلاين',
    theme: 'Echoes',
    platform: 'itch.io',
    organizer: 'GWJ',
    officialUrl: 'https://itch.io/jams',
    thumbnailUrl: 'data:image/jpeg;base64,huge-private-blob',
    personalNotes: 'ملاحظتي الخاصة السرية لا تشارك تلقائياً',
    linkedProjectId: 'proj1',
    linkedBoardId: 'board1',
    resources: [{ id: 'r1', title: 'Docs', url: 'https://docs.godotengine.org' }],
    infoUpdatedAt: '',
    createdAt: '',
    updatedAt: '',
  };

  const withoutPrivateNotes = buildSanitizedShareBundle({
    itemType: 'saved_game_jam',
    jam,
    includePersonalNotes: false,
  });
  assert.equal(withoutPrivateNotes.savedGameJam?.personalNotes, undefined);
  assert.equal(withoutPrivateNotes.thumbnail, '');

  const withNotes = buildSanitizedShareBundle({
    itemType: 'saved_game_jam',
    jam,
    includePersonalNotes: true,
  });
  assert.equal(withNotes.savedGameJam?.personalNotes, jam.personalNotes);

  const note: WorkspaceNote = {
    id: 'note_1',
    ownerId: 'owner1',
    title: 'ملاحظة مختارة للمشاركة',
    contentHtml: '<p>محتوى مفيد للأصدقاء</p>',
    plainPreview: 'محتوى مفيد للأصدقاء',
    folder: 'عام',
    tags: ['godot'],
    pinned: false,
    links: [],
    createdAt: '',
    updatedAt: '',
  };
  const noteBundle = buildSanitizedShareBundle({ itemType: 'note', note });
  const parsed = parseSharePayload(JSON.stringify(noteBundle));
  assert.equal(parsed?.note?.title, note.title);
});

test('share invite URL builder and parser round-trip shareId and code', () => {
  const url = buildShareInviteUrl('https://masar.example.com/', 'share_123', 'code_abc');
  assert.equal(url, 'https://masar.example.com/?share=share_123&code=code_abc');
  const parsed = extractShareParamsFromSearch(new URL(url).search);
  assert.deepEqual(parsed, { shareId: 'share_123', shareCode: 'code_abc' });
});
