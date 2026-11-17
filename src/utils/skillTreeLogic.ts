import type { VideoStep } from '../types/learning';
import type {
  EvaluatedSkillNode,
  PracticalProject,
  SkillNode,
  SkillNodeStatus,
} from '../types/platform';
import type { CourseItem } from '../types/workspace';

export function createStarterSkillNodes(ownerId = 'local'): SkillNode[] {
  const nowIso = new Date().toISOString();
  const base = (
    id: string,
    title: string,
    description: string,
    levelNumber: number,
    columnIndex: number,
    category: string,
    prerequisiteIds: string[],
    xpReward: number
  ): SkillNode => ({
    id,
    ownerId,
    title,
    description,
    levelNumber,
    columnIndex,
    category,
    prerequisiteIds,
    linkedPathIds: [],
    linkedCourseIds: [],
    linkedProjectIds: [],
    xpReward,
    isCustom: false,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return [
    base(
      'skill_l1_logic',
      'أساسيات التفكير البرمجي',
      'فهم المتغيرات، الجمل الشرطية، الحلقات، وتفكيك المشكلات إلى خطوات واضحة.',
      1,
      0,
      'البرمجة',
      [],
      50
    ),
    base(
      'skill_l1_ui',
      'بناء الواجهات وتجربة المستخدم',
      'تنظيم الصفحات، الشبكات، والتفاعل مع العناصر البصرية باحترافية.',
      1,
      1,
      'التصميم والواجهات',
      [],
      50
    ),
    base(
      'skill_l1_engine',
      'أساسيات محرك الألعاب',
      'استكشاف المشاهد، العقد (Nodes)، المحاور، واستيراد الموارد الأولية.',
      1,
      2,
      'تطوير الألعاب',
      [],
      50
    ),
    base(
      'skill_l2_oop',
      'البرمجة الكائنية وبنية الأكواد',
      'تنظيم المشروع باستخدام الفئات (Classes)، المكونات المستقلة، والإشارات.',
      2,
      0,
      'البرمجة',
      ['skill_l1_logic'],
      80
    ),
    base(
      'skill_l2_physics',
      'فيزياء الحركة والتحكم',
      'تطوير حركة الشخصيات، التصادمات (Collisions)، والكاميرا التفاعلية.',
      2,
      1,
      'تطوير الألعاب',
      ['skill_l1_logic', 'skill_l1_engine'],
      90
    ),
    base(
      'skill_l2_3d_assets',
      'النماذج والخامات 3D / 2D',
      'تحسين الأصول البصرية والخامات والإضاءة للمشاهد التفاعلية.',
      2,
      2,
      'الفنون 3D',
      ['skill_l1_ui', 'skill_l1_engine'],
      85
    ),
    base(
      'skill_l3_systems',
      'أنظمة اللعب والبيانات',
      'بناء أنظمة الحفظ، قوائم المهام، الصلاحيات، والتخزين السحابي.',
      3,
      0,
      'الأنظمة',
      ['skill_l2_oop', 'skill_l2_physics'],
      120
    ),
    base(
      'skill_l3_polish',
      'الصوتيات، التأثيرات والـ Juice',
      'إضافة المؤثرات الحركية والصوتية ورفع جودة التجربة الكلية.',
      3,
      1,
      'التصميم',
      ['skill_l2_physics', 'skill_l2_3d_assets'],
      110
    ),
    base(
      'skill_l4_launch',
      'بناء وإطلاق مشروع متكامل',
      'إتمام مشروع عملي قابل للنشر والمشاركة أو التقديم في المسابقات.',
      4,
      0,
      'المشاريع',
      ['skill_l3_systems', 'skill_l3_polish'],
      200
    ),
  ];
}

export function evaluateSkillTree(params: {
  nodes: SkillNode[];
  stepsByPath: Record<string, VideoStep[]>;
  courses: CourseItem[];
  projects: PracticalProject[];
}): EvaluatedSkillNode[] {
  const ordered = [...params.nodes].sort(
    (a, b) => a.levelNumber - b.levelNumber || a.columnIndex - b.columnIndex
  );

  const courseMap = new Map(params.courses.map((c) => [c.id, c]));
  const projectMap = new Map(params.projects.map((p) => [p.id, p]));

  const computeOwnProgress = (node: SkillNode): { percent: number; done: number; total: number } => {
    const progresses: number[] = [];

    for (const pathId of node.linkedPathIds) {
      const steps = params.stepsByPath[pathId];
      if (!steps) continue;
      if (steps.length === 0) {
        progresses.push(0);
      } else {
        const doneSteps = steps.filter((s) => s.completed).length;
        progresses.push(Math.round((doneSteps / steps.length) * 100));
      }
    }

    for (const courseId of node.linkedCourseIds) {
      const course = courseMap.get(courseId);
      if (!course) continue;
      progresses.push(course.status === 'completed' ? 100 : course.progressPercent || 0);
    }

    for (const projId of node.linkedProjectIds) {
      const proj = projectMap.get(projId);
      if (!proj) continue;
      if (proj.status === 'completed') progresses.push(100);
      else if (proj.status === 'in_progress') {
        const doneStages = proj.stages.filter((s) => s.completed).length;
        progresses.push(
          proj.stages.length > 0 ? Math.max(15, Math.round((doneStages / proj.stages.length) * 100)) : 50
        );
      } else {
        progresses.push(0);
      }
    }

    if (progresses.length === 0) {
      return { percent: 0, done: 0, total: 0 };
    }
    const avg = Math.round(progresses.reduce((sum, v) => sum + v, 0) / progresses.length);
    const done = progresses.filter((v) => v >= 100).length;
    return { percent: Math.max(0, Math.min(100, avg)), done, total: progresses.length };
  };

  const statusMap = new Map<string, SkillNodeStatus>();
  const evaluated: EvaluatedSkillNode[] = [];

  // Iterate by ascending level so parent skills are always evaluated before children
  for (const node of ordered) {
    const prereqsMet =
      node.prerequisiteIds.length === 0 ||
      node.prerequisiteIds.every((pid) => statusMap.get(pid) === 'completed');

    const own = computeOwnProgress(node);

    let status: SkillNodeStatus;
    if (!prereqsMet) {
      status = 'locked';
    } else if (own.total > 0 && own.percent >= 100) {
      status = 'completed';
    } else if (own.percent > 0) {
      status = 'in_progress';
    } else {
      status = 'available';
    }

    statusMap.set(node.id, status);
    evaluated.push({
      node,
      status,
      progressPercent: own.percent,
      completedSourcesCount: own.done,
      totalSourcesCount: own.total,
      prerequisitesMet: prereqsMet,
    });
  }

  return evaluated;
}
