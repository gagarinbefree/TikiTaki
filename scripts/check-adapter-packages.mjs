import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const consumer = join(root, '.artifacts/framework-package-manual/consumer');
const mode = process.argv[2];
assert(['prepare', 'verify'].includes(mode), 'Use prepare or verify');

if (mode === 'prepare') {
  await mkdir(consumer, { recursive: true });
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'tikitaki-framework-consumer', private: true, type: 'module' }));
  await writeFile(
    join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noUncheckedIndexedAccess: true,
        exactOptionalPropertyTypes: true,
        noImplicitOverride: true,
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        types: [],
        outDir: 'output',
      },
      include: ['index.ts'],
    }),
  );
  await writeFile(
    join(consumer, 'index.ts'),
    `
import { createElement } from 'react';
import { h } from 'vue';
import { createReactCellAdapter, ReactCellPortals, type ReactCellBridge } from '@tikitaki/react';
import { createVueCellAdapter, VueCellPortals, type VueCellBridge } from '@tikitaki/vue';
import { createSwipeEngine, type SwipeEngine } from 'tikitaki/dom';
import type { Position } from 'tikitaki';

const react: ReactCellBridge<string> = createReactCellAdapter<string>();
const vue: VueCellBridge<string> = createVueCellAdapter<string>();
if (react.getSnapshot().length !== 0 || vue.cells.value.length !== 0) throw new Error('Invalid adapter import');
createElement(ReactCellPortals<string>, { bridge: react, renderCell: item => createElement('span', null, item) });
h(VueCellPortals<string>, { bridge: vue, renderCell: (item: string) => h('span', item) });
export function mount(container: HTMLElement) {
  const controller = createSwipeEngine({ container, grid: [['A1'], ['B1']], adapter: react.adapter });

  return controller;

}
const position: Position = { row: 0, col: 0 };
if (false) {
  // @ts-expect-error The Vue cell ref is readonly.
  vue.cells.value = [];
  // @ts-expect-error React snapshots are readonly.
  react.getSnapshot().push({ key: 'bad', host: document.body, item: 'bad', position });
  // @ts-expect-error Item types must agree with the engine grid.
  createSwipeEngine<number>({ container: document.body, grid: [[1]], adapter: react.adapter });
  // @ts-expect-error Position values are readonly.
  position.col = 1;
}
`,
  );
  process.stdout.write(`Prepared framework consumer at ${consumer}\n`);
} else {
  await import(pathToFileURL(join(consumer, 'output/index.js')).href);
  for (const framework of ['react', 'vue']) {
    const directory = join(consumer, 'node_modules/@tikitaki', framework);
    const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
    assert.equal(manifest.name, `@tikitaki/${framework}`);
    assert.equal(manifest.sideEffects, false);
    assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
    assert.deepEqual(
      Object.keys(manifest.peerDependencies).sort(),
      framework === 'react' ? ['react', 'react-dom', 'tikitaki'] : ['tikitaki', 'vue'],
    );
    const code = await readFile(join(directory, 'dist/index.js'), 'utf8');
    const allowed = framework === 'react' ? ['react', 'react-dom'] : ['vue'];
    for (const [, specifier] of code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)) {
      assert(allowed.includes(specifier) || specifier.startsWith('./'), `Unexpected adapter import ${specifier}`);
    }
    assert(!/createRoot|createApp|require\s*\(|import\s*\(/.test(code), 'An adapter must not own per-cell app roots');
  }
  const core = JSON.parse(await readFile(join(consumer, 'node_modules/tikitaki/package.json'), 'utf8'));
  assert.equal(Object.keys(core.dependencies ?? {}).length, 0);
  assert.equal(Object.keys(core.peerDependencies ?? {}).length, 0);
  process.stdout.write(
    'Adapter package check passed: fresh React/Vue tarballs, independent strict TypeScript consumer, readonly contracts, import-safe ESM and isolated peers.\n',
  );
}
