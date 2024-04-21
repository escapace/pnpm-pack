import arg from 'arg'
import { execa } from 'execa'
import fse from 'fs-extra'
import assert from 'node:assert'
import { mkdtemp } from 'node:fs/promises'
import { isNativeError } from 'node:util/types'
import os from 'node:os'
import path from 'node:path'
import semver from 'semver'
import { fileURLToPath } from 'node:url'
import { getNameArchive } from './utilities/get-name-archive'
import { getPathDirectoryWorkspace } from './utilities/get-path-directory-workspace'
import { readPackageJSON } from './utilities/read-package-json'
import {
  readWantedLockfileAndAutofixConflicts,
  writeWantedLockfile
} from '@pnpm/lockfile-file'
import { mapValues } from 'lodash-es'

export async function packWorkspace() {
  let error: Error | undefined
  let pathDirectoryTemporary: string | undefined

  const cwd = await getPathDirectoryWorkspace(process.cwd())

  assert.ok(cwd !== undefined)

  process.chdir(cwd)

  // https://pnpm.io/filtering
  const options = arg(
    {
      '--changed-files-ignore-pattern': String,
      '--filter': [String],
      '--filter-prod': [String],
      '--pack-destination': String,
      '--test-pattern': String,
      '--version': String,
      '--workspace-concurrency': Number
    },
    { permissive: false }
  )

  const version = options['--version'] ?? '0.0.0'
  assert(typeof semver.valid(version) === 'string')

  const pathDirectoryDestination = path.resolve(
    cwd,
    options['--pack-destination'] ?? 'lib'
  )

  const packageJSON = await readPackageJSON(cwd)
  const nameArchive = getNameArchive({ name: packageJSON.name, version })

  const filters = [
    ...(Array.isArray(options['--filter-prod'])
      ? options['--filter-prod'].flatMap((value) => ['--filter-prod', value])
      : []),
    ...(Array.isArray(options['--filter'])
      ? options['--filter'].flatMap((value) => ['--filter', value])
      : [])
  ].filter((value): value is string => typeof value === 'string')

  const pnpmExecArguments = [
    '--fail-if-no-match',
    '--workspace-root',
    typeof options['--workspace-concurrency'] === 'number'
      ? `--workspace-concurrency=${options['--workspace-concurrency']}`
      : undefined,
    typeof options['--test-pattern'] === 'string'
      ? `--test-pattern=${options['--test-pattern']}`
      : undefined,
    typeof options['--changed-files-ignore-pattern'] === 'string'
      ? `--changed-files-ignore-pattern=${options['--changed-files-ignore-pattern']}`
      : undefined,
    ...(filters.length === 0 ? ['--filter', '*'] : filters),
    'exec',
    'node',
    fileURLToPath(import.meta.url)
  ]

  try {
    pathDirectoryTemporary = await mkdtemp(path.join(os.tmpdir(), 'pnpm-pack'))

    assert(typeof pathDirectoryTemporary === 'string')

    await execa(
      'pnpm',
      [
        ...pnpmExecArguments,
        'package',
        '--skip-workspace-root',
        '--no-cleanup',
        '--temporary-directory',
        pathDirectoryTemporary,
        '--version',
        version
      ].filter((value): value is string => typeof value === 'string'),
      {
        cwd,
        stdio: 'inherit'
      }
    )

    const directoryPathContext = path.join(pathDirectoryTemporary, 'package')
    const pathFileArchive = path.join(pathDirectoryTemporary, nameArchive)

    assert(fse.exists(directoryPathContext))
    assert(fse.exists(pathFileArchive))

    await execa('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
      cwd,
      stdio: 'inherit'
    })

    const { lockfile } = await readWantedLockfileAndAutofixConflicts(
      directoryPathContext,
      { ignoreIncompatible: false }
    )

    assert(lockfile !== null)

    const importers = mapValues(lockfile.importers, (value) => ({
      ...value,
      specifiers: mapValues(value.specifiers, (value) => {
        if (value.startsWith('workspace:')) {
          return version
        }

        return value
      })
    }))

    lockfile.importers = importers

    await writeWantedLockfile(directoryPathContext, lockfile)

    await execa(
      'tar',
      ['-czf', pathFileArchive, '-C', pathDirectoryTemporary, 'package'],
      {
        cwd,
        stdio: 'inherit'
      }
    )

    await fse.remove(directoryPathContext)
    await fse.mkdirp(pathDirectoryDestination)
    await fse.move(
      pathFileArchive,
      path.join(pathDirectoryDestination, nameArchive),
      { overwrite: true }
    )
  } catch (error_) {
    error = isNativeError(error_) ? error_ : new Error('Unknown Error')
  }

  await execa(
    'pnpm',
    [...pnpmExecArguments, 'cleanup'].filter(
      (value): value is string => typeof value === 'string'
    ),
    {
      cwd,
      stdio: 'inherit'
    }
  )

  await execa('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
    cwd,
    stdio: 'inherit'
  })

  if (typeof pathDirectoryTemporary === 'string') {
    await fse.remove(pathDirectoryTemporary)
  }

  return error
}
