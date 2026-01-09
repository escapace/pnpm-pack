// @ts-check
import { escapace, compose } from 'eslint-config-escapace'

export default compose(escapace(), {
  rules: {
    'depend/ban-dependencies': ['error', { allowed: ['fs-extra', 'find-up', 'execa'] }],
  },
})
