import arg from 'arg'
import { execa } from 'execa'
import fse from 'fs-extra'
import { kebabCase } from 'lodash-es'
import assert from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isNativeError } from 'node:util/types'
import { argumentsCommon, argumentsCommonParse } from './arguments-common'
import { getNameArchive } from './utilities/get-name-archive'
import { getPathDirectoryPackage } from './utilities/get-path-directory-package'
import { getPathDirectoryWorkspace } from './utilities/get-path-directory-workspace'
import { readPackageJSON } from './utilities/read-package-json'

export async function packPackage() {
  let error: Error | undefined
  let pathDirectoryTemporary: string | undefined

  const arguments_ = arg({
    '--extract': Boolean,
    '--no-cleanup': Boolean,
    '--skip-workspace-root': Boolean,
    '--temporary-directory': String,
    ...argumentsCommon,
  })

  const options = {
    ...argumentsCommonParse(arguments_),
    cleanup: arguments_['--no-cleanup'] !== true,
    extract: arguments_['--extract'] === true,
    skipWorkspaceRoot: arguments_['--skip-workspace-root'] === true,
    temporaryDirectory: arguments_['--temporary-directory'],
  }

  const pathDirectoryPackage = await getPathDirectoryPackage(process.cwd())
  const pathDirectoryRoot =
    (await getPathDirectoryWorkspace(pathDirectoryPackage)) ?? pathDirectoryPackage

  process.chdir(pathDirectoryPackage)

  const pathDirectoryDestination = path.resolve(pathDirectoryPackage, options.packDestination)

  const pathDirectoryPackageRelative = path.relative(pathDirectoryRoot, pathDirectoryPackage)

  const isRoot = pathDirectoryPackageRelative === ''
  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = await readPackageJSON(pathDirectoryPackage)

  await writeFile(
    pathPackageJSON,
    JSON.stringify(Object.assign(packageJSON, { version: options.version }), null, 2),
  )

  try {
    if (typeof packageJSON.scripts?.build === 'string' && options.build) {
      await execa('pnpm', ['run', 'build'], {
        stdio: 'inherit',
      })
    }

    pathDirectoryTemporary =
      typeof options.temporaryDirectory === 'string'
        ? path.resolve(pathDirectoryPackage, options.temporaryDirectory)
        : await mkdtemp(path.join(os.tmpdir(), 'pnpm-pack'))

    const pathDirectoryContext = path.join(pathDirectoryTemporary, 'package')

    // https://github.com/pnpm/pnpm/blob/6caec8109b563fd27ad262ce06a1f587cebbc044/releasing/plugin-commands-publishing/src/pack.ts#L98C1-L98C100
    const nameArchive = getNameArchive({ name: packageJSON.name, version: options.version })
    const pathFileArchive = path.join(pathDirectoryTemporary, nameArchive)

    await execa('pnpm', ['pack', '--pack-destination', pathDirectoryTemporary], {
      stdio: 'inherit',
    })
    assert(await fse.exists(pathFileArchive), `${pathFileArchive}: No such file`)
    const pathDirectoryPackageContext = path.join(
      pathDirectoryContext,
      pathDirectoryPackageRelative,
    )
    await fse.mkdirp(pathDirectoryPackageContext)

    await execa(
      'tar',
      ['-xf', pathFileArchive, '--strip-components=1', '-C', pathDirectoryPackageContext],
      {
        stdio: 'inherit',
      },
    )

    if (options.deployment) {
      const pathDirectoryDeployment = path.join(
        pathDirectoryTemporary,
        kebabCase(`${nameArchive}-deployment`),
      )

      await execa(
        'pnpm',
        [
          'deploy',
          ...[
            options.development ? '--dev' : undefined,
            options.optional ? undefined : '--no-optional',
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
        await fse.move(pathNodeModules, path.join(pathDirectoryPackageContext, 'node_modules'))
      }

      await execa(
        'tar',
        ['-czf', pathFileArchive, '--strip-components=1', '-C', pathDirectoryTemporary, 'package'],
        {
          stdio: 'inherit',
        },
      )
    }

    if (isRoot && options.skipWorkspaceRoot) {
      await fse.remove(pathFileArchive)
    } else {
      await fse.mkdirp(pathDirectoryPackageContext)
      if (options.extract) {
        await fse.emptydir(pathDirectoryDestination)

        await execa(
          'tar',
          ['-xf', pathFileArchive, '--strip-components=1', '-C', pathDirectoryDestination],
          {
            stdio: 'inherit',
          },
        )
      } else {
        await fse.move(pathFileArchive, path.join(pathDirectoryDestination, nameArchive), {
          overwrite: true,
        })
      }
    }
  } catch (error_) {
    error = isNativeError(error_) ? error_ : new Error('Unknown Error')

    console.log(error)
  }

  if (options.cleanup) {
    await writeFile(
      pathPackageJSON,
      JSON.stringify(Object.assign(packageJSON, { version: '0.0.0' }), null, 2).concat('\n'),
    )

    if (typeof pathDirectoryTemporary === 'string') {
      await fse.remove(pathDirectoryTemporary)
    }
  }

  return error
}
