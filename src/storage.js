import { DEFAULT_TEMPLATE, getEffectiveTemplate } from './template.js';

const LEGACY_KEY = 'defaultTemplate';
const TEMPLATES_KEY = 'templates';
const ACTIVE_ID_KEY = 'activeTemplateId';

export function makeId() {
  return `tpl_${crypto.randomUUID()}`;
}

function defaultTemplateEntry() {
  return { id: 'default', name: 'Analyze', body: DEFAULT_TEMPLATE };
}

/**
 * Load the full templates list and active id from storage.
 * Migrates legacy single-template storage on first call.
 * @returns {{ templates: Array<{id:string, name:string, body:string}>, activeTemplateId: string }}
 */
export async function loadTemplates() {
  const data = await chrome.storage.sync.get([LEGACY_KEY, TEMPLATES_KEY, ACTIVE_ID_KEY]);

  if (data[TEMPLATES_KEY]) {
    const templates = data[TEMPLATES_KEY];
    let activeId = data[ACTIVE_ID_KEY];

    if (!activeId || !templates.some((t) => t.id === activeId)) {
      activeId = templates[0]?.id ?? 'default';
    }

    return { templates, activeTemplateId: activeId };
  }

  // Migrate legacy single template
  const legacyBody = typeof data[LEGACY_KEY] === 'string' && data[LEGACY_KEY].trim()
    ? data[LEGACY_KEY]
    : DEFAULT_TEMPLATE;

  const entry = { id: 'default', name: 'Analyze', body: legacyBody };
  const templates = [entry];
  await chrome.storage.sync.set({ [TEMPLATES_KEY]: templates, [ACTIVE_ID_KEY]: 'default' });

  return { templates, activeTemplateId: 'default' };
}

export async function saveTemplates(templates, activeTemplateId) {
  await chrome.storage.sync.set({ [TEMPLATES_KEY]: templates, [ACTIVE_ID_KEY]: activeTemplateId });
}

export async function loadEffectiveTemplate() {
  const { templates, activeTemplateId } = await loadTemplates();
  const entry = templates.find((t) => t.id === activeTemplateId) ?? templates[0] ?? defaultTemplateEntry();
  return getEffectiveTemplate(entry.body);
}

export async function loadTemplateById(id) {
  const { templates } = await loadTemplates();
  const entry = templates.find((t) => t.id === id);
  return entry ? getEffectiveTemplate(entry.body) : getEffectiveTemplate(DEFAULT_TEMPLATE);
}

// ---- legacy shims so existing imports keep working ----

export async function loadTemplate() {
  return loadEffectiveTemplate();
}

export async function saveTemplate(body) {
  const { templates, activeTemplateId } = await loadTemplates();
  const idx = templates.findIndex((t) => t.id === activeTemplateId);
  if (idx >= 0) {
    templates[idx] = { ...templates[idx], body };
  } else {
    templates.push({ id: activeTemplateId, name: 'Untitled', body });
  }
  await saveTemplates(templates, activeTemplateId);
}

export async function resetTemplate() {
  await saveTemplate(DEFAULT_TEMPLATE);
  return DEFAULT_TEMPLATE;
}
