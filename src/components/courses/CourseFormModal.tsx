import { useEffect, useRef, useState } from 'react';
import {
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import { compressImageToDataUrl, resolveMediaUrl } from '../../data/presets';
import type { SaveCoursePayload } from '../../hooks/useCourses';
import type { CourseItem, CourseStatus, CourseVideoItem } from '../../types/workspace';
import { createSafeId, isValidHttpUrl } from '../../utils/pathLogic';
import { resolveVideoMetadata } from '../../utils/videoResolveClient';
import {
  COURSE_STATUS_LABELS,
  DEFAULT_COURSE_CATEGORIES,
  validateCourseInput,
} from '../../utils/workspaceLogic';

interface CourseFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialCourse: CourseItem | null;
  onClose: () => void;
  onSubmit: (payload: SaveCoursePayload) => Promise<void>;
}

export function CourseFormModal({
  open,
  mode,
  initialCourse,
  onClose,
  onSubmit,
}: CourseFormModalProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [platform, setPlatform] = useState('');
  const [category, setCategory] = useState(DEFAULT_COURSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [status, setStatus] = useState<CourseStatus>('active');
  const [progressPercent, setProgressPercent] = useState(0);
  const [videos, setVideos] = useState<CourseVideoItem[]>([]);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setError(null);
      setSubmitting(false);
      setResolving(false);
      if (mode === 'edit' && initialCourse) {
        setTitle(initialCourse.title);
        setUrl(initialCourse.url);
        setPlatform(initialCourse.platform);
        setCategory(initialCourse.category || DEFAULT_COURSE_CATEGORIES[0]);
        setDescription(initialCourse.description);
        setThumbnailUrl(resolveMediaUrl(initialCourse.thumbnailUrl));
        setStatus(initialCourse.status);
        setProgressPercent(initialCourse.progressPercent || 0);
        setVideos(initialCourse.videos || []);
      } else {
        setTitle('');
        setUrl('');
        setPlatform('');
        setCategory(DEFAULT_COURSE_CATEGORIES[0]);
        setDescription('');
        setThumbnailUrl('');
        setStatus('active');
        setProgressPercent(0);
        setVideos([]);
      }
    }
    wasOpenRef.current = open;
  }, [open, mode, initialCourse]);

  if (!open) return null;

  const handleAutoDetectCourseUrl = async () => {
    if (!isValidHttpUrl(url)) {
      setError('يرجى إدخال رابط صالح أولاً.');
      return;
    }
    setError(null);
    setResolving(true);
    try {
      const meta = await resolveVideoMetadata(url);
      if (meta.title && !title.trim()) setTitle(meta.title.slice(0, 200));
      if (meta.platformName && !platform.trim()) setPlatform(meta.platformName);
      if (meta.description && !description.trim()) setDescription(meta.description.slice(0, 1500));
      if (meta.thumbnailUrl) setThumbnailUrl(meta.thumbnailUrl);
    } finally {
      setResolving(false);
    }
  };

  const handleUploadThumbnail = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 960, 0.8);
      setThumbnailUrl(compressed);
    } catch {
      setError('تعذر قراءة صورة الكورس. يرجى اختيار صورة أخرى.');
    }
  };

  const handleAddVideoRow = () => {
    setVideos((prev) => [
      ...prev,
      {
        id: createSafeId('cvid'),
        title: '',
        videoUrl: '',
        duration: '',
      },
    ]);
  };

  const handleUpdateVideoRow = (
    idx: number,
    field: keyof CourseVideoItem,
    value: string
  ) => {
    setVideos((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveVideoRow = (idx: number) => {
    setVideos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErr = validateCourseInput({ title, url });
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title,
        url,
        platform: platform.trim() || 'منصة تعليمية',
        category,
        description,
        thumbnailUrl,
        status,
        progressPercent,
        linkedPathId: initialCourse?.linkedPathId || '',
        videos: videos.filter((v) => v.title.trim() && v.videoUrl.trim()),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الكورس.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
            <h2 id="course-modal-title" className="text-base sm:text-lg font-extrabold">
              {mode === 'edit' ? 'تعديل بيانات الكورس' : 'إضافة كورس جديد إلى كورساتي'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة الكورس"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {error && (
            <div
              role="alert"
              className="rounded-lg border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="course-title-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              اسم الكورس *
            </label>
            <input
              id="course-title-input"
              data-testid="course-title-input"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: دورة تطوير تطبيقات الويب الحديثة بـ TypeScript"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="course-url-input"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                رابط الكورس (YouTube, TikTok, Facebook وأي رابط) *
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  id="course-url-input"
                  data-testid="course-url-input"
                  type="text"
                  dir="ltr"
                  required
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/playlist?list=..."
                  className="flex-1 min-w-0 rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void handleAutoDetectCourseUrl()}
                  disabled={resolving || !url.trim()}
                  title="جلب اسم المنصة والعنوان تلقائياً"
                  className="px-2.5 py-2.5 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] disabled:opacity-50 rounded-xl cursor-pointer shrink-0"
                >
                  {resolving ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="w-4 h-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="course-platform-input"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                المنصة أو المصدر التعليمي
              </label>
              <input
                id="course-platform-input"
                data-testid="course-platform-input"
                type="text"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                placeholder="مثال: YouTube, TikTok, Facebook, Coursera, Udemy"
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="course-category-select"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                المجال / التخصص
              </label>
              <select
                id="course-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              >
                {Array.from(new Set([...DEFAULT_COURSE_CATEGORIES, category])).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="course-status-select"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                حالة المتابعة
              </label>
              <select
                id="course-status-select"
                value={status}
                onChange={(e) => setStatus(e.target.value as CourseStatus)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              >
                {(['active', 'completed', 'wishlist'] as CourseStatus[]).map((st) => (
                  <option key={st} value={st}>
                    {COURSE_STATUS_LABELS[st]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Progress Slider */}
          <div className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 space-y-2">
            <div className="flex items-center justify-between text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white">
              <span>نسبة التقدم في الكورس</span>
              <span className="tabular-nums text-[#B92622] dark:text-amber-300">
                {progressPercent}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progressPercent}
              onChange={(e) => setProgressPercent(Number(e.target.value))}
              className="w-full accent-[#B92622] cursor-pointer"
            />
          </div>

          <div>
            <label
              htmlFor="course-desc-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              وصف الكورس وما ستتعلمه
            </label>
            <textarea
              id="course-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نبذة عن محاور الكورس وأهدافك منه..."
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          {/* Optional Custom Course Thumbnail Upload (Zero bundled art gallery) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#062D4C] dark:text-slate-200">
                صورة الكورس (اختياري)
              </span>
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C]/30 rounded-lg cursor-pointer">
                <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>رفع صورة مخصصة</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadThumbnail}
                  className="sr-only"
                />
              </label>
            </div>
            {thumbnailUrl && (
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <img
                  src={thumbnailUrl}
                  alt="معاينة صورة الكورس"
                  referrerPolicy="no-referrer"
                  className="w-20 h-12 object-cover rounded-lg border border-[#062D4C]/25"
                />
                <button
                  type="button"
                  onClick={() => setThumbnailUrl('')}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#B92622] hover:underline cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>إزالة الصورة</span>
                </button>
              </div>
            )}
          </div>

          {/* Course Videos / Lessons List */}
          <div className="space-y-2.5 pt-2 border-t border-[#062D4C]/15 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#062D4C] dark:text-slate-200">
                <Video className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
                <span>فيديوهات ودروس الكورس (اختياري لإضافتها لمسار التعلم)</span>
              </span>
              <button
                type="button"
                onClick={handleAddVideoRow}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-[#062D4C]/40 rounded-lg cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إضافة فيديو</span>
              </button>
            </div>

            {videos.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {videos.map((v, idx) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                  >
                    <input
                      type="text"
                      value={v.title}
                      onChange={(e) => handleUpdateVideoRow(idx, 'title', e.target.value)}
                      placeholder={`عنوان الدرس ${idx + 1}`}
                      className="sm:col-span-5 rounded-lg border border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-[#062D4C] dark:text-white"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={v.videoUrl}
                      onChange={(e) => handleUpdateVideoRow(idx, 'videoUrl', e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                      className="sm:col-span-5 rounded-lg border border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-[#062D4C] dark:text-white"
                    />
                    <div className="sm:col-span-2 flex items-center justify-end gap-1">
                      <input
                        type="text"
                        value={v.duration}
                        onChange={(e) => handleUpdateVideoRow(idx, 'duration', e.target.value)}
                        placeholder="15m"
                        className="w-14 rounded-lg border border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1.5 text-xs font-semibold text-[#062D4C] dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveVideoRow(idx)}
                        aria-label={`حذف فيديو ${idx + 1}`}
                        className="p-1.5 text-[#B92622] hover:bg-rose-50 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              data-testid="course-submit-btn"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-60 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{submitting ? 'جاري الحفظ...' : mode === 'edit' ? 'حفظ التعديلات' : 'حفظ الكورس'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
