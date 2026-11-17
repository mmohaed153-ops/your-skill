import {
  Award,
  CheckSquare,
  FolderPlus,
  Heart,
  Layers,
  LayoutDashboard,
  Pencil,
  Plus,
  Share2,
  Trash2,
  Trophy,
} from 'lucide-react';
import type { LearningPath, PathProgress } from '../types/learning';
import { SectionHeroBanner, type HeroActionItem } from './SectionHeroBanner';

interface PathHeroBarProps {
  paths: LearningPath[];
  activePath: LearningPath;
  progress: PathProgress;
  isFavorite?: boolean;
  hasCertificate?: boolean;
  onSelectPath: (pathId: string) => void;
  onViewAllPaths: () => void;
  onCreatePath: () => void;
  onEditPath: () => void;
  onCreateTodoForPath?: (path: LearningPath) => void;
  onSendPathToBoard?: (path: LearningPath) => void;
  onSharePath?: (path: LearningPath) => void;
  onToggleFavoritePath?: (path: LearningPath) => void;
  onOpenCertificate?: () => void;
  onDeletePath: () => void;
  onAddVideo: () => void;
}

export function PathHeroBar({
  paths,
  activePath,
  progress,
  isFavorite = false,
  hasCertificate = false,
  onSelectPath,
  onViewAllPaths,
  onCreatePath,
  onEditPath,
  onCreateTodoForPath,
  onSendPathToBoard,
  onSharePath,
  onToggleFavoritePath,
  onOpenCertificate,
  onDeletePath,
  onAddVideo,
}: PathHeroBarProps) {
  const actions: HeroActionItem[] = [
    {
      id: 'add-video',
      label: 'إضافة فيديو إلى مساري',
      icon: <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />,
      onClick: onAddVideo,
      tone: 'crimson',
    },
    ...(hasCertificate && onOpenCertificate
      ? [
          {
            id: 'view-certificate',
            label: 'عرض الشهادة',
            icon: <Award className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: onOpenCertificate,
            testId: 'path-certificate-btn',
            tone: 'emerald' as const,
          },
        ]
      : []),
    ...(onCreateTodoForPath
      ? [
          {
            id: 'create-todo',
            label: 'إضافة مهمة',
            icon: <CheckSquare className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => onCreateTodoForPath(activePath),
            ariaLabel: `إضافة مهمة لمسار ${activePath.title}`,
            tone: 'emerald' as const,
          },
        ]
      : []),
    ...(onSendPathToBoard
      ? [
          {
            id: 'send-board',
            label: 'لوحة التعلم',
            icon: <LayoutDashboard className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => onSendPathToBoard(activePath),
            ariaLabel: `إرسال مسار ${activePath.title} إلى لوحة التعلم`,
            testId: 'path-to-board-btn',
            tone: 'amber' as const,
          },
        ]
      : []),
    ...(onSharePath
      ? [
          {
            id: 'share-path',
            label: 'مشاركة',
            icon: <Share2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: () => onSharePath(activePath),
            ariaLabel: `مشاركة مسار ${activePath.title}`,
            testId: 'share-path-btn',
            tone: 'blue' as const,
          },
        ]
      : []),
    ...(onToggleFavoritePath
      ? [
          {
            id: 'favorite-path',
            label: isFavorite ? 'في المفضلة' : 'مفضلة',
            icon: (
              <Heart
                className={`w-4 h-4 shrink-0 ${isFavorite ? 'fill-[#B92622] text-[#B92622]' : ''}`}
                aria-hidden="true"
              />
            ),
            onClick: () => onToggleFavoritePath(activePath),
            ariaLabel: isFavorite
              ? `إزالة مسار ${activePath.title} من المفضلة`
              : `إضافة مسار ${activePath.title} للمفضلة`,
            testId: 'favorite-path-btn',
            tone: 'light' as const,
          },
        ]
      : []),
    {
      id: 'edit-path',
      label: 'تعديل المسار',
      icon: <Pencil className="w-4 h-4 shrink-0" aria-hidden="true" />,
      onClick: onEditPath,
      ariaLabel: `تعديل مسار ${activePath.title}`,
      tone: 'slate',
    },
    ...(paths.length > 1
      ? [
          {
            id: 'delete-path',
            label: 'حذف',
            icon: <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: onDeletePath,
            ariaLabel: `حذف مسار ${activePath.title}`,
            tone: 'burgundy' as const,
          },
        ]
      : []),
  ];

  return (
    <section id="paths-switcher" className="space-y-4">
      {/* Path Switcher Tabs + Directory & New Path Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="المسارات التعليمية"
          className="flex flex-wrap items-center gap-2"
        >
          {paths.map((path) => {
            const isActive = path.id === activePath.id;
            return (
              <button
                key={path.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onSelectPath(path.id)}
                className={`px-4 py-2 text-sm font-extrabold rounded-xl border-2 transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#062D4C] text-white border-[#062D4C] shadow-[0_3px_0_#B92622]'
                    : 'bg-white dark:bg-slate-900 text-[#062D4C] dark:text-slate-100 border-[#062D4C] dark:border-slate-600 shadow-[0_3px_0_#062D4C] dark:shadow-[0_3px_0_#334155] hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {path.title}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onViewAllPaths}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-bold text-[#062D4C] dark:text-slate-100 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border-2 border-[#062D4C] dark:border-slate-600 shadow-[0_3px_0_#062D4C] dark:shadow-[0_3px_0_#334155] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
          >
            <Layers className="w-4 h-4 text-[#B92622] dark:text-sky-400 shrink-0" aria-hidden="true" />
            <span>كل المسارات ({paths.length})</span>
          </button>

          <button
            type="button"
            onClick={onCreatePath}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-extrabold text-white bg-[#062D4C] hover:bg-[#083B63] border-2 border-[#041E34] shadow-[0_3px_0_#B92622] rounded-xl transition-transform active:translate-y-0.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FolderPlus className="w-4 h-4 text-amber-300 shrink-0" aria-hidden="true" />
            <span>إنشاء مسار جديد</span>
          </button>
        </div>
      </div>

      {/* Unified Split Architectural Hero Banner */}
      <SectionHeroBanner
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#D97706] dark:text-amber-300">
              <Trophy className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>رحلة التعلم</span>
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
              ·
            </span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-100">
              {progress.total} {progress.total === 1 ? 'فيديو تعليمي' : 'فيديوهات تعليمية'}
            </span>
            <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
              ·
            </span>
            <span className="tabular-nums text-[#15803D] dark:text-emerald-400">
              {progress.completedCount} مكتمل
            </span>
          </>
        }
        title={activePath.title}
        description={activePath.description || undefined}
        progress={{
          label: 'نسبة الإنجاز في المسار',
          percentage: progress.percentage,
          ariaLabel: 'نسبة إتمام المسار التعليمي',
        }}
        actions={actions}
      />
    </section>
  );
}
