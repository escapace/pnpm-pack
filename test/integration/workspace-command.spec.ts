import assert from 'node:assert'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, it } from 'vitest'
import { listFilesRelative } from '../support/list-files-relative'
import { prepareFixture } from '../support/prepare-fixture'
import { listTarEntries } from '../support/tar'

const cleanups = new Set<() => Promise<void>>()

afterEach(async () => {
  await Promise.all(
    [...cleanups].map(async (cleanup) => {
      await cleanup()
      cleanups.delete(cleanup)
    }),
  )
})

const pathCli = path.resolve(import.meta.dirname, '../../lib/node/cli.js')

const hasTarEntrySuffix = (entries: string[], suffix: string) =>
  entries.some((value) => value.endsWith(suffix))

const fileExists = async (pathFile: string) => {
  try {
    await access(pathFile)
    return true
  } catch {
    return false
  }
}

const readVersion = async (pathDirectoryPackage: string) => {
  const contentPackageJSON = await readFile(path.join(pathDirectoryPackage, 'package.json'), 'utf8')
  const packageJSON = JSON.parse(contentPackageJSON) as { version: string }

  return packageJSON.version
}

it(
  'workspace command packages all packages by default filter',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-basic' })
    cleanups.add(fixture.cleanup)

    const filesBefore = await listFilesRelative(fixture.pathDirectoryWorkspace)

    await execa(
      'node',
      [pathCli, 'workspace', '--silent', '--version', '1.2.3', '--pack-destination', 'dist'],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const pathArchive = path.join(
      fixture.pathDirectoryWorkspace,
      'dist/fixture-workspace-basic-root-1.2.3.tgz',
    )

    assert.equal(await fileExists(pathArchive), true)

    const entries = await listTarEntries(pathArchive)

    assert.equal(hasTarEntrySuffix(entries, 'packages/app/package.json'), true)
    assert.equal(hasTarEntrySuffix(entries, 'packages/lib/package.json'), true)

    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/app')),
      '0.0.0',
    )
    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/lib')),
      '0.0.0',
    )

    const filesAfter = await listFilesRelative(fixture.pathDirectoryWorkspace)

    assert.deepEqual(
      filesAfter,
      [
        ...filesBefore,
        'dist/fixture-workspace-basic-root-1.2.3.tgz',
        'packages/app/lib/fixture-basic-app-1.2.3.tgz',
        'packages/lib/lib/fixture-basic-lib-1.2.3.tgz',
      ].sort(),
    )
  },
)

it(
  'workspace command production deploy omits pnpm package map metadata',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-deploy-flags' })
    cleanups.add(fixture.cleanup)

    await execa(
      'node',
      [
        pathCli,
        'workspace',
        '--silent',
        '--version',
        '1.2.3',
        '--production',
        '--pack-destination',
        'dist',
        '--workspace-concurrency',
        '1',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const pathArchive = path.join(
      fixture.pathDirectoryWorkspace,
      'dist/workspace-deploy-flags-root-1.2.3.tgz',
    )

    assert.equal(await fileExists(pathArchive), true)

    const entries = await listTarEntries(pathArchive)

    assert.equal(
      entries.some((entry) => entry.includes('.package-map.json')),
      false,
    )
    assert.equal(
      hasTarEntrySuffix(entries, 'packages/app/node_modules/@fixture/prod-dep/package.json'),
      true,
    )
  },
)

it(
  'workspace command honors filter-prod by excluding dev dependency projects',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-filtered' })
    cleanups.add(fixture.cleanup)

    const filesBefore = await listFilesRelative(fixture.pathDirectoryWorkspace)

    await execa(
      'node',
      [
        pathCli,
        'workspace',
        '--silent',
        '--version',
        '2.0.0',
        '--filter-prod',
        '@fixture/filter-app...',
        '--pack-destination',
        'dist',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const pathArchive = path.join(
      fixture.pathDirectoryWorkspace,
      'dist/fixture-workspace-filtered-root-2.0.0.tgz',
    )

    assert.equal(await fileExists(pathArchive), true)

    const entries = await listTarEntries(pathArchive)

    assert.equal(hasTarEntrySuffix(entries, 'packages/app/package.json'), true)
    assert.equal(hasTarEntrySuffix(entries, 'packages/prod-lib/package.json'), true)

    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/app')),
      '0.0.0',
    )
    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/prod-lib')),
      '0.0.0',
    )
    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/dev-lib')),
      '8.0.0',
    )

    const filesAfter = await listFilesRelative(fixture.pathDirectoryWorkspace)

    assert.deepEqual(
      filesAfter,
      [
        ...filesBefore,
        'dist/fixture-workspace-filtered-root-2.0.0.tgz',
        'packages/app/lib/fixture-filter-app-2.0.0.tgz',
        'packages/prod-lib/lib/fixture-filter-prod-lib-2.0.0.tgz',
      ].sort(),
    )
  },
)

it(
  'workspace command accepts test-pattern and changed-files-ignore-pattern flags',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-basic' })
    cleanups.add(fixture.cleanup)

    const filesBefore = await listFilesRelative(fixture.pathDirectoryWorkspace)

    await execa(
      'node',
      [
        pathCli,
        'workspace',
        '--silent',
        '--version',
        '3.0.0',
        '--test-pattern',
        'test/**',
        '--changed-files-ignore-pattern',
        '**/*.md',
        '--pack-destination',
        'dist',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const pathArchive = path.join(
      fixture.pathDirectoryWorkspace,
      'dist/fixture-workspace-basic-root-3.0.0.tgz',
    )

    assert.equal(await fileExists(pathArchive), true)

    const filesAfter = await listFilesRelative(fixture.pathDirectoryWorkspace)

    assert.deepEqual(
      filesAfter,
      [
        ...filesBefore,
        'dist/fixture-workspace-basic-root-3.0.0.tgz',
        'packages/app/lib/fixture-basic-app-3.0.0.tgz',
        'packages/lib/lib/fixture-basic-lib-3.0.0.tgz',
      ].sort(),
    )
  },
)

it(
  'workspace command failure still performs cleanup and leaves no extra files',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-failure' })
    cleanups.add(fixture.cleanup)

    const filesBefore = await listFilesRelative(fixture.pathDirectoryWorkspace)

    const result = await execa(
      'node',
      [pathCli, 'workspace', '--silent', '--version', '4.0.0', '--pack-destination', 'dist'],
      { cwd: fixture.pathDirectoryWorkspace, reject: false },
    )

    assert.equal(result.exitCode, 1)

    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/good')),
      '0.0.0',
    )
    assert.equal(
      await readVersion(path.join(fixture.pathDirectoryWorkspace, 'packages/broken')),
      '0.0.0',
    )

    const pathArchive = path.join(
      fixture.pathDirectoryWorkspace,
      'dist/fixture-workspace-failure-root-4.0.0.tgz',
    )

    assert.equal(await fileExists(pathArchive), false)

    const filesAfter = await listFilesRelative(fixture.pathDirectoryWorkspace)

    assert.deepEqual(
      filesAfter,
      [...filesBefore, 'packages/good/lib/fixture-failure-good-4.0.0.tgz'].sort(),
    )
  },
)

// --- Extract conformance: scenario 3 (workspace extract) ---

it(
  'workspace extract produces files at destination root without package/ prefix',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-basic' })
    cleanups.add(fixture.cleanup)

    await execa(
      'node',
      [
        pathCli,
        'workspace',
        '--silent',
        '--version',
        '1.2.3',
        '--extract',
        '--pack-destination',
        'dist/workspace',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const extracted = await listFilesRelative(
      path.join(fixture.pathDirectoryWorkspace, 'dist/workspace'),
    )

    // Workspace structure at root — no extra package/ prefix
    assert.equal(extracted.includes('pnpm-lock.yaml'), true)
    assert.equal(extracted.includes('packages/app/package.json'), true)
    assert.equal(extracted.includes('packages/lib/package.json'), true)
    assert.equal(
      extracted.some((f) => f.startsWith('package/')),
      false,
    )
  },
)

// --- Workspace README redaction tests ---

it(
  'workspace default redacts README content in workspace and per-package artifacts',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-basic' })
    cleanups.add(fixture.cleanup)

    await execa(
      'node',
      [
        pathCli,
        'workspace',
        '--silent',
        '--version',
        '1.2.3',
        '--extract',
        '--pack-destination',
        'dist/workspace',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const extractRoot = path.join(fixture.pathDirectoryWorkspace, 'dist/workspace')

    // Workspace root README redacted
    const workspaceReadme = await readFile(path.join(extractRoot, 'README.md'), 'utf8')
    assert.equal(workspaceReadme, '')

    // Per-package READMEs redacted
    const appReadme = await readFile(path.join(extractRoot, 'packages/app/README.md'), 'utf8')
    assert.equal(appReadme, '')

    const libraryReadme = await readFile(path.join(extractRoot, 'packages/lib/README.md'), 'utf8')
    assert.equal(libraryReadme, '')

    // Source files unchanged
    const sourceReadme = await readFile(
      path.join(fixture.pathDirectoryWorkspace, 'README.md'),
      'utf8',
    )
    assert.ok(sourceReadme.length > 0)
  },
)

it(
  'workspace --no-redact-readme preserves README content',
  { retry: 2, timeout: 60_000 },
  async () => {
    const fixture = await prepareFixture({ fixture: 'workspace-basic' })
    cleanups.add(fixture.cleanup)

    await execa(
      'node',
      [
        pathCli,
        'workspace',
        '--silent',
        '--version',
        '1.2.3',
        '--no-redact-readme',
        '--extract',
        '--pack-destination',
        'dist/workspace',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const extractRoot = path.join(fixture.pathDirectoryWorkspace, 'dist/workspace')

    const workspaceReadme = await readFile(path.join(extractRoot, 'README.md'), 'utf8')
    assert.ok(workspaceReadme.includes('Workspace Basic'))

    const appReadme = await readFile(path.join(extractRoot, 'packages/app/README.md'), 'utf8')
    assert.ok(appReadme.includes('App'))

    const libraryReadme = await readFile(path.join(extractRoot, 'packages/lib/README.md'), 'utf8')
    assert.ok(libraryReadme.includes('Lib'))
  },
)
