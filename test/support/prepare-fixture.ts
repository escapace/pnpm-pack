import { cp, mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'

export async function prepareFixture(options: { fixture: string }) {
  const pathDirectoryFixture = path.resolve(import.meta.dirname, '../fixtures', options.fixture)

  const pathDirectoryTemporary = await mkdtemp(path.join(os.tmpdir(), 'pnpm-pack-test-'))
  const pathDirectoryWorkspace = path.join(pathDirectoryTemporary, 'workspace')

  await cp(pathDirectoryFixture, pathDirectoryWorkspace, { recursive: true })

  await execa('pnpm', ['install', '--ignore-scripts'], {
    cwd: pathDirectoryWorkspace,
  })

  return {
    pathDirectoryWorkspace,
    cleanup: async () => {
      await rm(pathDirectoryTemporary, { force: true, recursive: true })
    },
  }
}
