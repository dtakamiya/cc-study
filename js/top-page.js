import { buildDashboard, normalizeProgress, QUESTIONS_PER_STAGE } from './progress.js';
import { loadProgressRaw } from './storage.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';

const STATUS_MARKS = { cleared: '✅', available: '▶', locked: '🔒' };

const dashboardEl = document.getElementById('dashboard');
const overallProgressEl = document.getElementById('overall-progress');
const storageNoticeEl = document.getElementById('storage-notice');

const progress = normalizeProgress(loadProgressRaw());
const dashboard = buildDashboard(progress);

function lockedReason(level) {
  const previousLevel = LEVELS[LEVELS.indexOf(level) - 1];
  return `${LEVEL_LABELS[previousLevel]}に合格すると開放されます`;
}

function renderStageCell(domain, domainLabel, stage) {
  const { level, status, record } = stage;
  const stageName = `${domainLabel} ${LEVEL_LABELS[level]}`;

  const cell = document.createElement(status === 'locked' ? 'span' : 'a');
  cell.className = `stage-cell ${status}`;

  if (status === 'locked') {
    cell.title = lockedReason(level);
    cell.setAttribute('aria-label', `${stageName}（未開放）${lockedReason(level)}`);
  } else {
    cell.href = `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
    const action = status === 'cleared' ? '合格済み、再挑戦する' : '挑戦する';
    cell.setAttribute('aria-label', `${stageName}（${action}）`);
  }

  const markEl = document.createElement('span');
  markEl.className = `stage-mark ${status}`;
  markEl.textContent = STATUS_MARKS[status];
  cell.appendChild(markEl);

  const levelEl = document.createElement('span');
  levelEl.className = 'stage-level';
  levelEl.textContent = LEVEL_LABELS[level];
  cell.appendChild(levelEl);

  const scoreEl = document.createElement('span');
  scoreEl.className = 'stage-score';
  scoreEl.textContent = record ? `${record.bestScore}/${QUESTIONS_PER_STAGE}` : '';
  cell.appendChild(scoreEl);

  return cell;
}

let clearedCount = 0;

for (const row of dashboard) {
  const rowEl = document.createElement('div');
  rowEl.className = 'dashboard-row';

  const labelEl = document.createElement('h3');
  labelEl.className = 'dashboard-domain';
  labelEl.textContent = row.domainLabel;
  rowEl.appendChild(labelEl);

  const stagesEl = document.createElement('div');
  stagesEl.className = 'dashboard-stages';
  for (const stage of row.stages) {
    if (stage.status === 'cleared') clearedCount += 1;
    stagesEl.appendChild(renderStageCell(row.domain, row.domainLabel, stage));
  }
  rowEl.appendChild(stagesEl);

  dashboardEl.appendChild(rowEl);
}

const totalStages = dashboard.length * LEVELS.length;
overallProgressEl.textContent = `合格したステージ: ${clearedCount} / ${totalStages}`;

// 進捗を保存できない環境では、その事実を明示しておく。
// ゲート方式では進捗の永続性が体験の前提になるため、黙って失わせない。
function canPersist() {
  const probeKey = 'cc-diagnosis-storage-probe';
  // ストレージはプロパティに触れた時点で例外を投げることがあるため、
  // 取得もtryの内側に置く。外に出すとここで throw して注記が出せない。
  for (const name of ['localStorage', 'sessionStorage']) {
    try {
      const store = globalThis[name];
      store.setItem(probeKey, '1');
      store.removeItem(probeKey);
      return true;
    } catch (err) {
      // 次のストレージを試す
    }
  }
  return false;
}

if (!canPersist()) {
  storageNoticeEl.textContent =
    'ブラウザの設定により進捗を保存できません。タブを閉じると進捗が失われます。';
  storageNoticeEl.style.display = 'block';
}
