import type { Options as ExecaOptions } from 'execa'

export const getExecaStdio = (silent: boolean): ExecaOptions['stdio'] =>
  silent ? 'ignore' : 'inherit'
