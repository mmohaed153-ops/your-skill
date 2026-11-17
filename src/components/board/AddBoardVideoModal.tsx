import { useEffect, useState } from 'react';
import {
  GraduationCap,
  Link2,
  ListVideo,
  Loader2,
  Plus,
  Route,
  Sparkles,
  Video,
  X,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import type { LearningPath, VideoStep } from '../../types/learning';
import type { BoardAccentColor, CourseItem } from '../../types/workspace';
import { BOARD_ACCENT_STYLES, validateBoardVideoInput } from '../../utils/boardLogic';
import { isValidHttpUrl, parseVideoUrl } from '../../utils/pathLogic';
import { resolveVideoMetadata } from '../../utils/videoResolveClient';

export type AddBoardVideoTab = 'url' | 'course' | 'path';

interface AddBoardVideoModalProps {
  open: boolean;
  courses: CourseItem[];
  learningPaths: LearningPath[];
  stepsByPath: Record<string, VideoStep[]>;
  onClose: () => void;
  onAddFromUrl: (input: {
    title: string;
    videoUrl: string;
    thumbnailUrl: string;
    sourceLabel: string;
    accentColor: BoardAccentColor;
  }) => void;
  onAddSingleCourseVideo: (course: CourseItem, video?: { id: string; title: string; videoUrl: string }) => void;
  onAddWholeCourse: (course: CourseItem) => void;
  onAddSinglePathStep: (path: LearningPath, step: VideoStep) => void;
  onAddWholePath: (path: LearningPath, steps: VideoStep[]) => void;
}

export function AddBoardVideoModal({
  open,
  courses,
  learningPaths,
  stepsByPath,
  onClose,
  onAddFromUrl,
  onAddSingleCourseVideo,
  onAddWholeCourse,
  onAddSinglePathStep,
  onAddWholePath,
}: AddBoardVideoModalProps) {
  const [tab, setTab] = useState<AddBoardVideoTab>('url');
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [accentColor, setAccentColor] = useState<BoardAccentColor>('crimson');
  const [resolving, setResolving] = useState(false);
  const [resolveNote, setResolveNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setError(null);
      setResolving(false);
      setResolveNote(null);
      setTitle('');
      setVideoUrl('');
      setSourceLabel('');
      setThumbnailUrl('');
      setAccentColor('crimson');
    }
  }, [open]);

  if (!open) return null;

  const autoEmbed = videoUrl.trim() ? parseVideoUrl(videoUrl) : null;
  const previewThumb = resolveMediaUrl(
    thumbnailUrl.trim() || autoEmbed?.autoThumbnailUrl || ''
  );

  const handleAutoResolve = async () => {
    if (!isValidHttpUrl(videoUrl)) {
      setError('يرجى لصق رابط فيديو صالح أولاً.');
      return;
    }
    setError(null);
    setResolving(true);
    setResolveNote(null);
    try {
      const meta = await resolveVideoMetadata(videoUrl);
      if (meta.title && !title.trim()) setTitle(meta.title.slice(0, 200));
      if (meta.platformName && !sourceLabel.trim()) setSourceLabel(meta.platformName);
      if (meta.thumbnailUrl) setThumbnailUrl(meta.thumbnailUrl);
      setResolveNote(
        meta.resolved
          ? `تم جلب التفاصيل من ${meta.platformName}.`
          : `تم اكتشاف ${meta.platformName} — يمكنك تعديل العنوان والمصدر بحرية.`
      );
    } finally {
      setResolving(false);
    }
  };

  const handleSubmitUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateBoardVideoInput({ title, videoUrl });
    if (validationError) {
      setError(validationError);
      return;
    }
    onAddFromUrl({
      title: title.trim(),
      videoUrl: videoUrl.trim(),
      thumbnailUrl: thumbnailUrl.trim() || autoEmbed?.autoThumbnailUrl || '',
      sourceLabel: sourceLabel.trim(),
      accentColor,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-add-video-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
            <h2 id="board-add-video-title" className="text-base sm:text-lg font-extrabold">
              إضافة فيديو إلى لوحة التعلم
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة إضافة فيديو"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Source Switcher Tabs */}
        <div className="px-6 pt-4 border-b border-[#062D4C]/15 dark:border-slate-800 flex flex-wrap gap-2 bg-slate-50 dark:bg-slate-800/50 pb-3">
          <button
            type="button"
            data-testid="board-video-tab-url"
            onClick={() => setTab('url')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold rounded-xl border-2 cursor-pointer transition-colors ${
              tab === 'url'
                ? 'bg-[#B92622] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
            }`}
          >
            <Link2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>لصق رابط فيديو</span>
          </button>

          <button
            type="button"
            data-testid="board-video-tab-course"
            onClick={() => setTab('course')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold rounded-xl border-2 cursor-pointer transition-colors ${
              tab === 'course'
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
            }`}
          >
            <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>من كورساتي ({courses.length})</span>
          </button>

          <button
            type="button"
            data-testid="board-video-tab-path"
            onClick={() => setTab('path')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold rounded-xl border-2 cursor-pointer transition-colors ${
              tab === 'path'
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
            }`}
          >
            <Route className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>من مسار التعلم ({learningPaths.length})</span>
          </button>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {tab === 'url' && (
            <form onSubmit={handleSubmitUrl} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-3.5 py-2 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-200"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="board-video-title-input"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  عنوان الفيديو *
                </label>
                <input
                  id="board-video-title-input"
                  data-testid="board-video-title-input"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: Learn Godot Movement System"
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="board-video-url-input"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  رابط الفيديو (YouTube, TikTok, Facebook, Vimeo وأي رابط) *
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    id="board-video-url-input"
                    data-testid="board-video-url-input"
                    type="url"
                    dir="ltr"
                    required
                    value={videoUrl}
                    onChange={(e) => {
                      setVideoUrl(e.target.value);
                      setResolveNote(null);
                    }}
                    placeholder="https://www.youtube.com/watch?v=... أو TikTok / Facebook"
                    className="flex-1 rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAutoResolve()}
                    disabled={resolving || !videoUrl.trim()}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] disabled:opacity-50 rounded-xl cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {resolving ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>جلب التفاصيل</span>
                  </button>
                </div>
                {(resolveNote || autoEmbed) && (
                  <p className="mt-1 text-xs font-bold text-[#062D4C] dark:text-sky-300">
                    {resolveNote || `المنصة المكتشفة: ${autoEmbed?.platformName}`}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="board-video-source-input"
                    className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                  >
                    المصدر (اختياري)
                  </label>
                  <input
                    id="board-video-source-input"
                    type="text"
                    value={sourceLabel}
                    onChange={(e) => setSourceLabel(e.target.value)}
                    placeholder="يُكتشف تلقائياً (مثل YouTube)"
                    className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="board-video-thumb-input"
                    className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                  >
                    صورة مصغرة مخصصة (اختياري)
                  </label>
                  <input
                    id="board-video-thumb-input"
                    type="text"
                    dir="ltr"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="تُجلب تلقائياً لروابط YouTube"
                    className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div className="space-y-1.5">
                  <span className="block text-xs font-extrabold text-[#062D4C] dark:text-slate-300">
                    لون الدبوس والإطار على اللوحة
                  </span>
                  <div className="flex items-center gap-2">
                    {(['crimson', 'navy', 'emerald', 'amber'] as BoardAccentColor[]).map((clr) => (
                      <button
                        key={clr}
                        type="button"
                        onClick={() => setAccentColor(clr)}
                        className={`px-2.5 py-1.5 text-xs font-extrabold rounded-lg border-2 cursor-pointer flex items-center gap-1.5 ${
                          accentColor === clr
                            ? 'bg-[#062D4C] text-white border-[#062D4C]'
                            : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
                        }`}
                      >
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${BOARD_ACCENT_STYLES[clr].pinBg}`}
                          aria-hidden="true"
                        />
                        <span>{BOARD_ACCENT_STYLES[clr].label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="w-36 aspect-video rounded-xl border-2 border-[#062D4C] overflow-hidden bg-slate-900 shrink-0 flex items-center justify-center">
                  {previewThumb ? (
                    <img
                      src={previewThumb}
                      alt="معاينة الصورة المصغرة"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Video className="w-6 h-6 text-slate-400" aria-hidden="true" />
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-[#062D4C]/15 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  data-testid="board-video-submit-btn"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>إضافة إلى اللوحة</span>
                </button>
              </div>
            </form>
          )}

          {tab === 'course' && (
            <div className="space-y-4">
              {courses.length === 0 ? (
                <p className="text-sm font-bold text-center py-8 text-slate-500">
                  لا توجد كورسات محفوظة في قسم «كورساتي» حالياً.
                </p>
              ) : (
                courses.map((course) => (
                  <div
                    key={course.id}
                    className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#B92622] dark:text-amber-300">
                          {course.platform}
                        </div>
                        <h3 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white truncate">
                          {course.title}
                        </h3>
                      </div>

                      <button
                        type="button"
                        data-testid={`add-whole-course-${course.id}`}
                        onClick={() => {
                          onAddWholeCourse(course);
                          onClose();
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer shrink-0"
                      >
                        <ListVideo className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>
                          {course.videos.length > 1
                            ? `إضافة الدروس مترابطة (${course.videos.length})`
                            : 'إضافة إلى اللوحة'}
                        </span>
                      </button>
                    </div>

                    {course.videos.length > 0 && (
                      <ul className="space-y-1.5">
                        {course.videos.map((v) => (
                          <li
                            key={v.id}
                            className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 border border-[#062D4C]/15 dark:border-slate-700 px-3 py-2"
                          >
                            <span className="text-xs font-bold text-[#062D4C] dark:text-slate-200 truncate">
                              {v.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                onAddSingleCourseVideo(course, v);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] rounded-md cursor-pointer shrink-0"
                            >
                              <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span>إضافة</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === 'path' && (
            <div className="space-y-4">
              {learningPaths.length === 0 ? (
                <p className="text-sm font-bold text-center py-8 text-slate-500">
                  لا توجد مسارات تعليمية حالياً.
                </p>
              ) : (
                learningPaths.map((path) => {
                  const pSteps = [...(stepsByPath[path.id] || [])].sort(
                    (a, b) => a.order - b.order
                  );
                  return (
                    <div
                      key={path.id}
                      className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            مسار تعليمي · {pSteps.length} فيديوهات
                          </div>
                          <h3 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white truncate">
                            {path.title}
                          </h3>
                        </div>

                        {pSteps.length > 0 && (
                          <button
                            type="button"
                            data-testid={`add-whole-path-${path.id}`}
                            onClick={() => {
                              onAddWholePath(path, pSteps);
                              onClose();
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer shrink-0"
                          >
                            <Route className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>إضافة المسار كسلسلة مترابطة</span>
                          </button>
                        )}
                      </div>

                      {pSteps.length > 0 && (
                        <ul className="space-y-1.5">
                          {pSteps.map((st, idx) => (
                            <li
                              key={st.id}
                              className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 border border-[#062D4C]/15 dark:border-slate-700 px-3 py-2"
                            >
                              <span className="text-xs font-bold text-[#062D4C] dark:text-slate-200 truncate">
                                {idx + 1}. {st.title}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  onAddSinglePathStep(path, st);
                                  onClose();
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] rounded-md cursor-pointer shrink-0"
                              >
                                <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                                <span>إضافة</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
