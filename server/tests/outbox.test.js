import test from 'node:test';
import assert from 'node:assert';
import { calculateBackoff, sortOutboxQueue, OUTBOX_STATUS } from '../../client/src/outbox/syncWorker.js';

test('Outbox Sync Engine - Backoff & Prioritization', async (t) => {
  await t.test('calculates accurate exponential backoff without jitter', () => {
    assert.strictEqual(calculateBackoff(0, 1000, 30000, false), 1000); // 1s
    assert.strictEqual(calculateBackoff(1, 1000, 30000, false), 2000); // 2s
    assert.strictEqual(calculateBackoff(2, 1000, 30000, false), 4000); // 4s
    assert.strictEqual(calculateBackoff(3, 1000, 30000, false), 8000); // 8s
    assert.strictEqual(calculateBackoff(4, 1000, 30000, false), 16000); // 16s
  });

  await t.test('caps backoff delay at maxDelayMs ceiling', () => {
    assert.strictEqual(calculateBackoff(5, 1000, 30000, false), 30000); // capped at 30s
    assert.strictEqual(calculateBackoff(10, 1000, 30000, false), 30000);
  });

  await t.test('prioritizes critical triage cases before regular chat messages', () => {
    const queue = [
      { id: '1', type: 'message', createdAt: 100 },
      { id: '2', type: 'upload_chunk', createdAt: 50 },
      { id: '3', type: 'case', createdAt: 200 },
      { id: '4', type: 'advice', createdAt: 150 }
    ];

    const sorted = sortOutboxQueue(queue);
    assert.strictEqual(sorted[0].id, '3'); // case first
    assert.strictEqual(sorted[1].id, '4'); // advice second
    assert.strictEqual(sorted[2].id, '1'); // message third
    assert.strictEqual(sorted[3].id, '2'); // chunk fourth
  });
});
