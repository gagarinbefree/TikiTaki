import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { verifyReleaseArtifacts } from '../scripts/release-artifacts.mjs';

const archive = new TextEncoder().encode('tested npm archive');
const integrity = 'sha512-' + createHash('sha512').update(archive).digest('base64');
const metadata = { version: '0.1.4', packages: [{ name: 'tikitaki', version: '0.1.4', filename: 'tikitaki-0.1.4.tgz', integrity }] };
const archives = new Map([['tikitaki-0.1.4.tgz', archive]]);
it('accepts only the expected package list with matching archive bytes', () => {
  expect(verifyReleaseArtifacts(metadata, ['tikitaki'], archives)).toEqual(metadata.packages);
});
it('rejects tampered archives before any registry interaction', () => {
  expect(() =>
    verifyReleaseArtifacts(metadata, ['tikitaki'], new Map([['tikitaki-0.1.4.tgz', new TextEncoder().encode('changed')]])),
  ).toThrow();
});
it('rejects missing packages, different versions, and paths outside the artifact directory', () => {
  expect(() => verifyReleaseArtifacts(metadata, ['tikitaki', '@tikitaki_gagarinbefree/react'], archives)).toThrow();
  expect(() => verifyReleaseArtifacts({ ...metadata, version: '0.1.5' }, ['tikitaki'], archives)).toThrow();
  const entry = metadata.packages[0];
  if (!entry) throw new Error('Missing test fixture');
  expect(() =>
    verifyReleaseArtifacts({ ...metadata, packages: [{ ...entry, filename: '../escape.tgz' }] }, ['tikitaki'], archives),
  ).toThrow();
});
