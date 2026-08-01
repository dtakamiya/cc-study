import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const QUESTIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'questions');
const REQUIRED_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const MIN_QUESTIONS_PER_LEVEL = 4;

function loadAllDomainData() {
  return readdirSync(QUESTIONS_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => JSON.parse(readFileSync(path.join(QUESTIONS_DIR, name), 'utf8')));
}

test('every question has a correctIndex within its choices bounds', () => {
  for (const domainData of loadAllDomainData()) {
    for (const question of domainData.questions) {
      assert.ok(
        question.correctIndex >= 0 && question.correctIndex < question.choices.length,
        `${domainData.domain}/${question.id}: correctIndex ${question.correctIndex} out of bounds for ${question.choices.length} choices`
      );
    }
  }
});

test('every domain has at least the minimum required questions per level', () => {
  for (const domainData of loadAllDomainData()) {
    const countByLevel = {};
    for (const question of domainData.questions) {
      countByLevel[question.level] = (countByLevel[question.level] || 0) + 1;
    }
    for (const level of REQUIRED_LEVELS) {
      assert.ok(
        (countByLevel[level] || 0) >= MIN_QUESTIONS_PER_LEVEL,
        `${domainData.domain}: level "${level}" has ${countByLevel[level] || 0} questions, needs at least ${MIN_QUESTIONS_PER_LEVEL}`
      );
    }
  }
});

test('all question ids are unique across all domain files', () => {
  const allIds = loadAllDomainData().flatMap(domainData => domainData.questions.map(q => q.id));
  assert.equal(new Set(allIds).size, allIds.length, 'duplicate question id found across domain files');
});
