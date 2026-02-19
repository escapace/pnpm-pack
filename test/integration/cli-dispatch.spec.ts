import assert from 'node:assert'
import { it } from 'vitest'
import { runCli } from './run-cli'

it('run-cli fails when no subcommand is provided', async () => {
  await assert.rejects(async () => await runCli([]))
})

it('run-cli fails when unknown subcommand is provided', async () => {
  await assert.rejects(async () => await runCli(['unknown-command']))
})
