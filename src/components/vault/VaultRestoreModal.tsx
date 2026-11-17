import { useEffect, useState } from 'react';
import {
  ArchiveRestore,
  CheckSquare,
  Download,
  Eye,
  History,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import type {
  NoteLinkRef,
  StoredFileRef,
  VaultProject,
  VaultVersion,
  WorkspaceNote,
} from '../../types/workspace';
import { formatBytes, formatShortDate, getPreviewKind } from '../../utils/workspaceLogic';
import { FileTypeIcon } from '../FileTypeIcon';
import { RelatedNotesSection } from '../notes/RelatedNotesSection';
import { StoredFilePreviewPanel } from '../StoredFilePreviewPanel';

interface VaultRestoreModalProps {
  open: boolean;
  uid?: string | null;
  project: VaultProject | null;
  versions: VaultVersion[];
  notes?: WorkspaceNote[];
  onOpenNoteInWorkspace?: (noteId: string) => void;
  onCreateLinkedNote?: (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => Promise<WorkspaceNote>;
  onCreateTodoForProject?: (project: VaultProject) => void;
  onShareProject?: (project: VaultProject) => void;
  onClose: () => void;
  onRestoreVersion: (project: VaultProject, version: VaultVersion) => Promise<void>;
  onDownloadFile: (fileRef: StoredFileRef) => Promise<void>;
}

export function VaultRestoreModal({
  open,
  uid = null,
  project,
  versions,
  notes = [],
  onOpenNoteInWorkspace,
  onCreateLinkedNote,
  onCreateTodoForProject,
  onShareProject,
  onClose,
  onRestoreVersion,
  onDownloadFile,
}: VaultRestoreModalProps) {
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [previewFile, setPreviewFile] = useState<StoredFileRef | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (open && versions.length > 0) {
      setSelectedVersionId(versions[0].id);
      setPreviewFile(null);
    }
  }, [open, project?.id, versions]);

  if (!open || !project) return null;

  const activeVersion = versions.find((v) => v.id === selectedVersionId) || versions[0];

  const handleRestoreAll = async () => {
    if (!activeVersion) return;
    setBusyId('bundle');
    try {
      await onRestoreVersion(project, activeVersion);
    } finally {
      setBusyId(null);
    }
  };

  const handleSingleFile = async (fileRef: StoredFileRef) => {
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
      aria-labelledby="vault-restore-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#059669] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" aria-hidden="true" />
            <div className="min-w-0">
              <h2 id="vault-restore-title" className="text-base sm:text-lg font-extrabold truncate">
                استعادة المشروع: {project.name}
              </h2>
              <p className="text-xs text-slate-300">
                اختر الإصدار المطلوب لمعاينة ملفاته أو تنزيلها واستعادتها بأمان.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onShareProject && (
              <button
                type="button"
                onClick={() => onShareProject(project)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] bg-sky-100 hover:bg-sky-200 rounded-lg cursor-pointer"
              >
                <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>مشاركة</span>
              </button>
            )}
            {onCreateTodoForProject && (
              <button
                type="button"
                onClick={() => onCreateTodoForProject(project)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] bg-amber-100 hover:bg-amber-200 rounded-lg cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>إضافة مهمة</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق نافذة الاستعادة"
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {versions.length === 0 ? (
            <div className="py-10 text-center text-sm font-bold text-slate-600 dark:text-slate-300">
              لا توجد نسخ محفوظة لهذا المشروع بعد.
            </div>
          ) : (
            <>
              {/* Version History Selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#062D4C] dark:text-white">
                  <History className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>سجل النسخ الاحتياطية ({versions.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {versions.map((v) => {
                    const selected = activeVersion?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVersionId(v.id);
                          setPreviewFile(null);
                        }}
                        className={`p-3 rounded-xl border-2 text-right transition-colors cursor-pointer ${
                          selected
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-600 shadow-[2px_3px_0_#059669]'
                            : 'bg-white dark:bg-slate-800 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white">
                          <span>{v.versionLabel}</span>
                          <span className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                            {formatShortDate(v.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-1 line-clamp-1">
                          {v.notes || 'نسخة احتياطية كاملة'}
                        </p>
                        <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400 mt-1 tabular-nums">
                          {v.files.length} {v.files.length === 1 ? 'ملف' : 'ملفات'} · {formatBytes(v.totalSizeBytes)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Files Inside Selected Version */}
              {activeVersion && (
                <div className="space-y-3 pt-2 border-t-2 border-[#062D4C]/10 dark:border-slate-700">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white">
                        ملفات النسخة {activeVersion.versionLabel}
                      </h3>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                        {activeVersion.notes}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleRestoreAll}
                      disabled={busyId === 'bundle'}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer whitespace-nowrap"
                    >
                      <ArchiveRestore className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>
                        {busyId === 'bundle'
                          ? 'جاري تجهيز الاستعادة...'
                          : activeVersion.files.length > 1
                            ? 'استعادة المشروع بالكامل (.zip)'
                            : 'استعادة وتحميل المشروع'}
                      </span>
                    </button>
                  </div>

                  {previewFile && (
                    <StoredFilePreviewPanel
                      fileRef={previewFile}
                      uid={uid}
                      onClose={() => setPreviewFile(null)}
                    />
                  )}

                  <ul className="space-y-2">
                    {activeVersion.files.map((fileRef) => {
                      const canPreview = getPreviewKind(fileRef.name, fileRef.mimeType) !== 'none';
                      return (
                        <li
                          key={fileRef.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-amber-50/30 dark:bg-slate-800 px-3.5 py-2.5"
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
                                  setPreviewFile((prev) =>
                                    prev?.id === fileRef.id ? null : fileRef
                                  )
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#062D4C] dark:text-amber-300 bg-amber-50 dark:bg-slate-900 hover:bg-amber-100 border border-[#062D4C]/30 rounded-lg cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span>معاينة</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleSingleFile(fileRef)}
                              disabled={busyId === fileRef.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white bg-white dark:bg-slate-900 hover:bg-amber-50 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg cursor-pointer shrink-0"
                            >
                              <Download className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{busyId === fileRef.id ? 'جاري التحميل...' : 'تحميل'}</span>
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}

          {onOpenNoteInWorkspace && onCreateLinkedNote && (
            <RelatedNotesSection
              targetType="vault_project"
              targetId={project.id}
              targetLabel={project.name}
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
