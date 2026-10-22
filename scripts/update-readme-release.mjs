import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { updateReadmeRelease } from './deployment-version.mjs';
import { VERSION_CONFIG } from '../tooling.config.mjs';

const source = await readFile(VERSION_CONFIG.readmePath, 'utf8');
const result = updateReadmeRelease(source, process.argv[2]);
await writeFile(VERSION_CONFIG.readmePath, result);
