import { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  ExternalLink,
  Heart,
  NotebookPen,
  Play,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import type { VideoStep } from '../types/learning';
import type { NoteLinkRef, WorkspaceNote } from '../types/workspace';
import {
  parseVideoUrl,
  QUICK_NOTES_MAX,
  sanitizeQuickNotes,
  validateQuickNotes,
} from '../utils/pathLogic';
import { RelatedNotesSection } from './notes/RelatedNotesSection';

interface VideoWatchModalProps {
  step: VideoStep | null;
  focusNotes?: boolean;
  contextBadge?: string;
  noteLinkTarget?: {
    type: NoteLinkRef['type'];
    targetId: string;
    parentId: string;
  };
  notes?: WorkspaceNote[];
  onOpenNoteInWorkspace?: (noteId: string) => void;
  onCreateLinkedNote?: (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => Promise<WorkspaceNote>;
  onCreateTodoForStep?: (step: VideoStep) => void;
  onOpenQuizForStep?: (step: VideoStep) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (step: VideoStep) => void;
  onVideoWatched?: (step: VideoStep) => void;
  onClose: () => void;
  onMarkCompleted: (step: VideoStep) => void;
  onSaveQuickNotes: (step: VideoStep, notes: string) => Promise<void> | void;
}

function formatSavedTime(iso: string): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function VideoWatchModal({
  step,
  focusNotes = false,
  contextBadge,
  noteLinkTarget,
  notes = [],
  onOpenNoteInWorkspace,
  onCreateLinkedNote,
  onCreateTodoForStep,
  onOpenQuizForStep,
  isFavorite = false,
  onToggleFavorite,
  onVideoWatched,
  onClose,
  onMarkCompleted,
  onSaveQuickNotes,
}: VideoWatchModalProps) {
  const [draftNotes, setDraftNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedFeedback, setSavedFeedback] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const notesTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!step) return;
    setDraftNotes(step.quickNotes || '');
    setNotesError(null);
    setSavedFeedback(false);
    if (onVideoWatched) {
      onVideoWatched(step);
    }
  }, [step?.id, step?.quickNotes]);

  useEffect(() => {
    if (!step || !focusNotes) return;
    const timer = window.setTimeout(() => {
      notesTextareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      notesTextareaRef.current?.focus();
    }, 80);
    return () => window.clearTimeout(timer);
  }, [step?.id, focusNotes]);

  if (!step) return null;

  const embed = parseVideoUrl(step.videoUrl);
  const savedNormalized = sanitizeQuickNotes(step.quickNotes || '');
  const draftNormalized = sanitizeQuickNotes(draftNotes);
  const hasUnsavedChanges = draftNormalized !== savedNormalized;
  const charCount = draftNotes.length;
  const savedTimeLabel = formatSavedTime(step.quickNotesUpdatedAt || '');

  const handleSaveNotes = async () => {
    const validation = validateQuickNotes(draftNotes);
    if (!validation.valid) {
      setNotesError(validation.error || 'تعذر حفظ الملاحظات.');
      return;
    }

    setNotesError(null);
    setSavingNotes(true);
    try {
      await onSaveQuickNotes(step, draftNotes);
      setSavedFeedback(true);
    } catch {
      setNotesError('حدث خطأ أثناء حفظ الملاحظات. حاول مرة أخرى.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleClearNotes = async () => {
    setDraftNotes('');
    setNotesError(null);
    if (savedNormalized) {
      setSavingNotes(true);
      try {
        await onSaveQuickNotes(step, '');
        setSavedFeedback(true);
      } catch {
        setNotesError('تعذر مسح الملاحظات. حاول مرة أخرى.');
      } finally {
        setSavingNotes(false);
      }
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="watch-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden">
          <div className="px-5 sm:px-6 py-4 border-b-2 border-[#062D4C]/15 dark:border-slate-700 flex items-center justify-between gap-4 shrink-0">
          <div className="min-w-0">
            <div className="text-xs font-extrabold text-[#B92622] dark:text-rose-400 tabular-nums">
              {embed.platformName} · {contextBadge || `الخطوة ${step.order + 1}`} · مشاهدة الدرس
            </div>
            <h2
              id="watch-modal-title"
              className="text-base sm:text-lg font-extrabold text-[#062D4C] dark:text-white truncate"
            >
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق مشغل الفيديو"
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-[#062D4C] dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Embedded Player or External Link Launch */}
          <div className="bg-slate-950">
            {(embed.provider === 'youtube' ||
              embed.provider === 'vimeo' ||
              embed.provider === 'tiktok' ||
              embed.provider === 'facebook' ||
              embed.provider === 'loom' ||
              embed.provider === 'dailymotion') &&
            embed.embedUrl ? (
              <div>
                <div
                  className={
                    embed.provider === 'tiktok'
                      ? 'aspect-[9/16] max-h-[520px] mx-auto w-full max-w-[340px]'
                      : 'aspect-video w-full'
                  }
                >
                  <iframe
                    src={embed.embedUrl}
                    title={step.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                {(embed.provider === 'tiktok' || embed.provider === 'facebook') && (
                  <div className="px-4 py-2 bg-slate-900 text-slate-200 text-xs flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
                    <span>
                      إذا حظرت منصة {embed.platformName} التشغيل المضمن، يمكنك المشاهدة مباشرة في الصفحة الأصلية.
                    </span>
                    <a
                      href={embed.normalizedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-extrabold text-amber-300 hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>فتح على {embed.platformName}</span>
                    </a>
                  </div>
                )}
              </div>
            ) : embed.provider === 'direct' && embed.embedUrl ? (
              <div className="aspect-video w-full">
                <video
                  src={embed.embedUrl}
                  controls
                  className="w-full h-full"
                />
              </div>
            ) : (
              <div className="p-8 sm:p-10 text-center space-y-4">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-500/20 text-sky-300 flex items-center justify-center">
                  <Play className="w-7 h-7" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-white">
                    فيديو محفوظ من {embed.platformName}
                  </p>
                  <p className="text-xs text-slate-300 break-all max-w-lg mx-auto" dir="ltr">
                    {embed.normalizedUrl}
                  </p>
                </div>
                <a
                  href={embed.normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-950 bg-white hover:bg-sky-50 rounded-xl transition-colors"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>فتح الفيديو الأصلي على {embed.platformName}</span>
                </a>
              </div>
            )}
          </div>

          <div className="p-5 sm:p-6 space-y-5">
            {step.description && (
              <div className="space-y-1">
                <h3 className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                  وصف الدرس
                </h3>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                  {step.description}
                </p>
              </div>
            )}

            {/* Quick Notes Workspace linked to this VideoStep */}
            <section
              aria-labelledby="quick-notes-heading"
              className="pt-4 border-t-2 border-[#062D4C]/10 dark:border-slate-700 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  id="quick-notes-heading"
                  htmlFor="watch-quick-notes-input"
                  className="inline-flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white"
                >
                  <NotebookPen className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                  <span>ملاحظات سريعة</span>
                </label>

                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  {hasUnsavedChanges ? (
                    <span className="text-amber-700 dark:text-amber-300">
                      تعديلات غير محفوظة
                    </span>
                  ) : savedFeedback || savedNormalized ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {savedFeedback
                          ? 'تم حفظ الملاحظات'
                          : savedTimeLabel
                            ? `محفوظة · ${savedTimeLabel}`
                            : 'محفوظة في بطاقة الدرس'}
                      </span>
                    </span>
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">
                      تُحفظ تلقائياً في بطاقة هذا الفيديو
                    </span>
                  )}
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    {charCount} / {QUICK_NOTES_MAX}
                  </span>
                </div>
              </div>

              <textarea
                ref={notesTextareaRef}
                id="watch-quick-notes-input"
                data-testid="watch-quick-notes-textarea"
                rows={4}
                maxLength={QUICK_NOTES_MAX}
                value={draftNotes}
                onChange={(e) => {
                  setDraftNotes(e.target.value);
                  if (savedFeedback) setSavedFeedback(false);
                  if (notesError) setNotesError(null);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    void handleSaveNotes();
                  }
                }}
                placeholder="اكتب ملاحظاتك السريعة أو النقاط المهمة أثناء مشاهدة هذا الفيديو لتظهر مباشرة على بطاقة الدرس..."
                className="w-full px-4 py-3 text-sm font-medium text-[#062D4C] dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/30 dark:border-slate-600 rounded-xl focus:outline-none focus:border-[#062D4C] dark:focus:border-sky-400 leading-relaxed resize-y"
              />

              {notesError && (
                <p role="alert" className="text-xs font-bold text-[#B92622] dark:text-rose-400">
                  {notesError}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  اختصار الحفظ السريع: Ctrl + Enter
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {(draftNotes.trim().length > 0 || savedNormalized.length > 0) && (
                    <button
                      type="button"
                      onClick={() => void handleClearNotes()}
                      disabled={savingNotes}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>مسح الملاحظات</span>
                    </button>
                  )}

                  <button
                    type="button"
                    data-testid="save-quick-notes-btn"
                    onClick={() => void handleSaveNotes()}
                    disabled={savingNotes || !hasUnsavedChanges}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] dark:bg-sky-600 dark:hover:bg-sky-500 border-2 border-[#062D4C] shadow-[2px_3px_0_#B92622] rounded-xl transition-transform active:translate-y-0.5 disabled:opacity-50 disabled:shadow-none whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{savingNotes ? 'جاري الحفظ...' : 'حفظ الملاحظات'}</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Workspace Notes linked to this Video or Collection */}
            {onOpenNoteInWorkspace && onCreateLinkedNote && (
              <RelatedNotesSection
                targetType={noteLinkTarget?.type || 'learning_step'}
                targetId={noteLinkTarget?.targetId || step.id}
                parentId={noteLinkTarget?.parentId ?? step.pathId}
                targetLabel={step.title}
                notes={notes}
                onOpenNoteInWorkspace={onOpenNoteInWorkspace}
                onCreateLinkedNote={onCreateLinkedNote}
              />
            )}

            {/* Footer Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t-2 border-[#062D4C]/10 dark:border-slate-700">
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={embed.normalizedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-[#062D4C] dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>فتح الرابط الأصلي</span>
                </a>

                {onOpenQuizForStep && (
                  <button
                    type="button"
                    onClick={() => onOpenQuizForStep(step)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#1D4ED8] dark:text-sky-300 bg-white dark:bg-slate-800 hover:bg-sky-50 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ClipboardCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>اختبار الدرس</span>
                  </button>
                )}

                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={() => onToggleFavorite(step)}
                    aria-label={isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                    className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-xs sm:text-sm font-extrabold border-2 border-[#062D4C] dark:border-slate-600 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isFavorite
                        ? 'bg-rose-50 text-[#B92622] dark:bg-rose-950/50 dark:text-rose-300'
                        : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200'
                    }`}
                  >
                    <Heart className={`w-4 h-4 shrink-0 ${isFavorite ? 'fill-[#B92622]' : ''}`} aria-hidden="true" />
                    <span>{isFavorite ? 'مفضل' : 'للمفضلة'}</span>
                  </button>
                )}

                {onCreateTodoForStep && (
                  <button
                    type="button"
                    onClick={() => onCreateTodoForStep(step)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-slate-100 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>إضافة مهمة للدرس</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                {!step.completed ? (
                  <button
                    type="button"
                    onClick={() => {
                      onMarkCompleted(step);
                      onClose();
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>تم الإنجاز</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>تم إنجاز هذا الدرس</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
