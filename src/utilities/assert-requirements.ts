import which from 'which'

export async function assertRequirements() {
  await which('tar')
  await which('pnpm')
}
