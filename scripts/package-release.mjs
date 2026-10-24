/** @typedef {{ name?: string, version?: string, private?: boolean, peerDependencies?: Record<string, string>, publishConfig?: { access: string, registry: string }, [key: string]: unknown }} PackageManifest */
/** Reject prerelease labels and malformed numeric components. @param {string} version */
export function validatePublicVersion(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) throw new Error('Expected a stable major.minor.patch release version');
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
