import assert from 'node:assert'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'vitest'

interface PackageJSON {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  name?: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

const listDirectories = async (directory: string) => {
  const entries = await readdir(directory, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(directory, entry.name))
    .sort()
}

const readPackageJSON = async (directory: string) => {
  const content = await readFile(path.join(directory, 'package.json'), 'utf8')

  return JSON.parse(content) as PackageJSON
}

const workspaceDependencyEntries = (packageJSON: PackageJSON) =>
  [
    packageJSON.dependencies,
    packageJSON.devDependencies,
    packageJSON.optionalDependencies,
    packageJSON.peerDependencies,
  ]
    .filter((value): value is Record<string, string> => value !== undefined)
    .flatMap((value) => Object.entries(value))
    .filter(([, range]) => range.startsWith('workspace:'))

test('fixtures keep workspace dependency references internally consistent', async () => {
  const pathDirectoryFixtures = path.resolve(import.meta.dirname, '../fixtures')
  const fixtures = await listDirectories(pathDirectoryFixtures)

  for (const fixture of fixtures) {
    const pathWorkspaceYaml = path.join(fixture, 'pnpm-workspace.yaml')

    let hasWorkspaceYaml = true

    try {
      await readFile(pathWorkspaceYaml, 'utf8')
    } catch {
      hasWorkspaceYaml = false
    }

    if (!hasWorkspaceYaml) {
      continue
    }

    const pathDirectoryPackages = path.join(fixture, 'packages')

    let packageDirectories: string[] = []

    try {
      packageDirectories = await listDirectories(pathDirectoryPackages)
    } catch {
      packageDirectories = []
    }

    const packageJSONs = await Promise.all(
      packageDirectories.map(async (directory) => ({
        directory,
        packageJSON: await readPackageJSON(directory),
      })),
    )

    const packageNames = new Set(
      packageJSONs
        .map((value) => value.packageJSON.name)
        .filter((value): value is string => typeof value === 'string'),
    )

    for (const value of packageJSONs) {
      const workspaceDependencies = workspaceDependencyEntries(value.packageJSON)

      for (const [dependencyName] of workspaceDependencies) {
        assert.equal(
          packageNames.has(dependencyName),
          true,
          `${path.relative(pathDirectoryFixtures, value.directory)} depends on ${dependencyName} with workspace protocol but no matching workspace package exists in ${path.basename(fixture)}`,
        )
      }
    }
  }
})
