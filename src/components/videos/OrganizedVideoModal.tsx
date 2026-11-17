import { useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, X } from 'lucide-react';
import type { SaveOrganizedVideoInput } from '../../hooks/useVideoCollections';
import type { OrganizedVideoItem, ResolvedVideoMetadata } from '../../types/workspace';
import { DEFAULT_VIDEO_COLLECTION_CATEGORIES, validateOrganizedVideoInput } from '../../utils/gameJamLogic';
import { parseVideoUrl } from '../../utils/pathLogic';
import { parseTagsInput } from '../../utils/workspaceLogic';

interface OrganizedVideoModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialVideo: OrganizedVideoItem | null;
  defaultCategory: string;
  onClose: () => void;
  onSubmit: (input: SaveOrganizedVideoInput) => Promise<void>;
}

export function OrganizedVideoModal({
  open,
  mode,
  initialVideo,
  defaultCategory,
  onClose,
  onSubmit,
}: OrganizedVideoModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [category, setCategory] = useState(defaultCategory || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]);
  const [tagsRaw, setTagsRaw] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedPlatformName, setResolvedPlatformName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSubmitting(false);
    setResolving(false);
    if (mode === 'edit' && initialVideo) {
      setVideoUrl(initialVideo.videoUrl);
      setTitle(initialVideo.title);
      setDescription(initialVideo.description);
      setNotes(initialVideo.notes);
      setThumbnailUrl(initialVideo.thumbnailUrl);
      setCategory(initialVideo.category || defaultCategory || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]);
      setTagsRaw(initialVideo.tags.join(', '));
      setResolvedPlatformName(initialVideo.platformName);
    } else {
      setVideoUrl('');
      setTitle('');
      setDescription('');
      setNotes('');
      setThumbnailUrl('');
      setCategory(defaultCategory || DEFAULT_VIDEO_COLLECTION_CATEGORIES[0]);
      setTagsRaw('');
      setResolvedPlatformName('');
    }
  }, [open, mode, initialVideo, defaultCategory]);

  if (!open) return null;

  const detected = videoUrl.trim() ? parseVideoUrl(videoUrl) : null;

  const handleResolveMetadata = async () => {
    if (!videoUrl.trim()) {
      setError('يرجى لصق رابط الفيديو أولاً لجلب البيانات.');
      return;
    }
    setError(null);
    setResolving(true);
    try {
      const res = await fetch('/api/videos/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
      });
      const data = (await res.json()) as ResolvedVideoMetadata & { error?: string };
      if (!res.ok) {
        setError(data.error || 'تعذر قراءة بيانات الرابط.');
        return;
      }
      if (data.title && !title.trim()) setTitle(data.title);
      if (data.description && !description.trim()) setDescription(data.description);
      if (data.thumbnailUrl && !thumbnailUrl.trim()) setThumbnailUrl(data.thumbnailUrl);
      setResolvedPlatformName(data.platformName || '');
    } catch {
      setError('تعذر الاتصال بخدمة جلب بيانات الفيديو. يمكنك كتابة العنوان يدوياً.');
    } finally {
      setResolving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateOrganizedVideoInput({ title, videoUrl });
    if (validationErr) {
      setError(validationErr);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const parsed = parseVideoUrl(videoUrl);
      await onSubmit({
        title,
        videoUrl,
        platformId: parsed.platformId,
        platformName: resolvedPlatformName || parsed.platformName,
        thumbnailUrl: thumbnailUrl || parsed.autoThumbnailUrl || undefined,
        description,
        notes,
        category,
        tags: parseTagsInput(tagsRaw),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الفيديو.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="organized-video-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 border-b-2 border-[#062D4C]/15 dark:border-slate-700 flex items-center justify-between gap-4">
          <h2 id="organized-video-modal-title" className="text-lg font-extrabold text-[#062D4C] dark:text-white">
            {mode === 'edit' ? 'تعديل بيانات الفيديو' : 'إضافة فيديو من أي منصة (YouTube / TikTok / Facebook / Vimeo...)'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الفيديو"
            className="p-2 text-slate-500 hover:text-[#062D4C] dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div role="alert" className="rounded-xl border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-[#B92622] dark:text-rose-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="ovid-url" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              رابط الفيديو (أي منصة مدعومة) *
            </label>
            <div className="flex gap-2">
              <input
                id="ovid-url"
                type="url"
                dir="ltr"
                required
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://www.tiktok.com/... أو youtube.com أو facebook.com"
                className="flex-1 rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void handleResolveMetadata()}
                disabled={resolving}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-xl cursor-pointer disabled:opacity-60 shrink-0"
              >
                {resolving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>جلب التفاصيل</span>
              </button>
            </div>
            {detected && (
              <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                المنصة المكتشفة: {resolvedPlatformName || detected.platformName}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="ovid-title" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              عنوان الفيديو *
            </label>
            <input
              id="ovid-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="اكتب عنواناً واضحاً للفيديو"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ovid-desc" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              الوصف أو سبب الحفظ
            </label>
            <textarea
              id="ovid-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ملخص سريع عن موضوع الفيديو..."
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          <div>
            <label htmlFor="ovid-notes" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
              ملاحظاتك التعليمية حول الفيديو
            </label>
            <textarea
              id="ovid-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ماذا تعلمت من هذا الفيديو أو ماذا ستطبق؟"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ovid-cat" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                التصنيف
              </label>
              <select
                id="ovid-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              >
                {DEFAULT_VIDEO_COLLECTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="ovid-tags" className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5">
                الوسوم
              </label>
              <input
                id="ovid-tags"
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="Blender, VFX, Tips"
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="ovid-submit-btn"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer disabled:opacity-60"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جاري الحفظ...' : mode === 'edit' ? 'حفظ التعديلات' : 'إضافة الفيديو للمجموعة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
