# 新領域「直近の新機能」追加 設計書

## 背景・目的

現行の問題集は7領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド／ハーネス設計）×4レベルで構成されている。いずれも
Claude Codeの恒久的な概念・操作を扱う領域であり、「最近何が追加されたか」を軸にした領域は存在しない。

Claude Codeは更新が速く、数ヶ月前の知識がそのままでは通用しない。既存領域は機能の性質ごとに切られて
いるため、新機能は各領域に分散して取り込まれ、「直近で何が変わったか」をまとめて確認する手段がない。

直近約4ヶ月（2026年4月〜8月）に追加された機能を横断的に扱う第8領域「直近の新機能」を追加する。

## スコープ

対象は、公式Docs（`code.claude.com/docs`）およびAnthropic公式ブログで導入が確認できた、
2026年4月〜8月の新機能のうち、**個人開発者が自分の環境で使う機能**に限る。

- Artifacts（対応形式、サイズ制限、外部通信の制約、無効化設定）
- Claude 5モデル群（Opus 5／Sonnet 5／Fable 5の位置づけ、コンテキスト長、デフォルトモデルの変遷、旧モデル廃止）
- Fast Mode（`/fast`、対応モデル、速度、standardとの価格差）
- サブエージェント制御（`/fork`と`/subtask`の違い、デフォルトのバックグラウンド実行、`--forward-subagent-text`）
- サブエージェント上限（`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`等の環境変数と既定値、ネスト禁止の既定）
- クロスセッション連携（`SendMessage`、`crossSessionInbound`、`dialogExpiry`）
- Claude in Chrome（起動元、サイトレベル権限）
- 新しい`settings.json`キー（`sandbox.filesystem.disabled`、`sandbox.network.strictAllowlist`、
  `emojiCompletionEnabled`、`vimInsertModeRemaps`、`DirectoryAdded`フック）
- 新コマンド・UI（`/dataviz`、`/teleport`、`/cd`、`/plugin validate`、`claude auto-mode reset`、
  `--ax-screen-reader`、`EndConversation`、Focus View）
- 権限モードの改称（"default" → "Manual"）
- 定期実行（`/loop`と`/schedule`の違い）

### 対象外

- **エンタープライズ・組織運用機能**: Self-Hosted Environments、Inference Hooks、Gateway支出上限。
  個人開発者の日常操作から外れるため扱わない
- **Agent SDKのセルフホスティング**: アプリ開発者向けであり、Claude Codeの操作習熟とは軸が異なる
- **2026年4月より前の機能**: ToolSearch（ツール遅延ロード）、Remote Control、Code Reviewマネージド
  サービス。既存領域の担当範囲とする
- **一次情報で裏が取れない仕様**: `plugin:skill`記法の完全仕様、worktree isolationの詳細制御、
  Auto-Memoryの詳細など、公式Docsに記載が確認できないもの

## 既存問題との関係

既存7領域とのテーマ重複は許容し、既存問題の削除・移動は行わない（先行領域の方針を踏襲）。

新領域の切り口は「その機能が新しく、何がどう変わったか」に置く。たとえばFast Modeを`feature-usage`が
扱う場合はその「使い方」が焦点になるが、本領域では「どのモデルで使えて、standardと価格が何倍違うか」
という変更点そのものを問う。

## ドメイン定義

- ファイル: `data/questions/recent-features.json`
- `domain`: `"recent-features"`
- `domainLabel`: `"直近の新機能"`
- `updatePolicy`: `"replace"`（後述「更新運用」を参照）
- IDプレフィックス: `recent-`（既存の`basic-`/`feature-`/`prompt-`/`security-`/`token-`/`slash-`/`harness-`規約に合わせる）

## 出題の観点とレベル配分（各レベル10〜13問、計40〜50問）

既存領域は各レベル15問前後・計60問を目安としているが、本領域はエンタープライズ機能を対象外とした
結果、題材の実量が限られる。無理な水増しを避けるため、計40〜50問とする。
なお`tests/question-data.test.js`が各レベル最低10問を要求するため、下限は各レベル10問・計40問である。

| レベル | 問数 | 出題の重点 |
|---|---|---|
| 初級 | 10〜12 | 新機能の名前と役割が言えるか。Artifactsとは何か、`/fast`は何をするか、Claude 5の3モデルの位置づけ、`/fork`と`/subtask`の違い、権限モードの新名称「Manual」、Focus View |
| 中級 | 10〜13 | 使い分けの判断ができるか。Fast Modeを使うべき場面とstandardとの価格差、`/loop`と`/schedule`の使い分け、Artifactsで何が公開できて何ができないか、Chrome連携の権限設定、`/dataviz`・`/teleport`・`/cd`の用途 |
| 上級 | 10〜13 | 詳細仕様と組み合わせが分かるか。Artifactsの制約（サイズ上限、外部fetch不可・MCPコネクタのみ、対応形式）、サブエージェント上限3種の環境変数と既定値、`crossSessionInbound`・`dialogExpiry`、`sandbox.*`キーの効果、`DirectoryAdded`フック |
| エキスパート | 10〜12 | 非対話・大規模運用と見落とされがちな仕様。`--forward-subagent-text`の用途、サブエージェントのネスト禁止の既定と例外、`disableArtifact`・`CLAUDE_CODE_ARTIFACT_AUTO_OPEN`による抑制、旧モデル廃止スケジュールとデフォルト変遷、`--ax-screen-reader`、`EndConversation`の適用条件 |

### 出題の制約

- 公式Docs（`code.claude.com/docs`）およびAnthropic公式ブログを一次情報源とし、実在が確認できた
  仕様のみを出題する。推測に基づく出題は行わない
- `/loop`・`/schedule`・`/ultrareview`は事前調査の時点でサードパーティ記事のみが出典だった。
  実装時に公式Docsで裏取りできた項目だけを採用し、取れなければ該当問題を落として他の題材で補う
- バージョン番号（`v2.1.xxx`）そのものを問う問題は作らない。陳腐化が早く、暗記する価値がないため

## コードへの組み込み

既存コードは領域非依存の汎用実装になっており、以下の変更で新領域が全機構に反映される。

### `js/progress.js`

`DOMAINS`配列と`DOMAIN_LABELS`に1エントリずつ追加する。ここが領域名の唯一のハードコード地点である。

```js
export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
  'harness-design',
  'recent-features',
];

export const DOMAIN_LABELS = {
  // ...既存7件...
  'recent-features': '直近の新機能',
};
```

`createEmptyProgress`・`normalizeProgress`・`getStageStatus`・`buildDashboard`はいずれも`DOMAINS`配列を
走査する実装のため、コード変更は不要。ダッシュボード表示・進捗保存・レベル判定・復習モードの
対象領域選択はすべて自動的に8領域構成になる。

### `tests/progress.test.js`

22〜28行目の`DOMAINS`期待値配列に`'recent-features'`を追加する。ここを更新しないとテストが落ちる。

### `js/report-content.js`

`SUGGESTIONS`オブジェクトに`recent-features`のレベル別アドバイス文（4レベル分）を追加する。
未追加のドメインは`FALLBACK_SUGGESTION`にフォールバックする既存の安全策があるため追加を忘れても
結果ページは壊れないが、他領域と揃えるため追加する。

### `data/questions/recent-features.json`

既存ファイルと同じ構造で新規作成する。本領域は`updatePolicy`フィールドを持つ点が既存領域と異なる。

```json
{
  "domain": "recent-features",
  "domainLabel": "直近の新機能",
  "updatePolicy": "replace",
  "questions": [ ... ]
}
```

### 変更不要な箇所

`js/quiz-modes.js`は`data/questions/${domain}.json`という規約でファイルを読むため、ファイル名が
`domain`値と一致していれば変更不要。`js/quiz-engine.js`の`selectQuestions`も領域非依存の実装である。

## 更新運用

`recent-features`は相対名の領域であり、時間が経てば「直近」でなくなる。本領域は**入れ替え型**とし、
古くなった問題を保存せず差し替える。領域名が相対である以上、古い機能の問題を残すと名前と実態が
乖離するためである。

### `updatePolicy`による方針の宣言

領域が入れ替え型か蓄積型かは、その領域データ自身の属性である。そこで`data/questions/*.json`の
トップレベルに`updatePolicy`フィールドを設け、データ側で宣言する。

- `"replace"` — 入れ替え型。新規問題追加時、古くなった問題を削除してから追加する
- `"append"` — 追記型。フィールド未指定時の既定値でもある

既存7領域のファイルは変更しない。未指定を`append`として扱うため、既存の挙動は現状のまま保たれる。

この方式により、`question-bank-update`スキルは領域名を一切知らないまま更新方針を判断できる。
スキルの領域一覧が`data/questions/*.json`からの動的決定である既存設計と衝突しない。

### `question-bank-update`スキルの改修

`.claude/skills/question-bank-update/SKILL.md`に、対象領域のJSONから`updatePolicy`を読み取り、
値に応じて挙動を分岐する手順を追記する。

- `"replace"`の場合: 「直近」でなくなった機能の問題を削除したうえで、新機能の問題を追加する
- `"append"`または未指定の場合: 従来どおり既存問題に追記する

### 更新の手順

1. 新機能が積み上がった時点（目安3〜6ヶ月ごと）に、公式Docs／CHANGELOGを再調査する
2. 「直近」でなくなった機能の問題を削除する
3. 新機能の問題を追加し、各レベル10問以上・計40〜50問を維持する
4. 削除した機能のうち定着したものは、既存の恒久領域（`feature-usage`、`harness-design`、
   `security-permissions`など）へ問題を移すことを検討する

### ID採番

入れ替え時も、削除したIDは再利用せず連番を進める。`tests/question-data.test.js`の全ファイル横断
ID一意チェックとの衝突を避け、保存済み進捗データとの混同も防ぐためである。

## ドキュメント更新

`README.md`を以下のとおり更新する。

- 冒頭の説明文「7領域（...）×4レベル」を「8領域（...）×4レベル」に変更し、直近の新機能を追記
- 対象領域を列挙する節を8つに更新し、`recent-features`のプレフィクス規約（`recent-`）を追記
- `recent-features`が入れ替え型の領域であり、更新時に古い問題が差し替えられることを運用方針として明記

## エラーハンドリング

既存方針を継続する。新領域ファイルの読み込み失敗時も、他領域と同様にエラーメッセージ表示・
再読み込みを促す既存のフォールバック処理でカバーされる（領域固有のエラーハンドリングは追加しない）。

## テスト方針

### `updatePolicy`の値検証（新規テスト）

`tests/question-data.test.js`に、`updatePolicy`が`"replace"`・`"append"`・未指定のいずれかであることを
検証するテストを追加する。`updatePolicy`は挙動を分岐させる制御値であるのに、誤った値は黙って既定
（追記）に落ちる。入れ替えるつもりが追記され続けても気づけないため、値の検証を行う。

### 既存テストによる自動検証

上記以外の新規テストコードは不要である。既存の`tests/question-data.test.js`が`data/questions/`配下を
動的に走査するため、`recent-features.json`の追加時に以下が自動的に検証される。

- `correctIndex`が`choices`の範囲内であること
- 各レベル最低10問あること
- 全ファイル横断でIDが一意であること
- 選択肢の文字数偏り（警告のみでfailしない）

### 回帰確認

- `tests/progress.test.js`の`DOMAINS`期待値を更新したうえで、`node --test`で全体を再実行する
- ブラウザでの手動確認: ダッシュボードに8領域目が表示されること、新領域のステージに挑戦・合格でき
  レベルが開放されること、復習モードで新領域の誤答が対象になること、結果画面で領域別の学習
  アドバイスが表示されること
