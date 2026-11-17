import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CourseItem,
  LibraryAsset,
  TodoTask,
  VaultProject,
  VaultVersion,
} from '../types/workspace';
import {
  calculateStorageSummary,
  calculateTodoStats,
  detectPbrMapSlot,
  filterAndSortTodos,
  filterCourses,
  filterLibraryAssets,
  filterVaultProjects,
  formatBytes,
  getFileCategoryKind,
  getFileExtension,
  getNextVersionLabel,
  getPreviewKind,
  inferProjectFileType,
  isGameVaultProject,
  isTodoOverdue,
  normalizeCourseProgress,
  normalizePbrMaterialSpec,
  parseTagsInput,
  validateAssetInput,
  validateCourseInput,
  validateTodoInput,
  validateVaultProjectInput,
} from './workspaceLogic';

test('formatBytes and getFileExtension format sizes and extensions cleanly', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(2048), '2.0 KB');
  assert.equal(formatBytes(1048576), '1.0 MB');
  assert.equal(getFileExtension('crate_sc07.glb'), 'GLB');
  assert.equal(getFileExtension('project.godot'), 'GODOT');
  assert.equal(getFileExtension('README'), 'FILE');
  assert.equal(getFileExtension('custom.xyz123'), 'XYZ123');
});

test('universal file categorization handles all standard and unknown formats without blocking', () => {
  assert.equal(getFileCategoryKind('level.godot'), 'project');
  assert.equal(getFileCategoryKind('backup.7z'), 'archive');
  assert.equal(getFileCategoryKind('hero.fbx'), '3d');
  assert.equal(getFileCategoryKind('albedo.exr'), 'image');
  assert.equal(getFileCategoryKind('theme.ogg'), 'audio');
  assert.equal(getFileCategoryKind('intro.mp4'), 'video');
  assert.equal(getFileCategoryKind('syllabus.pdf'), 'document');
  assert.equal(getFileCategoryKind('main.ts'), 'code');
  assert.equal(getFileCategoryKind('plugin.vsix'), 'addon');
  assert.equal(getFileCategoryKind('mystery.unknownext'), 'generic');
  assert.equal(getFileCategoryKind('Makefile'), 'generic');

  assert.equal(getPreviewKind('photo.png'), 'image');
  assert.equal(getPreviewKind('photo.exr'), 'none');
  assert.equal(getPreviewKind('voice.wav'), 'audio');
  assert.equal(getPreviewKind('clip.webm'), 'video');
  assert.equal(getPreviewKind('script.gd'), 'text');
  assert.equal(getPreviewKind('crate.glb'), '3d');
  assert.equal(getPreviewKind('mesh.obj'), '3d');
  assert.equal(getPreviewKind('mystery.xyz99'), 'none');

  assert.equal(detectPbrMapSlot('stone_albedo.png'), 'baseColor');
  assert.equal(detectPbrMapSlot('stone_normal.png'), 'normal');
  assert.equal(detectPbrMapSlot('stone_roughness.jpg'), 'roughness');
  assert.equal(detectPbrMapSlot('metal_metallic.png'), 'metallic');
  assert.equal(detectPbrMapSlot('brick_height.png'), 'height');

  const spec = normalizePbrMaterialSpec(undefined, [
    { id: 'f1', name: 'brick_baseColor.png', size: 100, mimeType: 'image/png', extension: 'PNG', blobId: 'b1', chunkCount: 1 },
    { id: 'f2', name: 'brick_normal.png', size: 100, mimeType: 'image/png', extension: 'PNG', blobId: 'b2', chunkCount: 1 },
  ]);
  assert.equal(spec.baseColorFileId, 'f1');
  assert.equal(spec.normalFileId, 'f2');
});

test('calculateStorageSummary computes vault, assets, available space, and counts accurately', () => {
  const projects: VaultProject[] = [
    {
      id: 'p1',
      ownerId: 'u1',
      name: 'P1',
      description: '',
      folder: 'ألعاب',
      fileType: 'ZIP',
      previewImage: '',
      latestVersionNumber: 2,
      latestBackupAt: '',
      createdAt: '',
      updatedAt: '',
    },
  ];
  const versionsByProject: Record<string, VaultVersion[]> = {
    p1: [
      {
        id: 'v1',
        projectId: 'p1',
        ownerId: 'u1',
        versionNumber: 1,
        versionLabel: 'v1.0',
        notes: '',
        totalSizeBytes: 3000,
        files: [
          { id: 'f1', name: 'a.zip', size: 3000, mimeType: 'application/zip', extension: 'ZIP', blobId: 'b1', chunkCount: 1 },
        ],
        createdAt: '',
        updatedAt: '',
      },
    ],
  };
  const assets: LibraryAsset[] = [
    {
      id: 'a1',
      ownerId: 'u1',
      name: 'A1',
      description: '',
      category: '3d_model',
      folder: '3D',
      tags: [],
      previewImage: '',
      fileCount: 2,
      totalSizeBytes: 2000,
      primaryExtension: 'GLB',
      files: [
        { id: 'f2', name: 'm.glb', size: 1000, mimeType: 'model/gltf-binary', extension: 'GLB', blobId: 'b2', chunkCount: 1 },
        { id: 'f3', name: 't.png', size: 1000, mimeType: 'image/png', extension: 'PNG', blobId: 'b3', chunkCount: 1 },
      ],
      createdAt: '',
      updatedAt: '',
    },
  ];

  const summary = calculateStorageSummary(projects, versionsByProject, assets, 10000);
  assert.equal(summary.vaultBytes, 3000);
  assert.equal(summary.assetsBytes, 2000);
  assert.equal(summary.totalUsedBytes, 5000);
  assert.equal(summary.availableBytes, 5000);
  assert.equal(summary.percentUsed, 50);
  assert.equal(summary.vaultFilesCount, 1);
  assert.equal(summary.assetsFilesCount, 2);
  assert.equal(summary.totalFilesCount, 3);
});

test('inferProjectFileType prioritizes project bundles and engines', () => {
  assert.equal(inferProjectFileType(['project.godot', 'player.gd']), 'GODOT');
  assert.equal(inferProjectFileType(['backup-release.zip', 'readme.txt']), 'ZIP');
  assert.equal(inferProjectFileType(['scene.blend', 'tex.png']), 'BLENDER');
  assert.equal(inferProjectFileType([]), 'ARCHIVE');
});

test('parseTagsInput deduplicates comma and Arabic-comma separated tags up to 15', () => {
  assert.deepEqual(
    parseTagsInput('3D, sci-fi، game prop, 3d ,  textures '),
    ['3D', 'sci-fi', 'game prop', 'textures']
  );
  const twentyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`).join(',');
  assert.equal(parseTagsInput(twentyTags).length, 15);
});

test('filterVaultProjects filters by folder and search query across name/type/description', () => {
  const projects: VaultProject[] = [
    {
      id: 'p1',
      ownerId: 'u1',
      name: 'لعبة المنصات',
      description: 'مشروع محرك غودوت ثنائي الأبعاد',
      folder: 'مشاريع الألعاب',
      fileType: 'GODOT',
      previewImage: '',
      latestVersionNumber: 2,
      latestBackupAt: '2026-11-14T08:00:00Z',
      createdAt: '2026-11-10T08:00:00Z',
      updatedAt: '2026-11-14T08:00:00Z',
    },
    {
      id: 'p2',
      ownerId: 'u1',
      name: 'منصة تعليمية',
      description: 'كود React و Tailwind',
      folder: 'تطبيقات الويب',
      fileType: 'ZIP',
      previewImage: '',
      latestVersionNumber: 1,
      latestBackupAt: '2026-11-12T08:00:00Z',
      createdAt: '2026-11-12T08:00:00Z',
      updatedAt: '2026-11-12T08:00:00Z',
    },
  ];

  assert.equal(filterVaultProjects(projects, '', 'all').length, 2);
  assert.equal(filterVaultProjects(projects, '', 'مشاريع الألعاب').length, 1);
  assert.equal(filterVaultProjects(projects, 'godot', 'all')[0].id, 'p1');
  assert.equal(filterVaultProjects(projects, 'React', 'تطبيقات الويب')[0].id, 'p2');
  assert.equal(isGameVaultProject(projects[0]), true);
  assert.equal(isGameVaultProject(projects[1]), false);
  assert.equal(filterVaultProjects(projects, '', 'all', 'games').length, 1);
  assert.equal(filterVaultProjects(projects, '', 'all', 'web').length, 1);
});

test('filterLibraryAssets filters by category, folder, tags, and attached filenames', () => {
  const assets: LibraryAsset[] = [
    {
      id: 'a1',
      ownerId: 'u1',
      name: 'صندوق إمداد خيال علمي',
      description: 'نموذج جاهز للألعاب',
      category: '3d_model',
      folder: 'أدوات الشخصيات والبيئة',
      tags: ['sci-fi', 'crate'],
      previewImage: '',
      fileCount: 2,
      totalSizeBytes: 2048,
      primaryExtension: 'GLB',
      files: [
        {
          id: 'f1',
          name: 'crate_sc07.glb',
          size: 1024,
          mimeType: 'model/gltf-binary',
          extension: 'GLB',
          blobId: 'b1',
          chunkCount: 1,
        },
      ],
      createdAt: '2026-11-14T08:00:00Z',
      updatedAt: '2026-11-14T08:00:00Z',
    },
  ];

  assert.equal(filterLibraryAssets(assets, '', '3d_model', 'all')[0].id, 'a1');
  assert.equal(filterLibraryAssets(assets, 'crate_sc07.glb', 'all', 'all')[0].id, 'a1');
  assert.equal(filterLibraryAssets(assets, 'pbr', '3d_model', 'all').length, 0);
});

test('To-Do logic sorts pending by priority and due date, separates completed, and computes stats', () => {
  const todos: TodoTask[] = [
    {
      id: 't1',
      ownerId: 'u1',
      title: 'مهمة عادية',
      description: '',
      priority: 'low',
      dueDate: '2026-11-10',
      completed: false,
      completedAt: '',
      link: { type: 'none', targetId: '', parentId: '', label: '' },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-01T10:00:00Z',
    },
    {
      id: 't2',
      ownerId: 'u1',
      title: 'إنهاء فيديو البرمجة التالي',
      description: 'الخطوة الثانية',
      priority: 'high',
      dueDate: '2026-11-20',
      completed: false,
      completedAt: '',
      link: { type: 'learning_path', targetId: 'p1', parentId: '', label: 'مسار البرمجة' },
      createdAt: '2026-11-02T10:00:00Z',
      updatedAt: '2026-11-02T10:00:00Z',
    },
    {
      id: 't3',
      ownerId: 'u1',
      title: 'مهمة مكتملة',
      description: '',
      priority: 'medium',
      dueDate: '',
      completed: true,
      completedAt: '2026-11-12T10:00:00Z',
      link: { type: 'course', targetId: 'c1', parentId: '', label: 'كورس React' },
      createdAt: '2026-11-01T10:00:00Z',
      updatedAt: '2026-11-12T10:00:00Z',
    },
  ];

  const { pending, completed } = filterAndSortTodos(todos, {
    searchQuery: '',
    priorityFilter: 'all',
    linkTypeFilter: 'all',
  });
  assert.deepEqual(
    pending.map((t) => t.id),
    ['t2', 't1']
  );
  assert.deepEqual(
    completed.map((t) => t.id),
    ['t3']
  );

  assert.equal(isTodoOverdue(todos[0], '2026-11-15'), true);
  assert.equal(isTodoOverdue(todos[1], '2026-11-15'), false);
  assert.equal(isTodoOverdue(todos[2], '2026-11-15'), false);

  const stats = calculateTodoStats(todos, '2026-11-15');
  assert.equal(stats.total, 3);
  assert.equal(stats.pendingCount, 2);
  assert.equal(stats.completedCount, 1);
  assert.equal(stats.highPriorityPendingCount, 1);
  assert.equal(stats.overdueCount, 1);
  assert.equal(stats.completionPercent, 33);
  assert.ok(validateTodoInput({ title: '  ' }));
  assert.equal(validateTodoInput({ title: 'مهمة جديدة' }), null);
});

test('Course logic validates URLs, normalizes progress, and filters courses', () => {
  assert.ok(validateCourseInput({ title: '', url: 'https://youtube.com' }));
  assert.ok(validateCourseInput({ title: 'React', url: 'not-a-domain' }));
  assert.equal(validateCourseInput({ title: 'React', url: 'youtube.com/watch?v=123' }), null);

  assert.deepEqual(normalizeCourseProgress(120), { progressPercent: 100, statusHint: 'completed' });
  assert.deepEqual(normalizeCourseProgress(45), { progressPercent: 45, statusHint: undefined });

  const courses: CourseItem[] = [
    {
      id: 'c1',
      ownerId: 'u1',
      title: 'تعلم Python من الصفر',
      url: 'https://example.com/py',
      thumbnailUrl: '',
      description: 'أساسيات بايثون',
      platform: 'YouTube',
      category: 'البرمجة وتطوير الويب',
      status: 'active',
      progressPercent: 40,
      linkedPathId: '',
      videos: [],
      createdAt: '',
      updatedAt: '',
    },
  ];
  assert.equal(
    filterCourses(courses, { searchQuery: 'python', statusFilter: 'active', categoryFilter: 'all' })
      .length,
    1
  );
  assert.equal(
    filterCourses(courses, { searchQuery: '', statusFilter: 'completed', categoryFilter: 'all' })
      .length,
    0
  );
});

test('validation and version labels reject invalid empty payloads cleanly', () => {
  assert.equal(getNextVersionLabel(3), 'v3.0');
  assert.ok(validateVaultProjectInput({ name: ' ', folder: 'ألعاب', hasFiles: true, requiresFiles: true }));
  assert.ok(validateVaultProjectInput({ name: 'مشروعي', folder: 'ألعاب', hasFiles: false, requiresFiles: true }));
  assert.equal(validateVaultProjectInput({ name: 'مشروعي', folder: 'ألعاب', hasFiles: false, requiresFiles: false }), null);
  assert.ok(validateAssetInput({ name: 'نموذج', folder: 'نماذج', hasFiles: false, requiresFiles: true }));
  assert.equal(validateAssetInput({ name: 'نموذج', folder: 'نماذج', hasFiles: true, requiresFiles: true }), null);
});
