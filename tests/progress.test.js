import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAINS,
  DOMAIN_LABELS,
  QUESTIONS_PER_STAGE,
  PASSING_SCORE,
  createEmptyProgress,
  isPassed,
  normalizeProgress,
  recordAttempt,
  getStageStatus,
  getStageRecord,
  buildDashboard,
} from '../js/progress.js';

test('定数が設計どおりの値である', () => {
  assert.equal(QUESTIONS_PER_STAGE, 10);
  assert.equal(PASSING_SCORE, 8);
  assert.equal(DOMAINS.length, 5);
  assert.deepEqual(DOMAINS, [
    'basic-operations',
    'feature-usage',
    'prompt-design',
    'security-permissions',
    'token-efficiency',
  ]);
  for (const domain of DOMAINS) {
    assert.ok(DOMAIN_LABELS[domain], `${domain} のラベルが未定義`);
  }
});

test('合格ラインの境界: 7問は不合格、8問は合格', () => {
  assert.equal(isPassed(7), false);
  assert.equal(isPassed(8), true);
  assert.equal(isPassed(10), true);
  assert.equal(isPassed(0), false);
});

test('空の進捗では初級のみ挑戦可能で、他はロックされている', () => {
  const progress = createEmptyProgress();
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'available');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'locked');
  assert.equal(getStageStatus(progress, 'basic-operations', 'advanced'), 'locked');
  assert.equal(getStageStatus(progress, 'basic-operations', 'expert'), 'locked');
});

test('初級に合格すると中級が開放され、上級はロックされたまま', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 8);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
  assert.equal(getStageStatus(progress, 'basic-operations', 'advanced'), 'locked');
});

test('初級に不合格だと中級はロックされたまま', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 7);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'available');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'locked');
});

test('飛び級はできない: 中級に合格しても初級が未合格なら上級は開かない', () => {
  // 通常UIからは起こらないが、データ破損や手動改変への防御として検証する
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'intermediate', 10);
  assert.equal(getStageStatus(progress, 'basic-operations', 'advanced'), 'locked');
});

test('領域どうしは独立して進行する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 9);
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
  assert.equal(getStageStatus(progress, 'feature-usage', 'intermediate'), 'locked');
});

test('合格済みステージは再挑戦で不合格になっても cleared を維持する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 9);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 3);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
});

test('bestScore は最高得点を保ち、attempts は挑戦のたびに増える', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 5);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 9);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 6);
  const record = getStageRecord(progress, 'basic-operations', 'beginner');
  assert.equal(record.bestScore, 9);
  assert.equal(record.attempts, 3);
  assert.equal(record.cleared, true);
  assert.ok(typeof record.lastAttemptAt === 'string' && record.lastAttemptAt.length > 0);
});

test('recordAttempt は純関数で、元のオブジェクトを変更しない', () => {
  const original = createEmptyProgress();
  const updated = recordAttempt(original, 'basic-operations', 'beginner', 10);
  assert.equal(getStageRecord(original, 'basic-operations', 'beginner'), null);
  assert.notEqual(original, updated);
  assert.equal(getStageRecord(updated, 'basic-operations', 'beginner').cleared, true);
});

test('未挑戦ステージの記録は null', () => {
  const progress = createEmptyProgress();
  assert.equal(getStageRecord(progress, 'feature-usage', 'expert'), null);
});

test('normalizeProgress は破損データを空の進捗に置き換える', () => {
  assert.deepEqual(normalizeProgress(null), createEmptyProgress());
  assert.deepEqual(normalizeProgress('壊れた文字列'), createEmptyProgress());
  assert.deepEqual(normalizeProgress({}), createEmptyProgress());
  assert.deepEqual(normalizeProgress({ version: 999, domains: {} }), createEmptyProgress());
  assert.deepEqual(normalizeProgress({ version: 1, domains: null }), createEmptyProgress());
});

test('normalizeProgress は正しい進捗をそのまま保持する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'prompt-design', 'beginner', 8);
  const roundTripped = normalizeProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(getStageStatus(roundTripped, 'prompt-design', 'beginner'), 'cleared');
});

test('normalizeProgress は未知の領域・レベルのキーを取り除く', () => {
  const normalized = normalizeProgress({
    version: 1,
    domains: {
      'basic-operations': {
        beginner: { cleared: true, bestScore: 8, attempts: 1, lastAttemptAt: '2026-08-02T00:00:00.000Z' },
        'unknown-level': { cleared: true, bestScore: 10, attempts: 1, lastAttemptAt: '2026-08-02T00:00:00.000Z' },
      },
      'unknown-domain': { beginner: { cleared: true, bestScore: 10, attempts: 1, lastAttemptAt: '2026-08-02T00:00:00.000Z' } },
    },
  });
  assert.equal(getStageStatus(normalized, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(normalized.domains['unknown-domain'], undefined);
  assert.equal(normalized.domains['basic-operations']['unknown-level'], undefined);
});

test('buildDashboard は5領域それぞれに4ステージを返す', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'feature-usage', 'beginner', 10);
  const dashboard = buildDashboard(progress);

  assert.equal(dashboard.length, 5);
  assert.equal(dashboard[0].domain, 'basic-operations');
  assert.equal(dashboard[0].domainLabel, DOMAIN_LABELS['basic-operations']);

  for (const row of dashboard) {
    assert.equal(row.stages.length, 4);
    assert.deepEqual(row.stages.map(s => s.level), ['beginner', 'intermediate', 'advanced', 'expert']);
  }

  const featureRow = dashboard.find(row => row.domain === 'feature-usage');
  assert.equal(featureRow.stages[0].status, 'cleared');
  assert.equal(featureRow.stages[0].record.bestScore, 10);
  assert.equal(featureRow.stages[1].status, 'available');
  assert.equal(featureRow.stages[2].status, 'locked');
  assert.equal(featureRow.stages[2].record, null);
});
