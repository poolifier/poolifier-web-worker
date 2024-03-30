import { run } from 'mitata'
import { availableParallelism, PoolTypes, WorkerTypes } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  buildPoolifierBenchmarkMitata,
  runPoolifierBenchmarkBenchmarkJs,
  runPoolifierBenchmarkDenoBench,
  runtime,
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 50000,
}

const unsupportedJsRuntime = () => {
  console.error(`Unsupported JavaScript runtime environment: ${runtime()}`)
}

const runBenchmark = async () => {
  const fixedThreadPoolGroupname = `FixedThreadPool on ${runtime()}`
  const dynamicThreadPoolGroupname = `DynamicThreadPool on ${runtime()}`
  return await {
    unknown: () => console.error('Unknown JavaScript runtime environment'),
    browser: unsupportedJsRuntime,
    deno: async () => {
      const { parseArgs } = await import('@std/cli/parse_args')
      switch (parseArgs(Deno.args).t) {
        case 'benchmark.js':
          await runPoolifierBenchmarkBenchmarkJs(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          await runPoolifierBenchmarkBenchmarkJs(
            dynamicThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.dynamic,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          Deno.exit()
          break
        case 'mitata':
          buildPoolifierBenchmarkMitata(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          buildPoolifierBenchmarkMitata(
            dynamicThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.dynamic,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          await run()
          break
        default:
          runPoolifierBenchmarkDenoBench(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          runPoolifierBenchmarkDenoBench(
            dynamicThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.dynamic,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          break
      }
    },
    bun: async () => {
      const { parseArgs } = await import('util')
      switch (
        parseArgs({
          args: Bun.argv,
          options: {
            t: {
              type: 'string',
            },
          },
          strict: true,
          allowPositionals: true,
        }).t
      ) {
        case 'benchmark.js':
          await runPoolifierBenchmarkBenchmarkJs(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          await runPoolifierBenchmarkBenchmarkJs(
            dynamicThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.dynamic,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          break
        case 'mitata':
        default:
          buildPoolifierBenchmarkMitata(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          buildPoolifierBenchmarkMitata(
            dynamicThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.dynamic,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          await run()
          break
      }
    },
    node: unsupportedJsRuntime,
    workerd: unsupportedJsRuntime,
  }[runtime()]()
}

await runBenchmark()
