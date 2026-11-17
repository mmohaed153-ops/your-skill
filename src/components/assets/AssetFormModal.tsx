import { useEffect, useRef, useState } from 'react';
import { FileUp, Image as ImageIcon, RotateCcw, Sparkles, Trash2, Upload, X } from 'lucide-react';
import { compressImageToDataUrl, resolveMediaUrl } from '../../data/presets';
import type { SaveAssetPayload } from '../../hooks/useAssetLibrary';
import type {
  AssetCategory,
  LibraryAsset,
  PbrMaterialSpec,
  UploadProgressState,
} from '../../types/workspace';
import {
  ASSET_CATEGORY_OPTIONS,
  DEFAULT_ASSET_FOLDERS,
  FILE_CATEGORY_LABELS,
  formatBytes,
  getFileCategoryKind,
  getFileExtension,
  MAX_BUNDLE_FILES,
  MAX_BUNDLE_TOTAL_BYTES,
  MAX_CLOUD_FILE_BYTES,
  normalizePbrMaterialSpec,
  parseTagsInput,
  validateAssetInput,
} from '../../utils/workspaceLogic';
import { FileTypeIcon } from '../FileTypeIcon';

interface AssetFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  initialAsset: LibraryAsset | null;
  existingFolders: string[];
  uploadProgress: UploadProgressState;
  onResetUploadState?: () => void;
  onClose: () => void;
  onSubmit: (payload: SaveAssetPayload) => Promise<void>;
}

export function AssetFormModal({
  open,
  mode,
  initialAsset,
  existingFolders,
  uploadProgress,
  onResetUploadState,
  onClose,
  onSubmit,
}: AssetFormModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<AssetCategory>('3d_model');
  const [folder, setFolder] = useState(DEFAULT_ASSET_FOLDERS[0]);
  const [customFolder, setCustomFolder] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [previewImage, setPreviewImage] = useState('');
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [fileMode, setFileMode] = useState<'replace' | 'append'>('replace');
  const [dragOver, setDragOver] = useState(false);
  const [materialSpec, setMaterialSpec] = useState<PbrMaterialSpec>(() =>
    normalizePbrMaterialSpec()
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wasOpenRef = useRef(false);

  // Initialize ONLY on false -> true transition so background Firestore updates never discard picked files
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setError(null);
      setSubmitting(false);
      setNewFiles([]);
      setCustomFolder('');
      setFileMode('replace');
      setDragOver(false);
      onResetUploadState?.();
      if (mode === 'edit' && initialAsset) {
        setName(initialAsset.name);
        setDescription(initialAsset.description);
        setCategory(initialAsset.category);
        setFolder(initialAsset.folder || DEFAULT_ASSET_FOLDERS[0]);
        setTagsRaw(initialAsset.tags.join(', '));
        setPreviewImage(resolveMediaUrl(initialAsset.previewImage));
        setMaterialSpec(normalizePbrMaterialSpec(initialAsset.materialSpec, initialAsset.files));
      } else {
        setName('');
        setDescription('');
        setCategory('3d_model');
        setFolder(existingFolders[0] || DEFAULT_ASSET_FOLDERS[0]);
        setTagsRaw('');
        setPreviewImage('');
        setMaterialSpec(normalizePbrMaterialSpec());
      }
    }
    wasOpenRef.current = open;
  }, [open, mode, initialAsset, existingFolders, onResetUploadState]);

  if (!open) return null;

  const folderOptions = Array.from(new Set([...DEFAULT_ASSET_FOLDERS, ...existingFolders]));
  const totalSelectedBytes = newFiles.reduce((sum, f) => sum + f.size, 0);

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

    setNewFiles((prev) => {
      const merged = [...prev, ...incoming];
      if (merged.length > MAX_BUNDLE_FILES) {
        setError(`يمكن رفع حتى ${MAX_BUNDLE_FILES} ملف في الدفعة الواحدة. تم اختيار أول ${MAX_BUNDLE_FILES} ملف.`);
        return merged.slice(0, MAX_BUNDLE_FILES);
      }
      const mergedBytes = merged.reduce((sum, f) => sum + f.size, 0);
      if (mergedBytes > MAX_BUNDLE_TOTAL_BYTES) {
        setError(`إجمالي حجم الحزمة يتجاوز ${formatBytes(MAX_BUNDLE_TOTAL_BYTES)}. يرجى تقسيم الملفات.`);
        return prev;
      }
      return merged;
    });
  };

  const handleUploadPreview = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file, 880, 0.8);
      setPreviewImage(compressed);
    } catch {
      setError('تعذر قراءة صورة المعاينة. يرجى اختيار صورة أخرى.');
    }
  };

  const executeSubmit = async () => {
    setError(null);
    onResetUploadState?.();
    const resolvedFolder = (customFolder.trim() || folder).trim();
    const validationErr = validateAssetInput({
      name,
      folder: resolvedFolder,
      hasFiles: newFiles.length > 0 || (mode === 'edit' && Boolean(initialAsset?.files.length)),
      requiresFiles: mode === 'create',
    });
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setSubmitting(true);
    try {
      const normalizedSpec =
        category === 'material' || category === 'texture'
          ? normalizePbrMaterialSpec(materialSpec, mode === 'edit' ? initialAsset?.files || [] : [])
          : undefined;
      await onSubmit({
        name,
        description,
        category,
        folder: resolvedFolder,
        tags: parseTagsInput(tagsRaw),
        previewImage,
        newFiles,
        fileMode,
        ...(normalizedSpec ? { materialSpec: normalizedSpec } : {}),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر حفظ الأصل.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSubmit();
  };

  const canRetryUpload = Boolean(
    !submitting && newFiles.length > 0 && (error || uploadProgress.phase === 'error')
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="asset-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_6px_0_#062D4C] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <h2 id="asset-modal-title" className="text-lg font-extrabold">
            {mode === 'edit' ? 'تعديل الأصل واستبدال الملفات' : 'إضافة أصل جديد إلى المكتبة'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="إغلاق نافذة الأصل"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer disabled:opacity-40"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          {(error || uploadProgress.phase === 'error') && (
            <div
              role="alert"
              className="rounded-xl border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 px-4 py-3 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-200 flex flex-wrap items-center justify-between gap-3"
            >
              <span>{error || uploadProgress.errorMessage || 'تعذر رفع ملفات الأصل.'}</span>
              {canRetryUpload && (
                <button
                  type="button"
                  data-testid="asset-retry-upload-btn"
                  onClick={() => void executeSubmit()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border border-[#062D4C] rounded-lg cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>إعادة المحاولة</span>
                </button>
              )}
            </div>
          )}

          {/* 1. Asset Files Upload */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#062D4C] dark:text-slate-200">
                1. ملفات الأصل (جميع الصيغ مدعومة دون قيود){mode === 'create' ? ' *' : ''}
              </span>
              {newFiles.length > 0 && (
                <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {newFiles.length} ملف · {formatBytes(totalSelectedBytes)}
                </span>
              )}
            </div>

            {mode === 'edit' && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFileMode('replace')}
                  className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                    fileMode === 'replace'
                      ? 'bg-[#B92622] text-white border-[#062D4C]'
                      : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-300 border-[#062D4C]/30'
                  }`}
                >
                  استبدال الملفات بإصدار أحدث
                </button>
                <button
                  type="button"
                  onClick={() => setFileMode('append')}
                  className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                    fileMode === 'append'
                      ? 'bg-[#062D4C] text-white border-[#062D4C]'
                      : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-300 border-[#062D4C]/30'
                  }`}
                >
                  إضافة ملفات جديدة
                </button>
              </div>
            )}

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
              className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[#B92622] bg-slate-100 dark:bg-slate-700'
                  : 'border-[#062D4C]/40 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileUp className="w-6 h-6 text-[#B92622] dark:text-rose-400" aria-hidden="true" />
              <span className="text-sm font-extrabold text-[#062D4C] dark:text-white">
                {mode === 'edit'
                  ? 'اختر أو أسقط ملفات جديدة (اتركه فارغاً للإبقاء على الملفات الحالية)'
                  : 'اضغط لاختيار الملفات أو اسحبها وأفلتها هنا'}
              </span>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                نماذج 3D، خامات، صور، صوتيات، فيديو، مستندات، إضافات، أكواد، أرشيف، أو أي صيغة مخصصة
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                الحد الأقصى: حتى {formatBytes(MAX_CLOUD_FILE_BYTES)} للملف الواحد · {MAX_BUNDLE_FILES} ملف في الدفعة
              </span>
              <input
                data-testid="asset-file-input"
                type="file"
                multiple
                onChange={(e) => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
                className="sr-only"
              />
            </label>

            {newFiles.length > 0 && (
              <ul className="space-y-1.5 max-h-36 overflow-y-auto">
                {newFiles.map((f, idx) => {
                  const kind = getFileCategoryKind(f.name, f.type);
                  return (
                    <li
                      key={`${f.name}-${f.size}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#062D4C]/20 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs"
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
                          onClick={() =>
                            setNewFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          aria-label={`إزالة ${f.name}`}
                          className="p-1 text-[#B92622] hover:bg-rose-50 rounded cursor-pointer disabled:opacity-40"
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

          {/* 2. Optional Custom Preview Image Upload */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-[#062D4C] dark:text-slate-200">
                2. صورة المعاينة أو المصغّر (اختياري)
              </span>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C]/30 rounded-lg cursor-pointer">
                  <ImageIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>رفع صورة معاينة</span>
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
              <div className="w-36 aspect-[4/3] rounded-xl border-2 border-[#062D4C] overflow-hidden bg-slate-900">
                <img src={previewImage} alt="معاينة الأصل" className="w-full h-full object-cover" />
              </div>
            )}
          </div>

          {/* 3. Name & 4. Description */}
          <div>
            <label
              htmlFor="asset-name-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              3. اسم الأصل *
            </label>
            <input
              id="asset-name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: صندوق إمداد ثلاثي الأبعاد SC-07"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="asset-desc-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              4. وصف الأصل وملاحظات الاستخدام
            </label>
            <textarea
              id="asset-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب وصفاً للأصل أو طريقة دمجه وإصدار المحرك المناسب..."
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          {/* 5. Category & Folder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="asset-category-select"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                5. الفئة *
              </label>
              <select
                id="asset-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as AssetCategory)}
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              >
                {ASSET_CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="asset-folder-select"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                المجلد / المجموعة *
              </label>
              <select
                id="asset-folder-select"
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
          </div>

          {(category === 'material' || category === 'texture') && (
            <div className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-amber-300">
                <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>خصائص المادة الفيزيائية (PBR Material Shader)</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <label className="space-y-1 block">
                  <span className="font-bold text-[#062D4C] dark:text-slate-200 block">اللون الأساسي</span>
                  <input
                    type="color"
                    value={materialSpec.colorHex}
                    onChange={(e) =>
                      setMaterialSpec((prev) => ({ ...prev, colorHex: e.target.value }))
                    }
                    className="w-full h-9 rounded-lg border border-[#062D4C]/30 cursor-pointer bg-white"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-[#062D4C] dark:text-slate-200 block tabular-nums">
                    الخشونة ({materialSpec.roughness.toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={materialSpec.roughness}
                    onChange={(e) =>
                      setMaterialSpec((prev) => ({ ...prev, roughness: Number(e.target.value) }))
                    }
                    className="w-full accent-[#B92622]"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-[#062D4C] dark:text-slate-200 block tabular-nums">
                    المعدنية ({materialSpec.metalness.toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={materialSpec.metalness}
                    onChange={(e) =>
                      setMaterialSpec((prev) => ({ ...prev, metalness: Number(e.target.value) }))
                    }
                    className="w-full accent-[#062D4C]"
                  />
                </label>

                <label className="space-y-1 block">
                  <span className="font-bold text-[#062D4C] dark:text-slate-200 block tabular-nums">
                    التكرار ({materialSpec.tiling}x)
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={materialSpec.tiling}
                    onChange={(e) =>
                      setMaterialSpec((prev) => ({ ...prev, tiling: Number(e.target.value) }))
                    }
                    className="w-full accent-emerald-600"
                  />
                </label>
              </div>
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                يتم ربط خرائط Albedo و Normal و Roughness و Metallic تلقائياً من أسماء ملفات الصور المرفوعة لمعاينتها ثلاثياً على الكرة أو المكعب.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="asset-tags-input"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                6. الوسوم (مفصولة بفاصلة)
              </label>
              <input
                id="asset-tags-input"
                type="text"
                value={tagsRaw}
                onChange={(e) => setTagsRaw(e.target.value)}
                placeholder="مثال: 3D, sci-fi, gltf, game-ready"
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="asset-custom-folder"
                className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
              >
                أو أنشئ مجلداً جديداً (اختياري)
              </label>
              <input
                id="asset-custom-folder"
                type="text"
                value={customFolder}
                onChange={(e) => setCustomFolder(e.target.value)}
                placeholder="مثال: حزمة المرحلة الثانية"
                className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
              />
            </div>
          </div>

          {/* Progress Bar */}
          {uploadProgress.active && (
            <div
              data-testid="asset-upload-progress"
              className="rounded-xl border-2 border-[#062D4C] bg-slate-50 dark:bg-slate-800 p-3.5 space-y-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-[#062D4C] dark:text-white">
                <span className="truncate">
                  {uploadProgress.phase === 'saving'
                    ? 'جاري توثيق الأصل في المكتبة...'
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
              data-testid="asset-submit-btn"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-60 border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <Upload className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {submitting
                  ? 'جاري الرفع والحفظ...'
                  : mode === 'edit'
                    ? 'حفظ التعديلات'
                    : 'حفظ الأصل في المكتبة'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
