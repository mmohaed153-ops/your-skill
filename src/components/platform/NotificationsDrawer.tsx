import { Award, Bell, CheckCheck, Flame, FolderKanban, Sparkles, Trophy, X } from 'lucide-react';
import type { PlatformNotification } from '../../types/platform';
import type { AppSection } from '../../types/workspace';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: PlatformNotification[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateSection: (section: AppSection) => void;
}

const KIND_LABELS: Record<PlatformNotification['kind'], string> = {
  xp: 'نقاط خبرة',
  level_up: 'ترقية مستوى',
  badge: 'شارة إنجاز',
  streak: 'سلسلة التعلم',
  quiz: 'اختبار',
  project: 'مشروع عملي',
  certificate: 'شهادة إنجاز',
  leaderboard: 'المتصدرون',
};

function renderKindIcon(kind: PlatformNotification['kind']) {
  switch (kind) {
    case 'streak':
      return <Flame className="w-4 h-4 text-orange-600 dark:text-amber-300" aria-hidden="true" />;
    case 'badge':
    case 'certificate':
      return <Award className="w-4 h-4 text-[#B92622] dark:text-amber-300" aria-hidden="true" />;
    case 'level_up':
    case 'leaderboard':
      return <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-300" aria-hidden="true" />;
    case 'project':
      return <FolderKanban className="w-4 h-4 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />;
    default:
      return <Sparkles className="w-4 h-4 text-[#062D4C] dark:text-sky-300" aria-hidden="true" />;
  }
}

export function NotificationsDrawer({
  open,
  onClose,
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onNavigateSection,
}: NotificationsDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-[#062D4C]/45 backdrop-blur-xs flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="مركز الإشعارات"
      onClick={onClose}
    >
      <div
        data-testid="notifications-drawer"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-r-2 border-[#062D4C] dark:border-slate-700 flex flex-col shadow-2xl"
      >
        <div className="px-5 py-4 bg-[#062D4C] text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-300" aria-hidden="true" />
            <div>
              <h2 className="text-base font-black">مركز الإشعارات</h2>
              <p className="text-xs text-slate-200 font-semibold tabular-nums">
                {unreadCount > 0 ? `${unreadCount} إشعارات غير مقروءة` : 'جميع الإشعارات مقروءة'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق مركز الإشعارات"
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-950">
          <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 tabular-nums">
            إجمالي السجل: {notifications.length}
          </span>
          <button
            type="button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#062D4C]/30 dark:border-slate-700 text-xs font-extrabold text-[#062D4C] dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
          >
            <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>تحديد الكل كمقروء</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {notifications.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <Bell className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-black text-[#062D4C] dark:text-slate-200">
                لا توجد إشعارات بعد
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-xs mx-auto">
                أكمل درساً أو اختبر نفسك أو أنجز مشروعاً عملياً لتظهر هنا إشعارات الخبرة والشارات والشهادات.
              </p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`rounded-xl border-2 p-3 transition-colors ${
                  n.read
                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                    : 'border-[#062D4C] dark:border-amber-400/70 bg-amber-50/60 dark:bg-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-[#062D4C]/20 flex items-center justify-center shrink-0">
                      {renderKindIcon(n.kind)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-[#062D4C] dark:text-white leading-snug">
                        {n.title}
                      </p>
                      <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {KIND_LABELS[n.kind]} · {n.createdAt.slice(0, 10)}
                      </p>
                    </div>
                  </div>
                  {!n.read && (
                    <span className="w-2.5 h-2.5 rounded-full bg-[#B92622] shrink-0 mt-1" />
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                  {n.message}
                </p>

                <div className="mt-2.5 flex items-center justify-end gap-2">
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => onMarkRead(n.id)}
                      className="text-[11px] font-extrabold text-slate-600 dark:text-slate-300 hover:underline cursor-pointer"
                    >
                      تحديد كمقروء
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!n.read) onMarkRead(n.id);
                      onNavigateSection(n.targetSection as AppSection);
                      onClose();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#062D4C] text-white text-[11px] font-extrabold hover:bg-[#093C66] cursor-pointer"
                  >
                    فتح القسم
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
