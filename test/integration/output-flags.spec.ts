import arg from 'arg'
import assert from 'node:assert'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, it } from 'vitest'
import { argumentsCommon, argumentsCommonParse } from '../../src/arguments-common'
import { prepareFixture } from '../support/prepare-fixture'

const cleanups = new Set<() => Promise<void>>()

const pathCli = path.resolve(import.meta.dirname, '../../lib/node/cli.js')
const buildOutputMarker = 'PNPM_PACK_BUILD_OUTPUT_MARKER'

const parseCommonArguments = (argv: string[]) =>
  argumentsCommonParse(arg(argumentsCommon, { argv }))

const setBuildScriptOutput = async (pathDirectoryPackage: string) => {
  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = JSON.parse(await readFile(pathPackageJSON, 'utf8')) as {
    scripts: { build: string }
  }

  packageJSON.scripts.build = `node -e "console.log('${buildOutputMarker}'); require('node:fs').writeFileSync('built.txt', 'built\\n')"`

  await writeFile(pathPackageJSON, `${JSON.stringify(packageJSON, undefined, 2)}\n`)
}

afterEach(async () => {
  await Promise.all(
    [...cleanups].map(async (cleanup) => {
      await cleanup()
      cleanups.delete(cleanup)
    }),
  )
})

it('common output flags default to silent and allow verbose to override silent', () => {
  assert.equal(parseCommonArguments([]).silent, true)
  assert.equal(parseCommonArguments([]).verbose, false)

  assert.equal(parseCommonArguments(['--silent']).silent, true)
  assert.equal(parseCommonArguments(['--silent']).verbose, false)

  assert.equal(parseCommonArguments(['--silent', '--verbose']).silent, false)
  assert.equal(parseCommonArguments(['--silent', '--verbose']).verbose, true)
})

it('package command suppresses child command output by default', { timeout: 30_000 }, async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-package-build' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/buildable')
  await setBuildScriptOutput(pathDirectoryPackage)

  const result = await execa(
    'node',
    [pathCli, 'package', '--version', '1.2.3', '--pack-destination', 'dist'],
    { cwd: pathDirectoryPackage },
  )

  assert.equal(`${result.stdout}\n${result.stderr}`.includes(buildOutputMarker), false)
})

it('package command shows child command output with verbose', { timeout: 30_000 }, async () => {
  const fixture = await prepareFixture({ fixture: 'workspace-package-build' })
  cleanups.add(fixture.cleanup)

  const pathDirectoryPackage = path.join(fixture.pathDirectoryWorkspace, 'packages/buildable')
  await setBuildScriptOutput(pathDirectoryPackage)

  const result = await execa(
    'node',
    [pathCli, 'package', '--verbose', '--version', '1.2.3', '--pack-destination', 'dist'],
    { cwd: pathDirectoryPackage },
  )

  assert.equal(`${result.stdout}\n${result.stderr}`.includes(buildOutputMarker), true)
})
