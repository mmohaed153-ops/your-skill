import { useEffect, useState } from 'react';
import { LayoutDashboard, Save, X } from 'lucide-react';
import type { LearningBoard } from '../../types/workspace';

interface BoardMetaModalProps {
  open: boolean;
  mode: 'create' | 'rename';
  initialBoard: LearningBoard | null;
  onClose: () => void;
  onSubmit: (input: { title: string; description: string }) => Promise<void> | void;
}

export function BoardMetaModal({
  open,
  mode,
  initialBoard,
  onClose,
  onSubmit,
}: BoardMetaModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    if (mode === 'rename' && initialBoard) {
      setTitle(initialBoard.title);
      setDescription(initialBoard.description);
    } else {
      setTitle('');
      setDescription('');
    }
  }, [open, mode, initialBoard]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('يرجى كتابة اسم للوحة التعلم.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim() });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="board-meta-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[6px_7px_0_#062D4C] overflow-hidden">
        <div className="px-6 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-amber-300 shrink-0" aria-hidden="true" />
            <h2 id="board-meta-modal-title" className="text-base font-extrabold">
              {mode === 'rename' ? 'تعديل اسم ووصف اللوحة' : 'إنشاء لوحة تعلم جديدة'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نافذة اللوحة"
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
              htmlFor="board-meta-title-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              اسم لوحة التعلم *
            </label>
            <input
              id="board-meta-title-input"
              data-testid="board-meta-title-input"
              type="text"
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: لوحة تعلم محرك Godot وبناء الألعاب"
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="board-meta-desc-input"
              className="block text-sm font-bold text-[#062D4C] dark:text-slate-200 mb-1.5"
            >
              وصف مختصر (اختياري)
            </label>
            <textarea
              id="board-meta-desc-input"
              rows={2}
              maxLength={600}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="الهدف من هذه اللوحة وما الذي تريد تنظيمه بداخلها..."
              className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm font-medium text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#062D4C]/15 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              data-testid="board-meta-submit-btn"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer"
            >
              <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{mode === 'rename' ? 'حفظ التغييرات' : 'إنشاء اللوحة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
