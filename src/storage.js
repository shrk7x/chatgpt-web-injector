import { DEFAULT_TEMPLATE, getEffectiveTemplate } from './template.js';

const TEMPLATE_KEY = 'defaultTemplate';

export async function loadTemplate() {
  const data = await chrome.storage.sync.get({ [TEMPLATE_KEY]: DEFAULT_TEMPLATE });
  return data[TEMPLATE_KEY];
}

export async function loadEffectiveTemplate() {
  const template = await loadTemplate();
  return getEffectiveTemplate(template);
}

export async function saveTemplate(template) {
  await chrome.storage.sync.set({ [TEMPLATE_KEY]: template });
}

export async function resetTemplate() {
  await saveTemplate(DEFAULT_TEMPLATE);
  return DEFAULT_TEMPLATE;
}
