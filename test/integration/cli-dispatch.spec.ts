import assert from 'node:assert'
import { test } from 'vitest'
import { runCli } from './run-cli'

test('run-cli fails when no subcommand is provided', async () => {
  await assert.rejects(async () => await runCli([]))
})

test('run-cli fails when unknown subcommand is provided', async () => {
  await assert.rejects(async () => await runCli(['unknown-command']))
})
