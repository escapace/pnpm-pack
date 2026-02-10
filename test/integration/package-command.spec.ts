import assert from 'node:assert'
import { access, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, test } from 'vitest'
import { prepareFixture } from '../support/prepare-fixture'
import { listFilesRelative } from '../support/list-files-relative'
import { listTarEntries } from '../support/tar'
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

const assertPackageVersion = async (pathDirectoryPackage: string, version: string) => {
  const contentPackageJSON = await readFile(path.join(pathDirectoryPackage, 'package.json'), 'utf8')
  const packageJSON = JSON.parse(contentPackageJSON) as { version: string }

  assert.equal(packageJSON.version, version)
}

const hasTarEntrySuffix = (entries: string[], suffix: string) =>
  entries.some((value) => value.endsWith(suffix))

const filesWorkspaceDeployBase = [
  'node_modules/.pnpm-workspace-state-v1.json',
  'node_modules/.pnpm/lock.yaml',
  'package.json',
  'packages/app/index.js',
  'packages/app/node_modules/@fixture/dev-dep',
  'packages/app/node_modules/@fixture/optional-dep',
  'packages/app/node_modules/@fixture/prod-dep',
  'packages/app/package.json',
  'packages/dev-dep/index.js',
  'packages/dev-dep/package.json',
  'packages/optional-dep/index.js',
  'packages/optional-dep/package.json',
  'packages/prod-dep/index.js',
  'packages/prod-dep/package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
] as const

test('package command creates archive and restores package version', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli(['package', '--version', '1.2.3', '--pack-destination', 'dist'])

    assert.equal(error, undefined)
  })

  await assertFileExists(path.join(pathDirectoryPackage, 'dist/fixture-basic-1.2.3.tgz'))
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/basic/README.md',
    'packages/basic/dist/fixture-basic-1.2.3.tgz',
    'packages/basic/index.js',
    'packages/basic/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command supports extract mode', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  await assertFileExists(path.join(pathDirectoryPackage, 'out/index.js'))
  await assertFileExists(path.join(pathDirectoryPackage, 'out/package.json'))

  const contentExtractedPackageJSON = await readFile(
    path.join(pathDirectoryPackage, 'out/package.json'),
    'utf8',
  )
  const extractedPackageJSON = JSON.parse(contentExtractedPackageJSON) as { version: string }

  assert.equal(extractedPackageJSON.version, '1.2.3')
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/basic/README.md',
    'packages/basic/index.js',
    'packages/basic/out/README.md',
    'packages/basic/out/index.js',
    'packages/basic/out/package.json',
    'packages/basic/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command supports explicit archive destination file path', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--pack-destination',
      'archive/custom.tgz',
    ])

    assert.equal(error, undefined)
  })

  await assertFileExists(path.join(pathDirectoryPackage, 'archive/custom.tgz'))
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/basic/README.md',
    'packages/basic/archive/custom.tgz',
    'packages/basic/index.js',
    'packages/basic/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command preserves stamped version when no-cleanup is set', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--pack-destination',
      'dist',
      '--no-cleanup',
    ])

    assert.equal(error, undefined)
  })

  await assertFileExists(path.join(pathDirectoryPackage, 'dist/fixture-basic-1.2.3.tgz'))
  await assertPackageVersion(pathDirectoryPackage, '1.2.3')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/basic/README.md',
    'packages/basic/dist/fixture-basic-1.2.3.tgz',
    'packages/basic/index.js',
    'packages/basic/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command runs build script by default', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-package-build' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/buildable')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli(['package', '--version', '1.2.3', '--pack-destination', 'dist'])

    assert.equal(error, undefined)
  })

  await assertFileExists(path.join(pathDirectoryPackage, 'built.txt'))
  await assertFileExists(path.join(pathDirectoryPackage, 'dist/fixture-buildable-1.2.3.tgz'))
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/buildable/built.txt',
    'packages/buildable/dist/fixture-buildable-1.2.3.tgz',
    'packages/buildable/index.js',
    'packages/buildable/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command skips build script when no-build is set', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-package-build' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/buildable')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--pack-destination',
      'dist',
      '--no-build',
    ])

    assert.equal(error, undefined)
  })

  await assertFileExists(path.join(pathDirectoryPackage, 'dist/fixture-buildable-1.2.3.tgz'))
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/buildable/dist/fixture-buildable-1.2.3.tgz',
    'packages/buildable/index.js',
    'packages/buildable/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command rejects absolute pack destination path', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')
  const pathDirectoryAbsolute = path.resolve(fixture.pathDirectoryWorkspace, 'absolute-destination')

  await runInDirectory(pathDirectoryPackage, async () => {
    await assert.rejects(
      async () =>
        await runCli([
          'package',
          '--version',
          '1.2.3',
          '--pack-destination',
          pathDirectoryAbsolute,
        ]),
    )
  })

  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/basic/README.md',
    'packages/basic/index.js',
    'packages/basic/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command rejects extract mode with archive destination path', async () => {
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
          'dist/custom.tgz',
        ]),
    )
  })

  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(files, [
    'node_modules/.pnpm-workspace-state-v1.json',
    'package.json',
    'packages/basic/README.md',
    'packages/basic/index.js',
    'packages/basic/package.json',
    'pnpm-lock.yaml',
    'pnpm-workspace.yaml',
  ])
}, 30_000)

test('package command with production deploy includes production and optional deps only', async () => {
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
      'dist',
    ])

    assert.equal(error, undefined)
  })

  const pathArchive = path.join(pathDirectoryPackage, 'dist/fixture-app-1.2.3.tgz')

  await assertFileExists(pathArchive)
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const entries = await listTarEntries(pathArchive)

  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/prod-dep/package.json'), true)
  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/optional-dep/package.json'), true)
  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/dev-dep/package.json'), false)

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(
    files,
    [...filesWorkspaceDeployBase, 'packages/app/dist/fixture-app-1.2.3.tgz'].sort(),
  )
}, 30_000)

test('package command with development deploy includes dev deps only', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-deploy-flags' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/app')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--development',
      '--pack-destination',
      'dist',
    ])

    assert.equal(error, undefined)
  })

  const pathArchive = path.join(pathDirectoryPackage, 'dist/fixture-app-1.2.3.tgz')

  await assertFileExists(pathArchive)
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const entries = await listTarEntries(pathArchive)

  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/dev-dep/package.json'), true)
  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/prod-dep/package.json'), false)
  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/optional-dep/package.json'), false)

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(
    files,
    [...filesWorkspaceDeployBase, 'packages/app/dist/fixture-app-1.2.3.tgz'].sort(),
  )
}, 30_000)

test('package command with production deploy and no-optional excludes optional deps', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-deploy-flags' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/app')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--production',
      '--no-optional',
      '--pack-destination',
      'dist',
    ])

    assert.equal(error, undefined)
  })

  const pathArchive = path.join(pathDirectoryPackage, 'dist/fixture-app-1.2.3.tgz')

  await assertFileExists(pathArchive)
  await assertPackageVersion(pathDirectoryPackage, '0.0.0')

  const entries = await listTarEntries(pathArchive)

  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/prod-dep/package.json'), true)
  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/optional-dep/package.json'), false)
  assert.equal(hasTarEntrySuffix(entries, 'node_modules/@fixture/dev-dep/package.json'), false)

  const files = await listFilesRelative(fixture.pathDirectoryWorkspace)

  assert.deepEqual(
    files,
    [...filesWorkspaceDeployBase, 'packages/app/dist/fixture-app-1.2.3.tgz'].sort(),
  )
}, 30_000)

// --- Extract conformance: scenario 1 (no repack trigger) ---

test('package extract without repack produces files at destination root', async () => {
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

  const extracted = await listFilesRelative(path.join(pathDirectoryPackage, 'out'))

  assert.deepEqual(extracted, ['README.md', 'index.js', 'package.json'])
}, 30_000)

// --- Extract conformance: scenario 2 (repack trigger — default redaction) ---

test('package extract with default redaction produces files at destination root', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  const extracted = await listFilesRelative(path.join(pathDirectoryPackage, 'out'))

  // Same shape as scenario 1 — no prefix drift
  assert.deepEqual(extracted, ['README.md', 'index.js', 'package.json'])

  // README content is redacted (empty)
  const readmeContent = await readFile(path.join(pathDirectoryPackage, 'out/README.md'), 'utf8')
  assert.equal(readmeContent, '')
}, 30_000)

// --- Extract conformance: scenario 2 variant (repack trigger — deployment) ---

test('package extract with production deploy produces files at destination root', async () => {
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

  // Files at destination root, not under packages/app/
  await assertFileExists(path.join(pathDirectoryPackage, 'out/index.js'))
  await assertFileExists(path.join(pathDirectoryPackage, 'out/package.json'))
  await assertFileExists(
    path.join(pathDirectoryPackage, 'out/node_modules/@fixture/prod-dep/package.json'),
  )

  const extracted = await listFilesRelative(path.join(pathDirectoryPackage, 'out'))

  assert.equal(
    extracted.some((f) => f.startsWith('packages/')),
    false,
  )
}, 30_000)

// --- README redaction tests ---

test('package default redacts README content in archive', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    const error = await runCli([
      'package',
      '--version',
      '1.2.3',
      '--extract',
      '--pack-destination',
      'out',
    ])

    assert.equal(error, undefined)
  })

  // Redacted: file exists but is empty
  const readmeContent = await readFile(path.join(pathDirectoryPackage, 'out/README.md'), 'utf8')
  assert.equal(readmeContent, '')

  // Source fixture unchanged
  const sourceReadme = await readFile(path.join(pathDirectoryPackage, 'README.md'), 'utf8')
  assert.ok(sourceReadme.length > 0)
}, 30_000)

test('package --no-redact-readme preserves README content', async () => {
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

  const readmeContent = await readFile(path.join(pathDirectoryPackage, 'out/README.md'), 'utf8')
  assert.ok(readmeContent.includes('Basic'))
}, 30_000)
