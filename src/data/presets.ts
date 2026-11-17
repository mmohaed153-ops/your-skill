import assetCrateImg from '../assets/images/asset_3d_sci_fi_crate_1794676128367.jpg';
import assetStoneImg from '../assets/images/asset_pbr_stone_texture_1794676128636.jpg';
import assetPotionImg from '../assets/images/asset_pixel_potion_pack_1794676129873.jpg';
import courseCreativeImg from '../assets/images/course_creative_3d_1794746853637.jpg';
import courseLanguagesImg from '../assets/images/course_languages_science_1794746845956.jpg';
import courseProgrammingImg from '../assets/images/course_programming_1794746846756.jpg';
import coverUiDesignImg from '../assets/images/cover_ui_design_1794668549110.jpg';
import coverWebDevImg from '../assets/images/cover_web_dev_1794668548960.jpg';
import thumbDataStructuresImg from '../assets/images/thumb_data_structures_1794668548715.jpg';
import thumbReactBasicsImg from '../assets/images/thumb_react_basics_1794668550211.jpg';
import vaultGodotImg from '../assets/images/vault_godot_platformer_1794676127355.jpg';
import type { LearningPath, VideoStep } from '../types/learning';
import type {
  CourseItem,
  LearningBoard,
  LibraryAsset,
  TodoTask,
  VaultProject,
  VaultVersion,
  WorkspaceNote,
} from '../types/workspace';

const LEGACY_MEDIA_MAP: Record<string, string> = {
  '/src/assets/images/asset_3d_sci_fi_crate_1794676128367.jpg': assetCrateImg,
  '/src/assets/images/asset_pbr_stone_texture_1794676128636.jpg': assetStoneImg,
  '/src/assets/images/asset_pixel_potion_pack_1794676129873.jpg': assetPotionImg,
  '/src/assets/images/course_creative_3d_1794746853637.jpg': courseCreativeImg,
  '/src/assets/images/course_languages_science_1794746845956.jpg': courseLanguagesImg,
  '/src/assets/images/course_programming_1794746846756.jpg': courseProgrammingImg,
  '/src/assets/images/cover_ui_design_1794668549110.jpg': coverUiDesignImg,
  '/src/assets/images/cover_web_dev_1794668548960.jpg': coverWebDevImg,
  '/src/assets/images/thumb_data_structures_1794668548715.jpg': thumbDataStructuresImg,
  '/src/assets/images/thumb_react_basics_1794668550211.jpg': thumbReactBasicsImg,
  '/src/assets/images/vault_godot_platformer_1794676127355.jpg': vaultGodotImg,
};

const BUNDLED_ART_SRCS = new Set<string>([
  assetCrateImg,
  assetStoneImg,
  assetPotionImg,
  courseCreativeImg,
  courseLanguagesImg,
  courseProgrammingImg,
  coverUiDesignImg,
  coverWebDevImg,
  thumbDataStructuresImg,
  thumbReactBasicsImg,
  vaultGodotImg,
]);

export function isBundledArtwork(src?: string | null): boolean {
  const clean = (src || '').trim();
  if (!clean) return false;
  if (BUNDLED_ART_SRCS.has(clean)) return true;
  if (LEGACY_MEDIA_MAP[clean]) return true;
  if (clean.includes('/src/assets/images/')) return true;
  return false;
}

export function resolveMediaUrl(src?: string | null, fallback = ''): string {
  const clean = (src || '').trim();
  if (!clean) return fallback;
  if (isBundledArtwork(clean)) return '';
  return clean;
}

export interface ImagePreset {
  id: string;
  label: string;
  src: string;
}

export const COVER_PRESETS: ImagePreset[] = [
  {
    id: 'cover_web_dev',
    label: 'مسار البرمجة وتطوير الويب',
    src: coverWebDevImg,
  },
  {
    id: 'cover_ui_design',
    label: 'مسار التصميم وهندسة الواجهات',
    src: coverUiDesignImg,
  },
];

export const THUMBNAIL_PRESETS: ImagePreset[] = [
  {
    id: 'thumb_react_basics',
    label: 'مكونات وتدفق البيانات',
    src: thumbReactBasicsImg,
  },
  {
    id: 'thumb_data_structures',
    label: 'خريطة المفاهيم والخطوات',
    src: thumbDataStructuresImg,
  },
  {
    id: 'thumb_web_studio',
    label: 'بيئة التطبيق العملي',
    src: coverWebDevImg,
  },
  {
    id: 'thumb_design_grid',
    label: 'تخطيط الشبكة والتصميم',
    src: coverUiDesignImg,
  },
];

export const VAULT_PREVIEW_PRESETS: ImagePreset[] = [
  {
    id: 'vault_godot',
    label: 'مشروع لعبة منصات (Godot)',
    src: vaultGodotImg,
  },
  {
    id: 'vault_web',
    label: 'مشروع تطوير الويب',
    src: coverWebDevImg,
  },
  {
    id: 'vault_ui',
    label: 'ملفات التصميم والواجهات',
    src: coverUiDesignImg,
  },
  {
    id: 'vault_architecture',
    label: 'نظام ومخطط المشروع',
    src: thumbReactBasicsImg,
  },
];

export const ASSET_PREVIEW_PRESETS: ImagePreset[] = [
  {
    id: 'asset_crate',
    label: 'نموذج صندوق إمداد 3D',
    src: assetCrateImg,
  },
  {
    id: 'asset_stone',
    label: 'خامة أرضية حجرية PBR',
    src: assetStoneImg,
  },
  {
    id: 'asset_potions',
    label: 'حزمة عناصر وأيقونات اللعبة',
    src: assetPotionImg,
  },
  {
    id: 'asset_workspace',
    label: 'ملحق وأدوات تطوير',
    src: vaultGodotImg,
  },
];

export const COURSE_COVER_PRESETS: ImagePreset[] = [
  {
    id: 'course_programming',
    label: 'البرمجة وتطوير البرمجيات',
    src: courseProgrammingImg,
  },
  {
    id: 'course_languages_science',
    label: 'اللغات والعلوم والمعارف',
    src: courseLanguagesImg,
  },
  {
    id: 'course_creative_3d',
    label: 'الألعاب والنمذجة والتصميم 3D',
    src: courseCreativeImg,
  },
  {
    id: 'course_ui',
    label: 'تصميم الواجهات وتجربة المستخدم',
    src: coverUiDesignImg,
  },
];

export function createStarterData(): {
  paths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
} {
  const now = '2026-11-14T08:00:00.000Z';

  const paths: LearningPath[] = [
    {
      id: 'path_web_foundations',
      ownerId: 'local',
      title: 'مسار تطوير واجهات الويب التفاعلية',
      description:
        'خطة منظمة لتعلم بناء تطبيقات الويب الحديثة خطوة بخطوة من الأساسيات حتى التطبيق العملي.',
      coverImage: '',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'path_ui_craft',
      ownerId: 'local',
      title: 'أساسيات تصميم تجربة المستخدم UI/UX',
      description:
        'فيديوهات مختارة لفهم التباين البصري، الشبكات، وتجربة المستخدم العربية المتكاملة.',
      coverImage: '',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const stepsByPath: Record<string, VideoStep[]> = {
    path_web_foundations: [
      {
        id: 'step_web_1',
        pathId: 'path_web_foundations',
        ownerId: 'local',
        title: 'مقدمة في بناء المكونات التفاعلية (React Components)',
        description:
          'فهم طريقة تقسيم الواجهة إلى مكونات قابلة لإعادة الاستخدام وتمرير الخصائص بوضوح.',
        videoUrl: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
        thumbnailUrl: 'https://i.ytimg.com/vi/SqcY0GlETPk/hqdefault.jpg',
        order: 0,
        completed: true,
        completedAt: '2026-11-13T18:30:00.000Z',
        targetDate: '2026-11-13',
        quickNotes:
          'تمت مراجعة مفهوم تمرير الخصائص (Props) وفصل المكونات الصغيرة لتسهيل إعادة الاستخدام.',
        quickNotesUpdatedAt: '2026-11-13T18:25:00.000Z',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'step_web_2',
        pathId: 'path_web_foundations',
        ownerId: 'local',
        title: 'إدارة الحالة والتفاعلات اليومية مع الخطافات (Hooks)',
        description:
          'تطبيق عملي على useState و useEffect لبناء نماذج ذكية تحفظ تقدم المتعلم تلقائياً.',
        videoUrl: 'https://www.youtube.com/watch?v=TNhaISOUy6Q',
        thumbnailUrl: 'https://i.ytimg.com/vi/TNhaISOUy6Q/hqdefault.jpg',
        order: 1,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-14',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'step_web_3',
        pathId: 'path_web_foundations',
        ownerId: 'local',
        title: 'تنسيق الواجهات المتجاوبة ودعم الاتجاه العربي RTL',
        description:
          'ضبط الهوامش المنطقية، التدرج البصري، وتوافق الشاشات المكتبية والمحمولة باستخدام Tailwind.',
        videoUrl: 'https://www.youtube.com/watch?v=mr15Xzb1Ook',
        thumbnailUrl: 'https://i.ytimg.com/vi/mr15Xzb1Ook/hqdefault.jpg',
        order: 2,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-15',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'step_web_4',
        pathId: 'path_web_foundations',
        ownerId: 'local',
        title: 'ربط التطبيق بقاعدة البيانات السحابية وحفظ التقدم',
        description:
          'حفظ المسارات التعليمية وحالة إتمام كل فيديو في حساب المستخدم بشكل آمن ومستمر.',
        videoUrl: 'https://www.youtube.com/watch?v=9zdvmgGsww0',
        thumbnailUrl: 'https://i.ytimg.com/vi/9zdvmgGsww0/hqdefault.jpg',
        order: 3,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-16',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
    path_ui_craft: [
      {
        id: 'step_ui_1',
        pathId: 'path_ui_craft',
        ownerId: 'local',
        title: 'مبادئ التسلسل الهرمي البصري وتوازن المساحات',
        description:
          'كيف توجه عين المتعلم نحو الإجراء الأساسي دون ازدحام بصري.',
        videoUrl: 'https://www.youtube.com/watch?v=_2LLXnUdUIc',
        thumbnailUrl: 'https://i.ytimg.com/vi/_2LLXnUdUIc/hqdefault.jpg',
        order: 0,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-14',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'step_ui_2',
        pathId: 'path_ui_craft',
        ownerId: 'local',
        title: 'اختيار الخطوط العربية والتباين اللوني المريح للعين',
        description:
          'قواعد 60-30-10 للألوان واختيار أوزان الخط المناسبة للقراءة الطويلة.',
        videoUrl: 'https://www.youtube.com/watch?v=AvgCkHrcj8w',
        thumbnailUrl: 'https://i.ytimg.com/vi/AvgCkHrcj8w/hqdefault.jpg',
        order: 1,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-15',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'step_ui_3',
        pathId: 'path_ui_craft',
        ownerId: 'local',
        title: 'تصميم بطاقات الدروس وتدفق الخطوات التفاعلية',
        description:
          'بناء تجربة تعلم محفزة تبرز الإنجاز وتساعد المتعلم على الاستمرار يومياً.',
        videoUrl: 'https://www.youtube.com/watch?v=wIuVvCuiJhU',
        thumbnailUrl: 'https://i.ytimg.com/vi/wIuVvCuiJhU/hqdefault.jpg',
        order: 2,
        completed: false,
        completedAt: '',
        targetDate: '2026-11-16',
        quickNotes: '',
        quickNotesUpdatedAt: '',
        createdAt: now,
        updatedAt: now,
      },
    ],
  };

  return { paths, stepsByPath };
}

export async function compressImageToDataUrl(
  file: File,
  maxWidth = 800,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة ملف الصورة.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('ملف الصورة غير صالح.'));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / Math.max(img.width, 1));
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة الصورة في المتصفح.'));
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length > 340000) {
          resolve(canvas.toDataURL('image/jpeg', 0.55));
        } else {
          resolve(dataUrl);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function createStarterVaultData(): {
  projects: VaultProject[];
  versionsByProject: Record<string, VaultVersion[]>;
} {
  const created = '2026-11-10T10:15:00.000Z';
  const latest = '2026-11-14T08:40:00.000Z';

  const projects: VaultProject[] = [
    {
      id: 'vault_platformer_quest',
      ownerId: 'local',
      name: 'لعبة المغامرة ثنائية الأبعاد (Godot 4)',
      description:
        'نسخة احتياطية كاملة تضم إعدادات المشروع ومخطط اللاعب ومشهد المرحلة الأولى بعد ضبط الفيزياء.',
      folder: 'مشاريع الألعاب',
      fileType: 'GODOT',
      previewImage: '',
      latestVersionNumber: 2,
      latestBackupAt: latest,
      createdAt: created,
      updatedAt: latest,
    },
    {
      id: 'vault_web_portal',
      ownerId: 'local',
      name: 'تطبيق المنصة التعليمية العربية',
      description:
        'حزمة الكود المصدري وتنسيقات الواجهة المتجاوبة مع ملفات الإعداد الأساسية للرجوع السريع عند الطوارئ.',
      folder: 'تطبيقات الويب',
      fileType: 'ZIP',
      previewImage: '',
      latestVersionNumber: 1,
      latestBackupAt: '2026-11-12T16:20:00.000Z',
      createdAt: '2026-11-12T16:20:00.000Z',
      updatedAt: '2026-11-12T16:20:00.000Z',
    },
  ];

  const versionsByProject: Record<string, VaultVersion[]> = {
    vault_platformer_quest: [
      {
        id: 'ver_platformer_2',
        projectId: 'vault_platformer_quest',
        ownerId: 'local',
        versionNumber: 2,
        versionLabel: 'v2.0',
        notes: 'نسخة مستقرة بعد إصلاح حركة القفز وحفظ تقدم اللاعب.',
        totalSizeBytes: 24800,
        files: [
          {
            id: 'vf_godot_cfg_2',
            name: 'project.godot',
            size: 4200,
            mimeType: 'text/plain',
            extension: 'GODOT',
            blobId: 'starter_vault_godot_cfg_2',
            chunkCount: 1,
          },
          {
            id: 'vf_player_gd_2',
            name: 'player_controller.gd',
            size: 11400,
            mimeType: 'text/plain',
            extension: 'GD',
            blobId: 'starter_vault_player_gd_2',
            chunkCount: 1,
          },
          {
            id: 'vf_level_tscn_2',
            name: 'level_01.tscn',
            size: 9200,
            mimeType: 'text/plain',
            extension: 'TSCN',
            blobId: 'starter_vault_level_2',
            chunkCount: 1,
          },
        ],
        createdAt: latest,
        updatedAt: latest,
      },
      {
        id: 'ver_platformer_1',
        projectId: 'vault_platformer_quest',
        ownerId: 'local',
        versionNumber: 1,
        versionLabel: 'v1.0',
        notes: 'النسخة الأولية للمشروع قبل إضافة العقبات المتحركة.',
        totalSizeBytes: 15600,
        files: [
          {
            id: 'vf_godot_cfg_1',
            name: 'project.godot',
            size: 3800,
            mimeType: 'text/plain',
            extension: 'GODOT',
            blobId: 'starter_vault_godot_cfg_1',
            chunkCount: 1,
          },
          {
            id: 'vf_player_gd_1',
            name: 'player_controller.gd',
            size: 11800,
            mimeType: 'text/plain',
            extension: 'GD',
            blobId: 'starter_vault_player_gd_1',
            chunkCount: 1,
          },
        ],
        createdAt: created,
        updatedAt: created,
      },
    ],
    vault_web_portal: [
      {
        id: 'ver_web_1',
        projectId: 'vault_web_portal',
        ownerId: 'local',
        versionNumber: 1,
        versionLabel: 'v1.0',
        notes: 'لقطة كاملة قبل ترقية الواجهة إلى نظام الجداول والبطاقات.',
        totalSizeBytes: 64200,
        files: [
          {
            id: 'vf_web_zip_1',
            name: 'web-portal-backup-v1.zip',
            size: 64200,
            mimeType: 'application/zip',
            extension: 'ZIP',
            blobId: 'starter_vault_web_zip_1',
            chunkCount: 1,
          },
        ],
        createdAt: '2026-11-12T16:20:00.000Z',
        updatedAt: '2026-11-12T16:20:00.000Z',
      },
    ],
  };

  return { projects, versionsByProject };
}

export function createStarterAssetsData(): LibraryAsset[] {
  const now = '2026-11-14T08:30:00.000Z';
  return [
    {
      id: 'asset_crate_sc07',
      ownerId: 'local',
      name: 'صندوق إمداد خيال علمي SC-07',
      description:
        'نموذج ثلاثي الأبعاد جاهز للاستخدام في الألعاب مع ملفات المجسم والخامات الأساسية بصيغة glTF.',
      category: '3d_model',
      folder: 'أدوات الشخصيات والبيئة',
      tags: ['3D', 'sci-fi', 'crate', 'gltf'],
      previewImage: '',
      fileCount: 2,
      totalSizeBytes: 42500,
      primaryExtension: 'GLTF',
      files: [
        {
          id: 'af_crate_gltf',
          name: 'crate_sc07.gltf',
          size: 28500,
          mimeType: 'model/gltf+json',
          extension: 'GLTF',
          blobId: 'starter_asset_crate_gltf',
          chunkCount: 1,
        },
        {
          id: 'af_crate_mat',
          name: 'crate_materials.json',
          size: 14000,
          mimeType: 'application/json',
          extension: 'JSON',
          blobId: 'starter_asset_crate_mat',
          chunkCount: 1,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'asset_dungeon_stone',
      ownerId: 'local',
      name: 'مادة أرضية حجرية متصلة (PBR Material)',
      description:
        'مادة حجرية قابلة للتكرار مع خصائص PBR (اللون، الخشونة، المعدنية، وخرائط السطح) للمعاينة المباشرة ثلاثية الأبعاد.',
      category: 'material',
      folder: 'خامات ومواد PBR',
      tags: ['PBR', 'stone', 'floor', 'material', 'tileable'],
      previewImage: '',
      fileCount: 2,
      totalSizeBytes: 51200,
      primaryExtension: 'TRES',
      materialSpec: {
        colorHex: '#64748b',
        roughness: 0.78,
        metalness: 0.12,
        tiling: 2,
      },
      files: [
        {
          id: 'af_stone_mat',
          name: 'stone_floor.tres',
          size: 19200,
          mimeType: 'text/plain',
          extension: 'TRES',
          blobId: 'starter_asset_stone_tres',
          chunkCount: 1,
        },
        {
          id: 'af_stone_notes',
          name: 'pbr_maps_manifest.txt',
          size: 32000,
          mimeType: 'text/plain',
          extension: 'TXT',
          blobId: 'starter_asset_stone_txt',
          chunkCount: 1,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'asset_potion_ui_pack',
      ownerId: 'local',
      name: 'حزمة أيقونات الجرعات والغنائم',
      description:
        'مجموعة عناصر واجهة مستخدم (جرعات، عملات، دروع) منسقة مع ملف تعريف الأطلس للدمج الفوري.',
      category: 'game_asset',
      folder: 'واجهات وأيقونات',
      tags: ['UI', 'icons', 'RPG', 'potions'],
      previewImage: '',
      fileCount: 1,
      totalSizeBytes: 18400,
      primaryExtension: 'JSON',
      files: [
        {
          id: 'af_potion_atlas',
          name: 'collectibles_atlas.json',
          size: 18400,
          mimeType: 'application/json',
          extension: 'JSON',
          blobId: 'starter_asset_potion_atlas',
          chunkCount: 1,
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createStarterNotesData(): WorkspaceNote[] {
  return [
    {
      id: 'note_godot_physics_checklist',
      ownerId: 'local',
      title: 'ملاحظات ضبط حركة اللاعب والجاذبية في Godot 4',
      contentHtml:
        '<h2>خطوات ضبط حركة الشخصية</h2><p>تذكير مهم: استخدام <strong>move_and_slide()</strong> داخل دالة <em>_physics_process</em> يضمن ثبات السرعة على جميع الأجهزة.</p><ul data-checklist="true"><li data-checklist-item="true"><input type="checkbox" checked="checked" /> <span>ضبط سرعة القفز والجاذبية الافتراضية</span></li><li data-checklist-item="true"><input type="checkbox" /> <span>إضافة مؤقت Coyote Time لتحسين استجابة القفز</span></li></ul><pre dir="ltr" data-code-block="true"><code>const SPEED = 300.0\nconst JUMP_VELOCITY = -420.0\nfunc _physics_process(delta):\n    velocity.y += gravity * delta\n    move_and_slide()</code></pre><p>مرجع التوثيق الرسمي: <a href="https://docs.godotengine.org/" target="_blank" rel="noopener noreferrer">Godot Documentation</a></p>',
      plainPreview:
        'خطوات ضبط حركة الشخصية: استخدام move_and_slide() داخل دالة _physics_process يضمن ثبات السرعة على جميع الأجهزة...',
      folder: 'تطوير الألعاب',
      tags: ['Godot', 'GDScript', 'فيزياء'],
      pinned: true,
      links: [
        {
          type: 'vault_project',
          targetId: 'vault_platformer_quest',
          parentId: '',
          label: 'لعبة المغامرة ثنائية الأبعاد (Godot 4)',
        },
      ],
      createdAt: '2026-11-12T09:15:00.000Z',
      updatedAt: '2026-11-14T08:50:00.000Z',
    },
    {
      id: 'note_scifi_crate_shader',
      ownerId: 'local',
      title: 'إعدادات إضاءة وخامات صندوق الإمداد 3D',
      contentHtml:
        '<h3>توزيع قنوات الخامات</h3><ul><li>تفعيل خريطة الخشونة Roughness لتفاصيل المعدن</li><li>ربط الإضاءة الانبعاثية Emissive باللون الأزرق الهادئ</li></ul><p>مناسبة للمشاهد الداخلية في المرحلة الثانية.</p>',
      plainPreview:
        'توزيع قنوات الخامات: تفعيل خريطة الخشونة Roughness لتفاصيل المعدن، ربط الإضاءة الانبعاثية Emissive...',
      folder: 'تصميم وأصول',
      tags: ['3D', 'glTF', 'PBR'],
      pinned: false,
      links: [
        {
          type: 'library_asset',
          targetId: 'asset_crate_sc07',
          parentId: '',
          label: 'صندوق إمداد خيال علمي SC-07',
        },
      ],
      createdAt: '2026-11-13T11:30:00.000Z',
      updatedAt: '2026-11-13T14:20:00.000Z',
    },
    {
      id: 'note_react_hooks_summary',
      ownerId: 'local',
      title: 'ملخص إدارة الحالة والخطافات في React',
      contentHtml:
        '<h2>أهم القواعد العملية</h2><ol><li>استخدم <strong>useState</strong> للبيانات المحلية المرتبطة بالواجهة.</li><li>استخدم <strong>useEffect</strong> للمزامنة مع التخزين السحابي أو المؤقتات.</li></ol><p>يجب تنظيف المؤقتات عبر دالة الإرجاع لمنع تسرب الذاكرة.</p>',
      plainPreview:
        'أهم القواعد العملية: استخدم useState للبيانات المحلية المرتبطة بالواجهة، واستخدم useEffect للمزامنة...',
      folder: 'ملاحظات البرمجة',
      tags: ['React', 'Hooks', 'TypeScript'],
      pinned: false,
      links: [
        {
          type: 'learning_step',
          targetId: 'step_web_2',
          parentId: 'path_web_foundations',
          label: 'إدارة الحالة والتفاعلات اليومية مع الخطافات (Hooks)',
        },
      ],
      createdAt: '2026-11-11T15:00:00.000Z',
      updatedAt: '2026-11-12T18:10:00.000Z',
    },
  ];
}

export function createStarterCoursesData(): CourseItem[] {
  const now = '2026-11-14T09:00:00.000Z';
  return [
    {
      id: 'course_react_typescript',
      ownerId: 'local',
      title: 'تطوير واجهات الويب التفاعلية باستخدام React و TypeScript',
      url: 'https://www.youtube.com/playlist?list=PL4cUxeGkcC9gZD-Tvwfod2gaISzfRiP9d',
      thumbnailUrl: '',
      description:
        'كورس عملي متكامل يغطي المكونات التفاعلية، إدارة الحالة عبر Hooks، وبناء واجهات عربية متجاوبة خطوة بخطوة.',
      platform: 'YouTube · The Net Ninja',
      category: 'البرمجة وتطوير الويب',
      status: 'active',
      progressPercent: 35,
      linkedPathId: 'path_web_foundations',
      videos: [
        {
          id: 'cv_react_1',
          title: 'مقدمة في بناء المكونات التفاعلية (React Components)',
          videoUrl: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
          duration: '18:30',
        },
        {
          id: 'cv_react_2',
          title: 'إدارة الحالة والتفاعلات اليومية مع الخطافات (Hooks)',
          videoUrl: 'https://www.youtube.com/watch?v=TNhaISOUy6Q',
          duration: '24:15',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'course_godot_3d_craft',
      ownerId: 'local',
      title: 'أساسيات بناء الألعاب ثنائية وثلاثية الأبعاد في Godot 4',
      url: 'https://docs.godotengine.org/en/stable/getting_started/introduction/index.html',
      thumbnailUrl: '',
      description:
        'سلسلة تطبيقية لتعلم حركة الشخصيات، فيزياء المنصات، وإعداد المشاهد والخامات في محرك Godot 4.',
      platform: 'Godot Official & Community',
      category: 'تطوير الألعاب',
      status: 'active',
      progressPercent: 20,
      linkedPathId: '',
      videos: [
        {
          id: 'cv_godot_1',
          title: 'فهم العقد والمشاهد وبناء أول شخصية لاعب',
          videoUrl: 'https://www.youtube.com/watch?v=LOhfqjmasi0',
          duration: '32:00',
        },
      ],
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createStarterTodosData(): TodoTask[] {
  const now = '2026-11-14T09:15:00.000Z';
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  return [
    {
      id: 'todo_next_react_video',
      ownerId: 'local',
      title: 'إنهاء درس إدارة الحالة والتفاعلات اليومية مع Hooks',
      description: 'مشاهدة الفيديو الثاني وتطبيق مثال نموذج الحفظ التلقائي داخل المسار.',
      priority: 'high',
      dueDate: tomorrow,
      completed: false,
      completedAt: '',
      link: {
        type: 'learning_path',
        targetId: 'path_web_foundations',
        parentId: '',
        label: 'مسار تطوير واجهات الويب التفاعلية',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_board_watch_godot',
      ownerId: 'local',
      title: 'مشاهدة الفيديو كاملاً وتجربة العقد الأساسية',
      description: 'مهمة تطبيقية مرتبطة ببطاقة تعلم Godot في لوحة التعلم.',
      priority: 'high',
      dueDate: '',
      completed: false,
      completedAt: '',
      link: {
        type: 'learning_board',
        targetId: 'bcard_godot_todo',
        parentId: 'board_game_journey',
        label: 'Learn Godot Basics · لوحة التعلم',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_board_practice_movement',
      ownerId: 'local',
      title: 'تطبيق نظام الحركة والجاذبية (Movement System)',
      description: 'مهمة تطبيقية من لوحة التعلم.',
      priority: 'medium',
      dueDate: '',
      completed: false,
      completedAt: '',
      link: {
        type: 'learning_board',
        targetId: 'bcard_godot_todo',
        parentId: 'board_game_journey',
        label: 'Learn Godot Basics · لوحة التعلم',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_board_write_notes',
      ownerId: 'local',
      title: 'كتابة ملاحظات الدرس وتوثيق الدوال المهمة',
      description: 'تم تلخيص حركة move_and_slide تحت بطاقة الفيديو.',
      priority: 'low',
      dueDate: '',
      completed: true,
      completedAt: '2026-11-14T08:45:00.000Z',
      link: {
        type: 'learning_board',
        targetId: 'bcard_godot_todo',
        parentId: 'board_game_journey',
        label: 'Learn Godot Basics · لوحة التعلم',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_backup_godot_build',
      ownerId: 'local',
      title: 'رفع نسخة احتياطية جديدة لمشروع لعبة المغامرة بعد ضبط الفيزياء',
      description: 'حفظ ملفات المرحلة الثانية ومخطط التحكم في خزنة المشاريع.',
      priority: 'medium',
      dueDate: inThreeDays,
      completed: false,
      completedAt: '',
      link: {
        type: 'project',
        targetId: 'vault_platformer_quest',
        parentId: '',
        label: 'لعبة المغامرة ثنائية الأبعاد (Godot 4)',
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'todo_review_crate_asset',
      ownerId: 'local',
      title: 'مراجعة خامات صندوق الإمداد SC-07 وتجربة الإضاءة',
      description: 'التأكد من خريطة الخشونة Roughness وإعداد ملف glTF للمشروع.',
      priority: 'low',
      dueDate: '',
      completed: true,
      completedAt: '2026-11-13T19:00:00.000Z',
      link: {
        type: 'asset',
        targetId: 'asset_crate_sc07',
        parentId: '',
        label: 'صندوق إمداد خيال علمي SC-07',
      },
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function createStarterBoardsData(): LearningBoard[] {
  const now = '2026-11-14T09:20:00.000Z';
  return [
    {
      id: 'board_game_journey',
      ownerId: 'local',
      title: 'خريطة تعلم تطوير الألعاب التفاعلية',
      description:
        'مساحة بصرية لتنظيم فيديوهات التعلم، الملاحظات المباشرة تحت كل فيديو، وقوائم المهام التطبيقية المترابطة.',
      viewport: { panX: 18, panY: 44, zoom: 0.70 },
      cards: [
        {
          id: 'bcard_godot_todo',
          kind: 'todo_widget',
          x: 20,
          y: 80,
          width: 280,
          title: 'مهام تطبيق: Learn Godot Basics',
          sourceLabel: 'متزامنة مع قائمة المهام',
          videoUrl: '',
          thumbnailUrl: '',
          completed: false,
          noteText: '',
          noteExpanded: true,
          linkedNoteId: '',
          sourceRefType: 'none',
          sourceRefId: '',
          sourceParentId: '',
          attachedToCardId: 'bcard_godot_basics',
          accentColor: 'emerald',
        },
        {
          id: 'bcard_godot_basics',
          kind: 'video',
          x: 410,
          y: 30,
          width: 310,
          title: 'Learn Godot Basics · أساسيات العقد والمشاهد',
          sourceLabel: 'YouTube',
          videoUrl: 'https://www.youtube.com/watch?v=LOhfqjmasi0',
          thumbnailUrl: 'https://i.ytimg.com/vi/LOhfqjmasi0/hqdefault.jpg',
          completed: false,
          noteText:
            'تتكون كل لعبة في Godot من شجرة عقد (Scene Tree). نستخدم CharacterBody2D لبناء اللاعب مع ضبط التصادم عبر CollisionShape2D.',
          noteExpanded: true,
          linkedNoteId: '',
          sourceRefType: 'course',
          sourceRefId: 'course_godot_3d_craft',
          sourceParentId: 'cv_godot_1',
          attachedToCardId: '',
          accentColor: 'crimson',
        },
        {
          id: 'bcard_react_components',
          kind: 'video',
          x: 840,
          y: 30,
          width: 310,
          title: 'بناء المكونات التفاعلية (React Components)',
          sourceLabel: 'مسار: تطوير واجهات الويب',
          videoUrl: 'https://www.youtube.com/watch?v=SqcY0GlETPk',
          thumbnailUrl: 'https://i.ytimg.com/vi/SqcY0GlETPk/hqdefault.jpg',
          completed: true,
          noteText:
            'فصل كل بطاقة واجهة إلى مكون مستقل مع تمرير البيانات عبر Props يجعل اللوحة سريعة وسهلة الصيانة.',
          noteExpanded: true,
          linkedNoteId: '',
          sourceRefType: 'learning_step',
          sourceRefId: 'step_web_1',
          sourceParentId: 'path_web_foundations',
          attachedToCardId: '',
          accentColor: 'navy',
        },
        {
          id: 'bcard_idea_prototype',
          kind: 'idea_note',
          x: 1265,
          y: 100,
          width: 265,
          title: 'فكرة نموذج اختبار سريع',
          sourceLabel: 'ملاحظة بصرية',
          videoUrl: '',
          thumbnailUrl: '',
          completed: false,
          noteText:
            'الربط بين نظام الحركة في Godot وتصميم واجهات React يعطي تجربة لوحة تحكم متكاملة للألعاب.',
          noteExpanded: true,
          linkedNoteId: '',
          sourceRefType: 'none',
          sourceRefId: '',
          sourceParentId: '',
          attachedToCardId: '',
          accentColor: 'amber',
        },
      ],
      connections: [
        {
          id: 'bconn_vid1_to_vid2',
          fromCardId: 'bcard_godot_basics',
          toCardId: 'bcard_react_components',
          label: 'الخطوة التالية',
          color: 'crimson',
        },
        {
          id: 'bconn_vid1_to_todo',
          fromCardId: 'bcard_godot_basics',
          toCardId: 'bcard_godot_todo',
          label: 'مهام التطبيق',
          color: 'emerald',
        },
        {
          id: 'bconn_vid2_to_idea',
          fromCardId: 'bcard_react_components',
          toCardId: 'bcard_idea_prototype',
          label: 'فكرة ربط',
          color: 'amber',
        },
      ],
      drawings: [],
      createdAt: now,
      updatedAt: now,
    },
  ];
}



