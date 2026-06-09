# Releasing `@advcomm/uids-io-auth-react`

## Automated releases (semantic-release)

On **`main`**, [semantic-release](https://semantic-release.gitbook.io/) runs in GitHub Actions: **conventional commits** in git history set the next **semver**, `CHANGELOG.md` is updated, a GitHub Release is created, and the package is published to npm.

**Releases do not use Husky.** The release workflow sets `HUSKY=0` and runs `npm ci --ignore-scripts` so local `pre-commit` / `pre-push` hooks never run in CI. There is no `preversion` script that runs lint/tests (that would break `@semantic-release/npm`’s internal `npm version`).

**Local hooks:** Husky runs Biome on staged files before commit and `npm run validate` (lint check, typecheck, test, build) before push — see `.husky/`.

### Commit messages (for semantic-release only)

semantic-release’s commit analyzer reads **merged git history** — not local hooks. Use [Conventional Commits](https://www.conventionalcommits.org/) on **`main`** so releases bump correctly:

| Commit / PR title (examples)                     | Release bump   |
| ------------------------------------------------ | -------------- |
| `fix: ...`                                       | patch          |
| `feat: ...`                                      | minor          |
| `BREAKING CHANGE:` in body or `feat!:` / `fix!:` | major          |
| `chore:`, `docs:`, etc. (no feat/fix)            | no new version |

You can enforce this later (e.g. PR titles, CI, or hooks); it is **not** required for the release workflow to run.

### CI

1. **Release:** [`.github/workflows/release.yml`](.github/workflows/release.yml) on push to **`main`** (skips with `[skip ci]` on the release bot commit). Uses **Node 24** ([semantic-release v25](https://github.com/semantic-release/semantic-release/blob/master/docs/support/node-version.md)).
2. **Quality gates:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs tests, typecheck, and build on PRs and pushes to **`main`** (the release job intentionally does not run tests).
3. Secret **`NPM_TOKEN`**: npm automation or publish token ([npm access tokens](https://docs.npmjs.com/about-access-tokens)). `GITHUB_TOKEN` is provided by Actions. Alternatively configure npm **trusted publishing** (OIDC) and omit `NPM_TOKEN`.
4. Optional **`RELEASE_GIT_TOKEN`**: PAT with `repo` + `workflow` scopes if `GITHUB_TOKEN` cannot push release commits/tags that touch `.github/workflows/*`.
5. **Git tags are the version baseline** (critical): semantic-release uses **`v*.*.*` tags** on `main`, not npm, to decide the last release. With **no** such tags it tries **`1.0.0`**, which will fail **`prepublishOnly`** if npm is already higher.

   **First publish:** if the package is not on npm yet, the baseline script exits cleanly and semantic-release publishes from conventional commits (starting from `0.1.0` in `package.json` or the computed next version).

   **Option A — continue existing line:** tag what npm already has (e.g. **`v0.1.0`**) on the commit that matches that publish.

   **Option B — reset baseline at a new major:** bump **`package.json`** (e.g. **`1.0.0`**), then create **one** tag on current `main`:

   ```bash
   git tag v1.0.0 HEAD
   git push origin v1.0.0
   ```

   Tags must look like **`v1.2.3`** — not a bare **`v1`** (invalid semver for the tool).

   On **GitHub Actions**, **`scripts/ensure-release-baseline.cjs`** creates and pushes **`v{package.json version}`** when that version is **greater than** npm latest and the tag is missing.

### npm setup (one-time)

1. Create the **`@advcomm/uids-io-auth-react`** package on [npmjs.com](https://www.npmjs.com/) (or ensure your org allows publishing).
2. Add GitHub repo secret **`NPM_TOKEN`** with publish access, **or** configure [trusted publishing](https://docs.npmjs.com/trusted-publishers) for this GitHub repo.
3. On first merge to `main` after this workflow lands, the release job publishes when conventional commits warrant a bump.

### Local dry run

Node **24+**, clean tree, full history:

```bash
CI=true GITHUB_TOKEN=... NPM_TOKEN=... npm run release:dry-run
```

Config: [`release.config.cjs`](release.config.cjs).

### If you still see tests during the release job

The **Release** workflow does **not** run Vitest. If logs show `vitest` / `npm test`, almost always:

1. **`package.json` on `main` still has a `preversion` (or `version`) script** that runs `check` or `test`. **`@semantic-release/npm` runs `npm version`**, which triggers those scripts. **Remove `preversion`** from `main`.
2. A **different workflow** on the same push is running in parallel—check the **job name** in GitHub Actions.

---

## Semver (manual mental model)

| Bump      | When                                                           |
| --------- | -------------------------------------------------------------- |
| **PATCH** | Bug fixes, refactors, docs—backward compatible.                |
| **MINOR** | New features / flags—backward compatible.                      |
| **MAJOR** | Breaking changes (API, config, required Node, migration format). |

## Published versions on npm

```bash
npm run npm:latest
npm run npm:versions
```

## Manual release (fallback)

1. Merge to `main`.
2. Optionally `npm test && npm run typecheck`.
3. `npm run release:patch` / `minor` / `major` (do not add `preversion` → `test`).
4. `git push --follow-tags`
5. `npm publish` — `prepublishOnly` runs **`npm run build`** and **`scripts/assert-npm-version.cjs`**.

### Registry check bypass

```bash
SKIP_REGISTRY_VERSION_CHECK=1 npm publish
```

### First publish / rename

If the package is unpublished, the assert script skips. For a rename, update `PKG_NAME` in `scripts/assert-npm-version.cjs` and `package.json` `name` together.
