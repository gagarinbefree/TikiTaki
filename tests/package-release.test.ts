import { expect, it } from 'vitest';
import { preparePackageManifest, preparePackageLock } from '../scripts/package-release.mjs';

it('sets a stable public version without mutating source manifests', () => {
  const source = { name: 'tikitaki', version: '0.1.3', private: true, devDependencies: { typescript: '5.9.3' } };
  const result = preparePackageManifest(source, '0.1.4');
  expect(result).toMatchObject({ version: '0.1.4', publishConfig: { access: 'public', registry: 'https://registry.npmjs.org/' } });
  expect(result).not.toHaveProperty('private');
  expect(source.private).toBe(true);
  expect(source.version).toBe('0.1.3');
});

it('keeps framework peers and updates the compatible core peer range', () => {
  const result = preparePackageManifest(
    { name: '@tikitaki_gagarinbefree/react', peerDependencies: { tikitaki: '0.1.3', react: '^19.3.1' } },
    '0.1.4',
  );
  expect(result.peerDependencies).toEqual({ tikitaki: '^0.1.4', react: '^19.3.1' });
});

it('synchronizes root lockfile metadata without modifying dependency resolutions', () => {
  const source = {
    version: '0.1.3',
    packages: { '': { version: '0.1.3', name: 'tikitaki' }, 'node_modules/example': { version: '2.0.0' } },
  };
  const result = preparePackageLock(source, '0.1.4');
  expect(result.version).toBe('0.1.4');
  expect(result.packages[''].version).toBe('0.1.4');
  expect(result.packages['node_modules/example']).toEqual({ version: '2.0.0' });
  expect(source.packages[''].version).toBe('0.1.3');
});

it.each(['0.1.4-alpha.0', 'v0.1.4', '01.1.4', 'invalid'])('rejects invalid public release versions: %s', (version) => {
  expect(() => preparePackageManifest({ name: 'tikitaki' }, version)).toThrow();
  expect(() => preparePackageLock({ packages: { '': {} } }, version)).toThrow();
});
