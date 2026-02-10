import { readdir } from 'node:fs/promises'
import path from 'node:path'

export const listFilesRelative = async (directory: string) => {
  const result: string[] = []

  const walk = async (root: string) => {
    const entries = await readdir(root, { withFileTypes: true })

    await Promise.all(
      entries.map(async (entry) => {
        const pathEntry = path.join(root, entry.name)

        if (entry.isDirectory()) {
          await walk(pathEntry)
          return
        }

        result.push(path.relative(directory, pathEntry))
      }),
    )
  }

  await walk(directory)

  return result.sort()
}
