import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import process from 'node:process';
import { createReleaseBadge, updateReadmeRelease } from './deployment-version.mjs';
import { VERSION_CONFIG } from '../tooling.config.mjs';

const source = await readFile(VERSION_CONFIG.readmePath, 'utf8');
const result = updateReadmeRelease(source, process.argv[2]);
await writeFile(VERSION_CONFIG.readmePath, result);
await mkdir(dirname(VERSION_CONFIG.badgePath), { recursive: true });
await writeFile(VERSION_CONFIG.badgePath, createReleaseBadge(process.argv[2]));
