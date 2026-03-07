import archiver from 'archiver'
import { createWriteStream } from 'node:fs'
import { lstat, readdir, readlink } from 'node:fs/promises'
import path from 'node:path'
import { applyUmask } from './normalize-permissions'

export type ArchiveFormat = 'tgz' | 'zip'

async function addDirectoryEntries(
  archive: archiver.Archiver,
  sourceDirectory: string,
  entryPrefix: string,
  umask: number,
): Promise<void> {
  const entries = await readdir(sourceDirectory, { withFileTypes: true })

  for (const entry of entries) {
    const sourcePath = path.join(sourceDirectory, entry.name)
    const entryPath = entryPrefix === '' ? entry.name : `${entryPrefix}/${entry.name}`
    const stats = await lstat(sourcePath)

    if (stats.isSymbolicLink()) {
      const linkTarget = await readlink(sourcePath)
      archive.symlink(entryPath, linkTarget, stats.mode & 0o7777)
    } else if (stats.isDirectory()) {
      await addDirectoryEntries(archive, sourcePath, entryPath, umask)
    } else {
      const mode = applyUmask(stats.mode & 0o7777, umask, false)
      archive.file(sourcePath, { mode, name: entryPath })
    }
  }
}

export async function createArchive(options: {
  entryPrefix: string
  format: ArchiveFormat
  outputPath: string
  sourceDirectory: string
  umask: number
}): Promise<void> {
  const archive =
    options.format === 'zip'
      ? archiver('zip', { zlib: { level: 9 } })
      : archiver('tar', { gzip: true, gzipOptions: { level: 9 } })

  const output = createWriteStream(options.outputPath)

  return await new Promise<void>((resolve, reject) => {
    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)

    addDirectoryEntries(archive, options.sourceDirectory, options.entryPrefix, options.umask)
      .then(async () => await archive.finalize())
      .catch(reject)
  })
}
