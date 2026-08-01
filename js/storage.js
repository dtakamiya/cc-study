const STORAGE_KEY = 'cc-diagnosis-result';
const FALLBACK_STORAGE_KEY = 'cc-diagnosis-result-fallback';

export function saveResult(resultObject) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resultObject));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function clearResult() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}

// localStorageが利用できない環境（プライベートブラウジング等）向けの
// その場限りのフォールバック保存先。sessionStorageも失敗しうるため同様に例外安全にする。
export function saveFallbackResult(resultObject) {
  try {
    sessionStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(resultObject));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadFallbackResult() {
  try {
    const raw = sessionStorage.getItem(FALLBACK_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}
