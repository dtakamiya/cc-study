import { loadStageResult } from './storage.js';
import { LEVEL_LABELS } from './level-judge.js';
import { PASSING_SCORE } from './progress.js';
import { getStudyAdvice } from './report-content.js';

const noResultEl = document.getElementById('no-result');
const resultContentEl = document.getElementById('result-content');

const stageResult = loadStageResult();

// 進捗は挑戦完了時点で確定済みなので、この画面を見逃しても記録は失われない。
if (!stageResult) {
  noResultEl.style.display = 'block';
} else {
  resultContentEl.style.display = 'block';

  const { domain, domainLabel, level, score, total, passed, unlockedLevel, wrongAnswers } = stageResult;

  document.getElementById('stage-label').textContent =
    `${domainLabel} / ${LEVEL_LABELS[level]}`;

  const verdictEl = document.getElementById('verdict');
  verdictEl.textContent = passed ? '合格！' : '不合格';
  verdictEl.className = passed ? 'verdict passed' : 'verdict failed';

  document.getElementById('score-line').textContent =
    `${score} / ${total} 問正解（合格ラインは ${PASSING_SCORE} 問）`;

  if (unlockedLevel) {
    const unlockNoticeEl = document.getElementById('unlock-notice');
    unlockNoticeEl.textContent = `${LEVEL_LABELS[unlockedLevel]}が開放されました！`;
    unlockNoticeEl.style.display = 'block';
  }

  const actionsEl = document.getElementById('result-actions');

  if (unlockedLevel) {
    const nextLink = document.createElement('a');
    nextLink.className = 'button';
    nextLink.href = `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(unlockedLevel)}`;
    nextLink.textContent = `${LEVEL_LABELS[unlockedLevel]}に挑戦する`;
    actionsEl.appendChild(nextLink);
  }

  if (!passed) {
    const retryLink = document.createElement('a');
    retryLink.className = 'button';
    retryLink.href = `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
    retryLink.textContent = 'もう一度挑戦する';
    actionsEl.appendChild(retryLink);
  }

  const dashboardLink = document.createElement('a');
  dashboardLink.className = 'button secondary';
  dashboardLink.href = 'index.html';
  dashboardLink.textContent = 'ダッシュボードに戻る';
  actionsEl.appendChild(dashboardLink);

  // 不合格のときだけ、そのレベルの学習アドバイスを示す。
  if (!passed) {
    document.getElementById('advice-card').style.display = 'block';
    document.getElementById('advice-text').textContent = getStudyAdvice(domain, level);
  }

  const wrongAnswersEl = document.getElementById('wrong-answers');

  if (!Array.isArray(wrongAnswers) || wrongAnswers.length === 0) {
    const allCorrect = document.createElement('p');
    allCorrect.textContent = '全問正解でした！';
    wrongAnswersEl.appendChild(allCorrect);
  } else {
    for (const item of wrongAnswers) {
      const entry = document.createElement('div');
      entry.className = 'wrong-answer-item';

      const questionText = document.createElement('p');
      questionText.className = 'wrong-answer-question';
      questionText.textContent = item.question;
      entry.appendChild(questionText);

      const choiceList = document.createElement('ul');
      choiceList.className = 'wrong-answer-choices';
      item.choices.forEach((choiceText, index) => {
        const li = document.createElement('li');
        li.textContent = choiceText;
        if (index === item.correctIndex) {
          li.classList.add('correct-choice');
        }
        if (index === item.selectedIndex && index !== item.correctIndex) {
          li.classList.add('selected-wrong-choice');
        }
        choiceList.appendChild(li);
      });
      entry.appendChild(choiceList);

      const explanation = document.createElement('p');
      explanation.className = 'wrong-answer-explanation';
      explanation.textContent = item.explanation;
      entry.appendChild(explanation);

      wrongAnswersEl.appendChild(entry);
    }
  }

  document.getElementById('print-button').addEventListener('click', () => {
    window.print();
  });
}
