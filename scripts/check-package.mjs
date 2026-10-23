import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL, URL } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const npmCli = process.env.npm_execpath;
const mode = process.argv[2] ?? 'all';
assert(['all', 'prepare', 'verify'].includes(mode), 'Unknown package check mode');
if (mode === 'all') {
  assert(npmCli, 'Run this check through npm run test:package');
}
function run(args, cwd) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const result2 = result.stdout;

  return result2;
}
const artifacts = join(root, '.artifacts');
await mkdir(artifacts, { recursive: true });
const directory = mode === 'all' ? await mkdtemp(join(artifacts, 'package-')) : join(artifacts, 'package-manual');
const consumer = join(directory, 'consumer');
if (mode !== 'verify') {
  await mkdir(consumer, { recursive: true });
  await writeFile(join(consumer, 'package.json'), JSON.stringify({ name: 'tikitaki-independent-consumer', private: true, type: 'module' }));
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
        lib: ['ES2022'],
        types: [],
        outDir: 'output',
      },
      include: ['index.ts'],
    }),
  );
  await writeFile(
    join(consumer, 'index.ts'),
    `import { createNavigationModel, type NavigationModel, createGestureEngine, type GestureEngine, DEFAULT_GESTURE_OPTIONS, type GestureOptions, type GestureContext, type GestureSettlement, type Position, type Grid, type Direction } from 'tikitaki';
const grid: Grid<string> = [['A1', 'A2'], ['B1']];
const model = createNavigationModel(grid, { row: 0, col: 1 });
const direction: Direction = 'up';
const changed: boolean = model.navigate(direction);
const position: Position = model.getPosition();
const item: string = model.getItem(position);
if (!changed || position.row !== 1 || position.col !== 0 || item !== 'B1') {
  throw new Error('Packaged ESM navigation failed');
}
const context: GestureContext = {
  width: 300, height: 600,
  neighbors: { up: true, down: false, left: true, right: false },
};
const options: Partial<GestureOptions> = { animationDuration: 0 };
const gesture = createGestureEngine(context, options);
gesture.pointerDown({ pointerId: 1, x: 0, y: 0, time: 0 });
const plan: GestureSettlement | null = gesture.pointerUp({ pointerId: 1, x: 0, y: -100, time: 1000 });
if (plan === null || plan.direction !== 'up' || plan.to.y !== -600 || !gesture.finishSettling(plan)) {
  throw new Error('Packaged ESM gesture failed');
}
if (DEFAULT_GESTURE_OPTIONS.distanceThreshold !== 80) throw new Error('Incorrect defaults');
gesture.destroy();
if (false) {
  // @ts-expect-error Positions are readonly.
  position.col = 1;
  // @ts-expect-error Grid rows are readonly.
  grid[0]?.push('invalid');
  // @ts-expect-error Only the four supported directions are accepted.
  model.navigate('diagonal');
  // @ts-expect-error Gesture options are readonly.
  options.animationDuration = 5;
  // @ts-expect-error Settlement targets are readonly.
  plan!.to.y = 1;
}
`,
  );
  await writeFile(
    join(consumer, 'tsconfig.dom.json'),
    JSON.stringify({
      extends: './tsconfig.json',
      compilerOptions: { lib: ['ES2022', 'DOM', 'DOM.Iterable'], outDir: 'output-dom' },
      include: ['browser.ts'],
    }),
  );
  await writeFile(
    join(consumer, 'browser.ts'),
    `import { createSwipeEngine, type SwipeEngine, createDOMRenderer, type DOMRenderer, createDOMAdapter, type SwipeEngineOptions, type CellAdapter, type RendererSize } from 'tikitaki/dom';
import { createNavigationModel, type NavigationModel } from 'tikitaki';
if (typeof createSwipeEngine !== 'function' || typeof createDOMRenderer !== 'function' || typeof createDOMAdapter !== 'function') {
  throw new Error('DOM entry point cannot be imported without a browser');
}
export function mount(container: HTMLElement): DOMRenderer {
  const adapter: CellAdapter<string> = createDOMAdapter((item) => {
    const element = container.ownerDocument.createElement('div');
    element.textContent = item;

    return element;

  });
  const renderer = createDOMRenderer({ container, navigation: createNavigationModel([['A1'], ['B1']]), adapter });

  return renderer;

}
const size: RendererSize = { width: 300, height: 600 };
export function mountEngine(container: HTMLElement): SwipeEngine<string> {
  const options: SwipeEngineOptions<string> = {
    container, grid: [['A1'], ['B1']],
    renderCell(item) {
      const element = container.ownerDocument.createElement('div');
      element.textContent = item;

      return element;

    },
  };
  const engine = createSwipeEngine(options);
  const navigation: Promise<boolean> = engine.navigate('up');
  const jump: Promise<boolean> = engine.goTo({ row: 0, col: 0 });
  void navigation;
  void jump;
  if (false) {
    // @ts-expect-error Engine options are readonly.
    options.container = container;
    // @ts-expect-error Rendering strategies are mutually exclusive.
    createSwipeEngine({ ...options, adapter: createDOMAdapter(options.renderCell) });
    // @ts-expect-error A rendering strategy is required.
    createSwipeEngine({ container, grid: [['A1']] });
    // @ts-expect-error Only supported directions are accepted.
    engine.navigate('diagonal');
  }

  return engine;

}
if (false) {
  // @ts-expect-error Renderer geometry is readonly.
  size.width = 400;
}
`,
  );
}
if (mode === 'prepare') {
  process.stdout.write(`Prepared independent consumer at ${consumer}\n`);
} else {
  if (mode === 'all') {
    const pack = JSON.parse(run([npmCli, 'pack', '--ignore-scripts', '--json', '--pack-destination', directory], root));
    run(
      [
        npmCli,
        'install',
        join(directory, pack[0].filename),
        '--offline',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        '--cache',
        join(artifacts, 'npm-cache'),
      ],
      consumer,
    );
    run([join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], consumer);
    run([join(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.dom.json'], consumer);
  }
  await import(pathToFileURL(join(consumer, 'output/index.js')).href);
  await import(pathToFileURL(join(consumer, 'output-dom/browser.js')).href);
  const installedPackage = join(consumer, 'node_modules/tikitaki');
  const manifest = JSON.parse(await readFile(join(installedPackage, 'package.json'), 'utf8'));
  assert.equal(Object.keys(manifest.dependencies ?? {}).length, 0);
  assert.equal(Object.keys(manifest.peerDependencies ?? {}).length, 0);
  assert.equal(manifest.sideEffects, false);
  assert.deepEqual((await readdir(join(consumer, 'node_modules'))).sort(), ['.package-lock.json', 'tikitaki']);
  let moduleCount = 0;
  for (const filename of await readdir(join(installedPackage, 'dist'))) {
    if (filename.endsWith('.js')) {
      moduleCount += 1;
      const code = await readFile(join(installedPackage, 'dist', filename), 'utf8');
      const specifiers = [...code.matchAll(/\bfrom\s*['"]([^'"]+)['"]/g)];
      for (const [, specifier] of specifiers) {
        assert(specifier.startsWith('./'), `Unexpected runtime dependency: ${specifier}`);
      }
      assert(!/\b(?:import\s*\(|require\s*\()/.test(code), 'Unexpected dynamic import or require');
    }
  }
  assert(moduleCount > 0, 'No production ESM modules found');
  process.stdout.write(
    'Package check passed: headless and DOM TypeScript consumers, import-safe ESM entry points, readonly types, zero installed runtime dependencies.\n',
  );
}
