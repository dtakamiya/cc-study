# 新領域「ハーネス設計」追加 設計書

## 背景・目的

現行の問題集は6領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド）×4レベルで構成されている。CLAUDE.mdの書き方、
スキル、ルール（permissions/settings.json）、サブエージェント作成に関する問題は既存領域にも
多数存在するが（`prompt-design`にCLAUDE.md・スキルの詳細、`security-permissions`に権限設定、
`feature-usage`にエージェント基本、`slash-commands`にCLAUDE.md生成コマンド等）、いずれも
個々の機能や特定文脈の一部としての言及にとどまる。

「Claude Codeというエージェントの動作環境（ハーネス）をどう設計・構築するか」という
運用者・アーキテクト視点の統合的知識を独立して学べる第7領域「ハーネス設計」を追加する。

## スコープ

- 対象: CLAUDE.mdの設計判断（何を書く/書かない、階層設計）、スキル・ルール・エージェントの
  使い分け基準、複数機構を組み合わせた統合アーキテクチャ、公式が推奨するハーネス設計パターン
- 対象外: 個々の機能の基本的な使い方（既存領域でカバー済み）、スキル作成の実装細部
  （SKILL.mdの逐語的な書き方など、既存の`feature-usage`/`prompt-design`に委ねる）

## 既存問題との関係

既存領域（`prompt-design`のCLAUDE.md・スキル関連問題、`security-permissions`の権限設定問題、
`feature-usage`のエージェント基本問題、`slash-commands`のCLAUDE.md生成コマンド問題等）は、
各領域の文脈に根ざしているため、そのまま残す。新領域とのテーマ重複は許容し、削除・移動は
行わない（`slash-commands`領域追加時の方針を踏襲）。

新領域は「個々の機構の使い方」ではなく「複数機構を組み合わせた設計判断・アーキテクチャ」に
重点を置き、既存領域とは切り口を分ける。

## ドメイン定義

- ファイル: `data/questions/harness-design.json`
- `domain`: `"harness-design"`
- `domainLabel`: `"ハーネス設計"`
- IDプレフィックス: `harness-`（既存の`basic-`/`feature-`/`prompt-`/`security-`/`token-`/`slash-`
  規約に合わせる）

## 出題の観点とレベル配分（各レベル15問前後、計60問目安）

Claude Code Docsの一次情報源（`code.claude.com/docs`）および関連するAnthropic Engineering Blog
記事で確認した仕様・推奨事項に基づき作成する。

| レベル | 出題の重点 |
|---|---|
| 初級 | CLAUDE.mdとは何か、スキル・ルール・エージェントそれぞれの基本的な役割の違い、どの機構を
  いつ使うかの大まかな判断 |
| 中級 | CLAUDE.mdの粒度設計の基本、スキル作成の判断基準、permissions（ルール）とスキル/エージェント
  の使い分け、階層的なCLAUDE.md配置の基本 |
| 上級 | 複数機構を組み合わせた設計（例: ルールで権限を絞りつつスキルで手順化）、エンタープライズ/
  チーム運用でのCLAUDE.md・settings.json階層設計、サブエージェント設計の判断基準（いつ切り出すか） |
| エキスパート | 公式ブログ・Docsが示す設計原則（context engineering、right altitudeなどの統合的
  解釈）、複数機構の相互作用による落とし穴、大規模組織でのハーネス統治（governance）設計 |

実装時にClaude Code Docsの該当ページ（CLAUDE.md、Skills、Subagents、Settings/permissions等）
および関連するAnthropic Engineering Blog記事にあたり、実在する仕様・推奨事項を個別に確認しながら
作成する。存在しない機能や推測に基づく仕様を出題しない。

## コードへの組み込み

既存コードは領域非依存の汎用実装になっており、以下の変更のみで新領域が全機構に反映される。

### `js/progress.js`

`DOMAINS`配列と`DOMAIN_LABELS`に1エントリずつ追加する。

```js
export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
  'harness-design',
];

export const DOMAIN_LABELS = {
  // ...既存6件...
  'harness-design': 'ハーネス設計',
};
```

`createEmptyProgress`・`normalizeProgress`・`getStageStatus`・`buildDashboard`はいずれも`DOMAINS`
配列を走査する実装のため、コード変更は不要。ダッシュボード表示・進捗保存・レベル判定（木桶原理）・
復習モードの対象領域選択はすべて自動的に7領域構成になる。

### `js/report-content.js`

`SUGGESTIONS`オブジェクトに`harness-design`のレベル別アドバイス文（4レベル分）を追加する。
未追加のドメインは`FALLBACK_SUGGESTION`にフォールバックする既存の安全策があるため、
追加を忘れても結果ページ自体は壊れないが、内容の充実のため追加する。

### `data/questions/harness-design.json`

既存ファイル（例: `slash-commands.json`）と同じ構造（`{ "domain": "...", "questions": [...] }`）
で新規作成する。

### テスト・出題ロジック

`js/quiz-engine.js`の`selectQuestions`、`tests/question-data.test.js`の全検証（`correctIndex`範囲、
レベルごと最低10問、ID一意性）はいずれも`data/questions/`配下を動的に走査する実装のため、
コード変更は不要。ファイルを追加するだけで自動的に検証対象になる。

## ドキュメント更新

`README.md`を以下のとおり更新する。

- 冒頭の説明文「6領域（...）×4レベル」を「7領域（...）×4レベル」に変更し、ハーネス設計を追記
- 「対象領域は6つです」の節を7つに更新し、`harness-design`のプレフィクス規約（`harness-`）を追記

## エラーハンドリング

既存方針を継続する。新領域ファイルの読み込み失敗時も、他領域と同様にエラーメッセージ表示・
再読み込みを促す既存のフォールバック処理でカバーされる（領域固有のエラーハンドリングは追加しない）。

## テスト方針

- 新規テストコードの追加は不要。既存の`tests/question-data.test.js`が`data/questions/`配下を動的に
  走査するため、`harness-design.json`追加時に自動的に検証される
- `tests/progress.test.js`・`tests/quiz-engine.test.js`・`tests/quiz-modes.test.js`・`tests/review.test.js`は
  `DOMAINS`配列に依存する既存テストだが、ドメイン数に依存しないロジックを検証しているため
  変更不要（`node --test`で全体を再実行し、回帰がないことを確認する）
- 問題データ作成後、`node --test`が通ることを確認する
- ブラウザでの手動確認: ダッシュボードに7領域目が表示されること、新領域のステージに挑戦・合格でき
  レベルが開放されること、復習モードで新領域の誤答が対象になること
