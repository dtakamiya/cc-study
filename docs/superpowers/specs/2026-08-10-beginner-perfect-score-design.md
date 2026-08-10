# 初級レベルの合格基準を全問正解にする

作成日: 2026-08-10

## 背景と目的

現在、全32ステージが一律「10問中8問以上正解で合格」という基準を使っている
（`js/progress.js` の `PASSING_SCORE = 8`）。

初級は各領域の基礎を問う内容であり、ここでの取りこぼしは上位レベルの理解を直接損なう。
初級だけ全問正解（10/10）を要求し、基礎の定着を確実にする。中級以上は現行の8問のまま変更しない。

## 設計判断

### 合格基準をレベル別のマップで持つ

`PASSING_SCORE`（単一の定数）を削除し、レベルをキーとするマップに置き換える。

```js
export const PASSING_SCORES = {
  beginner: 10,
  intermediate: 8,
  advanced: 8,
  expert: 8,
};

export function getPassingScore(level) {
  return PASSING_SCORES[level] ?? 8;
}

export function isPassed(score, level) {
  return score >= getPassingScore(level);
}
```

`isPassed` に第2引数 `level` を追加する。呼び出し元は `js/quiz-page.js` の
`finishNormalStage` と `js/progress.js` の `recordAttempt` の2箇所だけで、
どちらも `level` を手元に持っているため引数を渡すだけで済む。

**`PASSING_SCORE` は残さず削除する。** 単一の合格ラインを表す定数を残すと、
「どれが正しい基準か」が2箇所に分かれ、`js/result-page.js` のような
固定値を前提にした表示バグを再び生む。参照は3ファイルのみで削除コストは低い。

`getPassingScore` の `?? 8` フォールバックは、`LEVELS` にない値が渡された場合に
`score >= undefined` が常に false となり「どれだけ正解しても不合格」になるのを防ぐ防御。
通常経路では `normalizeProgress` と `parseQuizMode` が不正な level を弾く。

### 既存の合格記録は剥奪しない

初級を8問または9問で合格済みの利用者の記録は、そのまま `cleared: true` を保つ。

理由は、`recordAttempt` に「一度得た合格は再挑戦で失敗しても剥奪しない」という
明文化された不変条件があるため。基準変更を遡及適用すると、この不変条件と矛盾するだけでなく、
合格済みだった上位レベルが突然ロックされ、利用者から見ればデータ破損と区別がつかない。

実装上の追加作業は不要。`recordAttempt` の

```js
cleared: (previous?.cleared ?? false) || isPassed(score, level)
```

が既存の `cleared: true` をそのまま引き継ぐため、`normalizeProgress` に移行ロジックを
持ち込む必要がない。`bestScore: 8` の初級合格記録が残るが、これは
「その時点の基準で合格した」という事実の記録であり、矛盾ではない。

### 結果画面はレベルに応じた合格ラインを表示する

`js/result-page.js` は現在 `合格ラインは ${PASSING_SCORE} 問` という固定文言を出しており、
レベル別基準では虚偽表示になる。初級で9問正解した利用者が「合格ラインは8問」と読みながら
不合格になり、バグと区別がつかない。

`getPassingScore(level)` に差し替える。`level` は `stageResult` に既に含まれ、
同ファイル内で分割代入済みのため追加の受け渡しは不要。

復習モードは合否も合格ラインも表示しないため影響を受けない。

## 変更範囲

### `js/progress.js`

- `PASSING_SCORE` を削除し `PASSING_SCORES` / `getPassingScore` を追加
- `isPassed(score, level)` にシグネチャ変更
- `recordAttempt` 内の `isPassed` 呼び出しに `level` を渡す

### `js/quiz-page.js`

- `finishNormalStage` の `isPassed(score)` を `isPassed(score, level)` に変更

### `js/result-page.js`

- import を `PASSING_SCORE` から `getPassingScore` に変更
- スコア行を `合格ラインは ${getPassingScore(level)} 問` に変更

### `tests/progress.test.js`

既存テストの書き換え:

- `assert.equal(PASSING_SCORE, 8)` → `PASSING_SCORES` の4レベル分の値を検証
- 「合格ラインの境界: 7問は不合格、8問は合格」→ レベル別の境界テストに分割
  - 初級: 9問は不合格、10問は合格
  - 中級・上級・エキスパート: 7問は不合格、8問は合格

追加テスト:

- **既存の初級合格記録が剥奪されない** — `cleared: true, bestScore: 8` の初級記録に
  `recordAttempt(…, 8)` を呼んでも `cleared` が `true` のまま。今回の設計判断の核であり、
  回帰テストとして明示的に置く
- **初級9問では合格しない** — 未合格の初級に `recordAttempt(…, 9)` を呼ぶと
  `cleared: false` となり、`getStageStatus` で中級が `locked` のまま
- **`getPassingScore` の未知レベルフォールバック** — `getPassingScore('unknown')` が `8` を返す

### ドキュメント

- `index.html` — 「8問以上正解すると合格し」に初級の例外を追記
- `README.md` — 同上（該当2箇所）、および復習モードの説明にある「10問中8問正解」の記述を
  レベル別基準と整合させる
- `CLAUDE.md` — 「復習は進捗に一切書き込まない」の説明にある「10問中8問」の記述を同様に修正

文言案: 各ステージは10問で構成され、**8問以上正解すると合格**します（**初級のみ全問正解が必要**）。

## 影響しない範囲

- **復習モード** — 合否判定を行わず、進捗に書き込まないため無関係
- **`getStageStatus` のゲート判定** — `cleared` フラグのみを見てスコアを見ない
- **問題データ（`data/questions/*.json`）** — 変更なし
- **`tests/quiz-page-invariants.test.js`** — `isPassed` を参照していない

## 検証

`node --test` で全テストが通ることを確認する。
