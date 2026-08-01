import { loadResult, loadFallbackResult } from './storage.js';

const previousResult = loadResult() ?? loadFallbackResult();
const note = document.getElementById('previous-result-note');
const viewLastResultButton = document.getElementById('view-last-result-button');

if (previousResult) {
  note.textContent = '前回の診断結果が保存されています。';
  note.style.display = 'block';
  viewLastResultButton.style.display = 'inline-block';
}
