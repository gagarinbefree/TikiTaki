import { spawnSync } from 'node:child_process';
import process from 'node:process';

/**
 * npmCommand
 *
 * Run npm without shell interpolation; interactive publication can request browser based 2FA.
 * @param {string[]} args Arguments forwarded to the command.
 * @param {boolean} interactive Whether to inherit interactive standard input and output.
 * @returns The npm process output and exit status.
 */
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
