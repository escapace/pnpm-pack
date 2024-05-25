import assert from 'node:assert'
import path from 'node:path'

export const normalizePathDirectoryDestination = (options: {
  extract: boolean
  filenameArchiveDefault: string
  packDestination: string
  pathDirectoryPackage: string
}) => {
  assert(!path.isAbsolute(options.packDestination))

  const pathDirectoryDestinationIsArchive = ['.tar.gz', '.tgz'].some((value) =>
    options.packDestination.endsWith(value),
  )

  assert(!(pathDirectoryDestinationIsArchive && options.extract))

  const pathDirectoryDestination = pathDirectoryDestinationIsArchive
    ? path.resolve(options.pathDirectoryPackage, path.dirname(options.packDestination))
    : path.resolve(options.pathDirectoryPackage, options.packDestination)

  const pathFileDestinationArchive = pathDirectoryDestinationIsArchive
    ? path.join(pathDirectoryDestination, path.basename(options.packDestination))
    : path.join(pathDirectoryDestination, options.filenameArchiveDefault)

  return { pathDirectoryDestination, pathFileDestinationArchive }
}
