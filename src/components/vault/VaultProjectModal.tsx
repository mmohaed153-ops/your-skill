import { useEffect, useRef, useState } from 'react';
import {
  FileUp,
  History,
  Image as ImageIcon,
  RefreshCw,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { compressImageToDataUrl, resolveMediaUrl } from '../../data/presets';
import type { UploadProgressState, VaultProject, VaultVersion } from '../../types/workspace';
import {
  DEFAULT_VAULT_FOLDERS,
  FILE_CATEGORY_LABELS,
  formatBytes,
  getFileCategoryKind,
  getFileExtension,
  MAX_BUNDLE_FILES,
  MAX_BUNDLE_TOTAL_BYTES,
  MAX_CLOUD_FILE_BYTES,
  validateVaultProjectInput,
} from '../../utils/workspaceLogic';
import type {
  AddOrReplaceBackupPayload,
  CreateVaultProjectPayload,
  UpdateVaultProjectMetaPayload,
} from '../../hooks/useProjectVault';
import { FileTypeIcon } from '../FileTypeIcon';

type VaultModalMode = 'create' | 'edit_meta' | 'backup';

interface VaultProjectModalProps {
  open: boolean;
  mode: VaultModalMode;
  project: VaultProject | null;
  initialPreset?: {
    name?: string;
    description?: string;
    folder?: string;
    linkedJamId?: string;
  } | null;
  versions: VaultVersion[];
  existingFolders: string[];
  uploadProgress: UploadProgressState;
  onResetUploadState?: () => void;
  onClose: () => void;
  onCreateProject: (payload: CreateVaultProjectPayload) => Promise<void>;
  onUpdateProjectMeta: (projectId: string, payload: UpdateVaultProjectMetaPayload) => Promise<void>;
  onAddOrReplaceBackup: (
    project: VaultProject,
    payload: AddOrReplaceBackupPayload
  ) => Promise<void>;
}

export function VaultProjectModal({
  open,
  mode,
  project,
  initialPreset = null,
  versions,
  existingFolders,
  uploadProgress,
  onResetUploadState,
  onClose,
  onCreateProject,
  onUpdateProjectMeta,
  onAddOrReplaceBackup,
}: VaultProjectModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState(DEFAULT_VAULT_FOLDERS[0]);
  const [customFolder, setCustomFolder] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [notes, setNotes] = useState('');
  const [backupAction, setBackupAction] = useState<'new_version' | 'replace_version'>('new_version');
  const [targetVersionId, setTargetVersionId] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wasOpenRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initialize form ONLY on false -> true transition so background Firestore updates never wipe user-selected files
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setError(null);
      setSubmitting(false);
      setSelectedFiles([]);
      setCustomFolder('');
      setDragOver(false);
      onResetUploadState?.();
      if (mode === 'create') {
        setName(initialPreset?.name || '');
        setDescription(initialPreset?.description || '');
        setFolder(initialPreset?.folder || existingFolders[0] || DEFAULT_VAULT_FOLDERS[0]);
        setPreviewImage('');
        setNotes('');
      } else if (project) {
        setName(project.name);
        setDescription(project.description);
        setFolder(project.folder || DEFAULT_VAULT_FOLDERS[0]);
        setPreviewImage(resolveMediaUrl(project.previewImage));
        setNotes('');
        setBackupAction('new_version');
        setTargetVersionId(versions[0]?.id || '');
      }
    }
    wasOpenRef.current = open;
  }, [open, mode, project, initialPreset, versions, existingFolders, onResetUploadState]);

  if (!open) return null;

  const folderOptions = Array.from(new Set([...DEFAULT_VAULT_FOLDERS, ...existingFolders]));
  const totalSelectedBytes = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const incoming = Array.from(fileList);

    const oversized = incoming.find((f) => f.size > MAX_CLOUD_FILE_BYTES);
    if (oversized) {
      setError(
        `الملف "${oversized.name}" حجمه (${formatBytes(oversized.size)}) يتجاوز الحد الأقصى للملف الواحد (${formatBytes(MAX_CLOUD_FILE_BYTES)}).`
      );
      return;
    }

    setSelectedFiles((prev) => {
      const merged = [...prev, ...incoming];
      if (merged.length > MAX_BUNDLE_FILES) {
        setError(`يمكن رفع حتى ${MAX_BUNDLE_FILES} ملف في الدفعة الواحدة. تم اختيار أول ${MAX_BUNDLE_FILES} ملف.`);
        return merged.slice(0, MAX_BUNDLE_FILES);
      }
      const mergedBytes = merged.reduce((sum, f) => sum + f.size, 0);
      if (mergedBytes > MAX_BUNDLE_TOTAL_BYTES) {
        setError(`إجمالي حجم الحزمة يتجاوز ${formatBytes(MAX_BUNDLE_TOTAL_BYTES)}. يرجى تقسيم الملفات إلى نسخ أصغر.`);
        return prev;
      }
      return merged;
    });
  };

  const handleRemovePendingFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUploadPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 960, 0.8);
      setPreviewImage(compressed);
    } catch {
      setError('تعذر قراءة صورة المعاينة. يرجى تجربة صورة أخرى.');
    }
  };

  const executeSave = async () => {
    const resolvedFolder = (customFolder.trim() || folder).trim();
    setError(null);
    onResetUploadState?.();

    if (mode === 'create') {
      const err = validateVaultProjectInput({
        name,
        folder: resolvedFolder,
        hasFiles: selectedFiles.length > 0,
        requiresFiles: true,
      });
      if (err) {
        setError(err);
        return;
      }
      setSubmitting(true);
      try {
        await onCreateProject({
          name,
          description,
          folder: resolvedFolder,
          previewImage,
          notes,
          files: selectedFiles,
          linkedJamId: initialPreset?.linkedJamId,
        });
        onClose();
      } catch (submitErr) {
        setError(submitErr instanceof Error ? submitErr.message : 'تعذر حفظ المشروع.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'edit_meta' && project) {
      const err = validateVaultProjectInput({
        name,
        folder: resolvedFolder,
        hasFiles: true,
        requiresFiles: false,
      });
      if (err) {
        setError(err);
        return;
      }
      setSubmitting(true);
      try {
        await onUpdateProjectMeta(project.id, {
          name,
          description,
          folder: resolvedFolder,
          previewImage,
        });
        onClose();
      } catch (submitErr) {
        setError(submitErr instanceof Error ? submitErr.message : 'تعذر تحديث المشروع.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (mode === 'backup' && project) {
      if (selectedFiles.length === 0) {
        setError('يرجى رفع ملف واحد على الأقل لحفظ النسخة الاحتياطية.');
        return;
      }
      setSubmitting(true);
      try {
        await onAddOrReplaceBackup(project, {
          mode: backupAction,
          targetVersionId,
          notes,
          files: selectedFiles,
        });
        onClose();
      } catch (submitErr) {
        setError(submitErr instanceof Error ? submitErr.message : 'تعذر حفظ النسخة الاحتياطية.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSave();
  };

  const modalTitle =
    mode === 'create'
      ? 'حفظ مشروع جديد في الخزنة'
      : mode === 'edit_meta'
        ? 'تعديل بيانات المشروع'
        : `إدارة النسخ الاحتياطية: ${project?.name || ''}`;

  const canRetryUpload = Boolean(
    !submitting &&
      mode !== 'edit_meta' &&
      selectedFiles.length > 0 &&
      (error || uploadProgress.phase === 'error')
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vault-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_6px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <h2 id="vault-modal-title" className="text-lg font-extrabold">
            {modalTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="إغلاق نافذة المشروع"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {(error || uploadProgress.phase === 'error') && (
            <div
              role="alert"
              className="rounded-xl border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-200 flex flex-wrap items-center justify-between gap-3"
            >
              <span>{error || uploadProgress.errorMessage || 'تعذر إكمال رفع الملفات.'}</span>
              {canRetryUpload && (
                <button
                  type="button"
                  data-testid="vault-retry-upload-btn"
                  onClick={() => void executeSave()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border border-[#062D4C] rounded-lg cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
            </div>
          )}

          {mode !== 'backup' && (
            <>
              <div>
                <label
                  htmlFor="vault-project-name"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  اسم المشروع *
                </label>
                <input
                  id="vault-project-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: لعبة المنصات العربية - المرحلة النهائية"
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="vault-project-desc"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  وصف المشروع ومحتوياته
                </label>
                <textarea
                  id="vault-project-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ملخص سريع لما يحتويه هذا المشروع أو آخر تعديل تم حفظه..."
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="vault-project-folder"
                    className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                  >
                    المجلد / التصنيف *
                  </label>
                  <select
                    id="vault-project-folder"
                    value={folder}
                    onChange={(e) => setFolder(e.target.value)}
                    className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                  >
                    {folderOptions.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="vault-custom-folder"
                    className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                  >
                    أو أنشئ مجلداً جديداً (اختياري)
                  </label>
                  <input
                    id="vault-custom-folder"
                    type="text"
                    value={customFolder}
                    onChange={(e) => setCustomFolder(e.target.value)}
                    placeholder="مثال: مشاريع التخرج"
                    className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                  />
                </div>
              </div>

              {/* Optional Custom Preview Image Upload (No Preset Artwork) */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#062D4C] dark:text-slate-200">
                    صورة معاينة للمشروع (اختياري)
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C]/30 rounded-lg cursor-pointer">
                      <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>رفع صورة مخصصة</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPreview}
                        className="sr-only"
                      />
                    </label>
                    {previewImage && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage('')}
                        className="px-2.5 py-1.5 text-xs font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                      >
                        إزالة
                      </button>
                    )}
                  </div>
                </div>
                {previewImage && (
                  <div className="w-40 aspect-video rounded-xl border-2 border-[#062D4C] overflow-hidden bg-slate-900">
                    <img src={previewImage} alt="معاينة المشروع" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>
            </>
          )}

          {mode === 'backup' && project && (
            <div className="space-y-3 rounded-xl border-2 border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4">
              <span className="block text-sm font-extrabold text-[#062D4C] dark:text-white">
                كيف تريد حفظ هذه الملفات؟
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setBackupAction('new_version')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-right transition-colors cursor-pointer ${
                    backupAction === 'new_version'
                      ? 'bg-[#062D4C] text-white border-[#062D4C]'
                      : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
                  }`}
                >
                  <History className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <div className="text-xs sm:text-sm font-bold">
                    إنشاء نسخة احتياطية جديدة (v{project.latestVersionNumber + 1}.0)
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupAction('replace_version')}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-right transition-colors cursor-pointer ${
                    backupAction === 'replace_version'
                      ? 'bg-[#B92622] text-white border-[#062D4C]'
                      : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <div className="text-xs sm:text-sm font-bold">
                    استبدال نسخة قديمة بنسخة أحدث
                  </div>
                </button>
              </div>

              {backupAction === 'replace_version' && versions.length > 0 && (
                <div>
                  <label
                    htmlFor="vault-replace-target"
                    className="block text-xs font-bold text-[#062D4C] dark:text-slate-200 mb-1"
                  >
                    اختر النسخة المراد استبدالها:
                  </label>
                  <select
                    id="vault-replace-target"
                    value={targetVersionId}
                    onChange={(e) => setTargetVersionId(e.target.value)}
                    className="w-full rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.versionLabel} — {v.files.length} ملفات ({formatBytes(v.totalSizeBytes)})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {mode !== 'edit_meta' && (
            <>
              {/* Backup Notes */}
              <div>
                <label
                  htmlFor="vault-backup-notes"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  ملاحظات النسخة الاحتياطية
                </label>
                <input
                  id="vault-backup-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="مثال: نسخة مستقرة قبل إضافة المرحلة الثالثة"
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              {/* Multi-file Universal Project Dropzone */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="block text-sm font-bold text-[#062D4C] dark:text-slate-200">
                    ملفات المشروع (جميع الصيغ مدعومة دون قيود) *
                  </label>
                  {selectedFiles.length > 0 && (
                    <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {selectedFiles.length} ملف · {formatBytes(totalSelectedBytes)}
                    </span>
                  )}
                </div>

                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFilesSelected(e.dataTransfer.files);
                  }}
                  className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-[#B92622] bg-slate-100 dark:bg-slate-700'
                      : 'border-[#062D4C]/40 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <FileUp className="w-7 h-7 text-[#B92622] dark:text-rose-400" aria-hidden="true" />
                  <span className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                    اضغط لاختيار الملفات أو اسحبها وأفلتها هنا
                  </span>
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    يدعم: المشاريع (.godot, .blend, .unitypackage)، الأرشيف (.zip, .rar, .7z)، نماذج 3D، الصور، الصوت، الفيديو، المستندات، الأكواد، وأي صيغة أخرى
                  </span>
                  <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    الحد الأقصى: حتى {formatBytes(MAX_CLOUD_FILE_BYTES)} للملف الواحد · {MAX_BUNDLE_FILES} ملف في الدفعة · إجمالي {formatBytes(MAX_BUNDLE_TOTAL_BYTES)}
                  </span>
                  <input
                    ref={fileInputRef}
                    data-testid="vault-file-input"
                    type="file"
                    multiple
                    onChange={(e) => {
                      handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="sr-only"
                  />
                </label>

                {selectedFiles.length > 0 && (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {selectedFiles.map((f, idx) => {
                      const kind = getFileCategoryKind(f.name, f.type);
                      return (
                        <li
                          key={`${f.name}-${f.size}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-[#062D4C]/20 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <FileTypeIcon filename={f.name} mimeType={f.type} className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-bold text-[#062D4C] dark:text-white truncate">
                                {f.name}
                              </div>
                              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                                {getFileExtension(f.name)} · {FILE_CATEGORY_LABELS[kind]}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="tabular-nums text-slate-600 dark:text-slate-300 font-bold">
                              {formatBytes(f.size)}
                            </span>
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => handleRemovePendingFile(idx)}
                              aria-label={`إزالة ${f.name}`}
                              className="p-1 text-[#B92622] hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded cursor-pointer disabled:opacity-40"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}

          {/* Detailed Upload Progress Bar */}
          {uploadProgress.active && (
            <div
              data-testid="vault-upload-progress"
              className="rounded-xl border-2 border-[#062D4C] bg-slate-50 dark:bg-slate-800 p-3.5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#062D4C] dark:text-white">
                <span className="truncate">
                  {uploadProgress.phase === 'saving'
                    ? 'جاري توثيق النسخة النهائية في الخزنة...'
                    : `جاري رفع الملف ${uploadProgress.currentFileIndex} من ${uploadProgress.totalFiles}: ${uploadProgress.fileName}`}
                </span>
                <span className="tabular-nums shrink-0">{uploadProgress.percent}%</span>
              </div>
              <div className="h-2.5 w-full rounded-md bg-white dark:bg-slate-900 border border-[#062D4C]/40 overflow-hidden">
                <div
                  className="h-full bg-emerald-600 transition-all duration-150"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
              {uploadProgress.totalBytes > 0 && (
                <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 tabular-nums text-left">
                  {formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.totalBytes)}
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer disabled:opacity-40"
            >
              إلغاء
            </button>
            <button
              type="submit"
              data-testid="vault-submit-btn"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-60 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {submitting
                  ? 'جاري الرفع والحفظ...'
                  : mode === 'create'
                    ? 'حفظ المشروع في الخزنة'
                    : mode === 'edit_meta'
                      ? 'حفظ التعديلات'
                      : 'حفظ النسخة الاحتياطية'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
