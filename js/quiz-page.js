import { scoreStage, collectWrongAnswers } from './quiz-engine.js';
import {
  DOMAIN_LABELS,
  normalizeProgress,
  recordAttempt,
  getStageStatus,
  isPassed,
} from './progress.js';
import { normalizeReview, recordAnswers } from './review.js';
import {
  loadProgressRaw,
  saveProgressRaw,
  saveStageResult,
  loadReviewRaw,
  saveReviewRaw,
} from './storage.js';
import { LEVELS, LEVEL_LABELS } from './level-judge.js';
import { parseQuizMode, buildStageLabel, loadQuestionsForTarget } from './quiz-modes.js';

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

// 保存に失敗した場合は遷移せず、その場で結果を伝える。
// 結果画面はsessionStorage経由でデータを受け取るため、
// 保存できていない状態で遷移すると解答内容が失われる。
function showSaveFailure(headline, detail) {
  progressLabel.textContent = '';
  choiceListEl.innerHTML = '';
  answerFeedbackEl.style.display = 'none';
  nextButton.style.display = 'none';

  questionTextEl.textContent = headline;

  answerExplanationEl.textContent = detail;
  answerExplanationEl.style.display = 'block';

  const backLink = document.createElement('a');
  backLink.className = 'button';
  backLink.href = 'index.html';
  backLink.textContent = 'ダッシュボードに戻る';
  choiceListEl.appendChild(backLink);
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

// 誤答履歴の保存はゲートの前提ではないため、失敗しても挑戦の完了を止めない。
// 保存できない環境では何も残らないという既存の挙動と一貫している。
function persistReview(questions, answers, fallbackDomain) {
  const review = normalizeReview(loadReviewRaw());
  const updated = recordAnswers(review, questions, answers, new Date(), fallbackDomain);
  saveReviewRaw(updated);
}

async function main() {
  const target = parseQuizMode(window.location.search);

  // 不正なURLや古いブックマークからの流入はダッシュボードへ戻す。
  if (target === null) {
    goToDashboard();
    return;
  }

  const progress = normalizeProgress(loadProgressRaw());

  // URL直打ちでロック中のステージに入られた場合も戻す。
  // 厳密な防御ではないが、ゲート構造の一貫性を保つ。
  // 復習はゲートに影響しないため、この検査の対象外。
  if (
    target.mode === 'normal' &&
    getStageStatus(progress, target.domain, target.level) === 'locked'
  ) {
    goToDashboard();
    return;
  }

  const stageLabel = buildStageLabel(target);
  stageLabelEl.textContent = stageLabel;

  let questions;
  try {
    questions = await loadQuestionsForTarget(
      target,
      normalizeReview(loadReviewRaw()),
      fetch,
      Math.random
    );
  } catch (err) {
    showLoadError();
    return;
  }

  // 別タブで復習を終えた後やURL直打ちでは、対象が0問になりうる。
  if (questions.length === 0) {
    goToDashboard();
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

  function finishNormalStage() {
    const { domain, level } = target;
    const domainLabel = DOMAIN_LABELS[domain];
    const score = scoreStage(questions, answers);
    const passed = isPassed(score);
    const wasCleared = getStageStatus(progress, domain, level) === 'cleared';

    const updatedProgress = recordAttempt(progress, domain, level, score);
    const progressSaved = saveProgressRaw(updatedProgress) !== 'none';

    persistReview(questions, answers, domain);

    // 今回の合格で新たに開いたレベルだけを案内する。
    // すでに合格済みのステージを再挑戦した場合は、新たな開放はない。
    let unlockedLevel = null;
    if (passed && !wasCleared) {
      const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
      if (nextLevel) unlockedLevel = nextLevel;
    }

    const stageResultSaved = saveStageResult({
      isReview: false,
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

    // 保存できていないまま遷移すると、結果画面が「結果がありません」になり
    // 10問分の解答が黙って失われる。この場では結果だけでも見せる。
    if (!stageResultSaved || !progressSaved) {
      showSaveFailure(
        `${score} / ${questions.length} 問正解（${passed ? '合格' : '不合格'}）`,
        progressSaved
          ? 'ブラウザの設定により結果画面へ引き継げませんでした。進捗は保存されています。'
          : 'ブラウザの設定により進捗を保存できませんでした。この結果は記録されていません。'
      );
      return;
    }

    window.location.href = 'result.html';
  }

  // 復習は練習であり実力判定ではない。cc-diagnosis-progress には一切触れない。
  // ここでrecordAttemptを呼ぶと、見たことのある問題で合格でき、ゲートが形骸化する。
  function finishReviewStage() {
    const score = scoreStage(questions, answers);

    persistReview(questions, answers, target.domain);

    const stageResultSaved = saveStageResult({
      isReview: true,
      stageLabel,
      reviewDomain: target.domain,
      reviewLevel: target.level,
      score,
      total: questions.length,
      wrongAnswers: collectWrongAnswers(questions, answers, ''),
      completedAt: new Date().toISOString(),
    });

    if (!stageResultSaved) {
      showSaveFailure(
        `${score} / ${questions.length} 問正解`,
        'ブラウザの設定により結果画面へ引き継げませんでした。誤答履歴は更新されています。'
      );
      return;
    }

    window.location.href = 'result.html';
  }

  function goToNext() {
    if (currentIndex < questions.length - 1) {
      currentIndex += 1;
      hasAnswered = false;
      renderQuestion(questions, currentIndex, handleAnswer);
    } else if (target.mode === 'review') {
      finishReviewStage();
    } else {
      finishNormalStage();
    }
  }

  nextButton.addEventListener('click', goToNext);
  renderQuestion(questions, currentIndex, handleAnswer);
}

main();
