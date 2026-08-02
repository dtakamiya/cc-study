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

// 正答のみの問題は記録しない。誤答したことのない問題まで持つと
// 履歴が全問題分に膨れ、バッジ集計も無駄に重くなる。
export function recordAnswers(review, questions, answers, now = new Date(), fallbackDomain = null) {
  const items = { ...review.items };
  const answeredAt = now.toISOString();

  for (const question of questions) {
    const domain = question.domain ?? fallbackDomain;
    // domainが分からないエントリはバッジ集計もステージ別復習もできないため記録しない。
    if (!DOMAINS.includes(domain) || !LEVELS.includes(question.level)) continue;

    const selectedIndex = Object.prototype.hasOwnProperty.call(answers, question.id)
      ? answers[question.id]
      : null;
    const isCorrect = selectedIndex === question.correctIndex;
    const previous = items[question.id] ?? null;

    if (isCorrect && previous === null) continue;

    items[question.id] = {
      domain,
      level: question.level,
      wrongCount: (previous?.wrongCount ?? 0) + (isCorrect ? 0 : 1),
      lastResult: isCorrect ? 'correct' : 'wrong',
      lastAnsweredAt: answeredAt,
    };
  }

  return { ...review, items };
}
