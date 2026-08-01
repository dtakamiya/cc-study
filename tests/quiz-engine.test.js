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
