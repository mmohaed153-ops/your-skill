import { useRef, useState } from 'react';
import { FolderKanban, Plus, Trash2, Upload, X } from 'lucide-react';
import type { LearningPath } from '../../types/learning';
import type {
  PracticalProject,
  PracticalProjectStage,
  PracticalProjectStatus,
} from '../../types/platform';
import type { StoredFileRef, UploadProgressState } from '../../types/workspace';
import { createSafeId } from '../../utils/pathLogic';
import { formatBytes } from '../../utils/workspaceLogic';
import type { SavePracticalProjectPayload } from '../../hooks/usePracticalProjects';

interface PracticalProjectModalProps {
  open: boolean;
  editingProject: PracticalProject | null;
  paths: LearningPath[];
  uploadProgress: UploadProgressState;
  onClose: () => void;
  onSave: (payload: SavePracticalProjectPayload, editingId?: string) => Promise<void>;
}

export function PracticalProjectModal({
  open,
  editingProject,
  paths,
  uploadProgress,
  onClose,
  onSave,
}: PracticalProjectModalProps) {
  const [title, setTitle] = useState(() => editingProject?.title || '');
  const [description, setDescription] = useState(() => editingProject?.description || '');
  const [requirements, setRequirements] = useState(() => editingProject?.requirements || '');
  const [skillsText, setSkillsText] = useState(() =>
    editingProject ? editingProject.requiredSkills.join('، ') : ''
  );
  const [linkedPathId, setLinkedPathId] = useState(
    () => editingProject?.linkedPathId || paths[0]?.id || ''
  );
  const [status, setStatus] = useState<PracticalProjectStatus>(
    () => editingProject?.status || 'not_started'
  );
  const [projectUrl, setProjectUrl] = useState(() => editingProject?.projectUrl || '');
  const [stages, setStages] = useState<PracticalProjectStage[]>(
    () =>
      editingProject?.stages || [
        {
          id: createSafeId('stg'),
          title: 'تخطيط البنية الأساسية',
          instructions: 'جهّز الملفات والمشهد الأساسي للمشروع.',
          completed: false,
        },
        {
          id: createSafeId('stg'),
          title: 'بناء الوظائف المطلوبة',
          instructions: 'نفّذ المتطلبات الرئيسية واختبر كل جزء.',
          completed: false,
        },
      ]
  );
  const [keepFiles, setKeepFiles] = useState<StoredFileRef[]>(
    () => editingProject?.files || []
  );
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const linkedPath = paths.find((p) => p.id === linkedPathId);
      const requiredSkills = skillsText
        .split(/[،,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          requirements: requirements.trim(),
          requiredSkills,
          linkedPathId: linkedPath?.id || '',
          linkedPathTitle: linkedPath?.title || '',
          status,
          stages: stages.filter((s) => s.title.trim()),
          projectUrl: projectUrl.trim(),
          newFiles,
          keepFiles,
        },
        editingProject?.id
      );
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#062D4C]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <form
        data-testid="practical-project-modal"
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 bg-[#062D4C] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-amber-300" aria-hidden="true" />
            <h2 className="text-base font-black">
              {editingProject ? 'تعديل المشروع العملي' : 'مشروع عملي جديد'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1">اسم المشروع *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: لعبة منصة ثنائية الأبعاد"
                className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">ربط بالمسار التعليمي</label>
              <select
                value={linkedPathId}
                onChange={(e) => setLinkedPathId(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
              >
                <option value="">مشروع مستقل</option>
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-black mb-1">المهارات المطلوبة (افصل بفاصلة)</label>
              <input
                type="text"
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                placeholder="حركة، تصادم، واجهة مستخدم"
                className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-black mb-1">حالة المشروع</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PracticalProjectStatus)}
                className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
              >
                <option value="not_started">لم يبدأ</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">مكتمل (+120 XP)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-black mb-1">وصف المشروع</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-black mb-1">المتطلبات والمعايير</label>
            <textarea
              rows={2}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-black mb-1">رابط المشروع / المستودع (اختياري)</label>
            <input
              type="url"
              dir="ltr"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
              placeholder="https://github.com/..."
              className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold"
            />
          </div>

          {/* Stages Editor */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black">مراحل التنفيذ التفاعلية</label>
              <button
                type="button"
                onClick={() =>
                  setStages((prev) => [
                    ...prev,
                    { id: createSafeId('stg'), title: '', instructions: '', completed: false },
                  ])
                }
                className="inline-flex items-center gap-1 text-xs font-extrabold text-[#1D4ED8] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة مرحلة</span>
              </button>
            </div>
            <div className="space-y-2">
              {stages.map((s, idx) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={s.title}
                    onChange={(e) =>
                      setStages((prev) =>
                        prev.map((item, i) =>
                          i === idx ? { ...item, title: e.target.value } : item
                        )
                      )
                    }
                    placeholder={`عنوان المرحلة #${idx + 1}`}
                    className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-bold"
                  />
                  {stages.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setStages((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="حذف المرحلة"
                      className="p-1.5 text-slate-400 hover:text-[#B92622] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* File Attachments Upload */}
          <div className="rounded-xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black text-[#062D4C] dark:text-white">
                رفع ملفات أو صور المشروع النهائي
              </span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-3 py-1.5 text-xs font-extrabold cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>اختيار ملفات</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const chosen = Array.from(e.target.files || []);
                  if (chosen.length > 0) {
                    setNewFiles((prev) => [...prev, ...chosen]);
                  }
                  e.target.value = '';
                }}
              />
            </div>

            {uploadProgress.active && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span>جاري الرفع: {uploadProgress.fileName}</span>
                  <span className="tabular-nums">{uploadProgress.percent}%</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-[#15803D] transition-all"
                    style={{ width: `${uploadProgress.percent}%` }}
                  />
                </div>
              </div>
            )}

            {(keepFiles.length > 0 || newFiles.length > 0) && (
              <ul className="space-y-1 text-xs font-bold">
                {keepFiles.map((f) => (
                  <li
                    key={f.blobId}
                    className="flex items-center justify-between bg-slate-50 dark:bg-slate-950 rounded-lg px-2.5 py-1"
                  >
                    <span className="truncate">
                      {f.name} ({formatBytes(f.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setKeepFiles((prev) => prev.filter((x) => x.blobId !== f.blobId))
                      }
                      className="text-[#B92622] hover:underline text-[11px] cursor-pointer"
                    >
                      إزالة
                    </button>
                  </li>
                ))}
                {newFiles.map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 rounded-lg px-2.5 py-1"
                  >
                    <span className="truncate">
                      جديد: {f.name} ({formatBytes(f.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                      className="text-[#B92622] hover:underline text-[11px] cursor-pointer"
                    >
                      إلغاء
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border-2 border-slate-300 dark:border-slate-700 text-xs font-extrabold cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            data-testid="save-practical-project-btn"
            className="px-5 py-2 rounded-xl bg-[#B92622] hover:bg-[#9E1E1B] text-white text-xs font-black cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'جاري الحفظ...' : 'حفظ المشروع العملي'}
          </button>
        </div>
      </form>
    </div>
  );
}
