import { expect, it } from 'vitest';
import { createDeploymentMetadata } from '../scripts/deployment-version.mjs';

const commit = 'a'.repeat(40);

it('assigns different versions to successive deployments and retries', () => {
  const first = createDeploymentMetadata('0.1.0-alpha.0', '7', '1', commit);
  const retry = createDeploymentMetadata('0.1.0-alpha.0', '7', '2', commit);
  const next = createDeploymentMetadata('0.1.0-alpha.0', '8', '1', commit);
  expect(first.version).toBe('0.1.0-alpha.0.deploy.7.1');
  expect(new Set([first.version, retry.version, next.version]).size).toBe(3);
  expect(first.commit).toBe(commit);
});

it('creates a valid prerelease from a stable package version', () => {
  expect(createDeploymentMetadata('1.2.3', '10', '1', commit).version).toBe('1.2.3-deploy.10.1');
});

it.each(['0', '-1', '1.5', '', '1/2', '01'])('rejects invalid deployment identifiers: %s', (invalid) => {
  expect(() => createDeploymentMetadata('0.1.0', invalid, '1', commit)).toThrow();
  expect(() => createDeploymentMetadata('0.1.0', '1', invalid, commit)).toThrow();
});

it('rejects invalid package versions and source commits', () => {
  expect(() => createDeploymentMetadata('invalid', '1', '1', commit)).toThrow();
  expect(() => createDeploymentMetadata('0.1.0', '1', '1', 'missing')).toThrow();
});
