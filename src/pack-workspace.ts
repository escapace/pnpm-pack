import { readWantedLockfileAndAutofixConflicts, writeWantedLockfile } from '@pnpm/lockfile-file'
import arg from 'arg'
import { execa } from 'execa'
import fse from 'fs-extra'
import { mapValues } from 'lodash-es'
import assert from 'node:assert'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isNativeError } from 'node:util/types'
import { argumentsCommon, argumentsCommonParse } from './arguments-common'
import { getNameArchive } from './utilities/get-name-archive'
import { getPathDirectoryWorkspace } from './utilities/get-path-directory-workspace'
import { normalizePathDirectoryDestination } from './utilities/normalize-path-directory-destination'
import { readPackageJSON } from './utilities/read-package-json'

export async function packWorkspace() {
  let error: Error | undefined
  let pathDirectoryTemporary: string | undefined

  const pathDirectoryCurrent = process.cwd()

  const pathDirectoryWorkspace = await getPathDirectoryWorkspace(pathDirectoryCurrent)

  assert.ok(pathDirectoryWorkspace !== undefined)

  process.chdir(pathDirectoryWorkspace)

  // https://pnpm.io/filtering
  const arguments_ = arg(
    {
      '--changed-files-ignore-pattern': String,
      '--filter': [String],
      '--filter-prod': [String],
      '--test-pattern': String,
      '--workspace-concurrency': Number,
      ...argumentsCommon,
    },
    { permissive: false },
  )

  const options = {
    ...argumentsCommonParse(arguments_),
  }

  const packageJSON = await readPackageJSON(pathDirectoryWorkspace)
  const filenameArchiveDefault = getNameArchive({
    name: packageJSON.name,
    version: options.version,
  })

  const { pathDirectoryDestination, pathFileDestinationArchive } =
    normalizePathDirectoryDestination({
      extract: options.extract,
      filenameArchiveDefault,
      packDestination: options.packDestination,
      pathDirectoryCurrent,
    })

  const filters = [
    ...(Array.isArray(arguments_['--filter-prod'])
      ? arguments_['--filter-prod'].flatMap((value) => ['--filter-prod', value])
      : []),
    ...(Array.isArray(arguments_['--filter'])
      ? arguments_['--filter'].flatMap((value) => ['--filter', value])
      : []),
  ].filter((value): value is string => typeof value === 'string')

  const pnpmExecArguments = [
    '--fail-if-no-match',
    '--workspace-root',
    typeof arguments_['--workspace-concurrency'] === 'number'
      ? `--workspace-concurrency=${arguments_['--workspace-concurrency']}`
      : undefined,
    typeof arguments_['--test-pattern'] === 'string'
      ? `--test-pattern=${arguments_['--test-pattern']}`
      : undefined,
    typeof arguments_['--changed-files-ignore-pattern'] === 'string'
      ? `--changed-files-ignore-pattern=${arguments_['--changed-files-ignore-pattern']}`
      : undefined,
    ...(filters.length === 0 ? ['--filter', '*'] : filters),
    'exec',
    'node',
    path.join(import.meta.dirname, 'cli.js'),
  ]

  try {
    pathDirectoryTemporary = await mkdtemp(path.join(os.tmpdir(), 'pnpm-pack'))

    assert(typeof pathDirectoryTemporary === 'string')

    await execa(
      'pnpm',
      [...pnpmExecArguments, 'update-version', '--version', options.version].filter(
        (value): value is string => typeof value === 'string',
      ),
      {
        cwd: pathDirectoryWorkspace,
        stdio: 'inherit',
      },
    )

    await execa('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
      cwd: pathDirectoryWorkspace,
      stdio: 'inherit',
    })

    await execa(
      'pnpm',
      [
        ...pnpmExecArguments,
        'package',
        options.build ? undefined : '--no-build',
        options.development ? '--development' : undefined,
        options.noOptional ? '--no-optional' : undefined,
        options.production ? '--production' : undefined,
        options.extract ? '--extract' : undefined,
        ...[
          options.packDestination === undefined
            ? []
            : ['--pack-destination', options.packDestination],
        ],
        '--skip-workspace-root',
        '--no-cleanup',
        '--temporary-directory',
        pathDirectoryTemporary,
        '--version',
        options.version,
      ].filter((value): value is string => typeof value === 'string'),
      {
        cwd: pathDirectoryWorkspace,
        stdio: 'inherit',
      },
    )

    const pathDirectoryTemporaryContext = path.join(pathDirectoryTemporary, 'package')
    const pathFileTemporaryArchive = path.join(pathDirectoryTemporary, filenameArchiveDefault)

    assert(
      await fse.exists(pathDirectoryTemporaryContext),
      `${pathDirectoryTemporaryContext}: No such directory`,
    )

    const { lockfile } = await readWantedLockfileAndAutofixConflicts(pathDirectoryWorkspace, {
      ignoreIncompatible: false,
    })

    assert(lockfile !== null)

    const importers = mapValues(lockfile.importers, (value) => ({
      ...value,
      specifiers: mapValues(value.specifiers, (value) => {
        if (value.startsWith('workspace:')) {
          return options.version
        }

        return value
      }),
    }))

    lockfile.importers = importers

    await writeWantedLockfile(pathDirectoryTemporaryContext, lockfile)

    await execa(
      'tar',
      ['-czf', pathFileTemporaryArchive, '-C', pathDirectoryTemporary, 'package'],
      {
        cwd: pathDirectoryWorkspace,
        stdio: 'inherit',
      },
    )

    assert(await fse.exists(pathFileTemporaryArchive), `${pathFileTemporaryArchive}: No such file`)

    await fse.remove(pathDirectoryTemporaryContext)

    if (options.extract) {
      await fse.emptydir(pathDirectoryDestination)

      await execa(
        'tar',
        ['-xf', pathFileTemporaryArchive, '--strip-components=1', '-C', pathDirectoryDestination],
        {
          stdio: 'inherit',
        },
      )
    } else {
      await fse.mkdirp(pathDirectoryDestination)
      await fse.move(pathFileTemporaryArchive, pathFileDestinationArchive, {
        overwrite: true,
      })
    }
  } catch (error_) {
    error = isNativeError(error_) ? error_ : new Error('Unknown Error')
  }

  await execa(
    'pnpm',
    [...pnpmExecArguments, 'cleanup'].filter((value): value is string => typeof value === 'string'),
    {
      cwd: pathDirectoryWorkspace,
      stdio: 'inherit',
    },
  )

  await execa('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
    cwd: pathDirectoryWorkspace,
    stdio: 'inherit',
  })

  if (typeof pathDirectoryTemporary === 'string') {
    await fse.remove(pathDirectoryTemporary)
  }

  return error
}
