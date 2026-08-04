# 問題集アップデートスキル Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `data/questions/*.json`（5領域229問）を最新かつ正確に保つための、ユーザー手動起動の再利用可能なClaude Codeスキル `.claude/skills/question-bank-update/` を作成する。

**Architecture:** プロジェクトローカルスキル1つ（`SKILL.md` + `references/`配下3ファイル）。SKILL.mdはモード判定（`add`/`audit`/`stale`）とサブエージェントへの委譲手順のみを持ち、情報源一覧はREADME.mdへの参照に留め、JSON構造とチェック観点の実装知識だけを`references/`に実体として持つ。コード実装ではなくドキュメント（プロンプト仕様）の作成が成果物であり、各ファイルの「テスト」はサブエージェントに実際に読ませて動作確認することに相当する。

**Tech Stack:** Markdown（SKILL.md, references/*.md）、既存のNode.js標準テストランナー（`node --test`）との連携のみ。新規コード依存なし。

## Global Constraints

- スキル配置場所は `.claude/skills/question-bank-update/`（プロジェクトローカル。ユーザーグローバルではない）
- 情報源URL一覧はREADME.mdに一本化し、スキル側に複製しない（設計書「全体構成」節）
- 実行主体は常にサブエージェント。メインセッションはオーケストレーションに徹する（CLAUDE.md方針、設計書「共通方針」節）
- `audit`・`stale`モードは5領域を最大5並列のサブエージェントに割り当てる（設計書「共通方針」節）
- `audit`・`stale`モードはレポート出力のみで、JSONファイルを直接修正しない（設計書「やらないこと」節）
- `add`モードはユーザー承認を経てからのみJSONファイルに書き込む（設計書「共通方針」節）
- レポート成果物は `docs/superpowers/reports/YYYY-MM-DD-<種別>.md` に保存する（設計書モード2・モード3節）
- 対象領域は5つ固定: `basic-operations` / `feature-usage` / `prompt-design` / `security-permissions` / `token-efficiency`（README・既存JSONファイル名より）
- 問題オブジェクトの必須フィールドは `id`, `level`, `question`, `choices`（4要素）, `correctIndex`, `explanation`（`tests/question-data.test.js`, 既存JSON実例より）
- `level` は `beginner` / `intermediate` / `advanced` / `expert` の4値（`tests/question-data.test.js`より）
- 各領域・各レベルは最低10問必要（`tests/question-data.test.js`の`MIN_QUESTIONS_PER_LEVEL`より）
- `id`のドメインprefixは `basic-` / `feature-` / `prompt-` / `security-` / `token-`（README「問題の追加・修正」節より）

---

## ファイル構成

```
.claude/skills/question-bank-update/
  SKILL.md                    # モード分岐・サブエージェント委譲手順（新規作成）
  references/
    sources.md                # 情報源の参照方法（新規作成、READMEへの誘導のみ）
    quality-checklist.md      # 妥当性チェック観点の実装知識（新規作成）
    json-schema.md            # 問題JSONのフィールド定義・命名規約（新規作成）
```

4ファイルとも新規作成。既存ファイルの変更はない。各ファイルの責務:

- **SKILL.md**: エントリーポイント。ユーザーが`Skill(question-bank-update, args="...")`で呼んだときにClaudeがまず読む。モード（`add`/`audit`/`stale`）の判定方法、各モードでのサブエージェント起動手順（並列数・委譲するプロンプトの骨子・参照させる`references/`ファイル）、成果物の扱い（レポート保存先、JSON書き込みの承認フロー、`node --test`実行）を記述する。
- **references/sources.md**: 「READMEのこのセクションを読め」という薄い誘導のみ。
- **references/quality-checklist.md**: 2026-08-02監査で使った検出ロジック（構造・出題の偏り・重複・読解・事実照合）を、`audit`・`stale`・`add`の各モードから参照できる形で整理。
- **references/json-schema.md**: フィールド定義・レベル4値・prefix規約・最低問題数などスキーマ制約。

## Task 1: `references/json-schema.md` を作成する

**Files:**
- Create: `.claude/skills/question-bank-update/references/json-schema.md`

**Interfaces:**
- Consumes: なし（`data/questions/*.json`の実例構造を直接参照して書く）
- Produces: 他タスク（SKILL.md, quality-checklist.md）からリンクされるファイルパス `references/json-schema.md`。ここで定義するフィールド名（`id`, `level`, `question`, `choices`, `correctIndex`, `explanation`, `domain`, `domainLabel`, `questions`）は後続タスクで使う語彙として固定する。

- [ ] **Step 1: ディレクトリを作成し、ファイルを書く**

`.claude/skills/question-bank-update/references/` ディレクトリを作成し、以下の内容で `json-schema.md` を書く。

```markdown
# 問題JSONのスキーマ

`data/questions/*.json` の構造。5ファイル共通のフォーマット。

## ファイルトップレベル

\`\`\`json
{
  "domain": "basic-operations",
  "domainLabel": "基本操作・CLI使用法",
  "questions": [ ... ]
}
\`\`\`

- `domain`: ファイル名から`.json`を除いた文字列と一致させる（例: `basic-operations.json` → `"basic-operations"`）
- `domainLabel`: 日本語の領域名。既存5ファイルから変更しない
- `questions`: 問題オブジェクトの配列

## 問題オブジェクト

\`\`\`json
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
\`\`\`

| フィールド | 型 | 制約 |
|---|---|---|
| `id` | string | ドメイン内で一意、かつ全ドメイン間でも一意。`<prefix>-<連番3桁>`形式（例: `basic-048`） |
| `level` | string | `beginner` / `intermediate` / `advanced` / `expert` のいずれか |
| `question` | string | 問題文 |
| `choices` | string[] | 必ず4要素 |
| `correctIndex` | number | `0`〜`3`。`choices`の正解のインデックス |
| `explanation` | string | 正解の根拠を説明する解説文 |

## idのドメインprefix規約

| ドメイン | prefix | ファイル |
|---|---|---|
| 基本操作・CLI使用法 | `basic-` | `basic-operations.json` |
| 機能活用 | `feature-` | `feature-usage.json` |
| プロンプト設計・協働作法 | `prompt-` | `prompt-design.json` |
| 安全性・権限管理 | `security-` | `security-permissions.json` |
| トークン効率・コスト管理 | `token-` | `token-efficiency.json` |

新規問題の`id`は、対象ファイル内の既存最大連番の次の番号を3桁ゼロ埋めで採番する
（例: `basic-047`が最大なら次は`basic-048`）。

## 最低問題数の制約

`tests/question-data.test.js`が強制する制約:

- 各ドメイン×各レベルの組み合わせで、最低10問が必要
- 各ドメイン内で`id`が一意であること（かつ全ドメイン間でも一意）
- `correctIndex`は`choices`の範囲内（`0`以上`choices.length`未満）であること

新規問題を追加する際、この制約を壊す変更（例えば既存問題の削除）は行わない。
```

- [ ] **Step 2: 内容を実物のJSONと突き合わせて確認する**

`data/questions/basic-operations.json`の先頭の問題オブジェクトを読み、上記スキーマ記述と
フィールド名・型が一致していることを目視確認する。一致していなければ`json-schema.md`を修正する。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/question-bank-update/references/json-schema.md
git commit -m "$(cat <<'EOF'
feat: 問題集アップデートスキルにJSONスキーマ資料を追加

question-bank-update スキルの一部として、data/questions/*.json の
フィールド定義・id命名規約・最低問題数制約をまとめた参照資料を追加。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 2: `references/sources.md` を作成する

**Files:**
- Create: `.claude/skills/question-bank-update/references/sources.md`

**Interfaces:**
- Consumes: なし
- Produces: SKILL.mdから参照される`references/sources.md`というパス。このファイルは「READMEを読め」という指示のみを持ち、URL一覧そのものは含まない。

- [ ] **Step 1: ファイルを書く**

```markdown
# 情報源の参照方法

問題の新規作成・監査・陳腐化チェックのいずれにおいても、公式情報源の一覧は
このファイルではなく **プロジェクトルートの `README.md`** の
「## 問題の追加・更新時に参照する情報源」セクションを直接読むこと。

## なぜREADMEを直接読むのか

情報源のURLやその優先順位はREADME.mdに一次情報として存在する。このファイルに
複製すると、README.md更新時にこのスキルが追従できず内容が古くなる。
常にREADME.mdを都度読みに行くことで、情報源リストの二重管理を避ける。

## 調査の進め方

1. `README.md`の「問題の追加・更新時に参照する情報源」セクションを読み、
   優先順位（公式ドキュメント最優先 → Engineering Blog → 公式学習コンテンツ →
   公式資格制度 → 二次情報は裏取り必須）を把握する
2. 同セクションに列挙されたURLのうち、調査対象のトピックに関連するものから
   WebFetch/WebSearchで内容を取得する
3. 日本語ブログ等の二次情報のみを根拠にせず、必ず公式ドキュメントで裏取りする
   （README.mdの「二次情報を使う場合の注意」節に従う）
4. コマンド名・フラグ名・JSON構造など検証可能な事実は、公式ドキュメントの記述を正とする
```

- [ ] **Step 2: README.mdの該当セクションが実在し記述と一致することを確認する**

```bash
grep -n "問題の追加・更新時に参照する情報源" README.md
```

Expected: 該当行が1件ヒットする（README.md:94付近）。ヒットしなければ`sources.md`内の
セクション名表記をREADME.mdの実際の見出しに合わせて修正する。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/question-bank-update/references/sources.md
git commit -m "$(cat <<'EOF'
feat: 問題集アップデートスキルに情報源参照資料を追加

question-bank-update スキルの一部として、公式情報源はREADME.mdを
都度参照する方針をまとめた資料を追加。URL一覧はREADME側に一本化し複製しない。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 3: `references/quality-checklist.md` を作成する

**Files:**
- Create: `.claude/skills/question-bank-update/references/quality-checklist.md`

**Interfaces:**
- Consumes: Task 1で定義したフィールド名語彙（`id`, `level`, `choices`, `correctIndex`, `explanation`）
- Produces: SKILL.mdの`add`/`audit`/`stale`各モードから参照される`references/quality-checklist.md`というパス。ここで定義する検査項目の見出し（「構造の妥当性」「出題の偏り」「重複出題」「読解チェック」「事実照合」）はSKILL.md側の手順記述でそのまま使う語彙として固定する。

- [ ] **Step 1: ファイルを書く**

`docs/2026-08-02-question-audit.md`（既存の監査レポート）と`README.md`の
「問題作成時の妥当性チェック観点」節の内容を土台に、以下を書く。

```markdown
# 問題データの妥当性チェック観点

`add`（新規作成時の自己チェック）・`audit`（既存問題の監査）・`stale`（陳腐化検出）の
いずれのモードからも参照する、問題データの検査項目一覧。2026-08-02実施の
問題データ健全性チェックで用いた手法をベースにする。

## 構造の妥当性

- `id`の重複（ドメイン内・全ドメイン間の両方）
- `id`の命名規約違反（`references/json-schema.md`のprefix規約・連番形式から外れていないか）
- 必須フィールド（`id`, `level`, `question`, `choices`, `correctIndex`, `explanation`）の欠落・空文字
- `choices`の要素数が4でない
- `choices`内の重複
- `correctIndex`が`0`〜`3`の範囲外
- `level`が既定の4値（`beginner`/`intermediate`/`advanced`/`expert`）以外
- 各ドメイン×各レベルの問題数が10未満（`tests/question-data.test.js`の制約）

## 出題の偏り（README「問題作成時の妥当性チェック観点」に対応）

- **正解選択肢の長さ偏り**: 正解の文字数が他の選択肢の平均に対して1.6倍を超える、
  または0.625倍未満の場合に候補として拾う。文字数だけで正解が推測できる状態を避ける
- **`correctIndex`の分布偏り**: ドメイン×レベル単位（20区分）で集計し、
  特定インデックスが50%を超えていないか確認する。出題時に選択肢はシャッフルされるため
  実害は小さいが、参考情報として記録する
- **誤答選択肢の断定表現**: 「一切できない」「存在しない」「絶対に」「必ず」等の
  極端な断定表現が誤答選択肢に多用されていないか。消去法で正解が推測できる状態を避ける

## 重複出題

問題文・解説のテキスト類似度（文字bigram類似度など）が高いペアを検出する。
ただし高い類似度が出ても、以下のように**意図的な対構成**であれば重複ではないと判断する
（2026-08-02監査での実例）:

- `allow`と`ask`のように、対比を主眼とした問題ペア
- 同じ機能の異なる設定キー（例: `allowManagedDomainsOnly`と`allowManagedReadPathsOnly`）を
  別々に問う問題
- 「〜の動作として正しいものは」等の定型的な問題文が一致しただけで、問う対象
  （コマンド名・設定キー等）が異なる場合

類似度が高いだけで即座に「重複」と断定せず、必ず問題文・選択肢・解説を読んで
実質的に同じ知識を問うているかを判断する。

## 読解チェック

機械的な検査では検出できない欠陥。問題文・選択肢・解説を実際に読んで判断する。

- 正解が複数成立してしまう問題（問題文の限定が不十分など）
- 正解とされる選択肢が実は誤りである問題
- 問題文と解説の間の矛盾
- 解説が正解の根拠を説明できていない
- レベル配置の妥当性（例: beginnerにexpert級の知識を要求する問題が混入していないか、
  同じ知識を扱う問題が複数レベルにまたがっていないか）

## 事実照合

コマンド名・CLIフラグ名・スラッシュコマンド名・設定ファイルのJSON構造・数値上限
（コンテキストウィンドウサイズ等）・機能の有無や廃止状況など、検証可能な事実を問う
問題については、`references/sources.md`の手順に従い公式情報源で裏取りする。
Claude Codeは仕様変更が頻繁なため、記憶のみを根拠に「正しい」と判断しない。

## モードごとの使い分け

- **`add`**: 新規作成した問題案に対して「構造の妥当性」「出題の偏り」を自己チェックする
  （まだ存在しない問題なので「重複出題」は既存問題との突き合わせとして行う）
- **`audit`**: 対象領域の全項目（構造・偏り・重複・読解・事実照合）を検査する
- **`stale`**: 「事実照合」の観点のみに絞り、構造・偏り・重複・読解チェックは対象外とする
  （それらは`audit`モードの担当であり、`stale`は仕様変更への追従に特化する）
```

- [ ] **Step 2: README.mdの該当節と矛盾がないか突き合わせる**

```bash
grep -n "問題作成時の妥当性チェック観点" -A 10 README.md
```

出力された3つの観点（正解選択肢の長さ・`correctIndex`偏り・断定表現）が
`quality-checklist.md`の「出題の偏り」節に過不足なく反映されていることを確認する。

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/question-bank-update/references/quality-checklist.md
git commit -m "$(cat <<'EOF'
feat: 問題集アップデートスキルに妥当性チェック観点を追加

question-bank-update スキルの一部として、構造・出題の偏り・重複・読解・
事実照合の検査観点をREADMEと2026-08-02監査の手法から集約した資料を追加。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 4: `SKILL.md` を作成する

**Files:**
- Create: `.claude/skills/question-bank-update/SKILL.md`

**Interfaces:**
- Consumes:
  - `references/json-schema.md`（Task 1で作成、フィールド名・prefix規約・最低問題数の語彙）
  - `references/sources.md`（Task 2で作成、情報源調査の進め方）
  - `references/quality-checklist.md`（Task 3で作成、検査観点の見出し語彙）
- Produces: `Skill(question-bank-update, args="...")`で呼び出されるエントリーポイント。以降このスキルを使う全セッションが読む唯一の起点。

- [ ] **Step 1: ファイルを書く**

```markdown
---
name: question-bank-update
description: data/questions/*.json（Claude Codeステップアップ問題集、5領域229問）を最新かつ正確に保つためのスキル。新規問題の追加、既存問題の監査、Claude Codeの仕様変更による陳腐化した問題の検出の3モードを持つ。「問題集をアップデートして」「新しい問題を追加して」「問題を監査して」「陳腐化した問題がないか確認して」等の発言で使用する。
---

# 問題集アップデートスキル

`data/questions/*.json`（5領域: `basic-operations` / `feature-usage` /
`prompt-design` / `security-permissions` / `token-efficiency`、計229問）を、
Claude Codeの仕様変更に追従して最新かつ正確な状態に保つためのスキル。

**このスキルはユーザーが手動で呼び出す。** 3つのモードを持ち、呼び出し時の
引数または対話でモードを確定させる。

## 実行原則（全モード共通）

- **実行主体は常にサブエージェント。** メインセッション（このSKILL.mdを読んでいる
  あなた自身）はモード判定・サブエージェントへのタスク委譲・結果の集約・
  ユーザーへの提示に徹する。Web調査や大量のJSON読み込みを伴う実作業は行わない
- **領域単位で並列化する。** `audit`・`stale`モードでは5領域それぞれに
  独立したサブエージェントを最大5並列で起動する。各サブエージェントは
  Agentツールで、`run_in_background: false`を指定せず並列に投げる
  （5並列すべての完了を待ってから集約する場合は、1メッセージ内で5つの
  Agent呼び出しを同時に行う）
- **JSONファイルへの書き込みは承認後のみ。** `add`モードで問題案を作成しても、
  ユーザーが個々の問題案を承認するまで`data/questions/*.json`は変更しない。
  `audit`・`stale`はレポート出力のみで、JSON自体は一切変更しない

## モードの判定

呼び出し時の引数や発言から、以下のいずれかのモードを判定する。
不明な場合はユーザーに確認する。

| モード | 目的 | 対象領域指定 |
|---|---|---|
| `add` | 新規問題の追加 | 可能（省略時は5領域全部） |
| `audit` | 既存問題の監査（構造・偏り・重複・読解・事実照合） | 可能（省略時は5領域全部） |
| `stale` | Claude Codeの仕様変更による陳腐化検出 | 不可（常に5領域全部） |

## モード: `add`（新規問題の追加）

### 手順

1. 対象領域を確定する（引数で指定がなければユーザーに確認するか、
   指定がなければ5領域全部を対象にする）
2. 対象領域ごとに、以下を指示するサブエージェントを起動する（最大5並列）:
   - `README.md`の「問題の追加・更新時に参照する情報源」セクションを読み、
     `references/sources.md`の手順に従って優先順位の高い情報源から調査する
   - 対象ドメインの既存問題ファイル（`data/questions/<domain>.json`）を読み、
     既出トピックと重複しない新規トピックを見つける
   - `references/json-schema.md`のフィールド定義に従い、問題案
     （`id`は仮採番、`level`, `question`, `choices`, `correctIndex`, `explanation`）を作成する
   - `references/quality-checklist.md`の「出題の偏り」観点で自己チェックし、
     違反があれば作成時点で修正する
   - 問題案を、根拠となる情報源URLとともにサブエージェントの回答として返す
3. 全サブエージェントの結果を集約し、領域・レベル・問題文・選択肢・正解・
   解説・出典URLを含むレポート形式でユーザーに提示する
4. ユーザーの承認を待つ。承認されなかった問題案は破棄する
5. 承認された問題案のみ、対象JSONファイルの`questions`配列に追記する。
   `id`は対象ファイル内の既存最大連番の次番号で確定させる
6. `node --test`を実行し、結果をユーザーに報告する

## モード: `audit`（既存問題の監査）

### 手順

1. 対象領域を確定する（引数で指定がなければユーザーに確認するか、
   指定がなければ5領域全部を対象にする）
2. 対象領域ごとに、以下を指示するサブエージェントを起動する（最大5並列）:
   - `references/quality-checklist.md`の「構造の妥当性」「出題の偏り」
     「重複出題」「読解チェック」の各観点で、対象ドメインの
     `data/questions/<domain>.json`を検査する
   - 事実照合が必要な問題（コマンド名・フラグ名・JSON構造・数値上限・
     機能の有無等を問う問題）にフラグを立て、`references/sources.md`の
     手順で公式情報源と照合する
   - 検出した指摘それぞれに、深刻度（要修正 / 検討推奨 / 参考情報）・
     何が問題か・なぜ問題か・根拠を付けて返す
3. 全サブエージェントの結果を集約し、深刻度順に並べたレポートを作成する
4. レポートを `docs/superpowers/reports/YYYY-MM-DD-question-audit.md`
   （`YYYY-MM-DD`は実行日）に保存し、gitにコミットする
5. 検出ゼロの領域があっても、その旨と検査範囲をレポートに明記する

### このモードでは行わないこと

- `data/questions/*.json`の修正（指摘一覧の提示のみ）
- 指摘への対応要否の判断（ユーザーが個別に判断する）

## モード: `stale`（陳腐化した問題の検出）

### 手順

1. 対象領域は常に5領域全部（領域指定は受け付けない）
2. 5領域それぞれに、以下を指示するサブエージェントを起動する（5並列）:
   - `README.md`の「問題の追加・更新時に参照する情報源」セクションを
     上から順に読み、`references/sources.md`の手順で公式情報源を通読する
   - `references/quality-checklist.md`の「事実照合」観点のみを使い、
     対象ドメインの全問題が現行のClaude Code仕様と矛盾していないか照合する
     （コマンド名・フラグ名・JSON構造・数値上限・機能の廃止/統合/改名・
     問題が前提とする挙動の陳腐化）
   - 「出題の偏り」「重複出題」「読解チェック」等のスタイル面の観点は
     `audit`モードの担当であり、`stale`では検査しない
   - 検出した指摘それぞれに、何が古くなったか・現行の正しい仕様・根拠URLを付けて返す
3. 全サブエージェントの結果を集約する
4. レポートを `docs/superpowers/reports/YYYY-MM-DD-question-staleness.md`
   （`YYYY-MM-DD`は実行日）に保存し、gitにコミットする
5. 指摘ゼロの場合も、チェックした情報源と範囲を明記してレポートを作成する

### このモードでは行わないこと

- `data/questions/*.json`の修正（指摘一覧の提示のみ）

## 参照資料

- `references/sources.md` — 公式情報源の参照方法（README.mdへの誘導）
- `references/quality-checklist.md` — 妥当性チェック観点の実装知識
- `references/json-schema.md` — 問題JSONのフィールド定義・命名規約
```

- [ ] **Step 2: フロントマターのYAML構文を検証する**

```bash
python3 -c "
import re
content = open('.claude/skills/question-bank-update/SKILL.md').read()
m = re.match(r'^---\n(.*?)\n---\n', content, re.DOTALL)
assert m, 'frontmatter not found'
import yaml
data = yaml.safe_load(m.group(1))
assert 'name' in data and 'description' in data
assert data['name'] == 'question-bank-update'
print('OK:', data['name'])
"
```

Expected: `OK: question-bank-update` と出力される。`pyyaml`が無い環境では
`python3 -c "import yaml"`が失敗するので、その場合はフロントマターの
`---`で囲まれた範囲を目視で確認する代替手段を取る。

- [ ] **Step 3: references/への相互参照パスが正しいことを確認する**

```bash
ls .claude/skills/question-bank-update/references/
```

Expected: `json-schema.md`, `sources.md`, `quality-checklist.md`の3ファイルが
表示される。SKILL.md内の`references/`への言及がこれらのファイル名と一致していることを
目視確認する。

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/question-bank-update/SKILL.md
git commit -m "$(cat <<'EOF'
feat: 問題集アップデートスキルのSKILL.mdを追加

新規問題の追加(add)・既存問題の監査(audit)・陳腐化検出(stale)の3モードを
持つ question-bank-update スキルのエントリーポイントを追加。
サブエージェントへの領域単位並列委譲とユーザー承認ゲートを軸に構成。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

## Task 5: スキルの動作確認（`audit`モードをbasic-operationsのみで試験実行）

**Files:**
- Modify: なし（動作確認のみ、既存ファイルは変更しない）
- Read: `.claude/skills/question-bank-update/SKILL.md`, `data/questions/basic-operations.json`

**Interfaces:**
- Consumes: Task 1-4で作成した4ファイル全て
- Produces: なし（このタスクはコード成果物を生成しない。スキルが実際に機能することの確認が目的）

- [ ] **Step 1: `Skill`ツールで`question-bank-update`を`audit`モード・`basic-operations`領域限定で呼び出す**

`Skill(question-bank-update, args="audit domain=basic-operations")`を実行する。

- [ ] **Step 2: サブエージェントが1つだけ起動され、`basic-operations.json`のみを検査対象にしていることを確認する**

Expected: 5並列ではなく1エージェントのみが起動する（対象領域を1つに絞ったため）。
起動されたエージェントへの指示に`references/quality-checklist.md`の観点
（構造の妥当性・出題の偏り・重複出題・読解チェック・事実照合）が含まれていることを確認する。

- [ ] **Step 3: レポートが`docs/superpowers/reports/`配下に保存されることを確認する**

```bash
ls docs/superpowers/reports/ 2>/dev/null | grep question-audit
```

Expected: `YYYY-MM-DD-question-audit.md`（実行日の日付）というファイルが存在する。
存在しない場合は、SKILL.mdの`audit`モード手順の「保存し、gitにコミットする」ステップが
サブエージェントの指示に正しく反映されているか確認し、SKILL.mdを修正する。

- [ ] **Step 4: レポートの内容が深刻度別に分類され、根拠が付いていることを確認する**

生成されたレポートファイルを読み、各指摘（あれば）に深刻度（要修正/検討推奨/参考情報）・
何が問題か・根拠が含まれているか目視確認する。指摘ゼロの場合は、検査範囲が
明記されていることを確認する。

- [ ] **Step 5: JSONファイルが変更されていないことを確認する**

```bash
git status --short data/questions/
```

Expected: 何も出力されない（`audit`モードはJSONを変更しないため）。

- [ ] **Step 6: 動作確認で見つかった問題をSKILL.md・referencesに反映し、Commit**

Step 2-5で挙動のずれが見つかった場合は該当ファイルを修正する。
問題なければ、確認結果として生成されたレポートファイルをコミットする
（動作確認の副産物だが、実際の監査結果として有効なため残す）。

```bash
git add docs/superpowers/reports/
git status
```

生成物があれば以下でコミットする。生成物がない場合（レポートが既にコミット済み等）は
このステップをスキップする。

```bash
git commit -m "$(cat <<'EOF'
docs: question-bank-updateスキルの動作確認レポートを追加

audit モードを basic-operations 領域限定で試験実行した際の
監査レポート。スキルの動作確認を兼ねる。

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## 完了条件

- `.claude/skills/question-bank-update/SKILL.md`と`references/`配下3ファイルが存在する
- `Skill(question-bank-update, args="audit domain=basic-operations")`で実際にサブエージェントが
  起動し、監査レポートが`docs/superpowers/reports/`配下に生成される
- 監査レポートが深刻度別に分類され、各指摘に根拠が付いている
- `audit`モード実行後も`data/questions/*.json`が変更されていない
- 情報源リストがSKILL.md・references/のどこにも複製されておらず、README.mdへの参照のみで完結している
