import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, buildQuiz, gradeAnswers } from '../js/quiz-engine.js';

function makeDomainData(domain, countPerLevel = 4) {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const questions = [];
  for (const level of levels) {
    for (let i = 0; i < countPerLevel; i++) {
      questions.push({
        id: `${domain}-${level}-${i}`,
        level,
        question: `${domain} ${level} question ${i}`,
        choices: ['a', 'b', 'c', 'd'],
        correctIndex: 0,
        explanation: 'because'
      });
    }
  }
  return { domain, domainLabel: domain, questions };
}

test('selectQuestions returns exactly the requested count per level, totaling 10', () => {
  const data = makeDomainData('basic-operations');
  const result = selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, () => 0);

  assert.equal(result.length, 10);
  const byLevel = {};
  for (const q of result) byLevel[q.level] = (byLevel[q.level] || 0) + 1;
  assert.deepEqual(byLevel, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 });
});

test('selectQuestions picks unique question ids (no duplicates)', () => {
  const data = makeDomainData('basic-operations');
  const result = selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, Math.random);
  const ids = result.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('selectQuestions throws when a level does not have enough questions', () => {
  const data = makeDomainData('basic-operations', 1);
  assert.throws(() => {
    selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, Math.random);
  }, /beginner/);
});

test('buildQuiz builds one entry per domain with domain metadata preserved', () => {
  const domains = ['basic-operations', 'feature-usage', 'prompt-design', 'security-permissions'].map(d => makeDomainData(d));
  const quiz = buildQuiz(domains, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, () => 0);

  assert.equal(quiz.length, 4);
  for (const entry of quiz) {
    assert.equal(entry.questions.length, 10);
    assert.ok(domains.some(d => d.domain === entry.domain));
    assert.equal(entry.domainLabel, entry.domain);
  }
});

test('gradeAnswers counts correct and total per domain', () => {
  const quiz = [
    {
      domain: 'basic-operations',
      domainLabel: 'basic-operations',
      questions: [
        { id: 'q1', correctIndex: 0 },
        { id: 'q2', correctIndex: 1 },
      ]
    },
    {
      domain: 'feature-usage',
      domainLabel: 'feature-usage',
      questions: [
        { id: 'q3', correctIndex: 2 },
      ]
    }
  ];
  const answers = { q1: 0, q2: 0, q3: 2 };

  const result = gradeAnswers(quiz, answers);

  assert.deepEqual(result, {
    'basic-operations': { correct: 1, total: 2 },
    'feature-usage': { correct: 1, total: 1 },
  });
});

test('gradeAnswers treats unanswered questions as incorrect', () => {
  const quiz = [
    {
      domain: 'basic-operations',
      domainLabel: 'basic-operations',
      questions: [
        { id: 'q1', correctIndex: 0 },
      ]
    }
  ];
  const result = gradeAnswers(quiz, {});
  assert.deepEqual(result, { 'basic-operations': { correct: 0, total: 1 } });
});

test('selectQuestions shuffles each question\'s choices and keeps correctIndex pointing at the original correct text', () => {
  const data = makeDomainData('basic-operations');
  // give each question a distinguishable correct answer text so we can verify
  // that correctIndex still points at the right choice after shuffling.
  for (const q of data.questions) {
    q.choices = ['a', 'b', 'c', 'd'];
    q.correctIndex = 2; // 'c' is the correct answer text
  }

  const result = selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, Math.random);

  for (const q of result) {
    assert.equal(q.choices.length, 4);
    assert.equal(q.choices[q.correctIndex], 'c');
    // the choice set itself must be unchanged (same 4 options, just reordered)
    assert.deepEqual([...q.choices].sort(), ['a', 'b', 'c', 'd']);
  }
});

test('selectQuestions does not always put the correct answer at index 0 (choices are actually shuffled)', () => {
  const data = makeDomainData('basic-operations');
  for (const q of data.questions) {
    q.choices = ['a', 'b', 'c', 'd'];
    q.correctIndex = 0;
  }

  // Use a fixed, deterministic rng sequence that is known to move index 0 away from position 0.
  let calls = 0;
  const scriptedRng = () => {
    // Fisher-Yates with these values will move element order around deterministically.
    const values = [0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1];
    return values[calls++ % values.length];
  };

  const result = selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, scriptedRng);
  const correctIndexes = result.map(q => q.correctIndex);
  const allZero = correctIndexes.every(idx => idx === 0);
  assert.ok(!allZero, 'expected shuffle to move at least one correctIndex away from 0');
  // regardless of position, the correct choice text must still be 'a'
  for (const q of result) {
    assert.equal(q.choices[q.correctIndex], 'a');
  }
});
