import { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Download,
  Image as ImageIcon,
  Maximize2,
  RotateCcw,
  RotateCw,
} from 'lucide-react';
import { downloadSingleStoredFile, retrieveFileBlob } from '../../lib/fileStorage';
import type { BoardCard } from '../../types/workspace';
import { BOARD_DEFAULT_IMAGE_HEIGHT } from '../../utils/boardLogic';

interface BoardImageCardBodyProps {
  card: BoardCard;
  uid: string | null;
  noteValue: string;
  onChangeDescription: (nextText: string) => void;
  onStartResize: (e: React.PointerEvent, card: BoardCard) => void;
  onStartRotate: (e: React.PointerEvent, card: BoardCard) => void;
  onDuplicate: (card: BoardCard) => void;
  onBringForward: (cardId: string) => void;
  onSendBackward: (cardId: string) => void;
  onResetRotation: (cardId: string) => void;
}

export function BoardImageCardBody({
  card,
  uid,
  noteValue,
  onChangeDescription,
  onStartResize,
  onStartRotate,
  onDuplicate,
  onBringForward,
  onSendBackward,
  onResetRotation,
}: BoardImageCardBodyProps) {
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const blobId = card.originalFileRef?.blobId || '';
  const refId = card.originalFileRef?.id || '';
  const chunkCount = card.originalFileRef?.chunkCount || 0;
  const fileRefSignature = blobId ? `${blobId}|${refId}|${chunkCount}` : '';
  const latestFileRef = card.originalFileRef;

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;

    if (!fileRefSignature || !latestFileRef) {
      setOriginalUrl(null);
      return;
    }

    retrieveFileBlob(latestFileRef, uid)
      .then((blob) => {
        if (!active || !blob) return;
        createdUrl = URL.createObjectURL(blob);
        setOriginalUrl(createdUrl);
        setImgFailed(false);
      })
      .catch(() => {
        // Keep compact thumbnail fallback silently if offline/unfetched
      });

    return () => {
      active = false;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
    // Intentionally keyed by primitive signature so drag/resize/rotate frames do not revoke active blob URLs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileRefSignature, uid]);

  const displaySrc = originalUrl || card.thumbnailUrl;
  const imgHeight = card.height || BOARD_DEFAULT_IMAGE_HEIGHT;
  const rotation = Math.round(card.rotation || 0);

  const handleDownloadOriginal = async () => {
    if (!card.originalFileRef) return;
    setDownloading(true);
    try {
      await downloadSingleStoredFile(card.originalFileRef, uid);
    } catch {
      // ignore error silently or handled by storage layer
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="relative select-none">
      {/* Image Viewport */}
      <div
        style={{ height: `${imgHeight}px` }}
        className="relative w-full bg-slate-950/90 border-b border-[#062D4C]/15 dark:border-slate-700 overflow-hidden flex items-center justify-center"
      >
        {displaySrc && !imgFailed ? (
          <img
            src={displaySrc}
            alt={card.title}
            draggable={false}
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-contain pointer-events-none"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#062D4C] to-[#0B3D63] text-amber-200 p-4 text-center">
            <ImageIcon className="w-9 h-9 opacity-80" aria-hidden="true" />
            <span className="text-xs font-bold truncate max-w-full">{card.title}</span>
          </div>
        )}

        {/* Rotation Angle Badge when rotated */}
        {rotation !== 0 && (
          <div
            dir="ltr"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute top-2 left-2 rounded-lg bg-[#062D4C]/90 text-amber-300 px-2 py-0.5 text-[10px] font-black border border-white/25 tabular-nums flex items-center gap-1"
          >
            <span>{rotation}°</span>
            <button
              type="button"
              data-testid={`board-image-reset-rot-${card.id}`}
              onClick={() => onResetRotation(card.id)}
              title="إعادة الزاوية إلى 0°"
              aria-label="إعادة الزاوية إلى الصفر"
              className="hover:text-white cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Label / Short Description & Image Controls */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="p-2.5 space-y-2 bg-white dark:bg-slate-900"
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white truncate select-text">
            {card.title}
          </h3>

          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              data-testid={`board-card-forward-${card.id}`}
              onClick={() => onBringForward(card.id)}
              title="تقديم للأمام"
              aria-label={`تقديم "${card.title}" للأمام`}
              className="p-1 text-[#062D4C] dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-800 rounded cursor-pointer"
            >
              <ArrowUp className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid={`board-card-backward-${card.id}`}
              onClick={() => onSendBackward(card.id)}
              title="إرسال للخلف"
              aria-label={`إرسال "${card.title}" للخلف`}
              className="p-1 text-[#062D4C] dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-800 rounded cursor-pointer"
            >
              <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid={`board-card-duplicate-${card.id}`}
              onClick={() => onDuplicate(card)}
              title="تكرار الصورة"
              aria-label={`تكرار "${card.title}"`}
              className="p-1 text-[#062D4C] dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-slate-800 rounded cursor-pointer"
            >
              <CopyPlus className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            <button
              type="button"
              data-testid={`board-image-rotate-${card.id}`}
              onPointerDown={(e) => onStartRotate(e, card)}
              title="اسحب لتدوير الصورة"
              aria-label={`تدوير "${card.title}"`}
              className="p-1 text-[#B92622] dark:text-sky-300 hover:bg-amber-100 dark:hover:bg-slate-800 rounded cursor-grab active:cursor-grabbing"
            >
              <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
            </button>

            {card.originalFileRef && (
              <button
                type="button"
                data-testid={`board-image-download-${card.id}`}
                disabled={downloading}
                onClick={() => void handleDownloadOriginal()}
                title="تنزيل الملف الأصلي"
                aria-label={`تنزيل الصورة الأصلية "${card.title}"`}
                className="p-1 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded cursor-pointer disabled:opacity-45"
              >
                <Download className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        <div dir="ltr" className="flex items-center gap-1.5">
          <input
            type="text"
            dir="rtl"
            data-testid={`board-image-desc-${card.id}`}
            value={noteValue}
            onChange={(e) => onChangeDescription(e.target.value)}
            placeholder="أضف وصفاً أو تسمية قصيرة للصورة..."
            className="flex-1 min-w-0 rounded-lg border border-[#062D4C]/20 dark:border-slate-700 bg-amber-50/55 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-[#062D4C] dark:text-slate-100 focus:border-[#062D4C] focus:outline-none select-text"
          />
          <button
            type="button"
            data-testid={`board-image-resize-${card.id}`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onStartResize(e, card);
            }}
            title="اسحب لتغيير حجم الصورة"
            aria-label={`تغيير حجم "${card.title}"`}
            className="shrink-0 w-7 h-7 rounded-lg bg-[#062D4C] hover:bg-[#B92622] text-white flex items-center justify-center shadow-xs cursor-nwse-resize transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5 rotate-90" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
