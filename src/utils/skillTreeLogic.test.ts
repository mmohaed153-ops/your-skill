import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createStarterSkillNodes, evaluateSkillTree } from './skillTreeLogic';
import type { VideoStep } from '../types/learning';

describe('skillTreeLogic', () => {
  it('locks dependent skills until all prerequisite skills reach 100% completion, then unlocks them automatically', () => {
    const baseNodes = createStarterSkillNodes('u1');
    const nodes = baseNodes.map((n) =>
      n.id === 'skill_l1_logic' ? { ...n, linkedPathIds: ['p1'] } : n
    );

    const incompleteSteps: Record<string, VideoStep[]> = {
      p1: [
        {
          id: 's1',
          pathId: 'p1',
          ownerId: 'u1',
          title: 'درس 1',
          description: '',
          videoUrl: 'https://youtube.com/watch?v=a',
          thumbnailUrl: '',
          order: 0,
          completed: true,
          completedAt: '2026-04-10T10:00:00Z',
          targetDate: '',
          quickNotes: '',
          quickNotesUpdatedAt: '',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 's2',
          pathId: 'p1',
          ownerId: 'u1',
          title: 'درس 2',
          description: '',
          videoUrl: 'https://youtube.com/watch?v=b',
          thumbnailUrl: '',
          order: 1,
          completed: false,
          completedAt: '',
          targetDate: '',
          quickNotes: '',
          quickNotesUpdatedAt: '',
          createdAt: '',
          updatedAt: '',
        },
      ],
    };

    const eval1 = evaluateSkillTree({
      nodes,
      stepsByPath: incompleteSteps,
      courses: [],
      projects: [],
    });

    const l1 = eval1.find((e) => e.node.id === 'skill_l1_logic')!;
    const l2Oop = eval1.find((e) => e.node.id === 'skill_l2_oop')!;

    assert.equal(l1.progressPercent, 50);
    assert.equal(l1.status, 'in_progress');
    assert.equal(l2Oop.status, 'locked');

    // Now complete s2 -> p1 is 100% -> skill_l1_logic completes -> skill_l2_oop unlocks!
    const completeSteps: Record<string, VideoStep[]> = {
      p1: incompleteSteps.p1.map((s) => ({ ...s, completed: true })),
    };

    const eval2 = evaluateSkillTree({
      nodes,
      stepsByPath: completeSteps,
      courses: [],
      projects: [],
    });

    const l1After = eval2.find((e) => e.node.id === 'skill_l1_logic')!;
    const l2OopAfter = eval2.find((e) => e.node.id === 'skill_l2_oop')!;

    assert.equal(l1After.progressPercent, 100);
    assert.equal(l1After.status, 'completed');
    assert.equal(l2OopAfter.status, 'available');
  });
});
