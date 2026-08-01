import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeDomainLevel, judgeAllLevels, LEVELS, LEVEL_LABELS } from '../js/level-judge.js';

test('judgeDomainLevel returns expert for 90% or higher', () => {
  assert.equal(judgeDomainLevel(9, 10), 'expert');
  assert.equal(judgeDomainLevel(10, 10), 'expert');
});

test('judgeDomainLevel returns advanced for 70% up to but excluding 90%', () => {
  assert.equal(judgeDomainLevel(7, 10), 'advanced');
  assert.equal(judgeDomainLevel(8, 10), 'advanced');
});

test('judgeDomainLevel returns intermediate for 50% up to but excluding 70%', () => {
  assert.equal(judgeDomainLevel(5, 10), 'intermediate');
  assert.equal(judgeDomainLevel(6, 10), 'intermediate');
});

test('judgeDomainLevel returns beginner below 50%', () => {
  assert.equal(judgeDomainLevel(4, 10), 'beginner');
  assert.equal(judgeDomainLevel(0, 10), 'beginner');
});

test('LEVELS is ordered from lowest to highest', () => {
  assert.deepEqual(LEVELS, ['beginner', 'intermediate', 'advanced', 'expert']);
});

test('LEVEL_LABELS provides Japanese labels for all levels', () => {
  for (const level of LEVELS) {
    assert.ok(LEVEL_LABELS[level], `missing label for ${level}`);
  }
});

test('judgeAllLevels computes per-domain level and accuracy', () => {
  const gradeResult = {
    'basic-operations': { correct: 9, total: 10 },
    'feature-usage': { correct: 5, total: 10 },
  };
  const result = judgeAllLevels(gradeResult);

  assert.equal(result.domains['basic-operations'].level, 'expert');
  assert.equal(result.domains['basic-operations'].accuracy, 0.9);
  assert.equal(result.domains['feature-usage'].level, 'intermediate');
  assert.equal(result.domains['feature-usage'].accuracy, 0.5);
});

test('judgeAllLevels sets overall to the lowest domain level (bucket principle)', () => {
  const gradeResult = {
    'basic-operations': { correct: 10, total: 10 }, // expert
    'feature-usage': { correct: 5, total: 10 },      // intermediate
    'prompt-design': { correct: 8, total: 10 },       // advanced
    'security-permissions': { correct: 2, total: 10 }, // beginner
  };
  const result = judgeAllLevels(gradeResult);
  assert.equal(result.overall, 'beginner');
});

test('judgeAllLevels overall equals the common level when all domains match', () => {
  const gradeResult = {
    'basic-operations': { correct: 8, total: 10 },
    'feature-usage': { correct: 7, total: 10 },
  };
  const result = judgeAllLevels(gradeResult);
  assert.equal(result.overall, 'advanced');
});
