import { LEVEL_LABELS } from './level-judge.js';

const SUGGESTIONS = {
  'basic-operations': {
    beginner: '基本コマンド（起動、/clear、Ctrl+Cでの中断など）を実際に手を動かして繰り返し使い、CLI操作に慣れましょう。',
    intermediate: 'CLAUDE.mdの活用やファイル参照（@記法）など、日常操作を効率化する機能を積極的に使ってみましょう。',
    advanced: 'git worktreeやバックグラウンド実行など、複数タスクを並行して進めるための機能を活用してみましょう。',
    expert: '非対話モードやcronスケジュール実行など、CI/CDや自動化パイプラインへの組み込みに挑戦してみましょう。',
  },
  'feature-usage': {
    beginner: 'Edit・Bash・Grepなど基本的な組み込みツールがどう使われているかを意識しながら、日々の操作で観察してみましょう。',
    intermediate: 'カスタムスラッシュコマンドやMCPサーバーを1つ導入し、定型作業の自動化を体験してみましょう。',
    advanced: 'サブエージェントやフック（hooks）を使い、タスクの分離や自動検証の仕組みを設計してみましょう。',
    expert: '複数MCPサーバーやフックを組み合わせた高度な自動化・検証パイプラインの設計に挑戦しましょう。',
  },
  'prompt-design': {
    beginner: 'まずは具体的で明確な指示を出す練習をし、曖昧な依頼を避けることを意識しましょう。',
    intermediate: '実装前に設計方針を確認してもらう「計画→実装」の2段階の依頼スタイルを試してみましょう。',
    advanced: 'タスクの背景や意図を伝えることで、細部の判断も期待通りになるよう協働作法を磨きましょう。',
    expert: '複数タスクの並行分担や、チーム全体への協働ルールの明文化・展開に取り組んでみましょう。',
  },
  'security-permissions': {
    beginner: '許可確認の意味を理解し、内容をよく確認してから許可・拒否を判断する習慣をつけましょう。',
    intermediate: 'permissions設定でのallow/denyリストを使い、日常的な操作の許可管理を整理してみましょう。',
    advanced: 'hooksを使った危険操作の自動検知・ブロックの仕組みや、MCPサーバー導入時のリスク評価を実践しましょう。',
    expert: '組織全体への権限ポリシーの展開や、CI/CDでの最小権限設計など、チーム・組織レベルの安全設計に取り組みましょう。',
  },
};

const FALLBACK_SUGGESTION = '基礎から着実に復習し、公式ドキュメントで該当領域の機能を確認してみましょう。';

export function getImprovementSuggestion(domain, level) {
  const domainSuggestions = SUGGESTIONS[domain];
  if (!domainSuggestions) return FALLBACK_SUGGESTION;
  return domainSuggestions[level] || FALLBACK_SUGGESTION;
}

export function getLevelLabel(level) {
  return LEVEL_LABELS[level] || level;
}
