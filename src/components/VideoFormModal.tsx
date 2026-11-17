import { useEffect, useState } from 'react';
import { ImagePlus, Link2, Loader2, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { compressImageToDataUrl, resolveMediaUrl } from '../data/presets';
import type { VideoInputPayload } from '../hooks/useLearningPaths';
import type { VideoStep } from '../types/learning';
import {
  isValidHttpUrl,
  parseVideoUrl,
  STEP_DESCRIPTION_MAX,
  STEP_TITLE_MAX,
  validateVideoInput,
} from '../utils/pathLogic';
import { resolveVideoMetadata } from '../utils/videoResolveClient';

interface VideoFormModalProps {
  open: boolean;
  mode: 'add' | 'edit';
  initialStep: VideoStep | null;
  totalSteps: number;
  onClose: () => void;
  onSubmit: (payload: VideoInputPayload) => Promise<void> | void;
}

export function VideoFormModal({
  open,
  mode,
  initialStep,
  totalSteps,
  onClose,
  onSubmit,
}: VideoFormModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [order1Based, setOrder1Based] = useState(1);
  const [targetDate, setTargetDate] = useState('');
  const [resolvingMeta, setResolvingMeta] = useState(false);
  const [metaHint, setMetaHint] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    title?: string;
    videoUrl?: string;
    description?: string;
    upload?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setSubmitting(false);
    setResolvingMeta(false);
    setMetaHint(null);
    if (mode === 'edit' && initialStep) {
      setVideoUrl(initialStep.videoUrl);
      setTitle(initialStep.title);
      setDescription(initialStep.description);
      setThumbnailUrl(resolveMediaUrl(initialStep.thumbnailUrl));
      setOrder1Based(initialStep.order + 1);
      setTargetDate(initialStep.targetDate || '');
    } else {
      setVideoUrl('');
      setTitle('');
      setDescription('');
      setThumbnailUrl('');
      setOrder1Based(totalSteps + 1);
      setTargetDate('');
    }
  }, [open, mode, initialStep, totalSteps]);

  if (!open) return null;

  const detectedEmbed = videoUrl.trim() ? parseVideoUrl(videoUrl) : null;
  const maxOrder = mode === 'edit' ? Math.max(1, totalSteps) : totalSteps + 1;
  const orderOptions = Array.from({ length: maxOrder }, (_, i) => i + 1);

  const handleAutoResolve = async () => {
    if (!isValidHttpUrl(videoUrl)) {
      setErrors((prev) => ({ ...prev, videoUrl: 'يرجى إدخال رابط فيديو صحيح أولاً.' }));
      return;
    }
    setResolvingMeta(true);
    setMetaHint(null);
    try {
      const meta = await resolveVideoMetadata(videoUrl);
      if (meta.title && !title.trim()) setTitle(meta.title.slice(0, STEP_TITLE_MAX));
      if (meta.description && !description.trim()) {
        setDescription(meta.description.slice(0, STEP_DESCRIPTION_MAX));
      }
      if (meta.thumbnailUrl) setThumbnailUrl(meta.thumbnailUrl);
      setMetaHint(
        meta.resolved
          ? `تم جلب بيانات الفيديو من ${meta.platformName} بنجاح.`
          : `تم حفظ الرابط من منصة ${meta.platformName} (يمكنك كتابة العنوان يدوياً إذا حجبت المنصة المعاينة التلقائية).`
      );
    } finally {
      setResolvingMeta(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrors((prev) => ({ ...prev, upload: undefined }));
    try {
      const dataUrl = await compressImageToDataUrl(file, 720, 0.78);
      setThumbnailUrl(dataUrl);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        upload: err instanceof Error ? err.message : 'تعذر رفع الصورة.',
      }));
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateVideoInput({ title, videoUrl, description });
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    const finalThumb = thumbnailUrl || detectedEmbed?.autoThumbnailUrl || '';

    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        videoUrl,
        thumbnailUrl: finalThumb,
        order1Based,
        targetDate,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_6px_0_#062D4C] dark:shadow-[0_6px_0_#020617] overflow-hidden my-8">
        <div className="px-6 py-4 bg-[#062D4C] text-white border-b-2 border-[#041E34] flex items-center justify-between gap-4">
          <h2 id="video-form-title" className="text-lg sm:text-xl font-extrabold text-white">
            {mode === 'edit' ? 'تعديل بيانات الفيديو' : 'إضافة فيديو إلى مساري'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الفيديو"
            className="p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} noValidate className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* 1. Video Link */}
          <div className="space-y-1.5">
            <label htmlFor="video-url-input" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
              1. رابط الفيديو (YouTube, TikTok, Facebook, Vimeo وأي رابط) <span className="text-[#B92622] dark:text-rose-400">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Link2
                  className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="video-url-input"
                  type="url"
                  dir="ltr"
                  value={videoUrl}
                  onChange={(e) => {
                    setVideoUrl(e.target.value);
                    setMetaHint(null);
                    if (errors.videoUrl) setErrors((prev) => ({ ...prev, videoUrl: undefined }));
                  }}
                  placeholder="https://www.youtube.com/watch?v=... أو TikTok / Facebook"
                  className="w-full pr-10 pl-4 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] dark:focus:border-sky-400 text-left"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleAutoResolve()}
                disabled={resolvingMeta || !videoUrl.trim()}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] disabled:opacity-50 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
              >
                {resolvingMeta ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>جلب التفاصيل تلقائياً</span>
              </button>
            </div>
            {errors.videoUrl && (
              <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{errors.videoUrl}</p>
            )}

            {(detectedEmbed || metaHint) && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs font-bold text-[#062D4C] dark:text-sky-300">
                <span>
                  {metaHint ||
                    (detectedEmbed
                      ? `المنصة المكتشفة: ${detectedEmbed.platformName}`
                      : '')}
                </span>
                {detectedEmbed?.autoThumbnailUrl && (
                  <button
                    type="button"
                    onClick={() => setThumbnailUrl(detectedEmbed.autoThumbnailUrl!)}
                    className="inline-flex items-center gap-1 font-extrabold underline text-[#B92622] dark:text-amber-300 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>استخدام الصورة المصغرة التلقائية</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 2. Video Title */}
          <div className="space-y-1.5">
            <label htmlFor="video-title-input" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
              2. عنوان الفيديو <span className="text-[#B92622] dark:text-rose-400">*</span>
            </label>
            <input
              id="video-title-input"
              type="text"
              maxLength={STEP_TITLE_MAX}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder="مثال: شرح بناء المسارات التفاعلية خطوة بخطوة"
              className="w-full px-4 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] dark:focus:border-sky-400"
            />
            {errors.title && (
              <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{errors.title}</p>
            )}
          </div>

          {/* 3. Short Description / Notes */}
          <div className="space-y-1.5">
            <label htmlFor="video-desc-input" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
              3. وصف مختصر أو ملاحظات التعلم
            </label>
            <textarea
              id="video-desc-input"
              rows={3}
              maxLength={STEP_DESCRIPTION_MAX}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (errors.description) setErrors((prev) => ({ ...prev, description: undefined }));
              }}
              placeholder="اكتب أهم النقاط أو الأهداف التي تود التركيز عليها أثناء مشاهدة هذا الفيديو..."
              className="w-full px-4 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] dark:focus:border-sky-400 resize-y"
            />
            {errors.description && (
              <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{errors.description}</p>
            )}
          </div>

          {/* 4. Optional Thumbnail Upload (Zero bundled art gallery) */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#062D4C] dark:text-slate-100">
                4. الصورة المصغرة للفيديو (اختياري)
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#062D4C] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" aria-hidden="true" />
                <span>رفع صورة من جهازك</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            {errors.upload && (
              <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{errors.upload}</p>
            )}

            {thumbnailUrl && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-3">
                  <img
                    src={thumbnailUrl}
                    alt="معاينة الصورة المصغرة المختارة"
                    referrerPolicy="no-referrer"
                    className="w-20 h-14 object-cover rounded-lg border border-[#062D4C]/30"
                  />
                  <div className="text-xs text-[#062D4C] dark:text-slate-200 font-bold flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-[#B92622] dark:text-sky-300" aria-hidden="true" />
                    <span>تم تعيين صورة مصغرة للفيديو</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setThumbnailUrl('')}
                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                  aria-label="إزالة الصورة المصغرة"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>

          {/* 5. Order & 6. Optional Target Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="video-order-select" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
                5. ترتيب الفيديو في المسار
              </label>
              <select
                id="video-order-select"
                value={order1Based}
                onChange={(e) => setOrder1Based(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] tabular-nums"
              >
                {orderOptions.map((num) => (
                  <option key={num} value={num}>
                    الخطوة رقم {num}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="video-date-input" className="block text-sm font-bold text-[#062D4C] dark:text-slate-100">
                6. تاريخ مستهدف أو جدول يومي (اختياري)
              </label>
              <input
                id="video-date-input"
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] tabular-nums"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t-2 border-[#062D4C]/10 dark:border-slate-700 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-sm font-bold text-[#062D4C] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] disabled:opacity-60 rounded-xl transition-transform active:translate-y-0.5 cursor-pointer"
            >
              {submitting
                ? 'جاري الحفظ...'
                : mode === 'edit'
                  ? 'حفظ التعديلات'
                  : 'حفظ وإضافة للمسار'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
