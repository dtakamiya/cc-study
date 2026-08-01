import { loadResult } from './storage.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';
import { getImprovementSuggestion } from './report-content.js';

const result = loadResult();

const noResultEl = document.getElementById('no-result');
const resultContentEl = document.getElementById('result-content');

if (!result) {
  noResultEl.style.display = 'block';
} else {
  resultContentEl.style.display = 'block';

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
    const percent = Math.round(data.accuracy * 100);
    row.innerHTML = `
      <span>${data.domainLabel}</span>
      <span>
        <span class="level-badge ${data.level}">${LEVEL_LABELS[data.level]}</span>
        <span> ${data.correct}/${data.total}問 (${percent}%)</span>
      </span>
    `;
    domainResultsEl.appendChild(row);
  }

  for (const [domain, data] of weakestDomains) {
    const suggestion = document.createElement('div');
    suggestion.className = 'suggestion';
    suggestion.innerHTML = `
      <strong>${data.domainLabel}（${LEVEL_LABELS[data.level]}）</strong>
      <p>${getImprovementSuggestion(domain, data.level)}</p>
    `;
    suggestionsEl.appendChild(suggestion);
  }

  document.getElementById('print-button').addEventListener('click', () => {
    window.print();
  });
}
