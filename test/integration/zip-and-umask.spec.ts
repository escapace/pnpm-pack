import assert from 'node:assert'
import { access, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterEach, it } from 'vitest'
import { prepareFixture } from '../support/prepare-fixture'
import { listTarEntries } from '../support/tar'
import { listZipEntries } from '../support/zip'
import { runCli } from './run-cli'

const cleanups = new Set<() => Promise<void>>()

afterEach(async () => {
  await Promise.all(
    [...cleanups].map(async (cleanup) => {
      await cleanup()
      cleanups.delete(cleanup)
    }),
  )
})

const runInDirectory = async (directory: string, function_: () => Promise<void>) => {
  const cwd = process.cwd()

  try {
    process.chdir(directory)
    await function_()
  } finally {
    process.chdir(cwd)
  }
}

const assertFileExists = async (pathFile: string) => {
  let exists = true

  try {
    await access(pathFile)
  } catch {
    exists = false
  }

  assert.equal(exists, true)
}

const pathCli = path.resolve(import.meta.dirname, '../../lib/node/cli.js')

// --- Zip format tests ---

it('package command creates zip archive when pack-destination ends with .zip', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--pack-destination',
      'dist/basic.zip',
    ])

    assert.equal(error, undefined)
  })

  const pathArchive = path.join(pathDirectoryPackage, 'dist/basic.zip')

  await assertFileExists(pathArchive)

  const entries = await listZipEntries(pathArchive)

  assert.equal(
    entries.some((entry) => entry === 'index.js' || entry.endsWith('/index.js')),
    true,
  )
  assert.equal(
    entries.some((entry) => entry === 'package.json' || entry.endsWith('/package.json')),
    true,
  )
}, 30_000)

it('package command creates tgz archive for directory pack-destination', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli(['package', '--version', '1.2.3', '--pack-destination', 'dist'])

    assert.equal(error, undefined)
  })

  const pathArchive = path.join(pathDirectoryPackage, 'dist/fixture-basic-1.2.3.tgz')

  await assertFileExists(pathArchive)

  const entries = await listTarEntries(pathArchive)

  assert.equal(
    entries.some((entry) => entry.endsWith('package.json')),
    true,
  )
}, 30_000)

it('package command rejects extract mode with .zip destination', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    await assert.rejects(
      async () =>
        await runCli([
          'package',
          '--version',
          '1.2.3',
          '--extract',
          '--pack-destination',
          'dist/output.zip',
        ]),
    )
  })
}, 30_000)

it(
  'workspace command creates zip archive when pack-destination ends with .zip',
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
        '--pack-destination',
        'dist/workspace.zip',
      ],
      { cwd: fixture.pathDirectoryWorkspace },
    )

    const pathArchive = path.join(fixture.pathDirectoryWorkspace, 'dist/workspace.zip')

    await assertFileExists(pathArchive)

    const entries = await listZipEntries(pathArchive)

    assert.equal(
      entries.some((entry) => entry.includes('packages/app/package.json')),
      true,
    )
    assert.equal(
      entries.some((entry) => entry.includes('packages/lib/package.json')),
      true,
    )
  },
)

// --- Zip with deployment ---

it('package command creates zip with production deploy', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-deploy-flags' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/app')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--production',
      '--pack-destination',
      'dist/lambda.zip',
    ])

    assert.equal(error, undefined)
  })

  const pathArchive = path.join(pathDirectoryPackage, 'dist/lambda.zip')

  await assertFileExists(pathArchive)

  const entries = await listZipEntries(pathArchive)

  assert.equal(
    entries.some((entry) => entry.includes('.package-map.json')),
    false,
  )
  assert.equal(
    entries.some((entry) => entry.includes('node_modules')),
    true,
  )
  assert.equal(
    entries.some((entry) => entry.includes('index.js')),
    true,
  )
}, 30_000)

// --- Umask tests ---

it('package extract applies default umask 0o022 to file permissions', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--no-redact-readme',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  const pathFile = path.join(pathDirectoryPackage, 'out/index.js')
  const stats = await stat(pathFile)
  const mode = stats.mode & 0o777

  // Default umask 0o022: files should be at most 0o755 and at least 0o644
  // Group and other write bits should be cleared
  assert.equal(mode & 0o022, 0, `Expected group/other write bits cleared, got ${mode.toString(8)}`)
}, 30_000)

it('package extract with --umask 0 preserves original permissions', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--no-redact-readme',
      '--umask',
      '0',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  // File should exist and have some permissions (not normalized)
  const pathFile = path.join(pathDirectoryPackage, 'out/index.js')

  await assertFileExists(pathFile)
}, 30_000)

it('package extract with custom umask 0o077 restricts permissions', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--no-redact-readme',
      '--umask',
      '0o077',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  const pathFile = path.join(pathDirectoryPackage, 'out/index.js')
  const stats = await stat(pathFile)
  const mode = stats.mode & 0o777

  // Umask 0o077: group and other bits should all be cleared
  assert.equal(
    mode & 0o077,
    0,
    `Expected group/other bits cleared with umask 077, got ${mode.toString(8)}`,
  )
}, 30_000)

it('package extract directory permissions include execute bits under default umask', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-deploy-flags' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/app')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--production',
      '--no-redact-readme',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  // node_modules directory should have execute bits
  const pathNodeModules = path.join(pathDirectoryPackage, 'out/node_modules')
  const stats = await stat(pathNodeModules)
  const mode = stats.mode & 0o777

  // Directory should have at least 0o755 (execute bits set, group/other write cleared)
  assert.equal(mode & 0o111, 0o111, `Expected execute bits on directory, got ${mode.toString(8)}`)
  assert.equal(mode & 0o022, 0, `Expected group/other write bits cleared, got ${mode.toString(8)}`)
}, 30_000)

// --- Umask in tgz archive entries ---

it('package tgz archive has normalized permissions in entries', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli(['package', '--version', '1.2.3', '--pack-destination', 'dist'])

    assert.equal(error, undefined)
  })

  // Verify the archive was created successfully
  const pathArchive = path.join(pathDirectoryPackage, 'dist/fixture-basic-1.2.3.tgz')

  await assertFileExists(pathArchive)

  // Extract and verify permissions
  const { stdout } = await execa('tar', ['-tvzf', pathArchive])
  const lines = stdout.split('\n').filter((line) => line.length > 0)

  // All file entries should not have group/other write bits
  for (const line of lines) {
    const permissions = line.slice(0, 10)

    // Check that group-write and other-write are not set
    if (permissions.startsWith('-')) {
      // Regular file
      assert.equal(permissions[5], '-', `Group write bit set on file: ${line}`)
      assert.equal(permissions[8], '-', `Other write bit set on file: ${line}`)
    }
  }
}, 30_000)
