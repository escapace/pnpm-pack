type ExecaStdio = 'ignore' | 'inherit'

export const getExecaStdio = (silent: boolean): ExecaStdio => (silent ? 'ignore' : 'inherit')
