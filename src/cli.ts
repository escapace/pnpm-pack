import arg from 'arg'
import assert from 'node:assert'
import { assertRequirements } from './utilities/assert-requirements'
import { exit } from './utilities/exit'

await assertRequirements()

const { _ } = arg({}, { permissive: true })

assert((_.length = 1))
const command = _[0]
assert(
  command === 'workspace' ||
    command === 'package' ||
    command === 'cleanup' ||
    command === 'update-version',
)

// prettier-ignore
const run = await ({
  cleanup: async () => (await import('./pack-cleanup')).packCleanup,
  package: async () => (await import('./pack-package')).packPackage,
  'update-version': async () => (await import('./pack-update-version')).packUpdateVersion,
  workspace: async () => (await import('./pack-workspace')).packWorkspace,
}[command]())

const error = await run()
exit(error)
