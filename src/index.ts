import arg from 'arg'
import assert from 'assert'
import { assertRequirements } from './utilities/assert-requirements'
import { exit } from './utilities/exit'

await assertRequirements()

const { _ } = arg({}, { permissive: true })

assert((_.length = 1))
const command = _[0]
assert(
  command === 'workspace' || command === 'package' || command === 'cleanup'
)

// prettier-ignore
const run = await ({
  workspace: async () => (await import('./pack-workspace')).packWorkspace,
  package: async () => (await import('./pack-package')).packPackage,
  cleanup: async () => (await import('./pack-cleanup')).packCleanup
}[command]())

const error = await run()
exit(error)
