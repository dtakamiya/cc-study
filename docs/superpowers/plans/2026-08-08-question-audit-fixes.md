# 問題集監査指摘への対応 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 2026-08-08 の問題集監査で指摘された事実誤り4問を修正し、選択肢の文字数偏り23問を「誤答の書き足し」で是正し、id 欠番の扱いをスキーマ文書に明文化する。

**Architecture:** `data/questions/*.json` は領域＝ファイルの1対1対応であり、領域単位にタスクを分ければ同一ファイルへの同時書き込みが起きない。この排他性を利用して領域ごとに独立タスクを構成する。各タスクは「テスト（＝`node --test` の警告レポート）で対象IDが消えること」を完了条件とする自己完結した単位である。JSON の構造（フィールド、問題数、`correctIndex`）は一切変えず、`choices` 文字列と `explanation` 文字列の書き換えのみを行う。

**Tech Stack:** Node.js 組み込みテストランナー（`node --test`）、JSON データファイル、Markdown ドキュメント

## Global Constraints

これらは全タスクの要件に暗黙に含まれる。

- **問題の追加・削除・並べ替えを行わない。** `questions` 配列の要素数と順序は不変。
- **`id` / `level` / `correctIndex` を変更しない。** 変更してよいのは `question`・`choices` の各文字列・`explanation` のみ（本計画では `question` の変更も行わない）。
- **正解選択肢の記述を削らない。** 文字数偏りの是正は誤答3つを書き足す方向で行う。例外は `prompt-017`（正解が 0.41 倍と極端に短いため、正解を厚くし誤答を短くする）。
- **偏りの判定基準は `tests/question-data.test.js` と同一。** 比率 = 正解文字数 / 誤答3つの平均文字数。`1.6` 以下かつ `0.625` 以上に収めることが是正の合格ラインである（定数 `MAX_CHOICE_LENGTH_RATIO = 1.6`、`MIN_CHOICE_LENGTH_RATIO = 0.625`）。
- **誤答執筆の制約**（設計書「誤答執筆の制約」節より）:
  - 技術的に明確な誤りであること。別の解釈では正しくなる記述を作らない。
  - 「一切できない」「存在しない」「絶対に」等の極端な断定に頼らない。
  - 正解と同じ構造・同じ抽象度で、内容だけが誤っている選択肢にする。
  - 事実に関わる記述は公式ドキュメント（`https://code.claude.com/docs/en/...`）で裏取りする。
- **手本は `harness-046`〜`060`（expert 帯）。** 誤答が「正解と同じ構造を保ったまま内容だけが誤っている」書き方になっている。書き足しの際は当該ファイル内の expert 帯を参照する。
- **JSON の整形スタイルを既存に揃える。** インデント2スペース、日本語はエスケープしない（生の UTF-8）。既存ファイルを丸ごと書き直すのではなく、対象の文字列だけを Edit で置換する。
- **`node --test` は必ず全体で通す。** 4テスト全 pass が必須。`choice length balance report` は warning のみでテストを失敗させないため、pass しただけでは是正できたことにならない。警告出力の中身を確認すること。

---

## File Structure

| ファイル | 責務 | 変更内容 |
|---|---|---|
| `data/questions/harness-design.json` | ハーネス設計領域の問題データ | advanced 13問の誤答書き足し |
| `data/questions/token-efficiency.json` | トークン効率領域の問題データ | 9問の誤答書き足し（うち `token-043` は正解・解説の事実修正を含む） |
| `data/questions/prompt-design.json` | プロンプト設計領域の問題データ | `prompt-017` の偏り是正、`prompt-043`/`044` の解説修正 |
| `data/questions/feature-usage.json` | 機能活用領域の問題データ | `feature-043` の事実修正 |
| `.claude/skills/question-bank-update/references/json-schema.md` | 問題JSONスキーマの規約文書 | id 欠番を再利用しない規則の追記 |
| `docs/superpowers/reports/2026-08-08-question-audit-fixes-summary.md` | 対応サマリ（新規） | 何を直し何を残したか、参照した公式ドキュメントURL |

タスク1〜4は互いに異なるファイルを触るため並列実行可能。タスク5・6は独立ファイル。タスク7は全タスク完了後の統合検証。

---

## タスク着手前に必ず読むもの

各タスクの実装者は、着手前に以下を確認すること。

1. **判定基準の実装** — `tests/question-data.test.js:60-70`（比率計算のロジック）
2. **手本** — 担当ファイルが `harness-design.json` なら `harness-046`〜`060` の誤答の書きぶり。他領域担当も `harness-design.json` の expert 帯を手本として読む。
3. **現状の比率** — 下記コマンドで対象問題の現在値を確認する。

```bash
node --test tests/question-data.test.js 2>&1 | grep -E '<担当prefix>-'
```

---

### Task 1: harness-design の文字数偏り是正（13問）

**Files:**
- Modify: `data/questions/harness-design.json`
- Test: `tests/question-data.test.js`（既存。変更しない）

**Interfaces:**
- Consumes: なし（他タスクに依存しない）
- Produces: なし（他タスクから参照されない）

**対象と現状比率**（`node --test` の警告レポートより）:

| id | 比率 | 正解文字数 | 誤答平均 | 是正後に必要な誤答平均（最低） |
|---|---|---|---|---|
| `harness-040` | 3.25 | 155 | 47.7 | 97 |
| `harness-042` | 2.35 | 86 | 36.7 | 54 |
| `harness-038` | 2.32 | 78 | 33.7 | 49 |
| `harness-045` | 2.25 | 105 | 46.7 | 66 |
| `harness-043` | 2.24 | 85 | 38.0 | 54 |
| `harness-036` | 2.16 | 137 | 63.3 | 86 |
| `harness-039` | 1.94 | 80 | 41.3 | 50 |
| `harness-033` | 1.90 | 104 | 54.7 | 65 |
| `harness-037` | 1.88 | 86 | 45.7 | 54 |
| `harness-041` | 1.82 | 88 | 48.3 | 55 |
| `harness-031` | 1.80 | 80 | 44.3 | 50 |
| `harness-034` | 1.78 | 73 | 41.0 | 46 |
| `harness-032` | 1.66 | 77 | 46.3 | 49 |

「是正後に必要な誤答平均（最低）」= 正解文字数 ÷ 1.6 を切り上げた値。実際にはマージンを取り、**比率 1.4 以下**を目標にする。境界ぎりぎりだと後の微修正で再び超えるため。

- [ ] **Step 1: 現状の警告を記録する**

```bash
node --test tests/question-data.test.js 2>&1 | sed -n '/\[harness-design\]/,/^\[/p' > /tmp/harness-before.txt
cat /tmp/harness-before.txt
```

Expected: 28件（うち advanced 13件が対象。beginner/intermediate 15件は本計画の対象外なので残ってよい）

- [ ] **Step 2: 手本を読む**

`data/questions/harness-design.json` の `harness-046`・`harness-047` の `choices` を読む。誤答が「一方は…もう一方は…であり、狙うべきは…である」のように、正解と同じ構造を保ったまま内容だけを誤らせている点を確認する。

- [ ] **Step 3: `harness-031` の誤答3つを書き足す**

現状の誤答（`choices[1]`〜`[3]`）:
```
"managed側が常にproject側を完全に上書きし、project側のallowルールは一切評価されない"   (46字)
"project側が常にmanaged側を上書きする"                                              (28字)
"同じ`permissions`キーが複数スコープに存在するとClaude Codeは起動時にエラーで停止する"  (59字)
```

正解（80字）は「マージされ累積し、deny→ask→allow の評価順序は別に適用される」という**2段構え**の構造を持つ。誤答も同じ2段構えにする。書き換え例:

```json
"choices": [
  "スコープ間でオーバーライドされるのではなくマージされ、両方のallowルールが累積して有効になる（ただしdeny→ask→allowの評価順序は別に適用される）",
  "他の設定項目と同じくスコープ間でオーバーライドされ、優先度の高いmanaged側のallowルールだけが有効になる（project側のallowルールは評価対象から外れる）",
  "スコープごとに独立した権限セットとして保持され、ツール実行時にはそのツールを起動したディレクトリが属するスコープのallowルールだけが参照される",
  "マージはされるがdeny・ask・allowの区別は失われ、いずれかのスコープにルールが1件でもあれば該当ツールは無条件に許可される扱いになる"
],
```

書き換え後の誤答平均: (74 + 70 + 64) / 3 ≈ 69字 → 比率 80/69 ≈ 1.16。

**「極端な断定に頼らない」制約に注意**: 元の誤答にあった「一切評価されない」は避け、「評価対象から外れる」という事実として誤った記述に置き換えている。

- [ ] **Step 4: `harness-031` の是正を検証する**

```bash
node --test tests/question-data.test.js 2>&1 | grep 'harness-031'
```

Expected: 出力なし（一覧から消えている）

- [ ] **Step 5: コミット**

```bash
git add data/questions/harness-design.json
git commit -m "fix(questions): harness-031 の誤答を正解と同等の情報量に書き足す"
```

- [ ] **Step 6: 残る12問（`harness-032`〜`034`, `036`〜`043`, `045`）に Step 3〜4 を繰り返す**

各問題について:
1. `data/questions/harness-design.json` から該当問題の `question`・`choices`・`explanation` を読む
2. 正解選択肢の**構造**（対比型 / 手段＋理由型 / パス＋説明型 など）を特定する
3. 誤答3つを、その構造を保ったまま内容だけ誤らせて書き足す
4. `node --test tests/question-data.test.js 2>&1 | grep '<id>'` で消えたことを確認

各問題の構造メモ（実装者への手がかり）:

| id | 正解の構造 | 誤答に持たせるべき形 |
|---|---|---|
| `harness-032` | パス + 括弧内で場所の説明 | 別のパス + 括弧内でそのパスがどういう場所かの説明。既存誤答は括弧の説明が短いので、なぜそこが managed settings の場所として妥当そうに見えるかまで書く |
| `harness-033` | 機構A（強制）+ 機構B（文書化）の組み合わせ | 別の2機構の組み合わせ。片方だけでは要件を満たさない理由が明確に誤りになるように |
| `harness-034` | フィールド名 + 括弧内で効果の説明 | 別のフィールド名 + その効果の説明。存在しない設定でも「もっともらしく効きそうな説明」を付ける |
| `harness-036` | 根本原因 + 対策 + 補足の3段 | 同じ3段構造で、原因の切り出し方を誤らせる |
| `harness-037` | 判断 + その判断が妥当な理由 | 逆の判断 + その理由。理由部分も同程度の長さで書く |
| `harness-038` | 上限値 + 変更手段（環境変数名） | 別の上限値 + 別の変更手段。既存誤答「無限に再帰できる」(21字)が特に短いので要拡張 |
| `harness-039` | 挙動 + 実行形態 + 結果の返り方の3要素 | 同じ3要素を持つ誤った挙動説明 |
| `harness-040` | 機構A の説明 + 「一方」+ 機構B の説明（155字と最長） | 同じ A/B 対比構造。既存誤答「両者は全く同じ機能で、書き方が異なるだけである」も対比の形に書き直す。誤答平均97字以上が必要 |
| `harness-041` | 前提条件 + それが有効化されるタイミング | 別の前提条件 + そのタイミング |
| `harness-042` | 最優先スコープ + 以降の優先順位列挙 | 別の最優先スコープ + 別の優先順位列挙。既存誤答は「常に○○が最優先される」で止まっているので、順位列挙まで書き足す |
| `harness-043` | 親の状態 + 優先関係 + 上書き可否 | 同じ3要素で優先関係を誤らせる |
| `harness-045` | 設定名 + その設定が何を無効化するかの説明 | 別の設定名 + その効果の説明 |

- [ ] **Step 7: harness-design 全体の是正を確認する**

```bash
node --test tests/question-data.test.js 2>&1 | sed -n '/\[harness-design\]/,/^\[/p'
```

Expected: advanced レベルの13件が全て消えている。残るのは beginner（`harness-006`, `007`, `011`〜`015`）と intermediate（`harness-018`, `019`, `021`, `024`, `026`〜`028`, `030`）のみ。

- [ ] **Step 8: JSON の妥当性を確認する**

```bash
node -e "const j=require('./data/questions/harness-design.json'); console.log(j.questions.length, j.questions.every(q=>q.choices.length===4 && Number.isInteger(q.correctIndex)));"
```

Expected: `60 true`（問題数が変わっていないこと、`choices` が4要素のままであること）

- [ ] **Step 9: 全テストを実行する**

```bash
node --test
```

Expected: `pass 4` / `fail 0`

- [ ] **Step 10: コミット**

```bash
git add data/questions/harness-design.json
git commit -m "fix(questions): harness-design advanced 13問の誤答を書き足して文字数偏りを是正"
```

---

### Task 2: token-efficiency の文字数偏り是正 + `token-043` の事実修正（9問）

**Files:**
- Modify: `data/questions/token-efficiency.json`
- Test: `tests/question-data.test.js`（既存。変更しない）

**Interfaces:**
- Consumes: なし
- Produces: `token-043` の修正根拠URL（Task 6 のサマリ文書に記録される）

**対象と現状比率:**

| id | 比率 | 正解文字数 | 誤答平均 | 目標誤答平均（比率1.4） |
|---|---|---|---|---|
| `token-055` | 4.56 | 82 | 18.0 | 59 |
| `token-039` | 3.79 | 153 | 40.3 | 110 |
| `token-057` | 2.47 | 74 | 30.0 | 53 |
| `token-056` | 2.45 | 54 | 22.0 | 39 |
| `token-060` | 1.90 | 93 | 49.0 | 67 |
| `token-061` | 1.65 | 81 | 49.0 | 58 |
| `token-054` | 1.65 | 34 | 20.7 | 25 |
| `token-043` | 1.63 | 70 | 43.0 | ※事実修正で正解文字数が変わるため再計算 |
| `token-042` | 1.61 | 67 | 41.7 | 48 |

**対象外**（本計画では触らない）: `token-001`（比率0.60、`/clear` というコマンド名を答える形式で構造的に不可避）、`token-025`（比率0.58）。

- [ ] **Step 1: 現状の警告を記録する**

```bash
node --test tests/question-data.test.js 2>&1 | sed -n '/\[token-efficiency\]/,/^合計/p'
```

Expected: 11件（対象9件 + 対象外2件）

- [ ] **Step 2: `token-043` の事実誤りを確認する**

現状（誤り）:
- 正解 `choices[2]`: 「ツール結果には会話全体の予算とは別に、一定の文字数またはコンテキストウィンドウに対する割合のいずれか小さい方という独自の上限が設けられている」
- `explanation`: 同様の「いずれか小さい方」という記述

公式仕様では、ツール結果の上限は**ツールごとの絶対値**である:
- Bash ツール出力: 約 30,000 文字で切り詰め（[Tools reference](https://code.claude.com/docs/en/tools-reference)）
- MCP ツール出力: 既定 25,000 トークン（[MCP](https://code.claude.com/docs/en/mcp)）

**着手前に上記2つのURLを WebFetch で参照し、現在の値を確認すること。** 数値が本計画と食い違う場合は公式ドキュメント側を正とし、その旨を作業報告に記載する。

- [ ] **Step 3: `token-043` の正解選択肢と解説を書き換える**

`correctIndex` は `2` のまま変えない。`choices[2]` と `explanation` を、ツールごとの絶対値上限の記述に置き換える。書き換え例:

```json
{
  "id": "token-043",
  "level": "expert",
  "question": "Claude Codeにおいて、ツール実行結果（tool result）が消費できるコンテキスト量の扱いとして正しいものはどれですか？",
  "choices": [
    "ツール結果はシステムプロンプトと同じ扱いを受け、コンテキスト予算を共有しないため、上限なくそのままコンテキストへ追加され続ける",
    "ツール結果は全体のコンテキスト予算とは完全に独立した無制限の別枠として扱われ、履歴が長くなっても圧縮や切り詰めの対象にならない",
    "ツール結果は会話全体のコンテキスト予算を共有したうえで、さらにツール種別ごとの上限が個別に設けられている（Bashの出力は約30,000文字で切り詰められ、MCPツールの出力は既定25,000トークンが上限となる）",
    "ツール結果はテキストの長さに関わらず常に固定のトークン数として計上され、実際の出力量はコンテキスト消費に影響しない"
  ],
  "correctIndex": 2,
  "explanation": "システムプロンプト・会話履歴・ファイル内容・ツール結果は同じコンテキスト予算を共有します。そのうえでツール結果には種別ごとの上限が個別に設けられており、Bashツールの出力は約30,000文字で切り詰められ、MCPツールの出力は既定で25,000トークンが上限です（MCPの上限は`MAX_MCP_OUTPUT_TOKENS`環境変数で変更できます）。コンテキストウィンドウに対する割合で決まるわけではなく、ツールごとの絶対値による制御です。"
}
```

正解 104字 / 誤答平均 (62 + 63 + 55)/3 = 60字 → 比率 1.73。**まだ 1.6 を超えるため誤答をさらに書き足す必要がある。** Step 4 で調整する。

- [ ] **Step 4: `token-043` の比率を 1.6 以下に収める**

```bash
node --test tests/question-data.test.js 2>&1 | grep 'token-043'
```

出力が残っている場合、誤答3つをさらに書き足す。目標: 正解文字数 ÷ 1.4 以上の誤答平均。出力が消えるまで繰り返す。

Expected（最終）: 出力なし

- [ ] **Step 5: `token-043` をコミット**

```bash
git add data/questions/token-efficiency.json
git commit -m "fix(questions): token-043 のツール結果上限を公式仕様どおりツール別絶対値に修正"
```

- [ ] **Step 6: 残る8問（`token-039`, `042`, `054`, `055`, `056`, `057`, `060`, `061`）の誤答を書き足す**

Task 1 Step 6 と同じ手順。各問題の構造メモ:

| id | 正解の構造 | 誤答に持たせるべき形 |
|---|---|---|
| `token-039` | 機能の説明 + 提供形態 + 非対応プラットフォーム列挙（153字と最長） | 同じ「機能 + 提供形態 + 適用範囲」の3段。既存誤答は全て30〜53字なので大幅な書き足しが必要。誤答平均110字が目標 |
| `token-042` | 用途A→機構A、用途B→機構B の使い分け | 同じ使い分けの形で、対応関係を誤らせる |
| `token-054` | コマンドの表示内容の説明（34字と短い） | 同程度に短い誤答が必要だが現状は18〜26字。25字前後まで揃える（この問題は正解も短いので書き足し幅は小さい） |
| `token-055` | 3択ダイアログの選択肢名を列挙（82字） | 別のダイアログ／別の挙動を同じ列挙形式で。既存誤答は全て15〜20字の単文なので、それぞれ「何が起きるか + なぜそうなるか」まで書き足す。誤答平均59字が目標 |
| `token-056` | 導入効果 + それによる削減メカニズム | 別の効果 + 別のメカニズム。既存誤答は全て20〜26字の単文 |
| `token-057` | バージョン前後の挙動対比 | 同じ「以前は〜、以降は〜」の対比構造で内容を誤らせる |
| `token-060` | 有効化の影響 + キャッシュへの作用 + 実務上の含意 | 同じ3段構造 |
| `token-061` | 機構A の動作 + 「なのに対し」+ 機構B の動作 | 同じ対比構造 |

各問題ごとに `node --test tests/question-data.test.js 2>&1 | grep '<id>'` で消えたことを確認する。

- [ ] **Step 7: token-efficiency 全体の是正を確認する**

```bash
node --test tests/question-data.test.js 2>&1 | sed -n '/\[token-efficiency\]/,/^合計/p'
```

Expected: 残るのは `token-001`（0.60）と `token-025`（0.58）の2件のみ

- [ ] **Step 8: JSON の妥当性を確認する**

```bash
node -e "const j=require('./data/questions/token-efficiency.json'); console.log(j.questions.length, j.questions.every(q=>q.choices.length===4 && Number.isInteger(q.correctIndex)));"
```

Expected: 問題数が修正前と同じ、かつ `true`

- [ ] **Step 9: 全テストを実行する**

```bash
node --test
```

Expected: `pass 4` / `fail 0`

- [ ] **Step 10: コミット**

```bash
git add data/questions/token-efficiency.json
git commit -m "fix(questions): token-efficiency 8問の誤答を書き足して文字数偏りを是正"
```

---

### Task 3: prompt-design の是正（`prompt-017` 偏り + `prompt-043`/`044` 解説修正）

**Files:**
- Modify: `data/questions/prompt-design.json`
- Test: `tests/question-data.test.js`（既存。変更しない）

**Interfaces:**
- Consumes: なし
- Produces: `prompt-043`/`044` の修正内容（Task 6 のサマリ文書に記録される）

- [ ] **Step 1: 現状の警告を記録する**

```bash
node --test tests/question-data.test.js 2>&1 | sed -n '/\[prompt-design\]/,/^\[/p'
```

Expected: 6件（対象は `prompt-017` の1件のみ。他5件は本計画の対象外）

- [ ] **Step 2: `prompt-017` を是正する**

この問題は**唯一の逆方向の偏り**（比率 0.41、正解19字 / 誤答平均46字）である。さらに誤答3つが全て「自動では読み込まれず〜のみ」型の否定＋限定表現で揃っており、**文字数と文型の両面から消去法で正解を特定できる。**

したがって是正は2方向で行う:
1. 正解を厚くする（`choices[3]`）
2. 誤答の文型の画一性を崩す(「〜のみ」型を全て残さない)

`correctIndex` は `3` のまま変えない。書き換え例:

```json
{
  "id": "prompt-017",
  "level": "beginner",
  "question": "プロジェクトルートの`CLAUDE.md`ファイルはどのタイミングでClaude Codeのコンテキストに読み込まれますか？",
  "choices": [
    "セッション開始時点では読み込まれず、`/memory`コマンドを実行した時点で初めてコンテキストへ取り込まれる",
    "スキルと同様に、内容の要約だけが常時保持され、Claudeが必要と判断した時点で本文がオンデマンドで読み込まれる",
    "ユーザーがチャット内で`@CLAUDE.md`と手動参照した時点で読み込まれ、参照しなければセッション中は使われない",
    "セッション開始時に自動的に読み込まれ、以降そのセッションのコンテキストに常駐する（オンデマンドで読み込まれるスキルとは対照的な挙動）"
  ],
  "correctIndex": 3,
  "explanation": "プロジェクトルートのCLAUDE.mdはセッション開始時に自動的にコンテキストへ読み込まれ、そのセッションの間ずっと保持されます。必要と判断されたときにだけ本文が読み込まれるスキルとは対照的な、常時読み込み型の仕組みです。"
}
```

正解 68字 / 誤答平均 (50 + 54 + 51)/3 ≈ 52字 → 比率 1.31。範囲内。

文型の画一性についても、誤答が「〜した時点で初めて取り込まれる」「〜が常時保持され、〜読み込まれる」「〜した時点で読み込まれ、参照しなければ〜」と揃っておらず、消去法が効きにくくなっている。

- [ ] **Step 3: `prompt-017` の是正を検証する**

```bash
node --test tests/question-data.test.js 2>&1 | grep 'prompt-017'
```

Expected: 出力なし

- [ ] **Step 4: コミット**

```bash
git add data/questions/prompt-design.json
git commit -m "fix(questions): prompt-017 の正解を厚くし誤答の文型の画一性を崩す"
```

- [ ] **Step 5: `prompt-043` の解説を修正する**

現状の `explanation` 冒頭が「タスク分解の原則の一つに『goals over steps（手順ではなく目標を単位にする）』があります」となっているが、この語は公式ドキュメントにも Anthropic Engineering Blog にも存在しない。**名前付きの公式原則であるかのように読める点が事実誤り**である。

修正方針: 内容（目標ベースで指示するほうがよい、という主張）は正しいので残し、「原則の一つに〜がある」という公式性の主張だけを緩める。`choices` と `correctIndex` は変更しない。

書き換え例:

```json
"explanation": "サブエージェントへの指示は、固定的な手順を逐一指定するよりも達成すべき目標を伝えるほうが、状況に応じた判断の余地を残しながら意図に沿った結果を得やすくなります（「手順ではなく目標を」と要約される考え方です）。手順を細かく固定すると、想定外の状況で立ち往生したり、目的から外れた作業を機械的に続けたりしやすくなります。"
```

「公式にこう呼ばれている」という含意を落とし、「〜と要約される考え方」という記述に緩めている点が要点。

- [ ] **Step 6: `prompt-044` の解説を修正する**

同様に、現状の「タスク分解の原則の一つ『partition without overlap』は〜」を緩める。書き換え例:

```json
"explanation": "複数のサブエージェントにタスクを割り振るときは、各エージェントの担当範囲が重ならないように分割することが重要です（「重複なく分割する」と表現される考え方です）。範囲が重なると同じ作業が二重に実行されてコストが無駄になるうえ、どちらの成果を採用すべきか、どちらが失敗の原因かが判断しにくくなり、責任範囲が曖昧になります。"
```

- [ ] **Step 7: 解説修正で偏りが生じていないことを確認する**

`explanation` は比率計算に含まれないため影響しないはずだが、念のため確認する。

```bash
node --test tests/question-data.test.js 2>&1 | grep -E 'prompt-043|prompt-044'
```

Expected: 出力なし

- [ ] **Step 8: JSON の妥当性を確認する**

```bash
node -e "const j=require('./data/questions/prompt-design.json'); console.log(j.questions.length, j.questions.every(q=>q.choices.length===4 && Number.isInteger(q.correctIndex)));"
```

Expected: 問題数が修正前と同じ、かつ `true`

- [ ] **Step 9: 全テストを実行してコミット**

```bash
node --test
git add data/questions/prompt-design.json
git commit -m "fix(questions): prompt-043/044 の解説から非公式な原則名の断定を削除"
```

Expected: `pass 4` / `fail 0`

---

### Task 4: `feature-043` の事実修正（SDK 名称）

**Files:**
- Modify: `data/questions/feature-usage.json`
- Test: `tests/question-data.test.js`（既存。変更しない）

**Interfaces:**
- Consumes: なし
- Produces: `feature-043` の修正根拠URL（Task 6 のサマリ文書に記録される）

- [ ] **Step 1: 公式ドキュメントで名称を確認する**

`https://code.claude.com/docs/en/agent-sdk/overview` を WebFetch で参照し、現在の正式名称が「Claude Agent SDK」であること、および旧称が「Claude Code SDK」であることを確認する。

- [ ] **Step 2: `feature-043` の正解選択肢と解説を修正する**

現状の正解 `choices[0]` は「Claude Code SDK」（旧称）。`correctIndex` は `0` のまま変えない。

```json
{
  "id": "feature-043",
  "level": "advanced",
  "question": "自作のアプリケーションやスクリプトからプログラム的にClaude Codeを呼び出し、エージェント機能を組み込みたい場合に使う仕組みはどれですか？",
  "choices": [
    "Claude Agent SDK（旧Claude Code SDK）",
    "スラッシュコマンドの直接編集",
    "ステータスラインのカスタムスクリプト",
    "settings.jsonのhooksフィールド"
  ],
  "correctIndex": 0,
  "explanation": "Claude Agent SDK（かつてClaude Code SDKと呼ばれていたもの）を使うと、対話的なCLIとしてだけでなく、独自のプログラムやパイプラインからエージェント機能を呼び出して制御できます。名称はClaude Codeに限定されないエージェント基盤であることを示すためAgent SDKへ改称されました。"
}
```

`feature-043` は現状の警告一覧に含まれていない（比率が範囲内）。正解が26字に伸びるが、誤答平均は (14 + 17 + 24)/3 ≈ 18字 なので比率 1.44 で範囲内に収まる。Step 3 で確認する。

- [ ] **Step 3: 偏りが生じていないことを確認する**

```bash
node --test tests/question-data.test.js 2>&1 | grep 'feature-043'
```

Expected: 出力なし。もし出力された場合は誤答3つを書き足して 1.6 以下に収める。

- [ ] **Step 4: JSON の妥当性を確認する**

```bash
node -e "const j=require('./data/questions/feature-usage.json'); console.log(j.questions.length, j.questions.every(q=>q.choices.length===4 && Number.isInteger(q.correctIndex)));"
```

Expected: 問題数が修正前と同じ、かつ `true`

- [ ] **Step 5: 全テストを実行してコミット**

```bash
node --test
git add data/questions/feature-usage.json
git commit -m "fix(questions): feature-043 の SDK 名称を Claude Agent SDK に更新"
```

Expected: `pass 4` / `fail 0`

---

### Task 5: id 欠番の規則を `json-schema.md` に明記する

**Files:**
- Modify: `.claude/skills/question-bank-update/references/json-schema.md:67-68`

**Interfaces:**
- Consumes: なし
- Produces: なし

**背景:** `prompt-064` と `feature-065` が欠番になっている。JSON 側は変更せず、欠番を再利用しない旨を規約として明文化する。`json-schema.md` は「idのドメインprefix規約」節の末尾（現在の行67-68）で採番規則を述べているので、そこに続けて追記する。

- [ ] **Step 1: 現在の記述を確認する**

```bash
grep -n '新規問題の`id`は' .claude/skills/question-bank-update/references/json-schema.md
```

Expected: 67行目付近がヒットする

- [ ] **Step 2: 欠番規則を追記する**

`json-schema.md` の以下の記述:

```markdown
新規問題の`id`は、対象ファイル内の既存最大連番の次の番号を3桁ゼロ埋めで採番する
（例: `basic-047`が最大なら次は`basic-048`）。
```

の直後に、以下を追記する:

```markdown
### 欠番の扱い

連番の途中に欠番があっても、その番号を新規問題に再利用しない。採番は常に
「既存最大連番 + 1」で行う。

問題の削除や統合により連番が飛ぶことはあるが、欠番を埋め直すと以下の問題が生じる:

- 学習履歴や外部の参照（監査レポート、issue、コミットメッセージ）が指す `id` が
  別の問題を指すようになる
- 同じ `id` が時期によって異なる内容を持つため、変更履歴を追えなくなる

`id` は連続性ではなく一意性と不変性を保証するためのものである。連番の穴は
そのまま残してよい。

2026-08-08 時点の既知の欠番: `prompt-064`、`feature-065`。
```

- [ ] **Step 3: 追記を確認する**

```bash
grep -n -A3 '欠番の扱い' .claude/skills/question-bank-update/references/json-schema.md
```

Expected: 追記した節が表示される

- [ ] **Step 4: 欠番が実際に存在することを確認する**

```bash
node -e "
for (const d of ['prompt-design','feature-usage']) {
  const j = require('./data/questions/'+d+'.json');
  const nums = j.questions.map(q => Number(q.id.split('-')[1])).sort((a,b)=>a-b);
  const gaps = [];
  for (let i = 1; i <= nums[nums.length-1]; i++) if (!nums.includes(i)) gaps.push(i);
  console.log(d, 'max:', nums[nums.length-1], 'gaps:', gaps);
}"
```

Expected: `prompt-design ... gaps: [ 64 ]` と `feature-usage ... gaps: [ 65 ]`

追記した文書の記述と食い違う場合は、実際の欠番に合わせて文書を修正する。

- [ ] **Step 5: コミット**

```bash
git add .claude/skills/question-bank-update/references/json-schema.md
git commit -m "docs: id 欠番を再利用しない規則を json-schema.md に明記"
```

---

### Task 6: 統合検証と対応サマリの作成

**Files:**
- Create: `docs/superpowers/reports/2026-08-08-question-audit-fixes-summary.md`

**Interfaces:**
- Consumes: Task 1〜5 の全成果（修正済みの4つの JSON ファイルと `json-schema.md`）
- Produces: なし（最終成果物）

**このタスクは Task 1〜5 が全て完了してから着手する。**

- [ ] **Step 1: 全テストを実行する**

```bash
node --test
```

Expected: `pass 4` / `fail 0`

- [ ] **Step 2: 是正結果の全体像を確認する**

```bash
node --test tests/question-data.test.js 2>&1 | sed -n '/選択肢の文字数偏り/,/^合計/p'
```

Expected: 以下の状態になっていること。

| 領域 | 修正前 | 修正後（期待） |
|---|---|---|
| harness-design | 28件 | 15件（beginner 7 + intermediate 8。advanced 13件が消える） |
| token-efficiency | 11件 | 2件（`token-001`, `token-025` のみ） |
| prompt-design | 6件 | 5件（`prompt-017` が消える） |
| basic-operations | 15件 | 15件（対象外・変化なし） |
| feature-usage | 11件 | 11件（対象外・変化なし。`feature-043` は元から一覧外） |
| security-permissions | 8件 | 8件（対象外・変化なし） |
| slash-commands | 13件 | 13件（対象外・変化なし） |
| **合計** | **92件** | **69件** |

実際の値が期待と食い違う場合、どの問題が残っているかを特定し、原因を Step 5 のサマリに記載する（想定外の副作用がないか確認する）。

- [ ] **Step 3: 問題数が変わっていないことを全領域で確認する**

```bash
node -e "
const fs = require('fs');
let total = 0;
for (const f of fs.readdirSync('data/questions').filter(n => n.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync('data/questions/'+f,'utf8'));
  total += j.questions.length;
  console.log(f, j.questions.length);
}
console.log('total:', total);"
```

Expected: `total: 448`

- [ ] **Step 4: 誤答の内容をレビューする（手動・自動テストで検出不可）**

書き足した誤答について、以下を1問ずつ確認する。これは `node --test` では検出できない。

1. **別の解釈で正しくなっていないか** — 書き足した誤答が、文脈や条件を変えれば真になる記述になっていないか。特に「〜の場合は」という条件節を付けた誤答は要注意。
2. **極端な断定に頼っていないか** — 「一切」「絶対に」「存在しない」で誤りにしている選択肢が残っていないか。
3. **正解の記述が削られていないか** — Task 1〜4 の全対象問題について、修正前後で正解選択肢の情報量が落ちていないか。

差分での確認:

```bash
git diff <このブランチの起点コミット> -- data/questions/ | grep -E '^\+' | grep -E '一切|絶対に|存在しない|必ず'
```

ヒットした行を1件ずつ検討し、事実として誤っている記述に書き換える。

- [ ] **Step 5: 対応サマリを作成する**

`docs/superpowers/reports/2026-08-08-question-audit-fixes-summary.md` を以下の構成で作成する。

```markdown
# 問題集監査指摘への対応 サマリ

- 実施日: 2026-08-08
- 入力: `docs/superpowers/reports/2026-08-08-question-audit-all.md`
- 設計: `docs/superpowers/specs/2026-08-08-question-audit-fixes-design.md`
- 計画: `docs/superpowers/plans/2026-08-08-question-audit-fixes.md`

## 対応した内容

### A. 事実誤り修正（3件・4問）

| id | 修正内容 | 根拠URL |
|---|---|---|
| `feature-043` | 「Claude Code SDK」→「Claude Agent SDK（旧Claude Code SDK）」 | （Task 4 で参照した URL を記載） |
| `token-043` | ツール結果の上限を「文字数と割合のいずれか小さい方」から「ツール別の絶対値（Bash 約30,000文字 / MCP 既定25,000トークン）」に修正 | （Task 2 で参照した URL を記載） |
| `prompt-043` | 解説の「原則の一つに『goals over steps』がある」という公式性の断定を削除 | 公式ドキュメント・Engineering Blog に該当語なし |
| `prompt-044` | 解説の「原則の一つ『partition without overlap』」を同様に緩和 | 同上 |

### B. 文字数偏り是正（23問）

（領域ごとに、修正前後の比率を表で記載）

### C. id 欠番の規則明文化

`json-schema.md` に「欠番の扱い」節を追加。既知の欠番は `prompt-064`・`feature-065`。

## 検証結果

- `node --test`: 4テスト全 pass
- 文字数偏りの警告: 92件 → （実測値）件
- 総問題数: 448問（変化なし）

## 残した課題

- 他4領域の文字数偏り（basic-operations 15件 / feature-usage 11件 / security-permissions 8件 / slash-commands 13件）
- `token-001`（比率0.60、`/clear` を答える形式で構造的に不可避）・`token-025`（比率0.58）
- harness-design の beginner/intermediate 15件
- prompt-design の対象外5件
- 知識重複4件: `feature-027`/`063`、`harness-008`/`015`、`slash-050`/`051`、`slash-018`/`029`
- 解説の先出し・精度に関する指摘9件: `harness-013`、`slash-014`、`basic-003`、`basic-052`、`basic-014`、`feature-052`、`feature-030`、`security-024`、`token-045`
- `question-bank-update` スキルへの `fix` モード追加
- `quality-checklist.md` の「ドメイン×レベル単位（20区分）」が6領域時代の記述で、現在の7領域28区分に未追従
```

表の（実測値）と（URL）は Step 1〜4 の実測結果で埋める。プレースホルダを残さない。

- [ ] **Step 6: コミット**

```bash
git add docs/superpowers/reports/2026-08-08-question-audit-fixes-summary.md
git commit -m "docs: 問題集監査指摘への対応サマリを追加"
```

---

## 実行順序と並列化

```
Task 1 (harness-design)  ─┐
Task 2 (token-efficiency)─┤
Task 3 (prompt-design)   ─┼─→ Task 6 (統合検証・サマリ)
Task 4 (feature-usage)   ─┤
Task 5 (json-schema.md)  ─┘
```

Task 1〜5 は全て異なるファイルを触るため並列実行可能。Task 6 のみ全完了後に着手する。

並列実行する場合、各タスクが `node --test`（全ファイル読み込み）を実行することになるが、読み取り専用なので競合しない。ただし**コミットは競合する**ため、並列エージェントには「編集のみ行いコミットしない」よう指示し、メインセッションが順にコミットする運用にしてもよい。

## 検証コマンド一覧

```bash
# 全テスト
node --test

# 偏りレポート全体
node --test tests/question-data.test.js 2>&1 | sed -n '/選択肢の文字数偏り/,/^合計/p'

# 特定領域のみ
node --test tests/question-data.test.js 2>&1 | sed -n '/\[harness-design\]/,/^\[/p'

# 特定問題のみ（消えていれば出力なし）
node --test tests/question-data.test.js 2>&1 | grep 'harness-031'

# 全領域の問題数
node -e "const fs=require('fs');let t=0;for(const f of fs.readdirSync('data/questions').filter(n=>n.endsWith('.json'))){const j=JSON.parse(fs.readFileSync('data/questions/'+f,'utf8'));t+=j.questions.length;console.log(f,j.questions.length);}console.log('total:',t);"
```
