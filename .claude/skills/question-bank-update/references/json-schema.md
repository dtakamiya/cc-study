# 問題JSONのスキーマ

`data/questions/*.json` の構造。全ファイル共通のフォーマット。

## ファイルトップレベル

```json
{
  "domain": "basic-operations",
  "domainLabel": "基本操作・CLI使用法",
  "questions": [ ... ]
}
```

- `domain`: ファイル名から`.json`を除いた文字列と一致させる（例: `basic-operations.json` → `"basic-operations"`）
- `domainLabel`: 日本語の領域名。既存ファイルから変更しない
- `questions`: 問題オブジェクトの配列

## 問題オブジェクト

```json
{
  "id": "basic-001",
  "level": "beginner",
  "question": "Claude Codeを起動する基本的なコマンドはどれですか？",
  "choices": [
    "claude-code start",
    "cc run",
    "anthropic claude",
    "claude"
  ],
  "correctIndex": 3,
  "explanation": "ターミナルで `claude` と入力するとClaude Codeが起動します。"
}
```

| フィールド | 型 | 制約 |
|---|---|---|
| `id` | string | ドメイン内で一意、かつ全ドメイン間でも一意。`<prefix>-<連番3桁>`形式（例: `basic-048`） |
| `level` | string | `beginner` / `intermediate` / `advanced` / `expert` のいずれか |
| `question` | string | 問題文 |
| `choices` | string[] | 必ず4要素 |
| `correctIndex` | integer | `0`・`1`・`2`・`3`のいずれか（整数）。`choices`の正解のインデックス |
| `explanation` | string | 正解の根拠を説明する解説文 |

## idのドメインprefix規約

prefixは各ドメインファイルの`questions`配列内で既存の`id`が使っている接頭辞
（`-`区切りの最初のセグメント）をそのまま踏襲する。新規ドメインを追加する場合は
`domain`名の最初の単語（例: `slash-commands` → `slash-`）を採用する。
対象領域は`data/questions/`配下のファイル一覧から動的に確認すること
（このスキル内にドメイン一覧をハードコードしない）。

現状の例（2026-08-08時点）:

| ドメイン | prefix | ファイル |
|---|---|---|
| 基本操作・CLI使用法 | `basic-` | `basic-operations.json` |
| 機能活用 | `feature-` | `feature-usage.json` |
| プロンプト設計・協働作法 | `prompt-` | `prompt-design.json` |
| 安全性・権限管理 | `security-` | `security-permissions.json` |
| トークン効率・コスト管理 | `token-` | `token-efficiency.json` |
| スラッシュコマンド | `slash-` | `slash-commands.json` |

新規問題の`id`は、対象ファイル内の既存最大連番の次の番号を3桁ゼロ埋めで採番する
（例: `basic-047`が最大なら次は`basic-048`）。

## 最低問題数の制約

`tests/question-data.test.js`が強制する制約:

- 各ドメイン×各レベルの組み合わせで、最低10問が必要
- 各ドメイン内で`id`が一意であること（かつ全ドメイン間でも一意）
- `correctIndex`は`choices`の範囲内（`0`以上`choices.length`未満）の整数であること

新規問題を追加する際、この制約を壊す変更（例えば既存問題の削除）は行わない。
