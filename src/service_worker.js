import { runChatgptSendFlow } from './chatgpt_content.js';
import { loadTemplates, loadTemplateById } from './storage.js';
import { renderTemplate } from './template.js';

const MENU_ID = 'send-to-chatgpt';
const MENU_ITEM_PREFIX = 'send-to-chatgpt-tpl-';
const CHATGPT_URL = 'https://chatgpt.com/';
const TAB_WAIT_TIMEOUT_MS = 15000;

function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('tab_load_timeout'));
    }, timeoutMs);

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === 'complete') {
        clearTimeout(timeoutId);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function sendWithTemplate(templateId, selectionText, tab) {
  const payload = {
    selection: selectionText || '',
    title: tab?.title || '',
    url: tab?.url || '',
  };

  const template = await loadTemplateById(templateId);
  const prompt = renderTemplate(template, payload);

  const targetTab = await chrome.tabs.create({ url: CHATGPT_URL, active: true });
  await waitForTabComplete(targetTab.id, TAB_WAIT_TIMEOUT_MS);

  const [result] = await chrome.scripting.executeScript({
    target: { tabId: targetTab.id },
    func: runChatgptSendFlow,
    args: [prompt, { maxAttempts: 24, intervalMs: 250 }],
  });

  console.log('[ChatGPT Web Injector] Runtime send result:', result?.result || result);
}

async function rebuildContextMenu() {
  await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));

  const { templates, activeTemplateId } = await loadTemplates();

  if (templates.length <= 1) {
    // Single template (or empty due to storage corruption): simple top-level item
    const itemId = templates[0]?.id ?? activeTemplateId ?? 'default';
    chrome.contextMenus.create({
      id: `${MENU_ITEM_PREFIX}${itemId}`,
      title: 'Send to ChatGPT',
      contexts: ['selection', 'page'],
    });
  } else {
    // Multiple templates: parent + submenu
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Send to ChatGPT',
      contexts: ['selection', 'page'],
    });

    for (const tpl of templates) {
      const label = tpl.id === activeTemplateId ? `${tpl.name} ✓` : tpl.name;
      chrome.contextMenus.create({
        id: `${MENU_ITEM_PREFIX}${tpl.id}`,
        parentId: MENU_ID,
        title: label,
        contexts: ['selection', 'page'],
      });
    }
  }

  console.log('[ChatGPT Web Injector] Context menu rebuilt.');
}

chrome.runtime.onInstalled.addListener(() => {
  rebuildContextMenu().catch((err) => {
    console.error('[ChatGPT Web Injector] Context menu init failed:', err);
  });
});

// Rebuild menu when storage changes (e.g. templates edited in Options)
chrome.storage.onChanged.addListener((changes) => {
  if ('templates' in changes || 'activeTemplateId' in changes) {
    rebuildContextMenu().catch((err) => {
      console.error('[ChatGPT Web Injector] Context menu rebuild failed:', err);
    });
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { menuItemId } = info;
  if (!menuItemId.startsWith(MENU_ITEM_PREFIX)) {
    return;
  }

  const templateId = menuItemId.slice(MENU_ITEM_PREFIX.length);

  try {
    await sendWithTemplate(templateId, info.selectionText, tab);
  } catch (error) {
    console.error('[ChatGPT Web Injector] Send flow failed:', error);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'SELECTION_SEND') {
    return;
  }

  const { selectionText = '', pageTitle = '', pageUrl = '', templateId } = message.payload ?? {};

  loadTemplates().then(({ activeTemplateId }) => {
    return sendWithTemplate(
      templateId ?? activeTemplateId,
      selectionText,
      { title: pageTitle, url: pageUrl, id: sender.tab?.id },
    );
  }).catch((error) => {
    console.error('[ChatGPT Web Injector] Selection send flow failed:', error);
  });
});
