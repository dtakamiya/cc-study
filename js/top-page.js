import { buildDashboard, normalizeProgress, QUESTIONS_PER_STAGE } from './progress.js';
import { loadProgressRaw, loadReviewRaw } from './storage.js';
import { normalizeReview, countUnreviewedByStage, countUnreviewedTotal } from './review.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';

const STATUS_MARKS = { cleared: '✅', available: '▶', locked: '🔒' };

const dashboardEl = document.getElementById('dashboard');
const overallProgressEl = document.getElementById('overall-progress');
const storageNoticeEl = document.getElementById('storage-notice');
const reviewAllEl = document.getElementById('review-all');

const progress = normalizeProgress(loadProgressRaw());
const dashboard = buildDashboard(progress);
const review = normalizeReview(loadReviewRaw());
const unreviewedCounts = countUnreviewedByStage(review);

function lockedReason(level) {
  const previousLevel = LEVELS[LEVELS.indexOf(level) - 1];
  return `${LEVEL_LABELS[previousLevel]}に合格すると開放されます`;
}

function stageUrl(domain, level) {
  return `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
}

function reviewUrl(domain, level) {
  return `quiz.html?mode=review&domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
}

// 誤答バッジはセル本体とは別の遷移先を持つ。入れ子の<a>はHTMLとして不正で
// スクリーンリーダーの挙動も壊れるため、セルを<div>にしてリンクを2つ並べる。
function renderBadge(domain, domainLabel, level, count) {
  const badge = document.createElement('a');
  badge.className = 'stage-badge';
  badge.href = reviewUrl(domain, level);
  badge.textContent = `⚠${count}`;
  badge.setAttribute(
    'aria-label',
    `${domainLabel} ${LEVEL_LABELS[level]}の誤答${count}問を復習`
  );
  badge.title = `誤答${count}問を復習する`;
  return badge;
}

function renderStageCell(domain, domainLabel, stage) {
  const { level, status, record } = stage;
  const stageName = `${domainLabel} ${LEVEL_LABELS[level]}`;
  const unreviewed = unreviewedCounts[domain][level];

  const cell = document.createElement('div');
  cell.className = `stage-cell ${status}`;

  // セル本体（マーク・レベル名・スコア）は、ロック中を除いて挑戦リンクにする。
  const main = document.createElement(status === 'locked' ? 'span' : 'a');
  main.className = 'stage-cell-main';

  if (status === 'locked') {
    main.title = lockedReason(level);
    main.setAttribute('aria-label', `${stageName}（未開放）${lockedReason(level)}`);
  } else {
    main.href = stageUrl(domain, level);
    const action = status === 'cleared' ? '合格済み、再挑戦する' : '挑戦する';
    main.setAttribute('aria-label', `${stageName}（${action}）`);
  }

  const markEl = document.createElement('span');
  markEl.className = `stage-mark ${status}`;
  markEl.textContent = STATUS_MARKS[status];
  main.appendChild(markEl);

  const levelEl = document.createElement('span');
  levelEl.className = 'stage-level';
  levelEl.textContent = LEVEL_LABELS[level];
  main.appendChild(levelEl);

  const scoreEl = document.createElement('span');
  scoreEl.className = 'stage-score';
  scoreEl.textContent = record ? `${record.bestScore}/${QUESTIONS_PER_STAGE}` : '';
  main.appendChild(scoreEl);

  cell.appendChild(main);

  // バッジは合格状態とは独立。合格済みでも誤答が残れば表示する。
  // ロック中のセルにも出す。復習はゲートに影響しないため塞ぐ理由がない。
  if (unreviewed > 0) {
    cell.appendChild(renderBadge(domain, domainLabel, level, unreviewed));
  }

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

// 誤答が1件も無ければボタン自体を出さない。押しても行き先が無いため。
const unreviewedTotal = countUnreviewedTotal(review);
if (unreviewedTotal > 0) {
  const reviewAllLink = document.createElement('a');
  reviewAllLink.className = 'button secondary';
  reviewAllLink.href = 'quiz.html?mode=review';
  reviewAllLink.textContent = `すべての誤答を復習（${unreviewedTotal}問）`;
  reviewAllLink.setAttribute('aria-label', `すべての領域の誤答${unreviewedTotal}問を復習`);
  reviewAllEl.appendChild(reviewAllLink);
  reviewAllEl.style.display = 'flex';
}

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
