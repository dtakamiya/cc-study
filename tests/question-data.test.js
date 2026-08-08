import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const QUESTIONS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'questions');
const REQUIRED_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const MIN_QUESTIONS_PER_LEVEL = 10;
const MAX_CHOICE_LENGTH_RATIO = 1.6;
const MIN_CHOICE_LENGTH_RATIO = 0.625;

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

test('choice length balance report (warning only, never fails)', () => {
  const domains = loadAllDomainData();
  const biased = [];
  let totalQuestions = 0;

  for (const domainData of domains) {
    for (const question of domainData.questions) {
      totalQuestions += 1;
      const correctLength = question.choices[question.correctIndex].length;
      const distractors = question.choices.filter((_, i) => i !== question.correctIndex);
      if (distractors.length === 0) continue;
      const distractorAverage = distractors.reduce((sum, c) => sum + c.length, 0) / distractors.length;
      if (distractorAverage === 0) continue;
      const ratio = correctLength / distractorAverage;
      if (ratio > MAX_CHOICE_LENGTH_RATIO || ratio < MIN_CHOICE_LENGTH_RATIO) {
        biased.push({
          domain: domainData.domain,
          id: question.id,
          level: question.level,
          ratio,
          correctLength,
          distractorAverage
        });
      }
    }
  }

  if (biased.length === 0) return;

  const byDomain = {};
  for (const entry of biased) {
    (byDomain[entry.domain] = byDomain[entry.domain] || []).push(entry);
  }

  const lines = ['選択肢の文字数偏り（警告のみ / テストは失敗しません）'];
  for (const domain of Object.keys(byDomain).sort()) {
    const entries = byDomain[domain].sort((a, b) => b.ratio - a.ratio);
    lines.push(`[${domain}] ${entries.length}件`);
    for (const e of entries) {
      lines.push(
        `  ${e.domain}/${e.id} (${e.level}): 比率 ${e.ratio.toFixed(2)} — 正解${e.correctLength}文字 / 誤答平均${e.distractorAverage.toFixed(1)}文字`
      );
    }
  }
  lines.push(`合計 ${biased.length}件 / 全${totalQuestions}問 (${(biased.length / totalQuestions * 100).toFixed(1)}%)`);
  console.warn(lines.join('\n'));
});
