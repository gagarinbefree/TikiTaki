import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { URL } from 'node:url';
import { createDeploymentMetadata } from './deployment-version.mjs';
import { VERSION_CONFIG } from '../tooling.config.mjs';

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const metadata = createDeploymentMetadata(
  manifest.version,
  process.env.GITHUB_RUN_NUMBER ?? '',
  process.env.GITHUB_RUN_ATTEMPT ?? '',
  process.env.SOURCE_SHA ?? '',
);
const directory = process.argv[2] ?? VERSION_CONFIG.outputDirectory;
await access(join(directory, 'index.html'));
await writeFile(join(directory, VERSION_CONFIG.filename), `${JSON.stringify(metadata, null, 2)}\n`);
process.stdout.write(`Deployment version: ${metadata.version}\n`);
