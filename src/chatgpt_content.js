export async function runChatgptSendFlow(prompt, options = {}) {
  const maxAttempts = Number.isFinite(options.maxAttempts) ? options.maxAttempts : 20;
  const intervalMs = Number.isFinite(options.intervalMs) ? options.intervalMs : 250;
  const fallbackId = 'chatgpt-web-injector-fallback';

  const inputSelectors = ['textarea', "[contenteditable='true']", "div[role='textbox']"];
  const sendSelectors = [
    "button[data-testid*='send']",
    "button[aria-label*='Send']",
    "button[aria-label*='send']",
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

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const input = findFirst(inputSelectors);
    const sendButton = findFirst(sendSelectors);

    if (!input) {
      lastReason = 'input_not_found';
    } else if (!sendButton) {
      lastReason = 'send_not_found';
    } else {
      if ('value' in input) {
        input.value = prompt;
      } else {
        input.textContent = prompt;
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      sendButton.click();

      return { ok: true, attempts: attempt };
    }

    if (attempt < maxAttempts) {
      await new Promise((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  showFallbackModal(prompt, lastReason);
  return { ok: false, reason: lastReason, attempts: maxAttempts };
}
