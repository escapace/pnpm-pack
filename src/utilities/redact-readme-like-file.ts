import fs from 'node:fs/promises'
import path from 'node:path'

const readmeLikeExpression = /^README(?:\..+)?$/i
const markdownLikeExpression = /\.m?a?r?k?d?o?w?n?$/i

async function getPathFileReadmeLike(pathDirectory: string) {
  const entries = await fs.readdir(pathDirectory, { withFileTypes: true })

  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((filename) => readmeLikeExpression.test(filename))
    .sort((a, b) => a.localeCompare(b))

  let filenameReadmeLike: string | undefined

  for (const filename of files) {
    if (markdownLikeExpression.test(filename)) {
      filenameReadmeLike = filename
      break
    }

    if (filename.endsWith('README')) {
      filenameReadmeLike = filename
    }
  }

  return typeof filenameReadmeLike === 'string'
    ? path.join(pathDirectory, filenameReadmeLike)
    : undefined
}

export async function redactReadmeLikeFile(pathDirectory: string) {
  const pathFileReadmeLike = await getPathFileReadmeLike(pathDirectory)

  if (typeof pathFileReadmeLike !== 'string') {
    return false
  }

  await fs.writeFile(pathFileReadmeLike, '')

  return true
}
