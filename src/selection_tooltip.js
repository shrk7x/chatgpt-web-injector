const TOOLTIP_ID = 'chatgpt-web-injector-tooltip';
const SHOW_DELAY_MS = 100;
const TOOLTIP_MOUSE_OFFSET = 12;
const VIEWPORT_PADDING = 40;
const DEBUG = false;

let showTimer = null;
let lastPointerPosition = null;
let suppressNextSelection = false;

function log(...args) {
  if (DEBUG) {
    console.log('[ChatGPT Web Injector - Tooltip]', ...args);
  }
}

function getSelectedText() {
  const activeElement = document.activeElement;
  const canReadInputSelection = activeElement &&
    (activeElement instanceof HTMLTextAreaElement ||
      (activeElement instanceof HTMLInputElement && typeof activeElement.selectionStart === 'number'));

  if (canReadInputSelection) {
    const start = activeElement.selectionStart;
    const end = activeElement.selectionEnd;
    if (start !== null && end !== null && end > start) {
      return activeElement.value.slice(start, end).trim();
    }
  }

  const selection = window.getSelection();
  return selection ? selection.toString().trim() : '';
}

function removeTooltip() {
  const existing = document.getElementById(TOOLTIP_ID);
  if (existing) {
    log('Removing existing tooltip');
    existing.remove();
  }
}

function createTooltip(x, y) {
  log(`Creating tooltip at (${x}, ${y})`);
  removeTooltip();

  const btn = document.createElement('button');
  btn.id = TOOLTIP_ID;
  btn.title = 'Send to ChatGPT';
  btn.setAttribute('aria-label', 'Send to ChatGPT');
  btn.className = 'chatgpt-web-injector-tooltip-btn';

  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;

  log('Button created with styles:', {
    position: 'fixed',
    left: `${x}px`,
    top: `${y}px`,
    width: '40px',
    height: '40px',
    id: TOOLTIP_ID,
    class: btn.className,
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();

    // Suppress the selectionchange that fires when the tooltip is removed
    suppressNextSelection = true;

    // Read selection before removing the tooltip, so selectionchange
    // triggered by DOM removal doesn't clear it first.
    const selection = window.getSelection();
    const selectionText = selection ? selection.toString().trim() : '';

    removeTooltip();

    if (!selectionText) {
      return;
    }

    if (!chrome?.runtime?.sendMessage) {
      console.warn('[ChatGPT Web Injector] Extension context unavailable — please refresh this page.');
      return;
    }

    try {
      chrome.runtime.sendMessage({
        type: 'SELECTION_SEND',
        payload: {
          selectionText,
          pageTitle: document.title,
          pageUrl: window.location.href,
        },
      });
    } catch (err) {
      console.warn('[ChatGPT Web Injector] Failed to send message — please refresh this page.', err.message);
    }
  });

  const appendResult = document.body?.appendChild(btn);
  if (appendResult) {
    log('Button successfully appended to DOM');
    const computedStyle = window.getComputedStyle(btn);
    log('Computed styles:', {
      display: computedStyle.display,
      position: computedStyle.position,
      zIndex: computedStyle.zIndex,
      backgroundColor: computedStyle.backgroundColor,
      width: computedStyle.width,
      height: computedStyle.height,
    });
  } else {
    log('WARNING: Failed to append button to DOM');
  }
}

function processSelection() {
  if (suppressNextSelection) {
    suppressNextSelection = false;
    return;
  }

  const text = getSelectedText();
  log('processSelection called, selected text length:', text.length);

  if (!text) {
    removeTooltip();
    return;
  }

  if (!lastPointerPosition) {
    log('No pointer position recorded, skipping tooltip');
    return;
  }

  clearTimeout(showTimer);
  showTimer = setTimeout(() => {
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const x = Math.min(lastPointerPosition.x + TOOLTIP_MOUSE_OFFSET, vw - VIEWPORT_PADDING);
    const y = Math.min(lastPointerPosition.y + TOOLTIP_MOUSE_OFFSET, vh - VIEWPORT_PADDING);
    createTooltip(x, y);
  }, SHOW_DELAY_MS);
}

function handleMouseDown(e) {
  // If the click is on the tooltip itself, do nothing (mousedown handler on btn handles it)
  const clickedInsideTooltip = e.target?.closest?.(`#${TOOLTIP_ID}`);
  if (clickedInsideTooltip) {
    return;
  }
  log('Mouse down detected, clearing pending tooltip');
  clearTimeout(showTimer);
  removeTooltip();
}

function handleMouseUp(e) {
  // If the mouseup is on the tooltip button itself, do not reposition or recreate it
  const clickedInsideTooltip = e.target?.closest?.(`#${TOOLTIP_ID}`);
  if (clickedInsideTooltip) {
    return;
  }
  log('Mouse up detected at', { x: e.clientX, y: e.clientY });
  lastPointerPosition = { x: e.clientX, y: e.clientY };
  processSelection();
}

log('Content script loaded, registering event listeners');
document.addEventListener('mouseup', handleMouseUp, true);
document.addEventListener('selectionchange', processSelection, true);
document.addEventListener('mousedown', handleMouseDown, true);
document.addEventListener('keyup', () => {
  log('Key up detected');
  processSelection();
}, true);
log('Event listeners registered (with capture phase)');
