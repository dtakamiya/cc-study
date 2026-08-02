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
