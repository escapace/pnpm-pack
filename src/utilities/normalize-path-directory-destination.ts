import assert from 'node:assert'
import path from 'node:path'
import type { ArchiveFormat } from './create-archive'

export const normalizePathDirectoryDestination = (options: {
  extract: boolean
  filenameArchiveDefault: string
  packDestination: string
  pathDirectoryCurrent: string
}) => {
  assert(!path.isAbsolute(options.packDestination))

  const pathDirectoryDestinationIsArchive = ['.tar.gz', '.tgz', '.zip'].some((value) =>
    options.packDestination.endsWith(value),
  )

  assert(!pathDirectoryDestinationIsArchive || !options.extract)

  const format: ArchiveFormat = options.packDestination.endsWith('.zip') ? 'zip' : 'tgz'

  const pathDirectoryDestination = pathDirectoryDestinationIsArchive
    ? path.resolve(options.pathDirectoryCurrent, path.dirname(options.packDestination))
    : path.resolve(options.pathDirectoryCurrent, options.packDestination)

  const pathFileDestinationArchive = pathDirectoryDestinationIsArchive
    ? path.join(pathDirectoryDestination, path.basename(options.packDestination))
    : path.join(pathDirectoryDestination, options.filenameArchiveDefault)

  return { format, pathDirectoryDestination, pathFileDestinationArchive }
}
