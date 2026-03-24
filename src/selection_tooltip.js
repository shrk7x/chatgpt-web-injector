const TOOLTIP_ID = 'chatgpt-web-injector-tooltip';
const SHOW_DELAY_MS = 100;
const TOOLTIP_OFFSET = 6;
const VIEWPORT_PADDING = 40;

let showTimer = null;

function removeTooltip() {
  const existing = document.getElementById(TOOLTIP_ID);
  if (existing) {
    existing.remove();
  }
}

function createTooltip(x, y) {
  removeTooltip();

  const btn = document.createElement('button');
  btn.id = TOOLTIP_ID;
  btn.title = 'Send to ChatGPT';
  btn.setAttribute('aria-label', 'Send to ChatGPT');
  btn.className = 'chatgpt-web-injector-tooltip-btn';

  btn.style.left = `${x}px`;
  btn.style.top = `${y}px`;

  // Simple "send" arrow SVG icon
  // Simple "send" arrow SVG icon
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`;

  btn.addEventListener('mousedown', (e) => {
    // Prevent the click from clearing the selection before we read it
    e.preventDefault();
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();

    const selection = window.getSelection();
    const selectionText = selection ? selection.toString().trim() : '';

    removeTooltip();

    if (!selectionText) {
      return;
    }

    chrome.runtime.sendMessage({
      type: 'SELECTION_SEND',
      payload: {
        selectionText,
        pageTitle: document.title,
        pageUrl: window.location.href,
      },
    });
  });

  document.body.appendChild(btn);
}

function getSelectionAnchorPosition() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    return null;
  }

  // Position just below and to the right of the selection end, clamped to viewport
  const x = Math.min(Math.max(rect.right + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerWidth - VIEWPORT_PADDING);
  const y = Math.min(Math.max(rect.bottom + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerHeight - VIEWPORT_PADDING);

  return { x, y };
}

function processSelection() {
  clearTimeout(showTimer);

  showTimer = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (!text) {
      removeTooltip();
      return;
    }

    const pos = getSelectionAnchorPosition();
    if (!pos) {
      removeTooltip();
      return;
    }

    createTooltip(pos.x, pos.y);
  }, SHOW_DELAY_MS);
}

function handleMouseDown(e) {
  // If the click is on the tooltip itself, do nothing (mousedown handler on btn handles it)
  const clickedInsideTooltip = e.target?.closest?.(`#${TOOLTIP_ID}`);
  if (clickedInsideTooltip) {
    return;
  }
  clearTimeout(showTimer);
  removeTooltip();
}

document.addEventListener('mouseup', processSelection);
document.addEventListener('selectionchange', processSelection);
document.addEventListener('mousedown', handleMouseDown);
