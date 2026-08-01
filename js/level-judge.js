export const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

export const LEVEL_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  expert: 'エキスパート',
};

export function judgeDomainLevel(correct, total) {
  const accuracy = total === 0 ? 0 : correct / total;
  if (accuracy >= 0.9) return 'expert';
  if (accuracy >= 0.7) return 'advanced';
  if (accuracy >= 0.5) return 'intermediate';
  return 'beginner';
}

export function judgeAllLevels(gradeResult) {
  const domains = {};
  let lowestIndex = LEVELS.length - 1;

  for (const [domain, { correct, total }] of Object.entries(gradeResult)) {
    const level = judgeDomainLevel(correct, total);
    const accuracy = total === 0 ? 0 : correct / total;
    domains[domain] = { level, correct, total, accuracy };
    const levelIndex = LEVELS.indexOf(level);
    if (levelIndex < lowestIndex) {
      lowestIndex = levelIndex;
    }
  }

  return { domains, overall: LEVELS[lowestIndex] };
}
