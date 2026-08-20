# pnpm-pack

`pnpm-pack` packages pnpm projects and workspaces into a gzip-compressed tarball (`.tgz`) by default, a `.zip` archive when the destination path ends in `.zip`, or extracts package files to a directory when `--extract` is used.

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
- `--pack-destination <path>` controls where artifacts are written. Use a `.zip` extension to produce a zip archive instead of a tarball.
- `--extract` extracts package files to a directory instead of writing an archive.
- `--no-build` skips running `pnpm run build` before packaging.
- `--production` and `--development` create an artifact that includes an isolated `node_modules` based on pnpm deploy behavior.
- `--no-optional` omits optional dependencies when `--production` or `--development` is used.
- `--no-redact-readme` keeps README-like file contents in packaged artifacts.
- `--umask <octal>` sets the file permission umask applied to archive entries and extracted files. Default: `0o022`. Use `--umask 0` to disable permission normalization.
- `--verbose` shows output from child commands (`pnpm`, `tar`, and build scripts). Child command output is suppressed by default.

Destination constraints:

- `--pack-destination` must be a relative path.
- With `--extract`, `--pack-destination` must be a directory path (for example `dist/package`).
- Without `--extract`, `--pack-destination` may be a directory path or an explicit archive path ending in `.tgz` / `.tar.gz` / `.zip`.

## Archive format

The output format is inferred from `--pack-destination`:

- Directory path or `.tgz` / `.tar.gz` extension → gzip-compressed tarball (default).
- `.zip` extension → zip archive.

## AWS Lambda deployment

To produce a zip archive suitable for AWS Lambda with correct file permissions:

```bash
pnpm-pack package --version 1.2.3 --production --pack-destination dist/lambda.zip
```

The default umask `0o022` ensures files have `644` (`rw-r--r--`) and directories have `755` (`rwxr-xr-x`) permissions, which Lambda requires.

## Command: `package`

Creates an artifact for the nearest project.

Example:

```bash
pnpm-pack package --version 1.2.3 --pack-destination dist
```

## Command: `workspace`

Packages a workspace from the nearest workspace root (`pnpm-workspace.yaml`).

By default, the workspace archive is written to `./lib/<workspace-root-name>-<version>.tgz`.

Workspace packaging also writes per-package tarballs under each selected package's `lib/` directory.

Examples:

```bash
pnpm-pack workspace --version 1.2.3 --pack-destination dist
pnpm-pack workspace --version 1.2.3 --pack-destination dist/workspace.zip
pnpm-pack workspace --version 1.2.3 --filter @scope/app...
pnpm-pack workspace --version 1.2.3 --filter-prod @scope/app...
```

Workspace selection:

- `--filter` selects workspace packages using pnpm [filtering selectors](https://pnpm.io/filtering).
- `--filter-prod` applies the same selector syntax but omits `devDependencies` when selecting dependency projects.
- `--test-pattern` marks test-file globs for pnpm changed-since filtering; see [pnpm docs](https://pnpm.io/filtering#--test-pattern-glob).
- `--changed-files-ignore-pattern` defines globs pnpm should ignore when computing changed projects; see [pnpm docs](https://pnpm.io/filtering#--changed-files-ignore-pattern-glob).
- `--workspace-concurrency <number>` sets workspace command parallelism.
