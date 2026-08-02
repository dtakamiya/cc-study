# 問題集の拡充・最新化と復習機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Code理解度診断アプリの問題集を精度向上・拡充し、新領域「トークン効率・コスト管理」を追加、さらに結果ページに間違えた問題の正解・解説を表示する復習機能を実装する。

**Architecture:** 静的サイト（Vanilla JS, ビルドツールなし）のまま、`data/questions/*.json`に新規ドメインファイルを1つ追加し既存4ファイルを拡充する。`js/quiz-page.js`で不正解問題の詳細を抽出し`js/storage.js`経由でlocalStorageに保存、`js/result-page.js`で表示する。

**Tech Stack:** Vanilla JS (ESM), HTML/CSS, `node --test`によるユニットテスト。ビルド不要。

## Global Constraints

- 出題形式は単一選択式4択のまま変更しない
- サーバーサイド処理・チーム集計機能は追加しない（個人完結・localStorageのみ）
- 各問題の`id`はドメイン間で一意（プレフィックス規約: `basic-`/`feature-`/`prompt-`/`security-`/`token-`）
- 各領域は4レベル（`beginner`/`intermediate`/`advanced`/`expert`）×10問=40問を目標とする
- 1回の診断で抽選する問題数（`COUNT_PER_LEVEL = { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }`）は変更しない
- 問題データの`explanation`は公式ドキュメント（`code.claude.com/docs/en/*`、`platform.claude.com/docs/en/*`）の記述に基づく内容とする
- 新規追加分・書き換え分の問題は、実装者が該当する公式ドキュメントページをWebSearch/WebFetchで確認してから作成する

---

## Task 1: 間違えた問題抽出ロジック（quiz-engine.js）

**Files:**
- Modify: `js/quiz-engine.js`
- Test: `tests/quiz-engine.test.js`

**Interfaces:**
- Consumes: なし（既存の`quiz`配列形式・`answers`オブジェクト形式をそのまま使う）
- Produces: `collectWrongAnswers(quiz, answers)` — `quiz`（`buildQuiz`の返り値の形式、各エントリは`{ domain, domainLabel, questions: [{ id, level, question, choices, correctIndex, explanation }] }`）と`answers`（`{ [questionId]: selectedIndex }`）を受け取り、不正解だった問題の配列を返す。各要素は`{ questionId, domainLabel, question, choices, selectedIndex, correctIndex, explanation }`。`selectedIndex`は未回答の場合`null`。順序は`quiz`の出題順（ドメイン順→問題順）を維持する。

- [ ] **Step 1: Write the failing test**

`tests/quiz-engine.test.js`の末尾に追記:

```javascript
test('collectWrongAnswers returns only incorrect answers with full detail, in quiz order', () => {
  const quiz = [
    {
      domain: 'basic-operations',
      domainLabel: '基本操作・CLI使用法',
      questions: [
        { id: 'q1', level: 'beginner', question: 'Q1?', choices: ['a', 'b'], correctIndex: 0, explanation: 'exp1' },
        { id: 'q2', level: 'beginner', question: 'Q2?', choices: ['a', 'b'], correctIndex: 1, explanation: 'exp2' },
      ]
    },
    {
      domain: 'feature-usage',
      domainLabel: '機能活用',
      questions: [
        { id: 'q3', level: 'beginner', question: 'Q3?', choices: ['a', 'b'], correctIndex: 0, explanation: 'exp3' },
      ]
    }
  ];
  // q1: correct (0 === 0), q2: wrong (0 !== 1), q3: unanswered
  const answers = { q1: 0, q2: 0 };

  const result = collectWrongAnswers(quiz, answers);

  assert.deepEqual(result, [
    {
      questionId: 'q2',
      domainLabel: '基本操作・CLI使用法',
      question: 'Q2?',
      choices: ['a', 'b'],
      selectedIndex: 0,
      correctIndex: 1,
      explanation: 'exp2',
    },
    {
      questionId: 'q3',
      domainLabel: '機能活用',
      question: 'Q3?',
      choices: ['a', 'b'],
      selectedIndex: null,
      correctIndex: 0,
      explanation: 'exp3',
    },
  ]);
});

test('collectWrongAnswers returns empty array when all answers are correct', () => {
  const quiz = [
    {
      domain: 'basic-operations',
      domainLabel: '基本操作・CLI使用法',
      questions: [
        { id: 'q1', level: 'beginner', question: 'Q1?', choices: ['a', 'b'], correctIndex: 0, explanation: 'exp1' },
      ]
    }
  ];
  const answers = { q1: 0 };

  const result = collectWrongAnswers(quiz, answers);

  assert.deepEqual(result, []);
});
```

このテストが`js/quiz-engine.js`から`collectWrongAnswers`をインポートすることになるので、ファイル先頭のimport文を更新する:

```javascript
import { selectQuestions, buildQuiz, gradeAnswers, collectWrongAnswers } from '../js/quiz-engine.js';
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/quiz-engine.test.js`
Expected: FAIL — `collectWrongAnswers is not a function` または `is not defined`

- [ ] **Step 3: Write minimal implementation**

`js/quiz-engine.js`の末尾に追記:

```javascript
export function collectWrongAnswers(quiz, answers) {
  const wrong = [];
  for (const entry of quiz) {
    for (const question of entry.questions) {
      const selectedIndex = Object.prototype.hasOwnProperty.call(answers, question.id)
        ? answers[question.id]
        : null;
      if (selectedIndex !== question.correctIndex) {
        wrong.push({
          questionId: question.id,
          domainLabel: entry.domainLabel,
          question: question.question,
          choices: question.choices,
          selectedIndex,
          correctIndex: question.correctIndex,
          explanation: question.explanation,
        });
      }
    }
  }
  return wrong;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/quiz-engine.test.js`
Expected: PASS（全テスト）

- [ ] **Step 5: Commit**

```bash
git add js/quiz-engine.js tests/quiz-engine.test.js
git commit -m "feat: 不正解問題の詳細を抽出するcollectWrongAnswersを追加"
```

---

## Task 2: quiz-page.jsでwrongAnswersを結果に含めて保存

**Files:**
- Modify: `js/quiz-page.js:99-129` (finishQuiz関数)

**Interfaces:**
- Consumes: `collectWrongAnswers(quiz, answers)` from Task 1（`js/quiz-engine.js`からimport）
- Produces: `resultObject`に`wrongAnswers`フィールドを追加した状態で`saveResult`/`saveFallbackResult`に渡す。この構造をTask 4（result-page.js）が読み取る。

このタスクはブラウザ経由の手動確認が中心となる（`quiz-page.js`はDOM操作を含みnode --testでは検証できないため）。

- [ ] **Step 1: import文にcollectWrongAnswersを追加**

`js/quiz-page.js:1`を変更:

```javascript
import { buildQuiz, gradeAnswers, collectWrongAnswers } from './quiz-engine.js';
```

- [ ] **Step 2: finishQuiz内でwrongAnswersを組み立ててresultObjectに含める**

`js/quiz-page.js:99-119`の`finishQuiz`関数を変更:

```javascript
  function finishQuiz() {
    const gradeResult = gradeAnswers(quiz, answers);
    const judged = judgeAllLevels(gradeResult);
    const wrongAnswers = collectWrongAnswers(quiz, answers);

    const domains = {};
    for (const entry of quiz) {
      const domainJudged = judged.domains[entry.domain];
      domains[entry.domain] = {
        domainLabel: entry.domainLabel,
        level: domainJudged.level,
        correct: domainJudged.correct,
        total: domainJudged.total,
        accuracy: domainJudged.accuracy,
      };
    }

    const resultObject = {
      domains,
      overall: judged.overall,
      completedAt: new Date().toISOString(),
      wrongAnswers,
    };
```

（以降の`saveResult`呼び出し以下は変更なし）

- [ ] **Step 3: 既存のnode --testを一通り実行し、他のテストを壊していないことを確認**

Run: `node --test`
Expected: 既存の全テストがPASS（`quiz-page.js`自体はテスト対象外だが、`quiz-engine.js`のimportに影響がないことを確認する）

- [ ] **Step 4: ブラウザで動作確認**

Run: `python3 -m http.server 8000`（プロジェクトルートで実行）
`http://localhost:8000/index.html`を開き、診断を最後まで完了させる。ブラウザの開発者ツールでlocalStorageの`cc-diagnosis-result`キーを確認し、`wrongAnswers`配列が存在し、意図的に間違えた問題の`questionId`・`selectedIndex`・`correctIndex`が正しく入っていることを確認する。

- [ ] **Step 5: Commit**

```bash
git add js/quiz-page.js
git commit -m "feat: 診断結果に不正解問題の詳細(wrongAnswers)を含めて保存"
```

---

## Task 3: result-page.jsとresult.html/style.cssで間違えた問題を表示

**Files:**
- Modify: `result.html:30-34`
- Modify: `js/result-page.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `result.wrongAnswers`（Task 2で保存された配列。旧形式データでは`undefined`になりうる）
- Produces: なし（末端のUI描画）

- [ ] **Step 1: result.htmlに「間違えた問題」セクションのコンテナを追加**

`result.html:31-34`の改善提案カードの直後（アクションボタンの前）に新しいカードを挿入:

```html
      <div class="card">
        <h2>改善提案</h2>
        <div id="suggestions"></div>
      </div>

      <div class="card">
        <h2>間違えた問題</h2>
        <div id="wrong-answers"></div>
      </div>

      <div class="actions no-print">
```

- [ ] **Step 2: js/result-page.jsに間違えた問題の描画ロジックを追加**

`js/result-page.js:82`（`suggestions`のループの後、`print-button`のイベント登録の前）に追記:

```javascript
  const wrongAnswersEl = document.getElementById('wrong-answers');
  const wrongAnswers = result.wrongAnswers;

  if (!Array.isArray(wrongAnswers)) {
    const notice = document.createElement('p');
    notice.className = 'progress';
    notice.textContent = 'この結果には間違えた問題の詳細データがありません（古い診断結果です）。';
    wrongAnswersEl.appendChild(notice);
  } else if (wrongAnswers.length === 0) {
    const allCorrect = document.createElement('p');
    allCorrect.textContent = '全問正解でした！';
    wrongAnswersEl.appendChild(allCorrect);
  } else {
    for (const item of wrongAnswers) {
      const entry = document.createElement('div');
      entry.className = 'wrong-answer-item';

      const domainLabel = document.createElement('p');
      domainLabel.className = 'wrong-answer-domain';
      domainLabel.textContent = item.domainLabel;
      entry.appendChild(domainLabel);

      const questionText = document.createElement('p');
      questionText.className = 'wrong-answer-question';
      questionText.textContent = item.question;
      entry.appendChild(questionText);

      const choiceList = document.createElement('ul');
      choiceList.className = 'wrong-answer-choices';
      item.choices.forEach((choiceText, index) => {
        const li = document.createElement('li');
        li.textContent = choiceText;
        if (index === item.correctIndex) {
          li.classList.add('correct-choice');
        }
        if (index === item.selectedIndex && index !== item.correctIndex) {
          li.classList.add('selected-wrong-choice');
        }
        choiceList.appendChild(li);
      });
      entry.appendChild(choiceList);

      const explanation = document.createElement('p');
      explanation.className = 'wrong-answer-explanation';
      explanation.textContent = item.explanation;
      entry.appendChild(explanation);

      wrongAnswersEl.appendChild(entry);
    }
  }

```

- [ ] **Step 3: css/style.cssに間違えた問題セクションのスタイルを追加**

`css/style.css:143`（`@media print`ブロックの直前）に追記:

```css
.wrong-answer-item {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.wrong-answer-domain {
  font-size: 0.85rem;
  color: #57606a;
  margin: 0 0 0.25rem;
}

.wrong-answer-question {
  font-weight: bold;
  margin: 0 0 0.75rem;
}

.wrong-answer-choices {
  list-style: none;
  padding: 0;
  margin: 0 0 0.75rem;
}

.wrong-answer-choices li {
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin-bottom: 0.4rem;
}

.wrong-answer-choices li.correct-choice {
  border-color: #16a34a;
  background: #f0fdf4;
  font-weight: bold;
}

.wrong-answer-choices li.selected-wrong-choice {
  border-color: #dc2626;
  background: #fef2f2;
  text-decoration: line-through;
}

.wrong-answer-explanation {
  font-size: 0.9rem;
  color: var(--color-text);
  margin: 0;
}
```

そして既存の`@media print`ブロック内（`css/style.css`の末尾）に、カードが改ページで途中で分断されにくいよう追記:

```css
@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: #fff;
  }
  .card {
    border: none;
    box-shadow: none;
  }
  .wrong-answer-item {
    break-inside: avoid;
  }
}
```

- [ ] **Step 4: ブラウザで動作確認**

Run: `python3 -m http.server 8000`
1. 一部不正解にして診断を完了し、結果ページで「間違えた問題」セクションに問題文・選択肢（正解は緑、選んだ誤答は赤取り消し線）・解説が表示されることを確認する
2. 全問正解で診断を完了し、「全問正解でした！」が表示されることを確認する
3. ブラウザの開発者ツールでlocalStorageの`cc-diagnosis-result`から`wrongAnswers`キーを削除し（または旧形式を模した値に書き換え）、`result.html`を再読み込みして「古い診断結果です」のフォールバック文言が出ることを確認する
4. 「PDFとして印刷 / 保存」ボタンで印刷プレビューを開き、間違えた問題セクションが崩れずに表示されることを確認する

- [ ] **Step 5: Commit**

```bash
git add result.html js/result-page.js css/style.css
git commit -m "feat: 結果ページに間違えた問題の正解・解説セクションを追加"
```

---

## Task 4: 既存4領域のリサーチと拡充（basic-operations）

**Files:**
- Modify: `data/questions/basic-operations.json`

**Interfaces:**
- Consumes: なし
- Produces: `basic-operations.json`の`questions`配列が各レベル10問（計40問）になった状態。後続タスク（Task 8のテスト）がこのファイル構造を検証する。

このタスクはコンテンツ作成が中心。以下の手順で進める。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する（既存問題の正確性検証と新規問題のネタ探しを兼ねる）:
- `https://code.claude.com/docs/en/cli-reference` — CLIコマンド・フラグ一覧
- `https://code.claude.com/docs/en/sessions` — セッション管理（`--resume`/`--continue`/`/resume`/`/rewind`）
- `https://code.claude.com/docs/en/statusline` — ステータスライン設定
- `https://code.claude.com/docs/en/common-workflows` — 基本的なワークフロー

- [ ] **Step 2: 既存16問（basic-001〜basic-016）をレビューし、曖昧・古い記述があれば書き換える**

`data/questions/basic-operations.json`を読み込み、Step 1で確認した仕様と照合する。`id`・`level`は変更しない。記述を修正する場合は`question`/`choices`/`correctIndex`/`explanation`のみ変更する。

- [ ] **Step 3: 各レベル6問ずつ、計24問を新規追加する（basic-017〜basic-040）**

設計書で挙げた観点（`/rewind`によるチェックポイント復元、セッション管理、ステータスライン設定など）を中心に、`id`は`basic-017`から連番で採番する。各問題は以下の構造に従う:

```json
{
  "id": "basic-017",
  "level": "beginner",
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correctIndex": 0,
  "explanation": "..."
}
```

4レベル×既存4問+新規6問=各レベル10問、合計40問になるよう配分する。

- [ ] **Step 4: JSON構文とテストで検証する**

Run: `python3 -c "import json; json.load(open('data/questions/basic-operations.json'))" && echo "valid JSON"`
Run: `node --test tests/question-data.test.js`
Expected: JSON構文エラーなし。既存テスト（`MIN_QUESTIONS_PER_LEVEL = 4`基準）はPASS（Task 8で閾値を10に引き上げるまでは4のままでも通る）

- [ ] **Step 5: Commit**

```bash
git add data/questions/basic-operations.json
git commit -m "content: basic-operations領域の問題を精査・拡充（各レベル10問に）"
```

---

## Task 5: 既存4領域のリサーチと拡充（feature-usage）

**Files:**
- Modify: `data/questions/feature-usage.json`

**Interfaces:**
- Consumes: なし
- Produces: Task 4と同じ構造。`feature-usage.json`が各レベル10問（計40問）になった状態。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する:
- `https://code.claude.com/docs/en/hooks` — フックのhandler type（command/http/mcp_tool/prompt/agent）
- `https://code.claude.com/docs/en/sub-agents` — サブエージェント
- `https://code.claude.com/docs/en/mcp` — MCPサーバーとツール検索
- `https://code.claude.com/docs/en/permission-modes` — plan mode
- `https://code.claude.com/docs/en/agent-teams` — agent teams
- `https://code.claude.com/docs/en/skills` — スキル

- [ ] **Step 2: 既存16問（feature-001〜feature-016）をレビューし、曖昧・古い記述があれば書き換える**

`id`・`level`は変更しない。

- [ ] **Step 3: 各レベル6問ずつ、計24問を新規追加する（feature-017〜feature-040）**

設計書の観点（フックのhandler type、plan mode、agent teams、スキル・サブエージェントの使い分け）を中心に採番・作成する。

- [ ] **Step 4: JSON構文とテストで検証する**

Run: `python3 -c "import json; json.load(open('data/questions/feature-usage.json'))" && echo "valid JSON"`
Run: `node --test tests/question-data.test.js`
Expected: JSON構文エラーなし、既存テストPASS

- [ ] **Step 5: Commit**

```bash
git add data/questions/feature-usage.json
git commit -m "content: feature-usage領域の問題を精査・拡充（各レベル10問に）"
```

---

## Task 6: 既存4領域のリサーチと拡充（prompt-design）

**Files:**
- Modify: `data/questions/prompt-design.json`

**Interfaces:**
- Consumes: なし
- Produces: Task 4と同じ構造。`prompt-design.json`が各レベル10問（計40問）になった状態。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する:
- `https://code.claude.com/docs/en/memory` — CLAUDE.mdの粒度設計
- `https://code.claude.com/docs/en/skills` — スキルへの指示移譲
- `https://code.claude.com/docs/en/costs` — 明確な指示がトークン消費に与える影響（"Write specific prompts"節）
- `https://code.claude.com/docs/en/common-workflows` — 協働ワークフロー

- [ ] **Step 2: 既存16問（prompt-001〜prompt-016）をレビューし、曖昧・古い記述があれば書き換える**

`id`・`level`は変更しない。

- [ ] **Step 3: 各レベル6問ずつ、計24問を新規追加する（prompt-017〜prompt-040）**

設計書の観点（CLAUDE.mdの粒度設計、スキルへの指示移譲、明確な指示がトークン消費に与える影響）を中心に採番・作成する。

- [ ] **Step 4: JSON構文とテストで検証する**

Run: `python3 -c "import json; json.load(open('data/questions/prompt-design.json'))" && echo "valid JSON"`
Run: `node --test tests/question-data.test.js`
Expected: JSON構文エラーなし、既存テストPASS

- [ ] **Step 5: Commit**

```bash
git add data/questions/prompt-design.json
git commit -m "content: prompt-design領域の問題を精査・拡充（各レベル10問に）"
```

---

## Task 7: 既存4領域のリサーチと拡充（security-permissions）

**Files:**
- Modify: `data/questions/security-permissions.json`

**Interfaces:**
- Consumes: なし
- Produces: Task 4と同じ構造。`security-permissions.json`が各レベル10問（計40問）になった状態。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する:
- `https://code.claude.com/docs/en/permissions` および `https://code.claude.com/docs/en/settings` — `permissions`のallow/deny/ask構造
- `https://code.claude.com/docs/en/model-config` — `availableModels`による組織制限
- `https://code.claude.com/docs/en/sandboxing` — sandboxモード（該当ページが見つからない場合は`hooks`や`iam`関連ページを確認する）

- [ ] **Step 2: 既存16問（security-001〜security-016）をレビューし、曖昧・古い記述があれば書き換える**

`id`・`level`は変更しない。

- [ ] **Step 3: 各レベル6問ずつ、計24問を新規追加する（security-017〜security-040）**

設計書の観点（`permissions`のallow/deny/ask構造、`availableModels`による組織制限、sandboxモード）を中心に採番・作成する。

- [ ] **Step 4: JSON構文とテストで検証する**

Run: `python3 -c "import json; json.load(open('data/questions/security-permissions.json'))" && echo "valid JSON"`
Run: `node --test tests/question-data.test.js`
Expected: JSON構文エラーなし、既存テストPASS

- [ ] **Step 5: Commit**

```bash
git add data/questions/security-permissions.json
git commit -m "content: security-permissions領域の問題を精査・拡充（各レベル10問に）"
```

---

## Task 8: 新領域「トークン効率・コスト管理」の作成と配線

**Files:**
- Create: `data/questions/token-efficiency.json`
- Modify: `js/quiz-page.js:5-10` (DOMAIN_FILES配列)
- Modify: `js/report-content.js`

**Interfaces:**
- Consumes: なし
- Produces: `data/questions/token-efficiency.json`（各レベル10問、計40問）。`js/quiz-page.js`の`DOMAIN_FILES`に登録済み。`js/report-content.js`の`SUGGESTIONS`に`token-efficiency`エントリを追加済み。

- [ ] **Step 1: 公式ドキュメントをリサーチする**

WebSearch/WebFetchで以下を確認する（このセッションで既に取得済みの内容を再利用してよい）:
- `https://code.claude.com/docs/en/costs` — `/usage`・`/cost`、コスト削減策全般
- `https://code.claude.com/docs/en/model-config` — `/model`、`opusplan`、effortレベル、1M context
- `https://code.claude.com/docs/en/prompt-caching` — プロンプトキャッシングの概念（TTL、キャッシュミス）
- `https://code.claude.com/docs/en/mcp` — MCPツールの遅延ロード

- [ ] **Step 2: `data/questions/token-efficiency.json`を新規作成する**

設計書の観点表に従い、`domain: "token-efficiency"`, `domainLabel: "トークン効率・コスト管理"`、IDプレフィックス`token-`で各レベル10問（計40問、`token-001`〜`token-040`）を作成する。ファイル全体の構造は既存ドメインファイルに合わせる:

```json
{
  "domain": "token-efficiency",
  "domainLabel": "トークン効率・コスト管理",
  "questions": [
    {
      "id": "token-001",
      "level": "beginner",
      "question": "...",
      "choices": ["...", "...", "...", "..."],
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}
```

- [ ] **Step 3: JSON構文を検証する**

Run: `python3 -c "import json; json.load(open('data/questions/token-efficiency.json'))" && echo "valid JSON"`
Expected: `valid JSON`

- [ ] **Step 4: js/quiz-page.jsのDOMAIN_FILESに新ファイルを追加する**

`js/quiz-page.js:5-10`を変更:

```javascript
const DOMAIN_FILES = [
  'data/questions/basic-operations.json',
  'data/questions/feature-usage.json',
  'data/questions/prompt-design.json',
  'data/questions/security-permissions.json',
  'data/questions/token-efficiency.json',
];
```

- [ ] **Step 5: js/report-content.jsのSUGGESTIONSにtoken-efficiencyの改善提案を追加する**

`js/report-content.js:3-28`の`SUGGESTIONS`オブジェクトに、`security-permissions`エントリの後に追記:

```javascript
  'token-efficiency': {
    beginner: '`/clear`と`/compact`の違いを理解し、無関係なタスクに切り替える際は`/clear`で会話をリセットする習慣をつけましょう。',
    intermediate: 'プロンプトキャッシングの仕組みを理解し、`/model`でタスクに応じてSonnet/Opus/Haikuを使い分けてみましょう。',
    advanced: 'キャッシュのTTLやMCPツールの遅延ロードの仕組みを理解し、hookやCLAUDE.mdの設計でcontextを削減する工夫をしてみましょう。',
    expert: '`/usage`のブレークダウンを活用して使用量の内訳を把握し、組織のスペンド管理やeffortレベルの調整によるコスト最適化に取り組みましょう。',
  },
```

- [ ] **Step 6: node --testで既存テストが壊れていないことを確認する**

Run: `node --test`
Expected: 全テストPASS（新ドメインファイルは`question-data.test.js`が自動的に走査するため、ここで検証される）

- [ ] **Step 7: ブラウザで動作確認**

Run: `python3 -m http.server 8000`
`http://localhost:8000/index.html`から診断を実施し、5領域目として「トークン効率・コスト管理」が出題されること、結果ページの「領域別レベル」に表示されること、意図的にこの領域で不正解を出した場合に改善提案が表示されることを確認する。

- [ ] **Step 8: Commit**

```bash
git add data/questions/token-efficiency.json js/quiz-page.js js/report-content.js
git commit -m "feat: 新領域「トークン効率・コスト管理」を追加"
```

---

## Task 9: テストの閾値更新とREADME更新

**Files:**
- Modify: `tests/question-data.test.js:9`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 4〜8で全5ドメインファイルが各レベル10問になっていること
- Produces: なし（検証とドキュメントの整合性確保）

- [ ] **Step 1: MIN_QUESTIONS_PER_LEVELを10に変更する**

`tests/question-data.test.js:9`を変更:

```javascript
const MIN_QUESTIONS_PER_LEVEL = 10;
```

- [ ] **Step 2: テストを実行し、全ドメインが基準を満たすことを確認する**

Run: `node --test tests/question-data.test.js`
Expected: PASS。もしFAILする場合はどのドメイン・レベルが不足しているかがエラーメッセージに出るので、Task 4〜8に戻って該当ドメインの問題数を補う。

- [ ] **Step 3: README.mdの「問題の追加・修正」節を更新する**

`README.md`の該当節（末尾付近）を、現状の「4領域・各レベル最低4問・1回10問抽選」という記述から、新しい前提（5領域・各レベル最低10問・抽選数は変更なし）に更新する:

```markdown
## 問題の追加・修正

`data/questions/*.json` を直接編集してください。各領域のファイルには
`beginner`/`intermediate`/`advanced`/`expert` の4レベルがそれぞれ最低10問ずつ必要です
（1回の診断で各レベルから抽出する問題数: 初級3問・中級3問・上級2問・エキスパート2問）。

対象領域は5つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）。

各問題の`id`はドメイン間で一意である必要があります。プレフィクス規約に従って命名してください。
```

- [ ] **Step 4: node --testで全体テストを最終確認する**

Run: `node --test`
Expected: 全テストPASS

- [ ] **Step 5: Commit**

```bash
git add tests/question-data.test.js README.md
git commit -m "test: 問題数の最低基準を10問に引き上げ、READMEを5領域構成に更新"
```

---

## Self-Review Notes

- **Spec coverage**: 新領域追加（Task 8）、既存4領域の拡充（Task 4-7）、間違えた問題表示（Task 1-3）、テスト方針（Task 9でquestion-data.test.js更新、Task 1でquiz-engine.test.js追加）、README更新（Task 9）を全てカバー。`report-content.js`への`token-efficiency`エントリ追加は設計書に明記がなかったが、既存パターン（4領域全てに改善提案がある）との一貫性のためTask 8に追加した。
- **Placeholder scan**: 各コンテンツタスク（4-8）の問題文自体はリサーチ結果に依存するため実装時に確定するが、ファイル構造・件数・命名規則は具体的に指定済み。「TBD」等のプレースホルダーはなし。
- **Type consistency**: `collectWrongAnswers`の返り値の各フィールド名（`questionId`/`domainLabel`/`question`/`choices`/`selectedIndex`/`correctIndex`/`explanation`）はTask 1〜3で一貫している。`DOMAIN_FILES`・`SUGGESTIONS`のキー`token-efficiency`はTask 8内で一貫している。
