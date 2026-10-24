import { RELEASE_BADGE_CONFIG, VERSION_CONFIG } from '../tooling.config.mjs';

/** Reject malformed version labels before placing them in Markdown or SVG. @param {string} version Untagged release version. */
function validateReleaseVersion(version) {
  if (!VERSION_CONFIG.versionPattern.test(version)) {
    throw new Error(VERSION_CONFIG.invalidVersion);
  }
}

/**
 * Increment the greatest published stable version; workflow identifiers remain trace metadata.
 * @param {string} baseVersion Package version of the tested source.
 * @param {string} runNumber Monotonically increasing deployment workflow number.
 * @param {string} attempt GitHub's attempt number, including deploy-only retries.
 * @param {string} commit Full SHA of the source verified by the upstream workflow.
 * @param {readonly string[]} releaseTags Previously published GitHub release tags.
 */
export function createDeploymentMetadata(baseVersion, runNumber, attempt, commit, releaseTags = []) {
  validateReleaseVersion(baseVersion);
  if (!/^[1-9]\d*$/.test(runNumber) || !/^[1-9]\d*$/.test(attempt)) {
    throw new Error(VERSION_CONFIG.invalidIdentifier);
  }
  if (!/^[a-f\d]{40}$/.test(commit)) {
    throw new Error(VERSION_CONFIG.invalidCommit);
  }
  const baseline = baseVersion.split('-')[0] ?? baseVersion;
  const stable = [baseline, ...releaseTags.filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag)).map((tag) => tag.slice(1))];
  const versions = stable.map((value) => value.split('.').map(Number));
  versions.sort((a, b) => (b[0] ?? 0) - (a[0] ?? 0) || (b[1] ?? 0) - (a[1] ?? 0) || (b[2] ?? 0) - (a[2] ?? 0));
  const latest = versions[0] ?? [0, 1, 0];
  const version = `${String(latest[0])}.${String(latest[1])}.${String((latest[2] ?? 0) + 1)}`;
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
  const marked = source.replace(VERSION_CONFIG.readmeMarker, `<!-- release-version -->v${version}<!-- /release-version -->`);
  const result = marked.replace(VERSION_CONFIG.badgeImagePattern, `![Release](${VERSION_CONFIG.badgePath}?version=${version})`);

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
