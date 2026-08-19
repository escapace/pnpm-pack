import assert from 'node:assert'
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { afterEach, it } from 'vitest'
import { prepareFixture } from '../support/prepare-fixture'
import { listFilesRelative as listFilesRelativeRaw } from '../support/list-files-relative'
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

const listFilesRelative = async (directory: string) =>
  (await listFilesRelativeRaw(directory)).filter(
    (file) => file !== 'node_modules/.package-map.json',
  )

it('update-version updates nearest package from nested cwd', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')
  const pathDirectoryNested = path.join(pathDirectoryPackage, 'nested/deeper')

  await mkdir(pathDirectoryNested, { recursive: true })

  await runInDirectory(pathDirectoryNested, async () => {
    const error = await runCli(['update-version', '--version', '1.2.3'])
    assert.equal(error, undefined)
  })

  const contentPackageJSON = await readFile(path.join(pathDirectoryPackage, 'package.json'), 'utf8')
  const packageJSON = JSON.parse(contentPackageJSON) as { version: string }

  assert.equal(packageJSON.version, '1.2.3')

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
})

it('update-version rejects invalid semver and does not create extra files', async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-single-package' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/basic')

  await runInDirectory(pathDirectoryPackage, async () => {
    await assert.rejects(async () => await runCli(['update-version', '--version', 'not-semver']))
  })

  const contentPackageJSON = await readFile(path.join(pathDirectoryPackage, 'package.json'), 'utf8')
  const packageJSON = JSON.parse(contentPackageJSON) as { version: string }

  assert.equal(packageJSON.version, '0.0.0')

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
})
