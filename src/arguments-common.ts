import type arg from 'arg'
import assert from 'node:assert'
import semver from 'semver'

export const argumentsCommon = {
  '--development': Boolean,
  '--extract': Boolean,
  '--no-build': Boolean,
  '--no-optional': Boolean,
  '--pack-destination': String,
  '--production': Boolean,
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

  const extract = options['--extract'] === true
  const packDestination = options['--pack-destination'] ?? (extract ? 'lib/package' : 'lib')

  return {
    build,
    deployment,
    development,
    extract,
    noOptional,
    packDestination,
    production,
    version,
  }
}
