import { selectQuestions, scoreStage, collectWrongAnswers } from './quiz-engine.js';
import {
  DOMAINS,
  DOMAIN_LABELS,
  QUESTIONS_PER_STAGE,
  normalizeProgress,
  recordAttempt,
  getStageStatus,
  isPassed,
} from './progress.js';
import { loadProgressRaw, saveProgressRaw, saveStageResult } from './storage.js';
import { LEVELS, LEVEL_LABELS } from './level-judge.js';

const stageLabelEl = document.getElementById('stage-label');
const progressLabel = document.getElementById('progress-label');
const questionTextEl = document.getElementById('question-text');
const choiceListEl = document.getElementById('choice-list');
const answerFeedbackEl = document.getElementById('answer-feedback');
const answerExplanationEl = document.getElementById('answer-explanation');
const nextButton = document.getElementById('next-button');

function goToDashboard() {
  window.location.href = 'index.html';
}

function showLoadError() {
  stageLabelEl.textContent = '';
  progressLabel.textContent = '';
  questionTextEl.textContent =
    '問題データの読み込みに失敗しました。簡易HTTPサーバー経由で開いているか確認してください（例: python3 -m http.server 8000）。';
}

function renderQuestion(questions, index, onAnswer) {
  const item = questions[index];
  progressLabel.textContent = `問題 ${index + 1} / ${questions.length}`;
  questionTextEl.textContent = item.question;
  choiceListEl.innerHTML = '';
  answerFeedbackEl.style.display = 'none';
  answerExplanationEl.style.display = 'none';
  nextButton.style.display = 'none';

  item.choices.forEach((choiceText, choiceIndex) => {
    const li = document.createElement('li');
    li.className = 'choice-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choiceText;
    button.addEventListener('click', () => onAnswer(choiceIndex));
    li.appendChild(button);
    choiceListEl.appendChild(li);
  });
}

function showAnswerFeedback(item, selectedIndex, isLastQuestion) {
  const buttons = choiceListEl.querySelectorAll('.choice-button');
  buttons.forEach(button => {
    button.disabled = true;
  });
  buttons[selectedIndex].classList.add('selected');
  buttons[item.correctIndex].classList.add('correct-choice');
  if (selectedIndex !== item.correctIndex) {
    buttons[selectedIndex].classList.add('incorrect-choice');
  }

  const isCorrect = selectedIndex === item.correctIndex;
  answerFeedbackEl.textContent = isCorrect ? '正解！' : '不正解';
  answerFeedbackEl.classList.toggle('correct', isCorrect);
  answerFeedbackEl.classList.toggle('incorrect', !isCorrect);
  answerFeedbackEl.style.display = 'block';

  answerExplanationEl.textContent = item.explanation;
  answerExplanationEl.style.display = 'block';

  nextButton.textContent = isLastQuestion ? '結果を見る' : '次へ';
  nextButton.style.display = 'inline-block';
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');
  const level = params.get('level');

  // 不正なURLや古いブックマークからの流入はダッシュボードへ戻す。
  if (!DOMAINS.includes(domain) || !LEVELS.includes(level)) {
    goToDashboard();
    return;
  }

  const progress = normalizeProgress(loadProgressRaw());

  // URL直打ちでロック中のステージに入られた場合も戻す。
  // 厳密な防御ではないが、ゲート構造の一貫性を保つ。
  if (getStageStatus(progress, domain, level) === 'locked') {
    goToDashboard();
    return;
  }

  const domainLabel = DOMAIN_LABELS[domain];
  stageLabelEl.textContent = `${domainLabel} / ${LEVEL_LABELS[level]}`;

  let questions;
  try {
    const response = await fetch(`data/questions/${domain}.json`);
    if (!response.ok) throw new Error(`Failed to load ${response.url}`);
    const domainData = await response.json();
    questions = selectQuestions(domainData, level, QUESTIONS_PER_STAGE, Math.random);
  } catch (err) {
    showLoadError();
    return;
  }

  const answers = {};
  let currentIndex = 0;
  let hasAnswered = false;

  function handleAnswer(choiceIndex) {
    if (hasAnswered) return;
    hasAnswered = true;
    answers[questions[currentIndex].id] = choiceIndex;
    const isLastQuestion = currentIndex === questions.length - 1;
    showAnswerFeedback(questions[currentIndex], choiceIndex, isLastQuestion);
  }

  function finishStage() {
    const score = scoreStage(questions, answers);
    const passed = isPassed(score);
    const wasCleared = getStageStatus(progress, domain, level) === 'cleared';

    const updatedProgress = recordAttempt(progress, domain, level, score);
    saveProgressRaw(updatedProgress);

    // 今回の合格で新たに開いたレベルだけを案内する。
    // すでに合格済みのステージを再挑戦した場合は、新たな開放はない。
    let unlockedLevel = null;
    if (passed && !wasCleared) {
      const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
      if (nextLevel) unlockedLevel = nextLevel;
    }

    saveStageResult({
      domain,
      domainLabel,
      level,
      score,
      total: questions.length,
      passed,
      unlockedLevel,
      wrongAnswers: collectWrongAnswers(questions, answers, domainLabel),
      completedAt: new Date().toISOString(),
    });

    window.location.href = 'result.html';
  }

  function goToNext() {
    if (currentIndex < questions.length - 1) {
      currentIndex += 1;
      hasAnswered = false;
      renderQuestion(questions, currentIndex, handleAnswer);
    } else {
      finishStage();
    }
  }

  nextButton.addEventListener('click', goToNext);
  renderQuestion(questions, currentIndex, handleAnswer);
}

main();
