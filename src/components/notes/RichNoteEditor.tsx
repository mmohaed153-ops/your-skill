import { useEffect, useRef, useState } from 'react';
import {
  Bold,
  CheckSquare,
  Code2,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  X,
} from 'lucide-react';
import { normalizeSafeLinkHref, sanitizeNoteHtml } from '../../utils/notesLogic';

interface RichNoteEditorProps {
  noteId: string;
  initialHtml: string;
  onChangeHtml: (nextHtml: string) => void;
}

type TextDirectionMode = 'auto' | 'rtl' | 'ltr';

export function RichNoteEditor({
  noteId,
  initialHtml,
  onChangeHtml,
}: RichNoteEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [dirMode, setDirMode] = useState<TextDirectionMode>('auto');
  const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  // Sync editor DOM ONLY when switching notes so caret position never jumps while typing
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const safe = sanitizeNoteHtml(initialHtml || '<p></p>');
    if (el.innerHTML !== safe) {
      el.innerHTML = safe;
    }
    setLinkPopoverOpen(false);
    setLinkUrl('');
    setLinkText('');
    setLinkError(null);
  }, [noteId]);

  const emitChange = () => {
    const el = editorRef.current;
    if (!el) return;
    onChangeHtml(sanitizeNoteHtml(el.innerHTML));
  };

  const captureSelection = () => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || !el || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (el.contains(range.commonAncestorContainer)) {
      savedRangeRef.current = range.cloneRange();
    }
  };

  const restoreOrFocusSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (savedRangeRef.current && el.contains(savedRangeRef.current.commonAncestorContainer)) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    } else if (sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
      savedRangeRef.current = range.cloneRange();
    }
  };

  const runExecCommand = (command: string, value?: string) => {
    restoreOrFocusSelection();
    document.execCommand(command, false, value);
    captureSelection();
    emitChange();
  };

  const insertHtmlAtCursor = (html: string) => {
    restoreOrFocusSelection();
    const inserted = document.execCommand('insertHTML', false, html);
    if (!inserted && editorRef.current) {
      editorRef.current.insertAdjacentHTML('beforeend', html);
    }
    captureSelection();
    emitChange();
  };

  const handleInsertChecklist = () => {
    const el = editorRef.current;
    if (!el) return;
    restoreOrFocusSelection();

    const sel = window.getSelection();
    const anchorEl =
      sel?.anchorNode instanceof Element ? sel.anchorNode : sel?.anchorNode?.parentElement;
    const existingList = anchorEl?.closest('ul[data-checklist="true"]');

    if (existingList) {
      const item = document.createElement('li');
      item.setAttribute('data-checklist-item', 'true');
      item.innerHTML = '<input type="checkbox" /> <span>مهمة جديدة</span>';
      existingList.appendChild(item);
      const textSpan = item.querySelector('span');
      if (textSpan && sel) {
        const range = document.createRange();
        range.selectNodeContents(textSpan);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      captureSelection();
      emitChange();
      return;
    }

    insertHtmlAtCursor(
      '<ul data-checklist="true"><li data-checklist-item="true"><input type="checkbox" /> <span>مهمة جديدة</span></li></ul><p><br></p>'
    );
  };

  const handleInsertCodeBlock = () => {
    const el = editorRef.current;
    if (!el) return;
    restoreOrFocusSelection();

    const preId = `code_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const html = `<pre dir="ltr" data-code-block="true" data-temp-code="${preId}"><code>// code...</code></pre><p><br></p>`;
    const inserted = document.execCommand('insertHTML', false, html);
    if (!inserted) {
      el.insertAdjacentHTML('beforeend', html);
    }

    const insertedPre = el.querySelector(`pre[data-temp-code="${preId}"]`);
    if (insertedPre) {
      insertedPre.removeAttribute('data-temp-code');
      const codeEl = insertedPre.querySelector('code');
      const sel = window.getSelection();
      if (codeEl && sel) {
        const range = document.createRange();
        range.selectNodeContents(codeEl);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    captureSelection();
    emitChange();
  };

  const handleOpenLinkPopover = () => {
    captureSelection();
    const sel = window.getSelection();
    const selectedText = sel ? sel.toString().trim() : '';
    setLinkText(selectedText);
    setLinkUrl('');
    setLinkError(null);
    setLinkPopoverOpen(true);
  };

  const handleInsertLink = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeSafeLinkHref(linkUrl);
    if (!normalized) {
      setLinkError('يرجى إدخال رابط صحيح يبدأ بـ https:// أو اسم نطاق صالح.');
      return;
    }

    const display = (linkText.trim() || normalized)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const safeHref = normalized.replace(/"/g, '&quot;');

    insertHtmlAtCursor(
      `<a href="${safeHref}" target="_blank" rel="noopener noreferrer">${display}</a>&nbsp;`
    );
    setLinkPopoverOpen(false);
    setLinkUrl('');
    setLinkText('');
    setLinkError(null);
  };

  const handleEditorChangeOrClick = (e: React.SyntheticEvent<HTMLDivElement>) => {
    const target = e.target;
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      if (target.checked) {
        target.setAttribute('checked', 'checked');
      } else {
        target.removeAttribute('checked');
      }
      emitChange();
    }
  };

  return (
    <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 overflow-hidden shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155]">
      {/* Rich Text Formatting Toolbar */}
      <div
        role="toolbar"
        aria-label="أدوات تنسيق الملاحظة"
        className="px-3 py-2.5 bg-amber-50/75 dark:bg-slate-800/90 border-b-2 border-[#062D4C]/15 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('formatBlock', 'h1')}
            aria-label="عنوان رئيسي"
            title="عنوان رئيسي (H1)"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <Heading1 className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('formatBlock', 'h2')}
            aria-label="عنوان فرعي"
            title="عنوان فرعي (H2)"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <Heading2 className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('formatBlock', 'p')}
            aria-label="فقرة عادية"
            title="فقرة عادية"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <Pilcrow className="w-4 h-4" aria-hidden="true" />
          </button>

          <span aria-hidden="true" className="w-px h-5 bg-[#062D4C]/15 dark:bg-slate-600 mx-1" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('bold')}
            aria-label="نص عريض"
            title="نص عريض (Bold)"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <Bold className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('italic')}
            aria-label="نص مائل"
            title="نص مائل (Italic)"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <Italic className="w-4 h-4" aria-hidden="true" />
          </button>

          <span aria-hidden="true" className="w-px h-5 bg-[#062D4C]/15 dark:bg-slate-600 mx-1" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('insertUnorderedList')}
            aria-label="قائمة نقطية"
            title="قائمة نقطية"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <List className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => runExecCommand('insertOrderedList')}
            aria-label="قائمة مرقمة"
            title="قائمة مرقمة"
            className="p-2 rounded-lg text-xs font-extrabold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors cursor-pointer"
          >
            <ListOrdered className="w-4 h-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertChecklist}
            aria-label="قائمة تحقق"
            title="قائمة تحقق ومهام"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>مهام</span>
          </button>

          <span aria-hidden="true" className="w-px h-5 bg-[#062D4C]/15 dark:bg-slate-600 mx-1" />

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleInsertCodeBlock}
            aria-label="مربع كود برمجي"
            title="إدراج مربع كود (Code Block)"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Code2 className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
            <span>كود</span>
          </button>

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={handleOpenLinkPopover}
            aria-label="إدراج رابط"
            title="إدراج رابط تشعبي"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-[#062D4C] dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 border border-transparent hover:border-[#062D4C]/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Link2 className="w-4 h-4 text-sky-700 dark:text-sky-300 shrink-0" aria-hidden="true" />
            <span>رابط</span>
          </button>
        </div>

        {/* RTL / Auto / LTR Text Direction Switcher */}
        <div
          role="group"
          aria-label="اتجاه الكتابة"
          className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-white/80 dark:bg-slate-900 border border-[#062D4C]/20 dark:border-slate-700"
        >
          {(['auto', 'rtl', 'ltr'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDirMode(mode)}
              className={`px-2 py-1 text-[11px] font-extrabold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                dirMode === mode
                  ? 'bg-[#062D4C] text-white'
                  : 'text-[#062D4C] dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800'
              }`}
            >
              {mode === 'auto' ? 'تلقائي' : mode === 'rtl' ? 'عربي RTL' : 'EN LTR'}
            </button>
          ))}
        </div>
      </div>

      {/* Inline Insert Link Bar */}
      {linkPopoverOpen && (
        <form
          onSubmit={handleInsertLink}
          className="px-4 py-3 bg-sky-50/70 dark:bg-slate-800 border-b-2 border-[#062D4C]/15 dark:border-slate-700 space-y-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-extrabold text-[#062D4C] dark:text-white">
              إدراج رابط داخل الملاحظة
            </span>
            <button
              type="button"
              onClick={() => setLinkPopoverOpen(false)}
              aria-label="إغلاق نافذة الرابط"
              className="p-1 text-slate-500 hover:text-[#062D4C] dark:text-slate-400 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
            <input
              type="url"
              dir="ltr"
              value={linkUrl}
              onChange={(e) => {
                setLinkUrl(e.target.value);
                if (linkError) setLinkError(null);
              }}
              placeholder="https://example.com"
              aria-label="عنوان الرابط"
              className="sm:col-span-2 px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none text-left"
            />
            <input
              type="text"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              placeholder="نص الرابط (اختياري)"
              aria-label="نص الرابط"
              className="sm:col-span-2 px-3 py-1.5 text-xs sm:text-sm bg-white dark:bg-slate-900 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer whitespace-nowrap"
            >
              إدراج الرابط
            </button>
          </div>
          {linkError && (
            <p className="text-xs font-bold text-[#B92622] dark:text-rose-400">{linkError}</p>
          )}
        </form>
      )}

      {/* Rich ContentEditable Surface */}
      <div
        ref={editorRef}
        data-testid="rich-note-editor-surface"
        role="textbox"
        aria-multiline="true"
        aria-label="محتوى الملاحظة"
        contentEditable
        suppressContentEditableWarning
        dir={dirMode}
        onInput={emitChange}
        onKeyUp={captureSelection}
        onMouseUp={captureSelection}
        onChange={handleEditorChangeOrClick}
        onClick={handleEditorChangeOrClick}
        className="min-h-[340px] max-h-[62vh] overflow-y-auto p-5 sm:p-6 text-sm sm:text-base font-medium text-[#062D4C] dark:text-slate-100 leading-relaxed focus:outline-none [&_h1]:text-2xl [&_h1]:font-black [&_h1]:mt-3 [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-extrabold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1.5 [&_p]:my-1.5 [&_ul]:list-disc [&_ul]:ps-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:ps-6 [&_ol]:my-2 [&_li]:my-1 [&_ul[data-checklist='true']]:list-none [&_ul[data-checklist='true']]:ps-0 [&_li[data-checklist-item='true']]:flex [&_li[data-checklist-item='true']]:items-start [&_li[data-checklist-item='true']]:gap-2.5 [&_li[data-checklist-item='true']]:my-1.5 [&_li[data-checklist-item='true']_input[type='checkbox']]:mt-1 [&_li[data-checklist-item='true']_input[type='checkbox']]:w-4 [&_li[data-checklist-item='true']_input[type='checkbox']]:h-4 [&_li[data-checklist-item='true']_input[type='checkbox']]:accent-emerald-600 [&_li[data-checklist-item='true']_input[type='checkbox']]:cursor-pointer [&_pre]:bg-slate-950 [&_pre]:text-emerald-300 [&_pre]:text-left [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:font-mono [&_pre]:text-xs [&_pre]:sm:text-sm [&_pre]:overflow-x-auto [&_pre]:my-3 [&_pre]:border [&_pre]:border-slate-700 [&_a]:text-[#B92622] [&_a]:dark:text-sky-300 [&_a]:underline [&_a]:font-bold"
      />
    </div>
  );
}
