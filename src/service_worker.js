import { runChatgptSendFlow } from './chatgpt_content.js';
import {
  loadTemplates,
  loadTemplateById,
  loadYoutubeSummaryTemporaryChatEnabled,
  loadYoutubeSummaryTemplate,
} from './storage.js';
import { renderTemplate } from './template.js';

const MENU_ID = 'send-to-chatgpt';
const MENU_ITEM_PREFIX = 'send-to-chatgpt-tpl-';
const CHATGPT_URL = 'https://chatgpt.com/';
const CHATGPT_TEMPORARY_URL = 'https://chatgpt.com/?temporary-chat=true';
const TAB_WAIT_TIMEOUT_MS = 15000;
const INJECT_ATTEMPTS = 3;
const INJECT_RETRY_MS = 750;

let isMenuRebuildRunning = false;
let hasPendingMenuRebuild = false;

export function getChatgptTargetUrl(preferTemporaryChat) {
  return preferTemporaryChat ? CHATGPT_TEMPORARY_URL : CHATGPT_URL;
}

export function waitForTabComplete(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };

    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('tab_load_timeout'));
    }, timeoutMs);

    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId) {
        return;
      }

      if (changeInfo.status === 'complete') {
        finish();
      }
    };

    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab?.status === 'complete') {
        finish();
      }
    }).catch((error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(error);
    });
  });
}

function isTransientFrameError(error) {
  return /frame with id \d+ was removed/i.test(error?.message || '');
}

export async function executeChatgptSendFlow(tabId, prompt, options = {}) {
  const injectAttempts = Number.isFinite(options.injectAttempts) ? options.injectAttempts : INJECT_ATTEMPTS;
  const injectRetryMs = Number.isFinite(options.injectRetryMs) ? options.injectRetryMs : INJECT_RETRY_MS;

  for (let attempt = 1; attempt <= injectAttempts; attempt += 1) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: runChatgptSendFlow,
        args: [prompt, {
          maxAttempts: options.maxAttempts,
          intervalMs: options.intervalMs,
          preferTemporaryChat: options.preferTemporaryChat === true,
        }],
      });

      return result?.result || result;
    } catch (error) {
      if (!isTransientFrameError(error) || attempt === injectAttempts) {
        throw error;
      }

      await waitForTabComplete(tabId, TAB_WAIT_TIMEOUT_MS);
      await new Promise((resolve) => { setTimeout(resolve, injectRetryMs); });
    }
  }

  throw new Error('chatgpt_injection_failed');
}

async function sendWithTemplate(templateId, selectionText, tab) {
  const payload = {
    selection: selectionText || '',
    title: tab?.title || '',
    url: tab?.url || '',
  };

  const template = await loadTemplateById(templateId);
  const prompt = renderTemplate(template, payload);
  await sendPromptToChatgpt(prompt);
}

async function safeTabsCreate(createProperties, maxAttempts = 3, delayMs = 150) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await chrome.tabs.create(createProperties);
    } catch (error) {
      const isDraggingError = /tabs cannot be edited right now/i.test(error?.message || '');
      if (!isDraggingError || attempt === maxAttempts) {
        throw error;
      }
      console.warn(`[ChatGPT Web Injector] Tab creation delayed due to tab dragging state, retrying in ${delayMs}ms (attempt ${attempt}/${maxAttempts})...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function sendPromptToChatgpt(prompt, options = {}) {
  const targetUrl = getChatgptTargetUrl(options.preferTemporaryChat === true);
  const targetTab = await safeTabsCreate({ url: targetUrl, active: true });
  await waitForTabComplete(targetTab.id, TAB_WAIT_TIMEOUT_MS);

  const result = await executeChatgptSendFlow(targetTab.id, prompt, {
    maxAttempts: 24,
    intervalMs: 250,
    preferTemporaryChat: options.preferTemporaryChat === true,
  });

  console.log('[ChatGPT Web Injector] Runtime send result:', result);
}

async function sendYoutubeSummary(payload) {
  const preferTemporaryChat = await loadYoutubeSummaryTemporaryChatEnabled();
  const template = await loadYoutubeSummaryTemplate();
  const prompt = renderTemplate(template, {
    title: payload?.title || '',
    url: payload?.url || '',
    transcript: payload?.transcript || '',
  });

  await sendPromptToChatgpt(prompt, { preferTemporaryChat });
}

async function rebuildContextMenuOnce() {
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

async function rebuildContextMenu() {
  if (isMenuRebuildRunning) {
    hasPendingMenuRebuild = true;
    return;
  }

  isMenuRebuildRunning = true;

  try {
    do {
      hasPendingMenuRebuild = false;
      await rebuildContextMenuOnce();
    } while (hasPendingMenuRebuild);
  } finally {
    isMenuRebuildRunning = false;
  }
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
  if (message?.type === 'YOUTUBE_SUMMARY_SEND') {
    sendYoutubeSummary(message.payload).catch((error) => {
      console.error('[ChatGPT Web Injector] YouTube summary send flow failed:', error);
    });
    return;
  }

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
