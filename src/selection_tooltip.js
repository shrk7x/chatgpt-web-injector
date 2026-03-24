const TOOLTIP_ID = 'chatgpt-web-injector-tooltip';
const SHOW_DELAY_MS = 100;
const TOOLTIP_OFFSET = 6;
const VIEWPORT_PADDING = 40;

let showTimer = null;
let lastPointerPosition = null;

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
  btn.style.backgroundImage = `url('${chrome.runtime.getURL('icons/icon32.png')}')`;

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

  document.body?.appendChild(btn);
}

function getSelectionAnchorPosition() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    if (!lastPointerPosition) {
      return null;
    }
    const x = Math.min(Math.max(lastPointerPosition.x + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerWidth - VIEWPORT_PADDING);
    const y = Math.min(Math.max(lastPointerPosition.y + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerHeight - VIEWPORT_PADDING);
    return { x, y };
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  if (rect.width === 0 && rect.height === 0) {
    if (!lastPointerPosition) {
      return null;
    }
    const x = Math.min(Math.max(lastPointerPosition.x + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerWidth - VIEWPORT_PADDING);
    const y = Math.min(Math.max(lastPointerPosition.y + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerHeight - VIEWPORT_PADDING);
    return { x, y };
  }

  // Position just below and to the right of the selection end, clamped to viewport
  const x = Math.min(Math.max(rect.right + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerWidth - VIEWPORT_PADDING);
  const y = Math.min(Math.max(rect.bottom + TOOLTIP_OFFSET, TOOLTIP_OFFSET), window.innerHeight - VIEWPORT_PADDING);

  return { x, y };
}

function processSelection() {
  clearTimeout(showTimer);

  showTimer = setTimeout(() => {
    const text = getSelectedText();

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

function handleMouseUp(e) {
  lastPointerPosition = { x: e.clientX, y: e.clientY };
  processSelection();
}

document.addEventListener('mouseup', handleMouseUp);
document.addEventListener('selectionchange', processSelection);
document.addEventListener('mousedown', handleMouseDown);
