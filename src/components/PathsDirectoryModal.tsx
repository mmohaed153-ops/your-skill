import { CheckCircle2, FolderPlus, Pencil, Route, Trash2, X } from 'lucide-react';
import type { LearningPath, PathProgress } from '../types/learning';

interface PathsDirectoryModalProps {
  open: boolean;
  paths: LearningPath[];
  activePathId: string;
  progressMap: Record<string, PathProgress>;
  onSelectPath: (pathId: string) => void;
  onCreatePath: () => void;
  onEditPath: (path: LearningPath) => void;
  onDeletePath: (path: LearningPath) => void;
  onClose: () => void;
}

export function PathsDirectoryModal({
  open,
  paths,
  activePathId,
  progressMap,
  onSelectPath,
  onCreatePath,
  onEditPath,
  onDeletePath,
  onClose,
}: PathsDirectoryModalProps) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="paths-directory-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_6px_0_#062D4C] dark:shadow-[0_6px_0_#020617] overflow-hidden my-6">
        <div className="px-6 py-4 bg-[#062D4C] text-white border-b-2 border-[#041E34] flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="paths-directory-title" className="text-lg sm:text-xl font-extrabold text-white">
              جميع مساراتي التعليمية ({paths.length})
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-200">
              كل مسار يحتفظ بفيديوهاته وترتيبه ونسبة إنجازه بشكل مستقل.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreatePath();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-white/25 shadow-[0_3px_0_#041E34] rounded-xl transition-transform active:translate-y-0.5 cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إنشاء مسار جديد</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق قائمة المسارات"
              className="p-2 text-slate-200 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[75vh] overflow-y-auto bg-slate-50/70 dark:bg-slate-950/40">
          {paths.map((path) => {
            const stats = progressMap[path.id] || {
              total: 0,
              completedCount: 0,
              percentage: 0,
              currentStepIndex: -1,
              nextStep: null,
            };
            const isActive = path.id === activePathId;

            return (
              <div
                key={path.id}
                data-testid={`path-directory-item-${path.id}`}
                className={`rounded-xl border-2 overflow-hidden flex flex-col justify-between transition-colors ${
                  isActive
                    ? 'border-[#062D4C] dark:border-sky-400 shadow-[0_4px_0_#B92622] bg-white dark:bg-slate-800/90'
                    : 'border-[#062D4C] dark:border-slate-600 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] bg-white dark:bg-slate-900'
                }`}
              >
                <div>
                  {/* Clean architectural header strip without decorative art */}
                  <div className="relative px-4 py-3 bg-[#062D4C] text-white border-b-2 border-[#041E34] overflow-hidden flex items-center justify-between gap-2">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-[#B92622]"
                      style={{ clipPath: 'polygon(0 0, 70% 0, 35% 100%, 0 100%)' }}
                    />
                    <span className="relative z-10 inline-flex items-center gap-1.5 text-xs font-extrabold tabular-nums">
                      <Route className="w-3.5 h-3.5 text-sky-300 shrink-0" aria-hidden="true" />
                      <span>
                        {stats.total} {stats.total === 1 ? 'فيديو' : 'فيديوهات'} · {stats.completedCount} مكتمل
                      </span>
                    </span>
                    {isActive && (
                      <span className="relative z-10 inline-flex items-center gap-1 text-xs text-emerald-300 font-extrabold">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>المسار المفتوح</span>
                      </span>
                    )}
                  </div>

                  <div className="p-4 space-y-2.5">
                    <h3 className="text-base font-extrabold text-[#062D4C] dark:text-white leading-snug">
                      {path.title}
                    </h3>
                    {path.description && (
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                        {path.description}
                      </p>
                    )}

                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-300">
                        <span>التقدم</span>
                        <span className="tabular-nums font-extrabold text-[#062D4C] dark:text-emerald-300">
                          {stats.percentage}%
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-slate-800 border border-[#062D4C] dark:border-slate-600 overflow-hidden p-0.5">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${stats.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 border-t-2 border-[#062D4C]/10 dark:border-slate-700 flex items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/50">
                  <button
                    type="button"
                    onClick={() => {
                      onSelectPath(path.id);
                      onClose();
                    }}
                    className={`px-3.5 py-2 text-xs sm:text-sm font-extrabold rounded-xl border-2 border-[#062D4C] shadow-[0_2px_0_#041E34] transition-transform active:translate-y-0.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#B92622] hover:bg-[#9E1E1B] text-white'
                        : 'bg-[#062D4C] hover:bg-[#083B63] text-white'
                    }`}
                  >
                    {isActive ? 'متابعة المسار' : 'فتح المسار'}
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onEditPath(path);
                      }}
                      aria-label={`تعديل مسار ${path.title}`}
                      className="p-2 text-[#062D4C] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </button>
                    {paths.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onDeletePath(path);
                        }}
                        aria-label={`حذف مسار ${path.title}`}
                        className="p-2 text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
