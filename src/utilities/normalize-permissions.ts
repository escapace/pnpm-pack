import { readdir, chmod, lstat } from 'node:fs/promises'
import path from 'node:path'

export function applyUmask(mode: number, umask: number, isDirectory: boolean): number {
  const base = isDirectory ? mode | 0o111 : mode

  return base & ~umask
}

export async function normalizePermissionsRecursive(
  directory: string,
  umask: number,
): Promise<void> {
  if (umask === 0) {
    return
  }

  const entries = await readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    const pathEntry = path.join(directory, entry.name)
    const stats = await lstat(pathEntry)

    if (stats.isSymbolicLink()) {
      continue
    }

    const isDirectory = stats.isDirectory()
    const normalized = applyUmask(stats.mode & 0o7777, umask, isDirectory)

    if ((stats.mode & 0o7777) !== normalized) {
      await chmod(pathEntry, normalized)
    }

    if (isDirectory) {
      await normalizePermissionsRecursive(pathEntry, umask)
    }
  }
}
