import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { NPM_RELEASE_CONFIG } from '../tooling.config.mjs';
import { npmCommand } from './npm-command.mjs';

/**
 * nodeCommand
 *
 * Run a local verifier without shell interpolation.
 * @param {string[]} args Arguments forwarded to the command.
 */
function nodeCommand(args) {
  const result = spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr + result.stdout);
  process.stdout.write(result.stdout);
}

nodeCommand(['scripts/check-adapter-packages.mjs', 'prepare']);
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
const metadata = JSON.parse(await readFile(`${NPM_RELEASE_CONFIG.directory}/npm-release.json`, 'utf8'));
const frameworkNames = ['react', 'react-dom', 'vue', 'svelte', '@angular/core', 'rxjs', '@types/react'];
const frameworks = frameworkNames.map((name) => `${name}@${manifest.devDependencies[name]}`);
const packages = metadata.packages.map((entry) => resolve(NPM_RELEASE_CONFIG.directory, entry.filename));
const installed = npmCommand([
  'install',
  '--prefix',
  '.artifacts/framework-package-manual/consumer',
  ...packages,
  ...frameworks,
  '--ignore-scripts',
  '--no-audit',
  '--no-fund',
  '--offline=false',
]);
assert.equal(installed.status, 0, installed.stderr + installed.stdout);
nodeCommand(['node_modules/typescript/bin/tsc', '-p', '.artifacts/framework-package-manual/consumer/tsconfig.json']);
nodeCommand(['scripts/check-adapter-packages.mjs', 'verify']);
