import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_VERSION,
  REVIEW_QUESTION_LIMIT,
  createEmptyReview,
  normalizeReview,
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
