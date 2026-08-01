import { buildQuiz, gradeAnswers } from './quiz-engine.js';
import { judgeAllLevels, LEVELS } from './level-judge.js';
import { saveResult } from './storage.js';

const DOMAIN_FILES = [
  'data/questions/basic-operations.json',
  'data/questions/feature-usage.json',
  'data/questions/prompt-design.json',
  'data/questions/security-permissions.json',
];

const COUNT_PER_LEVEL = { beginner: 3, intermediate: 3, advanced: 2, expert: 2 };

const progressLabel = document.getElementById('progress-label');
const domainLabelEl = document.getElementById('domain-label');
const questionTextEl = document.getElementById('question-text');
const choiceListEl = document.getElementById('choice-list');

async function loadAllDomainData() {
  const responses = await Promise.all(DOMAIN_FILES.map(path => fetch(path)));
  return Promise.all(responses.map(res => {
    if (!res.ok) throw new Error(`Failed to load ${res.url}`);
    return res.json();
  }));
}

function flattenQuiz(quiz) {
  const flat = [];
  for (const entry of quiz) {
    for (const question of entry.questions) {
      flat.push({ domain: entry.domain, domainLabel: entry.domainLabel, ...question });
    }
  }
  return flat;
}

function renderQuestion(flatQuestions, index, answers, onAnswer) {
  const item = flatQuestions[index];
  progressLabel.textContent = `質問 ${index + 1} / ${flatQuestions.length}`;
  domainLabelEl.textContent = item.domainLabel;
  questionTextEl.textContent = item.question;
  choiceListEl.innerHTML = '';

  item.choices.forEach((choiceText, choiceIndex) => {
    const li = document.createElement('li');
    li.className = 'choice-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choiceText;
    if (answers[item.id] === choiceIndex) {
      button.classList.add('selected');
    }
    button.addEventListener('click', () => onAnswer(item.id, choiceIndex));
    li.appendChild(button);
    choiceListEl.appendChild(li);
  });
}

async function main() {
  let quiz;
  try {
    const allDomainData = await loadAllDomainData();
    quiz = buildQuiz(allDomainData, COUNT_PER_LEVEL, Math.random);
  } catch (err) {
    questionTextEl.textContent = '問題データの読み込みに失敗しました。ページを再読み込みしてください。';
    return;
  }

  const flatQuestions = flattenQuiz(quiz);
  const answers = {};
  let currentIndex = 0;

  function goToNext() {
    if (currentIndex < flatQuestions.length - 1) {
      currentIndex += 1;
      renderQuestion(flatQuestions, currentIndex, answers, handleAnswer);
    } else {
      finishQuiz();
    }
  }

  function handleAnswer(questionId, choiceIndex) {
    answers[questionId] = choiceIndex;
    setTimeout(goToNext, 200);
  }

  function finishQuiz() {
    const gradeResult = gradeAnswers(quiz, answers);
    const judged = judgeAllLevels(gradeResult);

    const domains = {};
    for (const entry of quiz) {
      const domainJudged = judged.domains[entry.domain];
      domains[entry.domain] = {
        domainLabel: entry.domainLabel,
        level: domainJudged.level,
        correct: domainJudged.correct,
        total: domainJudged.total,
        accuracy: domainJudged.accuracy,
      };
    }

    saveResult({
      domains,
      overall: judged.overall,
      completedAt: new Date().toISOString(),
    });

    window.location.href = 'result.html';
  }

  renderQuestion(flatQuestions, currentIndex, answers, handleAnswer);
}

main();
