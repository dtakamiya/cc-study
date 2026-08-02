import { loadResult, loadFallbackResult } from './storage.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';
import { getImprovementSuggestion } from './report-content.js';

let result = loadResult();
let usedFallback = false;

if (!result) {
  result = loadFallbackResult();
  usedFallback = result != null;
}

const noResultEl = document.getElementById('no-result');
const resultContentEl = document.getElementById('result-content');

if (!result) {
  noResultEl.style.display = 'block';
} else {
  resultContentEl.style.display = 'block';

  if (usedFallback) {
    const fallbackNoticeEl = document.getElementById('fallback-notice');
    fallbackNoticeEl.textContent =
      'ブラウザの設定により結果を保存できませんでした（今回のみ表示）';
    fallbackNoticeEl.style.display = 'block';
  }

  document.getElementById('completed-at').textContent =
    `診断日時: ${new Date(result.completedAt).toLocaleString('ja-JP')}`;

  const overallBadge = document.getElementById('overall-level-badge');
  overallBadge.textContent = LEVEL_LABELS[result.overall];
  overallBadge.classList.add(result.overall);

  const domainResultsEl = document.getElementById('domain-results');
  const suggestionsEl = document.getElementById('suggestions');

  // 弱点領域（レベルが最も低い領域、複数あれば正答率が低い順）を特定する
  const domainEntries = Object.entries(result.domains);
  const lowestLevelIndex = Math.min(
    ...domainEntries.map(([, d]) => LEVELS.indexOf(d.level))
  );
  const weakestDomains = domainEntries
    .filter(([, d]) => LEVELS.indexOf(d.level) === lowestLevelIndex)
    .sort((a, b) => a[1].accuracy - b[1].accuracy);

  for (const [domain, data] of domainEntries) {
    const row = document.createElement('div');
    row.className = 'domain-result';

    const labelSpan = document.createElement('span');
    labelSpan.textContent = data.domainLabel;

    const detailSpan = document.createElement('span');
    const levelBadge = document.createElement('span');
    levelBadge.className = `level-badge ${data.level}`;
    levelBadge.textContent = LEVEL_LABELS[data.level];
    const percent = Math.round(data.accuracy * 100);
    const scoreSpan = document.createElement('span');
    scoreSpan.textContent = ` ${data.correct}/${data.total}問 (${percent}%)`;
    detailSpan.appendChild(levelBadge);
    detailSpan.appendChild(scoreSpan);

    row.appendChild(labelSpan);
    row.appendChild(detailSpan);
    domainResultsEl.appendChild(row);
  }

  for (const [domain, data] of weakestDomains) {
    const suggestion = document.createElement('div');
    suggestion.className = 'suggestion';

    const strong = document.createElement('strong');
    strong.textContent = `${data.domainLabel}（${LEVEL_LABELS[data.level]}）`;

    const p = document.createElement('p');
    p.textContent = getImprovementSuggestion(domain, data.level);

    suggestion.appendChild(strong);
    suggestion.appendChild(p);
    suggestionsEl.appendChild(suggestion);
  }

  const wrongAnswersEl = document.getElementById('wrong-answers');
  const wrongAnswers = result.wrongAnswers;

  if (!Array.isArray(wrongAnswers)) {
    const notice = document.createElement('p');
    notice.className = 'progress';
    notice.textContent = 'この結果には間違えた問題の詳細データがありません（古い診断結果です）。';
    wrongAnswersEl.appendChild(notice);
  } else if (wrongAnswers.length === 0) {
    const allCorrect = document.createElement('p');
    allCorrect.textContent = '全問正解でした！';
    wrongAnswersEl.appendChild(allCorrect);
  } else {
    for (const item of wrongAnswers) {
      const entry = document.createElement('div');
      entry.className = 'wrong-answer-item';

      const domainLabel = document.createElement('p');
      domainLabel.className = 'wrong-answer-domain';
      domainLabel.textContent = item.domainLabel;
      entry.appendChild(domainLabel);

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
