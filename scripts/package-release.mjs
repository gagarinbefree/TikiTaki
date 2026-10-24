/** @typedef {{ name?: string, version?: string, private?: boolean, peerDependencies?: Record<string, string>, publishConfig?: { access: string, registry: string }, [key: string]: unknown }} PackageManifest */
/** Reject prerelease labels and malformed numeric components. @param {string} version */
export function validatePublicVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Expected a stable major.minor.patch release version');
}

/** Resolve a manual retry or the exact release artifact produced by the completed source run.
 * @param {string} manualTag
 * @param {readonly string[]} artifactNames
 */
export function resolvePublicationTag(manualTag, artifactNames) {
  let tag = manualTag;
  if (!tag) {
    const releases = artifactNames.filter((name) => /^release-\d+\.\d+\.\d+$/.test(name));
    if (releases.length !== 1) throw new Error('Expected exactly one stable release artifact from the completed workflow');
    tag = `v${releases[0]?.slice('release-'.length)}`;
  }
  if (!tag.startsWith('v')) throw new Error('Expected a v-prefixed release tag');
  validatePublicVersion(tag.slice(1));
  return tag;
}

/** Prepare an immutable manifest snapshot for the chosen public release. @param {PackageManifest} manifest @param {string} version */
export function preparePackageManifest(manifest, version) {
  validatePublicVersion(version);
  const result = {
    ...manifest,
    version,
    publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' },
    ...(manifest.peerDependencies ? { peerDependencies: { ...manifest.peerDependencies, tikitaki: `^${version}` } } : {}),
  };
  delete result.private;
  return result;
}

/** Synchronize lockfile root metadata without resolving or changing dependencies.
 * @param {{version?: string, packages: Record<string, {version?: string, [key: string]: unknown}>, [key: string]: unknown}} lock
 * @param {string} version
 * @returns {{version: string, packages: Record<string, {version?: string, [key: string]: unknown}> & {"": {version: string, license: string}}, [key: string]: unknown}}
 */
export function preparePackageLock(lock, version) {
  validatePublicVersion(version);
  const result = { ...lock, version, packages: { ...lock.packages, '': { ...lock.packages[''], version, license: 'MIT' } } };
  return result;
}
