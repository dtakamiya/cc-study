# 新領域「スラッシュコマンド」追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Codeステップアップ問題集に第6領域「スラッシュコマンド」を追加し、組み込みスラッシュコマンド（`/help`、`/clear`、`/compact`、`/model`など）の体系的知識を4レベル×15問前後（計60問目安）で学べるようにする。

**Architecture:** 既存の5領域と同じ構造で `data/questions/slash-commands.json` を新規作成するだけで、`js/quiz-modes.js` の動的fetch・`js/quiz-engine.js` の出題ロジック・`tests/question-data.test.js` の検証はすべて自動的に対応する。手を入れるのは `js/progress.js`（`DOMAINS`/`DOMAIN_LABELS`への1行追加ずつ）、`js/report-content.js`（`SUGGESTIONS`への1エントリ追加）、`README.md`（領域数・プレフィックス規約の更新）のみ。

**Tech Stack:** Vanilla JS (ESM)、`node --test`によるユニットテスト。ビルド不要。

## Global Constraints

- ドメイン名: `slash-commands`、`domainLabel`: `"スラッシュコマンド"`、IDプレフィックス: `slash-`
- 対象は組み込みスラッシュコマンドのみ。カスタムスラッシュコマンドの作成方法（`.claude/commands`）やSkillsは出題しない
- 各レベル（`beginner`/`intermediate`/`advanced`/`expert`）最低10問、目安15問前後、計60問前後
- 既存4領域にあるスラッシュコマンド関連問題（`basic-operations`/`feature-usage`/`prompt-design`）は削除・移動しない。テーマ重複は許容する
- 出題形式は単一選択式4択のまま
- `explanation`は公式ドキュメント（`code.claude.com/docs`のコマンドリファレンス）の記述に基づく内容とし、実在するコマンド名・引数・挙動を個別に確認してから作成する。存在しないコマンドや推測に基づく仕様を出題しない
- 問題作成時の妥当性チェック観点（README.mdより）を満たす:
  - 正解の選択肢だけが極端に長い/短いことを避ける
  - `correctIndex`が0〜3のいずれかに偏らないよう、領域内でおおよそ均等にする
  - 誤答選択肢に「一切できない」「存在しない」「絶対に」等の極端な断定表現を多用しない
- JSON構造は既存ドメインファイル（例: `data/questions/token-efficiency.json`）と同一: `{ "domain": "...", "domainLabel": "...", "questions": [{ "id", "level", "question", "choices", "correctIndex", "explanation" }] }`

---

## Task 1: 初級レベルのリサーチと問題作成（slash-commands.json 新規作成、beginner）

**Files:**
- Create: `data/questions/slash-commands.json`

**Interfaces:**
- Consumes: なし
- Produces: `data/questions/slash-commands.json`。トップレベル構造 `{ "domain": "slash-commands", "domainLabel": "スラッシュコマンド", "questions": [...] }`。このタスクでは `level: "beginner"` の問題を15問（`slash-001`〜`slash-015`）作成する。後続タスクは同じファイルの`questions`配列に追記していく。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する:
- `https://code.claude.com/docs/en/slash-commands` — 組み込みスラッシュコマンドの一覧・用途・引数
- `https://code.claude.com/docs/en/cli-reference` — CLI起動オプションとの関係（該当があれば）

初級レベルで扱う候補（実在を個別に確認すること。存在しないものは使わない）:
- `/help` — コマンド一覧・ヘルプ表示
- `/clear` — 会話履歴のリセット
- `/status` — セッション状態の表示
- `/model` — 使用モデルの切り替え
- `/`（スラッシュ入力）によるコマンドサジェスト機能の起動方法
- 最も基本的な使い分け（例: `/clear`でコンテキストをリセットする）

- [ ] **Step 2: `data/questions/slash-commands.json`を新規作成し、beginnerレベル15問を書く**

ファイル全体をこの構造で作成する（`questions`配列には`slash-001`〜`slash-015`の15問を入れる。各問題は実データとして具体的な`question`/`choices`/`correctIndex`/`explanation`を書くこと。以下は形式のみを示すスケルトンであり、実際の文面はStep 1のリサーチ結果に基づいて作成する）:

```json
{
  "domain": "slash-commands",
  "domainLabel": "スラッシュコマンド",
  "questions": [
    {
      "id": "slash-001",
      "level": "beginner",
      "question": "（例）会話履歴をリセットして次のタスクにコンテキストを持ち越さないために使うコマンドはどれですか？",
      "choices": ["/compact", "/clear", "/status", "/model"],
      "correctIndex": 1,
      "explanation": "（公式ドキュメントの記述に基づく解説）"
    }
  ]
}
```

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/slash-commands.json')); print(len(d['questions']), 'questions')"`
Expected: `15 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/slash-commands.json'))
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
git add data/questions/slash-commands.json
git commit -m "feat: スラッシュコマンド領域を新規作成し初級15問を追加"
```

---

## Task 2: 中級レベルの問題作成（slash-commands.json、intermediate）

**Files:**
- Modify: `data/questions/slash-commands.json`

**Interfaces:**
- Consumes: Task 1で作成された`data/questions/slash-commands.json`（`questions`配列に`slash-001`〜`slash-015`のbeginner問題が存在する）
- Produces: 同ファイルの`questions`配列に`level: "intermediate"`の問題15問（`slash-016`〜`slash-030`）を追記する

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで`https://code.claude.com/docs/en/slash-commands`および関連ページを確認する。中級レベルで扱う候補（実在を個別に確認すること）:
- セッション管理系: `/resume`、`/rewind`
- コンテキスト確認系: `/context`、`/cost`、`/usage` — それぞれの違い（表示内容、対話的/非対話的な扱いの差）
- `/compact`と`/clear`の使い分けの基準（`/compact`は要約して圧縮、`/clear`は完全リセット、等の具体的な違い）

- [ ] **Step 2: `questions`配列に`slash-016`〜`slash-030`（intermediate、15問）を追記する**

既存のJSON構造を保ったまま、`questions`配列の末尾（beginner問題の後）に15問を追記する。IDは`slash-016`から連番。

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/slash-commands.json')); print(len(d['questions']), 'questions')"`
Expected: `30 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/slash-commands.json'))
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
git add data/questions/slash-commands.json
git commit -m "feat: スラッシュコマンド領域に中級15問を追加"
```

---

## Task 3: 上級レベルの問題作成（slash-commands.json、advanced）

**Files:**
- Modify: `data/questions/slash-commands.json`

**Interfaces:**
- Consumes: Task 2までで`slash-001`〜`slash-030`が存在する`data/questions/slash-commands.json`
- Produces: 同ファイルの`questions`配列に`level: "advanced"`の問題15問（`slash-031`〜`slash-045`）を追記する

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで`https://code.claude.com/docs/en/slash-commands`および関連ページ（permissions、config、subagents、MCP関連ドキュメント）を確認する。上級レベルで扱う候補（実在を個別に確認すること）:
- 設定系コマンドの詳細: `/permissions`、`/config`
- サブシステム管理コマンド: `/agents`、`/mcp`
- コマンドの引数・オプションの仕様（存在する場合。例: 引数を取るコマンドの具体的な構文）

- [ ] **Step 2: `questions`配列に`slash-031`〜`slash-045`（advanced、15問）を追記する**

既存のJSON構造を保ったまま、`questions`配列の末尾に15問を追記する。IDは`slash-031`から連番。

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/slash-commands.json')); print(len(d['questions']), 'questions')"`
Expected: `45 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/slash-commands.json'))
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
git add data/questions/slash-commands.json
git commit -m "feat: スラッシュコマンド領域に上級15問を追加"
```

---

## Task 4: エキスパートレベルの問題作成（slash-commands.json、expert）

**Files:**
- Modify: `data/questions/slash-commands.json`

**Interfaces:**
- Consumes: Task 3までで`slash-001`〜`slash-045`が存在する`data/questions/slash-commands.json`
- Produces: 同ファイルの`questions`配列に`level: "expert"`の問題15問（`slash-046`〜`slash-060`）を追記する。これでファイルが完成し計60問になる

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで`https://code.claude.com/docs/en/slash-commands`、非対話モード（`https://code.claude.com/docs/en/headless` 等該当ページ）、CLI変更履歴・リリースノートを確認する。エキスパートレベルで扱う候補（実在を個別に確認すること）:
- 非対話モード・スクリプト実行下でのスラッシュコマンドの扱い（`-p`実行時にスラッシュコマンドがどう扱われるか等）
- 複数コマンドの組み合わせによる運用
- あまり知られていない・見落とされがちなコマンドの仕様
- バージョンアップに伴う変更点（該当する一次情報がある場合のみ。推測で出題しない）

- [ ] **Step 2: `questions`配列に`slash-046`〜`slash-060`（expert、15問）を追記する**

既存のJSON構造を保ったまま、`questions`配列の末尾に15問を追記する。IDは`slash-046`から連番。

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; d = json.load(open('data/questions/slash-commands.json')); print(len(d['questions']), 'questions')"`
Expected: `60 questions`

- [ ] **Step 4: 妥当性チェック観点を確認する（ファイル全体）**

Run:
```bash
python3 -c "
import json
d = json.load(open('data/questions/slash-commands.json'))
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
git add data/questions/slash-commands.json
git commit -m "feat: スラッシュコマンド領域にエキスパート15問を追加し計60問構成を完成"
```

---

## Task 5: 全機構への配線（progress.js、report-content.js）とテスト確認

**Files:**
- Modify: `js/progress.js:3-17`
- Modify: `js/report-content.js:1-32`
- Test: `tests/question-data.test.js`（変更不要、既存テストで自動検証）
- Test: `tests/progress.test.js`、`tests/quiz-engine.test.js`、`tests/quiz-modes.test.js`、`tests/review.test.js`（変更不要、既存テストで回帰確認）

**Interfaces:**
- Consumes: Task 4までで完成した`data/questions/slash-commands.json`（60問、4レベル）
- Produces: `js/progress.js`の`DOMAINS`配列に`'slash-commands'`、`DOMAIN_LABELS`に`'slash-commands': 'スラッシュコマンド'`が追加済み。`js/report-content.js`の`SUGGESTIONS`に`'slash-commands'`エントリ（4レベル分のアドバイス文）が追加済み。ダッシュボード・進捗保存・レベル判定・復習モードが6領域構成で動作する

- [ ] **Step 1: `js/progress.js`の`DOMAINS`配列に`'slash-commands'`を追加する**

`js/progress.js:3-9`を変更:

```javascript
export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
];
```

- [ ] **Step 2: `js/progress.js`の`DOMAIN_LABELS`に`slash-commands`を追加する**

`js/progress.js:11-17`を変更:

```javascript
export const DOMAIN_LABELS = {
  'basic-operations': '基本操作・CLI使用法',
  'feature-usage': '機能活用',
  'prompt-design': 'プロンプト設計・協働作法',
  'security-permissions': '安全性・権限管理',
  'token-efficiency': 'トークン効率・コスト管理',
  'slash-commands': 'スラッシュコマンド',
};
```

- [ ] **Step 3: `js/report-content.js`の`SUGGESTIONS`に`slash-commands`エントリを追加する**

`js/report-content.js`の`SUGGESTIONS`オブジェクト内、`'token-efficiency'`エントリの後（`};`の直前）に追記:

```javascript
  'slash-commands': {
    beginner: 'まずは`/help`でコマンド一覧を確認し、`/clear`や`/status`など基本コマンドを実際に打って挙動を確かめてみましょう。',
    intermediate: '`/compact`と`/clear`の違い、`/resume`や`/context`など似た用途のコマンドの使い分けを整理してみましょう。',
    advanced: '`/permissions`や`/agents`、`/mcp`など設定・サブシステム管理系のコマンドを実際に操作し、引数の指定方法まで確認してみましょう。',
    expert: '非対話モードでのコマンドの扱いや、あまり使われないコマンドの仕様まで公式ドキュメントで確認し、運用の幅を広げましょう。',
  },
```

- [ ] **Step 4: `node --test`で全テストを実行する**

Run: `node --test`
Expected: 全テストPASS。`tests/question-data.test.js`が`data/questions/slash-commands.json`を自動的に走査し、`correctIndex`範囲・レベルごと最低10問・ID一意性を検証する。`tests/progress.test.js`等はドメイン数に依存しないロジック検証のため無変更でPASSする

- [ ] **Step 5: ブラウザで動作確認する**

Run: `python3 -m http.server 8000`

`http://localhost:8000/index.html`を開き、以下を確認する:
- ダッシュボードに6領域目「スラッシュコマンド」が表示されること
- 「スラッシュコマンド」初級ステージに挑戦でき、8問以上正解すると合格し中級が開放されること
- 意図的にスラッシュコマンド領域で不正解を出した場合、結果ページに`js/report-content.js`で追加したアドバイス文が表示されること
- 復習モード（`quiz.html?mode=review`）で、スラッシュコマンド領域の誤答が対象に含まれること

- [ ] **Step 6: Commit**

```bash
git add js/progress.js js/report-content.js
git commit -m "feat: 新領域スラッシュコマンドをダッシュボード・進捗管理・改善提案に配線"
```

---

## Task 6: README.mdの更新

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: なし
- Produces: `README.md`冒頭の領域数説明が「6領域」に更新され、「対象領域は5つです」の節が6つに更新され`slash-`プレフィックスが追記された状態

- [ ] **Step 1: 冒頭の説明文を5領域から6領域に更新する**

`README.md`の該当箇所（`# Claude Code ステップアップ問題集`直後の説明文）を変更:

変更前:
```
Claude Codeの理解を、5領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理）×4レベル（初級／中級／上級／エキスパート）の全20ステージで段階的に高めるWebアプリです。
```

変更後:
```
Claude Codeの理解を、6領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド）×4レベル（初級／中級／上級／エキスパート）の全24ステージで段階的に高めるWebアプリです。
```

- [ ] **Step 2: 「進め方」節の領域数を更新する**

変更前:
```
1. トップページのダッシュボードで、5領域 × 4レベルの進捗を確認する
```

変更後:
```
1. トップページのダッシュボードで、6領域 × 4レベルの進捗を確認する
```

- [ ] **Step 3: 「問題の追加・修正」節の対象領域リストを更新する**

変更前:
```
対象領域は5つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）。
```

変更後:
```
対象領域は6つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）、スラッシュコマンド（`slash-`）。
```

- [ ] **Step 4: 変更箇所を目視確認する**

Run: `grep -n "6領域\|24ステージ\|slash-" README.md`
Expected: Step 1〜3で変更した3箇所が表示される

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: README.mdの領域数・プレフィックス規約を6領域構成に更新"
```
