# ステップアップ式問題集 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一発診断（50問通し・正答率で4段階判定）を、レベル関門式のステップアップ問題集（20ステージ・各10問・8問正解で合格）へ転換する。

**Architecture:** 進捗の中核ロジックを新規 `js/progress.js` に純関数として集約し、UIから完全に分離する。`quiz-engine.js` は単一ステージ用に縮小、`level-judge.js` はレベル語彙の定義のみに縮小する。3画面構成（index / quiz / result）は維持し、それぞれダッシュボード・ステージ挑戦・ステージ結果へ役割を入れ替える。

**Tech Stack:** バニラJavaScript（ES Modules）、ビルド不要。テストは Node 組み込みの `node --test`。DOM非依存の純関数のみを自動テストし、UIは手動確認。

設計書: `docs/superpowers/specs/2026-08-02-stepup-stage-mode-design.md`

## Global Constraints

- 領域ID（5つ、順序もこの通り）: `basic-operations` / `feature-usage` / `prompt-design` / `security-permissions` / `token-efficiency`
- レベルID（4つ、この順序が昇順）: `beginner` / `intermediate` / `advanced` / `expert`
- 1ステージの出題数: **10問**
- 合格ライン: **8問以上正解**（7問以下は不合格）
- 進捗の localStorage キー: `cc-diagnosis-progress`
- 進捗データの `version`: `1`
- 旧キー `cc-diagnosis-result` は読み書きしない（削除もしない）
- `data/questions/*.json` は一切変更しない
- ビルドツールは導入しない。依存パッケージを追加しない
- 合格済みステージは、再挑戦で不合格になっても `cleared: true` を維持する
- ステージのロック状態は保存しない。`cleared` から都度導出する
- 日本語UIテキストを使用する

---

### Task 1: `js/progress.js` — ゲート判定と進捗記録の中核

進捗データの構造定義、合格判定、ステージ状態の導出、挑戦記録を担う純粋ロジック。
このアプリの心臓部であり、DOMに一切依存しない。

**Files:**
- Create: `js/progress.js`
- Test: `tests/progress.test.js`

**Interfaces:**
- Consumes: `LEVELS`（`js/level-judge.js` の既存エクスポート。Task 2 で同モジュールを縮小するが `LEVELS` は残る）
- Produces:
  - `DOMAINS: string[]` — 領域IDの配列（表示順）
  - `DOMAIN_LABELS: Record<string, string>` — 領域IDから日本語ラベルへの対応
  - `QUESTIONS_PER_STAGE: number` — `10`
  - `PASSING_SCORE: number` — `8`
  - `PROGRESS_VERSION: number` — `1`
  - `createEmptyProgress(): Progress`
  - `isPassed(score: number): boolean`
  - `normalizeProgress(raw: unknown): Progress` — 破損データなら空の進捗を返す
  - `recordAttempt(progress, domain, level, score): Progress` — 純関数。新しいオブジェクトを返す
  - `getStageStatus(progress, domain, level): 'cleared' | 'available' | 'locked'`
  - `getStageRecord(progress, domain, level): StageRecord | null`
  - `buildDashboard(progress): Array<{domain, domainLabel, stages: Array<{level, status, record}>}>`

`Progress` は `{ version: number, domains: Record<string, Record<string, StageRecord|null>> }`。
`StageRecord` は `{ cleared: boolean, bestScore: number, attempts: number, lastAttemptAt: string }`。

- [ ] **Step 1: 失敗するテストを書く**

`tests/progress.test.js` を新規作成:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DOMAINS,
  DOMAIN_LABELS,
  QUESTIONS_PER_STAGE,
  PASSING_SCORE,
  createEmptyProgress,
  isPassed,
  normalizeProgress,
  recordAttempt,
  getStageStatus,
  getStageRecord,
  buildDashboard,
} from '../js/progress.js';

test('定数が設計どおりの値である', () => {
  assert.equal(QUESTIONS_PER_STAGE, 10);
  assert.equal(PASSING_SCORE, 8);
  assert.equal(DOMAINS.length, 5);
  assert.deepEqual(DOMAINS, [
    'basic-operations',
    'feature-usage',
    'prompt-design',
    'security-permissions',
    'token-efficiency',
  ]);
  for (const domain of DOMAINS) {
    assert.ok(DOMAIN_LABELS[domain], `${domain} のラベルが未定義`);
  }
});

test('合格ラインの境界: 7問は不合格、8問は合格', () => {
  assert.equal(isPassed(7), false);
  assert.equal(isPassed(8), true);
  assert.equal(isPassed(10), true);
  assert.equal(isPassed(0), false);
});

test('空の進捗では初級のみ挑戦可能で、他はロックされている', () => {
  const progress = createEmptyProgress();
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'available');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'locked');
  assert.equal(getStageStatus(progress, 'basic-operations', 'advanced'), 'locked');
  assert.equal(getStageStatus(progress, 'basic-operations', 'expert'), 'locked');
});

test('初級に合格すると中級が開放され、上級はロックされたまま', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 8);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
  assert.equal(getStageStatus(progress, 'basic-operations', 'advanced'), 'locked');
});

test('初級に不合格だと中級はロックされたまま', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 7);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'available');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'locked');
});

test('飛び級はできない: 中級に合格しても初級が未合格なら上級は開かない', () => {
  // 通常UIからは起こらないが、データ破損や手動改変への防御として検証する
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'intermediate', 10);
  assert.equal(getStageStatus(progress, 'basic-operations', 'advanced'), 'locked');
});

test('領域どうしは独立して進行する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 9);
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
  assert.equal(getStageStatus(progress, 'feature-usage', 'intermediate'), 'locked');
});

test('合格済みステージは再挑戦で不合格になっても cleared を維持する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 9);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 3);
  assert.equal(getStageStatus(progress, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'available');
});

test('bestScore は最高得点を保ち、attempts は挑戦のたびに増える', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 5);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 9);
  progress = recordAttempt(progress, 'basic-operations', 'beginner', 6);
  const record = getStageRecord(progress, 'basic-operations', 'beginner');
  assert.equal(record.bestScore, 9);
  assert.equal(record.attempts, 3);
  assert.equal(record.cleared, true);
  assert.ok(typeof record.lastAttemptAt === 'string' && record.lastAttemptAt.length > 0);
});

test('recordAttempt は純関数で、元のオブジェクトを変更しない', () => {
  const original = createEmptyProgress();
  const updated = recordAttempt(original, 'basic-operations', 'beginner', 10);
  assert.equal(getStageRecord(original, 'basic-operations', 'beginner'), null);
  assert.notEqual(original, updated);
  assert.equal(getStageRecord(updated, 'basic-operations', 'beginner').cleared, true);
});

test('未挑戦ステージの記録は null', () => {
  const progress = createEmptyProgress();
  assert.equal(getStageRecord(progress, 'feature-usage', 'expert'), null);
});

test('normalizeProgress は破損データを空の進捗に置き換える', () => {
  assert.deepEqual(normalizeProgress(null), createEmptyProgress());
  assert.deepEqual(normalizeProgress('壊れた文字列'), createEmptyProgress());
  assert.deepEqual(normalizeProgress({}), createEmptyProgress());
  assert.deepEqual(normalizeProgress({ version: 999, domains: {} }), createEmptyProgress());
  assert.deepEqual(normalizeProgress({ version: 1, domains: null }), createEmptyProgress());
});

test('normalizeProgress は正しい進捗をそのまま保持する', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'prompt-design', 'beginner', 8);
  const roundTripped = normalizeProgress(JSON.parse(JSON.stringify(progress)));
  assert.equal(getStageStatus(roundTripped, 'prompt-design', 'beginner'), 'cleared');
});

test('normalizeProgress は未知の領域・レベルのキーを取り除く', () => {
  const normalized = normalizeProgress({
    version: 1,
    domains: {
      'basic-operations': {
        beginner: { cleared: true, bestScore: 8, attempts: 1, lastAttemptAt: '2026-08-02T00:00:00.000Z' },
        'unknown-level': { cleared: true, bestScore: 10, attempts: 1, lastAttemptAt: '2026-08-02T00:00:00.000Z' },
      },
      'unknown-domain': { beginner: { cleared: true, bestScore: 10, attempts: 1, lastAttemptAt: '2026-08-02T00:00:00.000Z' } },
    },
  });
  assert.equal(getStageStatus(normalized, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(normalized.domains['unknown-domain'], undefined);
  assert.equal(normalized.domains['basic-operations']['unknown-level'], undefined);
});

test('buildDashboard は5領域それぞれに4ステージを返す', () => {
  let progress = createEmptyProgress();
  progress = recordAttempt(progress, 'feature-usage', 'beginner', 10);
  const dashboard = buildDashboard(progress);

  assert.equal(dashboard.length, 5);
  assert.equal(dashboard[0].domain, 'basic-operations');
  assert.equal(dashboard[0].domainLabel, DOMAIN_LABELS['basic-operations']);

  for (const row of dashboard) {
    assert.equal(row.stages.length, 4);
    assert.deepEqual(row.stages.map(s => s.level), ['beginner', 'intermediate', 'advanced', 'expert']);
  }

  const featureRow = dashboard.find(row => row.domain === 'feature-usage');
  assert.equal(featureRow.stages[0].status, 'cleared');
  assert.equal(featureRow.stages[0].record.bestScore, 10);
  assert.equal(featureRow.stages[1].status, 'available');
  assert.equal(featureRow.stages[2].status, 'locked');
  assert.equal(featureRow.stages[2].record, null);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/progress.test.js`
Expected: FAIL（`Cannot find module '../js/progress.js'` で全テストがエラーになる）

- [ ] **Step 3: `js/progress.js` を実装**

```javascript
import { LEVELS } from './level-judge.js';

export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
];

export const DOMAIN_LABELS = {
  'basic-operations': '基本操作・CLI使用法',
  'feature-usage': '機能活用',
  'prompt-design': 'プロンプト設計・協働作法',
  'security-permissions': '安全性・権限管理',
  'token-efficiency': 'トークン効率・コスト管理',
};

export const QUESTIONS_PER_STAGE = 10;
export const PASSING_SCORE = 8;
export const PROGRESS_VERSION = 1;

export function createEmptyProgress() {
  const domains = {};
  for (const domain of DOMAINS) {
    const levels = {};
    for (const level of LEVELS) {
      levels[level] = null;
    }
    domains[domain] = levels;
  }
  return { version: PROGRESS_VERSION, domains };
}

export function isPassed(score) {
  return score >= PASSING_SCORE;
}

function isValidRecord(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.cleared === 'boolean' &&
    typeof value.bestScore === 'number' &&
    typeof value.attempts === 'number' &&
    typeof value.lastAttemptAt === 'string'
  );
}

// 保存データは利用者が手で書き換えられるため、既知の領域・レベルと
// 妥当な形の記録だけを通す。壊れていれば黙って初期状態に戻す。
export function normalizeProgress(raw) {
  if (raw === null || typeof raw !== 'object') return createEmptyProgress();
  if (raw.version !== PROGRESS_VERSION) return createEmptyProgress();
  if (raw.domains === null || typeof raw.domains !== 'object') return createEmptyProgress();

  const normalized = createEmptyProgress();
  for (const domain of DOMAINS) {
    const rawLevels = raw.domains[domain];
    if (rawLevels === null || typeof rawLevels !== 'object') continue;
    for (const level of LEVELS) {
      const record = rawLevels[level];
      if (isValidRecord(record)) {
        normalized.domains[domain][level] = {
          cleared: record.cleared,
          bestScore: record.bestScore,
          attempts: record.attempts,
          lastAttemptAt: record.lastAttemptAt,
        };
      }
    }
  }
  return normalized;
}

export function getStageRecord(progress, domain, level) {
  const levels = progress.domains[domain];
  if (!levels) return null;
  return levels[level] ?? null;
}

export function recordAttempt(progress, domain, level, score, now = new Date()) {
  const previous = getStageRecord(progress, domain, level);
  const updatedRecord = {
    // 一度合格した到達は、再挑戦で落ちても剥奪しない。
    cleared: (previous?.cleared ?? false) || isPassed(score),
    bestScore: Math.max(previous?.bestScore ?? 0, score),
    attempts: (previous?.attempts ?? 0) + 1,
    lastAttemptAt: now.toISOString(),
  };

  return {
    ...progress,
    domains: {
      ...progress.domains,
      [domain]: {
        ...progress.domains[domain],
        [level]: updatedRecord,
      },
    },
  };
}

export function getStageStatus(progress, domain, level) {
  const record = getStageRecord(progress, domain, level);
  if (record?.cleared) return 'cleared';

  const levelIndex = LEVELS.indexOf(level);
  if (levelIndex <= 0) return 'available';

  // 直前のレベルだけでなく、下位のレベルをすべて合格している必要がある。
  // 保存データは手で書き換えられるため、途中を飛ばした記録があっても
  // ゲートが崩れないようにする。
  for (let i = 0; i < levelIndex; i++) {
    const lowerRecord = getStageRecord(progress, domain, LEVELS[i]);
    if (!lowerRecord?.cleared) return 'locked';
  }
  return 'available';
}

export function buildDashboard(progress) {
  return DOMAINS.map(domain => ({
    domain,
    domainLabel: DOMAIN_LABELS[domain],
    stages: LEVELS.map(level => ({
      level,
      status: getStageStatus(progress, domain, level),
      record: getStageRecord(progress, domain, level),
    })),
  }));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/progress.test.js`
Expected: PASS（15テストすべて成功）

- [ ] **Step 5: コミット**

```bash
git add js/progress.js tests/progress.test.js
git commit -m "feat: ステージ進捗とゲート判定を担うprogress.jsを追加"
```

---

### Task 2: `js/level-judge.js` の縮小と旧テストの削除

正答率による4段階判定は役目を終える。レベルの語彙定義のみを残す。

**Files:**
- Modify: `js/level-judge.js`（`judgeDomainLevel` と `judgeAllLevels` を削除）
- Delete: `tests/level-judge.test.js`

**Interfaces:**
- Consumes: なし
- Produces: `LEVELS: string[]`、`LEVEL_LABELS: Record<string, string>`（どちらも既存のまま。他モジュールの参照は変わらない）

このタスクの時点では `js/quiz-page.js` と `js/result-page.js` がまだ削除対象の関数を参照している。
それらは Task 5・Task 6 で書き換える。JavaScriptはモジュール読み込み時まで解決されないため、
`node --test` は通る（ページを開くと壊れるが、Task 6 完了時点で解消する）。

- [ ] **Step 1: `js/level-judge.js` を書き換え**

ファイル全体を以下で置き換える:

```javascript
export const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

export const LEVEL_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  expert: 'エキスパート',
};
```

- [ ] **Step 2: 旧テストを削除**

```bash
git rm tests/level-judge.test.js
```

- [ ] **Step 3: progress.js のテストが引き続き通ることを確認**

Run: `node --test tests/progress.test.js`
Expected: PASS（`LEVELS` を参照しているため、削除が影響しないことの確認）

- [ ] **Step 4: コミット**

```bash
git add js/level-judge.js tests/level-judge.test.js
git commit -m "refactor: level-judgeを正答率判定からレベル語彙の定義のみに縮小"
```

---

### Task 3: `js/quiz-engine.js` を単一ステージ用に組み替え

全領域まとめて組み立てる関数群を、1ステージ分の抽出・採点に置き換える。

**Files:**
- Modify: `js/quiz-engine.js`
- Modify: `tests/quiz-engine.test.js`（全面改訂）

**Interfaces:**
- Consumes: `QUESTIONS_PER_STAGE`（Task 1 の `js/progress.js`）
- Produces:
  - `selectQuestions(domainData, level, count, rng?): Question[]` — 指定レベルのプールから `count` 問をシャッフル抽出し、各問の選択肢もシャッフルする。プール不足なら `Error` を投げる
  - `scoreStage(questions, answers): number` — 正解数を返す
  - `collectWrongAnswers(questions, answers, domainLabel): WrongAnswer[]` — シグネチャ変更。単一ステージ用
  - `shuffle` / `shuffleChoices` — 内部関数のまま（エクスポートしない）

`Question` は問題データの1件（`id` / `level` / `question` / `choices` / `correctIndex` / `explanation`）。
`answers` は `Record<questionId, choiceIndex>`。
`WrongAnswer` は `{ questionId, domainLabel, question, choices, selectedIndex, correctIndex, explanation }`。

削除する関数: `buildQuiz`、`gradeAnswers`。

- [ ] **Step 1: 失敗するテストを書く**

`tests/quiz-engine.test.js` の内容を以下で全面的に置き換える:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, scoreStage, collectWrongAnswers } from '../js/quiz-engine.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

function makeDomainData(domain, countPerLevel = 10) {
  const questions = [];
  for (const level of LEVELS) {
    for (let i = 0; i < countPerLevel; i++) {
      questions.push({
        id: `${domain}-${level}-${i}`,
        level,
        question: `${domain} ${level} question ${i}`,
        choices: ['a', 'b', 'c', 'd'],
        correctIndex: 0,
        explanation: `explanation ${i}`,
      });
    }
  }
  return { domain, domainLabel: `${domain}ラベル`, questions };
}

test('selectQuestions は指定レベルの問題だけを指定数だけ返す', () => {
  const domainData = makeDomainData('basic-operations');
  const selected = selectQuestions(domainData, 'intermediate', 10);

  assert.equal(selected.length, 10);
  for (const question of selected) {
    assert.equal(question.level, 'intermediate');
  }
  const ids = selected.map(q => q.id);
  assert.equal(new Set(ids).size, 10, '同じ問題が重複して選ばれている');
});

test('selectQuestions はプールが多い場合でも指定数だけ抽出する', () => {
  const domainData = makeDomainData('basic-operations', 15);
  const selected = selectQuestions(domainData, 'beginner', 10);
  assert.equal(selected.length, 10);
});

test('selectQuestions はプール不足ならエラーを投げる', () => {
  const domainData = makeDomainData('basic-operations', 5);
  assert.throws(
    () => selectQuestions(domainData, 'beginner', 10),
    /not have enough/
  );
});

test('selectQuestions は選択肢をシャッフルしても correctIndex を正しく追従させる', () => {
  const domainData = {
    domain: 'basic-operations',
    domainLabel: 'ラベル',
    questions: Array.from({ length: 10 }, (_, i) => ({
      id: `q-${i}`,
      level: 'beginner',
      question: `question ${i}`,
      choices: ['正解', '誤答1', '誤答2', '誤答3'],
      correctIndex: 0,
      explanation: 'because',
    })),
  };

  // 逆順に並べ替える決定的なrng（shuffleのFisher-Yatesで必ず入れ替えが起きる）
  const selected = selectQuestions(domainData, 'beginner', 10, () => 0);

  for (const question of selected) {
    assert.equal(
      question.choices[question.correctIndex],
      '正解',
      'シャッフル後もcorrectIndexが正解の選択肢を指していない'
    );
    assert.equal(question.choices.length, 4);
  }
});

test('selectQuestions は元の問題データを変更しない', () => {
  const domainData = makeDomainData('basic-operations');
  const originalFirst = { ...domainData.questions[0], choices: [...domainData.questions[0].choices] };
  selectQuestions(domainData, 'beginner', 10, () => 0);
  assert.deepEqual(domainData.questions[0], originalFirst);
});

test('scoreStage は正解数を返す', () => {
  const questions = [
    { id: 'q1', correctIndex: 0 },
    { id: 'q2', correctIndex: 1 },
    { id: 'q3', correctIndex: 2 },
  ];
  assert.equal(scoreStage(questions, { q1: 0, q2: 1, q3: 2 }), 3);
  assert.equal(scoreStage(questions, { q1: 0, q2: 3, q3: 2 }), 2);
  assert.equal(scoreStage(questions, {}), 0);
});

test('scoreStage は未回答を不正解として扱う', () => {
  const questions = [
    { id: 'q1', correctIndex: 0 },
    { id: 'q2', correctIndex: 0 },
  ];
  assert.equal(scoreStage(questions, { q1: 0 }), 1);
});

test('collectWrongAnswers は間違えた問題だけを詳細付きで返す', () => {
  const questions = [
    {
      id: 'q1',
      question: '問題1',
      choices: ['a', 'b', 'c', 'd'],
      correctIndex: 0,
      explanation: '解説1',
    },
    {
      id: 'q2',
      question: '問題2',
      choices: ['a', 'b', 'c', 'd'],
      correctIndex: 1,
      explanation: '解説2',
    },
  ];
  const wrong = collectWrongAnswers(questions, { q1: 0, q2: 3 }, '基本操作・CLI使用法');

  assert.equal(wrong.length, 1);
  assert.deepEqual(wrong[0], {
    questionId: 'q2',
    domainLabel: '基本操作・CLI使用法',
    question: '問題2',
    choices: ['a', 'b', 'c', 'd'],
    selectedIndex: 3,
    correctIndex: 1,
    explanation: '解説2',
  });
});

test('collectWrongAnswers は未回答を selectedIndex: null として含める', () => {
  const questions = [
    { id: 'q1', question: '問題1', choices: ['a', 'b'], correctIndex: 0, explanation: '解説1' },
  ];
  const wrong = collectWrongAnswers(questions, {}, 'ラベル');
  assert.equal(wrong.length, 1);
  assert.equal(wrong[0].selectedIndex, null);
});

test('collectWrongAnswers は全問正解なら空配列を返す', () => {
  const questions = [
    { id: 'q1', question: '問題1', choices: ['a', 'b'], correctIndex: 0, explanation: '解説1' },
  ];
  assert.deepEqual(collectWrongAnswers(questions, { q1: 0 }, 'ラベル'), []);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/quiz-engine.test.js`
Expected: FAIL（`scoreStage` が未定義、`selectQuestions` のシグネチャ不一致でエラー）

- [ ] **Step 3: `js/quiz-engine.js` を書き換え**

ファイル全体を以下で置き換える:

```javascript
function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function shuffleChoices(question, rng) {
  const indices = question.choices.map((_, i) => i);
  const shuffledIndices = shuffle(indices, rng);
  const newChoices = shuffledIndices.map(i => question.choices[i]);
  const newCorrectIndex = shuffledIndices.indexOf(question.correctIndex);
  return { ...question, choices: newChoices, correctIndex: newCorrectIndex };
}

// 指定領域・指定レベルのプールからcount問を抽出する。
// プールがcount問ちょうどなら実質的に全問が順不同で出題される。
// 将来プールを増やした場合は、そこからランダムにcount問が選ばれる。
export function selectQuestions(domainData, level, count, rng = Math.random) {
  const pool = domainData.questions.filter(q => q.level === level);
  if (pool.length < count) {
    throw new Error(
      `Domain "${domainData.domain}" does not have enough "${level}" questions: needs ${count}, has ${pool.length}`
    );
  }
  return shuffle(pool, rng)
    .slice(0, count)
    .map(q => shuffleChoices(q, rng));
}

export function scoreStage(questions, answers) {
  let correct = 0;
  for (const question of questions) {
    if (answers[question.id] === question.correctIndex) {
      correct += 1;
    }
  }
  return correct;
}

export function collectWrongAnswers(questions, answers, domainLabel) {
  const wrong = [];
  for (const question of questions) {
    const selectedIndex = Object.prototype.hasOwnProperty.call(answers, question.id)
      ? answers[question.id]
      : null;
    if (selectedIndex !== question.correctIndex) {
      wrong.push({
        questionId: question.id,
        domainLabel,
        question: question.question,
        choices: question.choices,
        selectedIndex,
        correctIndex: question.correctIndex,
        explanation: question.explanation,
      });
    }
  }
  return wrong;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/quiz-engine.test.js`
Expected: PASS（10テストすべて成功）

- [ ] **Step 5: コミット**

```bash
git add js/quiz-engine.js tests/quiz-engine.test.js
git commit -m "refactor: quiz-engineを単一ステージの抽出・採点に組み替え"
```

---

### Task 4: `js/storage.js` に進捗の永続化を追加

進捗の保存先を追加する。既存の例外安全な設計（`localStorage` 失敗時に `sessionStorage` へ退避）を踏襲する。

**Files:**
- Modify: `js/storage.js`
- Test: `tests/storage.test.js`（新規作成）

**Interfaces:**
- Consumes: なし（`storage.js` は保存の入れ物に徹し、進捗の意味づけは持たない）
- Produces:
  - `saveProgressRaw(progressObject): 'local' | 'session' | 'none'` — 保存先を返す
  - `loadProgressRaw(): unknown | null` — パース済みの生データ。壊れていれば `null`
  - `STAGE_SESSION_KEY: string` — quiz → result の受け渡しに使うキー
  - `saveStageResult(stageResult): boolean`
  - `loadStageResult(): unknown | null`
  - 既存の `saveResult` / `loadResult` / `clearResult` / `saveFallbackResult` / `loadFallbackResult` は削除する（旧キーは読み書きしない方針のため）

`storage.js` はブラウザAPI（`localStorage` / `sessionStorage`）に直接依存するため、
テストではグローバルにスタブを注入する。

- [ ] **Step 1: 失敗するテストを書く**

`tests/storage.test.js` を新規作成:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// storage.js はモジュール読み込み時ではなく呼び出し時に
// グローバルの localStorage / sessionStorage を参照するため、
// テストごとにスタブを差し替えられる。
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

let storage;

beforeEach(async () => {
  globalThis.localStorage = makeStorageStub();
  globalThis.sessionStorage = makeStorageStub();
  // クエリ文字列でモジュールキャッシュを回避し、毎回新しく読み込む
  storage = await import(`../js/storage.js?t=${Date.now()}${Math.random()}`);
});

test('saveProgressRaw は localStorage に保存して "local" を返す', () => {
  const result = storage.saveProgressRaw({ version: 1, domains: {} });
  assert.equal(result, 'local');
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: {} });
});

test('localStorage が使えない場合は sessionStorage に退避して "session" を返す', () => {
  globalThis.localStorage = makeStorageStub({ throwOnSet: true });
  const result = storage.saveProgressRaw({ version: 1, domains: {} });
  assert.equal(result, 'session');
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: {} });
});

test('どちらのストレージも使えない場合は "none" を返す', () => {
  globalThis.localStorage = makeStorageStub({ throwOnSet: true });
  globalThis.sessionStorage = makeStorageStub({ throwOnSet: true });
  assert.equal(storage.saveProgressRaw({ version: 1, domains: {} }), 'none');
});

test('保存されていなければ loadProgressRaw は null を返す', () => {
  assert.equal(storage.loadProgressRaw(), null);
});

test('壊れたJSONが保存されていれば loadProgressRaw は null を返す', () => {
  globalThis.localStorage.setItem('cc-diagnosis-progress', '{壊れている');
  assert.equal(storage.loadProgressRaw(), null);
});

test('loadProgressRaw は localStorage を優先し、無ければ sessionStorage を見る', () => {
  globalThis.sessionStorage.setItem(
    'cc-diagnosis-progress',
    JSON.stringify({ version: 1, domains: { 'feature-usage': {} } })
  );
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: { 'feature-usage': {} } });

  globalThis.localStorage.setItem(
    'cc-diagnosis-progress',
    JSON.stringify({ version: 1, domains: { 'basic-operations': {} } })
  );
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: { 'basic-operations': {} } });
});

test('ステージ結果を sessionStorage 経由で受け渡せる', () => {
  const stageResult = { domain: 'basic-operations', level: 'beginner', score: 8 };
  assert.equal(storage.saveStageResult(stageResult), true);
  assert.deepEqual(storage.loadStageResult(), stageResult);
});

test('ステージ結果が無ければ loadStageResult は null を返す', () => {
  assert.equal(storage.loadStageResult(), null);
});

test('sessionStorage が使えなければ saveStageResult は false を返す', () => {
  globalThis.sessionStorage = makeStorageStub({ throwOnSet: true });
  assert.equal(storage.saveStageResult({ score: 8 }), false);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/storage.test.js`
Expected: FAIL（`saveProgressRaw is not a function`）

- [ ] **Step 3: `js/storage.js` を書き換え**

ファイル全体を以下で置き換える:

```javascript
const PROGRESS_KEY = 'cc-diagnosis-progress';
export const STAGE_SESSION_KEY = 'cc-diagnosis-stage-result';

function readJson(storage, key) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

// 進捗はゲート構造の前提なので、localStorageが使えない環境
// （プライベートブラウジング等）ではsessionStorageに退避する。
// どちらも使えない場合は 'none' を返し、呼び出し側が利用者に注記する。
export function saveProgressRaw(progressObject) {
  if (writeJson(globalThis.localStorage, PROGRESS_KEY, progressObject)) return 'local';
  if (writeJson(globalThis.sessionStorage, PROGRESS_KEY, progressObject)) return 'session';
  return 'none';
}

export function loadProgressRaw() {
  return (
    readJson(globalThis.localStorage, PROGRESS_KEY) ??
    readJson(globalThis.sessionStorage, PROGRESS_KEY)
  );
}

export function saveStageResult(stageResult) {
  return writeJson(globalThis.sessionStorage, STAGE_SESSION_KEY, stageResult);
}

export function loadStageResult() {
  return readJson(globalThis.sessionStorage, STAGE_SESSION_KEY);
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/storage.test.js`
Expected: PASS（9テストすべて成功）

- [ ] **Step 5: コミット**

```bash
git add js/storage.js tests/storage.test.js
git commit -m "feat: 進捗とステージ結果の永続化をstorageに追加"
```

---

### Task 5: ダッシュボード画面（`index.html` + `js/top-page.js` + CSS）

トップページを、20ステージの状態を一覧するグリッドに作り替える。

**Files:**
- Modify: `index.html`
- Modify: `js/top-page.js`（全面書き換え）
- Modify: `css/style.css`（末尾にダッシュボード用スタイルを追加）

**Interfaces:**
- Consumes: `buildDashboard` / `normalizeProgress` / `createEmptyProgress` / `QUESTIONS_PER_STAGE`（`js/progress.js`）、`loadProgressRaw`（`js/storage.js`）、`LEVEL_LABELS`（`js/level-judge.js`）
- Produces: なし（画面の終端）

ステージへの遷移は `quiz.html?domain=<domain>&level=<level>`。

- [ ] **Step 1: `index.html` を書き換え**

ファイル全体を以下で置き換える:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code ステップアップ問題集</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Claude Code ステップアップ問題集</h1>
      <p>
        5領域 × 4レベルの全20ステージ。各ステージは10問で、8問以上正解すると合格し、
        同じ領域の次のレベルが開放されます。進捗はブラウザ内にのみ保存され、外部には送信されません。
      </p>
      <p id="storage-notice" class="progress" style="display: none;"></p>
    </div>

    <div class="card">
      <h2>進捗</h2>
      <p class="progress" id="overall-progress"></p>
      <div id="dashboard"></div>
      <p class="dashboard-legend">
        <span class="stage-mark cleared">✅</span> 合格済み（再挑戦できます）
        <span class="stage-mark available">▶</span> 挑戦可能
        <span class="stage-mark locked">🔒</span> 未開放
      </p>
    </div>
  </div>
  <script type="module" src="js/top-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: `js/top-page.js` を書き換え**

ファイル全体を以下で置き換える:

```javascript
import { buildDashboard, normalizeProgress, QUESTIONS_PER_STAGE } from './progress.js';
import { loadProgressRaw } from './storage.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';

const STATUS_MARKS = { cleared: '✅', available: '▶', locked: '🔒' };

const dashboardEl = document.getElementById('dashboard');
const overallProgressEl = document.getElementById('overall-progress');
const storageNoticeEl = document.getElementById('storage-notice');

const progress = normalizeProgress(loadProgressRaw());
const dashboard = buildDashboard(progress);

function lockedReason(level) {
  const previousLevel = LEVELS[LEVELS.indexOf(level) - 1];
  return `${LEVEL_LABELS[previousLevel]}に合格すると開放されます`;
}

function renderStageCell(domain, domainLabel, stage) {
  const { level, status, record } = stage;
  const mark = STATUS_MARKS[status];
  const stageName = `${domainLabel} ${LEVEL_LABELS[level]}`;

  const cell = document.createElement(status === 'locked' ? 'span' : 'a');
  cell.className = `stage-cell ${status}`;

  if (status === 'locked') {
    cell.title = lockedReason(level);
    cell.setAttribute('aria-label', `${stageName}（未開放）${lockedReason(level)}`);
  } else {
    cell.href = `quiz.html?domain=${encodeURIComponent(domain)}&level=${encodeURIComponent(level)}`;
    const action = status === 'cleared' ? '合格済み、再挑戦する' : '挑戦する';
    cell.setAttribute('aria-label', `${stageName}（${action}）`);
  }

  const markEl = document.createElement('span');
  markEl.className = `stage-mark ${status}`;
  markEl.textContent = mark;
  cell.appendChild(markEl);

  const levelEl = document.createElement('span');
  levelEl.className = 'stage-level';
  levelEl.textContent = LEVEL_LABELS[level];
  cell.appendChild(levelEl);

  const scoreEl = document.createElement('span');
  scoreEl.className = 'stage-score';
  scoreEl.textContent = record ? `${record.bestScore}/${QUESTIONS_PER_STAGE}` : '';
  cell.appendChild(scoreEl);

  return cell;
}

let clearedCount = 0;

for (const row of dashboard) {
  const rowEl = document.createElement('div');
  rowEl.className = 'dashboard-row';

  const labelEl = document.createElement('h3');
  labelEl.className = 'dashboard-domain';
  labelEl.textContent = row.domainLabel;
  rowEl.appendChild(labelEl);

  const stagesEl = document.createElement('div');
  stagesEl.className = 'dashboard-stages';
  for (const stage of row.stages) {
    if (stage.status === 'cleared') clearedCount += 1;
    stagesEl.appendChild(renderStageCell(row.domain, row.domainLabel, stage));
  }
  rowEl.appendChild(stagesEl);

  dashboardEl.appendChild(rowEl);
}

const totalStages = dashboard.length * LEVELS.length;
overallProgressEl.textContent = `合格したステージ: ${clearedCount} / ${totalStages}`;

// 進捗が保存できていない環境では、その事実を明示しておく。
// ゲート方式では進捗の永続性が体験の前提になるため、黙って失わせない。
if (loadProgressRaw() === null && clearedCount === 0) {
  try {
    const probeKey = 'cc-diagnosis-storage-probe';
    localStorage.setItem(probeKey, '1');
    localStorage.removeItem(probeKey);
  } catch (err) {
    storageNoticeEl.textContent =
      'ブラウザの設定により進捗を保存できません。タブを閉じると進捗が失われます。';
    storageNoticeEl.style.display = 'block';
  }
}
```

- [ ] **Step 3: `css/style.css` の末尾にダッシュボード用スタイルを追加**

既存の内容は変更せず、ファイル末尾に追記する:

```css
/* ===== ダッシュボード ===== */

.dashboard-row {
  margin-bottom: 1.5rem;
}

.dashboard-domain {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.dashboard-stages {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
}

.stage-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  padding: 0.7rem 0.3rem;
  border: 1px solid #d0d0d0;
  border-radius: 6px;
  text-decoration: none;
  color: inherit;
  text-align: center;
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
  cursor: not-allowed;
}

a.stage-cell:hover {
  border-width: 2px;
  padding: calc(0.7rem - 1px) calc(0.3rem - 1px);
}

.stage-mark {
  font-size: 1.1rem;
  line-height: 1;
}

.stage-level {
  font-size: 0.8rem;
}

.stage-score {
  font-size: 0.75rem;
  color: #666;
  min-height: 1em;
}

.stage-cell.locked .stage-score {
  color: #aaa;
}

.dashboard-legend {
  margin-top: 1rem;
  font-size: 0.8rem;
  color: #666;
}

.dashboard-legend .stage-mark {
  font-size: 0.9rem;
  margin-left: 0.8rem;
}

.dashboard-legend .stage-mark:first-child {
  margin-left: 0;
}

@media (max-width: 480px) {
  .dashboard-stages {
    gap: 0.3rem;
  }

  .stage-level {
    font-size: 0.7rem;
  }
}
```

- [ ] **Step 4: 手動でダッシュボードを確認**

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` を開き、以下を確認する:
- 5領域 × 4レベルのグリッドが表示される
- 初回アクセス時、各領域の初級だけが ▶（挑戦可能）で、他3レベルが 🔒
- 「合格したステージ: 0 / 20」と表示される
- 🔒 のセルにカーソルを合わせると「初級に合格すると開放されます」等のツールチップが出る
- 🔒 のセルはクリックしても遷移しない
- ▶ のセルをクリックすると `quiz.html?domain=...&level=beginner` に遷移する（この時点では Task 6 未完のため画面は壊れていてよい。URLが正しいことだけ確認する）

確認後、サーバーは `Ctrl+C` で停止する。

- [ ] **Step 5: 既存テストが引き続き通ることを確認**

Run: `node --test`
Expected: PASS（progress / quiz-engine / storage / question-data の全テスト）

- [ ] **Step 6: コミット**

```bash
git add index.html js/top-page.js css/style.css
git commit -m "feat: トップページを20ステージの進捗ダッシュボードに刷新"
```

---

### Task 6: ステージ挑戦画面（`quiz.html` + `js/quiz-page.js`）

URLクエリで指定されたステージの10問を出題し、完了時に進捗を記録する。

**Files:**
- Modify: `quiz.html`
- Modify: `js/quiz-page.js`（全面書き換え）

**Interfaces:**
- Consumes: `selectQuestions` / `scoreStage` / `collectWrongAnswers`（`js/quiz-engine.js`）、`normalizeProgress` / `recordAttempt` / `getStageStatus` / `isPassed` / `QUESTIONS_PER_STAGE` / `DOMAIN_LABELS` / `DOMAINS`（`js/progress.js`）、`loadProgressRaw` / `saveProgressRaw` / `saveStageResult`（`js/storage.js`）、`LEVELS` / `LEVEL_LABELS`（`js/level-judge.js`）
- Produces: `sessionStorage` に保存するステージ結果オブジェクト。Task 7 の `result-page.js` が読む:

```javascript
{
  domain: 'basic-operations',
  domainLabel: '基本操作・CLI使用法',
  level: 'beginner',
  score: 8,
  total: 10,
  passed: true,
  unlockedLevel: 'intermediate',   // 今回の合格で新たに開放されたレベル。無ければ null
  wrongAnswers: [ /* collectWrongAnswers の戻り値 */ ],
  completedAt: '2026-08-02T10:00:00.000Z'
}
```

**進捗の書き込みは解答完了時点で行う**。結果画面をリロードしても `attempts` が二重加算されないため。

- [ ] **Step 1: `quiz.html` を書き換え**

ファイル全体を以下で置き換える:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>挑戦中 - Claude Code ステップアップ問題集</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <p id="stage-label" class="progress"></p>
      <p class="progress" id="progress-label"></p>
      <h2 id="question-text"></h2>
      <ul class="choice-list" id="choice-list"></ul>
      <p class="answer-feedback" id="answer-feedback" style="display: none;"></p>
      <p class="answer-explanation" id="answer-explanation" style="display: none;"></p>
      <button type="button" class="button" id="next-button" style="display: none;">次へ</button>
    </div>
  </div>
  <script type="module" src="js/quiz-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: `js/quiz-page.js` を書き換え**

ファイル全体を以下で置き換える:

```javascript
import { selectQuestions, scoreStage, collectWrongAnswers } from './quiz-engine.js';
import {
  DOMAINS,
  DOMAIN_LABELS,
  QUESTIONS_PER_STAGE,
  normalizeProgress,
  recordAttempt,
  getStageStatus,
  isPassed,
} from './progress.js';
import { loadProgressRaw, saveProgressRaw, saveStageResult } from './storage.js';
import { LEVELS, LEVEL_LABELS } from './level-judge.js';

const stageLabelEl = document.getElementById('stage-label');
const progressLabel = document.getElementById('progress-label');
const questionTextEl = document.getElementById('question-text');
const choiceListEl = document.getElementById('choice-list');
const answerFeedbackEl = document.getElementById('answer-feedback');
const answerExplanationEl = document.getElementById('answer-explanation');
const nextButton = document.getElementById('next-button');

function goToDashboard() {
  window.location.href = 'index.html';
}

function showLoadError() {
  stageLabelEl.textContent = '';
  progressLabel.textContent = '';
  questionTextEl.textContent =
    '問題データの読み込みに失敗しました。簡易HTTPサーバー経由で開いているか確認してください（例: python3 -m http.server 8000）。';
}

function renderQuestion(questions, index, onAnswer) {
  const item = questions[index];
  progressLabel.textContent = `問題 ${index + 1} / ${questions.length}`;
  questionTextEl.textContent = item.question;
  choiceListEl.innerHTML = '';
  answerFeedbackEl.style.display = 'none';
  answerExplanationEl.style.display = 'none';
  nextButton.style.display = 'none';

  item.choices.forEach((choiceText, choiceIndex) => {
    const li = document.createElement('li');
    li.className = 'choice-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choiceText;
    button.addEventListener('click', () => onAnswer(choiceIndex));
    li.appendChild(button);
    choiceListEl.appendChild(li);
  });
}

function showAnswerFeedback(item, selectedIndex, isLastQuestion) {
  const buttons = choiceListEl.querySelectorAll('.choice-button');
  buttons.forEach(button => {
    button.disabled = true;
  });
  buttons[selectedIndex].classList.add('selected');
  buttons[item.correctIndex].classList.add('correct-choice');
  if (selectedIndex !== item.correctIndex) {
    buttons[selectedIndex].classList.add('incorrect-choice');
  }

  const isCorrect = selectedIndex === item.correctIndex;
  answerFeedbackEl.textContent = isCorrect ? '正解！' : '不正解';
  answerFeedbackEl.classList.toggle('correct', isCorrect);
  answerFeedbackEl.classList.toggle('incorrect', !isCorrect);
  answerFeedbackEl.style.display = 'block';

  answerExplanationEl.textContent = item.explanation;
  answerExplanationEl.style.display = 'block';

  nextButton.textContent = isLastQuestion ? '結果を見る' : '次へ';
  nextButton.style.display = 'inline-block';
}

async function main() {
  const params = new URLSearchParams(window.location.search);
  const domain = params.get('domain');
  const level = params.get('level');

  // 不正なURLや古いブックマークからの流入はダッシュボードへ戻す。
  if (!DOMAINS.includes(domain) || !LEVELS.includes(level)) {
    goToDashboard();
    return;
  }

  const progress = normalizeProgress(loadProgressRaw());

  // URL直打ちでロック中のステージに入られた場合も戻す。
  // 厳密な防御ではないが、ゲート構造の一貫性を保つ。
  if (getStageStatus(progress, domain, level) === 'locked') {
    goToDashboard();
    return;
  }

  const domainLabel = DOMAIN_LABELS[domain];
  stageLabelEl.textContent = `${domainLabel} / ${LEVEL_LABELS[level]}`;

  let questions;
  try {
    const response = await fetch(`data/questions/${domain}.json`);
    if (!response.ok) throw new Error(`Failed to load ${response.url}`);
    const domainData = await response.json();
    questions = selectQuestions(domainData, level, QUESTIONS_PER_STAGE, Math.random);
  } catch (err) {
    showLoadError();
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

  function finishStage() {
    const score = scoreStage(questions, answers);
    const passed = isPassed(score);
    const wasCleared = getStageStatus(progress, domain, level) === 'cleared';

    const updatedProgress = recordAttempt(progress, domain, level, score);
    saveProgressRaw(updatedProgress);

    // 今回の合格で新たに開いたレベルだけを案内する。
    // すでに合格済みのステージを再挑戦した場合は、新たな開放はない。
    let unlockedLevel = null;
    if (passed && !wasCleared) {
      const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];
      if (nextLevel) unlockedLevel = nextLevel;
    }

    saveStageResult({
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

    window.location.href = 'result.html';
  }

  function goToNext() {
    if (currentIndex < questions.length - 1) {
      currentIndex += 1;
      hasAnswered = false;
      renderQuestion(questions, currentIndex, handleAnswer);
    } else {
      finishStage();
    }
  }

  nextButton.addEventListener('click', goToNext);
  renderQuestion(questions, currentIndex, handleAnswer);
}

main();
```

- [ ] **Step 3: 手動でステージ挑戦を確認**

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` から基本操作の初級に挑戦し、以下を確認する:
- ヘッダーに「基本操作・CLI使用法 / 初級」と表示される
- 「問題 1 / 10」から始まり、10問で終わる
- 選択肢を選ぶと即座に正誤と解説が表示され、他の選択肢が押せなくなる
- 10問目で「結果を見る」ボタンになり、押すと `result.html` に遷移する（この時点では Task 7 未完のため結果画面は壊れていてよい）

続いてURLを直接叩き、以下を確認する:
- `http://localhost:8000/quiz.html?domain=basic-operations&level=expert` → ロック中なのでトップへリダイレクトされる
- `http://localhost:8000/quiz.html?domain=nonexistent&level=beginner` → トップへリダイレクトされる
- `http://localhost:8000/quiz.html` → トップへリダイレクトされる

確認後、サーバーは `Ctrl+C` で停止する。

- [ ] **Step 4: 既存テストが引き続き通ることを確認**

Run: `node --test`
Expected: PASS

- [ ] **Step 5: コミット**

```bash
git add quiz.html js/quiz-page.js
git commit -m "feat: 単一ステージに挑戦するクイズ画面を実装"
```

---

### Task 7: ステージ結果画面（`result.html` + `js/result-page.js` + `js/report-content.js`）

合否・解説・次ステージへの導線を表示する。

**Files:**
- Modify: `result.html`
- Modify: `js/result-page.js`（全面書き換え）
- Modify: `js/report-content.js`（関数名を `getImprovementSuggestion` から `getStudyAdvice` に変更）
- Modify: `css/style.css`（末尾に結果画面用スタイルを追加）

**Interfaces:**
- Consumes: Task 6 が `sessionStorage` に書いたステージ結果オブジェクト（`loadStageResult`）、`getStudyAdvice`（`js/report-content.js`）、`LEVEL_LABELS`（`js/level-judge.js`）、`PASSING_SCORE`（`js/progress.js`）
- Produces: なし（画面の終端）

`js/report-content.js` の `SUGGESTIONS` テーブル（20件のアドバイス文）と `FALLBACK_SUGGESTION`、
`getLevelLabel` は変更しない。エクスポート関数名のみ変える。

- [ ] **Step 1: `js/report-content.js` の関数名を変更し、未使用関数を削除**

`getImprovementSuggestion` の宣言を以下に書き換える（本体は変えない）:

```javascript
export function getStudyAdvice(domain, level) {
  const domainSuggestions = SUGGESTIONS[domain];
  if (!domainSuggestions) return FALLBACK_SUGGESTION;
  return domainSuggestions[level] || FALLBACK_SUGGESTION;
}
```

あわせて、どこからも参照されていない `getLevelLabel` を削除する。
`LEVEL_LABELS` を直接使えば足りるため:

```javascript
// 以下の関数をファイルから削除する
export function getLevelLabel(level) {
  return LEVEL_LABELS[level] || level;
}
```

`getLevelLabel` の削除により `LEVEL_LABELS` の import が未使用になる場合は、
ファイル冒頭の `import { LEVEL_LABELS } from './level-judge.js';` も削除する。

- [ ] **Step 2: `result.html` を書き換え**

ファイル全体を以下で置き換える:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ステージ結果 - Claude Code ステップアップ問題集</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div id="no-result" class="card" style="display: none;">
      <h1>結果がありません</h1>
      <p>まだステージに挑戦していないか、結果の受け渡しに失敗しました。進捗は保存されています。</p>
      <a class="button" href="index.html">ダッシュボードに戻る</a>
    </div>

    <div id="result-content" style="display: none;">
      <div class="card">
        <p id="stage-label" class="progress"></p>
        <h1 id="verdict"></h1>
        <p id="score-line" class="stage-score-line"></p>
        <p id="unlock-notice" class="unlock-notice" style="display: none;"></p>
        <div class="actions no-print" id="result-actions"></div>
      </div>

      <div class="card" id="advice-card" style="display: none;">
        <h2>学習アドバイス</h2>
        <p id="advice-text"></p>
      </div>

      <div class="card">
        <h2>間違えた問題</h2>
        <div id="wrong-answers"></div>
      </div>

      <div class="actions no-print">
        <button class="button secondary" id="print-button">PDFとして印刷 / 保存</button>
      </div>
    </div>
  </div>
  <script type="module" src="js/result-page.js"></script>
</body>
</html>
```

- [ ] **Step 3: `js/result-page.js` を書き換え**

ファイル全体を以下で置き換える:

```javascript
import { loadStageResult } from './storage.js';
import { LEVEL_LABELS } from './level-judge.js';
import { PASSING_SCORE } from './progress.js';
import { getStudyAdvice } from './report-content.js';

const noResultEl = document.getElementById('no-result');
const resultContentEl = document.getElementById('result-content');

const stageResult = loadStageResult();

// 進捗は挑戦完了時点で確定済みなので、この画面を見逃しても記録は失われない。
if (!stageResult) {
  noResultEl.style.display = 'block';
} else {
  resultContentEl.style.display = 'block';

  const { domain, domainLabel, level, score, total, passed, unlockedLevel, wrongAnswers } = stageResult;

  document.getElementById('stage-label').textContent =
    `${domainLabel} / ${LEVEL_LABELS[level]}`;

  const verdictEl = document.getElementById('verdict');
  verdictEl.textContent = passed ? '合格！' : '不合格';
  verdictEl.className = passed ? 'verdict passed' : 'verdict failed';

  document.getElementById('score-line').textContent =
    `${score} / ${total} 問正解（合格ラインは ${PASSING_SCORE} 問）`;

  if (unlockedLevel) {
    const unlockNoticeEl = document.getElementById('unlock-notice');
    unlockNoticeEl.textContent = `${LEVEL_LABELS[unlockedLevel]}が開放されました！`;
    unlockNoticeEl.style.display = 'block';
  }

  const actionsEl = document.getElementById('result-actions');

  if (unlockedLevel) {
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
  }

  const dashboardLink = document.createElement('a');
  dashboardLink.className = 'button secondary';
  dashboardLink.href = 'index.html';
  dashboardLink.textContent = 'ダッシュボードに戻る';
  actionsEl.appendChild(dashboardLink);

  // 不合格のときだけ、そのレベルの学習アドバイスを示す。
  if (!passed) {
    document.getElementById('advice-card').style.display = 'block';
    document.getElementById('advice-text').textContent = getStudyAdvice(domain, level);
  }

  const wrongAnswersEl = document.getElementById('wrong-answers');

  if (!Array.isArray(wrongAnswers) || wrongAnswers.length === 0) {
    const allCorrect = document.createElement('p');
    allCorrect.textContent = '全問正解でした！';
    wrongAnswersEl.appendChild(allCorrect);
  } else {
    for (const item of wrongAnswers) {
      const entry = document.createElement('div');
      entry.className = 'wrong-answer-item';

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

  document.getElementById('print-button').addEventListener('click', () => {
    window.print();
  });
}
```

- [ ] **Step 4: `css/style.css` の末尾に結果画面用スタイルを追加**

Task 5 で追記したダッシュボード用スタイルの後に、さらに追記する:

```css
/* ===== ステージ結果 ===== */

.verdict.passed {
  color: #2e7d32;
}

.verdict.failed {
  color: #c62828;
}

.stage-score-line {
  font-size: 1.1rem;
  margin: 0.5rem 0;
}

.unlock-notice {
  padding: 0.7rem 1rem;
  border-radius: 6px;
  background: #eaf7ee;
  border: 1px solid #7bc48a;
  color: #2e7d32;
  font-weight: bold;
}
```

- [ ] **Step 5: 通しで手動確認**

```bash
python3 -m http.server 8000
```

以下のシナリオを通す:

1. **合格の流れ** — ダッシュボードから基本操作の初級に挑戦し、8問以上正解する。
   「合格！」「中級が開放されました！」「中級に挑戦する」ボタンが表示されることを確認。
   ダッシュボードに戻ると、初級が ✅ でスコア付き、中級が ▶ になっていることを確認。
   「合格したステージ: 1 / 20」と表示されること。

2. **不合格の流れ** — 別の領域の初級に挑戦し、各問で正解でない選択肢を意図的に選んで
   3問以下の正解に抑える（選択肢はシャッフルされるため、表示された解説で正解を確認しながら進める）。
   「不合格」「もう一度挑戦する」ボタン、学習アドバイス、間違えた問題の解説一覧が表示されることを確認。
   「中級が開放されました」は表示されないこと。ダッシュボードで当該ステージが ▶ のままであること。

3. **進捗の永続性** — ブラウザをリロードしてもダッシュボードの進捗が保たれていることを確認。

4. **非降格** — 1で合格した初級に再挑戦し、わざと不合格になる。
   ダッシュボードで初級が ✅ のまま、中級も ▶ のままであることを確認。
   結果画面に「中級が開放されました」は出ないこと（すでに開放済みのため）。

5. **結果画面の直接アクセス** — 新しいタブで `http://localhost:8000/result.html` を開き、
   「結果がありません」とダッシュボードへの導線が表示されることを確認。

確認後、サーバーは `Ctrl+C` で停止する。

- [ ] **Step 6: 全テストが通ることを確認**

Run: `node --test`
Expected: PASS（progress 15件 / quiz-engine 10件 / storage 9件 / question-data 3件）

- [ ] **Step 7: 旧コードの残骸がないことを確認**

Run: `grep -rn "judgeAllLevels\|judgeDomainLevel\|buildQuiz\|gradeAnswers\|getImprovementSuggestion\|saveResult\|loadResult\|saveFallbackResult\|loadFallbackResult\|cc-diagnosis-result" js/ tests/ *.html`
Expected: 出力なし（該当なしで終了コード1）

もし出力があれば、その参照を除去してから次へ進む。

- [ ] **Step 8: コミット**

```bash
git add result.html js/result-page.js js/report-content.js css/style.css
git commit -m "feat: ステージ結果画面に合否・開放案内・学習アドバイスを実装"
```

---

### Task 8: README の更新

アプリの性質が「診断ツール」から「ステップアップ問題集」に変わったため、説明を実態に合わせる。

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: なし
- Produces: なし

- [ ] **Step 1: `README.md` の冒頭からテスト実行までを書き換え**

先頭から `## テストの実行` セクションの直前までを、以下で置き換える:

```markdown
# Claude Code ステップアップ問題集

Claude Codeの理解を、5領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理）×4レベル（初級／中級／上級／エキスパート）の全20ステージで段階的に高めるWebアプリです。

各ステージは10問で構成され、**8問以上正解すると合格**し、同じ領域の次のレベルが開放されます。
領域どうしは独立して進むため、得意な領域を伸ばしつつ、苦手な領域を重点的に反復できます。

チーム内の育成・研修を目的とした個人向け学習ツールで、サーバーは使わずブラウザだけで完結します。
進捗はブラウザの`localStorage`にのみ保存され、外部には送信されません。

## 進め方

1. トップページのダッシュボードで、5領域 × 4レベルの進捗を確認する
2. ▶（挑戦可能）のステージを選んで10問に挑戦する
3. 8問以上正解すれば合格。次のレベルが開放される
4. 不合格なら解説を読んで再挑戦する

合格済み（✅）のステージにも再挑戦できます。再挑戦で不合格になっても、一度得た合格は取り消されません。

## ローカルでの動作確認

ビルド不要です。プロジェクトルートで簡易HTTPサーバーを起動してください。

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` を開くとダッシュボードが表示されます。

`file://`で直接HTMLを開くと`fetch`によるJSON読み込みがブラウザのセキュリティ制限で失敗するため、
必ず簡易サーバー経由でアクセスしてください。
```

- [ ] **Step 2: 「問題の追加・修正」セクションの出題数の記述を修正**

以下の段落を探す:

```markdown
`data/questions/*.json` を直接編集してください。各領域のファイルには
`beginner`/`intermediate`/`advanced`/`expert` の4レベルがそれぞれ最低10問ずつ必要です
（1回の診断で各レベルから抽出する問題数: 初級3問・中級3問・上級2問・エキスパート2問）。
```

以下で置き換える:

```markdown
`data/questions/*.json` を直接編集してください。各領域のファイルには
`beginner`/`intermediate`/`advanced`/`expert` の4レベルがそれぞれ最低10問ずつ必要です
（1ステージにつき、そのレベルのプールから10問を抽出して出題します）。

プールを11問以上に増やした場合は、そこからランダムに10問が選ばれるため、
挑戦のたびに出題内容が変わります。
```

- [ ] **Step 3: 記述の整合を確認**

Run: `grep -n "50問\|診断\|各10問（計" README.md`
Expected: 旧仕様を指す記述（「50問」「診断を始める」等）が残っていないこと。
「## GitHub Pagesでの公開」「## テストの実行」「## 問題の追加・修正」内の記述は仕様変更の影響を受けないため、そのままでよい。
残骸があれば文脈に合わせて修正する。

- [ ] **Step 4: コミット**

```bash
git add README.md
git commit -m "docs: READMEをステップアップ問題集の仕様に更新"
```

---

## 完了条件

- [ ] `node --test` が全件パスする（progress / quiz-engine / storage / question-data）
- [ ] ダッシュボードで20ステージの状態（✅ / ▶ / 🔒）が正しく表示される
- [ ] 初級に合格すると中級が開放され、不合格なら開放されない
- [ ] 合格済みステージの再挑戦で不合格になっても合格が取り消されない
- [ ] 進捗がリロード後も保持される
- [ ] ロック中ステージへのURL直打ちがダッシュボードへリダイレクトされる
- [ ] 旧コード（`judgeAllLevels` / `buildQuiz` / `gradeAnswers` / `cc-diagnosis-result` 等）への参照が残っていない
