import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { getPathDirectoryPackage } from './utilities/get-path-directory-package'
import { readPackageJSON } from './utilities/read-package-json'

export async function packCleanup() {
  const pathDirectoryPackage = await getPathDirectoryPackage(process.cwd())

  process.chdir(pathDirectoryPackage)

  const pathPackageJSON = path.join(pathDirectoryPackage, 'package.json')
  const packageJSON = await readPackageJSON(pathDirectoryPackage)

  await writeFile(
    pathPackageJSON,
    JSON.stringify(Object.assign(packageJSON, { version: '0.0.0' }), null, 2)
  )

  return
}
