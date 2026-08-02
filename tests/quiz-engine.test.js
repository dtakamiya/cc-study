import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, scoreStage, collectWrongAnswers } from '../js/quiz-engine.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

function makeDomainData(domain, countPerLevel = 10) {
  const questions = [];
  for (const level of LEVELS) {
    for (let i = 0; i < countPerLevel; i++) {
      questions.push({
        id: `${domain}-${level}-${i}`,
        level,
        question: `${domain} ${level} question ${i}`,
        choices: ['a', 'b', 'c', 'd'],
        correctIndex: 0,
        explanation: `explanation ${i}`,
      });
    }
  }
  return { domain, domainLabel: `${domain}ラベル`, questions };
}

test('selectQuestions は指定レベルの問題だけを指定数だけ返す', () => {
  const domainData = makeDomainData('basic-operations');
  const selected = selectQuestions(domainData, 'intermediate', 10);

  assert.equal(selected.length, 10);
  for (const question of selected) {
    assert.equal(question.level, 'intermediate');
  }
  const ids = selected.map(q => q.id);
  assert.equal(new Set(ids).size, 10, '同じ問題が重複して選ばれている');
});

test('selectQuestions はプールが多い場合でも指定数だけ抽出する', () => {
  const domainData = makeDomainData('basic-operations', 15);
  const selected = selectQuestions(domainData, 'beginner', 10);
  assert.equal(selected.length, 10);
});

test('selectQuestions はプール不足ならエラーを投げる', () => {
  const domainData = makeDomainData('basic-operations', 5);
  assert.throws(
    () => selectQuestions(domainData, 'beginner', 10),
    /not have enough/
  );
});

test('selectQuestions は選択肢をシャッフルしても correctIndex を正しく追従させる', () => {
  const domainData = {
    domain: 'basic-operations',
    domainLabel: 'ラベル',
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `q-${i}`,
      level: 'beginner',
      question: `question ${i}`,
      choices: ['正解', '誤答1', '誤答2', '誤答3'],
      correctIndex: 0,
      explanation: 'because',
    })),
  };

  // 逆順に並べ替える決定的なrng（shuffleのFisher-Yatesで必ず入れ替えが起きる）
  const selected = selectQuestions(domainData, 'beginner', 10, () => 0);

  for (const question of selected) {
    assert.equal(
      question.choices[question.correctIndex],
      '正解',
      'シャッフル後もcorrectIndexが正解の選択肢を指していない'
    );
    assert.equal(question.choices.length, 4);
  }
});

test('selectQuestions は元の問題データを変更しない', () => {
  const domainData = makeDomainData('basic-operations');
  const originalFirst = { ...domainData.questions[0], choices: [...domainData.questions[0].choices] };
  selectQuestions(domainData, 'beginner', 10, () => 0);
  assert.deepEqual(domainData.questions[0], originalFirst);
});

test('scoreStage は正解数を返す', () => {
  const questions = [
    { id: 'q1', correctIndex: 0 },
    { id: 'q2', correctIndex: 1 },
    { id: 'q3', correctIndex: 2 },
  ];
  assert.equal(scoreStage(questions, { q1: 0, q2: 1, q3: 2 }), 3);
  assert.equal(scoreStage(questions, { q1: 0, q2: 3, q3: 2 }), 2);
  assert.equal(scoreStage(questions, {}), 0);
});

test('scoreStage は未回答を不正解として扱う', () => {
  const questions = [
    { id: 'q1', correctIndex: 0 },
    { id: 'q2', correctIndex: 0 },
  ];
  assert.equal(scoreStage(questions, { q1: 0 }), 1);
});

test('collectWrongAnswers は間違えた問題だけを詳細付きで返す', () => {
  const questions = [
    {
      id: 'q1',
      question: '問題1',
      choices: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
      explanation: '解説1',
    },
    {
      id: 'q2',
      question: '問題2',
      choices: ['a', 'b', 'c', 'd'],
      correctIndex: 1,
      explanation: '解説2',
    },
  ];
  const wrong = collectWrongAnswers(questions, { q1: 0, q2: 3 }, '基本操作・CLI使用法');

  assert.equal(wrong.length, 1);
  assert.deepEqual(wrong[0], {
    questionId: 'q2',
    domainLabel: '基本操作・CLI使用法',
    question: '問題2',
    choices: ['a', 'b', 'c', 'd'],
    selectedIndex: 3,
    correctIndex: 1,
    explanation: '解説2',
  });
});

test('collectWrongAnswers は未回答を selectedIndex: null として含める', () => {
  const questions = [
    { id: 'q1', question: '問題1', choices: ['a', 'b'], correctIndex: 0, explanation: '解説1' },
  ];
  const wrong = collectWrongAnswers(questions, {}, 'ラベル');
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].selectedIndex, null);
});

test('collectWrongAnswers は全問正解なら空配列を返す', () => {
  const questions = [
    { id: 'q1', question: '問題1', choices: ['a', 'b'], correctIndex: 0, explanation: '解説1' },
  ];
  assert.deepEqual(collectWrongAnswers(questions, { q1: 0 }, 'ラベル'), []);
});
