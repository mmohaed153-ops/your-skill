import { useMemo, useState } from 'react';
import {
  Box,
  CheckSquare,
  Download,
  Eye,
  Folder,
  Layers,
  NotebookPen,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import { SectionHeroBanner } from '../SectionHeroBanner';
import type { AssetCategory, LibraryAsset, WorkspaceNote } from '../../types/workspace';
import { getNotesLinkedToTarget } from '../../utils/notesLogic';
import {
  ASSET_CATEGORY_LABELS,
  DEFAULT_ASSET_FOLDERS,
  filterLibraryAssets,
  formatBytes,
  type StorageSummary,
} from '../../utils/workspaceLogic';
import { StorageUsageCard } from '../StorageUsageCard';

interface AssetLibraryViewProps {
  assets: LibraryAsset[];
  notes?: WorkspaceNote[];
  storageSummary?: StorageSummary;
  cloudLoading: boolean;
  onAddAsset: () => void;
  onEditAsset: (asset: LibraryAsset) => void;
  onInspectAsset: (asset: LibraryAsset) => void;
  onDownloadAsset: (asset: LibraryAsset) => void;
  onCreateTodoForAsset?: (asset: LibraryAsset) => void;
  onShareAsset?: (asset: LibraryAsset) => void;
  onDeleteAsset: (asset: LibraryAsset) => void;
}

const CATEGORY_TABS: { id: AssetCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'جميع الأنواع' },
  { id: '3d_model', label: 'نماذج 3D' },
  { id: 'material', label: 'مواد PBR' },
  { id: 'texture', label: 'خامات' },
  { id: 'image', label: 'صور' },
  { id: 'audio', label: 'صوتيات' },
  { id: 'animation', label: 'حركات' },
  { id: 'addon', label: 'إضافات' },
  { id: 'game_asset', label: 'عناصر ألعاب' },
  { id: 'other', label: 'أخرى' },
];

export function AssetLibraryView({
  assets,
  notes = [],
  storageSummary,
  cloudLoading,
  onAddAsset,
  onEditAsset,
  onInspectAsset,
  onDownloadAsset,
  onCreateTodoForAsset,
  onShareAsset,
  onDeleteAsset,
}: AssetLibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory | 'all'>('all');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const folders = useMemo(() => {
    const set = new Set<string>(DEFAULT_ASSET_FOLDERS);
    for (const asset of assets) {
      if (asset.folder) set.add(asset.folder);
    }
    return Array.from(set);
  }, [assets]);

  const filteredAssets = useMemo(
    () => filterLibraryAssets(assets, searchQuery, selectedCategory, selectedFolder),
    [assets, searchQuery, selectedCategory, selectedFolder]
  );

  const totalFiles = useMemo(
    () => assets.reduce((sum, a) => sum + a.fileCount, 0),
    [assets]
  );

  return (
    <div className="space-y-6">
      {/* Asset Library Hero Banner */}
      <SectionHeroBanner
        testId="assets-hero-banner"
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
              <Layers className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>مستودع الموارد الإبداعية والملحقات</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-200">
              {assets.length} {assets.length === 1 ? 'أصل محفوظ' : 'أصول محفوظة'}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              {totalFiles} {totalFiles === 1 ? 'ملف أصلي' : 'ملفات أصلية'}
            </span>
          </>
        }
        title="مكتبة الأصول (Asset Library)"
        description="اجمع نماذج 3D والخامات والصور والصوتيات والفيديوهات والمستندات والإضافات بجميع صيغها في بطاقات منظمة للمعاينة والتنزيل وإعادة الاستخدام."
        actions={[
          {
            id: 'assets-add',
            label: 'إضافة أصل جديد',
            icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: onAddAsset,
            testId: 'assets-add-btn',
            tone: 'crimson',
          },
        ]}
      />

      {/* Scalable Cloud Storage Indicator */}
      {storageSummary && <StorageUsageCard summary={storageSummary} />}

      {/* Search, Category Filter & Folder Collections Bar */}
      <section
        aria-label="بحث وتصفية مكتبة الأصول"
        className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3.5"
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، الوسوم (مثل sci-fi, pbr)، أو اسم الملف..."
              aria-label="البحث في مكتبة الأصول"
              className="w-full rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
            عرض {filteredAssets.length} من {assets.length} أصول
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORY_TABS.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg border-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#B92622] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Folder / Collection Filter */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#062D4C]/10 dark:border-slate-800">
          <span className="text-xs font-extrabold text-[#062D4C] dark:text-slate-300 inline-flex items-center gap-1">
            <Folder className="w-3.5 h-3.5" aria-hidden="true" />
            <span>المجموعة:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedFolder('all')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
              selectedFolder === 'all'
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-slate-100 dark:bg-slate-800 text-[#062D4C] dark:text-slate-300 border-[#062D4C]/20'
            }`}
          >
            الكل
          </button>
          {folders.map((folderName) => {
            const active = selectedFolder === folderName;
            return (
              <button
                key={folderName}
                type="button"
                onClick={() => setSelectedFolder(folderName)}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-slate-100 dark:bg-slate-800 text-[#062D4C] dark:text-slate-300 border-[#062D4C]/20'
                }`}
              >
                {folderName}
              </button>
            );
          })}
        </div>
      </section>

      {/* Visual Asset Cards Grid */}
      {cloudLoading && assets.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل مكتبة الأصول...
        </div>
      ) : filteredAssets.length === 0 ? (
        <section className="rounded-2xl border-2 border-dashed border-[#062D4C]/40 dark:border-slate-600 bg-white/95 dark:bg-slate-900 p-10 text-center space-y-4 shadow-[0_4px_0_#062D4C]">
          <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] text-[#B92622] dark:text-rose-400 flex items-center justify-center">
            <PackageOpen className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-[#062D4C] dark:text-white">
              {assets.length === 0
                ? 'ابدأ ببناء مكتبتك الإبداعية'
                : 'لا توجد أصول تطابق البحث أو التصفية'}
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              {assets.length === 0
                ? 'أضف أول نموذج 3D أو خامة أو ملحق مع ملفاته الأصلية.'
                : 'أعد ضبط كلمات البحث أو اختر "جميع الأنواع" لعرض كافة العناصر المحفوظة.'}
            </p>
          </div>
          {assets.length === 0 ? (
            <button
              type="button"
              onClick={onAddAsset}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إضافة أصل جديد</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedFolder('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] rounded-xl cursor-pointer"
            >
              <span>عرض كل الأصول</span>
            </button>
          )}
        </section>
      ) : (
        <div
          data-testid="asset-library-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredAssets.map((asset) => {
            const imageBroken = Boolean(brokenImages[asset.id]);
            const linkedNoteCount = getNotesLinkedToTarget(notes, 'library_asset', asset.id).length;
            const resolvedPreview = resolveMediaUrl(asset.previewImage);

            return (
              <article
                key={asset.id}
                data-testid={`asset-card-${asset.id}`}
                className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {!imageBroken && resolvedPreview ? (
                    <div className="relative aspect-[4/3] w-full bg-slate-900 border-b-2 border-[#062D4C] dark:border-slate-700 overflow-hidden">
                      <img
                        src={resolvedPreview}
                        alt={asset.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [asset.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-2.5 w-full bg-gradient-to-l from-[#062D4C] via-[#0A3A61] to-[#B92622]" />
                  )}

                  {/* Body Content */}
                  <div className="p-4 sm:p-5 space-y-2.5">
                    {/* Unboxed Metadata Line */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-amber-300">
                      <span className="font-extrabold text-[#B92622] dark:text-rose-400">
                        {ASSET_CATEGORY_LABELS[asset.category]}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="text-[#062D4C] dark:text-slate-200 tabular-nums">
                        {asset.primaryExtension}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="tabular-nums">
                        {asset.fileCount} {asset.fileCount === 1 ? 'ملف' : 'ملفات'} ({formatBytes(asset.totalSizeBytes)})
                      </span>
                    </div>

                    <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white leading-snug">
                      {asset.name}
                    </h2>

                    {asset.description && (
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {asset.description}
                      </p>
                    )}

                    {/* Clean Unboxed Folder + Tags */}
                    <div className="pt-1 text-xs font-semibold text-slate-600 dark:text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[#062D4C] dark:text-slate-200 font-bold">
                        {asset.folder}
                      </span>
                      {asset.tags.length > 0 && (
                        <>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            /
                          </span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {asset.tags.map((t) => `#${t}`).join(' · ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-4 sm:px-5 pb-4 pt-1 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectAsset(asset)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>عرض الملفات</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onDownloadAsset(asset)}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-lg cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span>تحميل الأصل</span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                    <div className="flex items-center gap-1">
                      {onShareAsset && (
                        <button
                          type="button"
                          onClick={() => onShareAsset(asset)}
                          aria-label={`مشاركة "${asset.name}"`}
                          title="مشاركة مع الأصدقاء"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#062D4C] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                      {onCreateTodoForAsset && (
                        <button
                          type="button"
                          onClick={() => onCreateTodoForAsset(asset)}
                          aria-label={`إضافة مهمة لأصل "${asset.name}"`}
                          title="إضافة مهمة في قائمة المهام"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#062D4C] dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <CheckSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onInspectAsset(asset)}
                        aria-label={`ملاحظات أصل "${asset.name}"`}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#062D4C] dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer tabular-nums"
                      >
                        <NotebookPen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>ملاحظات ({linkedNoteCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditAsset(asset)}
                        aria-label={`تعديل "${asset.name}"`}
                        className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#062D4C] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>تعديل</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteAsset(asset)}
                      aria-label={`حذف "${asset.name}"`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>حذف</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
