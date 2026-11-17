import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  ExternalLink,
  Film,
  FolderPlus,
  Heart,
  LayoutGrid,
  NotebookPen,
  Pencil,
  Play,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import type { SaveOrganizedVideoInput, SaveVideoCollectionInput } from '../../hooks/useVideoCollections';
import type { VideoStep } from '../../types/learning';
import type {
  NoteLinkRef,
  OrganizedVideoItem,
  VideoCollection,
  WorkspaceNote,
} from '../../types/workspace';
import {
  DEFAULT_VIDEO_COLLECTION_CATEGORIES,
  filterVideoCollections,
  filterVideosInsideCollection,
} from '../../utils/gameJamLogic';
import { getNotesLinkedToTarget } from '../../utils/notesLogic';
import { SectionHeroBanner, type HeroActionItem } from '../SectionHeroBanner';
import { VideoWatchModal } from '../VideoWatchModal';
import { OrganizedVideoModal } from './OrganizedVideoModal';
import { VideoCollectionModal } from './VideoCollectionModal';

interface VideoCollectionsViewProps {
  collections: VideoCollection[];
  notes?: WorkspaceNote[];
  cloudLoading: boolean;
  onCreateCollection: (input: SaveVideoCollectionInput) => Promise<VideoCollection>;
  onUpdateCollection: (collectionId: string, input: Partial<SaveVideoCollectionInput>) => Promise<void>;
  onDeleteCollection: (collection: VideoCollection) => Promise<void>;
  onAddVideo: (col: VideoCollection, input: SaveOrganizedVideoInput) => Promise<OrganizedVideoItem>;
  onUpdateVideo: (col: VideoCollection, videoId: string, patch: Partial<OrganizedVideoItem>, silent?: boolean) => Promise<void>;
  onToggleVideoCompleted: (col: VideoCollection, videoId: string) => Promise<void>;
  onRemoveVideo: (col: VideoCollection, videoId: string) => Promise<void>;
  onSendVideoToBoard?: (video: OrganizedVideoItem, collection: VideoCollection) => void;
  onCreateTodoForVideo?: (video: OrganizedVideoItem, collection: VideoCollection) => void;
  onShareCollection?: (collection: VideoCollection) => void;
  onOpenNoteInWorkspace?: (noteId: string) => void;
  onCreateLinkedNote?: (input: {
    title: string;
    contentHtml: string;
    link: NoteLinkRef;
  }) => Promise<WorkspaceNote>;
  isVideoFavorite?: (videoId: string) => boolean;
  onToggleFavoriteVideo?: (video: OrganizedVideoItem, collection: VideoCollection) => void;
}

const PLATFORM_FILTER_OPTIONS = [
  { id: 'all', label: 'كل المنصات' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'vimeo', label: 'Vimeo' },
  { id: 'twitch', label: 'Twitch' },
  { id: 'loom', label: 'Loom' },
  { id: 'external', label: 'روابط أخرى' },
];

export function VideoCollectionsView({
  collections,
  notes = [],
  cloudLoading,
  onCreateCollection,
  onUpdateCollection,
  onDeleteCollection,
  onAddVideo,
  onUpdateVideo,
  onToggleVideoCompleted,
  onRemoveVideo,
  onSendVideoToBoard,
  onCreateTodoForVideo,
  onShareCollection,
  onOpenNoteInWorkspace,
  onCreateLinkedNote,
  isVideoFavorite,
  onToggleFavoriteVideo,
}: VideoCollectionsViewProps) {
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [completionFilter, setCompletionFilter] = useState<'all' | 'completed' | 'pending'>('all');

  const [collectionModalState, setCollectionModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    target: VideoCollection | null;
  }>({ open: false, mode: 'create', target: null });

  const [videoModalState, setVideoModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    target: OrganizedVideoItem | null;
  }>({ open: false, mode: 'create', target: null });

  const [watchTarget, setWatchTarget] = useState<{
    collection: VideoCollection;
    video: OrganizedVideoItem;
  } | null>(null);

  const filteredCollections = useMemo(
    () =>
      filterVideoCollections(collections, {
        searchQuery,
        categoryFilter,
        platformFilter,
      }),
    [collections, searchQuery, categoryFilter, platformFilter]
  );

  const activeCollection = useMemo(
    () =>
      filteredCollections.find((c) => c.id === selectedCollectionId) ||
      collections.find((c) => c.id === selectedCollectionId) ||
      filteredCollections[0] ||
      collections[0] ||
      null,
    [filteredCollections, collections, selectedCollectionId]
  );

  const visibleVideos = useMemo(() => {
    if (!activeCollection) return [];
    return filterVideosInsideCollection(activeCollection.videos, {
      searchQuery,
      platformFilter,
      completionFilter,
    });
  }, [activeCollection, searchQuery, platformFilter, completionFilter]);

  const watchStepProxy: VideoStep | null = watchTarget
    ? {
        id: watchTarget.video.id,
        pathId: watchTarget.collection.id,
        ownerId: watchTarget.collection.ownerId,
        title: watchTarget.video.title,
        description: watchTarget.video.description,
        videoUrl: watchTarget.video.videoUrl,
        thumbnailUrl: resolveMediaUrl(watchTarget.video.thumbnailUrl),
        order: 0,
        completed: watchTarget.video.completed,
        completedAt: '',
        targetDate: '',
        quickNotes: watchTarget.video.notes,
        quickNotesUpdatedAt: watchTarget.video.addedAt,
        createdAt: watchTarget.video.addedAt,
        updatedAt: watchTarget.video.addedAt,
      }
    : null;

  const videoHeroActions: HeroActionItem[] = [
    {
      id: 'new-collection',
      label: 'إنشاء مجموعة جديدة',
      icon: <FolderPlus className="w-4 h-4 shrink-0" aria-hidden="true" />,
      onClick: () => setCollectionModalState({ open: true, mode: 'create', target: null }),
      testId: 'videos-new-collection-btn',
      tone: 'crimson',
    },
    ...(activeCollection
      ? [
          {
            id: 'add-video-to-collection',
            label: 'إضافة فيديو',
            icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => setVideoModalState({ open: true, mode: 'create', target: null }),
            testId: 'videos-add-video-btn',
            tone: 'emerald' as const,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Unified Split Architectural Hero Banner */}
      <SectionHeroBanner
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-amber-300">
              <Film className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>مكتبة الفيديو الشاملة متعددة المنصات</span>
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-[#15803D] dark:text-emerald-400">
              {collections.length} مجموعات ·{' '}
              {collections.reduce((sum, c) => sum + c.videos.length, 0)} فيديو محفوظ
            </span>
          </>
        }
        title="فيديوهات متعددة المنصات (Multi-Platform Videos)"
        description="اجمع الدروس والمقتطفات من YouTube و TikTok و Facebook و Vimeo أو أي رابط ويب في مجموعات منظمة مع ملاحظاتك وإرسالها مباشرة للوحة التعلم أو مشاركتها مع الأصدقاء."
        actions={videoHeroActions}
      />

      {/* Search & Filters */}
      <section className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بعنوان الفيديو، المنصة، الوسوم، أو الملاحظات..."
              className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="تصفية حسب التصنيف"
            className="rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
          >
            <option value="all">جميع التصنيفات</option>
            {DEFAULT_VIDEO_COLLECTION_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={completionFilter}
            onChange={(e) => setCompletionFilter(e.target.value as 'all' | 'completed' | 'pending')}
            aria-label="حالة المشاهدة"
            className="rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
          >
            <option value="all">كل الحالات</option>
            <option value="pending">قيد المشاهدة</option>
            <option value="completed">تمت المشاهدة</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PLATFORM_FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPlatformFilter(opt.id)}
              className={`px-3 py-1 text-xs font-bold rounded-lg border-2 cursor-pointer transition-colors ${
                platformFilter === opt.id
                  ? 'bg-[#062D4C] text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {cloudLoading && collections.length === 0 ? (
        <div className="py-14 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل مجموعات الفيديوهات...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Collections Sidebar */}
          <aside className="lg:col-span-4 space-y-3">
            <h2 className="text-base font-extrabold text-[#062D4C] dark:text-white">
              المجموعات ({filteredCollections.length})
            </h2>
            {filteredCollections.length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                لا توجد مجموعات تطابق البحث الحالي.
              </div>
            ) : (
              filteredCollections.map((col) => {
                const isSelected = activeCollection?.id === col.id;
                const linkedNoteCount = getNotesLinkedToTarget(notes, 'video_collection', col.id).length;
                return (
                  <article
                    key={col.id}
                    className={`rounded-2xl border-2 transition-all overflow-hidden ${
                      isSelected
                        ? 'border-[#B92622] bg-slate-50 dark:bg-slate-800 shadow-[0_4px_0_#B92622]'
                        : 'border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedCollectionId(col.id)}
                      className="w-full text-right cursor-pointer"
                    >
                      <div className="relative px-3.5 py-2.5 bg-[#062D4C] text-white border-b-2 border-[#041E34] overflow-hidden flex items-center justify-between gap-2">
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 left-0 w-20 bg-[#B92622]"
                          style={{ clipPath: 'polygon(0 0, 72% 0, 38% 100%, 0 100%)' }}
                        />
                        <span className="relative z-10 text-[11px] font-extrabold text-amber-300">
                          {col.category}
                        </span>
                        <span className="relative z-10 text-[11px] font-bold text-slate-200 tabular-nums">
                          {col.videos.length} فيديو · {linkedNoteCount} ملاحظة
                        </span>
                      </div>
                      <div className="p-3.5 space-y-1.5">
                        <h3 className="text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white leading-snug">
                          {col.title}
                        </h3>
                        {col.description && (
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                            {col.description}
                          </p>
                        )}
                      </div>
                    </button>
                    <div className="px-3.5 pb-3 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        {onShareCollection && (
                          <button
                            type="button"
                            onClick={() => onShareCollection(col)}
                            className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#062D4C] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                          >
                            <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>مشاركة</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setCollectionModalState({ open: true, mode: 'edit', target: col })}
                          className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#062D4C] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>تعديل</span>
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onDeleteCollection(col)}
                        className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </aside>

          {/* Active Collection Videos */}
          <div className="lg:col-span-8 space-y-4">
            {activeCollection ? (
              <>
                <div className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white">
                      {activeCollection.title}
                    </h2>
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      عرض {visibleVideos.length} من أصل {activeCollection.videos.length} فيديو محفوظ
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {onShareCollection && (
                      <button
                        type="button"
                        onClick={() => onShareCollection(activeCollection)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold text-[#062D4C] dark:text-sky-300 bg-sky-50 dark:bg-slate-800 border-2 border-[#062D4C]/40 rounded-xl cursor-pointer"
                      >
                        <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>مشاركة المجموعة</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setVideoModalState({ open: true, mode: 'create', target: null })}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] rounded-xl cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>إضافة رابط فيديو</span>
                    </button>
                  </div>
                </div>

                {visibleVideos.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                      لا توجد فيديوهات تطابق التصفية داخل هذه المجموعة.
                    </p>
                    <button
                      type="button"
                      onClick={() => setVideoModalState({ open: true, mode: 'create', target: null })}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-extrabold text-white bg-[#062D4C] rounded-xl cursor-pointer"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                      <span>إضافة أول فيديو</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {visibleVideos.map((vid) => {
                      const thumbSrc = resolveMediaUrl(vid.thumbnailUrl);
                      return (
                        <article
                          key={vid.id}
                          className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] overflow-hidden flex flex-col justify-between"
                        >
                          <div>
                            <div className="relative aspect-video bg-slate-900 border-b-2 border-[#062D4C]/25 overflow-hidden">
                              {thumbSrc ? (
                                <img
                                  src={thumbSrc}
                                  alt={vid.title}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-[#062D4C] via-[#0B3B61] to-[#1E293B] flex items-center justify-center">
                                  <div className="w-12 h-12 rounded-xl bg-[#B92622] border-2 border-white/80 text-white flex items-center justify-center shadow-[0_3px_0_#041E34]">
                                    <Play className="w-6 h-6 fill-white" aria-hidden="true" />
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="p-4 space-y-2">
                              <div className="flex items-center justify-between gap-2 text-xs font-extrabold">
                                <span className="text-[#B92622] dark:text-amber-300">
                                  {vid.platformName} · {vid.category}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void onToggleVideoCompleted(activeCollection, vid.id)}
                                  className={`inline-flex items-center gap-1 text-xs font-bold cursor-pointer ${
                                    vid.completed
                                      ? 'text-emerald-700 dark:text-emerald-400'
                                      : 'text-slate-500 dark:text-slate-400 hover:text-[#062D4C]'
                                  }`}
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>{vid.completed ? 'تمت المشاهدة' : 'تحديد كمكتمل'}</span>
                                </button>
                              </div>

                              <h3 className="text-base font-extrabold text-[#062D4C] dark:text-white leading-snug">
                                {vid.title}
                              </h3>
                              {vid.description && (
                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                                  {vid.description}
                                </p>
                              )}
                              {vid.notes && (
                                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5 border border-amber-200 dark:border-slate-700">
                                  <NotebookPen className="w-3 h-3 inline ml-1" aria-hidden="true" />
                                  {vid.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="px-4 pb-4 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setWatchTarget({ collection: activeCollection, video: vid })}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] rounded-lg cursor-pointer"
                              >
                                <Play className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>تشغيل وملاحظات</span>
                              </button>
                              <a
                                href={vid.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-[#062D4C] dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg"
                              >
                                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>الرابط الأصلي</span>
                              </a>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
                              <div className="flex items-center gap-1">
                                {onSendVideoToBoard && (
                                  <button
                                    type="button"
                                    onClick={() => onSendVideoToBoard(vid, activeCollection)}
                                    title="إرسال إلى لوحة التعلم"
                                    className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#062D4C] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                  >
                                    <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>للوحة</span>
                                  </button>
                                )}
                                {onCreateTodoForVideo && (
                                  <button
                                    type="button"
                                    onClick={() => onCreateTodoForVideo(vid, activeCollection)}
                                    title="إضافة مهمة في قائمة المهام"
                                    className="inline-flex items-center gap-1 px-2 py-1 font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                  >
                                    <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span>مهمة</span>
                                  </button>
                                )}
                                {onToggleFavoriteVideo && (() => {
                                  const fav = isVideoFavorite ? isVideoFavorite(vid.id) : false;
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => onToggleFavoriteVideo(vid, activeCollection)}
                                      aria-label={fav ? `إزالة "${vid.title}" من المفضلة` : `إضافة "${vid.title}" للمفضلة`}
                                      className={`inline-flex items-center gap-1 px-2 py-1 font-bold rounded-lg cursor-pointer ${
                                        fav
                                          ? 'text-[#B92622] bg-rose-50 dark:bg-rose-950/40'
                                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                      }`}
                                    >
                                      <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-[#B92622]' : ''}`} aria-hidden="true" />
                                    </button>
                                  );
                                })()}
                                <button
                                  type="button"
                                  onClick={() => setVideoModalState({ open: true, mode: 'edit', target: vid })}
                                  className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#062D4C] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => void onRemoveVideo(activeCollection, vid.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/40 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  أنشئ أول مجموعة فيديوهات لتنظيم روابطك من جميع المنصات.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <VideoCollectionModal
        open={collectionModalState.open}
        mode={collectionModalState.mode}
        initialCollection={collectionModalState.target}
        onClose={() => setCollectionModalState({ open: false, mode: 'create', target: null })}
        onSubmit={async (input) => {
          if (collectionModalState.mode === 'edit' && collectionModalState.target) {
            await onUpdateCollection(collectionModalState.target.id, input);
          } else {
            const created = await onCreateCollection(input);
            setSelectedCollectionId(created.id);
          }
        }}
      />

      {activeCollection && (
        <OrganizedVideoModal
          open={videoModalState.open}
          mode={videoModalState.mode}
          initialVideo={videoModalState.target}
          defaultCategory={activeCollection.category}
          onClose={() => setVideoModalState({ open: false, mode: 'create', target: null })}
          onSubmit={async (input) => {
            if (videoModalState.mode === 'edit' && videoModalState.target) {
              await onUpdateVideo(activeCollection, videoModalState.target.id, input, false);
            } else {
              await onAddVideo(activeCollection, input);
            }
          }}
        />
      )}

      <VideoWatchModal
        step={watchStepProxy}
        contextBadge={watchTarget ? `مجموعة: ${watchTarget.collection.title}` : undefined}
        noteLinkTarget={
          watchTarget
            ? {
                type: 'video_collection',
                targetId: watchTarget.collection.id,
                parentId: '',
              }
            : undefined
        }
        notes={notes}
        onOpenNoteInWorkspace={onOpenNoteInWorkspace}
        onCreateLinkedNote={onCreateLinkedNote}
        onClose={() => setWatchTarget(null)}
        onMarkCompleted={async () => {
          if (!watchTarget) return;
          await onToggleVideoCompleted(watchTarget.collection, watchTarget.video.id);
        }}
        onSaveQuickNotes={async (_step, newNotes) => {
          if (!watchTarget) return;
          await onUpdateVideo(watchTarget.collection, watchTarget.video.id, { notes: newNotes }, true);
          setWatchTarget((prev) =>
            prev ? { ...prev, video: { ...prev.video, notes: newNotes } } : null
          );
        }}
      />
    </div>
  );
}
