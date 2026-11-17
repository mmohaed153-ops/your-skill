import { useState } from 'react';
import {
  CheckCircle2,
  GitBranch,
  Link2,
  Lock,
  Plus,
  Sparkles,
  Unlock,
  X,
} from 'lucide-react';
import type { LearningPath } from '../../types/learning';
import type { EvaluatedSkillNode, PracticalProject, SkillNodeStatus } from '../../types/platform';
import type { CourseItem } from '../../types/workspace';
import { SectionHeroBanner } from '../SectionHeroBanner';

interface SkillTreeViewProps {
  skills: EvaluatedSkillNode[];
  paths: LearningPath[];
  courses: CourseItem[];
  projects: PracticalProject[];
  onUpdateSkillLinks: (
    skillId: string,
    patch: {
      linkedPathIds?: string[];
      linkedCourseIds?: string[];
      linkedProjectIds?: string[];
    }
  ) => Promise<void>;
  onCreateCustomSkill: (input: {
    title: string;
    description: string;
    levelNumber: number;
    category: string;
    prerequisiteIds: string[];
    linkedPathIds: string[];
  }) => Promise<unknown>;
  onOpenLinkedPath: (pathId: string) => void;
}

const STATUS_META: Record<
  SkillNodeStatus,
  { label: string; cardClass: string; badgeClass: string }
> = {
  completed: {
    label: 'مكتملة',
    cardClass:
      'border-[#15803D] bg-emerald-50/80 dark:bg-emerald-950/40 shadow-[0_4px_0_#15803D]',
    badgeClass: 'bg-[#15803D] text-white',
  },
  in_progress: {
    label: 'قيد التقدم',
    cardClass:
      'border-[#062D4C] dark:border-sky-400 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C]',
    badgeClass: 'bg-[#1D4ED8] text-white',
  },
  available: {
    label: 'متاحة للبدء',
    cardClass:
      'border-[#062D4C] dark:border-slate-500 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C]',
    badgeClass: 'bg-[#D97706] text-white',
  },
  locked: {
    label: 'مقفلة',
    cardClass:
      'border-slate-300 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-950/80 opacity-80',
    badgeClass: 'bg-slate-600 text-white',
  },
};

export function SkillTreeView({
  skills,
  paths,
  courses,
  projects,
  onUpdateSkillLinks,
  onCreateCustomSkill,
  onOpenLinkedPath,
}: SkillTreeViewProps) {
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLevel, setNewLevel] = useState(2);
  const [newCategory, setNewCategory] = useState('البرمجة');
  const [newPrereqs, setNewPrereqs] = useState<string[]>([]);
  const [newLinkedPaths, setNewLinkedPaths] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const completedCount = skills.filter((s) => s.status === 'completed').length;
  const totalCount = skills.length;
  const overallPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const levels = [1, 2, 3, 4];
  const selectedSkill = selectedSkillId
    ? skills.find((s) => s.node.id === selectedSkillId) || null
    : null;

  const titleById = new Map(skills.map((s) => [s.node.id, s.node.title]));

  const handleToggleLink = async (
    skill: EvaluatedSkillNode,
    kind: 'path' | 'course' | 'project',
    targetId: string
  ) => {
    const toggleArr = (arr: string[]) =>
      arr.includes(targetId) ? arr.filter((id) => id !== targetId) : [...arr, targetId];
    if (kind === 'path') {
      await onUpdateSkillLinks(skill.node.id, {
        linkedPathIds: toggleArr(skill.node.linkedPathIds),
      });
    } else if (kind === 'course') {
      await onUpdateSkillLinks(skill.node.id, {
        linkedCourseIds: toggleArr(skill.node.linkedCourseIds),
      });
    } else {
      await onUpdateSkillLinks(skill.node.id, {
        linkedProjectIds: toggleArr(skill.node.linkedProjectIds),
      });
    }
  };

  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      await onCreateCustomSkill({
        title: newTitle.trim(),
        description: newDescription.trim(),
        levelNumber: newLevel,
        category: newCategory.trim() || 'البرمجة',
        prerequisiteIds: newPrereqs,
        linkedPathIds: newLinkedPaths,
      });
      setNewTitle('');
      setNewDescription('');
      setNewPrereqs([]);
      setNewLinkedPaths([]);
      setCreateOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="skill-tree-view" className="space-y-6">
      <SectionHeroBanner
        testId="skills-hero"
        kicker={
          <span>
            شجرة المهارات التفاعلية · {completedCount} من {totalCount} مهارة مكتملة
          </span>
        }
        title="شجرة المهارات — خريطة تطور قدراتك التقنية"
        description="اربط كل مهارة بمسار تعليمي أو كورس أو مشروع عملي؛ تفتح المهارات المتقدمة تلقائياً عند إتمام متطلباتها السابقة."
        progress={{
          label: 'اكتمال شجرة المهارات',
          percentage: overallPercent,
        }}
        actions={[
          {
            id: 'add-custom-skill',
            label: 'إضافة مهارة مخصصة',
            icon: <Plus className="w-4 h-4" aria-hidden="true" />,
            onClick: () => setCreateOpen(true),
            tone: 'crimson',
          },
        ]}
      />

      {/* 4-Tier Progressive Skill Map */}
      <div className="space-y-6">
        {levels.map((levelNum) => {
          const tierNodes = skills.filter((s) => s.node.levelNumber === levelNum);
          if (tierNodes.length === 0) return null;
          return (
            <section
              key={levelNum}
              data-testid={`skill-tier-${levelNum}`}
              className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-grid-paper p-4 sm:p-5 space-y-4"
            >
              <div className="flex items-center justify-between gap-2 border-b border-[#062D4C]/15 dark:border-slate-700 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-[#062D4C] text-white text-xs font-black flex items-center justify-center tabular-nums">
                    {levelNum}
                  </span>
                  <h2 className="text-base font-black text-[#062D4C] dark:text-white">
                    المستوى {levelNum}:{' '}
                    {levelNum === 1
                      ? 'الأساسيات والانطلاق'
                      : levelNum === 2
                        ? 'البناء والتطبيق'
                        : levelNum === 3
                          ? 'الأنظمة المتقدمة'
                          : 'الاحتراف وإطلاق المشاريع'}
                  </h2>
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                  {tierNodes.filter((n) => n.status === 'completed').length} / {tierNodes.length}{' '}
                  مكتمل
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tierNodes.map((item) => {
                  const meta = STATUS_META[item.status];
                  const prereqLabels = item.node.prerequisiteIds
                    .map((id) => titleById.get(id))
                    .filter(Boolean);

                  return (
                    <article
                      key={item.node.id}
                      data-testid={`skill-node-${item.node.id}`}
                      data-skill-status={item.status}
                      className={`rounded-2xl border-2 p-4 flex flex-col justify-between gap-3 transition-transform ${meta.cardClass}`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black ${meta.badgeClass}`}
                          >
                            {item.status === 'locked' ? (
                              <Lock className="w-3 h-3" aria-hidden="true" />
                            ) : item.status === 'completed' ? (
                              <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                            ) : (
                              <Unlock className="w-3 h-3" aria-hidden="true" />
                            )}
                            <span>{meta.label}</span>
                          </span>
                          <span className="text-xs font-black text-[#062D4C] dark:text-amber-300 tabular-nums">
                            +{item.node.xpReward} XP
                          </span>
                        </div>

                        <h3 className="text-sm sm:text-base font-black text-[#062D4C] dark:text-white leading-snug">
                          {item.node.title}
                        </h3>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                          {item.node.description}
                        </p>

                        {prereqLabels.length > 0 && (
                          <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                            المتطلب السابق: {prereqLabels.join(' · ')}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-700/80">
                        <div className="flex items-center justify-between text-xs font-extrabold tabular-nums">
                          <span className="text-slate-600 dark:text-slate-300">
                            {item.totalSourcesCount > 0
                              ? `${item.totalSourcesCount} مصادر مرتبطة`
                              : 'غير مرتبطة بمسار بعد'}
                          </span>
                          <span className="text-[#15803D] dark:text-emerald-400">
                            {item.progressPercent}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              item.status === 'completed'
                                ? 'bg-[#15803D]'
                                : item.status === 'locked'
                                  ? 'bg-slate-400'
                                  : 'bg-[#1D4ED8]'
                            }`}
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>

                        <button
                          type="button"
                          data-testid={`skill-link-btn-${item.node.id}`}
                          onClick={() => setSelectedSkillId(item.node.id)}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#062D4C] dark:border-slate-500 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-2 text-xs font-extrabold text-[#062D4C] dark:text-white cursor-pointer"
                        >
                          <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>ربط مسار / كورس / مشروع</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Node Linking Inspection Modal */}
      {selectedSkill && (
        <div
          className="fixed inset-0 z-50 bg-[#062D4C]/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedSkillId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl"
          >
            <div className="px-5 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
                <h3 className="text-base font-black truncate">{selectedSkill.node.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSkillId(null)}
                aria-label="إغلاق"
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {selectedSkill.node.description}
              </p>

              {/* Link Learning Paths */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-[#062D4C] dark:text-white">
                  ربط بالمسارات التعليمية
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {paths.map((p) => {
                    const checked = selectedSkill.node.linkedPathIds.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2"
                      >
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => void handleToggleLink(selectedSkill, 'path', p.id)}
                            className="w-4 h-4 accent-[#15803D]"
                          />
                          <span className="truncate">{p.title}</span>
                        </label>
                        {checked && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSkillId(null);
                              onOpenLinkedPath(p.id);
                            }}
                            className="text-[11px] font-extrabold text-[#1D4ED8] dark:text-sky-400 hover:underline shrink-0 cursor-pointer"
                          >
                            فتح المسار
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Link Courses */}
              {courses.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-[#062D4C] dark:text-white">
                    ربط بالكورسات
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {courses.map((c) => {
                      const checked = selectedSkill.node.linkedCourseIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => void handleToggleLink(selectedSkill, 'course', c.id)}
                            className="w-4 h-4 accent-[#15803D]"
                          />
                          <span className="truncate">{c.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Link Practical Projects */}
              {projects.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-black text-[#062D4C] dark:text-white">
                    ربط بالمشاريع العملية
                  </h4>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {projects.map((pr) => {
                      const checked = selectedSkill.node.linkedProjectIds.includes(pr.id);
                      return (
                        <label
                          key={pr.id}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-bold cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => void handleToggleLink(selectedSkill, 'project', pr.id)}
                            className="w-4 h-4 accent-[#15803D]"
                          />
                          <span className="truncate">{pr.title}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Custom Skill Modal */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#062D4C]/55 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setCreateOpen(false)}
        >
          <form
            onSubmit={handleCreateCustom}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 bg-[#062D4C] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-300" aria-hidden="true" />
                <h3 className="text-base font-black">إضافة مهارة جديدة للشجرة</h3>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                aria-label="إغلاق"
                className="p-1 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-black mb-1">اسم المهارة *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="مثال: برمجة الذكاء الاصطناعي للأعداء"
                  className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">المستوى (1-4)</label>
                  <select
                    value={newLevel}
                    onChange={(e) => setNewLevel(Number(e.target.value))}
                    className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
                  >
                    <option value={1}>المستوى 1 — أساسي</option>
                    <option value={2}>المستوى 2 — متوسط</option>
                    <option value={3}>المستوى 3 — متقدم</option>
                    <option value={4}>المستوى 4 — احترافي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black mb-1">التصنيف</label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-black mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-black mb-1">متطلبات سابقة اختيارية</label>
                <div className="max-h-28 overflow-y-auto space-y-1 border rounded-xl p-2 border-slate-200 dark:border-slate-700">
                  {skills.map((s) => (
                    <label key={s.node.id} className="flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={newPrereqs.includes(s.node.id)}
                        onChange={() =>
                          setNewPrereqs((prev) =>
                            prev.includes(s.node.id)
                              ? prev.filter((x) => x !== s.node.id)
                              : [...prev, s.node.id]
                          )
                        }
                      />
                      <span>{s.node.title}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-black mb-1">ربط بمسار تعليمي اختياري</label>
                <div className="max-h-24 overflow-y-auto space-y-1 border rounded-xl p-2 border-slate-200 dark:border-slate-700">
                  {paths.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={newLinkedPaths.includes(p.id)}
                        onChange={() =>
                          setNewLinkedPaths((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((x) => x !== p.id)
                              : [...prev, p.id]
                          )
                        }
                      />
                      <span>{p.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-xs font-extrabold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving || !newTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-[#B92622] text-white text-xs font-black cursor-pointer disabled:opacity-50"
                >
                  {saving ? 'جاري الحفظ...' : 'إضافة المهارة'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
