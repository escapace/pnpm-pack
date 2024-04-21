import arg from 'arg'
import { execa } from 'execa'
import fse from 'fs-extra'
import assert from 'node:assert'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { isNativeError } from 'node:util/types'
import semver from 'semver'
import { getNameArchive } from './utilities/get-name-archive'
import { getPathDirectoryPackage } from './utilities/get-path-directory-package'
import { getPathDirectoryWorkspace } from './utilities/get-path-directory-workspace'
import { readPackageJSON } from './utilities/read-package-json'

export async function packPackage() {
  let error: Error | undefined
  let pathDirectoryTemporary: string | undefined

  const options = arg({
    '--no-cleanup': Boolean,
    '--pack-destination': String,
    '--skip-workspace-root': Boolean,
    '--temporary-directory': String,
    '--version': String
  })

  const cleanup = options['--no-cleanup'] !== true

  const pathDirectoryPackage = await getPathDirectoryPackage(process.cwd())
  const pathDirectoryRoot =
    (await getPathDirectoryWorkspace(pathDirectoryPackage)) ??
    pathDirectoryPackage

  process.chdir(pathDirectoryPackage)

  const pathDirectoryDestination = path.resolve(
    pathDirectoryPackage,
    options['--pack-destination'] ?? 'lib'
  )

  const pathDirectoryPackageRelative = path.relative(
    pathDirectoryRoot,
    pathDirectoryPackage
  )

  const isRoot = pathDirectoryPackageRelative === ''
  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = await readPackageJSON(pathDirectoryPackage)

  const version = options['--version'] ?? '0.0.0'

  assert(typeof semver.valid(version) === 'string')

  await writeFile(
    pathPackageJSON,
    JSON.stringify(Object.assign(packageJSON, { version }), null, 2)
  )

  try {
    pathDirectoryTemporary =
      typeof options['--temporary-directory'] === 'string'
        ? path.resolve(pathDirectoryPackage, options['--temporary-directory'])
        : await mkdtemp(path.join(os.tmpdir(), 'pnpm-pack'))

    const pathDirectoryContext = path.join(pathDirectoryTemporary, 'package')

    // https://github.com/pnpm/pnpm/blob/6caec8109b563fd27ad262ce06a1f587cebbc044/releasing/plugin-commands-publishing/src/pack.ts#L98C1-L98C100
    const nameArchive = getNameArchive({ name: packageJSON.name, version })
    const pathFileArchive = path.join(pathDirectoryTemporary, nameArchive)

    await execa(
      'pnpm',
      ['pack', '--pack-destination', pathDirectoryTemporary],
      {
        stdio: 'inherit'
      }
    )
    assert(fse.exists(pathFileArchive))
    const pathDirectoryPackageContext = path.join(
      pathDirectoryContext,
      pathDirectoryPackageRelative
    )
    await fse.mkdirp(pathDirectoryPackageContext)
    await execa(
      'tar',
      [
        '-xf',
        pathFileArchive,
        '--strip-components=1',
        '-C',
        pathDirectoryPackageContext
      ],
      {
        stdio: 'inherit'
      }
    )

    if (isRoot && options['--skip-workspace-root'] === true) {
      await fse.remove(pathFileArchive)
    } else {
      await fse.mkdirp(pathDirectoryPackageContext)
      await fse.move(
        pathFileArchive,
        path.join(pathDirectoryDestination, nameArchive),
        { overwrite: true }
      )
    }
  } catch (error_) {
    error = isNativeError(error_) ? error_ : new Error('Unknown Error')
  }

  if (cleanup) {
    await writeFile(
      pathPackageJSON,
      JSON.stringify(Object.assign(packageJSON, { version: '0.0.0' }), null, 2)
    )

    if (typeof pathDirectoryTemporary === 'string') {
      await fse.remove(pathDirectoryTemporary)
    }
  }

  return error
}
