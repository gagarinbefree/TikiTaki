/** Standard Prettier options shared by the CLI and editor integrations. */
export const PRETTIER_CONFIG = Object.freeze({
  singleQuote: true,
  plugins: ['prettier-plugin-svelte'],
  overrides: [{ files: '*.svelte', options: { parser: 'svelte' } }],
  trailingComma: 'all',
  printWidth: 140,
  objectWrap: 'collapse',
  embeddedLanguageFormatting: 'auto',
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
  element: 'p',
  attribute: 'data-demo-version',
  className: 'container fg-3 fs-sm text-center py-4 border-top',
  label: 'Version: ',
  repository: 'https://github.com/gagarinbefree/TikiTaki',
  cache: 'no-store',
  invalidVersion: 'Invalid package version',
  invalidIdentifier: 'Deployment identifiers must be positive decimal integers',
  invalidCommit: 'A full source commit SHA is required',
  readmePath: 'README.md',
  badgePath: 'docs/badges/release.svg',
  badgeImagePattern: /!\[Release\]\(docs\/badges\/release\.svg(?:\?[^)]*)?\)/g,
  versionPattern: /^\d+\.\d+\.\d+(?:-[A-Za-z\d.-]+)?$/,
  readmeMarker: /<!-- release-version -->[\s\S]*?<!-- \/release-version -->/g,
  invalidReadme: 'README must contain exactly one release-version marker',
});

/** Geometry and colors for the repository-owned release status image. */
export const RELEASE_BADGE_CONFIG = Object.freeze({
  label: 'release',
  height: 20,
  labelWidth: 54,
  characterWidth: 7,
  valuePadding: 16,
  cornerRadius: 3,
  fontSize: 11,
  textY: 14,
  background: '#555',
  valueBackground: '#007ec6',
  foreground: '#fff',
  fontFamily: 'Verdana,Geneva,DejaVu Sans,sans-serif',
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
