import { expect, it } from 'vitest';
import ts from 'typescript';
import { formatSource } from '../scripts/source-style.mjs';
it('returns values through identifiers and separates early exits with blank lines', async () => {
  const result = await formatSource(
    'function accepted(value: boolean): boolean { if (!value) return false; return value ? true : false; }',
  );
  const tree = ts.createSourceFile('module.ts', result, ts.ScriptTarget.Latest, true);
  const returns: ts.ReturnStatement[] = [];
  function inspect(node: ts.Node) {
    if (ts.isReturnStatement(node)) {
      returns.push(node);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(tree);
  expect(returns).toHaveLength(2);
  expect(returns.every((node) => node.expression && ts.isIdentifier(node.expression))).toBe(true);
  expect(result).not.toMatch(/if\s*\([^\n]+\)\s+return/);
  expect(result).toMatch(/\n\n\s+return \w+;\n\n/);
});
it('keeps named imports and function signatures on one line', async () => {
  const result = await formatSource(
    "import {\n first,\n second\n} from './module';\nfunction combine(\n first: number,\n second: number\n): number { return first + second; }",
  );
  expect(result).toContain("import { first, second } from './module';");
  expect(result).toContain('function combine(first: number, second: number): number {');
});
it('preserves literal whitespace and makes canonical formatting idempotent', async () => {
  const source = "export function label(value = 'keep  two spaces'): string { return value; }";
  const once = await formatSource(source);
  expect(once).toContain("'keep  two spaces'");
  expect(await formatSource(once)).toBe(once);
});
it('preserves contextual types when naming an object return value', async () => {
  const result = await formatSource(
    'function adapter(): { update(value: number): number } { return { update(value) { return value; } }; }',
  );
  expect(result).toMatch(/const \w+: \{[\s\S]*update\(value: number\): number/);
  expect(result).not.toContain('return {');
});
it('removes braces and the preceding empty line from a single guarded return', async () => {
  const result = await formatSource('function stop(destroyed: boolean) { if (destroyed) { return; } work(); }');
  expect(result).toContain('if (destroyed)\n    return;\n\n  work();');
  expect(result).not.toContain('if (destroyed) {');
  expect(await formatSource(result)).toBe(result);
});
it('keeps identifier guards concise while retaining multi-statement and commented bodies', async () => {
  const result = await formatSource(
    'function stop(value: boolean) { if (value) { /* Already settled. */ return value; } if (!value) { notify(); return; } finish(); }',
  );
  expect(result).toMatch(/if \(value\)\n\s*\/\* Already settled\. \*\/\n\s*return value;\n\n/);
  expect(result).toMatch(/if \(!value\) \{\n\s*notify\(\);\n\n\s*return;/);
  expect(await formatSource(result)).toBe(result);
});
