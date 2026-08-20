import type arg from 'arg'
import assert from 'node:assert'
import semver from 'semver'

export const argumentsCommon = {
  '--development': Boolean,
  '--extract': Boolean,
  '--no-build': Boolean,
  '--no-optional': Boolean,
  '--no-redact-readme': Boolean,
  '--pack-destination': String,
  '--production': Boolean,
  '--silent': Boolean,
  '--umask': String,
  '--verbose': Boolean,
  '--version': String,
} as const

export const argumentsCommonParse = <T extends arg.Result<typeof argumentsCommon>>(options: T) => {
  const version = options['--version'] ?? '0.0.0'
  assert(typeof semver.valid(version) === 'string')
  const build = options['--no-build'] !== true

  const development = options['--development'] === true
  const noOptional = options['--no-optional'] === true
  const production = options['--production'] === true

  const deployment = development || production

  const redactReadme = options['--no-redact-readme'] !== true
  const extract = options['--extract'] === true
  const packDestination = options['--pack-destination'] ?? (extract ? 'lib/package' : 'lib')
  const verbose = options['--verbose'] === true
  const silent = !verbose

  const umaskString = options['--umask'] ?? '0o022'
  const umaskParsed = Number.parseInt(umaskString.replace(/^0o/, ''), 8)
  assert(!Number.isNaN(umaskParsed) && umaskParsed >= 0 && umaskParsed <= 0o777)
  const umask = umaskParsed

  return {
    build,
    deployment,
    development,
    extract,
    noOptional,
    packDestination,
    production,
    redactReadme,
    silent,
    umask,
    verbose,
    version,
  }
}
