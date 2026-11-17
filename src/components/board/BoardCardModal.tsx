import { useEffect, useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import type { BoardAccentColor, BoardCard } from '../../types/workspace';
import { BOARD_ACCENT_STYLES, validateBoardVideoInput } from '../../utils/boardLogic';

interface BoardCardModalProps {
  card: BoardCard | null;
  onClose: () => void;
  onSave: (cardId: string, patch: Partial<BoardCard>) => void;
}

export function BoardCardModal({ card, onClose, onSave }: BoardCardModalProps) {
  const [title, setTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [sourceLabel, setSourceLabel] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [noteText, setNoteText] = useState('');
  const [rotation, setRotation] = useState(0);
  const [accentColor, setAccentColor] = useState<BoardAccentColor>('crimson');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!card) return;
    setError(null);
    setTitle(card.title);
    setVideoUrl(card.videoUrl);
    setSourceLabel(card.sourceLabel);
    setThumbnailUrl(card.thumbnailUrl);
    setNoteText(card.noteText || '');
    setRotation(card.rotation || 0);
    setAccentColor(card.accentColor);
  }, [card]);

  if (!card) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (card.kind === 'video') {
      const err = validateBoardVideoInput({ title, videoUrl });
      if (err) {
        setError(err);
        return;
      }
      onSave(card.id, {
        title: title.trim(),
        videoUrl: videoUrl.trim(),
        sourceLabel: sourceLabel.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        accentColor,
      });
    } else {
      if (!title.trim()) {
        setError('يرجى كتابة عنوان البطاقة.');
        return;
      }
      onSave(card.id, {
        title: title.trim(),
        sourceLabel: sourceLabel.trim(),
        ...(card.kind === 'image'
          ? { noteText: noteText.slice(0, 4000), rotation: Number(rotation) || 0 }
          : {}),
        accentColor,
      });
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-card-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
            <h2 id="board-card-edit-title" className="text-base font-extrabold">
              تعديل بيانات البطاقة
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة التعديل"
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-lg border-2 border-[#B92622] bg-rose-50 px-3 py-2 text-xs font-bold text-[#B92622]"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="board-edit-card-title"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              العنوان *
            </label>
            <input
              id="board-edit-card-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          {card.kind === 'video' && (
            <>
              <div>
                <label
                  htmlFor="board-edit-card-url"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  رابط الفيديو *
                </label>
                <input
                  id="board-edit-card-url"
                  type="url"
                  dir="ltr"
                  required
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="board-edit-card-thumb"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  رابط الصورة المصغرة
                </label>
                <input
                  id="board-edit-card-thumb"
                  type="text"
                  dir="ltr"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label
              htmlFor="board-edit-card-source"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              المصدر / التصنيف
            </label>
            <input
              id="board-edit-card-source"
              type="text"
              value={sourceLabel}
              onChange={(e) => setSourceLabel(e.target.value)}
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          {card.kind === 'image' && (
            <>
              <div>
                <label
                  htmlFor="board-edit-card-image-desc"
                  className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  وصف أو تسمية توضيحية للصورة
                </label>
                <textarea
                  id="board-edit-card-image-desc"
                  rows={2}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="أضف وصفاً قصيراً أو شرحاً للصورة..."
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="board-edit-card-rotation"
                  className="flex items-center justify-between text-xs font-extrabold text-[#062D4C] dark:text-slate-200 mb-1.5"
                >
                  <span>زاوية الدوران</span>
                  <span dir="ltr" className="tabular-nums text-[#B92622] dark:text-amber-300">
                    {rotation}°
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="board-edit-card-rotation"
                    type="range"
                    min={-180}
                    max={180}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="flex-1 accent-[#B92622] cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => setRotation(0)}
                    className="px-2.5 py-1 text-xs font-bold text-[#062D4C] dark:text-slate-200 bg-amber-50 dark:bg-slate-800 border border-[#062D4C]/25 rounded-lg cursor-pointer"
                  >
                    0°
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <span className="block text-xs font-extrabold text-[#062D4C] dark:text-slate-300">
              لون الدبوس والإطار
            </span>
            <div className="flex flex-wrap items-center gap-2">
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

          <div className="pt-3 border-t border-[#062D4C]/15 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
