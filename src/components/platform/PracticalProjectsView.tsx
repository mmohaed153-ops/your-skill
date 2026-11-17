import { useState } from 'react';
import {
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FolderKanban,
  Plus,
  Trash2,
} from 'lucide-react';
import type { LearningPath } from '../../types/learning';
import type { PracticalProject, PracticalProjectStatus } from '../../types/platform';
import type { StoredFileRef, UploadProgressState } from '../../types/workspace';
import { formatBytes } from '../../utils/workspaceLogic';
import { SectionHeroBanner } from '../SectionHeroBanner';
import { StoredFilePreviewPanel } from '../StoredFilePreviewPanel';
import { PracticalProjectModal } from './PracticalProjectModal';
import type { SavePracticalProjectPayload } from '../../hooks/usePracticalProjects';

interface PracticalProjectsViewProps {
  projects: PracticalProject[];
  paths: LearningPath[];
  uid: string | null;
  uploadProgress: UploadProgressState;
  onSaveProject: (
    payload: SavePracticalProjectPayload,
    editingId?: string
  ) => Promise<{ project: PracticalProject; newlyCompleted: boolean }>;
  onToggleStage: (
    project: PracticalProject,
    stageId: string
  ) => Promise<{ newlyCompleted: boolean; updated: PracticalProject }>;
  onSetStatus: (
    project: PracticalProject,
    nextStatus: PracticalProjectStatus
  ) => Promise<{ newlyCompleted: boolean }>;
  onDeleteProject: (project: PracticalProject) => Promise<void>;
  onDownloadFile: (fileRef: StoredFileRef) => Promise<void>;
  onProjectCompletedReward: (project: PracticalProject) => Promise<void>;
  onOpenLinkedPath: (pathId: string) => void;
}

const STATUS_BADGE: Record<PracticalProjectStatus, { label: string; cls: string }> = {
  not_started: {
    label: 'لم يبدأ',
    cls: 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200',
  },
  in_progress: {
    label: 'قيد التنفيذ',
    cls: 'bg-[#D97706] text-white',
  },
  completed: {
    label: 'مكتمل',
    cls: 'bg-[#15803D] text-white',
  },
};

export function PracticalProjectsView({
  projects,
  paths,
  uid,
  uploadProgress,
  onSaveProject,
  onToggleStage,
  onSetStatus,
  onDeleteProject,
  onDownloadFile,
  onProjectCompletedReward,
  onOpenLinkedPath,
}: PracticalProjectsViewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<PracticalProject | null>(null);
  const [previewingFile, setPreviewingFile] = useState<StoredFileRef | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | PracticalProjectStatus>('all');

  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const pct = projects.length > 0 ? Math.round((completedCount / projects.length) * 100) : 0;

  const visibleProjects = projects.filter(
    (p) => statusFilter === 'all' || p.status === statusFilter
  );

  return (
    <div data-testid="practical-projects-view" className="space-y-6">
      <SectionHeroBanner
        testId="practical-projects-hero"
        kicker={
          <span>
            التطبيق العملي · {completedCount} من {projects.length} مشروع عملي مكتمل
          </span>
        }
        title="المشاريع العملية — تطبيق المهارات وبناء أعمال حقيقية"
        description="أنفذ مشاريع تطبيقية مرتبطة بمساراتك، تتبع مراحل التنفيذ خطوة بخطوة، ارفع ملفات وصور مشروعك، واحصد +120 XP عند الإتمام."
        progress={{
          label: 'نسبة إتمام المشاريع العملية',
          percentage: pct,
        }}
        actions={[
          {
            id: 'create-practical-project',
            label: 'إضافة مشروع عملي جديد',
            icon: <Plus className="w-4 h-4" aria-hidden="true" />,
            onClick: () => {
              setEditingTarget(null);
              setModalOpen(true);
            },
            tone: 'crimson',
          },
        ]}
        bottomExtra={
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'all', label: `الكل (${projects.length})` },
                { id: 'not_started', label: 'لم يبدأ' },
                { id: 'in_progress', label: 'قيد التنفيذ' },
                { id: 'completed', label: 'مكتمل' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-xl border-2 text-xs font-extrabold cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#062D4C] text-white border-[#062D4C]'
                    : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-100 border-[#062D4C]/40'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {previewingFile && (
        <StoredFilePreviewPanel
          fileRef={previewingFile}
          uid={uid}
          onClose={() => setPreviewingFile(null)}
        />
      )}

      {visibleProjects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-8 text-center space-y-2">
          <FolderKanban className="w-10 h-10 text-[#062D4C] dark:text-sky-400 mx-auto" />
          <p className="text-base font-black text-[#062D4C] dark:text-white">
            لا توجد مشاريع مطابقة للتصفية الحالية
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {visibleProjects.map((proj) => {
            const doneStages = proj.stages.filter((s) => s.completed).length;
            const totalStages = proj.stages.length;
            const stagePct = totalStages > 0 ? Math.round((doneStages / totalStages) * 100) : 0;
            const statusMeta = STATUS_BADGE[proj.status];

            return (
              <article
                key={proj.id}
                data-testid={`practical-project-card-${proj.id}`}
                className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-black ${statusMeta.cls}`}
                      >
                        {statusMeta.label}
                      </span>
                      <span className="text-xs font-black text-[#15803D] dark:text-emerald-400 tabular-nums">
                        +{proj.xpReward} XP
                      </span>
                      {proj.linkedPathTitle && (
                        <button
                          type="button"
                          onClick={() => onOpenLinkedPath(proj.linkedPathId)}
                          className="text-xs font-extrabold text-[#1D4ED8] dark:text-sky-400 hover:underline cursor-pointer"
                        >
                          المسار: {proj.linkedPathTitle}
                        </button>
                      )}
                    </div>
                    <h3 className="text-lg font-black text-[#062D4C] dark:text-white">
                      {proj.title}
                    </h3>
                    {proj.description && (
                      <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        {proj.description}
                      </p>
                    )}
                    {proj.requiredSkills.length > 0 && (
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        المهارات المطلوبة: {proj.requiredSkills.join(' · ')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {proj.status !== 'completed' && (
                      <button
                        type="button"
                        data-testid={`complete-project-btn-${proj.id}`}
                        onClick={async () => {
                          const { newlyCompleted } = await onSetStatus(proj, 'completed');
                          if (newlyCompleted) {
                            await onProjectCompletedReward(proj);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#15803D] hover:bg-[#166534] text-white px-3 py-2 text-xs font-black cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>اعتماد الإتمام</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTarget(proj);
                        setModalOpen(true);
                      }}
                      aria-label="تعديل المشروع"
                      className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onDeleteProject(proj)}
                      aria-label="حذف المشروع"
                      className="p-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950 text-[#B92622] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {proj.requirements && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-3 text-xs font-semibold text-slate-700 dark:text-slate-300 whitespace-pre-line">
                    {proj.requirements}
                  </div>
                )}

                {/* Stages Checklist */}
                {proj.stages.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-extrabold tabular-nums">
                      <span>مراحل العمل</span>
                      <span className="text-[#15803D] dark:text-emerald-400">
                        {doneStages} / {totalStages} ({stagePct}%)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {proj.stages.map((stage) => (
                        <label
                          key={stage.id}
                          className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs font-bold cursor-pointer ${
                            stage.completed
                              ? 'border-[#15803D] bg-emerald-50/70 dark:bg-emerald-950/30 line-through text-slate-500'
                              : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-[#062D4C] dark:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={stage.completed}
                            onChange={async () => {
                              const { newlyCompleted, updated } = await onToggleStage(
                                proj,
                                stage.id
                              );
                              if (newlyCompleted) {
                                await onProjectCompletedReward(updated);
                              }
                            }}
                            className="mt-0.5 accent-[#15803D]"
                          />
                          <span>{stage.title}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Attachments & Project URL */}
                {(proj.files.length > 0 || proj.projectUrl) && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {proj.files.map((fileRef) => (
                        <div
                          key={fileRef.blobId}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#062D4C]/30 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2.5 py-1.5 text-xs font-bold"
                        >
                          <span className="truncate max-w-[160px]">
                            {fileRef.name} ({formatBytes(fileRef.size)})
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewingFile(fileRef)}
                            aria-label={`معاينة ${fileRef.name}`}
                            className="p-1 text-[#062D4C] dark:text-sky-400 hover:underline cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDownloadFile(fileRef)}
                            aria-label={`تنزيل ${fileRef.name}`}
                            className="p-1 text-[#15803D] dark:text-emerald-400 hover:underline cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {proj.projectUrl && (
                      <a
                        href={proj.projectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-extrabold text-[#1D4ED8] dark:text-sky-400 hover:underline"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>فتح رابط المشروع</span>
                      </a>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <PracticalProjectModal
          open={modalOpen}
          editingProject={editingTarget}
          paths={paths}
          uploadProgress={uploadProgress}
          onClose={() => {
            setModalOpen(false);
            setEditingTarget(null);
          }}
          onSave={async (payload, editingId) => {
            const { project, newlyCompleted } = await onSaveProject(payload, editingId);
            if (newlyCompleted) {
              await onProjectCompletedReward(project);
            }
          }}
        />
      )}
    </div>
  );
}
