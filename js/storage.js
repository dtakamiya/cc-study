const PROGRESS_KEY = 'cc-diagnosis-progress';
const STAGE_SESSION_KEY = 'cc-diagnosis-stage-result';

// ブラウザやiframeのポリシーによっては、localStorage/sessionStorageは
// プロパティに触れた時点でSecurityErrorを投げる。個々の操作をtryで囲むだけでは
// 呼び出し側の評価時に例外が漏れるため、取得自体をここで保護する。
function getStore(name) {
  try {
    return globalThis[name] ?? null;
  } catch (err) {
    return null;
  }
}

function readJson(storage, key) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function writeJson(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    return false;
  }
}

function removeKey(storage, key) {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch (err) {
    // 消せなくても致命的ではないため無視する
  }
}

// 進捗はゲート構造の前提なので、localStorageが使えない環境
// （プライベートブラウジング等）ではsessionStorageに退避する。
// どちらも使えない場合は 'none' を返し、呼び出し側が利用者に注記する。
export function saveProgressRaw(progressObject) {
  const local = getStore('localStorage');
  if (writeJson(local, PROGRESS_KEY, progressObject)) return 'local';

  const session = getStore('sessionStorage');
  if (writeJson(session, PROGRESS_KEY, progressObject)) {
    // localStorageに古い進捗が残っていると、読み込み時にそちらが優先されて
    // 記録が巻き戻る。退避したときは古い方を消し、正本を1つに保つ。
    removeKey(local, PROGRESS_KEY);
    return 'session';
  }
  return 'none';
}

export function loadProgressRaw() {
  return (
    readJson(getStore('localStorage'), PROGRESS_KEY) ??
    readJson(getStore('sessionStorage'), PROGRESS_KEY)
  );
}

export function saveStageResult(stageResult) {
  return writeJson(getStore('sessionStorage'), STAGE_SESSION_KEY, stageResult);
}

export function loadStageResult() {
  return readJson(getStore('sessionStorage'), STAGE_SESSION_KEY);
}
