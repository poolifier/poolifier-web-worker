import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { bounded } from './test-utils.mjs'

const moduleUrl = new URL('../src/mod.ts', import.meta.url).href
const utilsUrl = new URL('../src/utils.ts', import.meta.url).href
const strategiesUrl = new URL(
  '../src/pools/selection-strategies/selection-strategies-utils.ts',
  import.meta.url,
).href
const workerUrl = new URL(
  './worker-files/thread/testWorker.mjs',
  import.meta.url,
).href

const runDeno = async (script, permissions = ['--deny-env', '--deny-sys']) => {
  const child = new Deno.Command(Deno.execPath(), {
    args: [
      'run',
      '--no-prompt',
      '--allow-read',
      ...permissions,
      `data:text/javascript,${encodeURIComponent(script)}`,
    ],
    env: { ENVIRONMENT: 'runtime-permission-control' },
    stdout: 'piped',
    stderr: 'piped',
  }).spawn()
  let completed = false
  try {
    const output = await bounded(
      child.output(),
      'Deno subprocess remained pending',
    )
    completed = true
    expect(new TextDecoder().decode(output.stderr)).toBe('')
    expect(output.success).toBe(true)
    return JSON.parse(new TextDecoder().decode(output.stdout))
  } finally {
    if (!completed) {
      child.kill('SIGKILL')
      await child.status
    }
  }
}

describe('Runtime permission boundaries', () => {
  it('imports the public API without environment or system permissions', async () => {
    const result = await runDeno(`
      await import(${JSON.stringify(moduleUrl)})
      const { average, runtime } = await import(${JSON.stringify(utilsUrl)})
      const denied = operation => {
        try { operation() } catch (error) { return error.name }
        throw new Error('Permission unexpectedly granted')
      }
      const { cpus } = await import('node:os')
      console.log(JSON.stringify({
        runtime,
        average: average([1, 3, 5]),
        env: denied(() => Deno.env.get('ENVIRONMENT')),
        sys: denied(() => cpus())
      }))
    `)
    expect(result).toStrictEqual({
      runtime: 'deno',
      average: 3,
      env: 'NotCapable',
      sys: 'NotCapable',
    })
  })

  it('uses explicit weights without reading CPU information', async () => {
    const result = await runDeno(`
      const { FixedThreadPool } = await import(${JSON.stringify(moduleUrl)})
      const {
        buildWorkerChoiceStrategyOptions,
        getWorkerChoiceStrategiesRetries
      } = await import(${JSON.stringify(strategiesUrl)})
      const options = { weights: { 0: 12, 1: 24 } }
      const pool = new FixedThreadPool(2, new URL(${
      JSON.stringify(workerUrl)
    }), {
        startWorkers: false,
        workerChoiceStrategyOptions: options
      })
      console.log(JSON.stringify({
        weights: buildWorkerChoiceStrategyOptions(pool, options).weights,
        retries: getWorkerChoiceStrategiesRetries(pool),
        explicitRetries: getWorkerChoiceStrategiesRetries(pool, options)
      }))
    `)
    expect(result).toStrictEqual({
      weights: { 0: 12, 1: 24 },
      retries: 4,
      explicitRetries: 4,
    })
  })

  it('requires CPU permission only when computing default weights', async () => {
    const result = await runDeno(`
      const { FixedThreadPool } = await import(${JSON.stringify(moduleUrl)})
      let errorName
      try {
        new FixedThreadPool(2, new URL(${JSON.stringify(workerUrl)}), {
          startWorkers: false
        })
      } catch (error) { errorName = error.name }
      console.log(JSON.stringify({ errorName }))
    `)
    expect(result).toStrictEqual({ errorName: 'NotCapable' })
  })

  it('computes and caches default weights with native CPU permission', async () => {
    const result = await runDeno(
      `
      const { FixedThreadPool } = await import(${JSON.stringify(moduleUrl)})
      const { buildWorkerChoiceStrategyOptions } = await import(${
        JSON.stringify(strategiesUrl)
      })
      const pool = new FixedThreadPool(2, new URL(${
        JSON.stringify(workerUrl)
      }), {
        startWorkers: false
      })
      const first = buildWorkerChoiceStrategyOptions(pool).weights
      await Deno.permissions.revoke({ name: 'sys' })
      const { cpus } = await import('node:os')
      let deniedCpuRead
      try { cpus() } catch (error) { deniedCpuRead = error.name }
      const second = buildWorkerChoiceStrategyOptions(pool).weights
      console.log(JSON.stringify({
        environment: Deno.env.get('ENVIRONMENT'),
        deniedCpuRead,
        first,
        second
      }))
    `,
      ['--allow-env=ENVIRONMENT', '--allow-sys'],
    )
    expect(result.environment).toBe('runtime-permission-control')
    expect(result.deniedCpuRead).toBe('NotCapable')
    expect(result.first).toStrictEqual(result.second)
    expect(Object.keys(result.first)).toStrictEqual(['0', '1'])
    expect(Number.isFinite(result.first[0])).toBe(true)
    expect(result.first[0]).toBeGreaterThan(0)
    expect(result.first[0]).toBe(result.first[1])
  })
})
