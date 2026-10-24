import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { validatePublicVersion } from './package-release.mjs';

/** @typedef {{name: string, version: string, filename: string, integrity: string}} ReleaseArchive */
/** Verify the complete release before allowing any registry interactions.
 * @param {{version: string, packages: ReleaseArchive[]}} metadata
 * @param {readonly string[]} expectedNames
 * @param {ReadonlyMap<string, Uint8Array>} archives
 */
export function verifyReleaseArtifacts(metadata, expectedNames, archives) {
  validatePublicVersion(metadata.version);
  assert.deepEqual(
    metadata.packages.map((entry) => entry.name),
    expectedNames,
    'Unexpected package list or order',
  );
  for (const entry of metadata.packages) {
    assert.equal(entry.version, metadata.version, 'Package version differs from release');
    assert.equal(basename(entry.filename), entry.filename, 'Archive must stay inside the artifact directory');
    const archive = archives.get(entry.filename);
    assert(archive, 'Missing release archive');
    assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, entry.integrity, 'Archive integrity mismatch');
  }
  return metadata.packages;
}
