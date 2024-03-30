import { randomInt } from 'node:crypto'
import { strictEqual } from 'node:assert'
import { bench, group } from 'mitata'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import Benchmark from 'benchmark'
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
  return await new Promise((resolve, reject) => {
    let executions = 0
    for (let i = 1; i <= taskExecutions; i++) {
      pool
        .execute(workerData)
        .then(() => {
          ;++executions
          if (executions === taskExecutions) {
            resolve({ ok: 1 })
          }
        })
        .catch((err) => {
          console.error(err)
          reject(err)
        })
    }
  })
}

export const runPoolifierBenchmarkBenchmarkJs = async (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData },
) => {
  return await new Promise((resolve, reject) => {
    const pool = buildPoolifierPool(workerType, poolType, poolSize)
    try {
      const suite = new Benchmark.Suite(name)
      for (
        const workerChoiceStrategy of Object.values(
          WorkerChoiceStrategies,
        )
      ) {
        for (const enableTasksQueue of [false, true]) {
          if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
            for (const measurement of [Measurements.runTime]) {
              suite.add(
                `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                  enableTasksQueue ? 'with' : 'without'
                } tasks queue`,
                async () => {
                  await runPoolifierPool(pool, {
                    taskExecutions,
                    workerData,
                  })
                },
                {
                  onStart: () => {
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
                  // onComplete: async () => {
                  //   await pool.destroy()
                  // },
                },
              )
            }
          } else {
            suite.add(
              `${name} with ${workerChoiceStrategy} and ${
                enableTasksQueue ? 'with' : 'without'
              } tasks queue`,
              async () => {
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData,
                })
              },
              {
                onStart: () => {
                  pool.setWorkerChoiceStrategy(workerChoiceStrategy)
                  pool.enableTasksQueue(enableTasksQueue)
                  strictEqual(
                    pool.opts.workerChoiceStrategy,
                    workerChoiceStrategy,
                  )
                  strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                },
                // onComplete: async () => {
                //   await pool.destroy()
                // },
              },
            )
          }
        }
      }
      suite
        .on('cycle', (event) => {
          console.info(event.target.toString())
        })
        .on('complete', function () {
          console.info(
            'Fastest is ' +
              LIST_FORMATTER.format(this.filter('fastest').map('name')),
          )
          const destroyTimeout = setTimeout(() => {
            console.error('Pool destroy timeout reached (30s)')
            resolve()
          }, 30000)
          pool
            .destroy()
            .then(resolve)
            .catch(reject)
            .finally(() => {
              clearTimeout(destroyTimeout)
            })
        })
        .run({ async: true })
    } catch (error) {
      pool.destroy().then(() => reject(error))
    }
  })
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
            Deno.bench(
              `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                enableTasksQueue ? 'with' : 'without'
              } tasks queue`,
              { group: `${name}` },
              async (b) => {
                const pool = buildPoolifierPool(
                  workerType,
                  poolType,
                  poolSize,
                  {
                    workerChoiceStrategy,
                    workerChoiceStrategyOptions: {
                      measurement,
                    },
                    enableTasksQueue,
                  },
                )
                strictEqual(
                  pool.opts.workerChoiceStrategy,
                  workerChoiceStrategy,
                )
                strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                strictEqual(
                  pool.opts.workerChoiceStrategyOptions.measurement,
                  measurement,
                )
                b.start()
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData,
                })
                b.end()
                await pool.destroy()
              },
            )
          }
        } else {
          Deno.bench(
            `${name} with ${workerChoiceStrategy} and ${
              enableTasksQueue ? 'with' : 'without'
            } tasks queue`,
            { group: `${name}` },
            async (b) => {
              const pool = buildPoolifierPool(workerType, poolType, poolSize, {
                workerChoiceStrategy,
                enableTasksQueue,
              })
              strictEqual(pool.opts.workerChoiceStrategy, workerChoiceStrategy)
              strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
              b.start()
              await runPoolifierPool(pool, {
                taskExecutions,
                workerData,
              })
              b.end()
              await pool.destroy()
            },
          )
        }
      }
    }
  } catch (error) {
    console.error(error)
  }
}

export const buildPoolifierBenchmarkMitata = (
  name,
  workerType,
  poolType,
  poolSize,
  { taskExecutions, workerData },
) => {
  try {
    const pool = buildPoolifierPool(workerType, poolType, poolSize)
    for (const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)) {
      for (const enableTasksQueue of [false, true]) {
        if (workerChoiceStrategy === WorkerChoiceStrategies.FAIR_SHARE) {
          for (const measurement of [Measurements.runTime]) {
            group(name, () => {
              bench(
                `${name} with ${workerChoiceStrategy}, with ${measurement} and ${
                  enableTasksQueue ? 'with' : 'without'
                } tasks queue`,
                async () => {
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
                  await runPoolifierPool(pool, {
                    taskExecutions,
                    workerData,
                  })
                },
              )
            })
          }
        } else {
          group(name, () => {
            bench(
              `${name} with ${workerChoiceStrategy} and ${
                enableTasksQueue ? 'with' : 'without'
              } tasks queue`,
              async () => {
                pool.setWorkerChoiceStrategy(workerChoiceStrategy)
                pool.enableTasksQueue(enableTasksQueue)
                strictEqual(
                  pool.opts.workerChoiceStrategy,
                  workerChoiceStrategy,
                )
                strictEqual(pool.opts.enableTasksQueue, enableTasksQueue)
                await runPoolifierPool(pool, {
                  taskExecutions,
                  workerData,
                })
              },
            )
          })
        }
      }
    }
    return pool
  } catch (error) {
    console.error(error)
  }
}

const LIST_FORMATTER = new Intl.ListFormat('en-US', {
  style: 'long',
  type: 'conjunction',
})

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
  n = BigInt(n)
  let current = 1n
  let previous = 0n
  while (--n) {
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
  } else {
    n = BigInt(n)
    let factorial = 1n
    for (let i = 1n; i <= n; i++) {
      factorial *= i
    }
    return factorial
  }
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

const javascriptRuntimes = {
  bun: 'bun',
  deno: 'deno',
  node: 'node',
  workerd: 'workerd',
  browser: 'browser',
}

export const isBun = !!globalThis.Bun || !!globalThis.process?.versions?.bun
export const isDeno = !!globalThis.Deno
export const isNode = globalThis.process?.release?.name === 'node'
export const isWorkerd =
  globalThis.navigator?.userAgent === 'Cloudflare-Workers'
export const isBrowser = !!globalThis.navigator

export const runtime = () => {
  if (isBun) return javascriptRuntimes.bun
  if (isDeno) return javascriptRuntimes.deno
  if (isNode) return javascriptRuntimes.node
  if (isWorkerd) return javascriptRuntimes.workerd
  if (isBrowser) return javascriptRuntimes.browser
  return 'unknown'
}
