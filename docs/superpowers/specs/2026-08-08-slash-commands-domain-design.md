# 新領域「スラッシュコマンド」追加 設計書

## 背景・目的

現行の問題集は5領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理）×4レベルで構成されている。既存領域にもスラッシュコマンドに触れる問題は
点在するが（`basic-operations`12問、`feature-usage`12問、`prompt-design`15問、いずれも各領域の文脈の
一部としての言及）、組み込みスラッシュコマンド自体を体系的・網羅的に扱う領域は存在しない。

Claude Codeの組み込みスラッシュコマンド（`/help`、`/clear`、`/compact`、`/model`など）の全体像・
使い分け・仕様を独立して学べる第6領域「スラッシュコマンド」を追加する。

## スコープ

- 対象: 組み込みスラッシュコマンドのみ（`/help`、`/clear`、`/compact`、`/model`、`/resume`、`/status`など、
  Claude Codeに標準で付属するコマンド群の用途・引数・挙動・使い分け）
- 対象外: カスタムスラッシュコマンドの作成方法（`.claude/commands`配下でのMarkdown定義など）、
  Skills（概念・作成・運用）。いずれも将来の別領域候補として保留する

## 既存問題との関係

既存4領域（basic-operations／feature-usage／prompt-design）にあるスラッシュコマンド関連問題は、
各領域の文脈（コンテキストリセット、機能活用の一環、協働作法としての使い方等）に根ざしているため、
そのまま残す。新領域とのテーマ重複は許容し、削除・移動は行わない。

新領域は「コマンドそのものの体系的知識」（全コマンド一覧の中での位置づけ、コマンド同士の比較、
引数・オプションの仕様、非対話環境での挙動など）に重点を置き、既存領域とは切り口を分ける。

## ドメイン定義

- ファイル: `data/questions/slash-commands.json`
- `domain`: `"slash-commands"`
- `domainLabel`: `"スラッシュコマンド"`
- IDプレフィックス: `slash-`（既存の`basic-`/`feature-`/`prompt-`/`security-`/`token-`規約に合わせる）

## 出題の観点とレベル配分（各レベル15問前後、計60問目安）

Claude Code Docsの一次情報源（`code.claude.com/docs`）で確認した仕様に基づき作成する。

| レベル | 出題の重点 |
|---|---|
| 初級 | 基本コマンドの用途（`/help`、`/clear`、`/status`、`/model`など）、コマンドの起動方法（`/`入力によるサジェスト）、最も基本的な使い分け（`/clear`でコンテキストをリセットする、等） |
| 中級 | セッション管理系（`/resume`、`/rewind`）、コンテキスト確認系（`/context`、`/cost`、`/usage`）の違い、`/compact`と`/clear`の使い分けの基準 |
| 上級 | `/permissions`や`/config`など設定系コマンドの詳細、`/agents`や`/mcp`などサブシステム管理コマンド、コマンドの引数・オプションの仕様 |
| エキスパート | 非対話モード・スクリプト実行下でのスラッシュコマンドの扱い、複数コマンドの組み合わせによる運用、あまり知られていない・見落とされがちなコマンドの仕様、バージョンアップに伴う変更点 |

実装時にClaude Code Docsの該当ページ（コマンドリファレンス）にあたり、実在するコマンド名・引数・
挙動を個別に確認しながら作成する。存在しないコマンドや推測に基づく仕様を出題しない。

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
];

export const DOMAIN_LABELS = {
  // ...既存4件...
  'slash-commands': 'スラッシュコマンド',
};
```

`createEmptyProgress`・`normalizeProgress`・`getStageStatus`・`buildDashboard`はいずれも`DOMAINS`配列を
走査する実装のため、コード変更は不要。ダッシュボード表示・進捗保存・レベル判定（木桶原理）・
復習モードの対象領域選択はすべて自動的に6領域構成になる。

### `js/report-content.js`

`SUGGESTIONS`オブジェクトに`slash-commands`のレベル別アドバイス文（4レベル分）を追加する。
未追加のドメインは`FALLBACK_SUGGESTION`にフォールバックする既存の安全策があるため、
追加を忘れても結果ページ自体は壊れないが、内容の充実のため追加する。

### `data/questions/slash-commands.json`

既存ファイル（例: `token-efficiency.json`）と同じ構造（`{ "domain": "...", "questions": [...] }`）で新規作成する。

### テスト・出題ロジック

`js/quiz-engine.js`の`selectQuestions`、`tests/question-data.test.js`の全検証（`correctIndex`範囲、
レベルごと最低10問、ID一意性）はいずれも`data/questions/`配下を動的に走査する実装のため、
コード変更は不要。ファイルを追加するだけで自動的に検証対象になる。

## ドキュメント更新

`README.md`を以下のとおり更新する。

- 冒頭の説明文「5領域（...）×4レベル」を「6領域（...）×4レベル」に変更し、スラッシュコマンドを追記
- 「対象領域は5つです」の節を6つに更新し、`slash-commands`のプレフィクス規約（`slash-`）を追記

## エラーハンドリング

既存方針を継続する。新領域ファイルの読み込み失敗時も、他領域と同様にエラーメッセージ表示・
再読み込みを促す既存のフォールバック処理でカバーされる（領域固有のエラーハンドリングは追加しない）。

## テスト方針

- 新規テストコードの追加は不要。既存の`tests/question-data.test.js`が`data/questions/`配下を動的に
  走査するため、`slash-commands.json`追加時に自動的に検証される
- `tests/progress.test.js`・`tests/quiz-engine.test.js`・`tests/quiz-modes.test.js`・`tests/review.test.js`は
  `DOMAINS`配列に依存する既存テストだが、ドメイン数に依存しないロジックを検証しているため
  変更不要（`node --test`で全体を再実行し、回帰がないことを確認する）
- 問題データ作成後、`node --test`が通ることを確認する
- ブラウザでの手動確認: ダッシュボードに6領域目が表示されること、新領域のステージに挑戦・合格でき
  レベルが開放されること、復習モードで新領域の誤答が対象になること
