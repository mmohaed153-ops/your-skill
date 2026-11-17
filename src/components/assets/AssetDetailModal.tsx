import { useState } from 'react';
import { Box, CheckSquare, Download, Eye, Pencil, Share2, X } from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import type {
  LibraryAsset,
  NoteLinkRef,
  StoredFileRef,
  WorkspaceNote,
} from '../../types/workspace';
import {
  ASSET_CATEGORY_LABELS,
  formatBytes,
  formatShortDate,
  getPreviewKind,
} from '../../utils/workspaceLogic';
import { FileTypeIcon } from '../FileTypeIcon';
import { RelatedNotesSection } from '../notes/RelatedNotesSection';
import { StoredFilePreviewPanel } from '../StoredFilePreviewPanel';
import { PbrMaterialPreviewCanvas } from '../three/PbrMaterialPreviewCanvas';

interface AssetDetailModalProps {
  uid?: string | null;
  asset: LibraryAsset | null;
  notes?: WorkspaceNote[];
  onOpenNoteInWorkspace?: (noteId: string) => void;
  onCreateLinkedNote?: (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => Promise<WorkspaceNote>;
  onCreateTodoForAsset?: (asset: LibraryAsset) => void;
  onShareAsset?: (asset: LibraryAsset) => void;
  onClose: () => void;
  onDownloadBundle: (asset: LibraryAsset) => Promise<void>;
  onDownloadFile: (fileRef: StoredFileRef) => Promise<void>;
  onEditAsset: (asset: LibraryAsset) => void;
}

export function AssetDetailModal({
  uid = null,
  asset,
  notes = [],
  onOpenNoteInWorkspace,
  onCreateLinkedNote,
  onCreateTodoForAsset,
  onShareAsset,
  onClose,
  onDownloadBundle,
  onDownloadFile,
  onEditAsset,
}: AssetDetailModalProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<StoredFileRef | null>(null);
  const [showLivePbr, setShowLivePbr] = useState(true);

  if (!asset) return null;

  const isPbrAsset = asset.category === 'material' || asset.category === 'texture' || Boolean(asset.materialSpec);
  const first3dFile = asset.files.find((f) => getPreviewKind(f.name, f.mimeType) === '3d');
  const resolvedPreview = resolveMediaUrl(asset.previewImage);

  const handleBundle = async () => {
    setBusyId('bundle');
    try {
      await onDownloadBundle(asset);
    } finally {
      setBusyId(null);
    }
  };

  const handleSingle = async (fileRef: StoredFileRef) => {
    setBusyId(fileRef.id);
    try {
      await onDownloadFile(fileRef);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="asset-detail-title" className="text-base sm:text-lg font-extrabold truncate">
              {asset.name}
            </h2>
            <p className="text-xs text-slate-300">
              {ASSET_CATEGORY_LABELS[asset.category]} · {asset.folder} · آخر تحديث{' '}
              {formatShortDate(asset.updatedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPreviewFile(null);
              onClose();
            }}
            aria-label="إغلاق تفاصيل الأصل"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 items-start">
            <div className="sm:col-span-2 rounded-xl border-2 border-[#062D4C] overflow-hidden aspect-[4/3] bg-slate-900">
              {resolvedPreview ? (
                <img
                  src={resolvedPreview}
                  alt={asset.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#062D4C] via-[#0B3B61] to-[#12263A] flex items-center justify-center">
                  <Box className="w-10 h-10 text-slate-300/70" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="sm:col-span-3 space-y-3">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-200 leading-relaxed">
                {asset.description || 'لا يوجد وصف إضافي لهذا الأصل.'}
              </p>

              {asset.tags.length > 0 && (
                <div className="text-xs font-bold text-[#062D4C] dark:text-amber-300">
                  الوسوم: {asset.tags.map((t) => `#${t}`).join(' · ')}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleBundle}
                  disabled={busyId === 'bundle'}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
                >
                  <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {busyId === 'bundle'
                      ? 'جاري التحميل...'
                      : asset.files.length > 1
                        ? `تحميل الحزمة كاملة (${asset.files.length} ملفات .zip)`
                        : 'تحميل الملف الأصلي'}
                  </span>
                </button>

                {first3dFile && (
                  <button
                    type="button"
                    data-testid="asset-inspect-3d-btn"
                    onClick={() => setPreviewFile(first3dFile)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] rounded-xl cursor-pointer"
                  >
                    <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>معاينة 3D تفاعلية</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPreviewFile(null);
                    onClose();
                    onEditAsset(asset);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl cursor-pointer"
                >
                  <Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>تعديل أو استبدال الملفات</span>
                </button>

                {onShareAsset && (
                  <button
                    type="button"
                    onClick={() => onShareAsset(asset)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-extrabold text-[#062D4C] dark:text-sky-300 bg-white dark:bg-slate-800 hover:bg-sky-50 border-2 border-[#062D4C]/40 dark:border-slate-600 rounded-xl cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>مشاركة</span>
                  </button>
                )}

                {onCreateTodoForAsset && (
                  <button
                    type="button"
                    onClick={() => onCreateTodoForAsset(asset)}
                    className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-extrabold text-[#062D4C] dark:text-amber-300 bg-white dark:bg-slate-800 hover:bg-amber-50 border-2 border-[#062D4C]/40 dark:border-slate-600 rounded-xl cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>إضافة مهمة</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {isPbrAsset && (
            <div className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-amber-50/40 dark:bg-slate-800/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                  معاينة خامة PBR المباشرة (Real-Time Shader Preview)
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLivePbr((v) => !v)}
                  className="text-xs font-bold text-[#B92622] dark:text-amber-300 hover:underline cursor-pointer"
                >
                  {showLivePbr ? 'إخفاء المعاينة' : 'إظهار المعاينة'}
                </button>
              </div>
              {showLivePbr && (
                <PbrMaterialPreviewCanvas
                  files={asset.files}
                  uid={uid}
                  materialSpec={asset.materialSpec}
                />
              )}
            </div>
          )}

          <div className="space-y-2.5 pt-3 border-t-2 border-[#062D4C]/10 dark:border-slate-700">
            <h3 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white tabular-nums">
              الملفات المرفقة ({asset.files.length} · {formatBytes(asset.totalSizeBytes)})
            </h3>

            {previewFile && (
              <StoredFilePreviewPanel
                fileRef={previewFile}
                uid={uid}
                onClose={() => setPreviewFile(null)}
              />
            )}

            <ul className="space-y-2">
              {asset.files.map((fileRef) => {
                const canPreview = getPreviewKind(fileRef.name, fileRef.mimeType) !== 'none';
                return (
                  <li
                    key={fileRef.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <FileTypeIcon
                        filename={fileRef.name}
                        mimeType={fileRef.mimeType}
                        className="w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white truncate">
                          {fileRef.name}
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                          {fileRef.extension} · {formatBytes(fileRef.size)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {canPreview && (
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewFile((prev) => (prev?.id === fileRef.id ? null : fileRef))
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#062D4C] dark:text-sky-300 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 border border-[#062D4C]/30 rounded-lg cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                          <span>معاينة</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSingle(fileRef)}
                        disabled={busyId === fileRef.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg cursor-pointer shrink-0"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>{busyId === fileRef.id ? 'جاري التنزيل...' : 'تنزيل'}</span>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {onOpenNoteInWorkspace && onCreateLinkedNote && (
            <RelatedNotesSection
              targetType="library_asset"
              targetId={asset.id}
              targetLabel={asset.name}
              notes={notes}
              onOpenNoteInWorkspace={onOpenNoteInWorkspace}
              onCreateLinkedNote={onCreateLinkedNote}
            />
          )}
        </div>
      </div>
    </div>
  );
}
