import assert from 'node:assert/strict';
import { readFile, writeFile, appendFile } from 'node:fs/promises';
import process from 'node:process';
import { createDeploymentMetadata } from './deployment-version.mjs';
import { preparePackageManifest, preparePackageLock } from './package-release.mjs';
import { NPM_RELEASE_CONFIG } from '../tooling.config.mjs';

const root = JSON.parse(await readFile('package.json', 'utf8'));
const version =
  process.argv[2] ??
  createDeploymentMetadata(
    root.version,
    process.env.GITHUB_RUN_NUMBER ?? '',
    process.env.GITHUB_RUN_ATTEMPT ?? '',
    process.env.SOURCE_SHA ?? '',
    JSON.parse(process.env.RELEASE_TAGS ?? '[]').map((release) => release.tagName),
  ).version;
for (const directory of NPM_RELEASE_CONFIG.directories) {
  const path = `${directory}/package.json`;
  const source = await readFile(path, 'utf8');
  const manifest = JSON.parse(source);
  const updated = source.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${version}"`).replace(/("tikitaki"\s*:\s*)"[^"]*"/, `$1"^${version}"`);
  assert.deepEqual(
    JSON.parse(updated),
    preparePackageManifest(manifest, version),
    'Prepare public package metadata before assigning a version',
  );
  await writeFile(path, updated);
}
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
await writeFile('package-lock.json', `${JSON.stringify(preparePackageLock(lock, version), null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `version=${version}\n`);
process.stdout.write(`Prepared all npm packages at ${version}\n`);
