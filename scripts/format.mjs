import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { format, resolveConfig } from 'prettier';
import { formatSource } from './source-style.mjs';
import { FORMAT_IGNORE } from '../tooling.config.mjs';
/** Enumerate editable source/documentation files without walking generated or private directories. */
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (
      entry.isDirectory() &&
      (!entry.name.startsWith('.') || entry.name === '.github') &&
      !FORMAT_IGNORE.directories.includes(entry.name)
    ) {
      result.push(...(await files(path)));
    } else if (entry.isFile() && !FORMAT_IGNORE.files.includes(entry.name) && /\.(ts|mjs|json|md|css|html|ya?ml)$/.test(path)) {
      result.push(path);
    }
  }

  return result;

}
/** Format inline test fixture modules using the same rules as ordinary JavaScript modules. */
async function inlineModules(source, path) {
  const matches = [...source.matchAll(/<script\b([^>]*\btype=["']module["'][^>]*)>([\s\S]*?)<\/script>/g)];
  let result = source;
  for (const match of matches.reverse()) {
    if (!match[2].trim()) {
      continue;
    }
    const code = await formatSource(match[2], `${path}.js`);
    const text = `<script${match[1]}>\n${code}</script>`;
    result = result.slice(0, match.index) + text + result.slice(match.index + match[0].length);
  }

  return result;

}

/** Apply the same source contract to executable examples without rewriting prose or shell commands. */
async function markdownModules(source, path) {
  const matches = [...source.matchAll(/```(ts|tsx|js|javascript|typescript)\s*\n([\s\S]*?)```/g)];
  let result = source;
  for (const match of matches.reverse()) {
    const extension = match[1] === 'tsx' ? 'tsx' : match[1] === 'js' || match[1] === 'javascript' ? 'js' : 'ts';
    const code = await formatSource(match[2], `${path}.${extension}`);
    const text = `\`\`\`${match[1]}\n${code}\`\`\``;
    result = result.slice(0, match.index) + text + result.slice(match.index + match[0].length);
  }

  return result;

}
const check = process.argv.includes('--check');
const changed = [];
for (const path of await files('.')) {
  const source = await readFile(path, 'utf8');
  const options = (await resolveConfig(path)) ?? {};
  let result = /\.(ts|mjs)$/.test(path) ? await formatSource(source, path) : await format(source, { ...options, filepath: path });
  if (path.endsWith('.html')) {
    result = await inlineModules(result, path);
  }
  if (path.endsWith('.md')) {
    result = await markdownModules(result, path);
  }
  if (result !== source) {
    changed.push(path);
    if (!check) {
      await writeFile(path, result);
    }
  }
}
if (check && changed.length !== 0) {
  process.stderr.write(`Formatting differs: ${changed.join(', ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(check ? 'Source style and Prettier checks passed.\n' : `Formatted ${changed.length} files.\n`);
}
