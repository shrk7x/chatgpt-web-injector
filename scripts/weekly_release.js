const RELEASE_BRANCH = 'release-please--branches--main--components--chatgpt-web-injector';

/**
 * Find the release-please bot's pending release for this repository.
 * @param {{ github: object, context: object }} options
 * @returns {Promise<object|null>} Pending release PR, or null for an empty week.
 */
export async function findReleasePullRequest({ github, context }) {
  const pulls = await github.paginate(github.rest.pulls.list, {
    ...context.repo,
    state: 'open',
    base: 'main',
    head: `${context.repo.owner}:${RELEASE_BRANCH}`,
    per_page: 100
  });
  const candidates = pulls.filter((pull) => !pull.draft
    && pull.user?.login === 'github-actions[bot]'
    && pull.head?.ref === RELEASE_BRANCH
    && pull.head?.repo?.full_name === `${context.repo.owner}/${context.repo.repo}`
    && pull.labels.some((label) => label.name === 'autorelease: pending'));
  if (candidates.length > 1) throw new Error('Multiple pending release PRs found');
  return candidates[0] ?? null;
}

/**
 * Squash merge only the release PR revision that passed tests.
 * @param {{ github: object, context: object, number: number, sha: string }} options
 * @returns {Promise<void>}
 */
export async function mergeReleasePullRequest({ github, context, number, sha }) {
  const { data } = await github.rest.pulls.merge({
    ...context.repo,
    pull_number: number,
    sha,
    merge_method: 'squash'
  });
  if (!data.merged) throw new Error(`Release PR was not merged: ${data.message}`);
}

/**
 * Select the release ZIP to deliver, including retries on weeks without new PRs.
 * @param {{ github: object, context: object, releaseTag?: string }} options
 * @returns {Promise<string|null>} Release tag, or null if no stable release exists.
 */
export async function getStoreReleaseTag({ github, context, releaseTag }) {
  if (releaseTag) return releaseTag;
  try {
    const { data } = await github.rest.repos.getLatestRelease(context.repo);
    return data.tag_name;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}
