import { runGeminiSendFlow } from './gemini_content.js';
import { runChatgptSendFlow } from './chatgpt_content.js';
import {
  loadTargetProvider,
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
  await sendPrompt(prompt);
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

/**
 * Show an in-page notice, optionally with a full prompt copy control.
 * Self-contained for scripting.executeScript.
 * @param {string|null} prompt
 * @param {string} message
 * @returns {void}
 */
export function showPromptNotice(prompt, message) {
  document.getElementById('chatgpt-web-injector-recovery')?.remove();
  const panel = document.createElement('dialog');
  panel.id = 'chatgpt-web-injector-recovery';
  panel.style.cssText = 'position:fixed;max-width:90vw;width:720px;z-index:2147483647;padding:24px;';
  const hint = document.createElement('p');
  hint.textContent = message;
  panel.append(hint);
  if (typeof prompt === 'string') {
    const text = document.createElement('textarea');
    text.value = prompt;
    text.readOnly = true;
    text.rows = 12;
    text.style.width = '100%';
    text.setAttribute('aria-label', 'Full pending prompt');
    const copy = document.createElement('button');
    copy.textContent = 'Copy full prompt';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text.value); }
      catch (_error) { text.select(); document.execCommand('copy'); }
    });
    panel.append(text, copy);
  }
  const close = document.createElement('button');
  close.textContent = 'Close';
  close.addEventListener('click', () => panel.remove());
  panel.append(close);
  document.body.append(panel);
  panel.showModal();
}

async function showVisibleSendError(message) {
  await Promise.allSettled([
    chrome.action.setBadgeText({ text: '!' }),
    chrome.action.setTitle({ title: message }),
  ]);
}

/**
 * Send a rendered prompt to the selected web assistant with recovery.
 * @param {string} prompt
 * @param {{preferTemporaryChat?: boolean}} options
 * @returns {Promise<void>}
 */
export async function sendPrompt(prompt, options = {}) {
  const provider = await loadTargetProvider();
  const targetUrl = provider === 'gemini' ? 'https://gemini.google.com/app'
    : getChatgptTargetUrl(options.preferTemporaryChat === true);
  const recoveryId = `pendingPrompt_${crypto.randomUUID()}`;
  // Retain the full prompt before navigation, including when injection is denied.
  try {
    await chrome.storage.local.set({ [recoveryId]: { prompt, provider } });
  } catch (_error) {
    try {
      const tab = await safeTabsCreate({ url: targetUrl, active: true });
      await waitForTabComplete(tab.id, TAB_WAIT_TIMEOUT_MS);
      await chrome.scripting.executeScript({
        target: { tabId: tab.id }, func: showPromptNotice,
        args: [prompt, 'Prompt recovery storage is unavailable. Nothing was sent automatically. Copy the full prompt before closing this tab.'],
      });
    } catch (_fallbackError) {
      await showVisibleSendError('Send failed: prompt could not be saved or displayed. Please reselect the source text and try again.');
    }
    return;
  }
  let targetTab;
  try {
    targetTab = await safeTabsCreate({ url: targetUrl, active: true });
    await waitForTabComplete(targetTab.id, TAB_WAIT_TIMEOUT_MS);
    let result;
    if (provider === 'gemini') {
      const [execution] = await chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        func: runGeminiSendFlow,
        args: [prompt],
      });
      result = execution?.result;
    } else {
      result = await executeChatgptSendFlow(targetTab.id, prompt, {
        maxAttempts: 24,
        intervalMs: 250,
        preferTemporaryChat: options.preferTemporaryChat === true,
      });
    }
    if (!result?.ok) {
      throw new Error(result?.reason || 'send_unconfirmed');
    }
  } catch (error) {
    console.warn('[ChatGPT Web Injector] Send unconfirmed; opening prompt recovery:', error);
    await safeTabsCreate({
      url: chrome.runtime.getURL(`options/options.html#${recoveryId}`), active: true,
    });
    return;
  }
  // Submission is already confirmed. Cleanup must never turn it into a send failure.
  try {
    await chrome.storage.local.remove(recoveryId);
    await Promise.allSettled([
      chrome.action.setBadgeText({ text: '' }),
      chrome.action.setTitle({ title: 'ChatGPT Web Injector' }),
    ]);
  } catch (_cleanupError) {
    try {
      // Replacing the full prompt also frees quota and prevents stale retry advice.
      await chrome.storage.local.set({ [recoveryId]: { provider, submitted: true } });
    } catch (_markError) {
      await showVisibleSendError('Message sent successfully. Saved prompt cleanup failed; do not resend it.');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: targetTab.id }, func: showPromptNotice,
          args: [null, 'Message sent successfully. Saved prompt cleanup failed; do not resend it.'],
        });
      } catch (_noticeError) {
        // The toolbar badge and title retain the confirmed status after navigation.
      }
    }
  }
}

async function sendYoutubeSummary(payload) {
  const preferTemporaryChat = await loadYoutubeSummaryTemporaryChatEnabled();
  const template = await loadYoutubeSummaryTemplate();
  const prompt = renderTemplate(template, {
    title: payload?.title || '',
    url: payload?.url || '',
    transcript: payload?.transcript || '',
  });

  await sendPrompt(prompt, { preferTemporaryChat });
}

async function rebuildContextMenuOnce() {
  await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));

  const { templates, activeTemplateId } = await loadTemplates();
  const provider = await loadTargetProvider();
  const menuTitle = provider === 'gemini' ? 'Send to Gemini' : 'Send to ChatGPT';

  if (templates.length <= 1) {
    // Single template (or empty due to storage corruption): simple top-level item
    const itemId = templates[0]?.id ?? activeTemplateId ?? 'default';
    chrome.contextMenus.create({
      id: `${MENU_ITEM_PREFIX}${itemId}`,
      title: menuTitle,
      contexts: ['selection', 'page'],
    });
  } else {
    // Multiple templates: parent + submenu
    chrome.contextMenus.create({
      id: MENU_ID,
      title: menuTitle,
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
  if ('templates' in changes || 'activeTemplateId' in changes || 'targetProvider' in changes) {
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
