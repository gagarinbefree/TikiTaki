import { VERSION_CONFIG } from '../tooling.config.mjs';

/**
 * Create a unique semantic prerelease for each workflow execution and retry.
 * @param {string} baseVersion Package version of the tested source.
 * @param {string} runNumber Monotonically increasing deployment workflow number.
 * @param {string} attempt GitHub's attempt number, including deploy-only retries.
 * @param {string} commit Full SHA of the source verified by the upstream workflow.
 */
export function createDeploymentMetadata(baseVersion, runNumber, attempt, commit) {
  if (!/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(baseVersion)) {
    throw new Error(VERSION_CONFIG.invalidVersion);
  }
  if (!/^[1-9]\d*$/.test(runNumber) || !/^[1-9]\d*$/.test(attempt)) {
    throw new Error(VERSION_CONFIG.invalidIdentifier);
  }
  if (!/^[a-f\d]{40}$/.test(commit)) {
    throw new Error(VERSION_CONFIG.invalidCommit);
  }
  const separator = baseVersion.includes('-') ? '.' : '-';
  const version = `${baseVersion}${separator}${VERSION_CONFIG.tag}.${runNumber}.${attempt}`;
  const metadata = { version, commit, runNumber, attempt };

  return metadata;

}

/**
 * Update the marked version while preserving all other README content.
 * @param {string} source Original README content.
 * @param {string} version Successfully deployed release version.
 */
export function updateReadmeRelease(source, version) {
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z\d.-]+)?$/.test(version)) {
    throw new Error(VERSION_CONFIG.invalidVersion);
  }
  const matches = [...source.matchAll(VERSION_CONFIG.readmeMarker)];
  if (matches.length !== 1) {
    throw new Error(VERSION_CONFIG.invalidReadme);
  }
  const result = source.replace(VERSION_CONFIG.readmeMarker, `<!-- release-version -->v${version}<!-- /release-version -->`);

  return result;

}
