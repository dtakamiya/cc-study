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
