import { DOMAINS } from './progress.js';
import { LEVELS } from './level-judge.js';

export const REVIEW_VERSION = 1;

// 復習1回あたりの上限。誤答が溜まりすぎたとき、
// 終わらない復習を強いないためのもの。
export const REVIEW_QUESTION_LIMIT = 20;

const RESULTS = ['wrong', 'correct'];

export function createEmptyReview() {
  return { version: REVIEW_VERSION, items: {} };
}

function isValidEntry(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    DOMAINS.includes(value.domain) &&
    LEVELS.includes(value.level) &&
    typeof value.wrongCount === 'number' &&
    RESULTS.includes(value.lastResult) &&
    typeof value.lastAnsweredAt === 'string'
  );
}

// 誤答履歴は積み上げた価値があるため、進捗と違って全体は初期化しない。
// 壊れたエントリだけを黙って捨て、残りは活かす。
// versionが違うときだけは構造の意味が変わるため全体を捨てる。
export function normalizeReview(raw) {
  if (raw === null || typeof raw !== 'object') return createEmptyReview();
  if (raw.version !== REVIEW_VERSION) return createEmptyReview();
  if (raw.items === null || typeof raw.items !== 'object') return createEmptyReview();

  const normalized = createEmptyReview();
  for (const [questionId, entry] of Object.entries(raw.items)) {
    if (!isValidEntry(entry)) continue;
    normalized.items[questionId] = {
      domain: entry.domain,
      level: entry.level,
      wrongCount: entry.wrongCount,
      lastResult: entry.lastResult,
      lastAnsweredAt: entry.lastAnsweredAt,
    };
  }
  return normalized;
}
