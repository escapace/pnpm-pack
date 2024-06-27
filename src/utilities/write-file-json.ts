/* eslint-disable typescript/no-explicit-any */

import { writeFile } from 'node:fs/promises'

export const writeFileJSON = async (path: string, value: any) =>
  await writeFile(path, JSON.stringify(value, null, 2).concat('\n'))
