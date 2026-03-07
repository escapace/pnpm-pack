import { execa } from 'execa'

export async function listZipEntries(pathArchive: string) {
  const { stdout } = await execa('unzip', ['-l', pathArchive])

  // unzip -l output format:
  //   Length      Date    Time    Name
  //   ---------  ---------- -----   ----
  //        1234  2024-01-01 00:00   path/to/file
  //   ---------                     -------
  //        5678                     N files
  const lines = stdout.split('\n')

  return lines
    .filter((line) => {
      const trimmed = line.trim()

      return (
        trimmed.length > 0 &&
        !trimmed.startsWith('Archive:') &&
        !trimmed.startsWith('Length') &&
        !trimmed.startsWith('-') &&
        /^\d/.test(trimmed)
      )
    })
    .map((line) => {
      // Extract the filename after the time field (HH:MM)
      const columns = line.trim().split(/\s+/)
      // Format: Length Date Time Name
      return columns.length >= 4 ? columns.slice(3).join(' ') : ''
    })
    .filter((value) => value.length > 0)
}

export async function getZipEntryPermissions(pathArchive: string) {
  const { stdout } = await execa('unzip', ['-Z', '-l', pathArchive])

  // unzip -Z -l output includes permissions like:
  // -rw-r--r--  3.0 unx      123 tx defN 24-Jan-01 00:00 path/to/file
  const lines = stdout.split('\n')
  const entries: Array<{ name: string; permissions: string }> = []

  for (const line of lines) {
    const columns = line.trim().split(/\s+/)

    if (columns.length >= 9 && /^[drwx-]{10}$/.test(columns[0])) {
      entries.push({ name: columns.at(-1) ?? '', permissions: columns[0] })
    }
  }

  return entries
}
