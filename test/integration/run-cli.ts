import arg from 'arg'
import assert from 'node:assert'

export async function runCli(argv: string[]) {
  const argvEffective =
    argv.length > 0 &&
    ['package', 'workspace'].includes(argv[0] ?? '') &&
    !argv.includes('--silent') &&
    !argv.includes('--verbose')
      ? [argv[0], '--silent', ...argv.slice(1)]
      : argv

  const { _ } = arg({}, { argv: argvEffective, permissive: true })

  assert(_.length > 0, `Either of 'workspace' or 'package' sub-command is required.`)

  const command = _[0]

  assert(
    command === 'workspace' ||
      command === 'package' ||
      command === 'cleanup' ||
      command === 'update-version',
  )

  // prettier-ignore
  const run = await ({
    cleanup: async () => (await import('../../src/pack-cleanup')).packCleanup,
    package: async () => (await import('../../src/pack-package')).packPackage,
    'update-version': async () => (await import('../../src/pack-update-version')).packUpdateVersion,
    workspace: async () => (await import('../../src/pack-workspace')).packWorkspace,
  }[command]())

  const processArgv = process.argv

  try {
    process.argv = [processArgv[0] ?? 'node', processArgv[1] ?? 'cli.js', ...argvEffective]
    return await run()
  } finally {
    process.argv = processArgv
  }
}
