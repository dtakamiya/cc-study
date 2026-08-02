import { DOMAINS, DOMAIN_LABELS, QUESTIONS_PER_STAGE } from './progress.js';
import { LEVELS, LEVEL_LABELS } from './level-judge.js';
import { selectQuestions, shuffleChoices } from './quiz-engine.js';
import { selectReviewQuestions } from './review.js';

// URLの解釈だけを担う。不正な組み合わせはすべてnullにし、
// 呼び出し側は「nullならダッシュボードへ戻す」の一手で済ませられる。
export function parseQuizMode(search) {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') ?? 'normal';
  const domain = params.get('domain');
  const level = params.get('level');

  if (mode === 'normal') {
    if (!DOMAINS.includes(domain) || !LEVELS.includes(level)) return null;
    return { mode: 'normal', domain, level };
  }

  if (mode === 'review') {
    // 全領域復習はdomain/levelを持たない。片方だけの指定は
    // 壊れたリンクなので、絞り込みを勝手に緩めず弾く。
    if (domain === null && level === null) {
      return { mode: 'review', domain: null, level: null };
    }
    if (!DOMAINS.includes(domain) || !LEVELS.includes(level)) return null;
    return { mode: 'review', domain, level };
  }

  return null;
}

export function buildStageLabel(target) {
  if (target.mode === 'review') {
    if (target.domain === null) return '復習 / すべての領域';
    return `復習 / ${DOMAIN_LABELS[target.domain]} ${LEVEL_LABELS[target.level]}`;
  }
  return `${DOMAIN_LABELS[target.domain]} / ${LEVEL_LABELS[target.level]}`;
}

// 問題データのJSONは領域名を各問題に持たせていないため、ここで補う。
// 復習では複数領域が混ざるので、問題自身がdomainを知っている必要がある。
export async function fetchDomainQuestions(domain, fetchImpl) {
  const response = await fetchImpl(`data/questions/${domain}.json`);
  if (!response.ok) throw new Error(`Failed to load ${response.url}`);
  const domainData = await response.json();
  return domainData.questions.map(question => ({ ...question, domain }));
}

async function loadReviewPool(target, fetchImpl) {
  const domains = target.domain === null ? DOMAINS : [target.domain];
  const settled = await Promise.allSettled(
    domains.map(domain => fetchDomainQuestions(domain, fetchImpl))
  );

  const fulfilled = settled.filter(item => item.status === 'fulfilled');
  // 一部の領域だけ落ちたなら、取れた領域だけで復習できる方が有用。
  // 全滅したときだけ、呼び出し側に読み込みエラーを見せる。
  if (fulfilled.length === 0) {
    throw new Error('Failed to load every question domain');
  }
  return fulfilled.flatMap(item => item.value);
}

export async function loadQuestionsForTarget(target, review, fetchImpl, rng = Math.random) {
  if (target.mode === 'review') {
    const pool = await loadReviewPool(target, fetchImpl);
    const filter = target.domain === null ? {} : { domain: target.domain, level: target.level };
    return selectReviewQuestions(review, pool, filter, rng).map(question =>
      shuffleChoices(question, rng)
    );
  }

  const pool = await fetchDomainQuestions(target.domain, fetchImpl);
  return selectQuestions(
    { domain: target.domain, questions: pool },
    target.level,
    QUESTIONS_PER_STAGE,
    rng
  );
}
