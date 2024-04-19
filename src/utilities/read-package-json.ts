import path from 'node:path'
import fse from 'fs-extra'
import assert from 'node:assert'
import { readFile } from 'node:fs/promises'

export async function readPackageJSON(directory: string) {
  const pathPackageJSON = path.join(directory, 'package.json')
  assert(fse.exists(pathPackageJSON))
  const content = await readFile(pathPackageJSON, 'utf8')
  assert(typeof content === 'string')
  const packageJSON = JSON.parse(content) as { name: string }
  assert(typeof packageJSON === 'object')
  assert(typeof packageJSON.name === 'string')

  return packageJSON
}
