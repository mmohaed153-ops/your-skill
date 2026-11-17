import { useMemo, useState } from 'react';
import {
  ArchiveRestore,
  CheckSquare,
  Folder,
  FolderPlus,
  HardDriveUpload,
  History,
  NotebookPen,
  Pencil,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { resolveMediaUrl } from '../../data/presets';
import { SectionHeroBanner } from '../SectionHeroBanner';
import type {
  SavedGameJam,
  VaultProject,
  VaultVersion,
  WorkspaceNote,
} from '../../types/workspace';
import { getNotesLinkedToTarget } from '../../utils/notesLogic';
import {
  DEFAULT_VAULT_FOLDERS,
  filterVaultProjects,
  formatBytes,
  formatShortDate,
  type StorageSummary,
  type VaultQuickKindFilter,
} from '../../utils/workspaceLogic';
import { StorageUsageCard } from '../StorageUsageCard';

interface ProjectVaultViewProps {
  projects: VaultProject[];
  versionsByProject: Record<string, VaultVersion[]>;
  notes?: WorkspaceNote[];
  savedGameJams?: SavedGameJam[];
  storageSummary?: StorageSummary;
  cloudLoading: boolean;
  onCreateProject: () => void;
  onEditProjectMeta: (project: VaultProject) => void;
  onAddOrReplaceBackup: (project: VaultProject) => void;
  onOpenRestore: (project: VaultProject) => void;
  onCreateTodoForProject?: (project: VaultProject) => void;
  onShareProject?: (project: VaultProject) => void;
  onDeleteProject: (project: VaultProject) => void;
}

const VAULT_KIND_FILTERS: { id: VaultQuickKindFilter; label: string }[] = [
  { id: 'all', label: 'كل الأنواع' },
  { id: 'games', label: 'مشاريع الألعاب' },
  { id: 'web', label: 'تطبيقات الويب' },
  { id: '3d', label: 'نماذج ومشاهد 3D' },
];

export function ProjectVaultView({
  projects,
  versionsByProject,
  notes = [],
  savedGameJams = [],
  storageSummary,
  cloudLoading,
  onCreateProject,
  onEditProjectMeta,
  onAddOrReplaceBackup,
  onOpenRestore,
  onCreateTodoForProject,
  onShareProject,
  onDeleteProject,
}: ProjectVaultViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [quickKind, setQuickKind] = useState<VaultQuickKindFilter>('all');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const folders = useMemo(() => {
    const set = new Set<string>(DEFAULT_VAULT_FOLDERS);
    for (const p of projects) {
      if (p.folder) set.add(p.folder);
    }
    return Array.from(set);
  }, [projects]);

  const filteredProjects = useMemo(
    () => filterVaultProjects(projects, searchQuery, selectedFolder, quickKind),
    [projects, searchQuery, selectedFolder, quickKind]
  );

  const totalVersions = useMemo(
    () =>
      projects.reduce((sum, p) => sum + (versionsByProject[p.id]?.length || 1), 0),
    [projects, versionsByProject]
  );

  const totalProtectedBytes = useMemo(
    () =>
      projects.reduce((sum, p) => {
        const versions = versionsByProject[p.id] || [];
        return sum + versions.reduce((vSum, v) => vSum + v.totalSizeBytes, 0);
      }, 0),
    [projects, versionsByProject]
  );

  return (
    <div className="space-y-6">
      {/* Protective Vault Hero Banner */}
      <SectionHeroBanner
        testId="vault-hero-banner"
        kicker={
          <>
            <span className="inline-flex items-center gap-1.5 text-[#B92622] dark:text-rose-400">
              <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>منطقة النسخ الاحتياطي والاستعادة</span>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-[#062D4C] dark:text-slate-200">
              {projects.length} {projects.length === 1 ? 'مشروع محمي' : 'مشاريع محمية'}
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
              ·
            </span>
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              {totalVersions} {totalVersions === 1 ? 'نسخة محفوظة' : 'نسخ محفوظة'} ({formatBytes(totalProtectedBytes)})
            </span>
          </>
        }
        title="خزنة المشاريع (Project Vault)"
        description="احفظ نسخاً آمنة ومؤرخة من مشاريعك الكاملة بجميع صيغها هنا. في حال تلف أي ملف أو حذفه بالخطأ، يمكنك العودة في أي وقت ومعاينة أو استعادة أي إصدار سابق بضغطة واحدة."
        actions={[
          {
            id: 'vault-create',
            label: 'حفظ مشروع جديد',
            icon: <HardDriveUpload className="w-4 h-4 shrink-0" aria-hidden="true" />,
            onClick: onCreateProject,
            testId: 'vault-create-project-btn',
            tone: 'crimson',
          },
        ]}
      />

      {/* Scalable Cloud Storage Indicator */}
      {storageSummary && <StorageUsageCard summary={storageSummary} />}

      {/* Search and Folder Filter Bar */}
      <section
        aria-label="بحث وتصفية المشاريع المحفوظة"
        className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
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
              placeholder="ابحث باسم المشروع أو نوع الملف أو المجلد..."
              aria-label="البحث في خزنة المشاريع"
              className="w-full rounded-lg border-2 border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pr-10 pl-3 py-2 text-sm font-semibold text-[#062D4C] dark:text-white focus:border-[#062D4C] focus:outline-none"
            />
          </div>

          <div className="text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
            عرض {filteredProjects.length} من {projects.length} مشاريع
          </div>
        </div>

        {/* Quick Project Kind Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {VAULT_KIND_FILTERS.map((kind) => {
            const active = quickKind === kind.id;
            return (
              <button
                key={kind.id}
                type="button"
                onClick={() => setQuickKind(kind.id)}
                className={`px-3 py-1 text-xs font-extrabold rounded-lg border-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#B92622] text-white border-[#062D4C]'
                    : 'bg-slate-50 dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C]'
                }`}
              >
                {kind.label}
              </button>
            );
          })}
        </div>

        {/* Folder Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSelectedFolder('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg border-2 transition-colors whitespace-nowrap cursor-pointer ${
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg border-2 transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25 dark:border-slate-700 hover:border-[#062D4C]'
                }`}
              >
                <span>{folderName}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Projects Library Grid */}
      {cloudLoading && projects.length === 0 ? (
        <div className="py-16 text-center text-sm font-bold text-[#062D4C] dark:text-slate-300">
          جاري تحميل خزنة المشاريع...
        </div>
      ) : filteredProjects.length === 0 ? (
        <section className="rounded-2xl border-2 border-dashed border-[#062D4C]/40 dark:border-slate-600 bg-white/95 dark:bg-slate-900 p-10 text-center space-y-4 shadow-[0_4px_0_#062D4C]">
          <div className="w-14 h-14 mx-auto rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] text-[#B92622] dark:text-rose-400 flex items-center justify-center">
            <FolderPlus className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-extrabold text-[#062D4C] dark:text-white">
              {projects.length === 0
                ? 'خزنتك جاهزة لحماية أول مشروع'
                : 'لا توجد مشاريع تطابق البحث الحالي'}
            </h2>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300 max-w-md mx-auto">
              {projects.length === 0
                ? 'ارفع ملفات مشروعك الآن لحفظ نسخة احتياطية آمنة يمكنك استعادتها في أي وقت.'
                : 'جرّب تعديل كلمات البحث أو اختر "جميع المجلدات" لعرض كل المشاريع المحفوظة.'}
            </p>
          </div>
          {projects.length === 0 ? (
            <button
              type="button"
              onClick={onCreateProject}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-extrabold text-white bg-[#B92622] hover:bg-[#9E1E1B] border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>حفظ مشروع جديد</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedFolder('all');
                setQuickKind('all');
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 border-2 border-[#062D4C] rounded-xl cursor-pointer"
            >
              <span>إعادة ضبط التصفية</span>
            </button>
          )}
        </section>
      ) : (
        <div
          data-testid="vault-projects-grid"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredProjects.map((project) => {
            const versions = versionsByProject[project.id] || [];
            const latestVersion = versions[0];
            const totalFiles = latestVersion?.files.length || 0;
            const totalSize = latestVersion?.totalSizeBytes || 0;
            const imageBroken = Boolean(brokenImages[project.id]);
            const linkedNoteCount = getNotesLinkedToTarget(notes, 'vault_project', project.id).length;
            const linkedJam = project.linkedJamId
              ? savedGameJams.find((j) => j.id === project.linkedJamId)
              : undefined;

            const resolvedPreview = resolveMediaUrl(project.previewImage);

            return (
              <article
                key={project.id}
                data-testid={`vault-project-card-${project.id}`}
                className="rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {!imageBroken && resolvedPreview ? (
                    <div className="relative aspect-video w-full bg-[#062D4C] border-b-2 border-[#062D4C] dark:border-slate-700 overflow-hidden">
                      <img
                        src={resolvedPreview}
                        alt={project.name}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setBrokenImages((prev) => ({ ...prev, [project.id]: true }))
                        }
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-2.5 w-full bg-gradient-to-l from-[#062D4C] via-[#0A3A61] to-[#B92622]" />
                  )}

                  {/* Card Content */}
                  <div className="p-4 sm:p-5 space-y-3">
                    {/* Clean Unboxed Metadata Line */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-amber-300">
                      <span className="font-extrabold text-[#062D4C] dark:text-white">
                        {project.fileType}
                      </span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span>{project.folder}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
                        ·
                      </span>
                      <span className="tabular-nums text-emerald-700 dark:text-emerald-400">
                        {versions.length || 1} {versions.length === 1 ? 'نسخة' : 'نسخ'}
                      </span>
                    </div>

                    <h2 className="text-lg font-extrabold text-[#062D4C] dark:text-white leading-snug">
                      {project.name}
                    </h2>

                    {linkedJam && (
                      <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                        مرتبط بمسابقة: {linkedJam.name}
                      </p>
                    )}

                    {project.description && (
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    )}

                    {/* Dates & Size Summary */}
                    <dl className="pt-2 border-t border-[#062D4C]/15 dark:border-slate-700 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                          تاريخ الرفع
                        </dt>
                        <dd className="font-bold text-[#062D4C] dark:text-slate-200 tabular-nums">
                          {formatShortDate(project.createdAt)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400 font-semibold">
                          آخر نسخة احتياطية
                        </dt>
                        <dd className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                          {formatShortDate(project.latestBackupAt)}
                        </dd>
                      </div>
                      <div className="col-span-2 flex items-center justify-between text-slate-600 dark:text-slate-300 pt-1">
                        <span className="font-semibold">
                          أحدث إصدار: <strong className="text-[#062D4C] dark:text-white">{latestVersion?.versionLabel || `v${project.latestVersionNumber}.0`}</strong>
                        </span>
                        <span className="tabular-nums font-bold">
                          {totalFiles} {totalFiles === 1 ? 'ملف' : 'ملفات'} · {formatBytes(totalSize)}
                        </span>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Action Footer */}
                <div className="px-4 sm:px-5 pb-4 pt-1 space-y-2.5">
                  <button
                    type="button"
                    onClick={() => onOpenRestore(project)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 border-2 border-[#062D4C] shadow-[0_3px_0_#041E34] rounded-lg transition-transform active:translate-y-0.5 whitespace-nowrap cursor-pointer"
                  >
                    <ArchiveRestore className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>استعادة المشروع</span>
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onAddOrReplaceBackup(project)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-[#062D4C] dark:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-[#062D4C] dark:border-slate-600 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span>نسخة احتياطية / تحديث</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {onShareProject && (
                        <button
                          type="button"
                          onClick={() => onShareProject(project)}
                          aria-label={`مشاركة مشروع "${project.name}"`}
                          title="مشاركة المشروع مع الأصدقاء"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#062D4C] dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                      {onCreateTodoForProject && (
                        <button
                          type="button"
                          onClick={() => onCreateTodoForProject(project)}
                          aria-label={`إضافة مهمة لمشروع "${project.name}"`}
                          title="إضافة مهمة في قائمة المهام"
                          className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-bold text-[#062D4C] dark:text-emerald-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          <CheckSquare className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onOpenRestore(project)}
                        aria-label={`ملاحظات مشروع "${project.name}"`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#062D4C] dark:text-amber-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer tabular-nums"
                      >
                        <NotebookPen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>ملاحظات ({linkedNoteCount})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onEditProjectMeta(project)}
                        aria-label={`تعديل "${project.name}"`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#062D4C] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(project)}
                        aria-label={`حذف "${project.name}"`}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#B92622] dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
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
  );
}
