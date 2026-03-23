import { runChatgptSendFlow } from './chatgpt_content.js';
import { loadEffectiveTemplate } from './storage.js';
import { renderTemplate } from './template.js';

const MENU_ID = 'send-to-chatgpt';
const CHATGPT_URL = 'https://chatgpt.com/';
const TAB_WAIT_TIMEOUT_MS = 15000;

function createContextMenu() {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: 'Send to ChatGPT',
    contexts: ['selection', 'page'],
  });
}

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

async function handleSendToChatgpt(info, tab) {
  const payload = {
    selection: info.selectionText || '',
    title: tab?.title || '',
    url: tab?.url || '',
  };

  const template = await loadEffectiveTemplate();
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

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    createContextMenu();
    console.log('[ChatGPT Web Injector] Context menu initialized.');
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== MENU_ID) {
    return;
  }

  try {
    await handleSendToChatgpt(info, tab);
  } catch (error) {
    console.error('[ChatGPT Web Injector] Send flow failed:', error);
  }
});
