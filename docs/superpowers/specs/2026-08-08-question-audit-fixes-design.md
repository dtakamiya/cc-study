# 問題集監査指摘への対応 設計書

- 作成日: 2026-08-08
- 対象: `data/questions/*.json`（4領域）、`.claude/skills/question-bank-update/references/json-schema.md`
- 入力: `docs/superpowers/reports/2026-08-08-question-audit-all.md`（全7領域448問の監査レポート）

## 背景と目的

2026-08-08 の `audit` モード監査で、全448問に対し「要修正4件」「検討推奨21件」「参考情報17件」が報告された。`audit` モードは JSON を一切変更しないため、指摘は未対応のまま残っている。

指摘は性質の異なる3層に分かれる。

1. **事実誤り（4件）** — 正解や解説が公式仕様と食い違う。学習者に誤った知識を与えるため、対応の必要性が最も高い
2. **選択肢の文字数偏り（全領域で約90問）** — 内容は正しいが、正解が誤答より著しく長く、内容を理解しなくても最長選択肢を選べば正答できる。監査が「最大の系統的課題」と位置づけた項目
3. **重複出題・解説の精度・id欠番** — 優先度は低〜中

本設計では 1 の全件と、2 のうち偏りが集中している範囲を対象とする。3 は id 欠番の規則明文化のみ扱い、残りは次回以降に回す。

## スコープ

### 対象に含めるもの

**A. 事実誤り修正（4件）**

| 対象 | 修正内容 | 根拠 |
|---|---|---|
| `feature-043` | 正解選択肢と解説の「Claude Code SDK」を「Claude Agent SDK（旧Claude Code SDK）」に改める | [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) |
| `token-043` | 正解選択肢と解説の「一定の文字数またはコンテキストウィンドウに対する割合のいずれか小さい方」を、ツールごとの絶対値上限（Bash 約30,000文字／MCP 既定25,000トークン）の記述に置き換える | [Tools reference](https://code.claude.com/docs/en/tools-reference) / [MCP](https://code.claude.com/docs/en/mcp) |
| `prompt-043` | 解説の「タスク分解の原則の一つに『goals over steps』があります」を、公式の名前付き原則と誤認させない表現に緩める | 公式ドキュメント・Engineering Blog に該当語なし |
| `prompt-044` | 解説の「タスク分解の原則の一つ『partition without overlap』は〜」を同様に緩める | 同上 |

`token-043` は正解選択肢そのものが事実と異なるため、選択肢本文の書き換えを伴う。他3件は解説の修正が中心。

**B. 選択肢の文字数偏り是正（23問）**

判定基準は `tests/question-data.test.js` と同一（正解文字数 / 誤答3つの平均文字数が 1.6 超 または 0.625 未満）。

| 領域 | 対象 | 件数 |
|---|---|---|
| harness-design | `harness-031`〜`034`, `036`〜`043`, `045`（advanced 15問中の該当13問） | 13 |
| token-efficiency | `token-039`, `042`, `043`, `054`, `055`, `056`, `057`, `060`, `061` | 9 |
| prompt-design | `prompt-017` | 1 |

`token-043` は A と B の両方に該当する（事実修正と偏り是正を同時に行う）。

**C. id 欠番の規則明文化**

`prompt-064` と `feature-065` が欠番。JSON は変更せず、`json-schema.md` に欠番を再利用しない旨を明記する。

### 対象に含めないもの

- 他4領域（basic-operations / feature-usage / security-permissions / slash-commands）の文字数偏り約42問
- 知識重複4件（`feature-027`/`063`、`harness-008`/`015`、`slash-050`/`051`、`slash-018`/`029`）
- 解説の先出し・精度に関する指摘（`harness-013`、`slash-014`、`basic-003`、`basic-052`、`basic-014`、`feature-052`、`feature-030`、`security-024`、`token-045`）
- `token-001`（比率 0.60）— コマンド名 `/clear` を答える形式で構造的に不可避と監査が明記
- `token-025`（比率 0.58）— 逆方向の偏りだが監査に言及なし

これらは次回の対応候補として本設計書に記録するにとどめる。

## 是正の方針

### 基本方向: 誤答を書き足す

文字数偏りの是正は **誤答3つを正解と同程度の情報量に書き足す** 方向で行う。正解を短くする方向は取らない。

理由は、監査が指摘した「正解が正確な定義を全部書いた長い選択肢」という構造自体は、正解としては望ましい性質だからである。正解を削れば数値上の偏りは消えるが、学習価値が下がる。誤答を厚くするほうが、内容を理解していないと選べない問題になり、識別力が実際に上がる。

`prompt-017` のみ逆方向（正解が 0.41 倍と極端に短い）。この問題は誤答3つが全て「自動では読み込まれず〜のみ」型の否定＋限定表現で揃っており、**文字数と文型の両面から消去法で特定できる**。正解を厚くすると同時に、誤答の文型の画一性も崩す。

### 手本

`harness-design` の expert 帯（`harness-046`〜`060`）は偏りゼロで、誤答も正解と同等の長さと構造的具体性を持つ。

`harness-046` の誤答は「一方はプロンプトが短すぎて〜もう一方は長すぎて〜」のように、正解と同じ「2つの失敗モードの対比」という構造を保ったまま、内容だけが誤っている。`harness-047` も同様に、誤答が「もっともらしい理論」として書かれている。

対して是正対象の問題（`harness-040`、`token-055` 等）は、誤答が一語〜短文のダミーで、正解だけが長い。

書き足しの指針は「**正解と同じ構造・同じ抽象度で、内容だけが誤っている選択肢**」を作ることとする。

### 誤答執筆の制約

- 技術的に明確な誤りであること。別の解釈では正しくなる記述を作らない
- 「一切できない」「存在しない」「絶対に」等の極端な断定に頼らない（`quality-checklist.md` の指摘項目）
- 正解の記述は削らない
- 事実に関わる記述は公式ドキュメントで裏取りする

## 実行構成

領域＝ファイルであるため、領域単位に分割すれば同一ファイルへの同時書き込みが起きない。この排他性を利用して並列実行する。

| エージェント | 担当ファイル | 作業 |
|---|---|---|
| A | `data/questions/harness-design.json` | 偏り13問 |
| B | `data/questions/token-efficiency.json` | 偏り9問（`token-043` は事実修正を含む） |
| C | `data/questions/prompt-design.json` | `prompt-017` 偏り是正 + `prompt-043`/`044` 解説修正 |
| D | `data/questions/feature-usage.json` | `feature-043` 事実修正 |

メインセッションは領域分割・委譲・結果集約・検証に徹し、JSON を直接編集しない（`question-bank-update` スキルの実行原則に準拠）。

C の `json-schema.md` への欠番規則追記は、JSON ファイルとは別ファイルのため競合しない。メインセッションまたは独立したエージェントが担当する。

## 検証

1. **既存テストの通過**
   ```bash
   node --test
   ```
   `tests/question-data.test.js` が id 一意性・`choices` 4要素・`correctIndex` 範囲・ドメイン×レベル10問以上を検査する。今回は問題の追加・削除を行わないため、レベル別問題数は変化しない。

2. **文字数偏りの改善確認**

   同テストの `choice length balance report` は `console.warn` で該当問題を一覧出力し、テスト自体は失敗しない設計。修正前後の出力を比較し、対象23問が一覧から消えていることを確認する。

   ```bash
   node --test tests/question-data.test.js 2>&1 | grep -E 'harness-|token-|prompt-'
   ```

   修正前の該当は harness-design advanced 13件、token-efficiency 11件（うち対象9件）、prompt-design の `prompt-017`。修正後に残るのは対象外とした `token-001`・`token-025` のみとなる想定。

3. **事実修正の根拠記録**

   `feature-043`・`token-043`・`prompt-043`/`044` の修正は、参照した公式ドキュメント URL を作業報告に記録する。

4. **手動確認**

   偏り是正後の問題について、書き足した誤答が「別の解釈で正しくなっていないか」をメインセッションがレビューする。これは自動テストで検出できない。

## 成果物

- `data/questions/harness-design.json`（13問の誤答書き足し）
- `data/questions/token-efficiency.json`（9問の誤答書き足し、うち1問は正解・解説の事実修正を含む）
- `data/questions/prompt-design.json`（`prompt-017` の是正、`prompt-043`/`044` の解説修正）
- `data/questions/feature-usage.json`（`feature-043` の事実修正）
- `.claude/skills/question-bank-update/references/json-schema.md`（欠番非再利用の規則追記）
- 対応内容のサマリ（何を直し、何を残したか）

## 今後の課題

- 残る文字数偏り約42問（basic-operations / feature-usage / security-permissions / slash-commands）の是正
- 知識重複4件の出題軸の振り直し
- 解説の先出し・精度に関する指摘9件
- `question-bank-update` スキルへの `fix` モード追加 — 監査レポートを入力として修正を適用するモード。今回の作業で得た知見（領域単位の並列化、誤答書き足しの指針、検証手順）を設計の土台にできる
- `quality-checklist.md` の「ドメイン×レベル単位（20区分）」という記述が6領域時代のもので、現在の7領域28区分に未追従
