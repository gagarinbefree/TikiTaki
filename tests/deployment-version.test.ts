import { expect, it } from 'vitest';
import { createDeploymentMetadata, createReleaseBadge, updateReadmeRelease } from '../scripts/deployment-version.mjs';

const commit = 'a'.repeat(40);

it('assigns different versions to successive deployments and retries', () => {
  const first = createDeploymentMetadata('0.1.0-alpha.0', '7', '1', commit);
  const retry = createDeploymentMetadata('0.1.0-alpha.0', '7', '2', commit, ['v0.1.1']);
  const next = createDeploymentMetadata('0.1.0-alpha.0', '8', '1', commit, ['v0.1.1', 'v0.1.2', 'v0.1.0-alpha.0.deploy.17.1']);
  expect(first.version).toBe('0.1.1');
  expect(new Set([first.version, retry.version, next.version]).size).toBe(3);
  expect(first.commit).toBe(commit);
});

it('increments the patch of a stable package version', () => {
  expect(createDeploymentMetadata('1.2.3', '10', '1', commit).version).toBe('1.2.4');
});

it.each(['0', '-1', '1.5', '', '1/2', '01'])('rejects invalid deployment identifiers: %s', (invalid) => {
  expect(() => createDeploymentMetadata('0.1.0', invalid, '1', commit)).toThrow();
  expect(() => createDeploymentMetadata('0.1.0', '1', invalid, commit)).toThrow();
});

it('rejects invalid package versions and source commits', () => {
  expect(() => createDeploymentMetadata('invalid', '1', '1', commit)).toThrow();
  expect(() => createDeploymentMetadata('0.1.0', '1', '1', 'missing')).toThrow();
});

it('updates only the marked README release version and stays idempotent', () => {
  const source = 'Before\n<!-- release-version -->Not published yet<!-- /release-version -->\nAfter';
  const version = '0.1.0-alpha.0.deploy.8.2';
  const result = updateReadmeRelease(source, version);
  expect(result).toBe(`Before\n<!-- release-version -->v${version}<!-- /release-version -->\nAfter`);
  expect(updateReadmeRelease(result, version)).toBe(result);
});

it('rejects missing and duplicated release markers instead of editing arbitrary README content', () => {
  const marker = '<!-- release-version -->old<!-- /release-version -->';
  expect(() => updateReadmeRelease('No marker', '0.1.0')).toThrow();
  expect(() => updateReadmeRelease(marker + marker, '0.1.0')).toThrow();
  expect(() => updateReadmeRelease(marker, 'invalid-version')).toThrow();
});

it('renders a repository-owned release badge with the published version', () => {
  const badge = createReleaseBadge('0.1.0-alpha.0.deploy.7.1');
  expect(badge).toContain('xmlns="http://www.w3.org/2000/svg"');
  expect(badge).toContain('v0.1.0-alpha.0.deploy.7.1');
  expect(badge).toContain('role="img"');
  expect(badge).not.toContain('shields.io');
  expect(() => createReleaseBadge('<script>')).toThrow();
});

it('changes the release image URL with its version to invalidate image caches', () => {
  const source = '[![Release](docs/badges/release.svg?version=old)](/releases)\n<!-- release-version -->old<!-- /release-version -->';
  const result = updateReadmeRelease(source, '0.1.0-alpha.0.deploy.8.1');
  expect(result).toContain('docs/badges/release.svg?version=0.1.0-alpha.0.deploy.8.1');
  expect(result).not.toContain('version=old');
});
