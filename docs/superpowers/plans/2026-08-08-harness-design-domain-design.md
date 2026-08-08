# 新領域「ハーネス設計」追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Codeステップアップ問題集に第7領域「ハーネス設計」を追加し、CLAUDE.mdの設計判断・スキル/ルール/エージェントの使い分け・複数機構を組み合わせた統合アーキテクチャ・公式が推奨する設計原則を4レベル×15問前後（計60問目安）で学べるようにする。

**Architecture:** 既存の6領域と同じ構造で `data/questions/harness-design.json` を新規作成するだけで、`js/quiz-modes.js` の動的fetch・`js/quiz-engine.js` の出題ロジック・`tests/question-data.test.js` の検証はすべて自動的に対応する。手を入れるのは `js/progress.js`（`DOMAINS`/`DOMAIN_LABELS`への1行追加ずつ）、`js/report-content.js`（`SUGGESTIONS`への1エントリ追加）、`README.md`（領域数・プレフィックス規約の更新）のみ。

**Tech Stack:** Vanilla JS (ESM)、`node --test`によるユニットテスト。ビルド不要。

## Global Constraints

- ドメイン名: `harness-design`、`domainLabel`: `"ハーネス設計"`、IDプレフィックス: `harness-`
- 対象: CLAUDE.mdの設計判断（何を書く/書かない、階層設計）、スキル・ルール・エージェントの使い分け基準、複数機構を組み合わせた統合アーキテクチャ、公式が推奨するハーネス設計パターン
- 対象外: 個々の機能の基本的な使い方（既存領域でカバー済み）、スキル作成の実装細部（SKILL.mdの逐語的な書き方など）
- 既存領域（`prompt-design`のCLAUDE.md・スキル関連問題、`security-permissions`の権限設定問題、`feature-usage`のエージェント基本問題、`slash-commands`のCLAUDE.md生成コマンド問題等）は削除・移動しない。テーマ重複は許容する
- 各レベル（`beginner`/`intermediate`/`advanced`/`expert`）最低10問、目安15問前後、計60問前後
- 出題形式は単一選択式4択のまま
- `explanation`はClaude Code Docs（`code.claude.com/docs`）およびAnthropic Engineering Blogの記述に基づく内容とし、実在する仕様・推奨事項を個別に確認してから作成する。存在しない機能や推測に基づく仕様を出題しない
- 問題作成時の妥当性チェック観点（README.mdより）を満たす:
  - 正解の選択肢だけが極端に長い/短いことを避ける
  - `correctIndex`が0〜3のいずれかに偏らないよう、領域内でおおむね均等にする
  - 誤答選択肢に「一切できない」「存在しない」「絶対に」等の極端な断定表現を多用しない
- JSON構造は既存ドメインファイル（例: `data/questions/slash-commands.json`）と同一: `{ "domain": "...", "domainLabel": "...", "questions": [{ "id", "level", "question", "choices", "correctIndex", "explanation" }] }`

---

## Task 1: 初級レベルのリサーチと問題作成（harness-design.json 新規作成、beginner）

**Files:**
- Create: `data/questions/harness-design.json`

**Interfaces:**
- Consumes: なし
- Produces: `data/questions/harness-design.json`。トップレベル構造 `{ "domain": "harness-design", "domainLabel": "ハーネス設計", "questions": [...] }`。このタスクでは `level: "beginner"` の問題を15問（`harness-001`〜`harness-015`）作成する。後続タスクは同じファイルの`questions`配列に追記していく。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する:
- `https://code.claude.com/docs/en/memory`（CLAUDE.md/メモリ機能）— CLAUDE.mdとは何か、どこに配置されるか、何のために使うか
- `https://code.claude.com/docs/en/skills` — スキルとは何か、基本的な役割
- `https://code.claude.com/docs/en/sub-agents` — サブエージェントとは何か、基本的な役割
- `https://code.claude.com/docs/en/settings` および permissions関連ページ — ルール（permissions/settings.json）とは何か、基本的な役割

初級レベルで扱う候補（実在を個別に確認すること。存在しないものは使わない）:
- CLAUDE.mdの基本的な役割（プロジェクトメモリ、起動時に自動読み込みされること）
- スキル・ルール・エージェントそれぞれの一言でいう違い（スキル=手順書、ルール=許可/拒否の設定、エージェント=別コンテキストで動く分身）
- どの機構をいつ使うかの大まかな判断（例: 「毎回同じ手順を踏む」→スキル、「特定コマンドを禁止したい」→ルール）
- CLAUDE.mdの配置場所の基本（プロジェクトルート、ユーザーホーム等）

- [ ] **Step 2: `data/questions/harness-design.json`を新規作成し、beginnerレベル15問を書く**

ファイル全体をこの構造で作成する（`questions`配列には`harness-001`〜`harness-015`の15問を入れる。各問題は実データとして具体的な`question`/`choices`/`correctIndex`/`explanation`を書くこと。以下は形式のみを示すスケルトンであり、実際の文面はStep 1のリサーチ結果に基づいて作成する）:

```json
{
  "domain": "harness-design",
  "domainLabel": "ハーネス設計",
  "questions": [
    {
      "id": "harness-001",
      "level": "beginner",
      "question": "（例）Claude Codeがセッション開始時に自動的に読み込み、プロジェクト固有の指示や規約を伝えるためのファイルはどれですか？",
      "choices": ["settings.json", "CLAUDE.md", "SKILL.md", ".claudeignore"],
      "correctIndex": 1,
      "explanation": "（公式ドキュメントの記述に基づく解説）"
    }
  ]
}
```

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/harness-design.json')); print(len(d['questions']), 'questions')"`
Expected: `15 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/harness-design.json'))
from collections import Counter
c = Counter(q['correctIndex'] for q in d['questions'])
print('correctIndex distribution:', dict(c))
ids = [q['id'] for q in d['questions']]
print('unique ids:', len(ids) == len(set(ids)))
"
```
Expected: `correctIndex`の分布が0〜3のいずれかに極端に偏っていない（15問中、各値がおおむね2〜6件程度）。`unique ids: True`

偏りが大きい場合はStep 2に戻り、選択肢の順序を調整する。

- [ ] **Step 5: Commit**

```bash
git add data/questions/harness-design.json
git commit -m "feat: ハーネス設計領域を新規作成し初級15問を追加"
```

---

## Task 2: 中級レベルの問題作成（harness-design.json、intermediate）

**Files:**
- Modify: `data/questions/harness-design.json`

**Interfaces:**
- Consumes: Task 1で作成された`data/questions/harness-design.json`（`questions`配列に`harness-001`〜`harness-015`のbeginner問題が存在する）
- Produces: 同ファイルの`questions`配列に`level: "intermediate"`の問題15問（`harness-016`〜`harness-030`）を追記する

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで`https://code.claude.com/docs/en/memory`、`https://code.claude.com/docs/en/skills`、`https://code.claude.com/docs/en/settings`、`https://code.claude.com/docs/en/sub-agents`を確認する。中級レベルで扱う候補（実在を個別に確認すること）:
- CLAUDE.mdの粒度設計の基本（何を書くべきか/書くべきでないか、長すぎるCLAUDE.mdの弊害）
- スキル作成の判断基準（頻繁に繰り返す手順、明示的に文書化する価値がある手順）
- permissions（ルール）とスキル/エージェントの使い分け（許可制御はルール、手順の自動化はスキル、独立したコンテキストでの並行作業はエージェント）
- 階層的なCLAUDE.md配置の基本（プロジェクトルート、サブディレクトリ、ユーザーグローバルの優先順位・併用のされ方）

- [ ] **Step 2: `questions`配列に`harness-016`〜`harness-030`（intermediate、15問）を追記する**

既存のJSON構造を保ったまま、`questions`配列の末尾（beginner問題の後）に15問を追記する。IDは`harness-016`から連番。

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/harness-design.json')); print(len(d['questions']), 'questions')"`
Expected: `30 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/harness-design.json'))
from collections import Counter
inter = [q for q in d['questions'] if q['level'] == 'intermediate']
c = Counter(q['correctIndex'] for q in inter)
print('intermediate count:', len(inter))
print('correctIndex distribution:', dict(c))
ids = [q['id'] for q in d['questions']]
print('unique ids:', len(ids) == len(set(ids)))
"
```
Expected: `intermediate count: 15`、`correctIndex`分布に極端な偏りがない、`unique ids: True`

- [ ] **Step 5: Commit**

```bash
git add data/questions/harness-design.json
git commit -m "feat: ハーネス設計領域に中級15問を追加"
```

---

## Task 3: 上級レベルの問題作成（harness-design.json、advanced）

**Files:**
- Modify: `data/questions/harness-design.json`

**Interfaces:**
- Consumes: Task 2までで`harness-001`〜`harness-030`が存在する`data/questions/harness-design.json`
- Produces: 同ファイルの`questions`配列に`level: "advanced"`の問題15問（`harness-031`〜`harness-045`）を追記する

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで`https://code.claude.com/docs/en/memory`、`https://code.claude.com/docs/en/skills`、`https://code.claude.com/docs/en/settings`、`https://code.claude.com/docs/en/sub-agents`、`https://code.claude.com/docs/en/enterprise`（該当ページがあれば）を確認する。上級レベルで扱う候補（実在を個別に確認すること）:
- 複数機構を組み合わせた設計（例: ルールで危険な操作の権限を絞りつつ、スキルで安全な手順を文書化する組み合わせ設計）
- エンタープライズ/チーム運用でのCLAUDE.md・settings.json階層設計（組織レベル・プロジェクトレベル・個人レベルの設定の重ね合わせ、管理者による強制設定の有無）
- サブエージェント設計の判断基準（いつメインの会話から切り出すべきか。独立したコンテキストが必要なタスク、並列化可能なタスク等）

- [ ] **Step 2: `questions`配列に`harness-031`〜`harness-045`（advanced、15問）を追記する**

既存のJSON構造を保ったまま、`questions`配列の末尾に15問を追記する。IDは`harness-031`から連番。

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/harness-design.json')); print(len(d['questions']), 'questions')"`
Expected: `45 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/harness-design.json'))
from collections import Counter
adv = [q for q in d['questions'] if q['level'] == 'advanced']
c = Counter(q['correctIndex'] for q in adv)
print('advanced count:', len(adv))
print('correctIndex distribution:', dict(c))
ids = [q['id'] for q in d['questions']]
print('unique ids:', len(ids) == len(set(ids)))
"
```
Expected: `advanced count: 15`、`correctIndex`分布に極端な偏りがない、`unique ids: True`

- [ ] **Step 5: Commit**

```bash
git add data/questions/harness-design.json
git commit -m "feat: ハーネス設計領域に上級15問を追加"
```

---

## Task 4: エキスパートレベルの問題作成（harness-design.json、expert）

**Files:**
- Modify: `data/questions/harness-design.json`

**Interfaces:**
- Consumes: Task 3までで`harness-001`〜`harness-045`が存在する`data/questions/harness-design.json`
- Produces: 同ファイルの`questions`配列に`level: "expert"`の問題15問（`harness-046`〜`harness-060`）を追記する。これでファイルが完成し計60問になる

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する:
- `https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents` — context engineeringの定義、attention budgetとcontext rot、just-in-time取得、structured note-taking、right altitudeの概念
- `https://www.anthropic.com/engineering/claude-code-sandboxing` — 承認疲れ（approval fatigue）、ファイルシステム/ネットワーク分離とハーネス設計の関係
- `https://www.anthropic.com/engineering/claude-code-auto-mode` — auto modeの二層防御とハーネス設計への含意
- `https://www.anthropic.com/engineering/building-effective-agents` — エージェント設計パターン（ワークフロー vs エージェント、シンプルさを保つ原則）
- `https://code.claude.com/docs/en/enterprise` および企業向け設定関連ページ（該当があれば）— 大規模組織でのハーネス統治（governance）設計

エキスパートレベルで扱う候補（実在を個別に確認すること。推測で出題しない）:
- 公式ブログ・Docsが示す設計原則（context engineering、right altitudeなどの統合的解釈。「詳細すぎる指示」と「曖昧すぎる指示」の中間を狙う設計思想）
- 複数機構の相互作用による落とし穴（例: 過度に肥大化したCLAUDE.mdとスキルの併用によるcontext rot、権限設定とサブエージェントの権限継承の誤解）
- 大規模組織でのハーネス統治（governance）設計（組織ポリシーの強制、監査、複数チームでの一貫性確保）

- [ ] **Step 2: `questions`配列に`harness-046`〜`harness-060`（expert、15問）を追記する**

既存のJSON構造を保ったまま、`questions`配列の末尾に15問を追記する。IDは`harness-046`から連番。

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/harness-design.json')); print(len(d['questions']), 'questions')"`
Expected: `60 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する（ファイル全体）**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/harness-design.json'))
from collections import Counter
print('domain:', d['domain'], '/ domainLabel:', d['domainLabel'])
print('total:', len(d['questions']))
by_level = Counter(q['level'] for q in d['questions'])
print('by level:', dict(by_level))
c = Counter(q['correctIndex'] for q in d['questions'])
print('correctIndex distribution:', dict(c))
ids = [q['id'] for q in d['questions']]
print('unique ids:', len(ids) == len(set(ids)))
for q in d['questions']:
    assert 0 <= q['correctIndex'] < len(q['choices']), q['id']
print('all correctIndex within bounds: True')
"
```
Expected: `total: 60`、各レベル15件、`unique ids: True`、`all correctIndex within bounds: True`、`correctIndex`分布が極端に偏っていない

- [ ] **Step 5: Commit**

```bash
git add data/questions/harness-design.json
git commit -m "feat: ハーネス設計領域にエキスパート15問を追加し計60問構成を完成"
```

---

## Task 5: 全機構への配線（progress.js、report-content.js）とテスト確認

**Files:**
- Modify: `js/progress.js:3-17`
- Modify: `js/report-content.js:1-38`
- Test: `tests/question-data.test.js`（変更不要、既存テストで自動検証）
- Test: `tests/progress.test.js`、`tests/quiz-engine.test.js`、`tests/quiz-modes.test.js`、`tests/review.test.js`（変更不要、既存テストで回帰確認）

**Interfaces:**
- Consumes: Task 4までで完成した`data/questions/harness-design.json`（60問、4レベル）
- Produces: `js/progress.js`の`DOMAINS`配列に`'harness-design'`、`DOMAIN_LABELS`に`'harness-design': 'ハーネス設計'`が追加済み。`js/report-content.js`の`SUGGESTIONS`に`'harness-design'`エントリ（4レベル分のアドバイス文）が追加済み。ダッシュボード・進捗保存・レベル判定・復習モードが7領域構成で動作する

- [ ] **Step 1: `js/progress.js`の`DOMAINS`配列に`'harness-design'`を追加する**

`js/progress.js:3-9`を変更:

```javascript
export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
  'harness-design',
];
```

- [ ] **Step 2: `js/progress.js`の`DOMAIN_LABELS`に`harness-design`を追加する**

`js/progress.js:11-18`を変更:

```javascript
export const DOMAIN_LABELS = {
  'basic-operations': '基本操作・CLI使用法',
  'feature-usage': '機能活用',
  'prompt-design': 'プロンプト設計・協働作法',
  'security-permissions': '安全性・権限管理',
  'token-efficiency': 'トークン効率・コスト管理',
  'slash-commands': 'スラッシュコマンド',
  'harness-design': 'ハーネス設計',
};
```

- [ ] **Step 3: `js/report-content.js`の`SUGGESTIONS`に`harness-design`エントリを追加する**

`js/report-content.js`の`SUGGESTIONS`オブジェクト内、`'slash-commands'`エントリの後（`};`の直前）に追記:

```javascript
  'harness-design': {
    beginner: 'CLAUDE.mdの役割や、スキル・ルール・エージェントそれぞれの基本的な違いを公式ドキュメントで確認してみましょう。',
    intermediate: 'CLAUDE.mdに何を書くべきか、どんな手順をスキル化すべきかを意識しながら、実際のプロジェクトで整理してみましょう。',
    advanced: 'permissions設定とスキル・エージェントを組み合わせた設計や、階層的なCLAUDE.md配置を実際に試してみましょう。',
    expert: 'context engineeringやright altitudeなどAnthropic Engineering Blogが示す設計原則を読み、大規模なハーネス統治の設計に取り組みましょう。',
  },
```

- [ ] **Step 4: `node --test`で全テストを実行する**

Run: `node --test`
Expected: 全テストPASS。`tests/question-data.test.js`が`data/questions/harness-design.json`を自動的に走査し、`correctIndex`範囲・レベルごと最低10問・ID一意性を検証する。`tests/progress.test.js`等はドメイン数に依存しないロジック検証のため無変更でPASSする

- [ ] **Step 5: ブラウザで動作確認する**

Run: `python3 -m http.server 8000`

`http://localhost:8000/index.html`を開き、以下を確認する:
- ダッシュボードに7領域目「ハーネス設計」が表示されること
- 「ハーネス設計」初級ステージに挑戦でき、8問以上正解すると合格し中級が開放されること
- 意図的にハーネス設計領域で不正解を出した場合、結果ページに`js/report-content.js`で追加したアドバイス文が表示されること
- 復習モード（`quiz.html?mode=review`）で、ハーネス設計領域の誤答が対象に含まれること

- [ ] **Step 6: Commit**

```bash
git add js/progress.js js/report-content.js
git commit -m "feat: 新領域ハーネス設計をダッシュボード・進捗管理・改善提案に配線"
```

---

## Task 6: README.mdの更新

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: なし
- Produces: `README.md`冒頭の領域数説明が「7領域」に更新され、「対象領域は7つです」の節が更新され`harness-`プレフィックスが追記された状態

- [ ] **Step 1: 冒頭の説明文を6領域から7領域に更新する**

`README.md`の該当箇所（`# Claude Code ステップアップ問題集`直後の説明文）を変更:

変更前:
```
Claude Codeの理解を、6領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド）×4レベル（初級／中級／上級／エキスパート）の全24ステージで段階的に高めるWebアプリです。
```

変更後:
```
Claude Codeの理解を、7領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド／ハーネス設計）×4レベル（初級／中級／上級／エキスパート）の全28ステージで段階的に高めるWebアプリです。
```

- [ ] **Step 2: 「進め方」節の領域数を更新する**

変更前:
```
1. トップページのダッシュボードで、6領域 × 4レベルの進捗を確認する
```

変更後:
```
1. トップページのダッシュボードで、7領域 × 4レベルの進捗を確認する
```

- [ ] **Step 3: 「問題の追加・修正」節の対象領域リストを更新する**

変更前:
```
対象領域は6つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）、スラッシュコマンド（`slash-`）。
```

変更後:
```
対象領域は7つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）、スラッシュコマンド（`slash-`）、
ハーネス設計（`harness-`）。
```

- [ ] **Step 4: 「追加・更新の進め方の目安」節の既存領域リストを更新する**

変更前:
```
1. 上記の公式情報源で、既存6領域（基本操作／機能活用／プロンプト設計／安全性・権限管理／トークン効率／スラッシュコマンド）に対応する新機能・仕様変更がないか確認する
```

変更後:
```
1. 上記の公式情報源で、既存7領域（基本操作／機能活用／プロンプト設計／安全性・権限管理／トークン効率／スラッシュコマンド／ハーネス設計）に対応する新機能・仕様変更がないか確認する
```

- [ ] **Step 5: 変更箇所を目視確認する**

Run: `grep -n "7領域\|28ステージ\|harness-" README.md`
Expected: Step 1〜4で変更した箇所が表示される

- [ ] **Step 6: Commit**

```bash
git add README.md
git commit -m "docs: README.mdの領域数・プレフィックス規約を7領域構成に更新"
```
