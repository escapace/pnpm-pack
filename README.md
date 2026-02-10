# pnpm-pack

`pnpm-pack` packages pnpm projects and workspaces into a gzip-compressed tarball (`.tgz`) by default, or extracts package files to a directory when `--extract` is used.

Available commands:

- `package` — package the nearest project (nearest `package.json`)
- `workspace` — package all workspace packages, or a filtered subset (nearest `pnpm-workspace.yaml`)

## Quick start

```bash
pnpm-pack package --version 1.2.3
pnpm-pack workspace --version 1.2.3
```

By default, artifacts are written to `./lib`. With `--extract`, the destination defaults to `./lib/package`. Archive names follow `<package-name>-<version>.tgz`.

## Common options

- `--version <semver>` sets the version used for packaging and for resulting artifact names.
- `--pack-destination <path>` controls where artifacts are written.
- `--extract` extracts package files to a directory instead of writing a tarball.
- `--no-build` skips running `pnpm run build` before packaging.
- `--production` and `--development` create an artifact that includes an isolated `node_modules` based on pnpm deploy behavior.
- `--no-optional` omits optional dependencies when `--production` or `--development` is used.
- `--silent` suppresses output from child commands (`pnpm`, `tar`, and build scripts).

Destination constraints:

- `--pack-destination` must be a relative path.
- With `--extract`, `--pack-destination` must be a directory path (for example `dist/package`).
- Without `--extract`, `--pack-destination` may be a directory path or an explicit tarball path ending in `.tgz` / `.tar.gz`.

## Command: `package`

Creates an artifact for the nearest project.

Example:

```bash
pnpm-pack package --version 1.2.3 --pack-destination dist
```

## Command: `workspace`

Packages a workspace from the nearest workspace root (`pnpm-workspace.yaml`).

By default, the workspace archive is written to `./lib/<workspace-root-name>-<version>.tgz`.

Workspace packaging also writes per-package tarballs under each selected package’s `lib/` directory.

Examples:

```bash
pnpm-pack workspace --version 1.2.3 --pack-destination dist
pnpm-pack workspace --version 1.2.3 --filter @scope/app...
pnpm-pack workspace --version 1.2.3 --filter-prod @scope/app...
```

Workspace selection:

- `--filter` selects workspace packages using pnpm [filtering selectors](https://pnpm.io/filtering).
- `--filter-prod` applies the same selector syntax but omits `devDependencies` when selecting dependency projects.
- `--test-pattern` marks test-file globs for pnpm changed-since filtering; see [pnpm docs](https://pnpm.io/filtering#--test-pattern-glob).
- `--changed-files-ignore-pattern` defines globs pnpm should ignore when computing changed projects; see [pnpm docs](https://pnpm.io/filtering#--changed-files-ignore-pattern-glob).
- `--workspace-concurrency <number>` sets workspace command parallelism.
