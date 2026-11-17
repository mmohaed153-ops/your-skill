import { useEffect, useState } from 'react';
import { Eye, X } from 'lucide-react';
import { retrieveFileBlob } from '../lib/fileStorage';
import type { StoredFileRef } from '../types/workspace';
import { formatBytes, getPreviewKind } from '../utils/workspaceLogic';
import { Model3DPreviewCanvas } from './three/Model3DPreviewCanvas';

interface StoredFilePreviewPanelProps {
  fileRef: StoredFileRef;
  uid: string | null;
  onClose: () => void;
}

export function StoredFilePreviewPanel({
  fileRef,
  uid,
  onClose,
}: StoredFilePreviewPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textPreview, setTextPreview] = useState<string | null>(null);

  const previewKind = getPreviewKind(fileRef.name, fileRef.mimeType);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    setLoading(true);
    setError(null);
    setObjectUrl(null);
    setTextPreview(null);

    if (previewKind === 'none' || previewKind === '3d') {
      setLoading(false);
      return;
    }

    retrieveFileBlob(fileRef, uid)
      .then(async (blob) => {
        if (!active) return;
        if (previewKind === 'text') {
          const slice = blob.slice(0, 64_000);
          const text = await slice.text();
          if (active) {
            setTextPreview(text + (blob.size > 64_000 ? '\n\n... (تم عرض أول 64 KB للمعاينة)' : ''));
          }
        } else {
          createdUrl = URL.createObjectURL(blob);
          if (active) {
            setObjectUrl(createdUrl);
          }
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'تعذر تحميل المعاينة.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [fileRef, uid, previewKind]);

  return (
    <div
      data-testid="stored-file-preview-panel"
      className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-slate-50 dark:bg-slate-950 p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white min-w-0">
          <Eye className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
          <span className="truncate">معاينة: {fileRef.name}</span>
          <span className="text-slate-500 dark:text-slate-400 tabular-nums shrink-0">
            ({formatBytes(fileRef.size)})
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق المعاينة"
          className="p-1 text-slate-500 hover:text-[#062D4C] dark:text-slate-400 dark:hover:text-white rounded-lg cursor-pointer shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-bold text-[#062D4C] dark:text-slate-300">
          جاري تجهيز معاينة الملف...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-[#B92622] bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs font-bold text-[#B92622] dark:text-rose-200">
          {error}
        </div>
      ) : previewKind === 'none' ? (
        <div className="rounded-lg border border-[#062D4C]/20 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
          هذا النوع من الملفات ({fileRef.extension}) غير قابل للمعاينة المباشرة داخل المتصفح، ولكن تم حفظه بالكامل ويمكنك تنزيله واستعادته بالصيغة الأصلية في أي وقت.
        </div>
      ) : previewKind === '3d' ? (
        <Model3DPreviewCanvas fileRef={fileRef} uid={uid} />
      ) : previewKind === 'image' && objectUrl ? (
        <div className="rounded-lg overflow-hidden border border-[#062D4C]/25 dark:border-slate-700 bg-slate-900 flex items-center justify-center max-h-72">
          <img
            src={objectUrl}
            alt={fileRef.name}
            className="max-h-72 w-auto object-contain"
          />
        </div>
      ) : previewKind === 'audio' && objectUrl ? (
        <audio src={objectUrl} controls className="w-full" />
      ) : previewKind === 'video' && objectUrl ? (
        <video src={objectUrl} controls className="w-full max-h-72 rounded-lg bg-black" />
      ) : previewKind === 'text' && textPreview !== null ? (
        <pre
          dir="ltr"
          className="rounded-lg border border-[#062D4C]/25 dark:border-slate-700 bg-slate-900 text-slate-100 p-3 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-words"
        >
          {textPreview}
        </pre>
      ) : null}
    </div>
  );
}
