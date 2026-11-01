/**
 * Inject a prompt into Gemini. Self-contained for scripting.executeScript.
 * @param {string} prompt
 * @param {{maxAttempts?: number, intervalMs?: number}} options
 * @returns {Promise<{ok: boolean, reason?: string}>}
 */
export async function runGeminiSendFlow(prompt, options = {}) {
  const maxAttempts = options.maxAttempts ?? 32;
  const intervalMs = options.intervalMs ?? 250;
  const pause = () => new Promise((resolve) => setTimeout(resolve, intervalMs));
  const readEditor = (node) => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeName === 'BR') return '\n';
    const children = [...node.childNodes];
    return children.map((child, index) => {
      const text = readEditor(child);
      const block = /^(P|DIV)$/.test(child.nodeName);
      const content = block && text === '\n' ? '' : text;
      return content + (block && index < children.length - 1 ? '\n' : '');
    }).join('');
  };
  const normalize = (text) => text.replace(/\s+/gu, ' ').trim();
  let editor;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    editor = document.querySelector('rich-textarea .ql-editor[contenteditable="true"][role="textbox"]');
    if (editor) break;
    await pause();
  }
  if (!editor) return { ok: false, reason: 'gemini_composer_not_found' };
  try {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    const selection = document.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, prompt);
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    if (readEditor(editor).replace(/\r\n/g, '\n') !== prompt.replace(/\r\n/g, '\n')) {
      return { ok: false, reason: 'gemini_insertion_unconfirmed' };
    }
    let button;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      button = [...document.querySelectorAll('button[aria-label]')].find((candidate) =>
        /^(Send|Send message|Send prompt|发送|傳送|提交)$/iu.test(candidate.getAttribute('aria-label').trim()) &&
        !candidate.disabled && candidate.getAttribute('aria-disabled') !== 'true' &&
        !candidate.closest('[hidden], [aria-hidden="true"]') &&
        candidate.style.display !== 'none' && candidate.style.visibility !== 'hidden');
      if (button) break;
      await pause();
    }
    if (!button) return { ok: false, reason: 'gemini_send_not_found' };
    const existingQueries = new Set(document.querySelectorAll('user-query'));
    button.click();
    // A click may succeed even if the page subsequently disconnects. Never retry it.
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const submitted = [...document.querySelectorAll('user-query')].some((query) => {
        if (existingQueries.has(query)) return false;
        const lines = [...query.querySelectorAll('.query-text-line')];
        const text = lines.length ? lines.map((line) => line.textContent.trim()).join('\n') : query.textContent;
        return normalize(text) === normalize(prompt);
      });
      if (submitted) return { ok: true };
      await pause();
    }
    return { ok: false, reason: 'gemini_submission_unconfirmed_check_conversation_before_retry' };
  } catch (_error) {
    return { ok: false, reason: 'gemini_automation_failed_check_conversation_before_retry' };
  }
}
