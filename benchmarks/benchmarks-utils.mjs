import { strictEqual } from 'node:assert'
import { randomInt } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { Bench } from 'tinybench'
import {
  DynamicThreadPool,
  FixedThreadPool,
  Measurements,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
} from '../src/mod.ts'
import { TaskFunctions } from './benchmarks-types.mjs'

const buildPoolifierPool = (workerType, poolType, poolSize, poolOptions) => {
  switch (poolType) {
    case PoolTypes.fixed:
      switch (workerType) {
        case WorkerTypes.web:
          return new FixedThreadPool(
            poolSize,
            new URL('./internal/thread-worker.mjs', import.meta.url),
            poolOptions,
          )
      }
      break
    case PoolTypes.dynamic:
      switch (workerType) {
        case WorkerTypes.web:
          return new DynamicThreadPool(
            Math.floor(poolSize / 2),
            poolSize,
            new URL('./internal/thread-worker.mjs', import.meta.url),
            poolOptions,
          )
      }
      break
  }
}

const runPoolifierPool = async (pool, { taskExecutions, workerData }) => {
  for (let i = 1; i <= taskExecutions; i++) {
    await pool.execute(workerData)
  }
}

const buildPoolifierBenchmarkDenoBench = (
  name,
  workerType,
  poolType,
  poolSize,
  poolOptions,
  { taskExecutions, workerData },
) => {
  const {
    workerChoiceStrategy,
    enableTasksQueue,
    workerChoiceStrategyOptions,
  } = poolOptions
  const measurement = workerChoiceStrategyOptions?.measurement
  Deno.bench(
    `${name} with ${workerChoiceStrategy}${
      measurement != null ? `, with ${measurement}` : ''
    } and ${enableTasksQueue ? 'with' : 'without'} tasks queue`,
    { group: `${name}` },
    async (b) => {
      let pool
      try {
        pool = buildPoolifierPool(workerType, poolType, poolSize, poolOptions)
        if (workerChoiceStrategy != null) {
          strictEqual(pool.opts.workerChoiceStrategy, workerChoiceStrategy)
        }
        if (enableTasksQueue != null) {
          strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
        }
        if (measurement != null) {
          strictEqual(
            pool.opts.workerChoiceStrategyOptions.measurement,
            measurement,
          )
        }
        b.start()
        await runPoolifierPool(pool, {
          taskExecutions,
          workerData,
        })
        b.end()
      } catch (error) {
        console.error(error)
      } finally {
        if (pool != null) {
          await pool.destroy()
        }
      }
    },
  )
}

export const runPoolifierBenchmarkDenoBench = (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData },
) => {
  try {
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime]) {
            buildPoolifierBenchmarkDenoBench(
              name,
              workerType,
              poolType,
              poolSize,
              {
                workerChoiceStrategy,
                enableTasksQueue,
                workerChoiceStrategyOptions: { measurement },
              },
              { taskExecutions, workerData },
            )
          }
        } else {
          buildPoolifierBenchmarkDenoBench(
            name,
            workerType,
            poolType,
            poolSize,
            {
              workerChoiceStrategy,
              enableTasksQueue,
            },
            { taskExecutions, workerData },
          )
        }
      }
    }
  } catch (error) {
    console.error(error)
  }
}

const jsonIntegerSerialization = (n) => {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

/**
 * @param {number} n - The number of fibonacci numbers to generate.
 * @returns {number} - The nth fibonacci number.
 */
const fibonacci = (n) => {
  if (n === 0) {
    return 0n
  }
  if (n === 1) {
    return 1n
  }
  n = BigInt(n)
  let current = 1n
  let previous = 0n
  while (n-- > 1n) {
    const tmp = current
    current += previous
    previous = tmp
  }
  return current
}

/**
 * @param {number} n - The number to calculate the factorial of.
 * @returns {number} - The factorial of n.
 */
const factorial = (n) => {
  if (n === 0 || n === 1) {
    return 1n
  }
  n = BigInt(n)
  let factorial = 1n
  for (let i = 1n; i <= n; i++) {
    factorial *= i
  }
  return factorial
}

const readWriteFiles = (
  n,
  baseDirectory = `/tmp/poolifier-benchmarks/${randomInt(281474976710655)}`,
) => {
  if (existsSync(baseDirectory) === true) {
    rmSync(baseDirectory, { recursive: true })
  }
  mkdirSync(baseDirectory, { recursive: true })
  for (let i = 0; i < n; i++) {
    const filePath = `${baseDirectory}/${i}`
    writeFileSync(filePath, i.toString(), {
      encoding: 'utf8',
      flag: 'a',
    })
    readFileSync(filePath, 'utf8')
  }
  rmSync(baseDirectory, { recursive: true })
  return { ok: 1 }
}

export const executeTaskFunction = (data) => {
  switch (data.function) {
    case TaskFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.taskSize || 1000)
    case TaskFunctions.fibonacci:
      return fibonacci(data.taskSize || 1000)
    case TaskFunctions.factorial:
      return factorial(data.taskSize || 1000)
    case TaskFunctions.readWriteFiles:
      return readWriteFiles(data.taskSize || 1000)
    default:
      throw new Error('Unknown task function')
  }
}

const JSRuntime = {
  bun: 'bun',
  deno: 'deno',
  // node: 'node',
  // workerd: 'workerd',
  browser: 'browser',
}

const isBun = !!globalThis.Bun || !!globalThis.process?.versions?.bun
const isDeno = !!globalThis.Deno
// const isNode = globalThis.process?.release?.name === 'node'
// const isWorkerd = globalThis.navigator?.userAgent === 'Cloudflare-Workers'
const isBrowser = !!globalThis.navigator

export const runtime = (() => {
  if (isBun) return JSRuntime.bun
  if (isDeno) return JSRuntime.deno
  // if (isNode) return JSRuntime.node
  // if (isWorkerd) return JSRuntime.workerd
  if (isBrowser) return JSRuntime.browser
  throw new Error('Unsupported JavaScript runtime environment')
})()

export const envGet = (key) => {
  return {
    browser: () => undefined,
    deno: () => Deno?.env?.get?.(key),
    bun: () => Bun?.env?.[key],
  }[runtime]()
}

export const writeFile = (filePath, content) => {
  return {
    browser: () => {
      throw new Error('File writing is not supported in browser runtime')
    },
    deno: () => Deno.writeTextFileSync(filePath, content),
    bun: async () => await Bun.write(filePath, content),
  }[runtime]()
}

export const exit = (code = 0) => {
  return {
    browser: () => {
      throw new Error('Process exit is not supported in browser runtime')
    },
    deno: () => Deno.exit(code),
    // deno-lint-ignore no-process-global
    bun: () => process.exit(code),
  }[runtime]()
}

export const runPoolifierBenchmarkTinyBench = async (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData },
) => {
  const bmfResults = {}
  let pool
  try {
    const bench = new Bench()
    pool = buildPoolifierPool(workerType, poolType, poolSize)

    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime]) {
            const taskName =
              `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                enableTasksQueue ? 'with' : 'without'
              } tasks queue`

            bench.add(
              taskName,
              async () => {
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData,
                })
              },
              {
                beforeAll: () => {
                  pool.setWorkerChoiceStrategy(workerChoiceStrategy, {
                    measurement,
                  })
                  pool.enableTasksQueue(enableTasksQueue)
                  strictEqual(
                    pool.opts.workerChoiceStrategy,
                    workerChoiceStrategy,
                  )
                  strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                  strictEqual(
                    pool.opts.workerChoiceStrategyOptions.measurement,
                    measurement,
                  )
                },
              },
            )
          }
        } else {
          const taskName = `${name} with ${workerChoiceStrategy} and ${
            enableTasksQueue ? 'with' : 'without'
          } tasks queue`

          bench.add(
            taskName,
            async () => {
              await runPoolifierPool(pool, {
                taskExecutions,
                workerData,
              })
            },
            {
              beforeAll: () => {
                pool.setWorkerChoiceStrategy(workerChoiceStrategy)
                pool.enableTasksQueue(enableTasksQueue)
                strictEqual(
                  pool.opts.workerChoiceStrategy,
                  workerChoiceStrategy,
                )
                strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
              },
            },
          )
        }
      }
    }

    const tasks = await bench.run()
    console.table(bench.table())

    for (const task of tasks) {
      if (
        task.result?.state === 'completed' ||
        task.result?.state === 'aborted-with-statistics'
      ) {
        bmfResults[task.name] = {
          latency: {
            value: task.result.latency.mean,
            lower_value: task.result.latency.mean - task.result.latency.sd,
            upper_value: task.result.latency.mean + task.result.latency.sd,
          },
          throughput: {
            value: task.result.throughput.mean,
            lower_value: task.result.throughput.mean -
              task.result.throughput.sd,
            upper_value: task.result.throughput.mean +
              task.result.throughput.sd,
          },
        }
      }
    }
    return bmfResults
  } catch (error) {
    console.error(error)
    return bmfResults
  } finally {
    if (pool != null) {
      await pool.destroy()
    }
  }
}
