import { useState } from 'react';
import { ArrowLeft, Heart, Search, Trash2 } from 'lucide-react';
import type { FavoriteItem, FavoriteTargetType } from '../../types/platform';
import { SectionHeroBanner } from '../SectionHeroBanner';

interface FavoritesViewProps {
  favorites: FavoriteItem[];
  onOpenFavorite: (item: FavoriteItem) => void;
  onRemoveFavorite: (favId: string) => Promise<void>;
}

const TYPE_LABELS: Record<FavoriteTargetType, string> = {
  video_step: 'درس فيديو',
  learning_path: 'مسار تعليمي',
  course: 'كورس',
  collection_video: 'مكتبة الفيديو',
};

export function FavoritesView({
  favorites,
  onOpenFavorite,
  onRemoveFavorite,
}: FavoritesViewProps) {
  const [filterType, setFilterType] = useState<'all' | FavoriteTargetType>('all');
  const [queryText, setQueryText] = useState('');

  const filtered = favorites.filter((item) => {
    if (filterType !== 'all' && item.targetType !== filterType) return false;
    if (!queryText.trim()) return true;
    const q = queryText.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q)
    );
  });

  return (
    <div data-testid="favorites-view" className="space-y-6">
      <SectionHeroBanner
        testId="favorites-hero"
        kicker={<span>المفضلة المحفوظة · {favorites.length} عنصر محفوظ</span>}
        title="المفضلة — مراجعك السريعة ومحتواك المميز"
        description="احفظ دروس الفيديو والمسارات التعليمية والكورسات التي تعود إليها كثيراً للوصول إليها بنقرة واحدة."
        bottomExtra={
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `الكل (${favorites.length})` },
                { id: 'video_step', label: 'دروس الفيديو' },
                { id: 'learning_path', label: 'المسارات' },
                { id: 'course', label: 'الكورسات' },
                { id: 'collection_video', label: 'مكتبة الفيديو' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFilterType(t.id)}
                className={`px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                  filterType === t.id
                    ? 'bg-[#B92622] text-white border-[#B92622]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-100 border-[#062D4C]/40'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      />

      {favorites.length > 0 && (
        <div className="relative max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2"
            aria-hidden="true"
          />
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder="ابحث داخل المفضلة..."
            className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-700 bg-white dark:bg-slate-900 pr-9 pl-3 py-2 text-sm font-bold"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <div
          data-testid="favorites-empty"
          className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-8 text-center space-y-2"
        >
          <Heart className="w-10 h-10 text-[#B92622] mx-auto" aria-hidden="true" />
          <h3 className="text-base font-black text-[#062D4C] dark:text-white">
            قائمة المفضلة فارغة حالياً
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            اضغط على أيقونة القلب بجانب أي درس أو مسار تعليمي أو كورس لحفظه هنا والرجوع إليه فوراً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              data-testid={`favorite-card-${item.targetId}`}
              className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <p className="text-[11px] font-black text-[#B92622] dark:text-amber-300">
                  {TYPE_LABELS[item.targetType]}
                </p>
                <h3 className="text-sm sm:text-base font-black text-[#062D4C] dark:text-white line-clamp-2">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2">
                    {item.subtitle}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => onOpenFavorite(item)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-3 py-1.5 text-xs font-extrabold cursor-pointer"
                >
                  <span>فتح العنصر</span>
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => void onRemoveFavorite(item.id)}
                  aria-label={`إزالة ${item.title} من المفضلة`}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-[#B92622] cursor-pointer"
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
