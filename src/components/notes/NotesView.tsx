import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Folder,
  LayoutGrid,
  Link2,
  List as ListIcon,
  NotebookPen,
  Pin,
  PinOff,
  Plus,
  Search,
  Share2,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import type { LearningPath, VideoStep } from '../../types/learning';
import type {
  CourseItem,
  LearningBoard,
  LibraryAsset,
  NoteLinkRef,
  NoteLinkTargetType,
  NoteSortOption,
  NoteViewMode,
  SavedGameJam,
  VaultProject,
  VideoCollection,
  WorkspaceNote,
} from '../../types/workspace';
import {
  DEFAULT_NOTE_FOLDERS,
  filterAndSortNotes,
  NOTE_FOLDER_MAX,
  NOTE_LINK_TYPE_LABELS,
  NOTE_TITLE_MAX,
  removeNoteLink,
  upsertNoteLink,
} from '../../utils/notesLogic';
import { formatShortDate, parseTagsInput } from '../../utils/workspaceLogic';
import type { CreateNoteInput, UpdateNotePatch } from '../../hooks/useNotes';
import { SectionHeroBanner } from '../SectionHeroBanner';
import { RichNoteEditor } from './RichNoteEditor';

export interface LearningStepChoice {
  step: VideoStep;
  pathTitle: string;
}

interface NotesViewProps {
  notes: WorkspaceNote[];
  cloudLoading: boolean;
  selectedNoteId: string | null;
  onSelectNoteId: (noteId: string | null) => void;
  vaultProjects: VaultProject[];
  libraryAssets: LibraryAsset[];
  learningStepChoices: LearningStepChoice[];
  learningPaths?: LearningPath[];
  courses?: CourseItem[];
  learningBoards?: LearningBoard[];
  savedGameJams?: SavedGameJam[];
  videoCollections?: VideoCollection[];
  onCreateNote: (input?: CreateNoteInput) => Promise<WorkspaceNote>;
  onUpdateNote: (noteId: string, patch: UpdateNotePatch) => Promise<void>;
  onTogglePinNote: (note: WorkspaceNote) => Promise<void>;
  onDeleteNote: (note: WorkspaceNote) => void;
  onNavigateToLinkedItem: (link: NoteLinkRef) => void;
  onShareNote?: (note: WorkspaceNote) => void;
}

export function NotesView({
  notes,
  cloudLoading,
  selectedNoteId,
  onSelectNoteId,
  vaultProjects,
  libraryAssets,
  learningStepChoices,
  learningPaths = [],
  courses = [],
  learningBoards = [],
  savedGameJams = [],
  videoCollections = [],
  onCreateNote,
  onUpdateNote,
  onTogglePinNote,
  onDeleteNote,
  onNavigateToLinkedItem,
  onShareNote,
}: NotesViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [linkFilter, setLinkFilter] = useState<NoteLinkTargetType | 'all'>('all');
  const [sortBy, setSortBy] = useState<NoteSortOption>('updated_desc');
  const [viewMode, setViewMode] = useState<NoteViewMode>('cards');

  const activeNote = useMemo(
    () => (selectedNoteId ? notes.find((n) => n.id === selectedNoteId) || null : null),
    [notes, selectedNoteId]
  );

  // Editor draft state & debounced auto-save
  const [draftTitle, setDraftTitle] = useState('');
  const [draftHtml, setDraftHtml] = useState('');
  const [draftFolder, setDraftFolder] = useState(DEFAULT_NOTE_FOLDERS[0]);
  const [customFolderMode, setCustomFolderMode] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [draftLinks, setDraftLinks] = useState<NoteLinkRef[]>([]);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Link composer state inside editor
  const [linkType, setLinkType] = useState<NoteLinkTargetType>('vault_project');
  const [linkTargetId, setLinkTargetId] = useState('');

  const dirtyRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const latestDraftRef = useRef<{
    noteId: string;
    title: string;
    contentHtml: string;
    folder: string;
    tags: string[];
    links: NoteLinkRef[];
  } | null>(null);

  const folders = useMemo(() => {
    const set = new Set<string>(DEFAULT_NOTE_FOLDERS);
    for (const n of notes) {
      if (n.folder) set.add(n.folder);
    }
    return Array.from(set);
  }, [notes]);

  const filteredNotes = useMemo(
    () =>
      filterAndSortNotes(notes, {
        searchQuery,
        folderFilter: selectedFolder,
        onlyPinned,
        linkTypeFilter: linkFilter,
        sortBy,
      }),
    [notes, searchQuery, selectedFolder, onlyPinned, linkFilter, sortBy]
  );

  const pinnedCount = useMemo(() => notes.filter((n) => n.pinned).length, [notes]);
  const linkedCount = useMemo(
    () => notes.filter((n) => n.links.length > 0).length,
    [notes]
  );

  // Sync draft state when switching activeNoteId
  useEffect(() => {
    if (!activeNote) {
      latestDraftRef.current = null;
      dirtyRef.current = false;
      setSaveState('idle');
      return;
    }

    setDraftTitle(activeNote.title);
    setDraftHtml(activeNote.contentHtml);
    setDraftFolder(activeNote.folder || DEFAULT_NOTE_FOLDERS[0]);
    setCustomFolderMode(false);
    setDraftTags(activeNote.tags || []);
    setDraftLinks(activeNote.links || []);
    setTagInput('');
    dirtyRef.current = false;
    setSaveState('saved');

    latestDraftRef.current = {
      noteId: activeNote.id,
      title: activeNote.title,
      contentHtml: activeNote.contentHtml,
      folder: activeNote.folder || DEFAULT_NOTE_FOLDERS[0],
      tags: activeNote.tags || [],
      links: activeNote.links || [],
    };
  }, [activeNote?.id]);

  // Keep linkTargetId aligned with selected linkType
  const availableTargets = useMemo(() => {
    if (linkType === 'vault_project') {
      return vaultProjects.map((p) => ({
        id: p.id,
        parentId: '',
        label: p.name,
      }));
    }
    if (linkType === 'library_asset') {
      return libraryAssets.map((a) => ({
        id: a.id,
        parentId: '',
        label: a.name,
      }));
    }
    if (linkType === 'course') {
      return courses.map((c) => ({
        id: c.id,
        parentId: '',
        label: c.title,
      }));
    }
    if (linkType === 'learning_path') {
      return learningPaths.map((p) => ({
        id: p.id,
        parentId: '',
        label: p.title,
      }));
    }
    if (linkType === 'learning_board') {
      return learningBoards.map((b) => ({
        id: b.id,
        parentId: b.id,
        label: b.title,
      }));
    }
    if (linkType === 'game_jam') {
      return savedGameJams.map((j) => ({
        id: j.id,
        parentId: '',
        label: j.name,
      }));
    }
    if (linkType === 'video_collection') {
      return videoCollections.map((c) => ({
        id: c.id,
        parentId: '',
        label: c.title,
      }));
    }
    return learningStepChoices.map((c) => ({
      id: c.step.id,
      parentId: c.step.pathId,
      label: `${c.step.title} (${c.pathTitle})`,
    }));
  }, [
    linkType,
    vaultProjects,
    libraryAssets,
    courses,
    learningPaths,
    learningBoards,
    savedGameJams,
    videoCollections,
    learningStepChoices,
  ]);

  useEffect(() => {
    if (availableTargets.length > 0) {
      if (!availableTargets.some((t) => t.id === linkTargetId)) {
        setLinkTargetId(availableTargets[0].id);
      }
    } else {
      setLinkTargetId('');
    }
  }, [availableTargets, linkTargetId]);

  const flushPendingSave = async () => {
    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    if (!dirtyRef.current || !latestDraftRef.current) return;
    const payload = latestDraftRef.current;
    dirtyRef.current = false;
    setSaveState('saving');
    await onUpdateNote(payload.noteId, {
      title: payload.title,
      contentHtml: payload.contentHtml,
      folder: payload.folder,
      tags: payload.tags,
      links: payload.links,
    });
    setSaveState('saved');
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current !== null) {
        window.clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const scheduleAutoSave = (next: {
    noteId: string;
    title: string;
    contentHtml: string;
    folder: string;
    tags: string[];
    links: NoteLinkRef[];
  }) => {
    latestDraftRef.current = next;
    dirtyRef.current = true;
    setSaveState('saving');

    if (autoSaveTimerRef.current !== null) {
      window.clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      if (!dirtyRef.current || !latestDraftRef.current) return;
      const payload = latestDraftRef.current;
      dirtyRef.current = false;
      void onUpdateNote(payload.noteId, {
        title: payload.title,
        contentHtml: payload.contentHtml,
        folder: payload.folder,
        tags: payload.tags,
        links: payload.links,
      }).then(() => {
        setSaveState('saved');
      });
    }, 450);
  };

  const handleOpenNote = async (noteId: string) => {
    await flushPendingSave();
    onSelectNoteId(noteId);
  };

  const handleBackToList = async () => {
    await flushPendingSave();
    onSelectNoteId(null);
  };

  const handleCreateNewNote = async () => {
    await flushPendingSave();
    const created = await onCreateNote({
      title: 'ملاحظة جديدة',
      contentHtml: '<p></p>',
      folder: selectedFolder !== 'all' ? selectedFolder : DEFAULT_NOTE_FOLDERS[0],
    });
    onSelectNoteId(created.id);
  };

  const handleAddTags = () => {
    if (!activeNote || !tagInput.trim()) return;
    const merged = Array.from(new Set([...draftTags, ...parseTagsInput(tagInput)])).slice(0, 15);
    setDraftTags(merged);
    setTagInput('');
    scheduleAutoSave({
      noteId: activeNote.id,
      title: draftTitle,
      contentHtml: draftHtml,
      folder: draftFolder,
      tags: merged,
      links: draftLinks,
    });
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (!activeNote) return;
    const nextTags = draftTags.filter((t) => t !== tagToRemove);
    setDraftTags(nextTags);
    scheduleAutoSave({
      noteId: activeNote.id,
      title: draftTitle,
      contentHtml: draftHtml,
      folder: draftFolder,
      tags: nextTags,
      links: draftLinks,
    });
  };

  const handleAttachLink = () => {
    if (!activeNote || !linkTargetId) return;
    const found = availableTargets.find((t) => t.id === linkTargetId);
    if (!found) return;
    const nextLinks = upsertNoteLink(draftLinks, {
      type: linkType,
      targetId: found.id,
      parentId: found.parentId,
      label: found.label,
    });
    setDraftLinks(nextLinks);
    scheduleAutoSave({
      noteId: activeNote.id,
      title: draftTitle,
      contentHtml: draftHtml,
      folder: draftFolder,
      tags: draftTags,
      links: nextLinks,
    });
  };

  const handleDetachLink = (link: NoteLinkRef) => {
    if (!activeNote) return;
    const nextLinks = removeNoteLink(draftLinks, link.type, link.targetId);
    setDraftLinks(nextLinks);
    scheduleAutoSave({
      noteId: activeNote.id,
      title: draftTitle,
      contentHtml: draftHtml,
      folder: draftFolder,
      tags: draftTags,
      links: nextLinks,
    });
  };

  // ==================== EDITOR WORKSPACE VIEW ====================
  if (activeNote) {
    return (
      <div className="space-y-5">
        {/* Editor Top Action Bar */}
        <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="back-to-notes-btn"
              onClick={() => void handleBackToList()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>كل الملاحظات</span>
            </button>

            <span
              data-testid="note-autosave-status"
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-400"
            >
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>
                {saveState === 'saving'
                  ? 'جاري الحفظ تلقائياً...'
                  : 'تم الحفظ تلقائياً في حسابك'}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCreateNewNote()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>ملاحظة جديدة</span>
            </button>

            <button
              type="button"
              onClick={() => void onTogglePinNote(activeNote)}
              aria-label={activeNote.pinned ? 'إلغاء تثبيت الملاحظة' : 'تثبيت الملاحظة في الأعلى'}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold border-2 rounded-xl whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeNote.pinned
                  ? 'bg-amber-100 dark:bg-amber-950/60 text-[#B92622] dark:text-amber-300 border-[#B92622]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30 dark:border-slate-600'
              }`}
            >
              {activeNote.pinned ? (
                <>
                  <PinOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>مثبتة</span>
                </>
              ) : (
                <>
                  <Pin className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>تثبيت</span>
                </>
              )}
            </button>

            {onShareNote && (
              <button
                type="button"
                data-testid="share-selected-note-btn"
                onClick={() => onShareNote(activeNote)}
                aria-label={`مشاركة الملاحظة "${activeNote.title}"`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 border-2 border-[#062D4C] rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>مشاركة هذه الملاحظة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => onDeleteNote(activeNote)}
              aria-label={`حذف "${activeNote.title}"`}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-2 border-[#B92622]/30 rounded-xl whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>حذف</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Primary Rich Editor Column */}
          <div className="lg:col-span-8 space-y-4">
            <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155]">
              <label htmlFor="note-title-input" className="sr-only">
                عنوان الملاحظة
              </label>
              <input
                id="note-title-input"
                data-testid="note-title-input"
                type="text"
                maxLength={NOTE_TITLE_MAX}
                value={draftTitle}
                onChange={(e) => {
                  const val = e.target.value;
                  setDraftTitle(val);
                  scheduleAutoSave({
                    noteId: activeNote.id,
                    title: val,
                    contentHtml: draftHtml,
                    folder: draftFolder,
                    tags: draftTags,
                    links: draftLinks,
                  });
                }}
                placeholder="عنوان الملاحظة..."
                className="w-full text-xl sm:text-2xl font-black text-[#062D4C] dark:text-white bg-transparent focus:outline-none"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                <span>تم الإنشاء: {formatShortDate(activeNote.createdAt)}</span>
                <span aria-hidden="true">·</span>
                <span>آخر تعديل: {formatShortDate(activeNote.updatedAt)}</span>
              </div>
            </div>

            <RichNoteEditor
              noteId={activeNote.id}
              initialHtml={activeNote.contentHtml}
              onChangeHtml={(nextHtml) => {
                setDraftHtml(nextHtml);
                scheduleAutoSave({
                  noteId: activeNote.id,
                  title: draftTitle,
                  contentHtml: nextHtml,
                  folder: draftFolder,
                  tags: draftTags,
                  links: draftLinks,
                });
              }}
            />
          </div>

          {/* Side Organization & Cross-Feature Linkages Column */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Folder & Tags */}
            <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 space-y-4 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor="note-folder-select"
                    className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#062D4C] dark:text-white"
                  >
                    <Folder className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
                    <span>المجلد / التصنيف</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setCustomFolderMode((prev) => !prev)}
                    className="text-xs font-bold text-[#B92622] dark:text-sky-300 hover:underline cursor-pointer"
                  >
                    {customFolderMode ? 'اختيار مجلد' : 'مجلد مخصص'}
                  </button>
                </div>

                {customFolderMode ? (
                  <input
                    id="note-folder-select"
                    type="text"
                    maxLength={NOTE_FOLDER_MAX}
                    value={draftFolder}
                    onChange={(e) => {
                      const nextFolder = e.target.value;
                      setDraftFolder(nextFolder);
                      scheduleAutoSave({
                        noteId: activeNote.id,
                        title: draftTitle,
                        contentHtml: draftHtml,
                        folder: nextFolder,
                        tags: draftTags,
                        links: draftLinks,
                      });
                    }}
                    placeholder="اكتب اسم المجلد..."
                    className="w-full px-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none"
                  />
                ) : (
                  <select
                    id="note-folder-select"
                    value={draftFolder}
                    onChange={(e) => {
                      const nextFolder = e.target.value;
                      setDraftFolder(nextFolder);
                      scheduleAutoSave({
                        noteId: activeNote.id,
                        title: draftTitle,
                        contentHtml: draftHtml,
                        folder: nextFolder,
                        tags: draftTags,
                        links: draftLinks,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none"
                  >
                    {Array.from(new Set([...folders, draftFolder])).map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tags Editor */}
              <div className="pt-3 border-t border-[#062D4C]/15 dark:border-slate-700 space-y-2.5">
                <label
                  htmlFor="note-tag-input"
                  className="inline-flex items-center gap-1.5 text-sm font-extrabold text-[#062D4C] dark:text-white"
                >
                  <Tag className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
                  <span>الوسوم ({draftTags.length}/15)</span>
                </label>

                <div className="flex items-center gap-2">
                  <input
                    id="note-tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',' || e.key === '،') {
                        e.preventDefault();
                        handleAddTags();
                      }
                    }}
                    placeholder="أضف وسماً واضغط Enter..."
                    className="flex-1 min-w-0 px-3 py-1.5 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTags}
                    className="px-3 py-1.5 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer shrink-0"
                  >
                    إضافة
                  </button>
                </div>

                {draftTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {draftTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`إزالة وسم ${tag}`}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-[#062D4C] dark:text-sky-300 bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-[#062D4C]/25 dark:border-slate-600 rounded-md cursor-pointer"
                      >
                        <span>#{tag}</span>
                        <X className="w-3 h-3 text-slate-500" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Connect to Project Vault / Asset Library / Learning Path */}
            <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155]">
              <div className="flex items-center gap-1.5 text-sm font-extrabold text-[#062D4C] dark:text-white">
                <Link2 className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />
                <span>ربط بعناصر المنصة</span>
              </div>

              <div className="space-y-2">
                <label htmlFor="note-link-type-select" className="sr-only">
                  نوع العنصر المرتبط
                </label>
                <select
                  id="note-link-type-select"
                  data-testid="note-link-type-select"
                  value={linkType}
                  onChange={(e) => setLinkType(e.target.value as NoteLinkTargetType)}
                  className="w-full px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none"
                >
                  <option value="vault_project">مشروع في خزنة المشاريع</option>
                  <option value="library_asset">أصل في مكتبة الأصول</option>
                  <option value="learning_step">فيديو في المسار التعليمي</option>
                  <option value="learning_path">مسار تعليمي</option>
                  <option value="course">كورس في كورساتي</option>
                  <option value="learning_board">لوحة التعلم</option>
                  <option value="game_jam">مسابقة ألعاب (Game Jam)</option>
                  <option value="video_collection">مجموعة فيديوهات</option>
                </select>

                <div className="flex items-center gap-2">
                  <label htmlFor="note-link-target-select" className="sr-only">
                    اختر العنصر
                  </label>
                  <select
                    id="note-link-target-select"
                    data-testid="note-link-target-select"
                    value={linkTargetId}
                    onChange={(e) => setLinkTargetId(e.target.value)}
                    disabled={availableTargets.length === 0}
                    className="flex-1 min-w-0 px-3 py-2 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-600 rounded-lg focus:border-[#062D4C] focus:outline-none"
                  >
                    {availableTargets.length === 0 ? (
                      <option value="">لا توجد عناصر متاحة</option>
                    ) : (
                      availableTargets.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    data-testid="attach-note-link-btn"
                    onClick={handleAttachLink}
                    disabled={!linkTargetId}
                    className="px-3 py-2 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-50 rounded-lg cursor-pointer shrink-0"
                  >
                    ربط
                  </button>
                </div>
              </div>

              {draftLinks.length > 0 ? (
                <ul className="space-y-2 pt-1">
                  {draftLinks.map((link) => (
                    <li
                      key={`${link.type}:${link.targetId}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() => onNavigateToLinkedItem(link)}
                        className="min-w-0 text-right group cursor-pointer"
                      >
                        <div className="text-[11px] font-bold text-[#B92622] dark:text-amber-300">
                          {NOTE_LINK_TYPE_LABELS[link.type]}
                        </div>
                        <div className="text-xs font-extrabold text-[#062D4C] dark:text-white truncate flex items-center gap-1 group-hover:underline">
                          <span className="truncate">{link.label}</span>
                          <ArrowUpRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDetachLink(link)}
                        aria-label={`فك ارتباط ${link.label}`}
                        className="p-1 text-slate-400 hover:text-[#B92622] cursor-pointer shrink-0"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  يمكنك ربط هذه الملاحظة بأي مشروع أو أصل أو فيديو تعليمي للوصول السريع لاحقاً.
                </p>
              )}
            </div>

            {/* Quick Note Switcher */}
            {notes.length > 1 && (
              <div className="hidden lg:block rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white/90 dark:bg-slate-900 p-4 space-y-2">
                <div className="text-xs font-extrabold text-[#062D4C] dark:text-slate-200">
                  التنقل السريع بين الملاحظات
                </div>
                <ul className="space-y-1 max-h-48 overflow-y-auto">
                  {filterAndSortNotes(notes, {
                    searchQuery: '',
                    folderFilter: 'all',
                    sortBy: 'updated_desc',
                  })
                    .slice(0, 8)
                    .map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void handleOpenNote(item.id)}
                          className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-bold truncate cursor-pointer transition-colors ${
                            item.id === activeNote.id
                              ? 'bg-[#062D4C] text-white'
                              : 'text-[#062D4C] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {item.pinned ? '📌 ' : ''}
                          {item.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>
    );
  }

  // ==================== NOTES LIBRARY / BROWSER VIEW ====================
  return (
    <div className="space-y-6">
      {/* Notes Workspace Hero Banner */}
      <SectionHeroBanner
        testId="notes-hero-banner"
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
              <NotebookPen className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>مساحة العمل الشخصية للأفكار والأكواد</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-200">
              {notes.length} {notes.length === 1 ? 'ملاحظة محفوظة' : 'ملاحظات محفوظة'}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              {pinnedCount} مثبتة · {linkedCount} مرتبطة
            </span>
          </>
        }
        title="الملاحظات (Notes Workspace)"
        description="دوّن ملاحظاتك البرمجية، قوائم المهام، وأفكار التصميم مع محرر نصوص منسق يدعم العربية والإنجليزية، واربطها مباشرة بمشاريعك وأصولك ودروسك التعليمية."
        actions={[
          {
            id: 'new-note',
            label: 'ملاحظة جديدة',
            icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => void handleCreateNewNote(),
            testId: 'new-note-btn',
            tone: 'crimson',
          },
        ]}
      />

      {/* Search, Sort, View Toggle & Folder Filters */}
      <section
        aria-label="بحث وتنظيم الملاحظات"
        className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3.5"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              data-testid="notes-search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث في العناوين أو المحتوى أو الوسوم أو العناصر المرتبطة..."
              aria-label="البحث في الملاحظات"
              className="w-full rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label htmlFor="notes-sort-select" className="text-xs font-extrabold text-[#062D4C] dark:text-slate-300">
              ترتيب حسب:
            </label>
            <select
              id="notes-sort-select"
              data-testid="notes-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as NoteSortOption)}
              className="px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-700 rounded-lg focus:border-[#062D4C] focus:outline-none"
            >
              <option value="updated_desc">الأحدث تعديلاً</option>
              <option value="created_desc">تاريخ الإنشاء</option>
              <option value="title_asc">أبجدياً (أ - ي)</option>
            </select>

            {/* Cards vs List View Switcher */}
            <div
              role="group"
              aria-label="طريقة عرض الملاحظات"
              className="inline-flex items-center p-0.5 rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
            >
              <button
                type="button"
                data-testid="notes-view-cards"
                onClick={() => setViewMode('cards')}
                aria-label="عرض كبطاقات"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-[#062D4C] text-white'
                    : 'text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>بطاقات</span>
              </button>
              <button
                type="button"
                data-testid="notes-view-list"
                onClick={() => setViewMode('list')}
                aria-label="عرض كقائمة"
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-extrabold rounded-md whitespace-nowrap cursor-pointer transition-colors ${
                  viewMode === 'list'
                    ? 'bg-[#062D4C] text-white'
                    : 'text-[#062D4C] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-700'
                }`}
              >
                <ListIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>قائمة</span>
              </button>
            </div>
          </div>
        </div>

        {/* Folder + Pinned + Linked Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSelectedFolder('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors whitespace-nowrap cursor-pointer ${
              selectedFolder === 'all'
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C]'
            }`}
          >
            <Folder className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>جميع المجلدات</span>
          </button>

          {folders.map((folderName) => {
            const active = selectedFolder === folderName;
            return (
              <button
                key={folderName}
                type="button"
                onClick={() => setSelectedFolder(folderName)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C]'
                }`}
              >
                {folderName}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#062D4C]/10 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyPinned((prev) => !prev)}
              className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                onlyPinned
                  ? 'bg-[#B92622] text-white border-[#062D4C]'
                  : 'bg-slate-100 dark:bg-slate-800 text-[#062D4C] dark:text-slate-300 border-[#062D4C]/20'
              }`}
            >
              <Pin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>المثبتة فقط</span>
            </button>

            <select
              aria-label="تصفية حسب العنصر المرتبط"
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value as NoteLinkTargetType | 'all')}
              className="px-2.5 py-1 text-xs font-bold text-[#062D4C] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 border border-[#062D4C]/20 dark:border-slate-700 rounded-lg focus:outline-none"
            >
              <option value="all">كل الروابط (مشاريع / أصول / مسارات / كورسات / مسابقات / فيديوهات)</option>
              <option value="vault_project">مرتبطة بمشاريع الخزنة</option>
              <option value="library_asset">مرتبطة بأصول المكتبة</option>
              <option value="learning_step">مرتبطة بدروس المسار</option>
              <option value="learning_path">مرتبطة بمسارات التعلم</option>
              <option value="course">مرتبطة بكورساتي</option>
              <option value="learning_board">مرتبطة بلوحة التعلم</option>
              <option value="game_jam">مرتبطة بمسابقات الألعاب</option>
              <option value="video_collection">مرتبطة بمجموعات الفيديو</option>
            </select>
          </div>

          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 tabular-nums">
            عرض {filteredNotes.length} من {notes.length} ملاحظات
          </div>
        </div>
      </section>

      {/* Empty / Loading / Populated Notes Grid or List */}
      {cloudLoading && notes.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل ملاحظاتك...
        </div>
      ) : filteredNotes.length === 0 ? (
        <section className="rounded-2xl border-2 border-dashed border-[#062D4C]/40 dark:border-slate-600 bg-white/95 dark:bg-slate-900 p-10 text-center space-y-4 shadow-[0_4px_0_#062D4C]">
          <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] text-[#B92622] dark:text-rose-400 flex items-center justify-center">
            <NotebookPen className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-[#062D4C] dark:text-white">
              {notes.length === 0
                ? 'ابدأ تدوين أول ملاحظة في مساحتك'
                : 'لا توجد ملاحظات تطابق البحث أو التصفية'}
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              {notes.length === 0
                ? 'أنشئ ملاحظة منسقة بالأكواد والقوائم والروابط واحفظها تلقائياً في حسابك.'
                : 'جرّب تعديل كلمات البحث أو إعادة ضبط التصنيف لعرض جميع الملاحظات.'}
            </p>
          </div>
          {notes.length === 0 ? (
            <button
              type="button"
              onClick={() => void handleCreateNewNote()}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>ملاحظة جديدة</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedFolder('all');
                setOnlyPinned(false);
                setLinkFilter('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] rounded-xl cursor-pointer"
            >
              <span>عرض كل الملاحظات</span>
            </button>
          )}
        </section>
      ) : viewMode === 'cards' ? (
        <div
          data-testid="notes-cards-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {filteredNotes.map((note) => (
            <article
              key={note.id}
              data-testid={`note-card-${note.id}`}
              className={`rounded-xl border-2 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between gap-4 transition-shadow ${
                note.pinned
                  ? 'border-[#B92622] dark:border-rose-500 shadow-[0_4px_0_#B92622]'
                  : 'border-[#062D4C] dark:border-slate-600 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]'
              }`}
            >
              <div className="space-y-2.5">
                {/* Unboxed Metadata + Pin Control */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300">
                    <span className="font-extrabold text-[#062D4C] dark:text-white">
                      {note.folder}
                    </span>
                    <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                      ·
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {formatShortDate(note.updatedAt)}
                    </span>
                    {note.pinned && (
                      <>
                        <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                          ·
                        </span>
                        <span className="text-[#B92622] dark:text-rose-400 font-extrabold">
                          مثبتة
                        </span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void onTogglePinNote(note)}
                    aria-label={
                      note.pinned ? `إلغاء تثبيت "${note.title}"` : `تثبيت "${note.title}"`
                    }
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      note.pinned
                        ? 'text-[#B92622] dark:text-rose-400 bg-slate-100 dark:bg-slate-800'
                        : 'text-slate-400 hover:text-[#062D4C] dark:hover:text-white'
                    }`}
                  >
                    <Pin className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

                <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white leading-snug">
                  {note.title}
                </h2>

                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {note.plainPreview || 'ملاحظة فارغة — اضغط للفتح وبدء الكتابة.'}
                </p>

                {note.tags.length > 0 && (
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {note.tags.map((t) => `#${t}`).join(' · ')}
                  </div>
                )}

                {note.links.length > 0 && (
                  <div className="pt-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 truncate">
                    مرتبط بـ: {note.links.map((l) => l.label).join('، ')}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#062D4C]/10 dark:border-slate-700 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => void handleOpenNote(note.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-lg whitespace-nowrap cursor-pointer"
                >
                  <NotebookPen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>فتح وتحرير</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeleteNote(note)}
                  aria-label={`حذف "${note.title}"`}
                  className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>حذف</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div data-testid="notes-list-view" className="space-y-3">
          {filteredNotes.map((note) => (
            <article
              key={note.id}
              data-testid={`note-row-${note.id}`}
              className={`rounded-xl border-2 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                note.pinned
                  ? 'border-[#062D4C] dark:border-amber-400 shadow-[4px_5px_0_#B92622]'
                  : 'border-[#062D4C] dark:border-slate-600 shadow-[4px_5px_0_#062D4C] dark:shadow-[4px_5px_0_#334155]'
              }`}
            >
              <div className="min-w-0 space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="text-[#062D4C] dark:text-amber-300">{note.folder}</span>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                    ·
                  </span>
                  <span className="tabular-nums text-slate-500 dark:text-slate-400">
                    آخر تعديل {formatShortDate(note.updatedAt)}
                  </span>
                  {note.pinned && (
                    <>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-[#B92622] dark:text-rose-400">مثبتة</span>
                    </>
                  )}
                  {note.tags.length > 0 && (
                    <>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {note.tags.map((t) => `#${t}`).join(' · ')}
                      </span>
                    </>
                  )}
                </div>

                <h2 className="text-base sm:text-lg font-extrabold text-[#062D4C] dark:text-white truncate">
                  {note.title}
                </h2>
                <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-1">
                  {note.plainPreview || 'ملاحظة فارغة'}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void onTogglePinNote(note)}
                  aria-label={
                    note.pinned ? `إلغاء تثبيت "${note.title}"` : `تثبيت "${note.title}"`
                  }
                  className="p-2 text-slate-500 hover:text-[#B92622] dark:text-slate-400 dark:hover:text-amber-300 rounded-lg cursor-pointer"
                >
                  <Pin className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleOpenNote(note.id)}
                  className="px-3.5 py-2 text-xs font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg whitespace-nowrap cursor-pointer"
                >
                  فتح وتحرير
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteNote(note)}
                  aria-label={`حذف "${note.title}"`}
                  className="p-2 text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
