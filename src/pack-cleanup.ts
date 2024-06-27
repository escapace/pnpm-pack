import path from 'node:path'
import process from 'node:process'
import { getPathDirectoryPackage } from './utilities/get-path-directory-package'
import { readPackageJSON } from './utilities/read-package-json'
import { writeFileJSON } from './utilities/write-file-json'

export async function packCleanup() {
  const pathDirectoryPackage = await getPathDirectoryPackage(process.cwd())

  process.chdir(pathDirectoryPackage)

  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = await readPackageJSON(pathDirectoryPackage)

  await writeFileJSON(pathPackageJSON, Object.assign(packageJSON, { version: '0.0.0' }))
}
