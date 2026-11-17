import { useEffect, useState } from 'react';
import { FolderPlus, X } from 'lucide-react';
import type { SaveVideoCollectionInput } from '../../hooks/useVideoCollections';
import type { VideoCollection } from '../../types/workspace';
import { DEFAULT_VIDEO_COLLECTION_CATEGORIES, validateVideoCollectionInput } from '../../utils/gameJamLogic';
import { parseTagsInput } from '../../utils/workspaceLogic';

interface VideoCollectionModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialCollection: VideoCollection | null;
  onClose: () => void;
  onSubmit: (input: SaveVideoCollectionInput) => Promise<void>;
}

export function VideoCollectionModal({
  open,
  mode,
  initialCollection,
  onClose,
  onSubmit,
}: VideoCollectionModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]);
  const [tagsRaw, setTagsRaw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    if (mode === 'edit' && initialCollection) {
      setTitle(initialCollection.title);
      setDescription(initialCollection.description);
      setCategory(initialCollection.category || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]);
      setTagsRaw(initialCollection.tags.join(', '));
    } else {
      setTitle('');
      setDescription('');
      setCategory(DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]);
      setTagsRaw('');
    }
  }, [open, mode, initialCollection]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateVideoCollectionInput({ title });
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        category,
        tags: parseTagsInput(tagsRaw),
        coverImage: '',
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ المجموعة.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-collection-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_6px_0_#062D4C] dark:shadow-[0_6px_0_#020617] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white border-b-2 border-[#041E34] flex items-center justify-between gap-4">
          <h2 id="video-collection-modal-title" className="text-lg font-extrabold text-white">
            {mode === 'edit' ? 'تعديل مجموعة الفيديوهات' : 'إنشاء مجموعة فيديوهات متعددة المنصات'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة المجموعة"
            className="p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="rounded-xl border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-[#B92622] dark:text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="vcol-title" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              عنوان المجموعة *
            </label>
            <input
              id="vcol-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: مصادر تصميم المؤثرات البصرية من YouTube و TikTok"
              className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="vcol-desc" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              وصف المجموعة
            </label>
            <textarea
              id="vcol-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ملاحظة موجزة عن هدف هذه القائمة..."
              className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="vcol-cat" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                التصنيف
              </label>
              <select
                id="vcol-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              >
                {DEFAULT_VIDEO_COLLECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="vcol-tags" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                الوسوم (مفصولة بفاصلة)
              </label>
              <input
                id="vcol-tags"
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="Godot, TikTok, Shaders"
                className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-700">
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
              data-testid="vcol-submit-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer disabled:opacity-60"
            >
              <FolderPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جاري الحفظ...' : mode === 'edit' ? 'حفظ التعديلات' : 'إنشاء المجموعة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
