import { isNativeError } from 'node:util/types'

export function exit(error: unknown) {
  if (error !== undefined) {
    console.error(isNativeError(error) ? error.message : 'Unknown Error')
    process.exit(1)
  }
}
