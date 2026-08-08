import { LEVELS } from './level-judge.js';

export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
];

export const DOMAIN_LABELS = {
  'basic-operations': '基本操作・CLI使用法',
  'feature-usage': '機能活用',
  'prompt-design': 'プロンプト設計・協働作法',
  'security-permissions': '安全性・権限管理',
  'token-efficiency': 'トークン効率・コスト管理',
  'slash-commands': 'スラッシュコマンド',
};

export const QUESTIONS_PER_STAGE = 10;
export const PASSING_SCORE = 8;
export const PROGRESS_VERSION = 1;

export function createEmptyProgress() {
  const domains = {};
  for (const domain of DOMAINS) {
    const levels = {};
    for (const level of LEVELS) {
      levels[level] = null;
    }
    domains[domain] = levels;
  }
  return { version: PROGRESS_VERSION, domains };
}

export function isPassed(score) {
  return score >= PASSING_SCORE;
}

function isValidRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.cleared === 'boolean' &&
    typeof value.bestScore === 'number' &&
    typeof value.attempts === 'number' &&
    typeof value.lastAttemptAt === 'string'
  );
}

// 保存データは利用者が手で書き換えられるため、既知の領域・レベルと
// 妥当な形の記録だけを通す。壊れていれば黙って初期状態に戻す。
export function normalizeProgress(raw) {
  if (raw === null || typeof raw !== 'object') return createEmptyProgress();
  if (raw.version !== PROGRESS_VERSION) return createEmptyProgress();
  if (raw.domains === null || typeof raw.domains !== 'object') return createEmptyProgress();

  const normalized = createEmptyProgress();
  for (const domain of DOMAINS) {
    const rawLevels = raw.domains[domain];
    if (rawLevels === null || typeof rawLevels !== 'object') continue;
    for (const level of LEVELS) {
      const record = rawLevels[level];
      if (isValidRecord(record)) {
        normalized.domains[domain][level] = {
          cleared: record.cleared,
          bestScore: record.bestScore,
          attempts: record.attempts,
          lastAttemptAt: record.lastAttemptAt,
        };
      }
    }
  }
  return normalized;
}

export function getStageRecord(progress, domain, level) {
  const levels = progress.domains[domain];
  if (!levels) return null;
  return levels[level] ?? null;
}

export function recordAttempt(progress, domain, level, score, now = new Date()) {
  const previous = getStageRecord(progress, domain, level);
  const updatedRecord = {
    // 一度合格した到達は、再挑戦で落ちても剥奪しない。
    cleared: (previous?.cleared ?? false) || isPassed(score),
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    attempts: (previous?.attempts ?? 0) + 1,
    lastAttemptAt: now.toISOString(),
  };

  return {
    ...progress,
    domains: {
      ...progress.domains,
      [domain]: {
        ...progress.domains[domain],
        [level]: updatedRecord,
      },
    },
  };
}

export function getStageStatus(progress, domain, level) {
  const levelIndex = LEVELS.indexOf(level);

  // 下位レベルの検査を先に行う。保存データは手で書き換えられるため、
  // 自身のcleared記録を信じる前に前提条件の充足を確かめる。
  // そうしないと、偽造したcleared記録だけで合格表示・挑戦が通ってしまう。
  for (let i = 0; i < levelIndex; i++) {
    const lowerRecord = getStageRecord(progress, domain, LEVELS[i]);
    if (!lowerRecord?.cleared) return 'locked';
  }

  const record = getStageRecord(progress, domain, level);
  if (record?.cleared) return 'cleared';

  return 'available';
}

export function buildDashboard(progress) {
  return DOMAINS.map(domain => ({
    domain,
    domainLabel: DOMAIN_LABELS[domain],
    stages: LEVELS.map(level => ({
      level,
      status: getStageStatus(progress, domain, level),
      record: getStageRecord(progress, domain, level),
    })),
  }));
}
