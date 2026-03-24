import { DEFAULT_TEMPLATE } from '../src/template.js';
import { loadTemplates, saveTemplates, makeId } from '../src/storage.js';

const listEl = document.getElementById('template-list');
const editorEl = document.getElementById('editor');
const nameInput = document.getElementById('tpl-name');
const bodyInput = document.getElementById('tpl-body');
const saveTplBtn = document.getElementById('save-tpl');
const cancelTplBtn = document.getElementById('cancel-tpl');
const addTplBtn = document.getElementById('add-template');
const statusEl = document.getElementById('status');

let state = { templates: [], activeTemplateId: '' };
let editingId = null; // null = new template

function setStatus(msg) {
  statusEl.textContent = msg;
}

function openEditor(template) {
  editingId = template?.id ?? null;
  nameInput.value = template?.name ?? '';
  bodyInput.value = template?.body ?? DEFAULT_TEMPLATE;
  editorEl.classList.remove('hidden');
  nameInput.focus();
}

function closeEditor() {
  editorEl.classList.add('hidden');
  editingId = null;
}

function renderList() {
  listEl.innerHTML = '';

  for (const tpl of state.templates) {
    const isActive = tpl.id === state.activeTemplateId;

    const li = document.createElement('li');
    li.className = `template-item${isActive ? ' is-active' : ''}`;
    li.dataset.id = tpl.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'template-item__name';
    nameSpan.textContent = tpl.name;

    const badge = document.createElement('span');
    badge.className = 'template-item__badge';
    badge.textContent = isActive ? 'default' : '';

    const actions = document.createElement('div');
    actions.className = 'template-item__actions';

    if (!isActive) {
      const setDefaultBtn = document.createElement('button');
      setDefaultBtn.type = 'button';
      setDefaultBtn.className = 'btn-secondary btn-sm js-set-default';
      setDefaultBtn.textContent = 'Set default';
      actions.appendChild(setDefaultBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-secondary btn-sm js-edit';
    editBtn.textContent = 'Edit';
    actions.appendChild(editBtn);

    if (state.templates.length > 1) {
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-danger btn-sm js-delete';
      deleteBtn.textContent = 'Delete';
      actions.appendChild(deleteBtn);
    }

    li.append(nameSpan, badge, actions);
    listEl.appendChild(li);
  }
}

// Single delegated listener for all template list actions
listEl.addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) {
    return;
  }

  const item = e.target.closest('.template-item');
  const id = item?.dataset.id;
  if (!id) {
    return;
  }

  if (btn.classList.contains('js-set-default')) {
    onSetDefault(id).catch((err) => {
      console.error('[ChatGPT Web Injector] Set default failed:', err);
      setStatus('Failed to update default.');
    });
  } else if (btn.classList.contains('js-edit')) {
    const tpl = state.templates.find((t) => t.id === id);
    openEditor(tpl);
  } else if (btn.classList.contains('js-delete')) {
    onDelete(id).catch((err) => {
      console.error('[ChatGPT Web Injector] Delete failed:', err);
      setStatus('Delete failed. Please try again.');
    });
  }
});

async function persist() {
  await saveTemplates(state.templates, state.activeTemplateId);
}

async function onSetDefault(id) {
  state.activeTemplateId = id;
  await persist();
  renderList();
  setStatus('Default template updated.');
}

async function onDelete(id) {
  if (state.templates.length <= 1) {
    return;
  }
  state.templates = state.templates.filter((t) => t.id !== id);
  if (state.activeTemplateId === id) {
    state.activeTemplateId = state.templates[0].id;
  }
  await persist();
  renderList();
  setStatus('Template deleted.');
}

async function onSave() {
  const name = nameInput.value.trim();
  const body = bodyInput.value.trim();

  if (!name) {
    setStatus('Please enter a template name.');
    nameInput.focus();
    return;
  }

  if (editingId) {
    const idx = state.templates.findIndex((t) => t.id === editingId);
    if (idx >= 0) {
      state.templates[idx] = { ...state.templates[idx], name, body };
    }
  } else {
    const newTpl = { id: makeId(), name, body };
    state.templates.push(newTpl);
  }

  const isEditing = Boolean(editingId);
  await persist();
  closeEditor();
  renderList();
  setStatus(isEditing ? 'Template saved.' : 'Template added.');
}

addTplBtn.addEventListener('click', () => openEditor(null));

saveTplBtn.addEventListener('click', () => {
  onSave().catch((err) => {
    console.error('[ChatGPT Web Injector] Save failed:', err);
    setStatus('Save failed. Please try again.');
  });
});

cancelTplBtn.addEventListener('click', closeEditor);

async function init() {
  state = await loadTemplates();
  renderList();
}

init().catch((err) => {
  console.error('[ChatGPT Web Injector] Load options failed:', err);
  setStatus('Failed to load templates.');
});
