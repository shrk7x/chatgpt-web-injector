import {
  loadTemplates,
  saveTemplates,
  loadYoutubeSummaryTemporaryChatEnabled,
  saveYoutubeSummaryTemporaryChatEnabled
} from '../src/storage.js';

const listEl = document.getElementById('template-list');
const manageBtn = document.getElementById('manage-btn');
const youtubeTemplateBtn = document.getElementById('youtube-template-btn');

let state = { templates: [], activeTemplateId: '' };

function render() {
  listEl.innerHTML = '';

  for (const tpl of state.templates) {
    const isActive = tpl.id === state.activeTemplateId;

    const li = document.createElement('li');
    li.className = `template-item${isActive ? ' is-active' : ''}`;
    li.dataset.id = tpl.id;
    li.setAttribute('role', 'option');
    li.setAttribute('aria-selected', String(isActive));
    li.setAttribute('tabindex', '0');

    const check = document.createElement('span');
    check.className = 'template-item__check';
    check.textContent = isActive ? '✓' : '';
    check.setAttribute('aria-hidden', 'true');

    const name = document.createElement('span');
    name.className = 'template-item__name';
    name.textContent = tpl.name;

    li.append(check, name);
    listEl.appendChild(li);
  }
}

async function selectTemplate(id) {
  if (!id || id === state.activeTemplateId) {
    return;
  }

  const prevId = state.activeTemplateId;
  state.activeTemplateId = id;
  render();

  try {
    await saveTemplates(state.templates, state.activeTemplateId);
  } catch (err) {
    console.error('[ChatGPT Web Injector] Failed to save active template:', err);
    state.activeTemplateId = prevId;
    render();
  }
}

listEl.addEventListener('click', (e) => {
  const item = e.target.closest('.template-item');
  if (!item) {
    return;
  }

  selectTemplate(item.dataset.id).catch((err) => {
    console.error('[ChatGPT Web Injector] Select template failed:', err);
  });
});

listEl.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') {
    return;
  }

  const item = e.target.closest('.template-item');
  if (!item) {
    return;
  }

  e.preventDefault();
  selectTemplate(item.dataset.id).catch((err) => {
    console.error('[ChatGPT Web Injector] Select template failed:', err);
  });
});

manageBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  window.close();
});

youtubeTemplateBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html#youtube-summary-template') });
  window.close();
});

const tempChatToggle = document.getElementById('youtube-temp-chat-toggle');

async function init() {
  state = await loadTemplates();
  render();

  try {
    const tempChatEnabled = await loadYoutubeSummaryTemporaryChatEnabled();
    if (tempChatToggle) {
      tempChatToggle.checked = tempChatEnabled;
    }
  } catch (err) {
    console.error('[ChatGPT Web Injector] Failed to load youtube summary temporary chat state:', err);
  }

  if (tempChatToggle) {
    tempChatToggle.addEventListener('change', async (e) => {
      try {
        await saveYoutubeSummaryTemporaryChatEnabled(e.target.checked);
      } catch (err) {
        console.error('[ChatGPT Web Injector] Failed to save youtube summary temporary chat state:', err);
        e.target.checked = !e.target.checked;
      }
    });
  }
}

init().catch((err) => {
  console.error('[ChatGPT Web Injector] Popup load failed:', err);
});
