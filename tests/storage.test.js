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

// ブラウザ/iframeのポリシーによっては、プロパティへのアクセス自体が
// SecurityErrorを投げる。スタブではgetterで再現する。
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

let storage;

beforeEach(async () => {
  defineStorage('localStorage', makeStorageStub());
  defineStorage('sessionStorage', makeStorageStub());
  // クエリ文字列でモジュールキャッシュを回避し、毎回新しく読み込む
  storage = await import(`../js/storage.js?t=${Date.now()}${Math.random()}`);
});

test('saveProgressRaw は localStorage に保存して "local" を返す', () => {
  const result = storage.saveProgressRaw({ version: 1, domains: {} });
  assert.equal(result, 'local');
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: {} });
});

test('localStorage が使えない場合は sessionStorage に退避して "session" を返す', () => {
  defineStorage('localStorage', makeStorageStub({ throwOnSet: true }));
  const result = storage.saveProgressRaw({ version: 1, domains: {} });
  assert.equal(result, 'session');
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: {} });
});

test('どちらのストレージも使えない場合は "none" を返す', () => {
  defineStorage('localStorage', makeStorageStub({ throwOnSet: true }));
  defineStorage('sessionStorage', makeStorageStub({ throwOnSet: true }));
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
  defineStorage('sessionStorage', makeStorageStub({ throwOnSet: true }));
  assert.equal(storage.saveStageResult({ score: 8 }), false);
});

test('localStorage のプロパティアクセスが例外を投げても sessionStorage に退避する', () => {
  // ブラウザのポリシーで localStorage 自体に触れないケース。
  // ヘルパー内の try では捕まらないため、呼び出し側で防ぐ必要がある。
  defineThrowingStorage('localStorage');
  assert.equal(storage.saveProgressRaw({ version: 1, domains: {} }), 'session');
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: {} });
});

test('両方のストレージのプロパティアクセスが例外を投げても "none" を返す', () => {
  defineThrowingStorage('localStorage');
  defineThrowingStorage('sessionStorage');
  assert.equal(storage.saveProgressRaw({ version: 1, domains: {} }), 'none');
  assert.equal(storage.loadProgressRaw(), null);
  assert.equal(storage.saveStageResult({ score: 8 }), false);
  assert.equal(storage.loadStageResult(), null);
});

test('sessionStorage に退避したとき、古い localStorage の進捗を残さない', () => {
  // 古い進捗が localStorage にある状態で localStorage が書けなくなると、
  // 新しい進捗は sessionStorage に入る。このとき古い方を消しておかないと、
  // 次回の読み込みで古い進捗が優先されて記録が巻き戻る。
  const local = makeStorageStub();
  local.data.set('cc-diagnosis-progress', JSON.stringify({ version: 1, domains: { old: true } }));
  defineStorage('localStorage', local);

  // 書き込みだけが失敗し、読み出しは従来どおり可能な状態を作る
  const failingLocal = {
    getItem: key => local.getItem(key),
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
    removeItem: key => local.removeItem(key),
  };
  defineStorage('localStorage', failingLocal);

  assert.equal(storage.saveProgressRaw({ version: 1, domains: { fresh: true } }), 'session');
  assert.deepEqual(storage.loadProgressRaw(), { version: 1, domains: { fresh: true } });
});
