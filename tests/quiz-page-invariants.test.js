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
