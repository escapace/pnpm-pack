import assert from 'node:assert'
import { findUp } from 'find-up'
import path from 'node:path'

export async function getPathDirectoryWorkspace(cwd: string) {
  assert(typeof cwd === 'string')
  const pathFileWorkspaceYaml = await findUp('pnpm-workspace.yaml', {
    cwd,
    type: 'file'
  })

  assert(typeof pathFileWorkspaceYaml === 'string')
  return path.dirname(pathFileWorkspaceYaml)
}
