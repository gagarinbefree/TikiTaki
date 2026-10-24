# Publishing TikiTaki

The npm owner is `gagarinbefree`. The public packages are `tikitaki`, `@tikitaki_gagarinbefree/react`, `@tikitaki_gagarinbefree/vue`, `@tikitaki_gagarinbefree/svelte`, and `@tikitaki_gagarinbefree/angular`. All packages use the MIT license and share one stable release version.

## Release artifacts

The main CI workflow assigns the version before installing dependencies and building. It synchronizes the core, adapter manifests, compatible core peer ranges, and root lockfile. After all checks pass, it packs five npm tarballs, validates required files and core dependency isolation, and creates `npm-release.json` with SHA-512 integrity values. The GitHub Release contains these exact archives alongside the demo downloads. The release bot records the version in the source manifests and README.

Publish the release archives instead of rebuilding a published tag. A tag identifies the tested source commit; the versioned manifests in the archives were prepared by CI before the tests and builds.

## First publication

Use an npm account with verified email, configured 2FA, and publishing rights in the `tikitaki_gagarinbefree` organization. The organization owner must have rights to its packages; the existence of a default team alone does not authorize other users.

In your own interactive terminal, sign in and check the account:

```sh
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

Check that the account is `gagarinbefree`. Download the desired GitHub release artifacts into a clean directory. Replace `v0.1.4` below with the prepared release tag:

```sh
gh release download v0.1.4 --repo gagarinbefree/TikiTaki --pattern '*.tgz' --pattern 'npm-release.json' --dir .artifacts/npm-release-v0.1.4
npm run release:publish -- .artifacts/npm-release-v0.1.4 --verify-only
npm run release:publish -- .artifacts/npm-release-v0.1.4
```

No installation of project dependencies is needed for the publication scripts themselves; use Node.js 24 and its current npm CLI. Complete npm's browser/2FA prompts locally. Never paste an access token, authentication QR code, or recovery code into an Issue, PR, or chat.

The script verifies the complete archive set before contacting npm, publishes the core before its adapters, and stops on the first error. If an identical package version already exists, a retry skips it only when npm reports exactly the same archive integrity. Different contents under an existing version cause failure; create a new release version instead. Packages that were already published remain published if a later adapter fails.

For a local candidate only, install development dependencies, assign an explicit version, then build, test, and pack:

```sh
npm ci
npm run release:prepare -- 0.1.4
npm run check
npm run release:pack
npm run release:publish -- .artifacts/npm-release --verify-only
```

Use the CI-produced archives for an official release. The local preparation command edits package manifests and the lockfile; review those changes before committing them.

## Configure trusted publishing after the first publication

For each of the five packages, open its npm package **Settings → Trusted Publisher** and select **GitHub Actions**. Use:

| Setting              | Value                       |
| -------------------- | --------------------------- |
| Organization or user | `gagarinbefree`             |
| Repository           | `TikiTaki`                  |
| Workflow filename    | `npm-publish.yml`           |
| Environment name     | `npm`                       |
| Allowed action       | Enable direct `npm publish` |

The repository includes `.github/workflows/npm-publish.yml`. Its job uses a GitHub-hosted runner and `id-token: write`; no persistent `NPM_TOKEN` is needed. In GitHub **Settings → Environments**, configure the `npm` environment for publication approvals and restrict it to the intended maintainers and branch as appropriate.

A new npm trusted-publisher configuration must complete a successful publish within two days or it expires. Enable direct `npm publish` explicitly: current npm settings may otherwise allow only staged publication. See the [official trusted publishing guide](https://docs.npmjs.com/trusted-publishers/).

## Subsequent publication through GitHub Actions

1. Merge the reviewed change into `main` and wait for the full tests/build/Pages/Release workflow to pass.
2. Open **Actions → Publish npm packages → Run workflow** on `main`.
3. Enter the existing stable release tag, for example `v0.1.5`.
4. Approve the `npm` environment if configured. The job downloads the release archives, verifies their checksums and version, and publishes them in dependency order using OIDC.
5. Verify registry metadata and test installation in a clean application before announcing the release.

Publication runs are serialized and are not cancelled midway by a newer publication request. Ordinary CI runs still cancel outdated tests and builds on the same branch. Publication is manual rather than triggered by every demo deployment.

After the initial packages exist, verify that the README installation commands resolve the intended public packages. Keep package metadata, adapter guides, and the registry pages consistent.
