import { RELEASE_BADGE_CONFIG, VERSION_CONFIG } from '../tooling.config.mjs';

/** Reject malformed version labels before placing them in Markdown or SVG. @param {string} version Untagged release version. */
function validateReleaseVersion(version) {
  if (!VERSION_CONFIG.versionPattern.test(version)) {
    throw new Error(VERSION_CONFIG.invalidVersion);
  }
}

/**
 * Create a unique semantic prerelease for each workflow execution and retry.
 * @param {string} baseVersion Package version of the tested source.
 * @param {string} runNumber Monotonically increasing deployment workflow number.
 * @param {string} attempt GitHub's attempt number, including deploy-only retries.
 * @param {string} commit Full SHA of the source verified by the upstream workflow.
 */
export function createDeploymentMetadata(baseVersion, runNumber, attempt, commit) {
  validateReleaseVersion(baseVersion);
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
  validateReleaseVersion(version);
  const matches = [...source.matchAll(VERSION_CONFIG.readmeMarker)];
  if (matches.length !== 1) {
    throw new Error(VERSION_CONFIG.invalidReadme);
  }
  const result = source.replace(VERSION_CONFIG.readmeMarker, `<!-- release-version -->v${version}<!-- /release-version -->`);

  return result;

}

/** Render a self-contained SVG badge without external badge-service requests. @param {string} version Published release version. */
export function createReleaseBadge(version) {
  validateReleaseVersion(version);
  const config = RELEASE_BADGE_CONFIG;
  const text = `v${version}`;
  const valueWidth = text.length * config.characterWidth + config.valuePadding;
  const width = config.labelWidth + valueWidth;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${config.height}" role="img" aria-label="${config.label}: ${text}"><title>${config.label}: ${text}</title><clipPath id="badge"><rect width="${width}" height="${config.height}" rx="${config.cornerRadius}"/></clipPath><g clip-path="url(#badge)"><rect width="${width}" height="${config.height}" fill="${config.background}"/><rect x="${config.labelWidth}" width="${valueWidth}" height="${config.height}" fill="${config.valueBackground}"/></g><g fill="${config.foreground}" text-anchor="middle" font-family="${config.fontFamily}" font-size="${config.fontSize}"><text x="${config.labelWidth / 2}" y="${config.textY}">${config.label}</text><text x="${config.labelWidth + valueWidth / 2}" y="${config.textY}">${text}</text></g></svg>\n`;

  return svg;

}
