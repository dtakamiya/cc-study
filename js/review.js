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

function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isUnreviewed(entry) {
  return entry.lastResult === 'wrong';
}

// 出題対象は「未復習の誤答」かつ「実在する問題」。
// 問題が削除・ID変更されると孤児エントリが残るため、実物の側で照合する。
// 絞り込みも履歴ではなく問題データのdomain/levelで行い、
// 問題側のレベルが変わっても現物に従う。
export function selectReviewQuestions(review, allQuestions, filter = {}, rng = Math.random) {
  const targets = allQuestions.filter(question => {
    const entry = review.items[question.id];
    if (!entry || !isUnreviewed(entry)) return false;
    if (filter.domain && question.domain !== filter.domain) return false;
    if (filter.level && question.level !== filter.level) return false;
    return true;
  });

  return shuffle(targets, rng).slice(0, REVIEW_QUESTION_LIMIT);
}

// バッジのためにdata/questions/*.jsonを読ませない。
// エントリ自身がdomain/levelを持つのはこのため。
export function countUnreviewedByStage(review) {
  const counts = {};
  for (const domain of DOMAINS) {
    counts[domain] = {};
    for (const level of LEVELS) {
      counts[domain][level] = 0;
    }
  }

  for (const entry of Object.values(review.items)) {
    if (!isUnreviewed(entry)) continue;
    // normalizeReview を通していれば必ず既知のdomain/levelだが、
    // 素の値を渡された場合に落ちないよう存在を確かめる。
    if (counts[entry.domain]?.[entry.level] === undefined) continue;
    counts[entry.domain][entry.level] += 1;
  }

  return counts;
}

export function countUnreviewedTotal(review) {
  return Object.values(review.items).filter(isUnreviewed).length;
}
