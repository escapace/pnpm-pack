import assert from 'node:assert'
import { findUp } from 'find-up'
import path from 'node:path'

export async function getPathDirectoryWorkspace(cwd: string) {
  assert(typeof cwd === 'string')
  const pathFileWorkspaceYaml = await findUp('pnpm-workspace.yaml', {
    cwd,
    type: 'file',
  })

  return pathFileWorkspaceYaml === undefined ? undefined : path.dirname(pathFileWorkspaceYaml)
}
