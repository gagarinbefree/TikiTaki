import { appendFile } from 'node:fs/promises';
import process from 'node:process';
import { resolvePublicationTag } from './package-release.mjs';

const tag = resolvePublicationTag(process.env.MANUAL_TAG ?? '', JSON.parse(process.env.RELEASE_ARTIFACTS ?? '[]'));
if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `tag=${tag}\n`);
process.stdout.write(`Selected verified npm release ${tag}\n`);
