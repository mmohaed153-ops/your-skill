import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarPlus,
  ExternalLink,
  Eye,
  Globe,
  GraduationCap,
  Heart,
  Pencil,
  Plus,
  RotateCcw,
  Route,
  Search,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import type {
  CourseItem,
  CourseStatus,
  DiscoveredCourseResult,
  GroundingSourceLink,
} from '../../types/workspace';
import { SectionHeroBanner, type HeroActionItem } from '../SectionHeroBanner';
import { normalizeUrl } from '../../utils/pathLogic';
import {
  COURSE_STATUS_LABELS,
  DEFAULT_COURSE_CATEGORIES,
  filterCourses,
} from '../../utils/workspaceLogic';

interface CoursesViewProps {
  courses: CourseItem[];
  cloudLoading: boolean;
  onAddManualCourse: () => void;
  onInspectCourse: (course: CourseItem) => void;
  onEditCourse: (course: CourseItem) => void;
  onDeleteCourse: (course: CourseItem) => void;
  onOpenLearningPath: (pathId: string) => void;
  onSaveDiscoveredCourse: (result: DiscoveredCourseResult) => Promise<CourseItem>;
  onCreatePathFromDiscoveredCourse: (result: DiscoveredCourseResult) => Promise<void>;
  onShareCourse?: (course: CourseItem) => void;
  onScheduleCourse?: (course: CourseItem) => void;
  isCourseFavorite?: (courseId: string) => boolean;
  onToggleFavoriteCourse?: (course: CourseItem) => void;
}

const STARTER_GOALS = [
  'أريد تعلم البرمجة وتطوير الويب',
  'I want to learn Godot game development',
  'تعلم تصميم والنمذجة ثلاثية الأبعاد Blender',
  'تعلم تصميم واجهات المستخدم UI/UX',
  'تحسين اللغة الإنجليزية من الصفر',
  'أساسيات علوم البيانات والذكاء الاصطناعي',
];

const COST_LABELS: Record<DiscoveredCourseResult['cost'], string> = {
  free: 'مجاني بالكامل',
  freemium: 'مجاني مع مزايا مدفوعة',
  paid: 'مدفوع',
};

const LEVEL_LABELS: Record<DiscoveredCourseResult['level'], string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
  all: 'كل المستويات',
};

export function CoursesView({
  courses,
  cloudLoading,
  onAddManualCourse,
  onInspectCourse,
  onEditCourse,
  onDeleteCourse,
  onOpenLearningPath,
  onSaveDiscoveredCourse,
  onCreatePathFromDiscoveredCourse,
  onShareCourse,
  onScheduleCourse,
  isCourseFavorite,
  onToggleFavoriteCourse,
}: CoursesViewProps) {
  const [activeTab, setActiveTab] = useState<'my_courses' | 'ai_finder'>('my_courses');

  // My Courses Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  // AI Course Finder State
  const [aiQuery, setAiQuery] = useState('');
  const [aiLanguage, setAiLanguage] = useState<'all' | 'ar' | 'en'>('all');
  const [aiLevel, setAiLevel] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState('');
  const [aiResults, setAiResults] = useState<DiscoveredCourseResult[]>([]);
  const [aiSources, setAiSources] = useState<GroundingSourceLink[]>([]);
  const [savingResultId, setSavingResultId] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Record<string, boolean>>({});

  const categories = useMemo(() => {
    const set = new Set<string>(DEFAULT_COURSE_CATEGORIES);
    for (const c of courses) {
      if (c.category) set.add(c.category);
    }
    return Array.from(set);
  }, [courses]);

  const filteredCourses = useMemo(
    () =>
      filterCourses(courses, {
        searchQuery,
        statusFilter,
        categoryFilter,
      }),
    [courses, searchQuery, statusFilter, categoryFilter]
  );

  const activeCount = useMemo(
    () => courses.filter((c) => c.status === 'active').length,
    [courses]
  );
  const completedCount = useMemo(
    () => courses.filter((c) => c.status === 'completed').length,
    [courses]
  );
  const averageProgress = useMemo(() => {
    if (courses.length === 0) return 0;
    const sum = courses.reduce((acc, c) => acc + (c.status === 'completed' ? 100 : c.progressPercent || 0), 0);
    return Math.round(sum / courses.length);
  }, [courses]);

  const runCourseDiscovery = async (goalOverride?: string) => {
    const goal = (goalOverride ?? aiQuery).trim();
    if (!goal) {
      setAiError('يرجى كتابة الموضوع أو المهارة التي تريد تعلمها.');
      return;
    }
    if (goalOverride) setAiQuery(goalOverride);

    setAiLoading(true);
    setAiError(null);
    try {
      const response = await fetch('/api/courses/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: goal,
          language: aiLanguage,
          level: aiLevel,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error || 'تعذر البحث عن الكورسات حالياً. يرجى المحاولة مرة أخرى.'
        );
      }
      setAiSummary(String(data.summary || ''));
      setAiResults(Array.isArray(data.courses) ? data.courses : []);
      setAiSources(Array.isArray(data.groundingSources) ? data.groundingSources : []);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'حدث خطأ أثناء البحث عن الكورسات. حاول مرة أخرى.'
      );
    } finally {
      setAiLoading(false);
    }
  };

  const handleSaveResult = async (item: DiscoveredCourseResult) => {
    setSavingResultId(item.id);
    try {
      await onSaveDiscoveredCourse(item);
      setSavedUrls((prev) => ({ ...prev, [item.url]: true }));
    } finally {
      setSavingResultId(null);
    }
  };

  const handleCreatePathFromResult = async (item: DiscoveredCourseResult) => {
    setSavingResultId(`path_${item.id}`);
    try {
      await onCreatePathFromDiscoveredCourse(item);
      setSavedUrls((prev) => ({ ...prev, [item.url]: true }));
    } finally {
      setSavingResultId(null);
    }
  };

  const heroActions: HeroActionItem[] = [
    {
      id: 'add-manual-course',
      label: 'إضافة كورس يدوياً',
      icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
      onClick: onAddManualCourse,
      testId: 'add-manual-course-btn',
      tone: 'crimson',
    },
    {
      id: 'open-ai-course-finder',
      label: 'اكتشف كورسات بالذكاء الاصطناعي',
      icon: <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />,
      onClick: () => setActiveTab('ai_finder'),
      testId: 'open-ai-course-finder-btn',
      tone: 'amber',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Unified Split Architectural Hero Banner */}
      <SectionHeroBanner
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-amber-300">
              <GraduationCap className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تنظيم الكورسات واكتشاف المصادر بالبحث الذكي</span>
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-100">
              {courses.length} {courses.length === 1 ? 'كورس محفوظ' : 'كورسات محفوظة'}
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">·</span>
            <span className="tabular-nums text-[#15803D] dark:text-emerald-400">
              {activeCount} قيد المتابعة · {completedCount} مكتمل
            </span>
          </>
        }
        title="كورساتي ومكتشف الكورسات الذكي"
        description="احفظ الكورسات التي تتابعها حالياً مع تتبع تقدمك وربطها بمسارات التعلم والمهام والملاحظات، أو استخدم الباحث الذكي لاكتشاف أفضل الكورسات من الويب لأي مجال."
        progress={
          courses.length > 0
            ? {
                label: 'متوسط التقدم في كورساتك',
                percentage: averageProgress,
                ariaLabel: 'متوسط التقدم في كورساتك',
              }
            : undefined
        }
        actions={heroActions}
      />

      {/* Primary Section Switcher: My Courses vs AI Course Finder */}
      <div
        role="tablist"
        aria-label="أقسام الكورسات"
        className="flex flex-wrap items-center gap-2.5"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'my_courses'}
          data-testid="tab-my-courses"
          onClick={() => setActiveTab('my_courses')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold rounded-xl border-2 cursor-pointer ${
            activeTab === 'my_courses'
              ? 'bg-[#062D4C] text-white border-[#062D4C] shadow-[3px_4px_0_#B92622]'
              : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30 dark:border-slate-700 hover:border-[#062D4C]'
          }`}
        >
          <BookOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="tabular-nums">كورساتي ({courses.length})</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'ai_finder'}
          data-testid="tab-ai-course-finder"
          onClick={() => setActiveTab('ai_finder')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold rounded-xl border-2 cursor-pointer ${
            activeTab === 'ai_finder'
              ? 'bg-[#B92622] text-white border-[#062D4C] shadow-[3px_4px_0_#062D4C]'
              : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30 dark:border-slate-700 hover:border-[#062D4C]'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>مكتشف الكورسات الذكي (AI Course Finder)</span>
        </button>
      </div>

      {/* ==================== AI COURSE FINDER VIEW ==================== */}
      {activeTab === 'ai_finder' && (
        <section
          aria-label="مكتشف الكورسات الذكي"
          className="space-y-6"
        >
          <div className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4">
            <div className="space-y-1">
              <h2 className="text-lg sm:text-xl font-black text-[#062D4C] dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                <span>ابحث عن كورسات في أي مجال عبر البحث المباشر والذكاء الاصطناعي</span>
              </h2>
              <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                اكتب هدفك التعليمي بالعربية أو الإنجليزية (مثل: &quot;I want to learn programming&quot; أو &quot;أريد تعلم تصميم الألعاب&quot;) وسنبحث لك عن أفضل الكورسات والمصادر الموثوقة.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void runCourseDiscovery();
              }}
              className="flex flex-col md:flex-row items-stretch md:items-center gap-3"
            >
              <div className="relative flex-1">
                <Search
                  className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  data-testid="ai-finder-input"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder="مثال: I want to learn programming / أريد تعلم Blender..."
                  aria-label="ما الذي تريد تعلمه؟"
                  className="w-full rounded-xl border-2 border-[#062D4C]/30 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-3 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <select
                  aria-label="لغة الكورسات المطلوبة"
                  value={aiLanguage}
                  onChange={(e) => setAiLanguage(e.target.value as 'all' | 'ar' | 'en')}
                  className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-3 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
                >
                  <option value="all">كل اللغات</option>
                  <option value="ar">محتوى عربي</option>
                  <option value="en">محتوى إنجليزي</option>
                </select>

                <select
                  aria-label="مستوى الكورسات المطلوبة"
                  value={aiLevel}
                  onChange={(e) =>
                    setAiLevel(
                      e.target.value as 'all' | 'beginner' | 'intermediate' | 'advanced'
                    )
                  }
                  className="rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-3 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white"
                >
                  <option value="all">كل المستويات</option>
                  <option value="beginner">مبتدئ</option>
                  <option value="intermediate">متوسط</option>
                  <option value="advanced">متقدم</option>
                </select>

                <button
                  type="submit"
                  data-testid="ai-finder-submit-btn"
                  disabled={aiLoading}
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] disabled:opacity-60 border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer whitespace-nowrap"
                >
                  <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{aiLoading ? 'جاري البحث...' : 'بحث ذكي'}</span>
                </button>
              </div>
            </form>

            {/* Quick Starter Goals */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-extrabold text-[#062D4C] dark:text-slate-300">
                أهداف مقترحة:
              </span>
              {STARTER_GOALS.map((goal) => (
                <button
                  key={goal}
                  type="button"
                  disabled={aiLoading}
                  onClick={() => void runCourseDiscovery(goal)}
                  className="px-2.5 py-1 text-xs font-bold text-[#062D4C] dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-[#062D4C]/25 dark:border-slate-600 rounded-lg cursor-pointer transition-colors"
                >
                  {goal}
                </button>
              ))}
            </div>
          </div>

          {aiError && (
            <div
              role="alert"
              className="rounded-xl border-2 border-[#B92622] bg-rose-50 dark:bg-rose-950/50 p-4 text-sm font-bold text-[#B92622] dark:text-rose-200 flex flex-wrap items-center justify-between gap-3"
            >
              <span>{aiError}</span>
              <button
                type="button"
                onClick={() => void runCourseDiscovery()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-white bg-[#B92622] rounded-lg cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>إعادة البحث</span>
              </button>
            </div>
          )}

          {aiLoading && (
            <div className="rounded-2xl border-2 border-[#062D4C] bg-white dark:bg-slate-900 p-10 text-center space-y-3 shadow-[4px_5px_0_#062D4C]">
              <Sparkles className="w-8 h-8 text-[#B92622] dark:text-amber-300 mx-auto animate-pulse" aria-hidden="true" />
              <div className="text-base font-extrabold text-[#062D4C] dark:text-white">
                جاري تحليل هدفك والبحث عن أفضل الكورسات والدروس من الويب...
              </div>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                قد يستغرق البحث بضع ثوانٍ للتحقق من الروابط الفعلية وتنسيق النتائج.
              </p>
            </div>
          )}

          {!aiLoading && aiResults.length > 0 && (
            <div data-testid="ai-finder-results" className="space-y-5">
              {aiSummary && (
                <div className="rounded-xl border-2 border-emerald-600/40 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 text-sm font-bold text-[#062D4C] dark:text-emerald-200 leading-relaxed">
                  {aiSummary}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {aiResults.map((result) => {
                  const isSaved =
                    Boolean(savedUrls[result.url]) ||
                    courses.some((c) => c.url === result.url || c.title === result.title);
                  const broken = Boolean(brokenImages[result.id]);

                  return (
                    <article
                      key={result.id}
                      data-testid={`ai-course-card-${result.id}`}
                      className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[5px_6px_0_#062D4C] dark:shadow-[5px_6px_0_#334155] overflow-hidden flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-video w-full bg-slate-900 border-b-2 border-[#062D4C] dark:border-slate-700 overflow-hidden">
                          {!broken && result.thumbnailUrl ? (
                            <img
                              src={result.thumbnailUrl}
                              alt={result.title}
                              referrerPolicy="no-referrer"
                              onError={() =>
                                setBrokenImages((prev) => ({ ...prev, [result.id]: true }))
                              }
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-[#062D4C] to-[#0B3D63] flex items-center justify-center">
                              <GraduationCap className="w-11 h-11 text-amber-300/70" aria-hidden="true" />
                            </div>
                          )}
                        </div>

                        <div className="p-4 sm:p-5 space-y-2.5">
                          <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-amber-300">
                            <span className="font-extrabold text-[#B92622] dark:text-rose-400">
                              {result.platform}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-[#062D4C] dark:text-slate-200">
                              {LEVEL_LABELS[result.level]}
                            </span>
                            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                              ·
                            </span>
                            <span className="text-emerald-700 dark:text-emerald-400">
                              {COST_LABELS[result.cost]}
                            </span>
                            {result.duration && (
                              <>
                                <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                                  ·
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {result.duration}
                                </span>
                              </>
                            )}
                          </div>

                          <h3 className="text-base sm:text-lg font-extrabold text-[#062D4C] dark:text-white leading-snug">
                            {result.title}
                          </h3>

                          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                            {result.description}
                          </p>

                          {result.whyRecommended && (
                            <p className="text-xs font-bold text-[#062D4C] dark:text-sky-300 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2">
                              لماذا يناسبك: {result.whyRecommended}
                            </p>
                          )}

                          {result.lessons.length > 0 && (
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 pt-1">
                              يشمل {result.lessons.length} دروس مبدئية جاهزة لبناء مسار تعلم
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="px-4 sm:px-5 pb-4 pt-1 space-y-2">
                        <button
                          type="button"
                          data-testid={`ai-create-path-${result.id}`}
                          disabled={savingResultId === `path_${result.id}`}
                          onClick={() => void handleCreatePathFromResult(result)}
                          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] shadow-[2px_3px_0_#B92622] rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50"
                        >
                          <Route className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>
                            {savingResultId === `path_${result.id}`
                              ? 'جاري الإنشاء...'
                              : 'إنشاء مسار تعلم من الكورس'}
                          </span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            data-testid={`ai-save-course-${result.id}`}
                            disabled={savingResultId === result.id || isSaved}
                            onClick={() => void handleSaveResult(result)}
                            className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold rounded-lg border-2 cursor-pointer whitespace-nowrap ${
                              isSaved
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-600'
                                : 'bg-[#B92622] hover:bg-[#9E1E1B] text-white border-[#062D4C]'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {isSaved
                                ? 'محفوظ في كورساتي'
                                : savingResultId === result.id
                                  ? 'جاري الحفظ...'
                                  : 'حفظ في كورساتي'}
                            </span>
                          </button>

                          <a
                            href={normalizeUrl(result.url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-extrabold text-[#062D4C] dark:text-white bg-amber-50 dark:bg-slate-800 hover:bg-amber-100 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg whitespace-nowrap"
                          >
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>فتح الرابط</span>
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              {aiSources.length > 0 && (
                <div className="rounded-xl border border-[#062D4C]/25 dark:border-slate-700 bg-white/90 dark:bg-slate-900 p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white">
                    <Globe className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
                    <span>مصادر البحث المستخدمة ({aiSources.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-semibold">
                    {aiSources.map((src) => (
                      <a
                        key={src.url}
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#062D4C] dark:text-sky-300 hover:underline"
                      >
                        <span>{src.title}</span>
                        <ArrowUpRight className="w-3 h-3 shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ==================== MY COURSES VIEW ==================== */}
      {activeTab === 'my_courses' && (
        <div className="space-y-6">
          {/* Search and Filter Bar */}
          <section
            aria-label="بحث وتصفية كورساتي"
            className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
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
                  placeholder="ابحث باسم الكورس أو المنصة أو التخصص..."
                  aria-label="البحث في كورساتي"
                  className="w-full rounded-xl border-2 border-[#062D4C]/25 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label="تصفية حسب الحالة"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as CourseStatus | 'all')}
                  className="px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">كل الحالات</option>
                  <option value="active">قيد المتابعة</option>
                  <option value="completed">مكتمل</option>
                  <option value="wishlist">محفوظ لاحقاً</option>
                </select>

                <select
                  aria-label="تصفية حسب التخصص"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-3 py-2 text-xs sm:text-sm font-bold text-[#062D4C] dark:text-white bg-slate-50 dark:bg-slate-800 border-2 border-[#062D4C]/25 dark:border-slate-700 rounded-xl"
                >
                  <option value="all">كل التخصصات</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {cloudLoading && courses.length === 0 ? (
            <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
              جاري تحميل كورساتك...
            </div>
          ) : filteredCourses.length === 0 ? (
            <section className="rounded-2xl border-2 border-dashed border-[#062D4C]/40 dark:border-slate-600 bg-white dark:bg-slate-900 p-10 text-center space-y-4 shadow-[0_4px_0_#062D4C]">
              <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] text-[#B92622] dark:text-amber-300 flex items-center justify-center">
                <GraduationCap className="w-7 h-7" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-extrabold text-[#062D4C] dark:text-white">
                  {courses.length === 0
                    ? 'لم تضف أي كورسات بعد'
                    : 'لا توجد كورسات تطابق البحث الحالي'}
                </h2>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                  {courses.length === 0
                    ? 'أضف كورساً تتابعه الآن يدوياً، أو جرّب مكتشف الكورسات الذكي للعثور على أفضل الدورات.'
                    : 'أعد ضبط البحث أو التصفية لعرض جميع الكورسات المحفوظة.'}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('ai_finder')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-[#D97706] hover:bg-[#B45309] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" aria-hidden="true" />
                  <span>ابحث بالذكاء الاصطناعي</span>
                </button>
                <button
                  type="button"
                  onClick={onAddManualCourse}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  <span>إضافة كورس يدوياً</span>
                </button>
              </div>
            </section>
          ) : (
            <div
              data-testid="my-courses-grid"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredCourses.map((course) => {
                const broken = Boolean(brokenImages[course.id]);
                const resolvedCover = resolveMediaUrl(course.thumbnailUrl);
                return (
                  <article
                    key={course.id}
                    data-testid={`course-card-${course.id}`}
                    className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {!broken && resolvedCover ? (
                        <div className="relative aspect-video w-full bg-slate-900 border-b-2 border-[#062D4C] dark:border-slate-700 overflow-hidden">
                          <img
                            src={resolvedCover}
                            alt={course.title}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setBrokenImages((prev) => ({ ...prev, [course.id]: true }))
                            }
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="relative px-4 py-3 bg-[#062D4C] text-white border-b-2 border-[#041E34] overflow-hidden flex items-center justify-between gap-2">
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[#B92622]"
                            style={{ clipPath: 'polygon(0 0, 72% 0, 38% 100%, 0 100%)' }}
                          />
                          <span className="relative z-10 inline-flex items-center gap-1.5 text-xs font-extrabold">
                            <GraduationCap className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
                            <span>{course.platform}</span>
                          </span>
                          <span className="relative z-10 text-[11px] font-bold text-emerald-300">
                            {COURSE_STATUS_LABELS[course.status]}
                          </span>
                        </div>
                      )}

                      <div className="p-4 sm:p-5 space-y-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-amber-300">
                          <span className="font-extrabold text-[#B92622] dark:text-rose-400">
                            {course.platform}
                          </span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span>{course.category}</span>
                          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                            ·
                          </span>
                          <span className="text-emerald-700 dark:text-emerald-400">
                            {COURSE_STATUS_LABELS[course.status]}
                          </span>
                        </div>

                        <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white leading-snug">
                          {course.title}
                        </h2>

                        {course.description && (
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                            {course.description}
                          </p>
                        )}

                        {/* Progress Bar */}
                        <div className="pt-2 space-y-1">
                          <div className="flex items-center justify-between text-xs font-bold text-[#062D4C] dark:text-slate-200 tabular-nums">
                            <span>التقدم في الكورس</span>
                            <span>{course.progressPercent}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 border border-[#062D4C] dark:border-slate-600 overflow-hidden p-0.5">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-200"
                              style={{ width: `${course.progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 sm:px-5 pb-4 pt-1 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          data-testid={`open-course-detail-${course.id}`}
                          onClick={() => onInspectCourse(course)}
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#062D4C] shadow-[2px_3px_0_#B92622] rounded-lg cursor-pointer whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>فتح وإدارة</span>
                        </button>

                        <a
                          href={normalizeUrl(course.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[2px_3px_0_#062D4C] rounded-lg whitespace-nowrap"
                        >
                          <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span>زيارة الكورس</span>
                        </a>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-1 pt-0.5">
                        {course.linkedPathId ? (
                          <button
                            type="button"
                            onClick={() => onOpenLearningPath(course.linkedPathId)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <Route className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>مسار التعلم المرتبط</span>
                          </button>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                            {course.videos.length} {course.videos.length === 1 ? 'فيديو' : 'فيديوهات'}
                          </span>
                        )}

                        <div className="flex items-center gap-1">
                          {onToggleFavoriteCourse && (() => {
                            const fav = isCourseFavorite ? isCourseFavorite(course.id) : false;
                            return (
                              <button
                                type="button"
                                onClick={() => onToggleFavoriteCourse(course)}
                                aria-label={fav ? `إزالة "${course.title}" من المفضلة` : `إضافة "${course.title}" للمفضلة`}
                                title={fav ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
                                className={`p-1.5 rounded-lg cursor-pointer ${
                                  fav
                                    ? 'text-[#B92622] bg-rose-50 dark:bg-rose-950/40'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <Heart className={`w-3.5 h-3.5 ${fav ? 'fill-[#B92622]' : ''}`} aria-hidden="true" />
                              </button>
                            );
                          })()}
                          {onScheduleCourse && (
                            <button
                              type="button"
                              onClick={() => onScheduleCourse(course)}
                              aria-label={`جدولة "${course.title}" في التقويم`}
                              title="جدولة في التقويم"
                              className="p-1.5 text-slate-600 dark:text-sky-300 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              <CalendarPlus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                          )}
                          {onShareCourse && (
                            <button
                              type="button"
                              onClick={() => onShareCourse(course)}
                              aria-label={`مشاركة "${course.title}"`}
                              title="مشاركة"
                              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onEditCourse(course)}
                            aria-label={`تعديل "${course.title}"`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-[#062D4C] dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteCourse(course)}
                            aria-label={`حذف "${course.title}"`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>حذف</span>
                          </button>
                        </div>
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
