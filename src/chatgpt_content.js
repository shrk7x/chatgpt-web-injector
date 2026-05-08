export async function runChatgptSendFlow(prompt, options = {}) {
  const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 20;
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : 250;
  const preferTemporaryChat = options.preferTemporaryChat === true;
  const fallbackId = 'chatgpt-web-injector-fallback';

  const inputSelectors = ['textarea', '[contenteditable]', "div[role='textbox']"];
  const sendSelectors = [
    "button[data-testid='send-button']",
    "button[data-testid*='send']",
    "button[aria-label*='Send']",
    "button[aria-label*='send']",
    "button[aria-label*='发送']",
    "button[type='submit']",
  ];

  function findFirst(selectors) {
    for (const selector of selectors) {
      const candidate = document.querySelector(selector);
      if (candidate) {
        return candidate;
      }
    }
    return null;
  }

  // Find send button including those that may currently be disabled
  function findSendButton() {
    // Try enabled buttons first
    const btn = findFirst(sendSelectors);
    if (btn) return btn;
    // Fall back: any button near the input that looks like a send button
    const allButtons = Array.from(document.querySelectorAll('button'));
    return allButtons.find((button) =>
      /send|submit|发送|提交/i.test(
        button.getAttribute('aria-label') || button.getAttribute('data-testid') || ''
      )
    ) || null;
  }

  function dispatchTextInputEvents(input, text) {
    if (typeof InputEvent === 'function') {
      input.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: text,
        inputType: 'insertText',
      }));
    } else {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setNativeValue(input, text) {
    const descriptor = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value');
    if (descriptor?.set) {
      descriptor.set.call(input, text);
    } else {
      input.value = text;
    }
  }

  function selectEditableContents(input) {
    const selection = window.getSelection?.();
    if (!selection || !document.createRange) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function setContentEditableText(input, text) {
    input.textContent = text;
    dispatchTextInputEvents(input, text);
  }

  function insertPrompt(input, text) {
    input.focus();

    if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
      setNativeValue(input, text);
      dispatchTextInputEvents(input, text);
      return;
    }

    selectEditableContents(input);
    const inserted = document.execCommand('insertText', false, text);
    if (!inserted || !input.textContent?.includes(text)) {
      setContentEditableText(input, text);
    } else {
      dispatchTextInputEvents(input, text);
    }
  }

  function isTemporaryChatControlActive(control) {
    return control.getAttribute('aria-pressed') === 'true' ||
      control.getAttribute('aria-checked') === 'true' ||
      control.getAttribute('data-state') === 'checked';
  }

  function isTemporaryChatUrl() {
    try {
      return new window.URL(window.location.href).searchParams.get('temporary-chat') === 'true';
    } catch (_error) {
      return false;
    }
  }

  async function enableTemporaryChat() {
    const labelPattern = /^(temporary(?: chat)?|临时(?:聊天)?|臨時(?:聊天)?|暫時(?:聊天)?)$/i;
    const controls = Array.from(document.querySelectorAll('button, [role="button"]'));
    const control = controls.find((candidate) => {
      if (candidate.tagName === 'A' || candidate.hasAttribute('href') || candidate.getAttribute('aria-hidden') === 'true') {
        return false;
      }

      const style = window.getComputedStyle?.(candidate);
      if (style?.display === 'none' || style?.visibility === 'hidden') {
        return false;
      }

      const label = (
        candidate.getAttribute('aria-label') ??
        candidate.getAttribute('title') ??
        candidate.textContent ??
        ''
      ).trim();

      return labelPattern.test(label);
    });

    if (!control || isTemporaryChatControlActive(control)) {
      return false;
    }

    control.click();
    await new Promise((resolve) => { setTimeout(resolve, 300); });
    return true;
  }

  function showFallbackModal(text, reason) {
    const existing = document.getElementById(fallbackId);
    if (existing) {
      existing.remove();
    }

    const overlay = document.createElement('div');
    overlay.id = fallbackId;
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '2147483647';
    overlay.style.background = 'rgba(0,0,0,0.45)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';

    const panel = document.createElement('div');
    panel.style.width = 'min(860px, 92vw)';
    panel.style.maxHeight = '86vh';
    panel.style.padding = '16px';
    panel.style.background = '#fff';
    panel.style.borderRadius = '12px';
    panel.style.boxShadow = '0 12px 42px rgba(0,0,0,0.25)';
    panel.style.display = 'flex';
    panel.style.flexDirection = 'column';
    panel.style.gap = '12px';

    const title = document.createElement('h2');
    title.textContent = 'Automatic send failed';
    title.style.margin = '0';
    title.style.fontSize = '18px';

    const hint = document.createElement('p');
    hint.textContent = 'Copy the full prompt below and paste it into ChatGPT manually.';
    hint.style.margin = '0';
    hint.style.color = '#4b5563';

    const reasonText = document.createElement('p');
    reasonText.textContent = `Reason: ${reason}`;
    reasonText.style.margin = '0';
    reasonText.style.fontSize = '12px';
    reasonText.style.color = '#6b7280';

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.width = '100%';
    textarea.style.minHeight = '280px';
    textarea.style.resize = 'vertical';
    textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const copyButton = document.createElement('button');
    copyButton.textContent = 'Copy';
    copyButton.style.padding = '8px 14px';

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Close';
    closeButton.style.padding = '8px 14px';

    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(textarea.value);
      } catch (_error) {
        textarea.select();
        document.execCommand('copy');
      }
    });

    closeButton.addEventListener('click', () => {
      overlay.remove();
    });

    actions.append(copyButton, closeButton);
    panel.append(title, hint, reasonText, textarea, actions);
    overlay.append(panel);
    document.body.append(overlay);
  }

  let lastReason = 'unknown';
  if (preferTemporaryChat && !isTemporaryChatUrl()) {
    try {
      await enableTemporaryChat();
    } catch (err) {
      console.warn('[ChatGPT Web Injector] Temporary Chat activation failed:', err);
    }
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const input = findFirst(inputSelectors);

    if (!input) {
      lastReason = 'input_not_found';
    } else {
      try {
        insertPrompt(input, prompt);
      } catch (err) {
        lastReason = `inject_error: ${err.message}`;
        continue;
      }

      // Wait for React to process the injected text and enable the send button
      await new Promise((resolve) => { setTimeout(resolve, 300); });

      // Re-query send button after input — ChatGPT may only render it after text exists.
      const sendButtonReady = findSendButton();

      if (sendButtonReady && !sendButtonReady.disabled) {
        sendButtonReady.click();
        return { ok: true, attempts: attempt };
      } else if (sendButtonReady) {
        lastReason = 'send_disabled';
      } else {
        lastReason = 'send_not_found';
      }
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => { setTimeout(resolve, intervalMs); });
    }
  }

  showFallbackModal(prompt, lastReason);
  return { ok: false, reason: lastReason, attempts: maxAttempts };
}
