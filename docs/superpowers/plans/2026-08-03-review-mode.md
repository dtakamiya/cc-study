# 誤答の蓄積と復習モード 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 問題 ID 単位の誤答履歴を localStorage に永続化し、誤答問題だけを出題する復習モードとダッシュボードの誤答バッジを追加する。

**Architecture:** 純粋関数モジュール `js/review.js`（正規化・記録・出題対象選定・集計）と、ストレージ I/O を担う `js/storage.js` の新関数を分離する。既存の `js/quiz-page.js` は「モード差分（出題対象の決定・ラベル・終了時の保存）」を `js/quiz-modes.js` に切り出し、共通の出題ループはそのまま使う。ダッシュボードのステージセルは `<a>` から `<div>` + 内部リンク 2 つに変え、バッジを独立したリンクにする。

**Tech Stack:** 素の ES モジュール（ビルドなし）、`node --test`（Node 標準テストランナー、`node:assert/strict`）、localStorage / sessionStorage、静的 HTML + CSS。パッケージマネージャや依存は一切使わない。

## Global Constraints

- サーバーなし、localStorage のみ、外部送信なし。新しい依存パッケージを追加しない
- ゲート構造（10 問・8 問正解で合格・次レベル開放）は変更しない
- **復習モードは `cc-diagnosis-progress` を一切更新しない**（`recordAttempt` / `saveProgressRaw` を呼ばない）。最重要の不変条件
- 既存テスト（`tests/progress.test.js` / `tests/quiz-engine.test.js` / `tests/storage.test.js` / `tests/question-data.test.js`）は変更しない
- 新規ロジックは DOM を持たない純粋関数として書き、`node --test` でテストする
- localStorage キー: 既存 `cc-diagnosis-progress`（変更なし）／新規 `cc-diagnosis-review`
- 誤答履歴フォーマットの `version` は `1`（定数 `REVIEW_VERSION`）
- 復習モードの出題上限は 20 問（定数 `REVIEW_QUESTION_LIMIT`）
- 「未復習の誤答」の定義は `lastResult === "wrong"` のエントリ
- 誤答履歴の保存失敗は挑戦の完了をブロックしない（`showSaveFailure` を発火させない）
- コメントは日本語。既存コードのコメント密度・命名・書式に合わせる
- テスト実行コマンドは `node --test`（リポジトリルートで実行）

---

## File Structure

**新規作成:**

- `js/review.js` — 誤答履歴の純粋関数。`REVIEW_VERSION` / `REVIEW_QUESTION_LIMIT` / `createEmptyReview` / `normalizeReview` / `recordAnswers` / `selectReviewQuestions` / `countUnreviewedByStage` / `countUnreviewedTotal`
- `js/quiz-modes.js` — 出題モードの差分。`parseQuizMode` / `buildStageLabel` / `fetchDomainQuestions` / `loadQuestionsForTarget`
- `tests/review.test.js` — `js/review.js` のテスト
- `tests/quiz-modes.test.js` — `js/quiz-modes.js` のテスト

**変更:**

- `js/quiz-engine.js` — `shuffleChoices` を export する（実装は変更しない）
- `js/storage.js` — `saveReviewRaw` / `loadReviewRaw` を追加（既存関数は変更しない）
- `js/quiz-page.js` — モード分岐。通常モードでも誤答履歴を記録する
- `js/top-page.js` — ステージセルの構造変更、バッジ、全体復習ボタン
- `js/result-page.js` — 復習モードの結果表示（`isReview` フラグ）
- `index.html` — 全体復習ボタンの置き場所（`<div id="review-all">`）
- `css/style.css` — バッジと復習ボタンのスタイル
- `README.md` — 復習モードの説明を追記

---

### Task 1: 誤答履歴の正規化とデータ構造

**Files:**
- Create: `js/review.js`
- Test: `tests/review.test.js`

**Interfaces:**
- Consumes: `DOMAINS` from `js/progress.js`、`LEVELS` from `js/level-judge.js`
- Produces:
  - `REVIEW_VERSION: number` = `1`
  - `REVIEW_QUESTION_LIMIT: number` = `20`
  - `createEmptyReview(): { version: 1, items: {} }`
  - `normalizeReview(raw: unknown): { version: 1, items: Record<string, ReviewEntry> }`
  - `ReviewEntry = { domain: string, level: string, wrongCount: number, lastResult: 'wrong' | 'correct', lastAnsweredAt: string }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/review.test.js` を新規作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REVIEW_VERSION,
  REVIEW_QUESTION_LIMIT,
  createEmptyReview,
  normalizeReview,
} from '../js/review.js';

function entry(overrides = {}) {
  return {
    domain: 'security-permissions',
    level: 'advanced',
    wrongCount: 2,
    lastResult: 'wrong',
    lastAnsweredAt: '2026-08-03T10:00:00.000Z',
    ...overrides,
  };
}

test('createEmptyReview は空の履歴を返す', () => {
  assert.deepEqual(createEmptyReview(), { version: REVIEW_VERSION, items: {} });
});

test('REVIEW_VERSION は 1、REVIEW_QUESTION_LIMIT は 20', () => {
  assert.equal(REVIEW_VERSION, 1);
  assert.equal(REVIEW_QUESTION_LIMIT, 20);
});

test('normalizeReview は正常なエントリをそのまま残す', () => {
  const raw = { version: 1, items: { 'security-046': entry() } };
  assert.deepEqual(normalizeReview(raw), raw);
});

test('normalizeReview は null や非オブジェクトを空の履歴にする', () => {
  assert.deepEqual(normalizeReview(null), createEmptyReview());
  assert.deepEqual(normalizeReview('壊れている'), createEmptyReview());
  assert.deepEqual(normalizeReview(42), createEmptyReview());
});

test('normalizeReview は version 不一致なら全体を初期化する', () => {
  const raw = { version: 99, items: { 'security-046': entry() } };
  assert.deepEqual(normalizeReview(raw), createEmptyReview());
});

test('normalizeReview は items が無ければ空の履歴にする', () => {
  assert.deepEqual(normalizeReview({ version: 1 }), createEmptyReview());
  assert.deepEqual(normalizeReview({ version: 1, items: null }), createEmptyReview());
});

test('normalizeReview は壊れたエントリだけを捨て、正常なエントリは残す', () => {
  const raw = {
    version: 1,
    items: {
      'security-046': entry(),
      'broken-1': null,
      'broken-2': { domain: 'security-permissions' },
      'broken-3': entry({ wrongCount: '2' }),
      'broken-4': entry({ lastResult: 'maybe' }),
      'broken-5': entry({ lastAnsweredAt: 12345 }),
      'basic-001': entry({ domain: 'basic-operations', level: 'beginner', lastResult: 'correct' }),
    },
  };
  const normalized = normalizeReview(raw);
  assert.deepEqual(Object.keys(normalized.items).sort(), ['basic-001', 'security-046']);
});

test('normalizeReview は未知の domain / level のエントリを捨てる', () => {
  const raw = {
    version: 1,
    items: {
      'unknown-domain': entry({ domain: 'not-a-domain' }),
      'unknown-level': entry({ level: 'godlike' }),
      'security-046': entry(),
    },
  };
  assert.deepEqual(Object.keys(normalizeReview(raw).items), ['security-046']);
});

test('normalizeReview は既知のフィールドだけを写し取る', () => {
  const raw = { version: 1, items: { 'security-046': entry({ extra: 'あやしい' }) } };
  assert.deepEqual(normalizeReview(raw).items['security-046'], entry());
});

test('normalizeReview は入力を書き換えない', () => {
  const raw = { version: 1, items: { 'security-046': entry(), 'broken-1': null } };
  const snapshot = JSON.parse(JSON.stringify(raw));
  normalizeReview(raw);
  assert.deepEqual(raw, snapshot);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/review.test.js`
Expected: FAIL（`Cannot find module '../js/review.js'`）

- [ ] **Step 3: 最小の実装を書く**

`js/review.js` を新規作成する。

```javascript
import { DOMAINS } from './progress.js';
import { LEVELS } from './level-judge.js';

export const REVIEW_VERSION = 1;

// 復習1回あたりの上限。誤答が溜まりすぎたとき、
// 終わらない復習を強いないためのもの。
export const REVIEW_QUESTION_LIMIT = 20;

const RESULTS = ['wrong', 'correct'];

export function createEmptyReview() {
  return { version: REVIEW_VERSION, items: {} };
}

function isValidEntry(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    DOMAINS.includes(value.domain) &&
    LEVELS.includes(value.level) &&
    typeof value.wrongCount === 'number' &&
    RESULTS.includes(value.lastResult) &&
    typeof value.lastAnsweredAt === 'string'
  );
}

// 誤答履歴は積み上げた価値があるため、進捗と違って全体は初期化しない。
// 壊れたエントリだけを黙って捨て、残りは活かす。
// versionが違うときだけは構造の意味が変わるため全体を捨てる。
export function normalizeReview(raw) {
  if (raw === null || typeof raw !== 'object') return createEmptyReview();
  if (raw.version !== REVIEW_VERSION) return createEmptyReview();
  if (raw.items === null || typeof raw.items !== 'object') return createEmptyReview();

  const normalized = createEmptyReview();
  for (const [questionId, entry] of Object.entries(raw.items)) {
    if (!isValidEntry(entry)) continue;
    normalized.items[questionId] = {
      domain: entry.domain,
      level: entry.level,
      wrongCount: entry.wrongCount,
      lastResult: entry.lastResult,
      lastAnsweredAt: entry.lastAnsweredAt,
    };
  }
  return normalized;
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test tests/review.test.js`
Expected: PASS（全 10 テスト）

- [ ] **Step 5: 既存テストが壊れていないことを確認する**

Run: `node --test`
Expected: PASS（既存テストを含めて全件成功）

- [ ] **Step 6: コミット**

```bash
git add js/review.js tests/review.test.js
git commit -m "feat: 誤答履歴の正規化 normalizeReview を追加"
```

---

### Task 2: 解答結果の記録（recordAnswers）

**Files:**
- Modify: `js/review.js`
- Test: `tests/review.test.js`

**Interfaces:**
- Consumes: Task 1 の `createEmptyReview` / `normalizeReview` / `ReviewEntry`
- Produces:
  - `recordAnswers(review, questions, answers, now = new Date()): Review`
    - `review`: 正規化済みの履歴オブジェクト（破壊しない。新しいオブジェクトを返す）
    - `questions`: `{ id: string, domain?: string, level: string, correctIndex: number }[]`
      — `domain` が欠けている場合は第 5 引数 `fallbackDomain` を使う
    - `answers`: `Record<string, number>` — 問題 ID → 選んだ選択肢の index
    - シグネチャ全体: `recordAnswers(review, questions, answers, now = new Date(), fallbackDomain = null)`

記録ルール（spec の表）:

| 状況 | 動作 |
|---|---|
| 誤答した | エントリを作成、または `wrongCount` を +1。`lastResult` を `"wrong"` に |
| 正解した（既存エントリあり） | `lastResult` を `"correct"` に。エントリは消さない。`wrongCount` は増やさない |
| 正解した（エントリなし） | 何もしない |

- [ ] **Step 1: 失敗するテストを書く**

`tests/review.test.js` の末尾に追記する。冒頭の import に `recordAnswers` を加える。

```javascript
// ファイル冒頭の import を以下に差し替える
import {
  REVIEW_VERSION,
  REVIEW_QUESTION_LIMIT,
  createEmptyReview,
  normalizeReview,
  recordAnswers,
} from '../js/review.js';
```

```javascript
const NOW = new Date('2026-08-03T12:00:00.000Z');

function question(id, overrides = {}) {
  return {
    id,
    domain: 'security-permissions',
    level: 'advanced',
    correctIndex: 1,
    ...overrides,
  };
}

test('recordAnswers は誤答した問題のエントリを作る', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  assert.deepEqual(result.items['security-046'], {
    domain: 'security-permissions',
    level: 'advanced',
    wrongCount: 1,
    lastResult: 'wrong',
    lastAnsweredAt: '2026-08-03T12:00:00.000Z',
  });
});

test('recordAnswers は誤答を繰り返すと wrongCount が増える', () => {
  const first = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  const second = recordAnswers(first, [question('security-046')], { 'security-046': 2 }, NOW);
  assert.equal(second.items['security-046'].wrongCount, 2);
  assert.equal(second.items['security-046'].lastResult, 'wrong');
});

test('recordAnswers は既存エントリの正解で lastResult を correct にする（消さない）', () => {
  const wrong = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  const correct = recordAnswers(wrong, [question('security-046')], { 'security-046': 1 }, NOW);
  assert.equal(correct.items['security-046'].lastResult, 'correct');
  assert.equal(correct.items['security-046'].wrongCount, 1);
});

test('recordAnswers は未登録の問題の正解を記録しない', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 1 }, NOW);
  assert.deepEqual(result.items, {});
});

test('recordAnswers は未解答（answersに無い）を誤答として扱う', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], {}, NOW);
  assert.equal(result.items['security-046'].lastResult, 'wrong');
  assert.equal(result.items['security-046'].wrongCount, 1);
});

test('recordAnswers は複数問をまとめて処理する', () => {
  const questions = [
    question('security-046'),
    question('security-047'),
    question('basic-001', { domain: 'basic-operations', level: 'beginner' }),
  ];
  const answers = { 'security-046': 0, 'security-047': 1, 'basic-001': 3 };
  const result = recordAnswers(createEmptyReview(), questions, answers, NOW);
  assert.deepEqual(Object.keys(result.items).sort(), ['basic-001', 'security-046']);
  assert.equal(result.items['basic-001'].domain, 'basic-operations');
  assert.equal(result.items['basic-001'].level, 'beginner');
});

test('recordAnswers は domain が無い問題に fallbackDomain を使う', () => {
  const questions = [{ id: 'security-046', level: 'advanced', correctIndex: 1 }];
  const result = recordAnswers(
    createEmptyReview(),
    questions,
    { 'security-046': 0 },
    NOW,
    'security-permissions'
  );
  assert.equal(result.items['security-046'].domain, 'security-permissions');
});

test('recordAnswers は domain も fallbackDomain も無い問題を記録しない', () => {
  const questions = [{ id: 'security-046', level: 'advanced', correctIndex: 1 }];
  const result = recordAnswers(createEmptyReview(), questions, { 'security-046': 0 }, NOW);
  assert.deepEqual(result.items, {});
});

test('recordAnswers は入力の review を書き換えない', () => {
  const before = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  const snapshot = JSON.parse(JSON.stringify(before));
  recordAnswers(before, [question('security-046')], { 'security-046': 0 }, NOW);
  assert.deepEqual(before, snapshot);
});

test('recordAnswers の結果は normalizeReview を通しても変わらない', () => {
  const result = recordAnswers(createEmptyReview(), [question('security-046')], { 'security-046': 0 }, NOW);
  assert.deepEqual(normalizeReview(result), result);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/review.test.js`
Expected: FAIL（`recordAnswers is not a function`）

- [ ] **Step 3: 最小の実装を書く**

`js/review.js` の末尾に追記する。

```javascript
// 正答のみの問題は記録しない。誤答したことのない問題まで持つと
// 履歴が全問題分に膨れ、バッジ集計も無駄に重くなる。
export function recordAnswers(review, questions, answers, now = new Date(), fallbackDomain = null) {
  const items = { ...review.items };
  const answeredAt = now.toISOString();

  for (const question of questions) {
    const domain = question.domain ?? fallbackDomain;
    // domainが分からないエントリはバッジ集計もステージ別復習もできないため記録しない。
    if (!DOMAINS.includes(domain) || !LEVELS.includes(question.level)) continue;

    const selectedIndex = Object.prototype.hasOwnProperty.call(answers, question.id)
      ? answers[question.id]
      : null;
    const isCorrect = selectedIndex === question.correctIndex;
    const previous = items[question.id] ?? null;

    if (isCorrect && previous === null) continue;

    items[question.id] = {
      domain,
      level: question.level,
      wrongCount: (previous?.wrongCount ?? 0) + (isCorrect ? 0 : 1),
      lastResult: isCorrect ? 'correct' : 'wrong',
      lastAnsweredAt: answeredAt,
    };
  }

  return { ...review, items };
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test tests/review.test.js`
Expected: PASS

- [ ] **Step 5: 全テストを実行する**

Run: `node --test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add js/review.js tests/review.test.js
git commit -m "feat: 解答結果を誤答履歴へ記録する recordAnswers を追加"
```

---

### Task 3: 出題対象の選定と集計（selectReviewQuestions / countUnreviewed*）

**Files:**
- Modify: `js/review.js`
- Test: `tests/review.test.js`

**Interfaces:**
- Consumes: Task 1 の `normalizeReview` / `REVIEW_QUESTION_LIMIT`、`js/quiz-engine.js` は使わない（純粋関数のまま保つ）
- Produces:
  - `selectReviewQuestions(review, allQuestions, filter = {}, rng = Math.random): Question[]`
    - `allQuestions`: `{ id, domain, level, question, choices, correctIndex, explanation }[]`（実在する問題の配列）
    - `filter`: `{ domain?: string, level?: string }` — 両方省略で全領域
    - 戻り値: `allQuestions` の要素そのもの（シャッフル済み・最大 `REVIEW_QUESTION_LIMIT` 件）。選択肢のシャッフルは行わない（呼び出し側の責務）
  - `countUnreviewedByStage(review): Record<string, Record<string, number>>`
    — `result[domain][level] = 件数`。全 `DOMAINS` × `LEVELS` のキーを持ち、該当なしは `0`
  - `countUnreviewedTotal(review): number`

`countUnreviewedByStage` / `countUnreviewedTotal` は問題データを読まずに履歴だけで数える（spec の「ダッシュボードは JSON を fetch せずに描画できる」要件）。孤児エントリはバッジに含まれうるが、spec 通り害がないものとして許容する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/review.test.js` の import に 3 つの関数を加え、末尾に追記する。

```javascript
// ファイル冒頭の import を以下に差し替える
import {
  REVIEW_VERSION,
  REVIEW_QUESTION_LIMIT,
  createEmptyReview,
  normalizeReview,
  recordAnswers,
  selectReviewQuestions,
  countUnreviewedByStage,
  countUnreviewedTotal,
} from '../js/review.js';
```

```javascript
// rngを固定して抽出結果を決定的にする
function fixedRng() {
  return 0;
}

function pool(...specs) {
  return specs.map(([id, domain, level]) => ({
    id,
    domain,
    level,
    question: `${id} の問題文`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 1,
    explanation: `${id} の解説`,
  }));
}

function reviewWith(items) {
  return { version: REVIEW_VERSION, items };
}

test('selectReviewQuestions は lastResult が wrong の問題だけを返す', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-047': entry({ lastResult: 'correct' }),
  });
  const questions = pool(
    ['security-046', 'security-permissions', 'advanced'],
    ['security-047', 'security-permissions', 'advanced']
  );
  const selected = selectReviewQuestions(review, questions, {}, fixedRng);
  assert.deepEqual(selected.map(q => q.id), ['security-046']);
});

test('selectReviewQuestions は domain と level で絞り込む', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-010': entry({ level: 'beginner' }),
    'basic-001': entry({ domain: 'basic-operations', level: 'advanced' }),
  });
  const questions = pool(
    ['security-046', 'security-permissions', 'advanced'],
    ['security-010', 'security-permissions', 'beginner'],
    ['basic-001', 'basic-operations', 'advanced']
  );

  assert.deepEqual(
    selectReviewQuestions(review, questions, { domain: 'security-permissions', level: 'advanced' }, fixedRng)
      .map(q => q.id),
    ['security-046']
  );
  assert.deepEqual(
    selectReviewQuestions(review, questions, {}, fixedRng).map(q => q.id).sort(),
    ['basic-001', 'security-010', 'security-046']
  );
});

test('selectReviewQuestions は実在しない問題IDを除外する', () => {
  const review = reviewWith({
    'security-046': entry(),
    'deleted-999': entry(),
  });
  const questions = pool(['security-046', 'security-permissions', 'advanced']);
  const selected = selectReviewQuestions(review, questions, {}, fixedRng);
  assert.deepEqual(selected.map(q => q.id), ['security-046']);
});

test('selectReviewQuestions は 20 問を上限にする', () => {
  const items = {};
  const specs = [];
  for (let i = 0; i < 25; i++) {
    const id = `security-${String(i).padStart(3, '0')}`;
    items[id] = entry();
    specs.push([id, 'security-permissions', 'advanced']);
  }
  const selected = selectReviewQuestions(reviewWith(items), pool(...specs), {}, fixedRng);
  assert.equal(selected.length, REVIEW_QUESTION_LIMIT);
  assert.equal(new Set(selected.map(q => q.id)).size, REVIEW_QUESTION_LIMIT);
});

test('selectReviewQuestions は対象が無ければ空配列を返す', () => {
  assert.deepEqual(selectReviewQuestions(createEmptyReview(), pool(['security-046', 'security-permissions', 'advanced']), {}, fixedRng), []);
});

test('selectReviewQuestions は履歴の domain / level ではなく問題データ側で絞る', () => {
  // 問題データ側でレベルが変わった場合、実物のレベルを正とする
  const review = reviewWith({ 'security-046': entry({ level: 'advanced' }) });
  const questions = pool(['security-046', 'security-permissions', 'expert']);
  assert.deepEqual(
    selectReviewQuestions(review, questions, { domain: 'security-permissions', level: 'expert' }, fixedRng)
      .map(q => q.id),
    ['security-046']
  );
});

test('countUnreviewedByStage は全ステージのキーを持ち、該当なしは 0', () => {
  const counts = countUnreviewedByStage(createEmptyReview());
  assert.equal(counts['security-permissions']['advanced'], 0);
  assert.equal(counts['basic-operations']['beginner'], 0);
  assert.equal(Object.keys(counts).length, 5);
  assert.equal(Object.keys(counts['basic-operations']).length, 4);
});

test('countUnreviewedByStage は wrong のエントリだけをステージ別に数える', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-047': entry(),
    'security-048': entry({ lastResult: 'correct' }),
    'basic-001': entry({ domain: 'basic-operations', level: 'beginner' }),
  });
  const counts = countUnreviewedByStage(review);
  assert.equal(counts['security-permissions']['advanced'], 2);
  assert.equal(counts['basic-operations']['beginner'], 1);
  assert.equal(counts['basic-operations']['advanced'], 0);
});

test('countUnreviewedTotal はステージ別集計の合計と一致する', () => {
  const review = reviewWith({
    'security-046': entry(),
    'security-047': entry(),
    'security-048': entry({ lastResult: 'correct' }),
    'basic-001': entry({ domain: 'basic-operations', level: 'beginner' }),
  });
  assert.equal(countUnreviewedTotal(review), 3);

  const counts = countUnreviewedByStage(review);
  const sum = Object.values(counts)
    .flatMap(levels => Object.values(levels))
    .reduce((acc, n) => acc + n, 0);
  assert.equal(sum, countUnreviewedTotal(review));
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/review.test.js`
Expected: FAIL（`selectReviewQuestions is not a function`）

- [ ] **Step 3: 最小の実装を書く**

`js/review.js` の末尾に追記する。

```javascript
function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function isUnreviewed(entry) {
  return entry.lastResult === 'wrong';
}

// 出題対象は「未復習の誤答」かつ「実在する問題」。
// 問題が削除・ID変更されると孤児エントリが残るため、実物の側で照合する。
// 絞り込みも履歴ではなく問題データのdomain/levelで行い、
// 問題側のレベルが変わっても現物に従う。
export function selectReviewQuestions(review, allQuestions, filter = {}, rng = Math.random) {
  const targets = allQuestions.filter(question => {
    const entry = review.items[question.id];
    if (!entry || !isUnreviewed(entry)) return false;
    if (filter.domain && question.domain !== filter.domain) return false;
    if (filter.level && question.level !== filter.level) return false;
    return true;
  });

  return shuffle(targets, rng).slice(0, REVIEW_QUESTION_LIMIT);
}

// バッジのためにdata/questions/*.jsonを読ませない。
// エントリ自身がdomain/levelを持つのはこのため。
export function countUnreviewedByStage(review) {
  const counts = {};
  for (const domain of DOMAINS) {
    counts[domain] = {};
    for (const level of LEVELS) {
      counts[domain][level] = 0;
    }
  }

  for (const entry of Object.values(review.items)) {
    if (!isUnreviewed(entry)) continue;
    // normalizeReview を通していれば必ず既知のdomain/levelだが、
    // 素の値を渡された場合に落ちないよう存在を確かめる。
    if (counts[entry.domain]?.[entry.level] === undefined) continue;
    counts[entry.domain][entry.level] += 1;
  }

  return counts;
}

export function countUnreviewedTotal(review) {
  return Object.values(review.items).filter(isUnreviewed).length;
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test tests/review.test.js`
Expected: PASS

- [ ] **Step 5: 全テストを実行する**

Run: `node --test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add js/review.js tests/review.test.js
git commit -m "feat: 復習対象の選定とステージ別誤答集計を追加"
```

---

### Task 4: 誤答履歴の保存・読み込み

**Files:**
- Modify: `js/storage.js`
- Test: `tests/review-storage.test.js`（新規。既存 `tests/storage.test.js` は変更しない）

**Interfaces:**
- Consumes: `js/storage.js` の内部ヘルパー `getStore` / `readJson` / `writeJson`
- Produces:
  - `saveReviewRaw(reviewObject): boolean` — localStorage に保存できたら `true`、できなければ `false`
  - `loadReviewRaw(): unknown | null`

進捗と違い sessionStorage への退避は行わない。誤答履歴はゲートの前提ではなく、
タブ限りの誤答履歴は復習の役に立たないため、localStorage が使えなければ諦める（spec のエラー処理方針）。

- [ ] **Step 1: 失敗するテストを書く**

`tests/review-storage.test.js` を新規作成する。

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// storage.js は呼び出し時にグローバルのストレージを参照するため、
// テストごとにスタブを差し替えられる。tests/storage.test.js と同じ方式。
function makeStorageStub({ throwOnSet = false } = {}) {
  const data = new Map();
  return {
    data,
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      if (throwOnSet) throw new Error('QuotaExceededError');
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function defineThrowingStorage(name) {
  Object.defineProperty(globalThis, name, {
    get() {
      throw new Error('SecurityError: access to storage is denied');
    },
    configurable: true,
  });
}

function defineStorage(name, stub) {
  Object.defineProperty(globalThis, name, {
    value: stub,
    writable: true,
    configurable: true,
  });
}

const REVIEW = { version: 1, items: { 'security-046': { domain: 'security-permissions' } } };

let storage;

beforeEach(async () => {
  defineStorage('localStorage', makeStorageStub());
  defineStorage('sessionStorage', makeStorageStub());
  storage = await import(`../js/storage.js?t=${Date.now()}${Math.random()}`);
});

test('saveReviewRaw は localStorage に保存して true を返す', () => {
  assert.equal(storage.saveReviewRaw(REVIEW), true);
  assert.deepEqual(storage.loadReviewRaw(), REVIEW);
});

test('誤答履歴は進捗とは別のキーに保存する', () => {
  storage.saveReviewRaw(REVIEW);
  assert.notEqual(globalThis.localStorage.data.get('cc-diagnosis-review'), undefined);
  assert.equal(globalThis.localStorage.data.get('cc-diagnosis-progress'), undefined);
});

test('誤答履歴を保存しても進捗は変わらない', () => {
  const progress = { version: 1, domains: { 'basic-operations': {} } };
  storage.saveProgressRaw(progress);
  storage.saveReviewRaw(REVIEW);
  assert.deepEqual(storage.loadProgressRaw(), progress);
});

test('localStorage が使えなければ saveReviewRaw は false を返す', () => {
  defineStorage('localStorage', makeStorageStub({ throwOnSet: true }));
  assert.equal(storage.saveReviewRaw(REVIEW), false);
});

test('localStorage のプロパティアクセスが例外を投げても落ちない', () => {
  defineThrowingStorage('localStorage');
  assert.equal(storage.saveReviewRaw(REVIEW), false);
  assert.equal(storage.loadReviewRaw(), null);
});

test('保存されていなければ loadReviewRaw は null を返す', () => {
  assert.equal(storage.loadReviewRaw(), null);
});

test('壊れたJSONが保存されていれば loadReviewRaw は null を返す', () => {
  globalThis.localStorage.setItem('cc-diagnosis-review', '{壊れている');
  assert.equal(storage.loadReviewRaw(), null);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/review-storage.test.js`
Expected: FAIL（`storage.saveReviewRaw is not a function`）

- [ ] **Step 3: 最小の実装を書く**

`js/storage.js` の 2 行目（`const STAGE_SESSION_KEY = ...` の直後）にキーを追加する。

```javascript
const REVIEW_KEY = 'cc-diagnosis-review';
```

ファイル末尾に追記する。

```javascript
// 誤答履歴はゲートの前提ではないため、進捗のようなsessionStorageへの退避はしない。
// タブを閉じたら消える誤答履歴は「あとで見返す」という目的を果たせず、
// 保存できた／できないの判断を無駄に複雑にするだけになる。
export function saveReviewRaw(reviewObject) {
  return writeJson(getStore('localStorage'), REVIEW_KEY, reviewObject);
}

export function loadReviewRaw() {
  return readJson(getStore('localStorage'), REVIEW_KEY);
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test tests/review-storage.test.js`
Expected: PASS

- [ ] **Step 5: 全テストを実行する**

Run: `node --test`
Expected: PASS（既存の `tests/storage.test.js` も無変更で通ること）

- [ ] **Step 6: コミット**

```bash
git add js/storage.js tests/review-storage.test.js
git commit -m "feat: 誤答履歴の保存・読み込みを storage に追加"
```

---

### Task 5: 出題モードの差分モジュール

**Files:**
- Create: `js/quiz-modes.js`
- Modify: `js/quiz-engine.js:10`（`shuffleChoices` に `export` を付けるだけ。実装は変更しない）
- Test: `tests/quiz-modes.test.js`

**Interfaces:**
- Consumes: `DOMAINS` / `DOMAIN_LABELS` / `QUESTIONS_PER_STAGE` from `js/progress.js`、`LEVELS` / `LEVEL_LABELS` from `js/level-judge.js`、`selectQuestions` / `shuffleChoices` from `js/quiz-engine.js`、`selectReviewQuestions` from `js/review.js`
- Produces: `js/quiz-engine.js` が `shuffleChoices(question, rng)` を export するようになる
- Produces:
  - `parseQuizMode(search: string): { mode: 'normal', domain: string, level: string } | { mode: 'review', domain: string | null, level: string | null } | null`
    - `search`: `window.location.search` の文字列（`'?mode=review&domain=...'`）
    - 不正な組み合わせは `null`（呼び出し側がダッシュボードへ戻す）
  - `buildStageLabel(target): string` — 通常 `基本操作・CLI使用法 / 初級`、復習（ステージ指定）`復習 / 安全性・権限管理 上級`、復習（全体）`復習 / すべての領域`
  - `fetchDomainQuestions(domain, fetchImpl): Promise<Question[]>` — 1 領域分。各問題に `domain` を付与して返す
  - `loadQuestionsForTarget(target, review, fetchImpl, rng): Promise<Question[]>` — モードに応じた出題リスト（選択肢シャッフル済み）

`parseQuizMode` の判定規則:

| `mode` | `domain` | `level` | 結果 |
|---|---|---|---|
| なし / `normal` | 既知 | 既知 | `{ mode: 'normal', domain, level }` |
| なし / `normal` | 未知 or 無し | — | `null` |
| `review` | なし | なし | `{ mode: 'review', domain: null, level: null }` |
| `review` | 既知 | 既知 | `{ mode: 'review', domain, level }` |
| `review` | 片方だけ指定 / 未知の値 | — | `null` |
| その他の `mode` 値 | — | — | `null` |

- [ ] **Step 1: 失敗するテストを書く**

`tests/quiz-modes.test.js` を新規作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuizMode, buildStageLabel, fetchDomainQuestions, loadQuestionsForTarget } from '../js/quiz-modes.js';
import { shuffleChoices } from '../js/quiz-engine.js';
import { REVIEW_VERSION } from '../js/review.js';

// 選択肢シャッフルは通常ステージと復習で同じ規則である必要があるため、
// quiz-engine の実装を共有する。ここが独自実装に戻ると規則が二重管理になる。
test('quiz-engine の shuffleChoices が共有されている', () => {
  assert.equal(typeof shuffleChoices, 'function');
  const shuffled = shuffleChoices(
    { id: 'x', choices: ['A', 'B', 'C', 'D'], correctIndex: 2 },
    () => 0
  );
  assert.equal(shuffled.choices.length, 4);
  assert.equal(shuffled.choices[shuffled.correctIndex], 'C');
});

test('parseQuizMode は mode 未指定を通常モードとして扱う', () => {
  assert.deepEqual(parseQuizMode('?domain=basic-operations&level=beginner'), {
    mode: 'normal',
    domain: 'basic-operations',
    level: 'beginner',
  });
});

test('parseQuizMode は mode=normal を明示されても通常モードにする', () => {
  assert.deepEqual(parseQuizMode('?mode=normal&domain=feature-usage&level=expert'), {
    mode: 'normal',
    domain: 'feature-usage',
    level: 'expert',
  });
});

test('parseQuizMode は通常モードで domain / level が不正なら null', () => {
  assert.equal(parseQuizMode('?domain=not-a-domain&level=beginner'), null);
  assert.equal(parseQuizMode('?domain=basic-operations&level=godlike'), null);
  assert.equal(parseQuizMode(''), null);
});

test('parseQuizMode は mode=review のみを全領域復習として扱う', () => {
  assert.deepEqual(parseQuizMode('?mode=review'), {
    mode: 'review',
    domain: null,
    level: null,
  });
});

test('parseQuizMode は mode=review + domain + level をステージ復習として扱う', () => {
  assert.deepEqual(parseQuizMode('?mode=review&domain=security-permissions&level=advanced'), {
    mode: 'review',
    domain: 'security-permissions',
    level: 'advanced',
  });
});

test('parseQuizMode は復習モードで domain / level が片方だけなら null', () => {
  assert.equal(parseQuizMode('?mode=review&domain=security-permissions'), null);
  assert.equal(parseQuizMode('?mode=review&level=advanced'), null);
});

test('parseQuizMode は復習モードで未知の domain / level なら null', () => {
  assert.equal(parseQuizMode('?mode=review&domain=not-a-domain&level=advanced'), null);
  assert.equal(parseQuizMode('?mode=review&domain=security-permissions&level=godlike'), null);
});

test('parseQuizMode は未知の mode を null にする', () => {
  assert.equal(parseQuizMode('?mode=practice&domain=basic-operations&level=beginner'), null);
});

test('buildStageLabel は通常モードで領域 / レベルを返す', () => {
  assert.equal(
    buildStageLabel({ mode: 'normal', domain: 'basic-operations', level: 'beginner' }),
    '基本操作・CLI使用法 / 初級'
  );
});

test('buildStageLabel は復習（ステージ指定）で復習ラベルを返す', () => {
  assert.equal(
    buildStageLabel({ mode: 'review', domain: 'security-permissions', level: 'advanced' }),
    '復習 / 安全性・権限管理 上級'
  );
});

test('buildStageLabel は復習（全領域）で「すべての領域」を返す', () => {
  assert.equal(buildStageLabel({ mode: 'review', domain: null, level: null }), '復習 / すべての領域');
});

// fetch のスタブ。domain名 -> 問題配列 or 'fail'
function makeFetch(map) {
  return async url => {
    const domain = url.replace('data/questions/', '').replace('.json', '');
    const entry = map[domain];
    if (entry === 'fail' || entry === undefined) {
      return { ok: false, url, async json() { throw new Error('not json'); } };
    }
    return { ok: true, url, async json() { return { domain, questions: entry }; } };
  };
}

function q(id, level, overrides = {}) {
  return {
    id,
    level,
    question: `${id} の問題文`,
    choices: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: `${id} の解説`,
    ...overrides,
  };
}

function tenQuestions(prefix, level) {
  return Array.from({ length: 10 }, (_, i) => q(`${prefix}-${String(i).padStart(3, '0')}`, level));
}

test('fetchDomainQuestions は各問題に domain を付与する', async () => {
  const fetchImpl = makeFetch({ 'basic-operations': [q('basic-001', 'beginner')] });
  const questions = await fetchDomainQuestions('basic-operations', fetchImpl);
  assert.equal(questions[0].domain, 'basic-operations');
  assert.equal(questions[0].id, 'basic-001');
});

test('fetchDomainQuestions は ok でなければ例外を投げる', async () => {
  const fetchImpl = makeFetch({ 'basic-operations': 'fail' });
  await assert.rejects(() => fetchDomainQuestions('basic-operations', fetchImpl));
});

test('loadQuestionsForTarget は通常モードで 10 問を返す', async () => {
  const fetchImpl = makeFetch({ 'basic-operations': tenQuestions('basic', 'beginner') });
  const target = { mode: 'normal', domain: 'basic-operations', level: 'beginner' };
  const questions = await loadQuestionsForTarget(target, { version: REVIEW_VERSION, items: {} }, fetchImpl, () => 0);
  assert.equal(questions.length, 10);
  assert.ok(questions.every(item => item.domain === 'basic-operations'));
});

test('loadQuestionsForTarget は復習モードで誤答した問題だけを返す', async () => {
  const fetchImpl = makeFetch({ 'security-permissions': tenQuestions('security', 'advanced') });
  const review = {
    version: REVIEW_VERSION,
    items: {
      'security-000': { domain: 'security-permissions', level: 'advanced', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
      'security-001': { domain: 'security-permissions', level: 'advanced', wrongCount: 1, lastResult: 'correct', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: 'security-permissions', level: 'advanced' };
  const questions = await loadQuestionsForTarget(target, review, fetchImpl, () => 0);
  assert.deepEqual(questions.map(item => item.id), ['security-000']);
});

test('loadQuestionsForTarget は全領域復習で複数領域から集める', async () => {
  const fetchImpl = makeFetch({
    'basic-operations': tenQuestions('basic', 'beginner'),
    'feature-usage': tenQuestions('feature', 'beginner'),
    'prompt-design': tenQuestions('prompt', 'beginner'),
    'security-permissions': tenQuestions('security', 'advanced'),
    'token-efficiency': tenQuestions('token', 'beginner'),
  });
  const review = {
    version: REVIEW_VERSION,
    items: {
      'basic-000': { domain: 'basic-operations', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
      'security-000': { domain: 'security-permissions', level: 'advanced', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: null, level: null };
  const questions = await loadQuestionsForTarget(target, review, fetchImpl, () => 0);
  assert.deepEqual(questions.map(item => item.id).sort(), ['basic-000', 'security-000']);
});

test('全領域復習は一部の領域の取得に失敗しても、取れた領域だけで出題する', async () => {
  const fetchImpl = makeFetch({
    'basic-operations': tenQuestions('basic', 'beginner'),
    'feature-usage': 'fail',
    'prompt-design': 'fail',
    'security-permissions': 'fail',
    'token-efficiency': 'fail',
  });
  const review = {
    version: REVIEW_VERSION,
    items: {
      'basic-000': { domain: 'basic-operations', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
      'feature-000': { domain: 'feature-usage', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: null, level: null };
  const questions = await loadQuestionsForTarget(target, review, fetchImpl, () => 0);
  assert.deepEqual(questions.map(item => item.id), ['basic-000']);
});

test('全領域復習で全ての領域の取得に失敗したら例外を投げる', async () => {
  const fetchImpl = makeFetch({});
  const review = {
    version: REVIEW_VERSION,
    items: {
      'basic-000': { domain: 'basic-operations', level: 'beginner', wrongCount: 1, lastResult: 'wrong', lastAnsweredAt: 'x' },
    },
  };
  const target = { mode: 'review', domain: null, level: null };
  await assert.rejects(() => loadQuestionsForTarget(target, review, fetchImpl, () => 0));
});

test('復習モードは対象が 0 問なら空配列を返す（例外にしない）', async () => {
  const fetchImpl = makeFetch({ 'security-permissions': tenQuestions('security', 'advanced') });
  const target = { mode: 'review', domain: 'security-permissions', level: 'advanced' };
  const questions = await loadQuestionsForTarget(target, { version: REVIEW_VERSION, items: {} }, fetchImpl, () => 0);
  assert.deepEqual(questions, []);
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/quiz-modes.test.js`
Expected: FAIL（`Cannot find module '../js/quiz-modes.js'`）

- [ ] **Step 3a: quiz-engine.js の shuffleChoices を export する**

`js/quiz-engine.js` の 10 行目を以下に変更する。関数の中身は一切変えない。

```javascript
export function shuffleChoices(question, rng) {
```

選択肢シャッフルの規則は通常ステージと復習で同一である必要があるため（spec:
「選択肢シャッフル・出題順シャッフルは通常ステージと同じ」）、実装は 1 つに保つ。

- [ ] **Step 3b: 最小の実装を書く**

`js/quiz-modes.js` を新規作成する。

```javascript
import { DOMAINS, DOMAIN_LABELS, QUESTIONS_PER_STAGE } from './progress.js';
import { LEVELS, LEVEL_LABELS } from './level-judge.js';
import { selectQuestions, shuffleChoices } from './quiz-engine.js';
import { selectReviewQuestions } from './review.js';

// URLの解釈だけを担う。不正な組み合わせはすべてnullにし、
// 呼び出し側は「nullならダッシュボードへ戻す」の一手で済ませられる。
export function parseQuizMode(search) {
  const params = new URLSearchParams(search);
  const mode = params.get('mode') ?? 'normal';
  const domain = params.get('domain');
  const level = params.get('level');

  if (mode === 'normal') {
    if (!DOMAINS.includes(domain) || !LEVELS.includes(level)) return null;
    return { mode: 'normal', domain, level };
  }

  if (mode === 'review') {
    // 全領域復習はdomain/levelを持たない。片方だけの指定は
    // 壊れたリンクなので、絞り込みを勝手に緩めず弾く。
    if (domain === null && level === null) {
      return { mode: 'review', domain: null, level: null };
    }
    if (!DOMAINS.includes(domain) || !LEVELS.includes(level)) return null;
    return { mode: 'review', domain, level };
  }

  return null;
}

export function buildStageLabel(target) {
  if (target.mode === 'review') {
    if (target.domain === null) return '復習 / すべての領域';
    return `復習 / ${DOMAIN_LABELS[target.domain]} ${LEVEL_LABELS[target.level]}`;
  }
  return `${DOMAIN_LABELS[target.domain]} / ${LEVEL_LABELS[target.level]}`;
}

// 問題データのJSONは領域名を各問題に持たせていないため、ここで補う。
// 復習では複数領域が混ざるので、問題自身がdomainを知っている必要がある。
export async function fetchDomainQuestions(domain, fetchImpl) {
  const response = await fetchImpl(`data/questions/${domain}.json`);
  if (!response.ok) throw new Error(`Failed to load ${response.url}`);
  const domainData = await response.json();
  return domainData.questions.map(question => ({ ...question, domain }));
}

async function loadReviewPool(target, fetchImpl) {
  const domains = target.domain === null ? DOMAINS : [target.domain];
  const settled = await Promise.allSettled(
    domains.map(domain => fetchDomainQuestions(domain, fetchImpl))
  );

  const fulfilled = settled.filter(item => item.status === 'fulfilled');
  // 一部の領域だけ落ちたなら、取れた領域だけで復習できる方が有用。
  // 全滅したときだけ、呼び出し側に読み込みエラーを見せる。
  if (fulfilled.length === 0) {
    throw new Error('Failed to load every question domain');
  }
  return fulfilled.flatMap(item => item.value);
}

export async function loadQuestionsForTarget(target, review, fetchImpl, rng = Math.random) {
  if (target.mode === 'review') {
    const pool = await loadReviewPool(target, fetchImpl);
    const filter = target.domain === null ? {} : { domain: target.domain, level: target.level };
    return selectReviewQuestions(review, pool, filter, rng).map(question =>
      shuffleChoices(question, rng)
    );
  }

  const pool = await fetchDomainQuestions(target.domain, fetchImpl);
  return selectQuestions(
    { domain: target.domain, questions: pool },
    target.level,
    QUESTIONS_PER_STAGE,
    rng
  );
}
```

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test tests/quiz-modes.test.js`
Expected: PASS

- [ ] **Step 5: 全テストを実行する**

Run: `node --test`
Expected: PASS

- [ ] **Step 6: コミット**

```bash
git add js/quiz-engine.js js/quiz-modes.js tests/quiz-modes.test.js
git commit -m "feat: 出題モードの差分を quiz-modes に切り出す"
```

---

### Task 6: 挑戦画面のモード対応

**Files:**
- Modify: `js/quiz-page.js`
- Test: `tests/quiz-page-invariants.test.js`（新規）

**Interfaces:**
- Consumes: Task 5 の `parseQuizMode` / `buildStageLabel` / `loadQuestionsForTarget`、Task 1–3 の `normalizeReview` / `recordAnswers`、Task 4 の `saveReviewRaw` / `loadReviewRaw`
- Produces: `sessionStorage` のステージ結果に `isReview: boolean` フィールドが加わる（Task 7 が読む）
  - 復習モードの結果オブジェクト: `{ isReview: true, stageLabel: string, score, total, wrongAnswers, completedAt, reviewDomain: string | null, reviewLevel: string | null }`
  - 通常モードの結果オブジェクト: 既存フィールドに `isReview: false` を追加したもの

`js/quiz-page.js` は DOM を触るため直接テストしない。代わりに、**不変条件をソースの静的検査で固定する**テストを書く。復習モードが進捗を更新しないことは spec で最重要の不変条件であり、これが壊れるとゲートが形骸化する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/quiz-page-invariants.test.js` を新規作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(path.join(ROOT, 'js', 'quiz-page.js'), 'utf8');

// 復習モードが cc-diagnosis-progress を書き換えないことは、
// ゲート構造を守るうえで最も重要な不変条件。
// quiz-page.js はDOMに依存して直接テストできないため、
// 進捗更新が「通常モードのときだけ」呼ばれる形をソース上で固定する。
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} が quiz-page.js に見つかりません`);

  let depth = 0;
  let started = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === '{') {
      depth += 1;
      started = true;
    } else if (source[i] === '}') {
      depth -= 1;
      if (started && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`${name} の本体を取り出せませんでした`);
}

test('進捗の更新・保存は finishNormalStage の中だけで行う', () => {
  const normalBody = extractFunction('finishNormalStage');
  assert.ok(normalBody.includes('recordAttempt('), 'finishNormalStage が recordAttempt を呼んでいません');
  assert.ok(normalBody.includes('saveProgressRaw('), 'finishNormalStage が saveProgressRaw を呼んでいません');

  const outside = source.split(normalBody).join('');
  assert.ok(
    !outside.includes('recordAttempt('),
    'finishNormalStage の外で recordAttempt が呼ばれています（復習モードがゲートを汚染します）'
  );
  assert.ok(
    !outside.includes('saveProgressRaw('),
    'finishNormalStage の外で saveProgressRaw が呼ばれています（復習モードがゲートを汚染します）'
  );
});

test('finishReviewStage は進捗に触れず、誤答履歴だけを保存する', () => {
  const reviewBody = extractFunction('finishReviewStage');
  assert.ok(!reviewBody.includes('recordAttempt('), 'finishReviewStage が recordAttempt を呼んでいます');
  assert.ok(!reviewBody.includes('saveProgressRaw('), 'finishReviewStage が saveProgressRaw を呼んでいます');
  assert.ok(reviewBody.includes('persistReview('), 'finishReviewStage が誤答履歴を保存していません');
});

test('誤答履歴の保存失敗は showSaveFailure を発火させない', () => {
  const persistBody = extractFunction('persistReview');
  assert.ok(
    !persistBody.includes('showSaveFailure('),
    '誤答履歴の保存失敗で結果画面への遷移を止めてはいけません'
  );
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/quiz-page-invariants.test.js`
Expected: FAIL（`finishNormalStage が quiz-page.js に見つかりません`）

- [ ] **Step 3: quiz-page.js を書き換える**

`js/quiz-page.js` の 1〜12 行目の import 群を以下に差し替える。

```javascript
import { scoreStage, collectWrongAnswers } from './quiz-engine.js';
import {
  DOMAIN_LABELS,
  normalizeProgress,
  recordAttempt,
  getStageStatus,
  isPassed,
} from './progress.js';
import { normalizeReview, recordAnswers } from './review.js';
import {
  loadProgressRaw,
  saveProgressRaw,
  saveStageResult,
  loadReviewRaw,
  saveReviewRaw,
} from './storage.js';
import { LEVELS, LEVEL_LABELS } from './level-judge.js';
import { parseQuizMode, buildStageLabel, loadQuestionsForTarget } from './quiz-modes.js';
```

`showSaveFailure`（36〜54 行目）を以下に差し替える。復習モードでは合格／不合格を出さないため、判定文言を引数で受け取る形にする。

```javascript
// 保存に失敗した場合は遷移せず、その場で結果を伝える。
// 結果画面はsessionStorage経由でデータを受け取るため、
// 保存できていない状態で遷移すると解答内容が失われる。
function showSaveFailure(headline, detail) {
  progressLabel.textContent = '';
  choiceListEl.innerHTML = '';
  answerFeedbackEl.style.display = 'none';
  nextButton.style.display = 'none';

  questionTextEl.textContent = headline;

  answerExplanationEl.textContent = detail;
  answerExplanationEl.style.display = 'block';

  const backLink = document.createElement('a');
  backLink.className = 'button';
  backLink.href = 'index.html';
  backLink.textContent = 'ダッシュボードに戻る';
  choiceListEl.appendChild(backLink);
}
```

`main()`（102〜198 行目）を以下に差し替える。

```javascript
// 誤答履歴の保存はゲートの前提ではないため、失敗しても挑戦の完了を止めない。
// 保存できない環境では何も残らないという既存の挙動と一貫している。
function persistReview(questions, answers, fallbackDomain) {
  const review = normalizeReview(loadReviewRaw());
  const updated = recordAnswers(review, questions, answers, new Date(), fallbackDomain);
  saveReviewRaw(updated);
}

async function main() {
  const target = parseQuizMode(window.location.search);

  // 不正なURLや古いブックマークからの流入はダッシュボードへ戻す。
  if (target === null) {
    goToDashboard();
    return;
  }

  const progress = normalizeProgress(loadProgressRaw());

  // URL直打ちでロック中のステージに入られた場合も戻す。
  // 厳密な防御ではないが、ゲート構造の一貫性を保つ。
  // 復習はゲートに影響しないため、この検査の対象外。
  if (
    target.mode === 'normal' &&
    getStageStatus(progress, target.domain, target.level) === 'locked'
  ) {
    goToDashboard();
    return;
  }

  const stageLabel = buildStageLabel(target);
  stageLabelEl.textContent = stageLabel;

  let questions;
  try {
    questions = await loadQuestionsForTarget(
      target,
      normalizeReview(loadReviewRaw()),
      fetch,
      Math.random
    );
  } catch (err) {
    showLoadError();
    return;
  }

  // 別タブで復習を終えた後やURL直打ちでは、対象が0問になりうる。
  if (questions.length === 0) {
    goToDashboard();
    return;
  }

  const answers = {};
  let currentIndex = 0;
  let hasAnswered = false;

  function handleAnswer(choiceIndex) {
    if (hasAnswered) return;
    hasAnswered = true;
    answers[questions[currentIndex].id] = choiceIndex;
    const isLastQuestion = currentIndex === questions.length - 1;
    showAnswerFeedback(questions[currentIndex], choiceIndex, isLastQuestion);
  }

  function finishNormalStage() {
    const { domain, level } = target;
    const domainLabel = DOMAIN_LABELS[domain];
    const score = scoreStage(questions, answers);
    const passed = isPassed(score);
    const wasCleared = getStageStatus(progress, domain, level) === 'cleared';

    const updatedProgress = recordAttempt(progress, domain, level, score);
    const progressSaved = saveProgressRaw(updatedProgress) !== 'none';

    persistReview(questions, answers, domain);

    // 今回の合格で新たに開いたレベルだけを案内する。
    // すでに合格済みのステージを再挑戦した場合は、新たな開放はない。
    let unlockedLevel = null;
    if (passed && !wasCleared) {
      const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
      if (nextLevel) unlockedLevel = nextLevel;
    }

    const stageResultSaved = saveStageResult({
      isReview: false,
      domain,
      domainLabel,
      level,
      score,
      total: questions.length,
      passed,
      unlockedLevel,
      wrongAnswers: collectWrongAnswers(questions, answers, domainLabel),
      completedAt: new Date().toISOString(),
    });

    // 保存できていないまま遷移すると、結果画面が「結果がありません」になり
    // 10問分の解答が黙って失われる。この場では結果だけでも見せる。
    if (!stageResultSaved || !progressSaved) {
      showSaveFailure(
        `${score} / ${questions.length} 問正解（${passed ? '合格' : '不合格'}）`,
        progressSaved
          ? 'ブラウザの設定により結果画面へ引き継げませんでした。進捗は保存されています。'
          : 'ブラウザの設定により進捗を保存できませんでした。この結果は記録されていません。'
      );
      return;
    }

    window.location.href = 'result.html';
  }

  // 復習は練習であり実力判定ではない。cc-diagnosis-progress には一切触れない。
  // ここでrecordAttemptを呼ぶと、見たことのある問題で合格でき、ゲートが形骸化する。
  function finishReviewStage() {
    const score = scoreStage(questions, answers);

    persistReview(questions, answers, target.domain);

    const stageResultSaved = saveStageResult({
      isReview: true,
      stageLabel,
      reviewDomain: target.domain,
      reviewLevel: target.level,
      score,
      total: questions.length,
      wrongAnswers: collectWrongAnswers(questions, answers, ''),
      completedAt: new Date().toISOString(),
    });

    if (!stageResultSaved) {
      showSaveFailure(
        `${score} / ${questions.length} 問正解`,
        'ブラウザの設定により結果画面へ引き継げませんでした。誤答履歴は更新されています。'
      );
      return;
    }

    window.location.href = 'result.html';
  }

  function goToNext() {
    if (currentIndex < questions.length - 1) {
      currentIndex += 1;
      hasAnswered = false;
      renderQuestion(questions, currentIndex, handleAnswer);
    } else if (target.mode === 'review') {
      finishReviewStage();
    } else {
      finishNormalStage();
    }
  }

  nextButton.addEventListener('click', goToNext);
  renderQuestion(questions, currentIndex, handleAnswer);
}

main();
```

`collectWrongAnswers` に渡す `domainLabel` は復習モードでは領域が混ざるため空文字にする。結果画面はこの値を表示していないため実害はない。

- [ ] **Step 4: テストを実行して通ることを確認する**

Run: `node --test tests/quiz-page-invariants.test.js`
Expected: PASS（全 3 テスト）

- [ ] **Step 5: 全テストを実行する**

Run: `node --test`
Expected: PASS

- [ ] **Step 6: 動作を目で確認する**

```bash
python3 -m http.server 8000
```

ブラウザで確認する:
1. `http://localhost:8000/` → 初級ステージに挑戦し、わざと数問間違えて完了する
2. DevTools のコンソールで `JSON.parse(localStorage['cc-diagnosis-review'])` を実行 → 間違えた問題の ID が `lastResult: "wrong"` で入っていること
3. `http://localhost:8000/quiz.html?mode=review` → 間違えた問題だけが出題されること
4. 復習を完了する前後で `JSON.parse(localStorage['cc-diagnosis-progress'])` を比較 → **一切変化しないこと**
5. `http://localhost:8000/quiz.html?mode=review&domain=basic-operations&level=beginner` → ステージラベルが `復習 / 基本操作・CLI使用法 初級` であること
6. `http://localhost:8000/quiz.html?mode=review&domain=token-efficiency&level=expert`（誤答なし）→ ダッシュボードへ戻ること

- [ ] **Step 7: コミット**

```bash
git add js/quiz-page.js tests/quiz-page-invariants.test.js
git commit -m "feat: 挑戦画面を復習モードに対応させ、誤答履歴を記録する"
```

---

### Task 7: 結果画面の復習モード表示

**Files:**
- Modify: `js/result-page.js`
- Test: 手動確認（この画面は既存もテストを持たない DOM スクリプトのため）

**Interfaces:**
- Consumes: Task 6 が `sessionStorage` に書く `{ isReview, stageLabel, reviewDomain, reviewLevel, score, total, wrongAnswers }`
- Produces: なし（末端）

復習モードでは spec の通り、合格／不合格の判定・合格ラインの文言・学習アドバイス・レベル開放の案内を出さず、
`8 / 12 問正解` と誤答レビューだけを表示する。導線は「もう一度復習する」「ダッシュボードに戻る」。

- [ ] **Step 1: 復習モードの分岐を追加する**

`js/result-page.js` の 17 行目の分割代入を以下に差し替える。

```javascript
  const {
    isReview,
    domain,
    domainLabel,
    level,
    score,
    total,
    passed,
    unlockedLevel,
    wrongAnswers,
    stageLabel,
    reviewDomain,
    reviewLevel,
  } = stageResult;
```

19〜63 行目（`stage-label` の設定から学習アドバイスまで）を以下に差し替える。

```javascript
  const actionsEl = document.getElementById('result-actions');
  const verdictEl = document.getElementById('verdict');

  if (isReview) {
    // 復習は練習であって実力判定ではないため、合否も合格ラインも出さない。
    // 学習アドバイスとレベル開放の案内も、ゲートに紐づくものなので出さない。
    document.getElementById('stage-label').textContent = stageLabel;
    verdictEl.textContent = '復習おつかれさまでした';
    verdictEl.className = 'verdict';
    document.getElementById('score-line').textContent = `${score} / ${total} 問正解`;

    const retryLink = document.createElement('a');
    retryLink.className = 'button';
    retryLink.href =
      reviewDomain === null
        ? 'quiz.html?mode=review'
        : `quiz.html?mode=review&domain=${encodeURIComponent(reviewDomain)}&level=${encodeURIComponent(reviewLevel)}`;
    retryLink.textContent = 'もう一度復習する';
    actionsEl.appendChild(retryLink);
  } else {
    document.getElementById('stage-label').textContent =
      `${domainLabel} / ${LEVEL_LABELS[level]}`;

    verdictEl.textContent = passed ? '合格！' : '不合格';
    verdictEl.className = passed ? 'verdict passed' : 'verdict failed';

    document.getElementById('score-line').textContent =
      `${score} / ${total} 問正解（合格ラインは ${PASSING_SCORE} 問）`;

    if (unlockedLevel) {
      const unlockNoticeEl = document.getElementById('unlock-notice');
      unlockNoticeEl.textContent = `${LEVEL_LABELS[unlockedLevel]}が開放されました！`;
      unlockNoticeEl.style.display = 'block';

      const nextLink = document.createElement('a');
      nextLink.className = 'button';
      nextLink.href = `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(unlockedLevel)}`;
      nextLink.textContent = `${LEVEL_LABELS[unlockedLevel]}に挑戦する`;
      actionsEl.appendChild(nextLink);
    }

    if (!passed) {
      const retryLink = document.createElement('a');
      retryLink.className = 'button';
      retryLink.href = `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
      retryLink.textContent = 'もう一度挑戦する';
      actionsEl.appendChild(retryLink);

      // 不合格のときだけ、そのレベルの学習アドバイスを示す。
      document.getElementById('advice-card').style.display = 'block';
      document.getElementById('advice-text').textContent = getStudyAdvice(domain, level);
    }
  }

  const dashboardLink = document.createElement('a');
  dashboardLink.className = 'button secondary';
  dashboardLink.href = 'index.html';
  dashboardLink.textContent = 'ダッシュボードに戻る';
  actionsEl.appendChild(dashboardLink);
```

続く「間違えた問題」の描画（既存 65 行目以降）はそのまま残す。ただし全問正解時の文言は復習モードでも自然なため変更不要。

- [ ] **Step 2: 全テストを実行して回帰がないことを確認する**

Run: `node --test`
Expected: PASS

- [ ] **Step 3: 動作を目で確認する**

```bash
python3 -m http.server 8000
```

1. 通常ステージを完了 → 従来どおり合否・合格ライン・（不合格なら）学習アドバイスが出ること
2. `quiz.html?mode=review` を完了 → `復習 / すべての領域`、`N / M 問正解`（合格ラインの文言なし）、学習アドバイスなし、「もう一度復習する」ボタンがあること
3. 「もう一度復習する」を押す → 復習モードに戻ること（正解済みの問題は出題対象から外れているので、全問正解していれば対象 0 問でダッシュボードへ戻る）

- [ ] **Step 4: コミット**

```bash
git add js/result-page.js
git commit -m "feat: 結果画面を復習モードに対応させる"
```

---

### Task 8: ダッシュボードのバッジと全体復習ボタン

**Files:**
- Modify: `js/top-page.js`
- Modify: `index.html`
- Modify: `css/style.css`
- Test: 手動確認（DOM スクリプトのため。集計ロジックは Task 3 でテスト済み）

**Interfaces:**
- Consumes: Task 1–3 の `normalizeReview` / `countUnreviewedByStage` / `countUnreviewedTotal`、Task 4 の `loadReviewRaw`
- Produces: なし（末端）

ステージセルを `<a>` / `<span>` から `<div>` + 内部リンク 2 つに変える。入れ子リンクは HTML として不正で、
スクリーンリーダーの挙動も壊れるため、`preventDefault` で遷移先を差し替える方式は採らない。

- [ ] **Step 1: index.html に全体復習ボタンの置き場所を追加する**

`index.html` の 23 行目 `<div id="dashboard"></div>` の直後に追加する。

```html
      <div id="dashboard"></div>
      <div class="actions" id="review-all" style="display: none;"></div>
```

- [ ] **Step 2: top-page.js を書き換える**

`js/top-page.js` の 1〜3 行目を以下に差し替える。

```javascript
import { buildDashboard, normalizeProgress, QUESTIONS_PER_STAGE } from './progress.js';
import { loadProgressRaw, loadReviewRaw } from './storage.js';
import { normalizeReview, countUnreviewedByStage, countUnreviewedTotal } from './review.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';
```

7〜12 行目に要素取得と履歴の読み込みを追加する。

```javascript
const dashboardEl = document.getElementById('dashboard');
const overallProgressEl = document.getElementById('overall-progress');
const storageNoticeEl = document.getElementById('storage-notice');
const reviewAllEl = document.getElementById('review-all');

const progress = normalizeProgress(loadProgressRaw());
const dashboard = buildDashboard(progress);
const review = normalizeReview(loadReviewRaw());
const unreviewedCounts = countUnreviewedByStage(review);
```

`renderStageCell`（19〜51 行目）を以下に差し替える。

```javascript
function stageUrl(domain, level) {
  return `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
}

function reviewUrl(domain, level) {
  return `quiz.html?mode=review&domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
}

// 誤答バッジはセル本体とは別の遷移先を持つ。入れ子の<a>はHTMLとして不正で
// スクリーンリーダーの挙動も壊れるため、セルを<div>にしてリンクを2つ並べる。
function renderBadge(domain, domainLabel, level, count) {
  const badge = document.createElement('a');
  badge.className = 'stage-badge';
  badge.href = reviewUrl(domain, level);
  badge.textContent = `⚠${count}`;
  badge.setAttribute(
    'aria-label',
    `${domainLabel} ${LEVEL_LABELS[level]}の誤答${count}問を復習`
  );
  badge.title = `誤答${count}問を復習する`;
  return badge;
}

function renderStageCell(domain, domainLabel, stage) {
  const { level, status, record } = stage;
  const stageName = `${domainLabel} ${LEVEL_LABELS[level]}`;
  const unreviewed = unreviewedCounts[domain][level];

  const cell = document.createElement('div');
  cell.className = `stage-cell ${status}`;

  // セル本体（マーク・レベル名・スコア）は、ロック中を除いて挑戦リンクにする。
  const main = document.createElement(status === 'locked' ? 'span' : 'a');
  main.className = 'stage-cell-main';

  if (status === 'locked') {
    main.title = lockedReason(level);
    main.setAttribute('aria-label', `${stageName}（未開放）${lockedReason(level)}`);
  } else {
    main.href = stageUrl(domain, level);
    const action = status === 'cleared' ? '合格済み、再挑戦する' : '挑戦する';
    main.setAttribute('aria-label', `${stageName}（${action}）`);
  }

  const markEl = document.createElement('span');
  markEl.className = `stage-mark ${status}`;
  markEl.textContent = STATUS_MARKS[status];
  main.appendChild(markEl);

  const levelEl = document.createElement('span');
  levelEl.className = 'stage-level';
  levelEl.textContent = LEVEL_LABELS[level];
  main.appendChild(levelEl);

  const scoreEl = document.createElement('span');
  scoreEl.className = 'stage-score';
  scoreEl.textContent = record ? `${record.bestScore}/${QUESTIONS_PER_STAGE}` : '';
  main.appendChild(scoreEl);

  cell.appendChild(main);

  // バッジは合格状態とは独立。合格済みでも誤答が残れば表示する。
  // ロック中のセルにも出す。復習はゲートに影響しないため塞ぐ理由がない。
  if (unreviewed > 0) {
    cell.appendChild(renderBadge(domain, domainLabel, level, unreviewed));
  }

  return cell;
}
```

ファイル末尾（`overallProgressEl.textContent = ...` の直後、`canPersist` の定義より前）に全体復習ボタンを追加する。

```javascript
// 誤答が1件も無ければボタン自体を出さない。押しても行き先が無いため。
const unreviewedTotal = countUnreviewedTotal(review);
if (unreviewedTotal > 0) {
  const reviewAllLink = document.createElement('a');
  reviewAllLink.className = 'button secondary';
  reviewAllLink.href = 'quiz.html?mode=review';
  reviewAllLink.textContent = `すべての誤答を復習（${unreviewedTotal}問）`;
  reviewAllLink.setAttribute('aria-label', `すべての領域の誤答${unreviewedTotal}問を復習`);
  reviewAllEl.appendChild(reviewAllLink);
  reviewAllEl.style.display = 'flex';
}
```

- [ ] **Step 3: CSS を更新する**

`css/style.css` の `.stage-cell`（265 行目付近）から `a.stage-cell:hover`（294 行目付近）までのブロックを以下に差し替える。

```css
.stage-cell {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  text-align: center;
}

.stage-cell-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.7rem 0.3rem;
  text-decoration: none;
  color: inherit;
  border-radius: 5px;
}

.stage-cell.cleared {
  background: #eaf7ee;
  border-color: #7bc48a;
}

.stage-cell.available {
  background: #fff;
  border-color: #4a90d9;
}

.stage-cell.locked {
  background: #f2f2f2;
  color: #999;
}

.stage-cell.locked .stage-cell-main {
  cursor: not-allowed;
}

.stage-cell:has(a.stage-cell-main:hover) {
  border-width: 2px;
}

.stage-cell:has(a.stage-cell-main:hover) .stage-cell-main {
  padding: calc(0.7rem - 1px) calc(0.3rem - 1px);
}

/* 誤答バッジはセル本体とは別のリンク。色だけに頼らず ⚠ と数字で示す。 */
.stage-badge {
  display: block;
  margin: 0 0.3rem 0.4rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  background: #fbeaea;
  border: 1px solid #d98a8a;
  color: #a33;
  font-size: 0.75rem;
  text-decoration: none;
  line-height: 1.4;
}

.stage-badge:hover {
  background: #f6d8d8;
}
```

`@media print` ブロック（232 行目付近）の `.no-print { display: none !important; }` の後に追記する。バッジは印刷時も表示する（誤答の所在は紙でも有用なため）。`.stage-badge` は `.no-print` を持たないので既定で印刷される。明示のため色の維持だけ指定する。

```css
  .stage-badge {
    background: #fbeaea;
    border-color: #d98a8a;
    color: #a33;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
```

- [ ] **Step 4: 全テストを実行して回帰がないことを確認する**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: 動作を目で確認する**

```bash
python3 -m http.server 8000
```

1. 誤答のない状態（`localStorage.removeItem('cc-diagnosis-review')` 後にリロード）→ バッジも全体復習ボタンも出ないこと
2. ステージを間違えて完了 → 該当セルに `⚠N` が出ること、進捗カードの下に「すべての誤答を復習（N問）」が出ること
3. セル本体をクリック → 通常ステージへ。バッジをクリック → そのステージの復習へ（URL に `mode=review` が入ること）
4. ロック中（🔒）のセルに誤答を仕込んで（DevTools で `cc-diagnosis-review` を編集）リロード → バッジが出てクリックで復習に入れること
5. 合格済み（✅）のセルにも誤答が残っていればバッジが出ること
6. `Cmd+P` で印刷プレビュー → バッジが表示されていること
7. ブラウザ幅を 400px 程度に縮めて崩れないこと

- [ ] **Step 6: コミット**

```bash
git add index.html js/top-page.js css/style.css
git commit -m "feat: ダッシュボードに誤答バッジと全体復習ボタンを追加"
```

---

### Task 9: README の更新

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1–8 の全機能
- Produces: なし（末端）

- [ ] **Step 1: README の内容を確認する**

Run: `cat README.md`

構成（ファイル一覧・データ保存・テストの実行など）を把握し、以下の内容を既存の書き方に合わせて追記する。

- **復習モード**: 誤答した問題は `localStorage['cc-diagnosis-review']` に問題 ID 単位で蓄積される。ダッシュボードのステージセルに出る `⚠N` バッジ、または進捗カード下の「すべての誤答を復習」から復習できる。復習は練習であり、**ゲート（合格判定・レベル開放）には一切影響しない**
- **URL**: `quiz.html?mode=review`（全領域）／`quiz.html?mode=review&domain=<領域>&level=<レベル>`（ステージ指定）。1 回の出題は最大 20 問
- **誤答が消えるタイミング**: 復習で正解すると `⚠` から外れる。誤答した回数（`wrongCount`）は残る
- **ファイル一覧**: `js/review.js`（誤答履歴の純粋関数）、`js/quiz-modes.js`（出題モードの差分）を追加
- **保存データ**: `cc-diagnosis-review` を追加。進捗（`cc-diagnosis-progress`）とは別キーで、片方が壊れてももう片方は失われない

- [ ] **Step 2: 追記する**

上記の内容を README の該当セクションに反映する。新しい見出しを作る場合は既存の見出しレベルに合わせる。

- [ ] **Step 3: 全テストを実行する**

Run: `node --test`
Expected: PASS

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "docs: 復習モードの説明を README に追加"
```

---

## 最終確認

- [ ] `node --test` が全件パスする
- [ ] `git status` がクリーン
- [ ] 通常ステージ → 誤答 → ダッシュボードにバッジ → バッジから復習 → 全問正解 → バッジが消える、が一通り動く
- [ ] 復習の前後で `localStorage['cc-diagnosis-progress']` が一文字も変わらない
