# 実装計画: 初級レベルの合格基準を全問正解にする

作成日: 2026-08-10
設計書: [2026-08-10-beginner-perfect-score-design.md](../specs/2026-08-10-beginner-perfect-score-design.md)

初級のみ合格基準を10問中10問に変更し、中級以上は8問のまま据え置く。
既存の合格記録は剥奪しない。設計判断の根拠は設計書を参照すること。

以下のステップは記載順に実行する。ステップ1で `isPassed` のシグネチャを変えると
呼び出し元が壊れるため、ステップ3までは中間状態でテストが落ちる。
ステップ3完了後に初めて `node --test` を通す。

---

## ステップ1: `js/progress.js` の合格基準をレベル別にする

`PASSING_SCORE` の定義（26行目付近）を次で置き換える。

```js
export const PASSING_SCORES = {
  beginner: 10,
  intermediate: 8,
  advanced: 8,
  expert: 8,
};
```

`isPassed`（41行目付近）を次で置き換える。

```js
// 合否判定用。未知・欠落のレベルは黙って通さず例外にする。
// 既定値でフォールバックすると、levelの渡し忘れで初級8問が合格として
// cleared: true に永続化され、「一度得た合格は剥奪しない」不変条件により
// 後から訂正できなくなる。落ちるほうが安全。
export function getPassingScore(level) {
  const threshold = PASSING_SCORES[level];
  if (typeof threshold !== 'number') {
    throw new Error(`未知のレベルです: ${String(level)}`);
  }
  return threshold;
}

export function isPassed(score, level) {
  return score >= getPassingScore(level);
}
```

`recordAttempt` 内（92行目付近）の呼び出しを修正する。`level` は同関数の引数として
既に存在するため、渡すだけでよい。

```js
cleared: (previous?.cleared ?? false) || isPassed(score, level),
```

**注意:** `getPassingScore` は `PASSING_SCORES` より後、`isPassed` より前に定義する
（`export function` は巻き上げられるので順序は動作に影響しないが、読み順を揃える）。

## ステップ2: `js/quiz-page.js` の呼び出しを修正する

`finishNormalStage` 内（175行目付近）:

```js
const passed = isPassed(score, level);
```

`level` は同関数冒頭の `const { domain, level } = target;` で分割代入済み。
import 文の変更は不要（`isPassed` を既に import している）。

## ステップ3: `js/result-page.js` の表示をレベル別にする

import（3行目）を差し替える。

```js
import { getPassingScore } from './progress.js';
```

スコア行（59行目付近）を差し替える。

```js
document.getElementById('score-line').textContent =
  `${score} / ${total} 問正解（合格ラインは ${getPassingScore(level)} 問）`;
```

`level` は17〜30行目の分割代入に既に含まれている。この行は `isReview` が偽の分岐内に
あるため、復習モードでは評価されない（復習は `level` を持たないので重要）。

**この時点で `node --test` を実行する。** `tests/progress.test.js` が
`PASSING_SCORE` を import していて失敗するはずで、それが次のステップの対象。

## ステップ4: `tests/progress.test.js` を更新する

import（3〜15行目）の `PASSING_SCORE` を `PASSING_SCORES` と `getPassingScore` に置き換える。

「定数が設計どおりの値である」（17行目）の `assert.equal(PASSING_SCORE, 8)` を置き換える。

```js
assert.deepEqual(PASSING_SCORES, {
  beginner: 10,
  intermediate: 8,
  advanced: 8,
  expert: 8,
});
```

「合格ラインの境界: 7問は不合格、8問は合格」（36行目）のテスト全体を、以下の4テストで
置き換える。

```js
test('初級の合格ラインは全問正解: 9問は不合格、10問は合格', () => {
  assert.equal(isPassed(9, 'beginner'), false);
  assert.equal(isPassed(10, 'beginner'), true);
  assert.equal(isPassed(0, 'beginner'), false);
});

test('中級以上の合格ラインは8問: 7問は不合格、8問は合格', () => {
  for (const level of ['intermediate', 'advanced', 'expert']) {
    assert.equal(isPassed(7, level), false, `${level} で7問が合格になっています`);
    assert.equal(isPassed(8, level), true, `${level} で8問が不合格になっています`);
    assert.equal(isPassed(10, level), true);
  }
});

// 既定値でフォールバックすると、levelの渡し忘れで初級8問が合格として
// 永続化される。移行漏れは黙って隠さず露呈させる。
test('未知・欠落のレベルは合否判定で例外になる', () => {
  assert.throws(() => getPassingScore('unknown'));
  assert.throws(() => getPassingScore(undefined));
  assert.throws(() => isPassed(10, undefined));
});

// 基準の変更を遡及適用しない。既存利用者の合格を剥奪すると、
// 上位レベルが突然ロックされ、利用者にはデータ破損と区別がつかない。
test('基準変更前に8問で合格した初級の記録は維持される', () => {
  const progress = createEmptyProgress();
  progress.domains['basic-operations'].beginner = {
    cleared: true,
    bestScore: 8,
    attempts: 1,
    lastAttemptAt: '2026-08-01T00:00:00.000Z',
  };

  const updated = recordAttempt(progress, 'basic-operations', 'beginner', 8);

  assert.equal(getStageRecord(updated, 'basic-operations', 'beginner').cleared, true);
  assert.equal(getStageStatus(updated, 'basic-operations', 'beginner'), 'cleared');
  assert.equal(getStageStatus(updated, 'basic-operations', 'intermediate'), 'available');
});

test('未合格の初級は9問では合格にならず、中級も開放されない', () => {
  const progress = recordAttempt(createEmptyProgress(), 'basic-operations', 'beginner', 9);

  assert.equal(getStageRecord(progress, 'basic-operations', 'beginner').cleared, false);
  assert.equal(getStageStatus(progress, 'basic-operations', 'intermediate'), 'locked');
});
```

### 既存テストのうち初級に8〜9問を渡しているものを修正する

初級に8問または9問を渡して「合格した」ことを前提にしている既存テストが5件あり、
いずれも新基準では `cleared: false` となって失敗する。これらは今回の変更の
検証対象ではなく、単に合格状態を作るための前提として点数を使っているだけなので、
**点数を10に変えてテストの意図を保つ**（テスト名や assert は変更しない）。

| 行 | テスト名 | 修正 |
|----|---------|------|
| 53 | 初級に合格すると中級が開放され、上級はロックされたまま | `8` → `10` |
| 75 | 領域どうしは独立して進行する | `9` → `10` |
| 82 | 合格済みステージは再挑戦で不合格になっても cleared を維持する | `9` → `10`（83行目の `3` は不合格役なので変更しない） |
| 91 | bestScore は最高得点を保ち、attempts は挑戦のたびに増える | 後述 |
| 123 | normalizeProgress は正しい進捗をそのまま保持する | `8` → `10` |

88行目「bestScore は最高得点を保ち、attempts は挑戦のたびに増える」は、
`5, 9, 6` の3回挑戦で `bestScore: 9` / `attempts: 3` / `cleared: true` を検証している。
点数の大小関係そのものがテストの主題なので、単純な置換ではなく次のように変える。
最高点を10にして `cleared: true` を維持しつつ、bestScore が「最後の値」ではなく
「最高値」であることの検証も保つ。

```js
progress = recordAttempt(progress, 'basic-operations', 'beginner', 5);
progress = recordAttempt(progress, 'basic-operations', 'beginner', 10);
progress = recordAttempt(progress, 'basic-operations', 'beginner', 6);
const record = getStageRecord(progress, 'basic-operations', 'beginner');
assert.equal(record.bestScore, 10);
```

`attempts`・`cleared`・`lastAttemptAt` の assert は変更しない。

以下は変更不要:

- 61行目（初級7問で不合格）— 新基準でも不合格のまま、意図が変わらない
- 69行目（中級10問）・146行目（初級10問）— 既に10問
- 102行目（初級10問）— 既に10問
- 133行目の `bestScore: 8` を含む生データ — `normalizeProgress` の
  キー除去を検証しているだけで、合否判定を通らない。むしろ「基準変更前の
  8問合格レコードがそのまま読み込まれる」ことを示す good case として残す価値がある

## ステップ5: `tests/quiz-page-invariants.test.js` に呼び出し契約のテストを追加する

ページ層は DOM に依存して直接テストできず、このリポジトリは依存パッケージを持たない
制約があるため jsdom は導入しない。既存ファイルと同じソース文字列検査の手法を使う。

ファイル末尾に追加する。

```js
// levelを渡し忘れると getPassingScore が例外を投げるが、
// それは実行時にしか分からない。形をソース上で固定して、コミット前に検出する。
test('finishNormalStage は isPassed に level を渡す', () => {
  const normalBody = extractFunction('finishNormalStage');
  assert.ok(
    normalBody.includes('isPassed(score, level)'),
    'finishNormalStage が isPassed に level を渡していません'
  );
});
```

## ステップ6: ドキュメントを更新する

以下の4箇所を修正する。文言は「各ステージは10問で構成され、**8問以上正解すると合格**
します（**初級のみ全問正解が必要**）」を基本形とし、各文脈に合わせて調整する。

- `index.html` 14行目 — 「各ステージは10問で、8問以上正解すると合格し、」に初級の例外を追記
- `README.md` 8行目 — 「各ステージは10問で構成され、**8問以上正解すると合格**し、」に同上
- `README.md` 18行目 — 「3. 8問以上正解すれば合格。次のレベルが開放される」に同上
- `README.md` 30行目 — 「ゲートが「10問中8問正解」という本来の基準を」を、レベル別基準と
  整合する表現にする（例: 「本来の合格基準を満たさなくても素通りできてしまい」）
- `CLAUDE.md` 68行目 — 「一度見た問題で合格できると「10問中8問」のゲートが形骸化する」を
  同様に修正

`README.md` 21行目「一度得た合格は取り消されません」は今回の設計と整合しているため
変更しない。

## ステップ7: 検証

```bash
node --test
```

全テストが通ることを確認する。件数は104テストから109テストに増える
（ステップ4で1テストを5テストに置き換えて +4、ステップ5で1テスト追加して +1）。
既存5件の点数修正はテスト数を変えない。

`grep -rn "PASSING_SCORE\b" js tests` を実行し、旧定数の参照が残っていないことを
確認する（`PASSING_SCORES` は別名なので `\b` で区切る）。

ブラウザでの目視確認:

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` から初級ステージに挑戦し、9問正解で不合格、
結果画面に「合格ラインは 10 問」と表示されることを確認する。
中級以上のステージでは「合格ラインは 8 問」のままであることも確認する。
