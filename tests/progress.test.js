import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAINS,
  DOMAIN_LABELS,
  QUESTIONS_PER_STAGE,
  PASSING_SCORES,
  getPassingScore,
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
  assert.deepEqual(PASSING_SCORES, {
    beginner: 10,
    intermediate: 8,
    advanced: 8,
    expert: 8,
  });
  assert.equal(DOMAINS.length, 8);
  assert.deepEqual(DOMAINS, [
    'basic-operations',
    'feature-usage',
    'prompt-design',
    'security-permissions',
    'token-efficiency',
    'slash-commands',
    'harness-design',
    'recent-features',
  ]);
  for (const domain of DOMAINS) {
    assert.ok(DOMAIN_LABELS[domain], `${domain} のラベルが未定義`);
  }
});

test('初級の合格ラインは全問正解: 9問は不合格、10問は合格', () => {
  assert.equal(isPassed(9, 'beginner'), false);
  assert.equal(isPassed(10, 'beginner'), true);
  assert.equal(isPassed(0, 'beginner'), false);
});

test('中級以上の合格ラインは8問: 7問は不合格、8問は合格', () => {
  for (const level of ['intermediate', 'advanced', 'expert']) {
    assert.equal(isPassed(7, level), false, `${level} で7問が合格になっています`);
    assert.equal(isPassed(8, level), true, `${level} で8問が不合格になっています`);
    assert.equal(isPassed(10, level), true);
  }
});

// 既定値でフォールバックすると、levelの渡し忘れで初級8問が合格として
// 永続化される。移行漏れは黙って隠さず露呈させる。
test('未知・欠落のレベルは合否判定で例外になる', () => {
  assert.throws(() => getPassingScore('unknown'));
  assert.throws(() => getPassingScore(undefined));
  assert.throws(() => isPassed(10, undefined));
});

// 基準の変更を遡及適用しない。既存利用者の合格を剥奪すると、
// 上位レベルが突然ロックされ、利用者にはデータ破損と区別がつかない。
test('基準変更前に8問で合格した初級の記録は維持される', () => {
  const progress = createEmptyProgress();
  progress.domains['basic-operations'].beginner = {
    cleared: true,
    bestScore: 8,
    attempts: 1,
    lastAttemptAt: '2026-08-01T00:00:00.000Z',
  };

  const updated = recordAttempt(progress, 'basic-operations', 'beginner', 8);

  assert.equal(getStageRecord(updated, 'basic-operations', 'beginner').cleared, true);
  assert.equal(getStageStatus(updated, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(updated, 'basic-operations', 'intermediate'), 'available');
});

test('未合格の初級は9問では合格にならず、中級も開放されない', () => {
  const progress = recordAttempt(createEmptyProgress(), 'basic-operations', 'beginner', 9);

  assert.equal(getStageRecord(progress, 'basic-operations', 'beginner').cleared, false);
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'locked');
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
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 10);
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
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 10);
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
  assert.equal(getStageStatus(progress, 'feature-usage', 'intermediate'), 'locked');
});

test('合格済みステージは再挑戦で不合格になっても cleared を維持する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 10);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 3);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
});

test('bestScore は最高得点を保ち、attempts は挑戦のたびに増える', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 5);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 10);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 6);
  const record = getStageRecord(progress, 'basic-operations', 'beginner');
  assert.equal(record.bestScore, 10);
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
  progress = recordAttempt(progress, 'prompt-design', 'beginner', 10);
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

test('buildDashboard は8領域それぞれに4ステージを返す', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'feature-usage', 'beginner', 10);
  const dashboard = buildDashboard(progress);

  assert.equal(dashboard.length, 8);
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

test('偽造された cleared 記録は、下位レベルが未合格なら cleared として扱わない', () => {
  // localStorageは手で書き換えられる。beginnerが未合格のまま
  // intermediateにcleared:trueを書き込んでも、合格扱いにしてはならない。
  const forged = normalizeProgress({
    version: 1,
    domains: {
      'basic-operations': {
        beginner: null,
        intermediate: {
          cleared: true,
          bestScore: 10,
          attempts: 1,
          lastAttemptAt: '2026-01-01T00:00:00.000Z',
        },
        advanced: null,
        expert: null,
      },
    },
  });

  assert.equal(getStageStatus(forged, 'basic-operations', 'intermediate'), 'locked');
  assert.equal(getStageStatus(forged, 'basic-operations', 'advanced'), 'locked');
});
