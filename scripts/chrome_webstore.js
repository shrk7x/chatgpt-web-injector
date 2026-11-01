import { readFile, appendFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const PREFIX = '[ChatGPT Web Injector]';
const CONFIG_KEYS = ['CHROME_ACCESS_TOKEN', 'CHROME_PUBLISHER_ID', 'CHROME_EXTENSION_ID'];

/**
 * Upload a release package and submit it for automatic publication after review.
 * @param {object} options Configuration, package, version, and optional API adapters.
 * @returns {Promise<string>} Confirmed store submission state.
 */
export async function publishExtension({ env, zip, version, fetch: request = globalThis.fetch, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log }) {
  const missing = CONFIG_KEYS.filter((key) => !env[key]?.trim());
  if (missing.length) throw new Error(`Missing configuration: ${missing.join(', ')}`);
  if (!/^[a-p]{32}$/.test(env.CHROME_EXTENSION_ID)) throw new Error('Invalid CHROME_EXTENSION_ID');
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version)) throw new Error('Invalid extension version');
  if (!zip?.length) throw new Error('Empty extension package');

  async function json(url, options, label) {
    const response = await request(url, { ...options, signal: AbortSignal.timeout(60_000) });
    // Do not log response bodies: error responses can contain credentials.
    if (!response.ok) throw new Error(`${label} failed (HTTP ${response.status}); check credentials and the developer dashboard.`);
    const data = await response.json();
    if (data.error) throw new Error(`${label} returned an API error; check the developer dashboard.`);
    return data;
  }

  const name = `publishers/${encodeURIComponent(env.CHROME_PUBLISHER_ID)}/items/${env.CHROME_EXTENSION_ID}`;
  const base = 'https://chromewebstore.googleapis.com';
  const headers = { Authorization: `Bearer ${env.CHROME_ACCESS_TOKEN}` };
  const statusUrl = `${base}/v2/${name}:fetchStatus`;
  const status = await json(statusUrl, { headers }, 'Status');
  const hasVersion = (revision) => revision?.distributionChannels?.some((channel) => channel.crxVersion === version);
  const published = status.publishedItemRevisionStatus;
  const submitted = status.submittedItemRevisionStatus;
  if (published?.state === 'PUBLISHED' && hasVersion(published)) {
    log(`${PREFIX} Version ${version} is already published.`);
    return 'PUBLISHED';
  }
  if (submitted?.state === 'PENDING_REVIEW') {
    if (!hasVersion(submitted)) throw new Error('Another version is already awaiting review; resolve it in the developer dashboard first.');
    log(`${PREFIX} Version ${version} is already pending review.`);
    return 'PENDING_REVIEW';
  }
  if (submitted?.state === 'STAGED') throw new Error('A staged submission exists; resolve it in the developer dashboard first.');

  const uploaded = await json(`${base}/upload/v2/${name}:upload`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/zip' }, body: zip
  }, 'Upload');
  if (uploaded.crxVersion && uploaded.crxVersion !== version) throw new Error('Uploaded version does not match release package version');
  let uploadState = uploaded.uploadState;
  for (let attempt = 0; uploadState === 'IN_PROGRESS' && attempt < 30; attempt++) {
    await sleep(10_000);
    const current = await json(statusUrl, { headers }, 'Upload status');
    uploadState = current.lastAsyncUploadState;
  }
  if (uploadState !== 'SUCCEEDED') throw new Error(`Upload did not succeed (${uploadState ?? 'missing state'}); publication stopped.`);

  const result = await json(`${base}/v2/${name}:publish`, {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ publishType: 'DEFAULT_PUBLISH' })
  }, 'Publish');
  if (!['PENDING_REVIEW', 'PUBLISHED'].includes(result.state)) throw new Error(`Publish returned unexpected state: ${result.state ?? 'missing state'}`);
  log(`${PREFIX} Version ${version}: ${result.state}. Google review and browser update delivery are separate from submission.`);
  return result.state;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const zip = await readFile(process.argv[2]);
    const version = process.argv[3];
    const state = await publishExtension({ env: process.env, zip, version });
    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, `Chrome Web Store version **${version}**: **${state}**.\n\nPending review means submitted, not yet live. Google publishes approved DEFAULT_PUBLISH submissions automatically.\n`);
    }
  } catch (error) {
    console.error(`${PREFIX} ${error.message}`);
    process.exitCode = 1;
  }
}
