import type { User } from 'firebase/auth';
import {
  Award,
  BarChart3,
  Bell,
  Brain,
  CalendarDays,
  CheckSquare,
  CloudCheck,
  Film,
  Flame,
  FolderKanban,
  Gamepad2,
  GitBranch,
  GraduationCap,
  Heart,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Moon,
  NotebookPen,
  PackageOpen,
  Route,
  Share2,
  Sun,
  Trophy,
} from 'lucide-react';
import type { AppSection } from '../types/workspace';

interface HeaderProps {
  activeSection: AppSection;
  onChangeSection: (section: AppSection) => void;
  user: User | null;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  userLevel?: number;
  currentStreak?: number;
  unreadNotificationsCount?: number;
  pendingReviewCount?: number;
  onOpenNotifications?: () => void;
}

const PLATFORM_TABS: { id: AppSection; label: string }[] = [
  { id: 'dashboard', label: 'الرئيسية' },
  { id: 'path', label: 'المسار' },
  { id: 'skills', label: 'المهارات' },
  { id: 'projects', label: 'المشاريع' },
  { id: 'review', label: 'المراجعة' },
  { id: 'stats', label: 'الإحصائيات' },
  { id: 'achievements', label: 'الإنجازات' },
  { id: 'leaderboard', label: 'المتصدرون' },
  { id: 'favorites', label: 'المفضلة' },
];

const WORKSPACE_TABS: { id: AppSection; label: string }[] = [
  { id: 'courses', label: 'كورساتي' },
  { id: 'board', label: 'لوحة التعلم' },
  { id: 'videos', label: 'الفيديوهات' },
  { id: 'jams', label: 'المسابقات' },
  { id: 'calendar', label: 'التقويم' },
  { id: 'todos', label: 'المهام' },
  { id: 'vault', label: 'الخزنة' },
  { id: 'assets', label: 'الأصول' },
  { id: 'notes', label: 'الملاحظات' },
  { id: 'shared', label: 'المشاركات' },
];

export function Header({
  activeSection,
  onChangeSection,
  user,
  isDark,
  onToggleTheme,
  onSignIn,
  onSignOut,
  userLevel = 1,
  currentStreak = 0,
  unreadNotificationsCount = 0,
  pendingReviewCount = 0,
  onOpenNotifications,
}: HeaderProps) {
  return (
    <>
      <header className="sticky top-0 z-30 w-full bg-[#062D4C] text-white border-b-2 border-[#041E34] shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onChangeSection('dashboard');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="text-base sm:text-lg font-black tracking-tight text-white whitespace-nowrap shrink-0 flex items-center gap-1"
          >
            <span>مسار</span>
            <span className="text-[#F87171]">التعلم</span>
          </a>

          {/* Zone 2: Primary Platform Navigation Tabs (Desktop) */}
          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-0.5 lg:gap-1 text-[11px] lg:text-xs font-bold text-slate-200 overflow-x-auto no-scrollbar py-1"
          >
            {PLATFORM_TABS.map((tab) => {
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`nav-tab-${tab.id}`}
                  onClick={() => onChangeSection(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-2 lg:px-2.5 py-1.5 rounded-xl whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1 ${
                    isActive
                      ? 'bg-white text-[#062D4C] font-extrabold shadow-xs'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.id === 'review' && pendingReviewCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#B92622] text-white text-[10px] font-black tabular-nums">
                      {pendingReviewCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Level, Notifications Bell, Theme Toggle & Account */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onChangeSection('achievements')}
              title={`المستوى ${userLevel} · السلسلة ${currentStreak} يوم`}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-xs font-black text-amber-300 tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>م{userLevel}</span>
              {currentStreak > 0 && (
                <>
                  <span className="text-white/30">·</span>
                  <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" aria-hidden="true" />
                  <span>{currentStreak}</span>
                </>
              )}
            </button>

            {onOpenNotifications && (
              <button
                type="button"
                data-testid="notifications-bell-btn"
                onClick={onOpenNotifications}
                aria-label={`الإشعارات (${unreadNotificationsCount} غير مقروءة)`}
                className="relative w-9 h-9 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <Bell className="w-4 h-4" aria-hidden="true" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#B92622] border border-white text-white text-[10px] font-black flex items-center justify-center tabular-nums">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
              title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
              className="w-9 h-9 rounded-xl border border-white/25 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-4 h-4 text-amber-300" aria-hidden="true" />
              ) : (
                <Moon className="w-4 h-4" aria-hidden="true" />
              )}
            </button>

            {user ? (
              <button
                type="button"
                onClick={onSignOut}
                title={user.email || 'تسجيل الخروج'}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/25 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CloudCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
                <span className="max-w-[88px] truncate">
                  {user.displayName || user.email || 'حسابي'}
                </span>
                <LogOut className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold text-white bg-[#B92622] hover:bg-[#9E1E1B] border border-white/20 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>حفظ في حسابي</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Secondary Non-Sticky Workspace Bar (Desktop) */}
      <div className="hidden md:block bg-[#0B3B61] text-white border-b border-[#041E34] print:hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-10 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <nav aria-label="أدوات مساحة العمل" className="flex items-center gap-1 text-[11px] font-bold">
            {WORKSPACE_TABS.map((tab) => {
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  data-testid={`nav-tab-${tab.id}`}
                  onClick={() => onChangeSection(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-[#B92622] text-white font-extrabold'
                      : 'text-slate-200 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Mobile Section Switcher in normal document flow */}
      <div className="md:hidden px-3 pt-2.5 space-y-2 print:hidden">
        <nav
          aria-label="تبديل الأقسام الرئيسية على الهاتف"
          className="max-w-6xl mx-auto grid grid-cols-3 gap-1 rounded-xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-700 p-1 shadow-[0_3px_0_#062D4C] dark:shadow-[0_3px_0_#020617]"
        >
          {(
            [
              { id: 'dashboard', label: 'الرئيسية', icon: Home },
              { id: 'path', label: 'المسار', icon: Route },
              { id: 'skills', label: 'المهارات', icon: GitBranch },
              { id: 'projects', label: 'المشاريع', icon: FolderKanban },
              { id: 'review', label: 'المراجعة', icon: Brain },
              { id: 'stats', label: 'الإحصائيات', icon: BarChart3 },
              { id: 'achievements', label: 'الإنجازات', icon: Award },
              { id: 'leaderboard', label: 'المتصدرون', icon: Trophy },
              { id: 'favorites', label: 'المفضلة', icon: Heart },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeSection(item.id)}
                className={`inline-flex items-center justify-center gap-1 py-2 px-1 rounded-lg text-[11px] font-extrabold whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#062D4C] text-white dark:bg-white dark:text-[#062D4C]'
                    : 'text-[#062D4C] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <nav
          aria-label="أدوات مساحة العمل على الهاتف"
          className="max-w-6xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar rounded-xl bg-[#0B3B61] text-white border-2 border-[#062D4C] p-1.5"
        >
          {(
            [
              { id: 'courses', label: 'كورساتي', icon: GraduationCap },
              { id: 'board', label: 'لوحة التعلم', icon: LayoutDashboard },
              { id: 'videos', label: 'الفيديوهات', icon: Film },
              { id: 'jams', label: 'المسابقات', icon: Gamepad2 },
              { id: 'calendar', label: 'التقويم', icon: CalendarDays },
              { id: 'todos', label: 'المهام', icon: CheckSquare },
              { id: 'vault', label: 'الخزنة', icon: FolderKanban },
              { id: 'assets', label: 'الأصول', icon: PackageOpen },
              { id: 'notes', label: 'الملاحظات', icon: NotebookPen },
              { id: 'shared', label: 'المشاركات', icon: Share2 },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeSection(item.id)}
                className={`inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg text-[11px] font-extrabold whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#B92622] text-white'
                    : 'text-slate-100 hover:bg-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
