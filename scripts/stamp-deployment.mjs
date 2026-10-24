import { access, appendFile, readFile, writeFile } from 'node:fs/promises';
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
  JSON.parse(process.env.RELEASE_TAGS ?? '[]').map((release) => release.tagName),
);
const directory = process.argv[2] ?? VERSION_CONFIG.outputDirectory;
await access(join(directory, 'index.html'));
await writeFile(join(directory, VERSION_CONFIG.filename), `${JSON.stringify(metadata, null, 2)}\n`);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `version=${metadata.version}\n`);
}
process.stdout.write(`Deployment version: ${metadata.version}\n`);
