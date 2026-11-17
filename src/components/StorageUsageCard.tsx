import { HardDrive, Layers, ShieldCheck } from 'lucide-react';
import {
  formatBytes,
  MAX_BUNDLE_FILES,
  MAX_CLOUD_FILE_BYTES,
  type StorageSummary,
} from '../utils/workspaceLogic';

interface StorageUsageCardProps {
  summary: StorageSummary;
  compact?: boolean;
}

export function StorageUsageCard({ summary, compact = false }: StorageUsageCardProps) {
  const barWidth = Math.max(summary.totalUsedBytes > 0 ? 1.5 : 0, Math.min(100, summary.percentUsed));
  const vaultSharePercent =
    summary.totalUsedBytes > 0 ? Math.round((summary.vaultBytes / summary.totalUsedBytes) * 100) : 0;
  const assetsSharePercent =
    summary.totalUsedBytes > 0 ? Math.max(0, 100 - vaultSharePercent) : 0;

  return (
    <section
      data-testid="storage-usage-card"
      aria-label="حالة المساحة التخزينية السحابية"
      className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm sm:text-base font-extrabold text-[#062D4C] dark:text-white">
          <HardDrive className="w-4 h-4 text-[#B92622] dark:text-amber-300 shrink-0" aria-hidden="true" />
          <span>سعة التخزين السحابي للملفات والمشاريع</span>
        </div>

        <div className="text-xs sm:text-sm font-extrabold text-[#062D4C] dark:text-emerald-300 tabular-nums">
          المستخدم: {formatBytes(summary.totalUsedBytes)} من {formatBytes(summary.quotaBytes)} ·{' '}
          <span className="text-emerald-700 dark:text-emerald-400">
            المتاح: {formatBytes(summary.availableBytes)}
          </span>
        </div>
      </div>

      {/* Segmented Capacity Bar */}
      <div className="h-3.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 border-2 border-[#062D4C] dark:border-slate-600 overflow-hidden flex p-0.5">
        {summary.vaultBytes > 0 && (
          <div
            style={{ width: `${Math.max(1, (barWidth * vaultSharePercent) / 100)}%` }}
            className="h-full rounded-full bg-emerald-600 transition-all duration-300"
            title={`خزنة المشاريع: ${formatBytes(summary.vaultBytes)}`}
          />
        )}
        {summary.assetsBytes > 0 && (
          <div
            style={{ width: `${Math.max(1, (barWidth * assetsSharePercent) / 100)}%` }}
            className="h-full rounded-full bg-[#B92622] transition-all duration-300"
            title={`مكتبة الأصول: ${formatBytes(summary.assetsBytes)}`}
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
        <div className="flex flex-wrap items-center gap-3 tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
            <span>خزنة المشاريع: {formatBytes(summary.vaultBytes)} ({summary.vaultFilesCount} ملف)</span>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#B92622] dark:text-rose-400 shrink-0" aria-hidden="true" />
            <span>مكتبة الأصول: {formatBytes(summary.assetsBytes)} ({summary.assetsFilesCount} ملف)</span>
          </span>
        </div>

        {!compact && (
          <span className="text-slate-600 dark:text-slate-400 tabular-nums">
            الحد المسموح: حتى {formatBytes(MAX_CLOUD_FILE_BYTES)} للملف الواحد · {MAX_BUNDLE_FILES} ملف في الدفعة · جميع الصيغ مدعومة
          </span>
        )}
      </div>
    </section>
  );
}
