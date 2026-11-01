# Chrome Web Store automatic publishing

> Execute inline using superpowers:executing-plans. The user approved automatic upload, submission, failure checks, and manual retry on 2026-11-01.

**Goal:** Submit each release-please release to the existing Chrome Web Store item and publish after Google approval.

**Architecture:** Keep release-please and its ZIP asset. A separate dependent job downloads that exact asset and calls a dependency-free Node script using Chrome Web Store API v2. Manual dispatch accepts an existing release tag, allowing retry without creating a version. Google Workload Identity Federation issues short-lived tokens to the main-branch release workflow; no long-lived secrets are stored.

**Constraints:** No extension permissions or runtime behavior changes. No dependencies. Never log tokens. Distinguish submission from store approval. Missing credentials, failed uploads, and rejected submissions must fail the job.

## Implementation and verification

- [x] Add behavioral tests for missing credentials, unauthorized token, async upload success/failure/timeout, rejected publication, and a duplicate published/pending version.
- [x] Run `node --test tests/chrome_webstore.test.js` and confirm the new publisher is missing.
- [x] Implement `scripts/chrome_webstore.js`: validate configuration, check current status, upload the ZIP, poll bounded upload processing, and submit using DEFAULT_PUBLISH. Use request timeouts and fail closed on unexpected states.
- [x] Update `.github/workflows/release.yml`: expose the created tag; isolate publishing credentials to the publishing step; download the existing release ZIP for automatic and manual runs; serialize publishing; run tests and verify the ZIP version before submission.
- [x] Document service-account/OIDC setup, publisher/extension IDs, manual retry, and the Google review boundary in README; update AGENTS release instructions.
- [x] Run new tests, `npm test`, JS syntax checks, workflow validation, and package inspection. Review the diff before committing and opening a PR.

## External acceptance

Live publishing requires linking the dedicated service account in the Web Store dashboard. The provider restricts access to immutable repository/owner IDs, main, and the Release workflow. No project-level role or private key is granted to the service account. Local tests simulate API responses and cannot prove Google approval.

## Verification evidence

- `npm test`: 92 passed, 0 failed (including 18 publisher cases).
- JS syntax checks and actionlint v1.7.7 passed; 12 manifest paths exist and DEBUG remains false.
- Actual v0.1.1 release ZIP passed `unzip -t` and contains version 0.1.1.
- Independent review caught legacy asset-name mismatch; fixed and verified asset resolution against live release metadata for both chatgpt-web-injector-v0.1.1 and v0.0.18.
- Missing-config CLI run exited nonzero without requesting OAuth.
- GitHub publisher and extension Variables are configured. Google OIDC Variables are configured; publisher service-account binding and live submission remain pending verification.

## Authorization adjustment

The owner approved Google publishing authorization on 2026-11-01. The existing Google OAuth app cannot enter Production despite saved required branding fields (Publish app disabled). Replaced the refresh-token design with official v2 service-account support and keyless GitHub identity. No existing EpubTranslator branding was changed. The attempted OAuth client remains unused; no refresh token was issued and no OAuth secrets were saved to GitHub.
