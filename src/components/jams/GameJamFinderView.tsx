import { useEffect, useMemo, useState } from 'react';
import {
  BookmarkCheck,
  BookmarkPlus,
  CalendarPlus,
  CheckSquare,
  ExternalLink,
  FolderKanban,
  Gamepad2,
  Globe2,
  LayoutGrid,
  Link2,
  Loader2,
  MapPin,
  NotebookPen,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { SectionHeroBanner } from '../SectionHeroBanner';
import type {
  GameJamSearchResult,
  GameJamStatus,
  GameJamUpdateItem,
  SavedGameJam,
  WorkspaceNote,
} from '../../types/workspace';
import {
  deriveJamCountdownLabel,
  filterSavedGameJams,
  formatJamDateLabel,
  GAME_JAM_MODE_LABELS,
  GAME_JAM_STATUS_LABELS,
  GAME_JAM_UPDATE_TYPE_LABELS,
} from '../../utils/gameJamLogic';
import { getNotesLinkedToTarget } from '../../utils/notesLogic';

interface GameJamFinderViewProps {
  savedJams: SavedGameJam[];
  notes?: WorkspaceNote[];
  cloudLoading: boolean;
  onSaveJam: (result: GameJamSearchResult) => Promise<SavedGameJam>;
  onUpdateSavedJam: (
    jamId: string,
    patch: Partial<Pick<SavedGameJam, 'personalNotes' | 'theme' | 'startDate' | 'endDate' | 'linkedProjectId' | 'linkedBoardId' | 'resources'>>,
    silent?: boolean
  ) => Promise<void>;
  onAddJamResource: (jam: SavedGameJam, title: string, url: string) => Promise<boolean>;
  onRemoveJamResource: (jam: SavedGameJam, resourceId: string) => Promise<void>;
  onDeleteSavedJam: (jam: SavedGameJam) => Promise<void>;
  onCreateVaultProjectForJam: (jam: SavedGameJam) => void;
  onCreateTodoForJam: (jam: SavedGameJam) => void;
  onCreateBoardCardForJam: (jam: SavedGameJam) => void;
  onAddJamToCalendar?: (jam: SavedGameJam) => Promise<void> | void;
  onShareJam?: (jam: SavedGameJam) => void;
  onOpenJamNotesModal?: (jam: SavedGameJam) => void;
}

const QUICK_SEARCH_PRESETS = [
  'Show online Game Jams',
  'What Game Jams are currently active?',
  'Find a Game Jam for beginners',
  'Find a Game Jam near me',
  'Godot',
];

export function GameJamFinderView({
  savedJams,
  notes = [],
  cloudLoading,
  onSaveJam,
  onUpdateSavedJam,
  onAddJamResource,
  onRemoveJamResource,
  onDeleteSavedJam,
  onCreateVaultProjectForJam,
  onCreateTodoForJam,
  onCreateBoardCardForJam,
  onAddJamToCalendar,
  onShareJam,
  onOpenJamNotesModal,
}: GameJamFinderViewProps) {
  const [activeTab, setActiveTab] = useState<'discover' | 'saved'>('discover');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'upcoming' | 'active' | 'newly_announced'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'online' | 'in_person'>('all');
  const [locationInput, setLocationInput] = useState('');
  const [beginnerOnly, setBeginnerOnly] = useState(false);

  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSummary, setSearchSummary] = useState('');
  const [searchResults, setSearchResults] = useState<GameJamSearchResult[]>([]);
  const [relatedSuggestions, setRelatedSuggestions] = useState<string[]>([]);

  const [updatesLoading, setUpdatesLoading] = useState(false);
  const [updates, setUpdates] = useState<GameJamUpdateItem[]>([]);
  const [updatesFetchedAt, setUpdatesFetchedAt] = useState('');

  // Saved jams view state
  const [savedSearch, setSavedSearch] = useState('');
  const [savedStatusFilter, setSavedStatusFilter] = useState<GameJamStatus | 'all'>('all');
  const [notesDraftById, setNotesDraftById] = useState<Record<string, string>>({});
  const [resourceDraftById, setResourceDraftById] = useState<
    Record<string, { title: string; url: string }>
  >({});

  const executeSearch = async (overrideQuery?: string) => {
    const queryToSend = overrideQuery !== undefined ? overrideQuery : searchQuery;
    if (overrideQuery !== undefined) setSearchQuery(overrideQuery);
    setSearching(true);
    setSearchError(null);
    try {
      const res = await fetch('/api/game-jams/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryToSend,
          status: statusFilter,
          mode: modeFilter,
          location: locationInput,
          beginnerOnly,
        }),
      });
      const data = (await res.json()) as {
        jams?: GameJamSearchResult[];
        summary?: string;
        relatedSuggestions?: string[];
        error?: string;
      };
      if (!res.ok) {
        setSearchError(data.error || 'تعذر جلب نتائج مسابقات تطوير الألعاب حالياً.');
      } else {
        setSearchResults(Array.isArray(data.jams) ? data.jams : []);
        setSearchSummary(data.summary || '');
        setRelatedSuggestions(Array.isArray(data.relatedSuggestions) ? data.relatedSuggestions : []);
      }
    } catch {
      setSearchError('تعذر الاتصال بخدمة البحث المباشر عن المسابقات.');
    } finally {
      setSearching(false);
    }
  };

  const fetchLatestUpdates = async (forceRefresh = false) => {
    setUpdatesLoading(true);
    try {
      const res = await fetch(`/api/game-jams/updates${forceRefresh ? '?refresh=1' : ''}`);
      if (res.ok) {
        const data = (await res.json()) as {
          updates?: GameJamUpdateItem[];
          fetchedAt?: string;
        };
        setUpdates(Array.isArray(data.updates) ? data.updates : []);
        setUpdatesFetchedAt(data.fetchedAt || '');
      }
    } catch {
      // Keep non-blocking
    } finally {
      setUpdatesLoading(false);
    }
  };

  useEffect(() => {
    void executeSearch('');
    void fetchLatestUpdates(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSaved = useMemo(
    () => filterSavedGameJams(savedJams, { searchQuery: savedSearch, statusFilter: savedStatusFilter }),
    [savedJams, savedSearch, savedStatusFilter]
  );

  const isAlreadySaved = (officialUrl: string, name: string) =>
    savedJams.some(
      (j) =>
        j.officialUrl === officialUrl || j.name.toLowerCase() === name.toLowerCase()
    );

  return (
    <div className="space-y-6">
      {/* Unified Split Architectural Hero Banner */}
      <SectionHeroBanner
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-amber-300">
              <Gamepad2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>بحث مباشر ومدعوم بـ Google Search Grounding + itch.io</span>
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-[#15803D] dark:text-emerald-400">
              {savedJams.length} مسابقات في قائمتك
            </span>
          </>
        }
        title="مستكشف مسابقات تطوير الألعاب (Game Jam Finder)"
        description="ابحث عن المسابقات القادمة والنشطة حالياً أو القريبة من موقعك، تابع التحديثات الرسمية، واحفظ المسابقة لربطها بمشروعك ومهامك والتقويم ولوحة التعلم."
        actions={[
          {
            id: 'jams-discover',
            label: 'اكتشاف وبحث مباشر',
            icon: <Search className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => setActiveTab('discover'),
            tone: activeTab === 'discover' ? 'crimson' : 'light',
          },
          {
            id: 'jams-saved',
            label: `مسابقاتي المحفوظة (${savedJams.length})`,
            icon: <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => setActiveTab('saved'),
            testId: 'jams-saved-tab-btn',
            tone: activeTab === 'saved' ? 'amber' : 'light',
          },
        ]}
      />

      {activeTab === 'discover' ? (
        <div className="space-y-6">
          {/* Search Grounding Bar */}
          <section
            aria-label="البحث عن مسابقات Game Jam"
            className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void executeSearch();
              }}
              className="flex flex-col md:flex-row gap-3"
            >
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="search"
                  data-testid="jams-search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="مثال: Find a Game Jam for beginners أو اسم مسابقة أو محرك Godot..."
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2.5 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div className="relative md:w-52">
                <MapPin className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                <input
                  type="text"
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  placeholder="المدينة / الدولة (اختياري)"
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 pr-9 pl-3 py-2.5 text-xs sm:text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                data-testid="jams-search-submit-btn"
                disabled={searching}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-xl cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                {searching ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{searching ? 'جاري البحث الحي...' : 'بحث عن المسابقات'}</span>
              </button>
            </form>

            {/* Filter Row */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                aria-label="حالة المسابقة"
                className="rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-bold text-[#062D4C] dark:text-white"
              >
                <option value="all">كل الحالات</option>
                <option value="active">نشطة الآن</option>
                <option value="upcoming">قادمة قريباً</option>
                <option value="newly_announced">معلنة حديثاً</option>
              </select>

              <select
                value={modeFilter}
                onChange={(e) => setModeFilter(e.target.value as typeof modeFilter)}
                aria-label="نمط الحضور"
                className="rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 font-bold text-[#062D4C] dark:text-white"
              >
                <option value="all">أونلاين وحضوري</option>
                <option value="online">أونلاين فقط</option>
                <option value="in_person">حضوري / قريب مني</option>
              </select>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-[#062D4C] dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={beginnerOnly}
                  onChange={(e) => setBeginnerOnly(e.target.checked)}
                  className="accent-[#B92622]"
                />
                <span>مناسبة للمبتدئين فقط</span>
              </label>

              <div className="flex flex-wrap items-center gap-1.5 mr-auto">
                {QUICK_SEARCH_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => void executeSearch(preset)}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#062D4C]/20 text-[11px] font-bold text-[#062D4C] dark:text-amber-300 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {searchSummary && (
              <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {searchSummary}
              </p>
            )}
            {searchError && (
              <p role="alert" className="text-xs font-bold text-[#B92622] dark:text-rose-400">
                {searchError}
              </p>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Search Results */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white">
                  نتائج المسابقات ({searchResults.length})
                </h2>
              </div>

              {searching ? (
                <div className="py-12 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
                  جاري البحث في المصادر المباشرة...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-[#062D4C]/35 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
                  <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                    لم يتم العثور على مسابقات مطابقة للبحث الحالي.
                  </p>
                  {relatedSuggestions.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2">
                      {relatedSuggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void executeSearch(s)}
                          className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-[#062D4C]/30 rounded-lg cursor-pointer"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div data-testid="jams-results-grid" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {searchResults.map((jam) => {
                    const saved = isAlreadySaved(jam.officialUrl, jam.name);
                    return (
                      <article
                        key={jam.id}
                        className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] overflow-hidden flex flex-col justify-between"
                      >
                        <div>
                          {/* Clean Architectural Header Strip - Zero Decorative Art */}
                          <div className="relative px-4 py-2.5 bg-[#062D4C] text-white border-b-2 border-[#041E34] overflow-hidden flex items-center justify-between gap-2">
                            <div
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[#B92622]"
                              style={{ clipPath: 'polygon(0 0, 72% 0, 38% 100%, 0 100%)' }}
                            />
                            <span className="relative z-10 inline-flex items-center gap-1.5 text-xs font-extrabold text-amber-300">
                              <Gamepad2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              <span>{GAME_JAM_STATUS_LABELS[jam.status]}</span>
                            </span>
                            <span className="relative z-10 text-[11px] font-bold text-slate-200">
                              {jam.platform}
                            </span>
                          </div>

                          <div className="p-4 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-extrabold">
                              <span className="text-[#062D4C] dark:text-sky-300">
                                {GAME_JAM_MODE_LABELS[jam.mode]}
                              </span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span className="text-slate-600 dark:text-slate-400">{jam.organizer}</span>
                            </div>

                            <h3 className="text-base font-extrabold text-[#062D4C] dark:text-white leading-snug">
                              {jam.name}
                            </h3>

                            <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                              {jam.description}
                            </p>

                            <dl className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 space-y-1 pt-1 border-t border-[#062D4C]/10">
                              <div className="flex justify-between gap-2">
                                <dt>البدء / الانتهاء:</dt>
                                <dd className="font-bold text-[#062D4C] dark:text-white tabular-nums">
                                  {formatJamDateLabel(jam.startDate)} — {formatJamDateLabel(jam.endDate)}
                                </dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt>الموقع:</dt>
                                <dd className="font-bold">{jam.location}</dd>
                              </div>
                              <div className="flex justify-between gap-2">
                                <dt>المنظم / الثيم:</dt>
                                <dd className="truncate max-w-[180px]">{jam.organizer} · {jam.theme}</dd>
                              </div>
                            </dl>
                          </div>
                        </div>

                        <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                          <a
                            href={jam.officialUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border-2 border-[#062D4C] dark:border-slate-600 rounded-xl"
                          >
                            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>الصفحة الرسمية</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => void onSaveJam(jam)}
                            disabled={saved}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold border-2 border-[#062D4C] rounded-lg cursor-pointer ${
                              saved
                                ? 'bg-emerald-600 text-white opacity-90 cursor-default'
                                : 'bg-[#B92622] hover:bg-[#9E1E1B] text-white'
                            }`}
                          >
                            {saved ? (
                              <BookmarkCheck className="w-3.5 h-3.5" aria-hidden="true" />
                            ) : (
                              <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
                            )}
                            <span>{saved ? 'محفوظة' : 'حفظ المسابقة'}</span>
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Latest Game Jam Updates */}
            <aside className="lg:col-span-4 rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[4px_5px_0_#062D4C] space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-extrabold text-[#062D4C] dark:text-white">
                    آخر تحديثات المسابقات
                  </h2>
                  {updatesFetchedAt && (
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                      تحديث: {formatJamDateLabel(updatesFetchedAt)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void fetchLatestUpdates(true)}
                  disabled={updatesLoading}
                  aria-label="تحديث أخبار المسابقات"
                  className="p-2 rounded-lg border border-[#062D4C]/25 text-[#062D4C] dark:text-sky-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${updatesLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
                </button>
              </div>

              <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
                {updates.map((upd) => (
                  <article
                    key={upd.id}
                    className="rounded-xl border border-[#062D4C]/20 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-3 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2 text-[11px] font-extrabold">
                      <span className="text-[#B92622] dark:text-amber-300">
                        {GAME_JAM_UPDATE_TYPE_LABELS[upd.updateType]}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatJamDateLabel(upd.updateDate)}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-white">
                      {upd.title}
                    </h3>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {upd.summary}
                    </p>
                    <a
                      href={upd.officialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#062D4C] dark:text-sky-300 hover:underline pt-1"
                    >
                      <Globe2 className="w-3 h-3" aria-hidden="true" />
                      <span>زيارة صفحة {upd.platform}</span>
                    </a>
                  </article>
                ))}
              </div>
            </aside>
          </div>
        </div>
      ) : (
        /* Saved Game Jams Workspace */
        <div className="space-y-5">
          <section className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                type="search"
                value={savedSearch}
                onChange={(e) => setSavedSearch(e.target.value)}
                placeholder="ابحث داخل مسابقاتي المحفوظة..."
                className="w-full rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white"
              />
            </div>

            <select
              value={savedStatusFilter}
              onChange={(e) => setSavedStatusFilter(e.target.value as GameJamStatus | 'all')}
              className="rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
            >
              <option value="all">جميع الحالات</option>
              <option value="active">جارية الآن</option>
              <option value="upcoming">قادمة</option>
              <option value="newly_announced">معلنة حديثاً</option>
              <option value="ended">منتهية</option>
            </select>
          </section>

          {cloudLoading && savedJams.length === 0 ? (
            <div className="py-12 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
              جاري تحميل المسابقات المحفوظة...
            </div>
          ) : filteredSaved.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/40 bg-white dark:bg-slate-900 p-10 text-center space-y-3">
              <p className="text-base font-extrabold text-[#062D4C] dark:text-white">
                لا توجد مسابقات محفوظة حتى الآن
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('discover')}
                className="px-4 py-2 text-xs font-extrabold text-white bg-[#B92622] rounded-xl cursor-pointer"
              >
                العودة لاكتشاف المسابقات
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredSaved.map((jam) => {
                const draftNotes = notesDraftById[jam.id] ?? jam.personalNotes;
                const resDraft = resourceDraftById[jam.id] || { title: '', url: '' };
                const linkedNoteCount = getNotesLinkedToTarget(notes, 'game_jam', jam.id).length;

                return (
                  <article
                    key={jam.id}
                    className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[5px_6px_0_#062D4C] space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold text-[#B92622] dark:text-amber-300">
                          {deriveJamCountdownLabel(jam)} · {jam.platform}
                        </div>
                        <h3 className="text-lg font-extrabold text-[#062D4C] dark:text-white">
                          {jam.name}
                        </h3>
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mt-0.5 tabular-nums">
                          {formatJamDateLabel(jam.startDate)} — {formatJamDateLabel(jam.endDate)} · {jam.location}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {onShareJam && (
                          <button
                            type="button"
                            onClick={() => onShareJam(jam)}
                            aria-label={`مشاركة مسابقة ${jam.name}`}
                            className="p-2 rounded-lg border border-[#062D4C]/30 text-[#062D4C] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            <Share2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        )}
                        <a
                          href={jam.officialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg border border-[#062D4C]/30 text-[#062D4C] dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                          aria-label="زيارة الصفحة الرسمية"
                        >
                          <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        </a>
                        <button
                          type="button"
                          onClick={() => void onDeleteSavedJam(jam)}
                          aria-label={`حذف ${jam.name}`}
                          className="p-2 rounded-lg text-[#B92622] hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    {/* Cross-feature actions: Game Jam -> Project -> To-Do -> Notes -> Board -> Calendar */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {onAddJamToCalendar && (
                        <button
                          type="button"
                          data-testid={`jam-add-calendar-${jam.id}`}
                          onClick={() => void onAddJamToCalendar(jam)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] rounded-lg cursor-pointer"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>إضافة للتقويم</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onCreateVaultProjectForJam(jam)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] rounded-lg cursor-pointer"
                      >
                        <FolderKanban className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>إنشاء مشروع في الخزنة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onCreateTodoForJam(jam)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-slate-800 border border-emerald-600/30 rounded-lg cursor-pointer"
                      >
                        <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>مهمة للمسابقة</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onCreateBoardCardForJam(jam)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 font-extrabold text-[#062D4C] dark:text-sky-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 border border-[#062D4C]/30 rounded-lg cursor-pointer"
                      >
                        <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>للوحة التعلم</span>
                      </button>
                      {onOpenJamNotesModal && (
                        <button
                          type="button"
                          onClick={() => onOpenJamNotesModal(jam)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 font-bold text-[#062D4C] dark:text-slate-200 bg-white dark:bg-slate-800 border border-[#062D4C]/25 rounded-lg cursor-pointer tabular-nums"
                        >
                          <NotebookPen className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>ملاحظات ({linkedNoteCount})</span>
                        </button>
                      )}
                    </div>

                    {/* Personal Jam Notes */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold text-[#062D4C] dark:text-slate-200">
                        أفكار اللعبة وملاحظاتي الخاصة بالمسابقة:
                      </label>
                      <textarea
                        rows={2}
                        value={draftNotes}
                        onChange={(e) =>
                          setNotesDraftById((prev) => ({ ...prev, [jam.id]: e.target.value }))
                        }
                        placeholder="فكرة اللعبة، آليات اللعب الأساسية، خطة الـ 48 ساعة..."
                        className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm font-medium text-[#062D4C] dark:text-white resize-y"
                      />
                      {draftNotes !== jam.personalNotes && (
                        <button
                          type="button"
                          onClick={() =>
                            void onUpdateSavedJam(jam.id, { personalNotes: draftNotes }, false)
                          }
                          className="px-3 py-1 text-xs font-extrabold text-white bg-[#062D4C] rounded-lg cursor-pointer"
                        >
                          حفظ ملاحظات المسابقة
                        </button>
                      )}
                    </div>

                    {/* Important Links & Resources */}
                    <div className="space-y-2 pt-2 border-t border-[#062D4C]/10 dark:border-slate-800">
                      <div className="text-xs font-extrabold text-[#062D4C] dark:text-slate-200">
                        روابط ومصادر المسابقة ({jam.resources.length})
                      </div>
                      {jam.resources.length > 0 && (
                        <ul className="space-y-1">
                          {jam.resources.map((res) => (
                            <li key={res.id} className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-800 rounded-lg px-2.5 py-1.5">
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 font-bold text-[#062D4C] dark:text-sky-300 hover:underline truncate"
                              >
                                <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                <span className="truncate">{res.title}</span>
                              </a>
                              <button
                                type="button"
                                onClick={() => void onRemoveJamResource(jam, res.id)}
                                className="text-[#B92622] hover:underline font-bold shrink-0 cursor-pointer"
                              >
                                إزالة
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={resDraft.title}
                          onChange={(e) =>
                            setResourceDraftById((prev) => ({
                              ...prev,
                              [jam.id]: { ...resDraft, title: e.target.value },
                            }))
                          }
                          placeholder="عنوان المورد (مثل: حزمة أصول)"
                          className="flex-1 min-w-[130px] rounded-lg border border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-[#062D4C] dark:text-white"
                        />
                        <input
                          type="url"
                          dir="ltr"
                          value={resDraft.url}
                          onChange={(e) =>
                            setResourceDraftById((prev) => ({
                              ...prev,
                              [jam.id]: { ...resDraft, url: e.target.value },
                            }))
                          }
                          placeholder="https://..."
                          className="flex-1 min-w-[140px] rounded-lg border border-[#062D4C]/25 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-[#062D4C] dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await onAddJamResource(jam, resDraft.title, resDraft.url);
                            if (ok) {
                              setResourceDraftById((prev) => ({
                                ...prev,
                                [jam.id]: { title: '', url: '' },
                              }));
                            }
                          }}
                          className="px-3 py-1.5 text-xs font-extrabold text-white bg-[#062D4C] rounded-lg cursor-pointer"
                        >
                          إضافة رابط
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
