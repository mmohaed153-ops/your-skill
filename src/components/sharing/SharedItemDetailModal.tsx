import { useEffect, useState } from 'react';
import {
  Check,
  CopyPlus,
  ExternalLink,
  Pencil,
  Save,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import type { SharedItemRecord } from '../../types/workspace';
import { normalizeUrl } from '../../utils/pathLogic';
import {
  canCollaborateOnShare,
  parseSharePayload,
  SHARE_ITEM_TYPE_LABELS,
  SHARE_ROLE_LABELS,
  type SharedPayloadBundle,
} from '../../utils/sharingLogic';

interface SharedItemDetailModalProps {
  share: SharedItemRecord | null;
  currentUid: string | null;
  onClose: () => void;
  onSaveCollaborativeUpdate: (shareId: string, bundle: SharedPayloadBundle) => Promise<void>;
  onSaveCopyToMyAccount: (share: SharedItemRecord, bundle: SharedPayloadBundle) => Promise<void>;
}

export function SharedItemDetailModal({
  share,
  currentUid,
  onClose,
  onSaveCollaborativeUpdate,
  onSaveCopyToMyAccount,
}: SharedItemDetailModalProps) {
  const [bundle, setBundle] = useState<SharedPayloadBundle | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftSummary, setDraftSummary] = useState('');
  const [savingCollab, setSavingCollab] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copiedDone, setCopiedDone] = useState(false);

  useEffect(() => {
    if (share) {
      const parsed = parseSharePayload(share.payloadJson);
      setBundle(parsed);
      setDraftTitle(parsed?.title || share.itemTitle);
      setDraftSummary(parsed?.summary || share.itemSummary);
      setEditMode(false);
      setCopiedDone(false);
    } else {
      setBundle(null);
    }
  }, [share]);

  if (!share || !bundle) return null;

  const canEdit = canCollaborateOnShare(share, currentUid || (share.ownerId === 'local' ? 'local' : null));

  const handleSaveEdits = async () => {
    setSavingCollab(true);
    try {
      const updated: SharedPayloadBundle = {
        ...bundle,
        title: draftTitle.trim() || bundle.title,
        summary: draftSummary.trim(),
      };
      if (updated.learningPath) {
        updated.learningPath = {
          ...updated.learningPath,
          path: {
            ...updated.learningPath.path,
            title: updated.title,
            description: updated.summary,
          },
        };
      }
      if (updated.course) {
        updated.course = { ...updated.course, title: updated.title, description: updated.summary };
      }
      if (updated.savedGameJam) {
        updated.savedGameJam = {
          ...updated.savedGameJam,
          name: updated.title,
          description: updated.summary,
        };
      }
      if (updated.learningBoard) {
        updated.learningBoard = {
          ...updated.learningBoard,
          title: updated.title,
          description: updated.summary,
        };
      }
      if (updated.videoCollection) {
        updated.videoCollection = {
          ...updated.videoCollection,
          title: updated.title,
          description: updated.summary,
        };
      }
      await onSaveCollaborativeUpdate(share.id, updated);
      setBundle(updated);
      setEditMode(false);
    } finally {
      setSavingCollab(false);
    }
  };

  const handleSaveCopy = async () => {
    setCopying(true);
    try {
      await onSaveCopyToMyAccount(share, bundle);
      setCopiedDone(true);
    } finally {
      setCopying(false);
    }
  };

  const resolvedThumb = bundle.thumbnail ? resolveMediaUrl(bundle.thumbnail) : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shared-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-amber-300">
              <span>{SHARE_ITEM_TYPE_LABELS[share.itemType]}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                <span>من: {share.ownerDisplayName} (@{share.ownerUsername})</span>
              </span>
            </div>
            <h2 id="shared-detail-title" className="text-base sm:text-lg font-extrabold truncate">
              {bundle.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق المعاينة المشتركة"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Role & Actions Bar */}
          <div className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#062D4C] dark:text-amber-300">
              <Shield className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
              <span>صلاحيتك: {SHARE_ROLE_LABELS[share.role]}</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  data-testid="shared-collab-edit-btn"
                  onClick={() => setEditMode((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{editMode ? 'إلغاء التعديل' : 'تعديل تعاوني'}</span>
                </button>
              )}

              {share.allowCopy && (
                <button
                  type="button"
                  data-testid="save-shared-copy-btn"
                  disabled={copying || copiedDone}
                  onClick={() => void handleSaveCopy()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 border-2 border-[#062D4C] rounded-lg cursor-pointer"
                >
                  {copiedDone ? (
                    <>
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>تم الحفظ في حسابك</span>
                    </>
                  ) : (
                    <>
                      <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{copying ? 'جاري النسخ...' : 'حفظ نسخة في حسابي'}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {editMode ? (
            <div className="rounded-xl border-2 border-[#062D4C] bg-white dark:bg-slate-900 p-4 space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#062D4C] dark:text-slate-300 mb-1">
                  العنوان التعاوني
                </label>
                <input
                  type="text"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-[#062D4C] dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-[#062D4C] dark:text-slate-300 mb-1">
                  الوصف والملخص المشترك
                </label>
                <textarea
                  rows={3}
                  value={draftSummary}
                  onChange={(e) => setDraftSummary(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-medium text-[#062D4C] dark:text-white"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={savingCollab}
                  onClick={() => void handleSaveEdits()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-xl cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{savingCollab ? 'جاري الحفظ...' : 'حفظ التعديلات التعاونية'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {resolvedThumb && (
                <div className="rounded-xl border-2 border-[#062D4C] overflow-hidden aspect-video max-h-56 w-full bg-slate-900">
                  <img
                    src={resolvedThumb}
                    alt={bundle.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {bundle.summary && (
                <p className="text-sm font-medium text-slate-600 dark:text-slate-200 leading-relaxed">
                  {bundle.summary}
                </p>
              )}
            </div>
          )}

          {/* Type-specific rich read view */}
          {bundle.learningPath && (
            <div className="space-y-2.5">
              <div className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                خطوات المسار التعليمي ({bundle.learningPath.steps.length})
              </div>
              <ul className="space-y-2">
                {bundle.learningPath.steps.map((s, idx) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white truncate">
                        {idx + 1}. {s.title}
                      </div>
                      {s.description && (
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                          {s.description}
                        </div>
                      )}
                    </div>
                    {s.videoUrl && (
                      <a
                        href={normalizeUrl(s.videoUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-[#062D4C] dark:text-sky-300 bg-white dark:bg-slate-900 border border-[#062D4C]/25 rounded-lg shrink-0"
                      >
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                        <span>فتح</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {bundle.course && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                  {bundle.course.platform} · {bundle.course.category} ({bundle.course.videos.length} فيديو)
                </span>
                <a
                  href={normalizeUrl(bundle.course.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-[#B92622] dark:text-amber-300 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>صفحة الكورس</span>
                </a>
              </div>
              {bundle.course.videos.length > 0 && (
                <ul className="space-y-1.5">
                  {bundle.course.videos.map((v, idx) => (
                    <li
                      key={v.id}
                      className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-[#062D4C] dark:text-slate-200 flex items-center justify-between gap-2"
                    >
                      <span>{idx + 1}. {v.title}</span>
                      {v.duration && <span className="text-slate-500">{v.duration}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {bundle.savedGameJam && (
            <div className="space-y-2.5 rounded-xl border border-[#062D4C]/20 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
              <div className="text-xs font-bold text-slate-600 dark:text-amber-300">
                {bundle.savedGameJam.platform} · {bundle.savedGameJam.location} · {bundle.savedGameJam.startDate} → {bundle.savedGameJam.endDate}
              </div>
              {bundle.savedGameJam.theme && (
                <div className="text-xs font-extrabold text-[#062D4C] dark:text-white">
                  الثيم: {bundle.savedGameJam.theme}
                </div>
              )}
              {bundle.savedGameJam.personalNotes && (
                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-lg p-2.5 border border-[#062D4C]/15">
                  ملاحظات مرفقة: {bundle.savedGameJam.personalNotes}
                </div>
              )}
              <a
                href={normalizeUrl(bundle.savedGameJam.officialUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#B92622] dark:text-sky-300 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                <span>الموقع الرسمي للمسابقة</span>
              </a>
            </div>
          )}

          {bundle.learningBoard && (
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                بطاقات لوحة التعلم ({bundle.learningBoard.cards.length})
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {bundle.learningBoard.cards.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-1"
                  >
                    <div className="text-xs font-extrabold text-[#062D4C] dark:text-white">{c.title}</div>
                    {c.sourceLabel && <div className="text-[11px] font-bold text-slate-500">{c.sourceLabel}</div>}
                    {c.noteText && <div className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{c.noteText}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {bundle.note && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                المجلد: {bundle.note.folder}
              </div>
              <div
                className="rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 text-sm leading-relaxed text-[#062D4C] dark:text-slate-100 prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: bundle.note.contentHtml }}
              />
            </div>
          )}

          {bundle.vaultProject && (
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                تفاصيل المشروع ({bundle.vaultProject.project.fileType})
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {bundle.vaultProject.project.description}
              </p>
              {bundle.vaultProject.versionsSummary.map((v, i) => (
                <div key={i} className="rounded-lg bg-slate-50 dark:bg-slate-800 p-3 text-xs">
                  <div className="font-extrabold text-[#062D4C] dark:text-white">
                    {v.versionLabel} · {v.fileNames.length} ملفات
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 mt-1">
                    {v.fileNames.join('، ') || 'ملخص مشروع'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {bundle.libraryAsset && (
            <div className="space-y-2 rounded-xl border border-[#062D4C]/20 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/60">
              <div className="text-xs font-extrabold text-[#062D4C] dark:text-white">
                التصنيف: {bundle.libraryAsset.folder} · الصيغة الرئيسية: {bundle.libraryAsset.primaryExtension}
              </div>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {bundle.libraryAsset.description}
              </p>
              {bundle.libraryAsset.fileSummaries.length > 0 && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  الملفات المرفقة: {bundle.libraryAsset.fileSummaries.map((f) => f.name).join('، ')}
                </div>
              )}
            </div>
          )}

          {bundle.videoCollection && (
            <div className="space-y-2">
              <div className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                فيديوهات المجموعة ({bundle.videoCollection.videos.length})
              </div>
              <ul className="space-y-1.5">
                {bundle.videoCollection.videos.map((v) => (
                  <li
                    key={v.id}
                    className="rounded-lg border border-[#062D4C]/15 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-extrabold text-[#062D4C] dark:text-white truncate">{v.title}</div>
                      <div className="text-[11px] font-bold text-[#B92622] dark:text-amber-300">{v.platformName}</div>
                    </div>
                    <a
                      href={normalizeUrl(v.videoUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-extrabold text-[#062D4C] dark:text-sky-300 bg-white dark:bg-slate-900 border border-[#062D4C]/25 rounded-lg shrink-0"
                    >
                      <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      <span>مشاهدة</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
