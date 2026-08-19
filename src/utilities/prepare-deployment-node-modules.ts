import assert from 'node:assert'
import { readdir, readlink, rm } from 'node:fs/promises'
import path from 'node:path'
import fse from 'fs-extra'

const isPathInsideOrEqual = (parentDirectory: string, childPath: string) => {
  const relativePath = path.relative(parentDirectory, childPath)

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
}

/** Collects package symlinks exposed directly from a `node_modules` root. */
async function getDirectPackageLinkPaths(pathNodeModules: string) {
  const result: string[] = []
  const entries = await readdir(pathNodeModules, { withFileTypes: true })

  for (const entry of entries) {
    const pathEntry = path.join(pathNodeModules, entry.name)

    if (entry.isSymbolicLink() && !entry.name.startsWith('.')) {
      result.push(pathEntry)
      continue
    }

    if (!entry.isDirectory() || !entry.name.startsWith('@')) {
      continue
    }

    const scopedEntries = await readdir(pathEntry, { withFileTypes: true })

    for (const scopedEntry of scopedEntries) {
      if (scopedEntry.isSymbolicLink()) {
        result.push(path.join(pathEntry, scopedEntry.name))
      }
    }
  }

  return result
}

/**
 * Converts direct deployment package links that point back into the workspace into copied package
 * contents.
 *
 * @remarks
 * Only package links exposed from the deployment `node_modules` root are considered. The supported
 * link shapes are `node_modules/name` and `node_modules/@scope/name`. Symlinks inside pnpm's
 * internal `.pnpm` tree are left unchanged.
 *
 * Links that already resolve inside the deployment directory remain symlinks. Direct package links
 * that resolve outside the deployment directory are materialized only when they resolve inside the
 * workspace directory.
 *
 * The directory options define three boundaries:
 *
 * - `deploymentDirectory` is the pnpm deployment output that should contain self-contained runtime files.
 *
 * - `nodeModulesDirectory` is the deployment `node_modules` directory whose direct package links are inspected.
 *
 * - `workspaceDirectory` is the workspace root that may contain pnpm 11.19 through 11.21 workspace package link targets.
 *
 * @param options - Deployment directories used to classify and materialize package links.
 * @throws When a direct package link resolves outside both the deployment directory and the workspace directory.
 * @throws When a direct package link resolves to a missing target.
 */
export async function materializeExternalWorkspacePackageLinks(options: {
  deploymentDirectory: string
  nodeModulesDirectory: string
  workspaceDirectory: string
}) {
  const deploymentDirectory = path.resolve(options.deploymentDirectory)
  const workspaceDirectory = path.resolve(options.workspaceDirectory)
  const packageLinkPaths = await getDirectPackageLinkPaths(options.nodeModulesDirectory)

  for (const packageLinkPath of packageLinkPaths) {
    const linkTarget = await readlink(packageLinkPath)
    const pathTarget = path.resolve(path.dirname(packageLinkPath), linkTarget)

    if (isPathInsideOrEqual(deploymentDirectory, pathTarget)) {
      continue
    }

    assert(
      isPathInsideOrEqual(workspaceDirectory, pathTarget),
      `${packageLinkPath}: symlink target is outside deployment and workspace`,
    )
    assert(await fse.pathExists(pathTarget), `${packageLinkPath}: symlink target does not exist`)

    await rm(packageLinkPath)
    await fse.copy(pathTarget, packageLinkPath, { dereference: true })
  }
}

/**
 * Removes pnpm package-map metadata from `node_modules` trees.
 *
 * @remarks
 * The traversal removes only files named `.package-map.json` that are inside a `node_modules`
 * directory. A file with the same name outside `node_modules` is left unchanged.
 *
 * Symlink entries are skipped so cleanup does not cross package-manager link boundaries.
 *
 * @param directory - Directory whose descendant `node_modules` trees are inspected.
 */
export async function removePnpmPackageMapFiles(directory: string) {
  if (!(await fse.pathExists(directory))) {
    return
  }

  async function walk(directoryCurrent: string, insideNodeModules: boolean): Promise<void> {
    const entries = await readdir(directoryCurrent, { withFileTypes: true })

    for (const entry of entries) {
      const pathEntry = path.join(directoryCurrent, entry.name)
      const entryInsideNodeModules = insideNodeModules || entry.name === 'node_modules'

      if (entry.isSymbolicLink()) {
        continue
      }

      if (entry.isDirectory()) {
        await walk(pathEntry, entryInsideNodeModules)
        continue
      }

      if (entryInsideNodeModules && entry.name === '.package-map.json') {
        await rm(pathEntry)
      }
    }
  }

  await walk(directory, path.basename(directory) === 'node_modules')
}
