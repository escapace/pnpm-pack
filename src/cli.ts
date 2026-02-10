import arg from 'arg'
import { assertRequirements } from './utilities/assert-requirements'
import { exit } from './utilities/exit'

const helpMessage = [
  'pnpm-pack',
  '',
  'Package pnpm projects and workspaces into a .tgz archive by default,',
  'or extract package files to a directory with --extract.',
  '',
  'Usage:',
  '  pnpm-pack <command> [options]',
  '  pnpm-pack --help',
  '  pnpm-pack -h',
  '',
  'Commands:',
  '  package    Package the nearest project (nearest package.json).',
  '  workspace  Package all workspace packages, or a filtered subset (nearest pnpm-workspace.yaml).',
  '',
  'Common options:',
  '  --version <semver>         Set package version for packaging and archive names.',
  '  --pack-destination <path>  Set output destination (relative path only).',
  '  --extract                  Extract package files to a directory instead of .tgz.',
  '  --no-build                 Skip running build scripts.',
  '  --production               Include production dependencies in the artifact.',
  '  --development              Include development dependencies in the artifact.',
  '  --no-optional              Omit optional dependencies with deployment options.',
  '  --no-redact-readme         Keep README-like file contents in packaged artifacts.',
  '  --silent                   Suppress output from child commands.',
  '',
  'Workspace selection options:',
  '  --filter <selector>                    Select workspace packages using pnpm filtering selectors.',
  '  --filter-prod <selector>               Use pnpm selector syntax while omitting devDependencies for dependency selection.',
  '  --test-pattern <glob>                  Mark test-file globs for pnpm changed-since filtering.',
  '  --changed-files-ignore-pattern <glob>  Ignore matching files when pnpm computes changed projects.',
  '  --workspace-concurrency <number>       Set workspace command parallelism.',
].join('\n')

type Command = 'cleanup' | 'package' | 'update-version' | 'workspace'

const commands = new Set<Command>(['cleanup', 'package', 'update-version', 'workspace'])

const isCommand = (value: string): value is Command => commands.has(value as Command)

let error: unknown

try {
  const argv = process.argv.slice(2)

  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(helpMessage)
    process.exit(0)
  }

  const { _ } = arg({}, { argv, permissive: true })
  const command = _[0]

  if (typeof command !== 'string') {
    console.log(helpMessage)
    process.exit(0)
  }

  if (!isCommand(command)) {
    console.log(helpMessage)
    process.exit(1)
  }

  await assertRequirements()

  // prettier-ignore
  const run = await ({
    cleanup: async () => (await import('./pack-cleanup')).packCleanup,
    package: async () => (await import('./pack-package')).packPackage,
    'update-version': async () => (await import('./pack-update-version')).packUpdateVersion,
    workspace: async () => (await import('./pack-workspace')).packWorkspace,
  }[command]())

  error = await run()
} catch (error_) {
  error = error_
}

exit(error)
