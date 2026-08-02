const PROGRESS_KEY = 'cc-diagnosis-progress';
const STAGE_SESSION_KEY = 'cc-diagnosis-stage-result';

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
