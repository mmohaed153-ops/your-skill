import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { PathInputPayload } from '../hooks/useLearningPaths';
import type { LearningPath } from '../types/learning';
import {
  PATH_DESCRIPTION_MAX,
  PATH_TITLE_MAX,
  validatePathInput,
} from '../utils/pathLogic';

interface PathFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialPath: LearningPath | null;
  existingPaths: LearningPath[];
  onClose: () => void;
  onSubmit: (payload: PathInputPayload) => Promise<void> | void;
}

export function PathFormModal({
  open,
  mode,
  initialPath,
  existingPaths,
  onClose,
  onSubmit,
}: PathFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<{
    title?: string;
    description?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitting(false);
    if (mode === 'edit' && initialPath) {
      setTitle(initialPath.title);
      setDescription(initialPath.description);
    } else {
      setTitle('');
      setDescription('');
    }
  }, [open, mode, initialPath]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePathInput({
      title,
      description,
      existingPaths,
      excludePathId: mode === 'edit' ? initialPath?.id : undefined,
    });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ title, description, coverImage: '' });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="path-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_6px_0_#062D4C] dark:shadow-[0_6px_0_#020617] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white border-b-2 border-[#041E34] flex items-center justify-between gap-4">
          <h2 id="path-form-title" className="text-lg font-extrabold text-white">
            {mode === 'edit' ? 'تعديل المسار التعليمي' : 'إنشاء مسار تعليمي جديد'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="path-title-input" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
              اسم المسار الفريد <span className="text-[#B92622] dark:text-rose-400">*</span>
            </label>
            <input
              id="path-title-input"
              type="text"
              maxLength={PATH_TITLE_MAX}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="مثال: مسار تعلم تطوير الألعاب"
              className="w-full px-4 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] dark:focus:border-sky-400"
            />
            {errors.title && (
              <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{errors.title}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="path-desc-input" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
              وصف مختصر للمسار
            </label>
            <textarea
              id="path-desc-input"
              rows={3}
              maxLength={PATH_DESCRIPTION_MAX}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="ما المهارة التي ستتقنها بعد إنهاء هذا المسار؟"
              className="w-full px-4 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] dark:focus:border-sky-400"
            />
            {errors.description && (
              <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{errors.description}</p>
            )}
          </div>

          <div className="pt-3 border-t-2 border-[#062D4C]/10 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] disabled:opacity-60 rounded-xl cursor-pointer"
            >
              {submitting ? 'جاري الحفظ...' : mode === 'edit' ? 'حفظ التعديلات' : 'إنشاء المسار'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
