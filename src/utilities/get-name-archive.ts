export function getNameArchive(value: { name: string; version: string }) {
  // https://github.com/pnpm/pnpm/blob/6caec8109b563fd27ad262ce06a1f587cebbc044/releasing/plugin-commands-publishing/src/pack.ts#L98C1-L98C100
  return `${value.name.replace('@', '').replace('/', '-')}-${value.version}.tgz`
}
