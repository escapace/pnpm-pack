import assert from 'node:assert'
import { findUp } from 'find-up'
import path from 'path'

export async function getPathDirectoryPackage(cwd: string) {
  assert(typeof cwd === 'string')
  const pathFilePackageJSON = await findUp('package.json', {
    cwd,
    type: 'file'
  })

  assert(typeof pathFilePackageJSON === 'string')
  return path.dirname(pathFilePackageJSON)
}
