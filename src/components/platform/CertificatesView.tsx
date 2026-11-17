import { useState } from 'react';
import { Award, CheckCircle2, Printer, Search, ShieldCheck, X } from 'lucide-react';
import type { CertificateRecord } from '../../types/platform';

interface CertificatesViewProps {
  certificates: CertificateRecord[];
  onVerifyCode: (code: string) => Promise<{
    found: boolean;
    verificationCode: string;
    recipientName: string;
    pathTitle: string;
    lessonsCount: number;
    completedAt: string;
  } | null>;
}

export function CertificatesView({ certificates, onVerifyCode }: CertificatesViewProps) {
  const [selectedCert, setSelectedCert] = useState<CertificateRecord | null>(null);
  const [verifyQuery, setVerifyQuery] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{
    checked: boolean;
    found: boolean;
    recipientName?: string;
    pathTitle?: string;
    completedAt?: string;
    lessonsCount?: number;
  }>({ checked: false, found: false });

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyQuery.trim()) return;
    setVerifyLoading(true);
    try {
      const res = await onVerifyCode(verifyQuery);
      if (res && res.found) {
        setVerifyResult({
          checked: true,
          found: true,
          recipientName: res.recipientName,
          pathTitle: res.pathTitle,
          completedAt: res.completedAt,
          lessonsCount: res.lessonsCount,
        });
      } else {
        setVerifyResult({ checked: true, found: false });
      }
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div data-testid="certificates-panel" className="space-y-6">
      {/* Verification Lookup Bar */}
      <form
        onSubmit={handleVerify}
        className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-700 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-[0_4px_0_#062D4C] dark:shadow-[0_4px_0_#020617] space-y-3"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-[#15803D]" aria-hidden="true" />
          <h3 className="text-sm sm:text-base font-black text-[#062D4C] dark:text-white">
            التحقق من صحة الشهادات برمز التحقق
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            dir="ltr"
            value={verifyQuery}
            onChange={(e) => setVerifyQuery(e.target.value)}
            placeholder="MSR-2026-XXXX-XXXX"
            className="flex-1 min-w-[200px] rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm font-mono font-bold text-[#062D4C] dark:text-white"
          />
          <button
            type="submit"
            disabled={verifyLoading || !verifyQuery.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-4 py-2 text-xs font-extrabold cursor-pointer disabled:opacity-50"
          >
            <Search className="w-4 h-4" aria-hidden="true" />
            <span>{verifyLoading ? 'جاري الفحص...' : 'تحقق من الشهادة'}</span>
          </button>
        </div>

        {verifyResult.checked && (
          <div
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
              verifyResult.found
                ? 'border-[#15803D] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                : 'border-[#B92622] bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200'
            }`}
          >
            {verifyResult.found
              ? `شهادة موثقة وصحيحة — الاسم: ${verifyResult.recipientName} · المسار: ${verifyResult.pathTitle} (${verifyResult.lessonsCount} درساً) · تاريخ الإتمام: ${verifyResult.completedAt}`
              : 'لم يتم العثور على شهادة مسجلة بهذا الرمز.'}
          </div>
        )}
      </form>

      {/* Certificates List */}
      {certificates.length === 0 ? (
        <div
          data-testid="certificates-empty"
          className="rounded-2xl border-2 border-dashed border-[#062D4C]/35 dark:border-slate-700 bg-white/80 dark:bg-slate-900/70 p-8 text-center space-y-2"
        >
          <Award className="w-10 h-10 text-amber-600 mx-auto" aria-hidden="true" />
          <h3 className="text-base font-black text-[#062D4C] dark:text-white">
            لم تصدر أي شهادة بعد
          </h3>
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-400 max-w-md mx-auto">
            تُمنح شهادة الإنجاز تلقائياً عند إتمام جميع دروس أي مسار تعليمي بنسبة 100% بالكامل، مع رمز تحقق فريد وقابلية الطباعة وحفظ PDF.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {certificates.map((cert) => (
            <article
              key={cert.id}
              data-testid={`certificate-card-${cert.pathId}`}
              className="rounded-2xl border-2 border-[#062D4C] dark:border-slate-600 bg-white dark:bg-slate-900 p-5 shadow-[0_4px_0_#B92622] space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-[#B92622] text-white flex items-center justify-center shrink-0">
                    <Award className="w-5 h-5" aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="text-sm sm:text-base font-black text-[#062D4C] dark:text-white">
                      {cert.pathTitle}
                    </h3>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      مُصدرة إلى: {cert.recipientName}
                    </p>
                  </div>
                </div>
                <CheckCircle2 className="w-5 h-5 text-[#15803D] shrink-0" aria-hidden="true" />
              </div>

              <div className="text-xs font-bold text-slate-600 dark:text-slate-300 space-y-1 tabular-nums">
                <p>
                  {cert.lessonsCount} درساً تعليمياً · {cert.totalHoursLabel} · تاريخ الإتمام:{' '}
                  {cert.completedAt}
                </p>
                <p>
                  رمز التحقق:{' '}
                  <bdi dir="ltr" className="font-mono font-black text-[#062D4C] dark:text-amber-300">
                    {cert.verificationCode}
                  </bdi>
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  data-testid={`view-certificate-btn-${cert.pathId}`}
                  onClick={() => setSelectedCert(cert)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#062D4C] hover:bg-[#093C66] text-white px-3 py-2 text-xs font-extrabold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>معاينة وطباعة / PDF</span>
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Printable Certificate Modal */}
      {selectedCert && (
        <div
          className="fixed inset-0 z-50 bg-[#062D4C]/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedCert(null)}
        >
          <div
            data-testid="certificate-print-modal"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl border-2 border-[#062D4C] shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-3 bg-[#062D4C] text-white flex items-center justify-between print:hidden">
              <span className="text-sm font-black">معاينة شهادة الإنجاز الرسمية</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#B92622] hover:bg-[#9E1E1B] text-white px-3 py-1.5 text-xs font-extrabold cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>طباعة أو حفظ PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCert(null)}
                  aria-label="إغلاق الشهادة"
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 cursor-pointer"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Certificate Paper Sheet */}
            <div className="print-certificate-sheet p-8 sm:p-12 bg-white text-[#062D4C] border-[6px] border-double border-[#062D4C] m-4 rounded-xl text-center space-y-6">
              <div className="flex items-center justify-between text-xs font-black text-[#B92622]">
                <span>منصة مسار التعلم</span>
                <bdi dir="ltr" className="font-mono">
                  {selectedCert.verificationCode}
                </bdi>
              </div>

              <div className="space-y-2">
                <Award className="w-12 h-12 text-[#B92622] mx-auto" aria-hidden="true" />
                <p className="text-xs font-extrabold tracking-widest text-slate-500">
                  CERTIFICATE OF ACHIEVEMENT
                </p>
                <h2 className="text-3xl font-black text-[#062D4C]">شهادة إتمام وإنجاز</h2>
              </div>

              <div className="space-y-2 py-4 border-y-2 border-[#062D4C]/15">
                <p className="text-sm font-bold text-slate-600">تشهد منصة مسار التعلم بأن المتعلم</p>
                <p className="text-2xl sm:text-3xl font-black text-[#B92622]">
                  {selectedCert.recipientName}
                </p>
                <p className="text-sm font-bold text-slate-600">قد أتم بنجاح جميع متطلبات المسار التعليمي</p>
                <h3 className="text-xl sm:text-2xl font-black text-[#062D4C]">
                  {selectedCert.pathTitle}
                </h3>
              </div>

              <div className="grid grid-cols-3 gap-4 text-xs font-extrabold text-slate-700 pt-2 tabular-nums">
                <div>
                  <p className="text-slate-400">عدد الدروس</p>
                  <p className="text-sm font-black text-[#062D4C]">{selectedCert.lessonsCount} درساً</p>
                </div>
                <div>
                  <p className="text-slate-400">الساعات المعتمدة</p>
                  <p className="text-sm font-black text-[#062D4C]">{selectedCert.totalHoursLabel}</p>
                </div>
                <div>
                  <p className="text-slate-400">تاريخ الإتمام</p>
                  <p className="text-sm font-black text-[#062D4C]">{selectedCert.completedAt}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
