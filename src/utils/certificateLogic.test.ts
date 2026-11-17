import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCertificateForCompletedPath,
  isPathEligibleForCertificate,
} from './certificateLogic';
import type { LearningPath, VideoStep } from '../types/learning';

const SAMPLE_PATH: LearningPath = {
  id: 'path_godot',
  ownerId: 'u1',
  title: 'تطوير الألعاب بـ Godot',
  description: '',
  coverImage: '',
  createdAt: '',
  updatedAt: '',
};

const makeStep = (id: string, completed: boolean): VideoStep => ({
  id,
  pathId: 'path_godot',
  ownerId: 'u1',
  title: `درس ${id}`,
  description: '',
  videoUrl: 'https://youtube.com/watch?v=123',
  thumbnailUrl: '',
  order: 0,
  completed,
  completedAt: completed ? '2026-04-10T10:00:00Z' : '',
  targetDate: '',
  quickNotes: '',
  quickNotesUpdatedAt: '',
  createdAt: '',
  updatedAt: '',
});

describe('certificateLogic', () => {
  it('refuses to issue a certificate if path is empty or less than 100% completed', () => {
    assert.equal(isPathEligibleForCertificate([]), false);
    assert.equal(isPathEligibleForCertificate([makeStep('1', true), makeStep('2', false)]), false);

    const notYet = buildCertificateForCompletedPath({
      path: SAMPLE_PATH,
      steps: [makeStep('1', true), makeStep('2', false)],
      ownerId: 'u1',
      recipientName: 'أحمد',
      existingCertificates: [],
    });
    assert.equal(notYet, null);
  });

  it('issues a deterministic verifiable certificate ONLY when path reaches 100% completion and prevents duplicates', () => {
    const cert = buildCertificateForCompletedPath({
      path: SAMPLE_PATH,
      steps: [makeStep('1', true), makeStep('2', true)],
      ownerId: 'u1',
      recipientName: 'أحمد',
      existingCertificates: [],
      nowIso: '2026-04-10T15:00:00Z',
    });

    assert.ok(cert);
    assert.equal(cert.pathId, 'path_godot');
    assert.equal(cert.recipientName, 'أحمد');
    assert.match(cert.verificationCode, /^MSR-\d{4}-[0-9A-F]{4}-[0-9A-F]{4}$/);

    const duplicate = buildCertificateForCompletedPath({
      path: SAMPLE_PATH,
      steps: [makeStep('1', true), makeStep('2', true)],
      ownerId: 'u1',
      recipientName: 'أحمد',
      existingCertificates: [cert],
    });
    assert.equal(duplicate, null);
  });
});
