import assert from 'node:assert'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, test } from 'vitest'
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

test('workspace command packages all packages by default filter', async () => {
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
}, 60_000)

test('workspace command honors filter-prod by excluding dev dependency projects', async () => {
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
}, 60_000)

test('workspace command accepts test-pattern and changed-files-ignore-pattern flags', async () => {
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
}, 60_000)

test('workspace command failure still performs cleanup and leaves no extra files', async () => {
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
}, 60_000)
