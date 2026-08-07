# Claude Code ステップアップ問題集

**公開URL**: https://dtakamiya.github.io/cc-study/

Claude Codeの理解を、6領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド）×4レベル（初級／中級／上級／エキスパート）の全24ステージで段階的に高めるWebアプリです。

各ステージは10問で構成され、**8問以上正解すると合格**し、同じ領域の次のレベルが開放されます。
領域どうしは独立して進むため、得意な領域を伸ばしつつ、苦手な領域を重点的に反復できます。

チーム内の育成・研修を目的とした個人向け学習ツールで、サーバーは使わずブラウザだけで完結します。
進捗はブラウザの`localStorage`にのみ保存され、外部には送信されません。

## 進め方

1. トップページのダッシュボードで、6領域 × 4レベルの進捗を確認する
2. ▶（挑戦可能）のステージを選んで10問に挑戦する
3. 8問以上正解すれば合格。次のレベルが開放される
4. 不合格なら解説を読んで再挑戦する

合格済み（✅）のステージにも再挑戦できます。再挑戦で不合格になっても、一度得た合格は取り消されません。

## 復習モード

誤答した問題は問題ID単位で蓄積され、ダッシュボードのステージセルに`⚠N`バッジ（Nは未復習の誤答数）、
または進捗カード下の「すべての誤答を復習」ボタンから復習できます。

復習はあくまで練習であり、**合格判定やレベル開放（ゲート）には一切影響しません**。
誤答問題は一度見た問題なので、復習で正解しただけで合格扱いにしてしまうと、
ゲートが「10問中8問正解」という本来の基準を満たさなくても素通りできてしまい、形骸化するためです。

URLは`quiz.html?mode=review`（全領域から出題）、または
`quiz.html?mode=review&domain=<領域>&level=<レベル>`（ステージを指定して出題）で開けます。
1回の出題は最大20問で、対象の誤答がそれ以下の場合はある分だけ出題されます。

復習で正解すると、その問題は`⚠`の集計から外れます。ただし誤答した回数（`wrongCount`）自体は
記録として残り続け、0に戻ることはありません。

誤答履歴は`js/review.js`（誤答履歴を扱う純粋関数群）と`js/quiz-modes.js`（通常出題と復習出題の
モード差分を吸収する層）で実装しています。保存先はlocalStorageの`cc-diagnosis-review`キーで、
進捗を保存する`cc-diagnosis-progress`とは別キーに分けています。片方のデータが壊れて初期化されても、
もう片方はそのまま残ります。

## ローカルでの動作確認

ビルド不要です。プロジェクトルートで簡易HTTPサーバーを起動してください。

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` を開くとダッシュボードが表示されます。

`file://`で直接HTMLを開くと`fetch`によるJSON読み込みがブラウザのセキュリティ制限で失敗するため、
必ず簡易サーバー経由でアクセスしてください。

## テストの実行

```bash
node --test
```

## GitHub Pagesでの公開

1. GitHubリポジトリの Settings → Pages を開く
2. "Build and deployment" の Source を "Deploy from a branch" に設定
3. Branch を `main`（またはデフォルトブランチ）、フォルダを `/ (root)` に設定して保存
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される
   （本リポジトリでは https://dtakamiya.github.io/cc-study/ で公開済み）

## 問題の追加・修正

`data/questions/*.json` を直接編集してください。各領域のファイルには
`beginner`/`intermediate`/`advanced`/`expert` の4レベルがそれぞれ最低10問ずつ必要です
（1ステージにつき、そのレベルのプールから10問を抽出して出題します）。

プールを11問以上に増やした場合は、そこからランダムに10問が選ばれるため、
挑戦のたびに出題内容が変わります。

対象領域は6つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）、スラッシュコマンド（`slash-`）。

各問題の`id`はドメイン間で一意である必要があります。プレフィクス規約に従って命名してください。

### 問題作成時の妥当性チェック観点

出題時は選択肢の順序をシャッフルしますが、元データの時点で以下の偏りがないか確認してください。

- **正解の選択肢だけが極端に長い/短い**：文字数だけで正解を推測できてしまうため避ける
- **正解の`correctIndex`が0〜3のいずれかに偏っている**：領域内でおおよそ均等になるようにする
- **誤答の選択肢に「一切できない」「存在しない」「絶対に」等の極端な断定表現を多用しない**：消去法で正解が推測できてしまうため避ける

## 問題の追加・更新時に参照する情報源

Claude Codeは頻繁に機能追加・仕様変更が行われるため、既存の記憶や古い記事だけを根拠に出題しないこと。
新規追加・改訂の際は、可能な限り以下の一次情報源にあたって内容を確認してください。

### 公式ドキュメント（最優先・一次情報）

- [Claude Code Docs](https://code.claude.com/docs) — CLIオプション、スラッシュコマンド、hooks、permission-modes、sandbox、MCP、subagents、skillsなど機能仕様の一次情報源。本問題集の`security-permissions`・`feature-usage`の詳細設問の多くはここに基づく
- [Anthropic Engineering Blog](https://www.anthropic.com/engineering) — 設計思想・安全機構の背景解説。公式ドキュメントが「何をするか」を書くのに対し、ブログは「なぜそう設計したか」を説明しており、上級・エキスパート級の設問の土台として有用。特に以下の記事を出典としている
  - [How we built Claude Code auto mode](https://www.anthropic.com/engineering/claude-code-auto-mode) — auto modeの二層防御、transcript classifierが会話テキストとツール結果を入力から除外する理由、検知対象の4分類、deny-and-continueの挙動（`security-046`〜`security-051`）
  - [Beyond permission prompts: making Claude Code more secure and autonomous](https://www.anthropic.com/engineering/claude-code-sandboxing) — 承認疲れ（approval fatigue）という逆説、ファイルシステム分離とネットワーク分離の両方が必要な理由（`feature-048`）
  - [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — コンテキストエンジニアリングの定義、attention budgetとcontext rot、just-in-time取得、structured note-taking（`token-046`〜`token-050`）
  - [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) / [How we built our multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system) — エージェント設計のパターンとマルチエージェントのコスト特性。ただしResearch製品固有の内容は本問題集のスコープ外
  - 一部の記事（旧「Claude Code: Best practices for agentic coding」など）は公式ドキュメントへ統合・リダイレクトされているため、リンク先の最終到達地点を確認すること
- [Claude Platform Docs](https://platform.claude.com/docs) — コンテキストウィンドウ、プロンプトキャッシング、Message Batches APIなどAPI/プラットフォーム側の仕様

### 公式学習コンテンツ

- [Anthropic Academy](https://anthropic.skilljar.com/)（`anthropic.skilljar.com`） — 無料の公式コース。特に以下の2つはClaude Code問題の土台として有用
  - [Claude Code 101](https://anthropic.skilljar.com/claude-code-101) — agentic loop、context window、tools/permissions、explore→plan→code→commit、CLAUDE.md、subagents、skills、MCP、hooksの基礎
  - [Claude Code in Action](https://anthropic.skilljar.com/claude-code-in-action) — Steering（長時間セッションの舵取り）、Permission Modes、Verification Skills、Routines/Headless、GitHub Actions連携、Plugins配布などの実践的ワークフロー
- 新コースが追加されていないか、`anthropic.com/learn`のカタログも定期的に確認するとよい

### 公式資格制度（発展的なアーキテクチャ知識）

- [Claude Certification Program](https://www.pearsonvue.com/us/en/anthropic.html)（Pearson VUE実施） — Claude Certified Architect – Foundations (CCA-F) など。出題ドメインの一つ「Claude Code Configuration and Workflow」や、「Agentic Architecture & Orchestration」「Context Management」に含まれるmulti-agentトポロジー・セッション継続性・lost-in-the-middle対策などの概念は、Claude Code運用に関係する範囲に限定してこの問題集に取り込んでいる
- API単体の仕様（`stop_reason`の値、Message Batches API、tool_choiceの詳細など）はこの問題集のスコープ外（Claude Code CLIの利用に閉じた問題集のため）

### 二次情報を使う場合の注意

日本語ブログ（サーバーワークス、クラスメソッド、AI総合研究所など）やUdemyコースの解説は仕様変更のキャッチアップに役立つが、**内容が古い・非公式の推測を含む場合がある**ため、出題に使う前に必ず上記の公式ドキュメントで裏取りすること。特にコマンド名・フラグ名・JSON構造など検証可能な事実は公式ドキュメントの記述を正とする。

### 追加・更新の進め方の目安

1. 上記の公式情報源で、既存5領域（基本操作／機能活用／プロンプト設計／安全性・権限管理／トークン効率）に対応する新機能・仕様変更がないか確認する
2. 該当領域の`data/questions/*.json`を確認し、同じトピックの重複がないかチェックする
3. 「問題作成時の妥当性チェック観点」に沿って選択肢を作成し、`id`はドメイン内で連番かつ一意にする
4. `node --test`でテストが通ることを確認する
