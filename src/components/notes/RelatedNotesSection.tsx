import { useState } from 'react';
import { ArrowUpRight, NotebookPen, Plus, StickyNote } from 'lucide-react';
import type { NoteLinkRef, NoteLinkTargetType, WorkspaceNote } from '../../types/workspace';
import { formatShortDate } from '../../utils/workspaceLogic';
import { getNotesLinkedToTarget } from '../../utils/notesLogic';

interface RelatedNotesSectionProps {
  targetType: NoteLinkTargetType;
  targetId: string;
  parentId?: string;
  targetLabel: string;
  notes: WorkspaceNote[];
  onOpenNoteInWorkspace: (noteId: string) => void;
  onCreateLinkedNote: (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => Promise<WorkspaceNote>;
}

export function RelatedNotesSection({
  targetType,
  targetId,
  parentId = '',
  targetLabel,
  notes,
  onOpenNoteInWorkspace,
  onCreateLinkedNote,
}: RelatedNotesSectionProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const linkedNotes = getNotesLinkedToTarget(notes, targetType, targetId);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim() || `ملاحظة حول ${targetLabel}`;
    const escapedBody = body
      .trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const contentHtml = escapedBody
      ? `<p>${escapedBody.replace(/\n/g, '<br>')}</p>`
      : '<p></p>';

    setSaving(true);
    try {
      await onCreateLinkedNote({
        title: cleanTitle,
        contentHtml,
        link: {
          type: targetType,
          targetId,
          parentId,
          label: targetLabel,
        },
      });
      setTitle('');
      setBody('');
      setComposerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-label="الملاحظات المرتبطة"
      className="pt-4 border-t-2 border-[#062D4C]/15 dark:border-slate-700 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-sm font-extrabold text-[#062D4C] dark:text-white">
          <NotebookPen className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
          <span>ملاحظات مساحة العمل المرتبطة ({linkedNotes.length})</span>
        </div>

        <button
          type="button"
          data-testid={`create-linked-note-toggle-${targetType}`}
          onClick={() => setComposerOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>{composerOpen ? 'إلغاء' : 'إنشاء ملاحظة مرتبطة'}</span>
        </button>
      </div>

      {composerOpen && (
        <form
          onSubmit={handleCreate}
          className="p-3.5 rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-600 bg-amber-50/40 dark:bg-slate-800/80 space-y-2.5"
        >
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`عنوان الملاحظة (مثال: ملاحظات ${targetLabel})`}
            aria-label="عنوان الملاحظة المرتبطة"
            className="w-full px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-white dark:bg-slate-900 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none"
          />
          <textarea
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="اكتب محتوى الملاحظة هنا، ويمكنك لاحقاً تنسيقها بالأكواد والقوائم من قسم الملاحظات..."
            aria-label="محتوى الملاحظة المرتبطة"
            className="w-full px-3 py-2 text-xs sm:text-sm font-medium text-[#062D4C] dark:text-slate-100 bg-white dark:bg-slate-900 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none resize-y"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] rounded-lg cursor-pointer disabled:opacity-60"
            >
              {saving ? 'جاري الحفظ...' : 'حفظ وربط الملاحظة'}
            </button>
          </div>
        </form>
      )}

      {linkedNotes.length === 0 ? (
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
          لا توجد ملاحظات مرتبطة بهذا العنصر بعد. يمكنك إنشاء ملاحظة مخصصة وحفظها في قسم الملاحظات.
        </p>
      ) : (
        <ul className="space-y-2">
          {linkedNotes.map((note) => (
            <li
              key={note.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white truncate">
                  <StickyNote className="w-3.5 h-3.5 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                  <span className="truncate">{note.title}</span>
                </div>
                {note.plainPreview && (
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                    {note.plainPreview}
                  </p>
                )}
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                  {note.folder} · آخر تعديل {formatShortDate(note.updatedAt)}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onOpenNoteInWorkspace(note.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>فتح</span>
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
