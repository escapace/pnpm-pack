import { execa } from 'execa'
import assert from 'node:assert'
import { parse } from 'semver'

export const pnpmVersion = async () => {
  const { stdout } = await execa`pnpm --version`

  const version = parse(stdout)

  assert(version !== null)

  return version
}
