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

入れ替え型の領域は、さらに`updatePolicy`と`nextIdSeq`の両方を持つ。

```json
{
  "domain": "recent-features",
  "domainLabel": "直近の新機能",
  "updatePolicy": "replace",
  "nextIdSeq": 51,
  "questions": [ ... ]
}
```

- `domain`: ファイル名から`.json`を除いた文字列と一致させる（例: `basic-operations.json` → `"basic-operations"`）
- `domainLabel`: 日本語の領域名。既存ファイルから変更しない
- `updatePolicy`（任意）: `"replace"`（入れ替え型）または`"append"`（追記型）。未指定時は`"append"`
  として扱う。**既に存在する場合は必ず保持すること。** 脱落すると入れ替え型の領域が黙って追記型に
  戻る
- `nextIdSeq`（`updatePolicy`が`"replace"`の場合は必須。それ以外は任意）: 次に採番する連番
  （整数）。`updatePolicy`が`"replace"`の領域は必ずこのフィールドを持つ。
  **既に存在する場合は必ず保持し、問題を追加したら追加件数分を加算すること。**
  問題を削除しても減らさない。`updatePolicy`が`"replace"`なのに`nextIdSeq`が欠けているファイルに
  遭遇した場合は異常状態であるため、採番を行わずユーザーに報告すること（既存最大連番からの
  採番へ勝手にフォールバックしない。削除済みIDの再利用による事故を防ぐため）
- `questions`: 問題オブジェクトの配列

ファイルを書き出すときは、読み込んだトップレベルのキーを1つも落とさないこと。ここに挙げていない
キーが存在する場合も、そのまま保持する。

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

以下の表は非権威的な参考例であり、新規ドメイン追加時にこの表を更新する運用は
前提としない。ドメインとprefixの正は常に`data/questions/*.json`のファイル一覧と
各ファイル内の既存`id`である（2026-08-08時点の例）:

| ドメイン | prefix | ファイル |
|---|---|---|
| 基本操作・CLI使用法 | `basic-` | `basic-operations.json` |
| 機能活用 | `feature-` | `feature-usage.json` |
| プロンプト設計・協働作法 | `prompt-` | `prompt-design.json` |
| 安全性・権限管理 | `security-` | `security-permissions.json` |
| トークン効率・コスト管理 | `token-` | `token-efficiency.json` |
| スラッシュコマンド | `slash-` | `slash-commands.json` |
| ハーネス設計思想 | `harness-` | `harness-design.json` |
| 直近の新機能 | `recent-` | `recent-features.json` |

採番は対象ファイルの`nextIdSeq`の有無で分岐する。

- `nextIdSeq`を持つファイル: その値を開始番号とし、3桁ゼロ埋めで採番する。追加が終わったら
  `nextIdSeq`を「追加件数分を加算した値」に更新する。削除済みIDの再利用を防ぐための高水位マークで
  あり、ファイル内の最大連番より小さくしてはならない。小さくなっている（＝矛盾している）ことに
  気づいた場合は、値を推測で補正せず採番を行わずユーザーに報告すること
- `nextIdSeq`を持たないファイル: `updatePolicy`が`"replace"`であれば、`nextIdSeq`の欠落は異常状態
  であるため採番を行わずユーザーに報告する。`updatePolicy`が`"append"`または未指定であれば、
  対象ファイル内の既存最大連番の次の番号を開始番号とし、3桁ゼロ埋めで採番する

### 欠番の扱い

連番の途中に欠番があっても、その番号を新規問題に再利用しない。採番は
「既存最大連番 + 1」で行う。ただし`nextIdSeq`を持つファイルは例外で、常に`nextIdSeq`の値を
開始番号とする（前節参照）。入れ替え型の領域では末尾の問題ごと削除されることがあり、
その場合「既存最大連番 + 1」では削除済みIDを再利用してしまうためである。

問題の削除や統合により連番が飛ぶことはあるが、欠番を埋め直すと以下の問題が生じる:

- 学習履歴や外部の参照（監査レポート、issue、コミットメッセージ）が指す `id` が
  別の問題を指すようになる
- 同じ `id` が時期によって異なる内容を持つため、変更履歴を追えなくなる

`id` は連続性ではなく一意性と不変性を保証するためのものである。連番の穴は
そのまま残してよい。

2026-08-08 時点の既知の欠番: `prompt-064`、`feature-065`。

## 最低問題数の制約

`tests/question-data.test.js`が強制する制約:

- 各ドメイン×各レベルの組み合わせで、最低10問が必要
- 各ドメイン内で`id`が一意であること（かつ全ドメイン間でも一意）
- `correctIndex`は`choices`の範囲内（`0`以上`choices.length`未満）の整数であること

新規問題を追加する際、この制約を壊す変更は行わない。とくに、削除によって各レベルの問題数が
10問を下回ってはならない。

ただし、これは削除そのものの禁止ではない。`updatePolicy`が`"replace"`の領域では、古くなった
問題の削除が更新手順に含まれる。この場合、ユーザーの承認を得た削除は許される（承認のない削除は
`updatePolicy`の値にかかわらず行わない）。削除後も各レベル10問以上を保つこと。削除しても
`nextIdSeq`は減らさないため、ID一意性の制約は保たれる。
