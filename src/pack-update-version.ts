import arg from 'arg'
import assert from 'node:assert'
import path from 'node:path'
import process from 'node:process'
import semver from 'semver'
import { getPathDirectoryPackage } from './utilities/get-path-directory-package'
import { readPackageJSON } from './utilities/read-package-json'
import { writeFileJSON } from './utilities/write-file-json'

export async function packUpdateVersion() {
  const options = arg({
    '--version': String,
  })

  const version = options['--version'] ?? '0.0.0'
  assert(typeof semver.valid(version) === 'string')

  const pathDirectoryCurrent = process.cwd()
  const pathDirectoryPackage = await getPathDirectoryPackage(pathDirectoryCurrent)

  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = await readPackageJSON(pathDirectoryPackage)

  await writeFileJSON(pathPackageJSON, Object.assign(packageJSON, { version }))
}
