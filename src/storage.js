import { DEFAULT_TEMPLATE, getEffectiveTemplate } from './template.js';

const LEGACY_KEY = 'defaultTemplate';
const TEMPLATES_KEY = 'templates';
const ACTIVE_ID_KEY = 'activeTemplateId';
const YOUTUBE_SUMMARY_TEMPLATE_KEY = 'youtubeSummaryTemplate';
const YOUTUBE_SUMMARY_TEMPORARY_CHAT_KEY = 'youtubeSummaryTemporaryChatEnabled';
const SHOW_SELECTION_TOOLTIP_KEY = 'showSelectionTooltip';

export const DEFAULT_YOUTUBE_SUMMARY_TEMPLATE = `You are a precise video summary assistant.

Video title: {{title}}
Video URL: {{url}}

Transcript:
{{transcript}}

Please provide:
1) Concise overall summary
2) Key points
3) Important arguments or claims
4) Actionable takeaways
5) Notable timestamps if useful`;

function getEffectiveYoutubeSummaryTemplate(template) {
  if (typeof template !== 'string') {
    return DEFAULT_YOUTUBE_SUMMARY_TEMPLATE;
  }

  return template.trim() ? template : DEFAULT_YOUTUBE_SUMMARY_TEMPLATE;
}

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

export async function loadYoutubeSummaryTemplate() {
  const data = await chrome.storage.sync.get([YOUTUBE_SUMMARY_TEMPLATE_KEY]);
  return getEffectiveYoutubeSummaryTemplate(data[YOUTUBE_SUMMARY_TEMPLATE_KEY]);
}

export async function saveYoutubeSummaryTemplate(body) {
  const template = getEffectiveYoutubeSummaryTemplate(body);
  await chrome.storage.sync.set({ [YOUTUBE_SUMMARY_TEMPLATE_KEY]: template });
}

export async function resetYoutubeSummaryTemplate() {
  await saveYoutubeSummaryTemplate(DEFAULT_YOUTUBE_SUMMARY_TEMPLATE);
  return DEFAULT_YOUTUBE_SUMMARY_TEMPLATE;
}

export async function loadYoutubeSummaryTemporaryChatEnabled() {
  const data = await chrome.storage.sync.get([YOUTUBE_SUMMARY_TEMPORARY_CHAT_KEY]);
  return data[YOUTUBE_SUMMARY_TEMPORARY_CHAT_KEY] !== false;
}

export async function saveYoutubeSummaryTemporaryChatEnabled(enabled) {
  await chrome.storage.sync.set({ [YOUTUBE_SUMMARY_TEMPORARY_CHAT_KEY]: enabled === true });
}

export async function loadSelectionTooltipEnabled() {
  const data = await chrome.storage.sync.get([SHOW_SELECTION_TOOLTIP_KEY]);
  return data[SHOW_SELECTION_TOOLTIP_KEY] !== false;
}

export async function saveSelectionTooltipEnabled(enabled) {
  await chrome.storage.sync.set({ [SHOW_SELECTION_TOOLTIP_KEY]: enabled === true });
}

