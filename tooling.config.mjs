/** Shared formatting conventions; use the project formatter to preserve custom return layout. */
export const SOURCE_STYLE_CONFIG = Object.freeze({
  lineWidth: 140,
  returnBindingName: 'result',
  firstDuplicateSuffix: 2,
  defaultPath: 'module.ts',
});

/** Standard Prettier options used before applying the repository's explicit layout rules. */
export const PRETTIER_CONFIG = Object.freeze({
  singleQuote: true,
  trailingComma: 'all',
  printWidth: SOURCE_STYLE_CONFIG.lineWidth,
  objectWrap: 'collapse',
  embeddedLanguageFormatting: 'off',
  endOfLine: 'lf',
});

/** Local-only development and browser test server settings. */
export const SERVER_CONFIG = Object.freeze({ host: '127.0.0.1', testPort: 4177, developmentPort: 4178 });

/** Repository subpath used by the production demo and its Pages browser checks. */
export const DEPLOYMENT_CONFIG = Object.freeze({ basePath: '/TikiTaki/', developmentBasePath: '/' });

/** Public deployment metadata and its shared display contract. */
export const VERSION_CONFIG = Object.freeze({
  filename: 'version.json',
  outputDirectory: 'demos/dist',
  tag: 'deploy',
  development: 'development',
  element: 'output',
  attribute: 'data-demo-version',
  className: 'deployment-version',
  label: 'Version: ',
  cache: 'no-store',
  invalidVersion: 'Invalid package version',
  invalidIdentifier: 'Deployment identifiers must be positive decimal integers',
  invalidCommit: 'A full source commit SHA is required',
  readmePath: 'README.md',
  readmeMarker: /<!-- release-version -->[\s\S]*?<!-- \/release-version -->/g,
  invalidReadme: 'README must contain exactly one release-version marker',
});

/** Google Chrome verification settings, independent of application runtime configuration. */
export const BROWSER_CONFIG = Object.freeze({
  channel: 'chrome',
  desktop: Object.freeze({ width: 900, height: 900 }),
  touch: Object.freeze({ width: 390, height: 844 }),
  timeout: 20000,
  serverTimeout: 10000,
  workers: 1,
  reportPath: '.artifacts/chrome.json',
});

/** Paths excluded from formatting, including the unchanged mandatory specification. */
export const FORMAT_IGNORE = Object.freeze({
  directories: Object.freeze(['node_modules', 'dist', 'coverage', 'test-results', 'playwright-report']),
  files: Object.freeze(['AGENTS.md', 'package-lock.json']),
});
