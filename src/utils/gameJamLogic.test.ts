import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { SavedGameJam, VideoCollection } from '../types/workspace';
import {
  buildJamResourceLink,
  computeEndDateFromDuration,
  deriveJamCountdownLabel,
  filterSavedGameJams,
  filterVideoCollections,
  filterVideosInsideCollection,
  parseNaturalJamQuery,
  validateOrganizedVideoInput,
  validateVideoCollectionInput,
} from './gameJamLogic';

describe('gameJamLogic — natural query intent parsing', () => {
  it('detects online & active queries in English and Arabic', () => {
    const q1 = parseNaturalJamQuery('What Game Jams are currently active?');
    assert.equal(q1.inferredStatus, 'active');

    const q2 = parseNaturalJamQuery('Show online Game Jams for beginners');
    assert.equal(q2.inferredMode, 'online');
    assert.equal(q2.beginnerOnly, true);

    const q3 = parseNaturalJamQuery('Find a Game Jam near Cairo');
    assert.equal(q3.inferredMode, 'in_person');
    assert.equal(q3.inferredLocation, 'Cairo');

    const q4 = parseNaturalJamQuery('مسابقة ألعاب قريباً أونلاين للمبتدئين');
    assert.equal(q4.inferredStatus, 'upcoming');
    assert.equal(q4.inferredMode, 'online');
    assert.equal(q4.beginnerOnly, true);
  });

  it('computes end date from start ISO and duration string', () => {
    const end = computeEndDateFromDuration('2026-12-01T12:00:00.000Z', '4 days');
    assert.equal(end, '2026-12-05T12:00:00.000Z');

    const hoursEnd = computeEndDateFromDuration('2026-12-01T12:00:00.000Z', '48 hours');
    assert.equal(hoursEnd, '2026-12-03T12:00:00.000Z');
  });

  it('derives clear countdown labels for upcoming, active, and ended jams', () => {
    const now = new Date('2026-11-15T12:00:00.000Z').getTime();
    assert.match(
      deriveJamCountdownLabel(
        { startDate: '2026-11-20T12:00:00.000Z', endDate: '', status: 'upcoming' },
        now
      ),
      /5 يوم/
    );
    assert.match(
      deriveJamCountdownLabel(
        {
          startDate: '2026-11-14T12:00:00.000Z',
          endDate: '2026-11-16T00:00:00.000Z',
          status: 'active',
        },
        now
      ),
      /12 ساعة/
    );
    assert.equal(
      deriveJamCountdownLabel(
        {
          startDate: '2026-11-01T12:00:00.000Z',
          endDate: '2026-11-10T12:00:00.000Z',
          status: 'ended',
        },
        now
      ),
      'انتهت المسابقة'
    );
  });
});

describe('gameJamLogic — saved jams & video collections filtering', () => {
  it('filters saved game jams by query and status', () => {
    const jams: SavedGameJam[] = [
      {
        id: 'j1',
        ownerId: 'u1',
        name: 'GMTK Game Jam',
        description: 'Build a game in 96 hours',
        startDate: '2026-12-10T10:00:00Z',
        endDate: '2026-12-14T10:00:00Z',
        status: 'upcoming',
        mode: 'online',
        location: 'أونلاين',
        theme: 'Loop',
        platform: 'itch.io',
        organizer: 'GMTK',
        officialUrl: 'https://itch.io/jam/gmtk',
        thumbnailUrl: '',
        personalNotes: 'Use Godot 4',
        linkedProjectId: '',
        linkedBoardId: '',
        resources: [],
        infoUpdatedAt: '2026-11-15T00:00:00Z',
        createdAt: '2026-11-15T00:00:00Z',
        updatedAt: '2026-11-15T00:00:00Z',
      },
      {
        id: 'j2',
        ownerId: 'u1',
        name: 'Epic AI Jam',
        description: 'Active AI game jam',
        startDate: '2026-11-10T10:00:00Z',
        endDate: '2026-11-16T10:00:00Z',
        status: 'active',
        mode: 'online',
        location: 'أونلاين',
        theme: 'AI Worlds',
        platform: 'itch.io',
        organizer: 'Epic',
        officialUrl: 'https://itch.io/jam/epic',
        thumbnailUrl: '',
        personalNotes: '',
        linkedProjectId: '',
        linkedBoardId: '',
        resources: [],
        infoUpdatedAt: '2026-11-15T00:00:00Z',
        createdAt: '2026-11-15T00:00:00Z',
        updatedAt: '2026-11-15T00:00:00Z',
      },
    ];

    assert.equal(filterSavedGameJams(jams, { searchQuery: 'godot', statusFilter: 'all' }).length, 1);
    assert.equal(filterSavedGameJams(jams, { searchQuery: '', statusFilter: 'active' }).length, 1);
  });

  it('filters multi-platform video collections and inner videos across platforms', () => {
    const collections: VideoCollection[] = [
      {
        id: 'vc1',
        ownerId: 'u1',
        title: 'حركة اللاعب في Godot',
        description: 'يوتيوب مع تيك توك وفيسبوك',
        category: 'تطوير الألعاب',
        tags: ['godot', 'movement'],
        coverImage: '',
        videos: [
          {
            id: 'v1',
            title: 'درس حركة اللاعب الكامل',
            videoUrl: 'https://www.youtube.com/watch?v=abc12345',
            platformId: 'youtube',
            platformName: 'YouTube',
            thumbnailUrl: '',
            description: '',
            notes: 'مراجعة الكود',
            completed: true,
            tags: ['2d'],
            category: 'تطوير الألعاب',
            addedAt: '2026-11-15T00:00:00Z',
          },
          {
            id: 'v2',
            title: 'خدعة سريعة للكاميرا',
            videoUrl: 'https://www.tiktok.com/@dev/video/7106594312292453675',
            platformId: 'tiktok',
            platformName: 'TikTok',
            thumbnailUrl: '',
            description: '',
            notes: '',
            completed: false,
            tags: ['camera'],
            category: 'تطوير الألعاب',
            addedAt: '2026-11-15T00:00:00Z',
          },
          {
            id: 'v3',
            title: 'مناقشة تصميم المراحل',
            videoUrl: 'https://www.facebook.com/watch/?v=1234567890',
            platformId: 'facebook',
            platformName: 'Facebook',
            thumbnailUrl: '',
            description: '',
            notes: '',
            completed: false,
            tags: ['level'],
            category: 'تطوير الألعاب',
            addedAt: '2026-11-15T00:00:00Z',
          },
        ],
        createdAt: '2026-11-15T00:00:00Z',
        updatedAt: '2026-11-15T00:00:00Z',
      },
    ];

    assert.equal(
      filterVideoCollections(collections, {
        searchQuery: 'كاميرا',
        categoryFilter: 'all',
        platformFilter: 'tiktok',
      }).length,
      1
    );
    assert.equal(
      filterVideosInsideCollection(collections[0].videos, {
        searchQuery: '',
        platformFilter: 'facebook',
        completionFilter: 'pending',
      }).length,
      1
    );
    assert.equal(
      validateVideoCollectionInput({ title: '' }) !== null,
      true
    );
    assert.equal(
      validateOrganizedVideoInput({
        title: 'TikTok Video',
        videoUrl: 'https://www.tiktok.com/@user/video/7106594312292453675',
      }),
      null
    );
    assert.ok(buildJamResourceLink('Docs', 'docs.godotengine.org'));
  });
});
