import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_VERSION,
  REVIEW_QUESTION_LIMIT,
  createEmptyReview,
  normalizeReview,
  recordAnswers,
  selectReviewQuestions,
  countUnreviewedByStage,
  countUnreviewedTotal,
} from '../js/review.js';

function entry(overrides = {}) {
  return {
    domain: 'security-permissions',
    level: 'advanced',
    wrongCount: 2,
    lastResult: 'wrong',
    lastAnsweredAt: '2026-08-03T10:00:00.000Z',
    ...overrides,
  };
}

test('createEmptyReview は空の履歴を返す', () => {
  assert.deepEqual(createEmptyReview(), { version: REVIEW_VERSION, items: {} });
});

test('REVIEW_VERSION は 1、REVIEW_QUESTION_LIMIT は 20', () => {
  assert.equal(REVIEW_VERSION, 1);
  assert.equal(REVIEW_QUESTION_LIMIT, 20);
});

test('normalizeReview は正常なエントリをそのまま残す', () => {
  const raw = { version: 1, items: { 'security-046': entry() } };
  assert.deepEqual(normalizeReview(raw), raw);
});

test('normalizeReview は null や非オブジェクトを空の履歴にする', () => {
  assert.deepEqual(normalizeReview(null), createEmptyReview());
  assert.deepEqual(normalizeReview('壊れている'), createEmptyReview());
  assert.deepEqual(normalizeReview(42), createEmptyReview());
});

test('normalizeReview は version 不一致なら全体を初期化する', () => {
  const raw = { version: 99, items: { 'security-046': entry() } };
  assert.deepEqual(normalizeReview(raw), createEmptyReview());
});

test('normalizeReview は items が無ければ空の履歴にする', () => {
  assert.deepEqual(normalizeReview({ version: 1 }), createEmptyReview());
  assert.deepEqual(normalizeReview({ version: 1, items: null }), createEmptyReview());
});

test('normalizeReview は壊れたエントリだけを捨て、正常なエントリは残す', () => {
  const raw = {
    version: 1,
    items: {
      'security-046': entry(),
      'broken-1': null,
      'broken-2': { domain: 'security-permissions' },
      'broken-3': entry({ wrongCount: '2' }),
      'broken-4': entry({ lastResult: 'maybe' }),
      'broken-5': entry({ lastAnsweredAt: 12345 }),
      'basic-001': entry({ domain: 'basic-operations', level: 'beginner', lastResult: 'correct' }),
    },
  };
  const normalized = normalizeReview(raw);
  assert.deepEqual(Object.keys(normalized.items).sort(), ['basic-001', 'security-046']);
});

test('normalizeReview は未知の domain / level のエントリを捨てる', () => {
  const raw = {
    version: 1,
    items: {
      'unknown-domain': entry({ domain: 'not-a-domain' }),
      'unknown-level': entry({ level: 'godlike' }),
      'security-046': entry(),
    },
  };
  assert.deepEqual(Object.keys(normalizeReview(raw).items), ['security-046']);
});

test('normalizeReview は既知のフィールドだけを写し取る', () => {
  const raw = { version: 1, items: { 'security-046': entry({ extra: 'あやしい' }) } };
  assert.deepEqual(normalizeReview(raw).items['security-046'], entry());
});

test('normalizeReview は入力を書き換えない', () => {
  const raw = { version: 1, items: { 'security-046': entry(), 'broken-1': null } };
  const snapshot = JSON.parse(JSON.stringify(raw));
  normalizeReview(raw);
  assert.deepEqual(raw, snapshot);
});

const NOW = new Date('2026-08-03T12:00:00.000Z');

function question(id, overrides = {}) {
  return {
    id,
    domain: 'security-permissions',
    level: 'advanced',
    correctIndex: 1,
    ...overrides,
  };
}

test('recordAnswers は誤答した問題のエントリを作る', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  assert.deepEqual(result.items['security-046'], {
    domain: 'security-permissions',
    level: 'advanced',
    wrongCount: 1,
    lastResult: 'wrong',
    lastAnsweredAt: '2026-08-03T12:00:00.000Z',
  });
});

test('recordAnswers は誤答を繰り返すと wrongCount が増える', () => {
  const first = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  const second = recordAnswers(first, [question('security-046')], { 'security-046': 2 }, NOW);
  assert.equal(second.items['security-046'].wrongCount, 2);
  assert.equal(second.items['security-046'].lastResult, 'wrong');
});

test('recordAnswers は既存エントリの正解で lastResult を correct にする（消さない）', () => {
  const wrong = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  const correct = recordAnswers(wrong, [question('security-046')], { 'security-046': 1 }, NOW);
  assert.equal(correct.items['security-046'].lastResult, 'correct');
  assert.equal(correct.items['security-046'].wrongCount, 1);
});

test('recordAnswers は未登録の問題の正解を記録しない', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 1 }, NOW);
  assert.deepEqual(result.items, {});
});

test('recordAnswers は未解答（answersに無い）を誤答として扱う', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], {}, NOW);
  assert.equal(result.items['security-046'].lastResult, 'wrong');
  assert.equal(result.items['security-046'].wrongCount, 1);
});

test('recordAnswers は複数問をまとめて処理する', () => {
  const questions = [
    question('security-046'),
    question('security-047'),
    question('basic-001', { domain: 'basic-operations', level: 'beginner' }),
  ];
  const answers = { 'security-046': 0, 'security-047': 1, 'basic-001': 3 };
  const result = recordAnswers(createEmptyReview(), questions, answers, NOW);
  assert.deepEqual(Object.keys(result.items).sort(), ['basic-001', 'security-046']);
  assert.equal(result.items['basic-001'].domain, 'basic-operations');
  assert.equal(result.items['basic-001'].level, 'beginner');
});

test('recordAnswers は domain が無い問題に fallbackDomain を使う', () => {
  const questions = [{ id: 'security-046', level: 'advanced', correctIndex: 1 }];
  const result = recordAnswers(
    createEmptyReview(),
    questions,
    { 'security-046': 0 },
    NOW,
    'security-permissions'
  );
  assert.equal(result.items['security-046'].domain, 'security-permissions');
});

test('recordAnswers は domain も fallbackDomain も無い問題を記録しない', () => {
  const questions = [{ id: 'security-046', level: 'advanced', correctIndex: 1 }];
  const result = recordAnswers(createEmptyReview(), questions, { 'security-046': 0 }, NOW);
  assert.deepEqual(result.items, {});
});

test('recordAnswers は入力の review を書き換えない', () => {
  const before = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  const snapshot = JSON.parse(JSON.stringify(before));
  recordAnswers(before, [question('security-046')], { 'security-046': 0 }, NOW);
  assert.deepEqual(before, snapshot);
});

test('recordAnswers の結果は normalizeReview を通しても変わらない', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  assert.deepEqual(normalizeReview(result), result);
});

// rngを固定して抽出結果を決定的にする
function fixedRng() {
  return 0;
}

function pool(...specs) {
  return specs.map(([id, domain, level]) => ({
    id,
    domain,
    level,
    question: `${id} の問題文`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 1,
    explanation: `${id} の解説`,
  }));
}

function reviewWith(items) {
  return { version: REVIEW_VERSION, items };
}

test('selectReviewQuestions は lastResult が wrong の問題だけを返す', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-047': entry({ lastResult: 'correct' }),
  });
  const questions = pool(
    ['security-046', 'security-permissions', 'advanced'],
    ['security-047', 'security-permissions', 'advanced']
  );
  const selected = selectReviewQuestions(review, questions, {}, fixedRng);
  assert.deepEqual(selected.map(q => q.id), ['security-046']);
});

test('selectReviewQuestions は domain と level で絞り込む', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-010': entry({ level: 'beginner' }),
    'basic-001': entry({ domain: 'basic-operations', level: 'advanced' }),
  });
  const questions = pool(
    ['security-046', 'security-permissions', 'advanced'],
    ['security-010', 'security-permissions', 'beginner'],
    ['basic-001', 'basic-operations', 'advanced']
  );

  assert.deepEqual(
    selectReviewQuestions(review, questions, { domain: 'security-permissions', level: 'advanced' }, fixedRng)
      .map(q => q.id),
    ['security-046']
  );
  assert.deepEqual(
    selectReviewQuestions(review, questions, {}, fixedRng).map(q => q.id).sort(),
    ['basic-001', 'security-010', 'security-046']
  );
});

test('selectReviewQuestions は実在しない問題IDを除外する', () => {
  const review = reviewWith({
    'security-046': entry(),
    'deleted-999': entry(),
  });
  const questions = pool(['security-046', 'security-permissions', 'advanced']);
  const selected = selectReviewQuestions(review, questions, {}, fixedRng);
  assert.deepEqual(selected.map(q => q.id), ['security-046']);
});

test('selectReviewQuestions は 20 問を上限にする', () => {
  const items = {};
  const specs = [];
  for (let i = 0; i < 25; i++) {
    const id = `security-${String(i).padStart(3, '0')}`;
    items[id] = entry();
    specs.push([id, 'security-permissions', 'advanced']);
  }
  const selected = selectReviewQuestions(reviewWith(items), pool(...specs), {}, fixedRng);
  assert.equal(selected.length, REVIEW_QUESTION_LIMIT);
  assert.equal(new Set(selected.map(q => q.id)).size, REVIEW_QUESTION_LIMIT);
});

test('selectReviewQuestions は対象が無ければ空配列を返す', () => {
  assert.deepEqual(selectReviewQuestions(createEmptyReview(), pool(['security-046', 'security-permissions', 'advanced']), {}, fixedRng), []);
});

test('selectReviewQuestions は履歴の domain / level ではなく問題データ側で絞る', () => {
  // 問題データ側でレベルが変わった場合、実物のレベルを正とする
  const review = reviewWith({ 'security-046': entry({ level: 'advanced' }) });
  const questions = pool(['security-046', 'security-permissions', 'expert']);
  assert.deepEqual(
    selectReviewQuestions(review, questions, { domain: 'security-permissions', level: 'expert' }, fixedRng)
      .map(q => q.id),
    ['security-046']
  );
});

test('countUnreviewedByStage は全ステージのキーを持ち、該当なしは 0', () => {
  const counts = countUnreviewedByStage(createEmptyReview());
  assert.equal(counts['security-permissions']['advanced'], 0);
  assert.equal(counts['basic-operations']['beginner'], 0);
  assert.equal(Object.keys(counts).length, 6);
  assert.equal(Object.keys(counts['basic-operations']).length, 4);
});

test('countUnreviewedByStage は wrong のエントリだけをステージ別に数える', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-047': entry(),
    'security-048': entry({ lastResult: 'correct' }),
    'basic-001': entry({ domain: 'basic-operations', level: 'beginner' }),
  });
  const counts = countUnreviewedByStage(review);
  assert.equal(counts['security-permissions']['advanced'], 2);
  assert.equal(counts['basic-operations']['beginner'], 1);
  assert.equal(counts['basic-operations']['advanced'], 0);
});

test('countUnreviewedTotal はステージ別集計の合計と一致する', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-047': entry(),
    'security-048': entry({ lastResult: 'correct' }),
    'basic-001': entry({ domain: 'basic-operations', level: 'beginner' }),
  });
  assert.equal(countUnreviewedTotal(review), 3);

  const counts = countUnreviewedByStage(review);
  const sum = Object.values(counts)
    .flatMap(levels => Object.values(levels))
    .reduce((acc, n) => acc + n, 0);
  assert.equal(sum, countUnreviewedTotal(review));
});
