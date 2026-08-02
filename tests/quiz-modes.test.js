import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuizMode, buildStageLabel, fetchDomainQuestions, loadQuestionsForTarget } from '../js/quiz-modes.js';
import { shuffleChoices } from '../js/quiz-engine.js';
import { REVIEW_VERSION } from '../js/review.js';

// 選択肢シャッフルは通常ステージと復習で同じ規則である必要があるため、
// quiz-engine の実装を共有する。ここが独自実装に戻ると規則が二重管理になる。
test('quiz-engine の shuffleChoices が共有されている', () => {
  assert.equal(typeof shuffleChoices, 'function');
  const shuffled = shuffleChoices(
    { id: 'x', choices: ['A', 'B', 'C', 'D'], correctIndex: 2 },
    () => 0
  );
  assert.equal(shuffled.choices.length, 4);
  assert.equal(shuffled.choices[shuffled.correctIndex], 'C');
});

test('parseQuizMode は mode 未指定を通常モードとして扱う', () => {
  assert.deepEqual(parseQuizMode('?domain=basic-operations&level=beginner'), {
    mode: 'normal',
    domain: 'basic-operations',
    level: 'beginner',
  });
});

test('parseQuizMode は mode=normal を明示されても通常モードにする', () => {
  assert.deepEqual(parseQuizMode('?mode=normal&domain=feature-usage&level=expert'), {
    mode: 'normal',
    domain: 'feature-usage',
    level: 'expert',
  });
});

test('parseQuizMode は通常モードで domain / level が不正なら null', () => {
  assert.equal(parseQuizMode('?domain=not-a-domain&level=beginner'), null);
  assert.equal(parseQuizMode('?domain=basic-operations&level=godlike'), null);
  assert.equal(parseQuizMode(''), null);
});

test('parseQuizMode は mode=review のみを全領域復習として扱う', () => {
  assert.deepEqual(parseQuizMode('?mode=review'), {
    mode: 'review',
    domain: null,
    level: null,
  });
});

test('parseQuizMode は mode=review + domain + level をステージ復習として扱う', () => {
  assert.deepEqual(parseQuizMode('?mode=review&domain=security-permissions&level=advanced'), {
    mode: 'review',
    domain: 'security-permissions',
    level: 'advanced',
  });
});

test('parseQuizMode は復習モードで domain / level が片方だけなら null', () => {
  assert.equal(parseQuizMode('?mode=review&domain=security-permissions'), null);
  assert.equal(parseQuizMode('?mode=review&level=advanced'), null);
});

test('parseQuizMode は復習モードで未知の domain / level なら null', () => {
  assert.equal(parseQuizMode('?mode=review&domain=not-a-domain&level=advanced'), null);
  assert.equal(parseQuizMode('?mode=review&domain=security-permissions&level=godlike'), null);
});

test('parseQuizMode は未知の mode を null にする', () => {
  assert.equal(parseQuizMode('?mode=practice&domain=basic-operations&level=beginner'), null);
});

test('buildStageLabel は通常モードで領域 / レベルを返す', () => {
  assert.equal(
    buildStageLabel({ mode: 'normal', domain: 'basic-operations', level: 'beginner' }),
    '基本操作・CLI使用法 / 初級'
  );
});

test('buildStageLabel は復習（ステージ指定）で復習ラベルを返す', () => {
  assert.equal(
    buildStageLabel({ mode: 'review', domain: 'security-permissions', level: 'advanced' }),
    '復習 / 安全性・権限管理 上級'
  );
});

test('buildStageLabel は復習（全領域）で「すべての領域」を返す', () => {
  assert.equal(buildStageLabel({ mode: 'review', domain: null, level: null }), '復習 / すべての領域');
});

// fetch のスタブ。domain名 -> 問題配列 or 'fail'
function makeFetch(map) {
  return async url => {
    const domain = url.replace('data/questions/', '').replace('.json', '');
    const entry = map[domain];
    if (entry === 'fail' || entry === undefined) {
      return { ok: false, url, async json() { throw new Error('not json'); } };
    }
    return { ok: true, url, async json() { return { domain, questions: entry }; } };
  };
}

function q(id, level, overrides = {}) {
  return {
    id,
    level,
    question: `${id} の問題文`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: `${id} の解説`,
    ...overrides,
  };
}

function tenQuestions(prefix, level) {
  return Array.from({ length: 10 }, (_, i) => q(`${prefix}-${String(i).padStart(3, '0')}`, level));
}

test('fetchDomainQuestions は各問題に domain を付与する', async () => {
  const fetchImpl = makeFetch({ 'basic-operations': [q('basic-001', 'beginner')] });
  const questions = await fetchDomainQuestions('basic-operations', fetchImpl);
  assert.equal(questions[0].domain, 'basic-operations');
  assert.equal(questions[0].id, 'basic-001');
});

test('fetchDomainQuestions は ok でなければ例外を投げる', async () => {
  const fetchImpl = makeFetch({ 'basic-operations': 'fail' });
  await assert.rejects(() => fetchDomainQuestions('basic-operations', fetchImpl));
});

test('loadQuestionsForTarget は通常モードで 10 問を返す', async () => {
  const fetchImpl = makeFetch({ 'basic-operations': tenQuestions('basic', 'beginner') });
  const target = { mode: 'normal', domain: 'basic-operations', level: 'beginner' };
  const questions = await loadQuestionsForTarget(target, { version: REVIEW_VERSION, items: {} }, fetchImpl, () => 0);
  assert.equal(questions.length, 10);
  assert.ok(questions.every(item => item.domain === 'basic-operations'));
});

test('loadQuestionsForTarget は復習モードで誤答した問題だけを返す', async () => {
  const fetchImpl = makeFetch({ 'security-permissions': tenQuestions('security', 'advanced') });
  const review = {
    version: REVIEW_VERSION,
    items: {
      'security-000': { domain: 'security-permissions', level: 'advanced', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
      'security-001': { domain: 'security-permissions', level: 'advanced', wrongCount: 1, lastResult: 'correct', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: 'security-permissions', level: 'advanced' };
  const questions = await loadQuestionsForTarget(target, review, fetchImpl, () => 0);
  assert.deepEqual(questions.map(item => item.id), ['security-000']);
});

test('loadQuestionsForTarget は全領域復習で複数領域から集める', async () => {
  const fetchImpl = makeFetch({
    'basic-operations': tenQuestions('basic', 'beginner'),
    'feature-usage': tenQuestions('feature', 'beginner'),
    'prompt-design': tenQuestions('prompt', 'beginner'),
    'security-permissions': tenQuestions('security', 'advanced'),
    'token-efficiency': tenQuestions('token', 'beginner'),
  });
  const review = {
    version: REVIEW_VERSION,
    items: {
      'basic-000': { domain: 'basic-operations', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
      'security-000': { domain: 'security-permissions', level: 'advanced', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: null, level: null };
  const questions = await loadQuestionsForTarget(target, review, fetchImpl, () => 0);
  assert.deepEqual(questions.map(item => item.id).sort(), ['basic-000', 'security-000']);
});

test('全領域復習は一部の領域の取得に失敗しても、取れた領域だけで出題する', async () => {
  const fetchImpl = makeFetch({
    'basic-operations': tenQuestions('basic', 'beginner'),
    'feature-usage': 'fail',
    'prompt-design': 'fail',
    'security-permissions': 'fail',
    'token-efficiency': 'fail',
  });
  const review = {
    version: REVIEW_VERSION,
    items: {
      'basic-000': { domain: 'basic-operations', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
      'feature-000': { domain: 'feature-usage', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: null, level: null };
  const questions = await loadQuestionsForTarget(target, review, fetchImpl, () => 0);
  assert.deepEqual(questions.map(item => item.id), ['basic-000']);
});

test('全領域復習で全ての領域の取得に失敗したら例外を投げる', async () => {
  const fetchImpl = makeFetch({});
  const review = {
    version: REVIEW_VERSION,
    items: {
      'basic-000': { domain: 'basic-operations', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: null, level: null };
  await assert.rejects(() => loadQuestionsForTarget(target, review, fetchImpl, () => 0));
});

test('復習モードは対象が 0 問なら空配列を返す（例外にしない）', async () => {
  const fetchImpl = makeFetch({ 'security-permissions': tenQuestions('security', 'advanced') });
  const target = { mode: 'review', domain: 'security-permissions', level: 'advanced' };
  const questions = await loadQuestionsForTarget(target, { version: REVIEW_VERSION, items: {} }, fetchImpl, () => 0);
  assert.deepEqual(questions, []);
});
