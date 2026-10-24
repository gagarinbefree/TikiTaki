import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { NPM_RELEASE_CONFIG } from '../tooling.config.mjs';
import { validatePublicVersion } from './package-release.mjs';
import { npmCommand } from './npm-command.mjs';

const directory = resolve(NPM_RELEASE_CONFIG.directory);
await mkdir(directory, { recursive: true });
const root = JSON.parse(await readFile('package.json', 'utf8'));
validatePublicVersion(root.version);
const packages = [];
for (const location of NPM_RELEASE_CONFIG.directories) {
  const manifest = JSON.parse(await readFile(`${location}/package.json`, 'utf8'));
  assert.equal(manifest.version, root.version, 'Package versions must match');
  assert.equal(manifest.private, undefined, 'Private packages cannot be released');
  assert.equal(manifest.license, 'MIT');
  if (location === '.') {
    assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0, 'Core must have zero runtime dependencies');
    assert.equal(Object.keys(manifest.peerDependencies ?? {}).length, 0, 'Core must not require a framework');
  } else assert.equal(manifest.peerDependencies.tikitaki, `^${root.version}`);
  const packed = npmCommand(['pack', resolve(location), '--json', '--ignore-scripts', '--pack-destination', directory]);
  assert.equal(packed.status, 0, packed.stderr);
  const [info] = JSON.parse(packed.stdout);
  const files = new Set(info.files.map((file) => file.path));
  for (const required of ['dist/index.js', 'dist/index.d.ts', 'LICENSE', 'README.md']) assert(files.has(required), `Missing ${required}`);
  assert(![...files].some((file) => /(?:^|\/)(?:node_modules|demos|\.npmrc|\.env)(?:\/|$)/.test(file)), 'Unexpected private or demo files');
  const archive = await readFile(resolve(directory, info.filename));
  packages.push({
    name: manifest.name,
    version: manifest.version,
    filename: info.filename,
    integrity: `sha512-${createHash('sha512').update(archive).digest('base64')}`,
  });
}
await writeFile(resolve(directory, 'npm-release.json'), `${JSON.stringify({ version: root.version, packages }, null, 2)}\n`);
process.stdout.write(`Packed ${packages.length} verified public packages at ${root.version} in ${directory}\n`);
