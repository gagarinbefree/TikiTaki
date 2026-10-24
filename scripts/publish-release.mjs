import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import process from 'node:process';
import { NPM_RELEASE_CONFIG } from '../tooling.config.mjs';
import { validatePublicVersion } from './package-release.mjs';
import { verifyReleaseArtifacts } from './release-artifacts.mjs';
import { npmCommand } from './npm-command.mjs';

const directory = resolve(process.argv[2] ?? NPM_RELEASE_CONFIG.directory);
const metadata = JSON.parse(await readFile(resolve(directory, 'npm-release.json'), 'utf8'));
validatePublicVersion(metadata.version);
if (process.env.RELEASE_TAG) assert.equal(`v${metadata.version}`, process.env.RELEASE_TAG);
const expected = await Promise.all(
  NPM_RELEASE_CONFIG.directories.map(async (location) => JSON.parse(await readFile(`${location}/package.json`, 'utf8')).name),
);
const archives = new Map();
for (const entry of metadata.packages) {
  assert.equal(basename(entry.filename), entry.filename, 'Archive must stay inside the artifact directory');
  archives.set(entry.filename, await readFile(resolve(directory, entry.filename)));
}
verifyReleaseArtifacts(metadata, expected, archives);
if (process.argv.includes('--verify-only')) {
  process.stdout.write(`Verified all release archive checksums for ${metadata.version}\n`);
} else {
  for (const entry of metadata.packages) {
    const existing = npmCommand([
      'view',
      `${entry.name}@${entry.version}`,
      'dist.integrity',
      '--json',
      '--offline=false',
      '--registry',
      NPM_RELEASE_CONFIG.registry,
    ]);
    if (existing.status === 0) {
      assert.equal(JSON.parse(existing.stdout), entry.integrity, `Published ${entry.name} has different content; choose a new version`);
      process.stdout.write(`Already published identical ${entry.name}@${entry.version}\n`);
      continue;
    }
    assert(/E404/.test(existing.stdout + existing.stderr), existing.stderr || existing.stdout);
    const published = npmCommand(
      [
        'publish',
        resolve(directory, entry.filename),
        '--access',
        'public',
        '--ignore-scripts',
        '--offline=false',
        '--registry',
        NPM_RELEASE_CONFIG.registry,
      ],
      true,
    );
    assert.equal(published.status, 0, published.stderr || published.stdout || 'npm publish failed');
  }
}
