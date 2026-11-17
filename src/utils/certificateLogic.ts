import type { LearningPath, VideoStep } from '../types/learning';
import type { CertificateRecord } from '../types/platform';

export function isPathEligibleForCertificate(steps: VideoStep[]): boolean {
  if (!Array.isArray(steps) || steps.length === 0) return false;
  return steps.every((s) => Boolean(s.completed));
}

export function createDeterministicVerificationCode(pathId: string, uid: string): string {
  const seed = `${uid || 'local'}:${pathId}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  const year = new Date().getFullYear();
  return `MSR-${year}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

export function buildCertificateForCompletedPath(params: {
  path: LearningPath;
  steps: VideoStep[];
  ownerId: string;
  recipientName: string;
  existingCertificates: CertificateRecord[];
  nowIso?: string;
}): CertificateRecord | null {
  if (!isPathEligibleForCertificate(params.steps)) {
    return null;
  }

  const alreadyIssued = params.existingCertificates.some(
    (c) => c.pathId === params.path.id
  );
  if (alreadyIssued) {
    return null;
  }

  const nowIso = params.nowIso || new Date().toISOString();
  const estHours = Math.max(0.5, Math.round(((params.steps.length * 18) / 60) * 10) / 10);

  return {
    id: `cert_${params.path.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)}`,
    ownerId: params.ownerId,
    pathId: params.path.id,
    pathTitle: params.path.title,
    recipientName: params.recipientName.trim() || 'متعلم منصة مسار',
    verificationCode: createDeterministicVerificationCode(params.path.id, params.ownerId),
    lessonsCount: params.steps.length,
    totalHoursLabel: `${estHours} ساعة تعليمية`,
    completedAt: nowIso.slice(0, 10),
    issuedAt: nowIso,
  };
}
