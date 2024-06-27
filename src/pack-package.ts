import arg from 'arg'
import { execa } from 'execa'
import fse from 'fs-extra'
import { kebabCase } from 'lodash-es'
import assert from 'node:assert'
import { mkdtemp } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isNativeError } from 'node:util/types'
import { argumentsCommon, argumentsCommonParse } from './arguments-common'
import { getNameArchive } from './utilities/get-name-archive'
import { getPathDirectoryPackage } from './utilities/get-path-directory-package'
import { getPathDirectoryWorkspace } from './utilities/get-path-directory-workspace'
import { normalizePathDirectoryDestination } from './utilities/normalize-path-directory-destination'
import { readPackageJSON } from './utilities/read-package-json'
import { writeFileJSON } from './utilities/write-file-json'

export async function packPackage() {
  let error: Error | undefined
  let pathDirectoryTemporary: string | undefined

  const arguments_ = arg({
    '--no-cleanup': Boolean,
    '--skip-workspace-root': Boolean,
    '--temporary-directory': String,
    ...argumentsCommon,
  })

  const pathDirectoryCurrent = process.cwd()
  const pathDirectoryPackage = await getPathDirectoryPackage(pathDirectoryCurrent)

  const options = {
    ...argumentsCommonParse(arguments_),
    cleanup: arguments_['--no-cleanup'] !== true,
    skipWorkspaceRoot: arguments_['--skip-workspace-root'] === true,
    temporaryDirectory: arguments_['--temporary-directory'],
  }

  const pathDirectoryRoot =
    (await getPathDirectoryWorkspace(pathDirectoryPackage)) ?? pathDirectoryPackage

  process.chdir(pathDirectoryPackage)

  const pathRelativeDirectoryPackageR = path.relative(pathDirectoryRoot, pathDirectoryPackage)

  const isRoot = pathRelativeDirectoryPackageR === ''
  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = await readPackageJSON(pathDirectoryPackage)

  // https://github.com/pnpm/pnpm/blob/6caec8109b563fd27ad262ce06a1f587cebbc044/releasing/plugin-commands-publishing/src/pack.ts#L98C1-L98C100
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

  await writeFileJSON(pathPackageJSON, Object.assign(packageJSON, { version: options.version }))

  try {
    if (
      typeof packageJSON.scripts?.build === 'string' &&
      options.build &&
      !(isRoot && options.skipWorkspaceRoot)
    ) {
      await execa('pnpm', ['run', 'build'], {
        stdio: 'inherit',
      })
    }

    pathDirectoryTemporary =
      typeof options.temporaryDirectory === 'string'
        ? path.resolve(pathDirectoryPackage, options.temporaryDirectory)
        : await mkdtemp(path.join(os.tmpdir(), 'pnpm-pack'))

    const pathDirectoryTemporaryContext = path.join(
      path.join(pathDirectoryTemporary, 'package'),
      pathRelativeDirectoryPackageR,
    )

    const pathFileTemporaryArchive = path.join(pathDirectoryTemporary, filenameArchiveDefault)

    await execa('pnpm', ['pack', '--pack-destination', pathDirectoryTemporary], {
      stdio: 'inherit',
    })
    assert(await fse.exists(pathFileTemporaryArchive), `${pathFileTemporaryArchive}: No such file`)
    await fse.mkdirp(pathDirectoryTemporaryContext)

    await execa(
      'tar',
      [
        '-xf',
        pathFileTemporaryArchive,
        '--strip-components=1',
        '-C',
        pathDirectoryTemporaryContext,
      ],
      {
        stdio: 'inherit',
      },
    )

    if (options.deployment) {
      const pathDirectoryDeployment = path.join(
        pathDirectoryTemporary,
        kebabCase(`${filenameArchiveDefault}-deployment`),
      )

      await execa(
        'pnpm',
        [
          'deploy',
          ...[
            options.development ? '--dev' : undefined,
            options.noOptional ? '--no-optional' : undefined,
            options.production ? '--prod' : undefined,
          ].filter((value): value is string => typeof value === 'string'),
          '--filter',
          '.',
          pathDirectoryDeployment,
        ],
        {
          stdio: 'inherit',
        },
      )

      const pathNodeModules = path.join(pathDirectoryDeployment, 'node_modules')

      if (await fse.exists(pathNodeModules)) {
        await fse.move(pathNodeModules, path.join(pathDirectoryTemporaryContext, 'node_modules'))
      }

      await execa(
        'tar',
        [
          '-czf',
          pathFileTemporaryArchive,
          '--strip-components=1',
          '-C',
          pathDirectoryTemporary,
          'package',
        ],
        {
          stdio: 'inherit',
        },
      )
    }

    if (isRoot && options.skipWorkspaceRoot) {
      await fse.remove(pathFileTemporaryArchive)
    } else {
      // await fse.mkdirp(pathDirectoryPackageContext)
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
    }
  } catch (error_) {
    error = isNativeError(error_) ? error_ : new Error('Unknown Error')

    console.log(error)
  }

  if (options.cleanup) {
    await writeFileJSON(pathPackageJSON, Object.assign(packageJSON, { version: '0.0.0' }))

    if (typeof pathDirectoryTemporary === 'string') {
      await fse.remove(pathDirectoryTemporary)
    }
  }

  return error
}
