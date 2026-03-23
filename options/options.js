import { DEFAULT_TEMPLATE } from '../src/template.js';
import { loadTemplate, resetTemplate, saveTemplate } from '../src/storage.js';

const templateEl = document.getElementById('template');
const saveButton = document.getElementById('save');
const resetButton = document.getElementById('reset');
const statusEl = document.getElementById('status');

function setStatus(message) {
  statusEl.textContent = message;
}

async function loadOptions() {
  const template = await loadTemplate();
  templateEl.value = typeof template === 'string' && template.trim() ? template : DEFAULT_TEMPLATE;
}

async function onSave() {
  await saveTemplate(templateEl.value);
  setStatus('Template saved.');
}

async function onReset() {
  const template = await resetTemplate();
  templateEl.value = template;
  setStatus('Template reset to default.');
}

saveButton.addEventListener('click', () => {
  onSave().catch((error) => {
    console.error('[ChatGPT Web Injector] Save failed:', error);
    setStatus('Save failed. Please try again.');
  });
});

resetButton.addEventListener('click', () => {
  onReset().catch((error) => {
    console.error('[ChatGPT Web Injector] Reset failed:', error);
    setStatus('Reset failed. Please try again.');
  });
});

loadOptions().catch((error) => {
  console.error('[ChatGPT Web Injector] Load options failed:', error);
  setStatus('Failed to load template.');
});
