const STORAGE_KEY = 'cc-diagnosis-result';

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
