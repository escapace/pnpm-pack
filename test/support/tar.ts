import { execa } from 'execa'

export async function listTarEntries(pathArchive: string) {
  const { stdout } = await execa('tar', ['-tzf', pathArchive])

  return stdout
    .split('\n')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

export async function extractTar(pathArchive: string, pathDirectory: string) {
  await execa('tar', ['-xzf', pathArchive, '-C', pathDirectory])
}
