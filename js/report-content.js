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
  'token-efficiency': {
    beginner: '`/clear`と`/compact`の違いを理解し、無関係なタスクに切り替える際は`/clear`で会話をリセットする習慣をつけましょう。',
    intermediate: 'プロンプトキャッシングの仕組みを理解し、`/model`でタスクに応じてSonnet/Opus/Haikuを使い分けてみましょう。',
    advanced: 'キャッシュのTTLやMCPツールの遅延ロードの仕組みを理解し、hookやCLAUDE.mdの設計でcontextを削減する工夫をしてみましょう。',
    expert: '`/usage`のブレークダウンを活用して使用量の内訳を把握し、組織のスペンド管理やeffortレベルの調整によるコスト最適化に取り組みましょう。',
  },
  'slash-commands': {
    beginner: 'まずは`/help`でコマンド一覧を確認し、`/clear`や`/status`など基本コマンドを実際に打って挙動を確かめてみましょう。',
    intermediate: '`/compact`と`/clear`の違い、`/resume`や`/context`など似た用途のコマンドの使い分けを整理してみましょう。',
    advanced: '`/permissions`や`/agents`、`/mcp`など設定・サブシステム管理系のコマンドを実際に操作し、引数の指定方法まで確認してみましょう。',
    expert: '非対話モードでのコマンドの扱いや、あまり使われないコマンドの仕様まで公式ドキュメントで確認し、運用の幅を広げましょう。',
  },
  'harness-design': {
    beginner: 'CLAUDE.mdの役割や、スキル・ルール・エージェントそれぞれの基本的な違いを公式ドキュメントで確認してみましょう。',
    intermediate: 'CLAUDE.mdに何を書くべきか、どんな手順をスキル化すべきかを意識しながら、実際のプロジェクトで整理してみましょう。',
    advanced: 'permissions設定とスキル・エージェントを組み合わせた設計や、階層的なCLAUDE.md配置を実際に試してみましょう。',
    expert: 'context engineeringやright altitudeなどAnthropic Engineering Blogが示す設計原則を読み、大規模なハーネス統治の設計に取り組みましょう。',
  },
};

const FALLBACK_SUGGESTION = '基礎から着実に復習し、公式ドキュメントで該当領域の機能を確認してみましょう。';

export function getStudyAdvice(domain, level) {
  const domainSuggestions = SUGGESTIONS[domain];
  if (!domainSuggestions) return FALLBACK_SUGGESTION;
  return domainSuggestions[level] || FALLBACK_SUGGESTION;
}
