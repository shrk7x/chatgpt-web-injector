# Privacy Policy for ChatGPT Web Injector

Last Updated: November 1, 2026

## 1. Information the Extension Uses

When you use its features, the extension accesses the webpage text you select,
the source page title and URL, and available YouTube caption or transcript content.
It uses this information to prepare your chosen prompt, open a transcript panel,
or create a subtitle file. YouTube features make requests to YouTube's own pages
and caption/transcript services to obtain available video information.

## 2. Settings and Storage

Prompt templates and extension preferences are stored using `chrome.storage.sync`.
Chrome may synchronize these settings through your Google account according to
your browser's sync configuration. Downloaded subtitle files are saved through
your browser to the location you choose.

The extension has no developer-operated backend, database, or analytics service.
We do not receive or store your selected text, transcripts, or ChatGPT conversations
on a server operated by this project.

## 3. Sending Content to ChatGPT

When you initiate a send or YouTube summary action, the extension opens the
ChatGPT website and sends the selected content or transcript together with the
source context included in your prompt template. This content is processed by
OpenAI under ChatGPT's own terms, settings, and data policies. ChatGPT may require
sign-in and applies its own usage limits.

The optional Temporary Chat setting requests ChatGPT's Temporary Chat mode for
YouTube summaries. It does not constitute a promise of zero data retention.

We do not sell your personal information or use the content for advertising.

## 4. Permissions

- **Context Menus:** Provide the right-click action for selected text.
- **Storage:** Save prompt templates and extension preferences in Chrome extension storage.
- **Tabs / ActiveTab:** Open the ChatGPT tab and support the requested page interaction.
- **Scripting:** Insert the composed prompt into ChatGPT and attempt to send it.
- **Host Permissions (`<all_urls>`, `https://chatgpt.com/*`):** Show the optional selection button on webpages, provide YouTube controls, and interact with the ChatGPT interface.

## 5. Changes to This Policy

Changes to this policy are published in this document in the source repository.

## 6. Contact

Questions and bug reports can be submitted through the public issue tracker:
https://github.com/shrk7x/chatgpt-web-injector/issues

Do not include private page content, credentials, or personal conversations in a
public issue.
