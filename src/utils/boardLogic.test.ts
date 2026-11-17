import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LearningPath, VideoStep } from '../types/learning';
import type { BoardCard, BoardConnection, CourseItem, LearningBoard } from '../types/workspace';
import {
  BOARD_MAX_CARDS,
  bringCardForward,
  buildCardsFromCourse,
  buildCardsFromLearningPath,
  buildSmoothSvgPath,
  clampZoom,
  computeConnectionGeometry,
  computeFitViewport,
  computeInitialImageDimensions,
  createImageBoardCard,
  createTodoWidgetBoardCard,
  createVideoBoardCard,
  duplicateBoardCard,
  findHitDrawingStrokes,
  getStrokeBoundingBox,
  hitTestDrawingStroke,
  isSupportedBoardImageFile,
  normalizeRotationDeg,
  pushBoardHistory,
  redoBoardHistory,
  sanitizeLearningBoard,
  screenToBoardPoint,
  sendCardBackward,
  simplifyStrokePoints,
  translateDrawingStroke,
  undoBoardHistory,
  validateBoardVideoInput,
} from './boardLogic';

describe('boardLogic pure canvas & workflow helpers', () => {
  it('converts screen coordinates accurately under zoom and pan', () => {
    const pt = screenToBoardPoint(
      450,
      300,
      { left: 50, top: 100 },
      { panX: 100, panY: 50, zoom: 1.5 }
    );
    assert.equal(Math.round(pt.x), 200);
    assert.equal(Math.round(pt.y), 100);
    assert.equal(clampZoom(10), 2);
    assert.equal(clampZoom(0.1), 0.35);
  });

  it('validates video input and extracts YouTube thumbnail & source automatically', () => {
    assert.ok(validateBoardVideoInput({ title: '', videoUrl: 'https://youtu.be/SqcY0GlETPk' }));
    assert.ok(validateBoardVideoInput({ title: 'درس', videoUrl: 'not a valid url' }));
    assert.equal(
      validateBoardVideoInput({ title: 'تعلم Godot', videoUrl: 'https://youtu.be/LOhfqjmasi0' }),
      null
    );

    const card = createVideoBoardCard(
      {
        title: 'Learn Godot Basics',
        videoUrl: 'https://www.youtube.com/watch?v=LOhfqjmasi0',
      },
      { x: 120, y: 80 }
    );
    assert.equal(card.kind, 'video');
    assert.equal(card.sourceLabel, 'YouTube');
    assert.equal(card.thumbnailUrl, 'https://i.ytimg.com/vi/LOhfqjmasi0/hqdefault.jpg');
    assert.equal(card.x, 120);
    assert.equal(card.y, 80);
  });

  it('builds sequentially connected cards from CourseItem and LearningPath', () => {
    const course: CourseItem = {
      id: 'course_1',
      ownerId: 'u1',
      title: 'كورس React',
      url: 'https://youtube.com/playlist?list=123',
      thumbnailUrl: '/thumb.jpg',
      description: 'وصف',
      platform: 'YouTube',
      category: 'البرمجة',
      status: 'active',
      progressPercent: 25,
      linkedPathId: '',
      videos: [
        { id: 'v1', title: 'المكونات', videoUrl: 'https://youtu.be/SqcY0GlETPk', duration: '10:00' },
        { id: 'v2', title: 'الحالة Hooks', videoUrl: 'https://youtu.be/TNhaISOUy6Q', duration: '15:00' },
      ],
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    };

    const courseBuild = buildCardsFromCourse(course, []);
    assert.equal(courseBuild.cards.length, 2);
    assert.equal(courseBuild.connections.length, 1);
    assert.equal(courseBuild.connections[0].fromCardId, courseBuild.cards[0].id);
    assert.equal(courseBuild.connections[0].toCardId, courseBuild.cards[1].id);

    const path: LearningPath = {
      id: 'p1',
      ownerId: 'u1',
      title: 'مسار الويب',
      description: '',
      coverImage: '',
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    };
    const steps: VideoStep[] = [
      {
        id: 's1',
        pathId: 'p1',
        ownerId: 'u1',
        title: 'الدرس الأول',
        description: '',
        videoUrl: 'https://youtu.be/SqcY0GlETPk',
        thumbnailUrl: '',
        order: 0,
        completed: true,
        completedAt: '2026-11-14T00:00:00Z',
        targetDate: '',
        quickNotes: 'ملاحظة مهمة',
        quickNotesUpdatedAt: '',
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T00:00:00Z',
      },
      {
        id: 's2',
        pathId: 'p1',
        ownerId: 'u1',
        title: 'الدرس الثاني',
        description: '',
        videoUrl: 'https://youtu.be/TNhaISOUy6Q',
        thumbnailUrl: '',
        order: 1,
        completed: false,
        completedAt: '',
        targetDate: '',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: '2026-11-14T00:00:00Z',
        updatedAt: '2026-11-14T00:00:00Z',
      },
    ];

    const pathBuild = buildCardsFromLearningPath(path, steps, []);
    assert.equal(pathBuild.cards.length, 2);
    assert.equal(pathBuild.cards[0].completed, true);
    assert.equal(pathBuild.cards[0].noteText, 'ملاحظة مهمة');
    assert.equal(pathBuild.connections.length, 1);
  });

  it('computes clean edge connection geometry and fit viewport', () => {
    const vCard = createVideoBoardCard(
      { title: 'فيديو 1', videoUrl: 'https://youtu.be/SqcY0GlETPk' },
      { x: 50, y: 100 }
    );
    const tCard = createTodoWidgetBoardCard(
      { title: 'مهام التطبيق', attachedToCardId: vCard.id },
      { x: 450, y: 120 }
    );
    const geom = computeConnectionGeometry(vCard, tCard);
    assert.equal(geom.x1, vCard.x + vCard.width);
    assert.equal(geom.x2, tCard.x);
    assert.ok(geom.pathD.startsWith('M '));

    const fit = computeFitViewport([vCard, tCard], 1000, 600);
    assert.ok(fit.zoom > 0.35 && fit.zoom <= 1);
  });

  it('supports undo and redo history snapshots across cards and drawings', () => {
    const c1 = createVideoBoardCard({ title: 'A', videoUrl: 'https://youtu.be/SqcY0GlETPk' }, { x: 10, y: 10 });
    const c2 = createVideoBoardCard({ title: 'B', videoUrl: 'https://youtu.be/TNhaISOUy6Q' }, { x: 400, y: 10 });
    const stroke1 = {
      id: 'stroke_1',
      tool: 'pen' as const,
      color: '#B92622',
      size: 4,
      opacity: 1,
      points: [{ x: 10, y: 10 }, { x: 50, y: 50 }],
    };

    const snap0 = { cards: [c1], connections: [] as BoardConnection[], drawings: [] };
    let history = pushBoardHistory({ past: [], future: [] }, snap0);
    const snap1 = { cards: [c1, c2], connections: [] as BoardConnection[], drawings: [stroke1] };

    const undone = undoBoardHistory(history, snap1);
    assert.ok(undone);
    assert.equal(undone.restored.cards.length, 1);
    assert.equal(undone.restored.drawings.length, 0);
    history = undone.nextHistory;

    const redone = redoBoardHistory(history, undone.restored);
    assert.ok(redone);
    assert.equal(redone.restored.cards.length, 2);
    assert.equal(redone.restored.drawings.length, 1);
  });

  it('validates supported image formats, creates, duplicates, rotates, and layers image cards', () => {
    assert.equal(isSupportedBoardImageFile({ name: 'diagram.png', type: 'image/png' }), true);
    assert.equal(isSupportedBoardImageFile({ name: 'photo.JPEG', type: 'image/jpeg' }), true);
    assert.equal(isSupportedBoardImageFile({ name: 'anim.gif', type: 'image/gif' }), true);
    assert.equal(isSupportedBoardImageFile({ name: 'asset.webp', type: 'image/webp' }), true);
    assert.equal(isSupportedBoardImageFile({ name: 'doc.pdf', type: 'application/pdf' }), false);

    const dims = computeInitialImageDimensions(1920, 1080);
    assert.ok(dims.width >= 240 && dims.width <= 340);
    assert.ok(dims.height < dims.width);

    assert.equal(normalizeRotationDeg(270), -90);
    assert.equal(normalizeRotationDeg(45), 45);

    const fileRef = {
      id: 'file_1',
      name: 'level_design.png',
      size: 12000,
      mimeType: 'image/png',
      extension: 'PNG',
      blobId: 'blob_1',
      chunkCount: 1,
    };

    const img1 = createImageBoardCard(
      {
        title: 'مخطط المرحلة',
        thumbnailUrl: 'data:image/jpeg;base64,abc',
        originalFileRef: fileRef,
        width: 300,
        height: 180,
        zIndex: 2,
      },
      { x: 100, y: 120 }
    );
    assert.equal(img1.kind, 'image');
    assert.equal(img1.originalFileRef?.blobId, 'blob_1');

    const img2 = duplicateBoardCard(img1, [img1]);
    assert.notEqual(img2.id, img1.id);
    assert.equal(img2.x, 136);
    assert.equal(img2.y, 156);
    assert.equal(img2.originalFileRef?.blobId, 'blob_1');
    assert.ok((img2.zIndex || 0) > (img1.zIndex || 0));

    const brought = bringCardForward([img1, img2], img1.id);
    assert.ok((brought[0].zIndex || 0) > (brought[1].zIndex || 0));

    const sent = sendCardBackward(brought, img1.id);
    assert.equal(sent[0].zIndex, 0);
  });

  it('simplifies, smooths, hit-tests, and translates drawing strokes cleanly', () => {
    const raw = [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 50, y: 0 },
      { x: 100, y: 40 },
    ];
    const simplified = simplifyStrokePoints(raw, 2.5);
    assert.equal(simplified.length, 3);

    const path = buildSmoothSvgPath(simplified);
    assert.ok(path.startsWith('M 0 0 Q '));

    const stroke = {
      id: 's1',
      tool: 'highlighter' as const,
      color: '#D97706',
      size: 18,
      opacity: 0.42,
      points: simplified,
    };

    assert.equal(hitTestDrawingStroke(stroke, 25, 2, 6), true);
    assert.equal(hitTestDrawingStroke(stroke, 400, 400, 6), false);
    assert.deepEqual(findHitDrawingStrokes([stroke], 50, 0, 10), ['s1']);

    const moved = translateDrawingStroke(stroke, 20, -10);
    assert.equal(moved.points[0].x, 20);
    assert.equal(moved.points[0].y, -10);

    const box = getStrokeBoundingBox(moved);
    assert.ok(box && box.maxX > box.minX && box.maxY > box.minY);
  });

  it('sanitizes orphan connections and clamps board limits and drawings on persistence', () => {
    const cards: BoardCard[] = Array.from({ length: BOARD_MAX_CARDS + 5 }, (_, i) =>
      createVideoBoardCard(
        { title: `Video ${i}`, videoUrl: 'https://youtu.be/SqcY0GlETPk' },
        { x: i * 10, y: 0 }
      )
    );
    const board: LearningBoard = {
      id: 'board_1',
      ownerId: 'u1',
      title: '   ',
      description: 'desc',
      cards,
      connections: [
        { id: 'c1', fromCardId: cards[0].id, toCardId: cards[1].id, label: 'ok', color: 'crimson' },
        { id: 'c2', fromCardId: cards[0].id, toCardId: 'missing_id', label: 'orphan', color: 'navy' },
        { id: 'c3', fromCardId: cards[0].id, toCardId: cards[0].id, label: 'self', color: 'amber' },
      ],
      drawings: [
        {
          id: 'd1',
          tool: 'pen',
          color: '#B92622',
          size: 200,
          opacity: 5,
          points: [{ x: 10, y: 20 }, { x: 40, y: 50 }],
        },
        {
          id: 'd_empty',
          tool: 'pen',
          color: '#000',
          size: 4,
          opacity: 1,
          points: [],
        },
      ],
      viewport: { panX: 0, panY: 0, zoom: 99 },
      createdAt: '2026-11-14T00:00:00Z',
      updatedAt: '2026-11-14T00:00:00Z',
    };

    const clean = sanitizeLearningBoard(board);
    assert.equal(clean.cards.length, BOARD_MAX_CARDS);
    assert.equal(clean.connections.length, 1);
    assert.equal(clean.connections[0].id, 'c1');
    assert.equal(clean.drawings.length, 1);
    assert.equal(clean.drawings[0].size, 64);
    assert.equal(clean.drawings[0].opacity, 1);
    assert.equal(clean.title, 'لوحة تعلم جديدة');
    assert.equal(clean.viewport.zoom, 2);
  });
});
