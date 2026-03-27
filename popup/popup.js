import { loadTemplates, saveTemplates } from '../src/storage.js';

const listEl = document.getElementById('template-list');
const manageBtn = document.getElementById('manage-btn');

let state = { templates: [], activeTemplateId: '' };

function render() {
  listEl.innerHTML = '';

  for (const tpl of state.templates) {
    const isActive = tpl.id === state.activeTemplateId;

    const li = document.createElement('li');
    li.className = `template-item${isActive ? ' is-active' : ''}`;
    li.dataset.id = tpl.id;

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

listEl.addEventListener('click', async (e) => {
  const item = e.target.closest('.template-item');
  if (!item) {
    return;
  }

  const { id } = item.dataset;
  if (!id || id === state.activeTemplateId) {
    return;
  }

  state.activeTemplateId = id;
  await saveTemplates(state.templates, state.activeTemplateId);
  render();
});

manageBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('options/options.html') });
  window.close();
});

async function init() {
  state = await loadTemplates();
  render();
}

init().catch((err) => {
  console.error('[ChatGPT Web Injector] Popup load failed:', err);
});
