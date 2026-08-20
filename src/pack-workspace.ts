import { readWantedLockfileAndAutofixConflicts, writeWantedLockfile } from '@pnpm/lockfile-file'
import arg from 'arg'
import { execa } from 'execa'
import fse from 'fs-extra'
import { mapValues } from 'es-toolkit/compat'
import assert from 'node:assert'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { isNativeError } from 'node:util/types'
import { argumentsCommon, argumentsCommonParse } from './arguments-common'
import { createArchive } from './utilities/create-archive'
import { getNameArchive } from './utilities/get-name-archive'
import { getPathDirectoryWorkspace } from './utilities/get-path-directory-workspace'
import { normalizePathDirectoryDestination } from './utilities/normalize-path-directory-destination'
import { removePnpmPackageMapFiles } from './utilities/prepare-deployment-node-modules'
import { normalizePermissionsRecursive } from './utilities/normalize-permissions'
import { readPackageJSON } from './utilities/read-package-json'
import { getExecaStdio } from './utilities/get-execa-stdio'
import { redactReadmeLikeFile } from './utilities/redact-readme-like-file'

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

  const stdio = getExecaStdio(options.silent)

  const packageJSON = await readPackageJSON(pathDirectoryWorkspace)
  const filenameArchiveDefault = getNameArchive({
    name: packageJSON.name,
    version: options.version,
  })

  const { format, pathDirectoryDestination, pathFileDestinationArchive } =
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

  const pathCliModule = path.join(import.meta.dirname, 'cli.js')

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
    pathCliModule,
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
        stdio,
      },
    )

    await execa('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
      cwd: pathDirectoryWorkspace,
      stdio,
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
        options.redactReadme ? undefined : '--no-redact-readme',
        options.verbose ? '--verbose' : '--silent',
        options.extract ? '--extract' : undefined,
        '--umask',
        `0o${options.umask.toString(8)}`,
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
        stdio,
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

    if (options.redactReadme) {
      await redactReadmeLikeFile(pathDirectoryTemporaryContext)

      // Root and package processing run concurrently via pnpm exec.
      // The root's pnpm pack extraction can overwrite per-package redacted
      // README content. Re-apply redaction here deterministically after all
      // package processing is complete.
      for (const importerPath of Object.keys(lockfile.importers)) {
        if (importerPath === '.') continue

        const pathImporter = path.join(pathDirectoryTemporaryContext, importerPath)

        if (await fse.exists(pathImporter)) {
          await redactReadmeLikeFile(pathImporter)
        }
      }
    }

    await removePnpmPackageMapFiles(pathDirectoryTemporaryContext)

    await createArchive({
      entryPrefix: 'package',
      format: 'tgz',
      outputPath: pathFileTemporaryArchive,
      sourceDirectory: pathDirectoryTemporaryContext,
      umask: options.umask,
    })

    assert(await fse.exists(pathFileTemporaryArchive), `${pathFileTemporaryArchive}: No such file`)

    await fse.remove(pathDirectoryTemporaryContext)

    if (options.extract) {
      await fse.emptydir(pathDirectoryDestination)

      await execa(
        'tar',
        ['-xzf', pathFileTemporaryArchive, '--strip-components=1', '-C', pathDirectoryDestination],
        {
          stdio,
        },
      )

      await normalizePermissionsRecursive(pathDirectoryDestination, options.umask)
    } else if (format === 'zip') {
      // For zip output, we need to re-extract the tgz to a temp directory
      // and create the zip from the extracted contents.
      const pathDirectoryZipSource = path.join(pathDirectoryTemporary, '_zip-source')
      await fse.mkdirp(pathDirectoryZipSource)

      await execa(
        'tar',
        ['-xzf', pathFileTemporaryArchive, '--strip-components=1', '-C', pathDirectoryZipSource],
        {
          stdio,
        },
      )

      await fse.mkdirp(pathDirectoryDestination)

      await createArchive({
        entryPrefix: '',
        format: 'zip',
        outputPath: pathFileDestinationArchive,
        sourceDirectory: pathDirectoryZipSource,
        umask: options.umask,
      })

      await fse.remove(pathDirectoryZipSource)
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
      stdio,
    },
  )

  await execa('pnpm', ['install', '--lockfile-only', '--ignore-scripts'], {
    cwd: pathDirectoryWorkspace,
    stdio,
  })

  if (typeof pathDirectoryTemporary === 'string') {
    await fse.remove(pathDirectoryTemporary)
  }

  return error
}
