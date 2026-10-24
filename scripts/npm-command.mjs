import { spawnSync } from 'node:child_process';
import process from 'node:process';

/** Run npm without shell interpolation; interactive publication can request browser-based 2FA. @param {string[]} args @param {boolean} interactive */
export function npmCommand(args, interactive = false) {
  if (!process.env.npm_execpath) throw new Error('Run this command through an npm script');
  const result = spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    encoding: 'utf8',
    windowsHide: true,
    ...(interactive ? { stdio: 'inherit' } : {}),
  });
  if (result.error) throw result.error;
  return result;
}
