import { availableParallelism, PoolTypes, WorkerTypes } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  envGet,
  exit,
  runPoolifierBenchmarkDenoBench,
  runPoolifierBenchmarkTinyBench,
  runtime,
  writeFile,
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 1000,
}
const benchmarkReportFile = 'benchmark-report.json'

const runBenchmark = async () => {
  let benchmarkReport = {}

  const fixedThreadPoolGroupname = `FixedThreadPool on ${runtime}`
  const dynamicThreadPoolGroupname = `DynamicThreadPool on ${runtime}`
  return await {
    browser: () => {
      throw new Error('Benchmark on a browser runtime is not supported')
    },
    deno: async () => {
      const { parseArgs } = await import('@std/cli/parse-args')
      switch (parseArgs(Deno.args).t) {
        case 'tinybench':
          benchmarkReport = await runPoolifierBenchmarkTinyBench(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          benchmarkReport = {
            ...benchmarkReport,
            ...(await runPoolifierBenchmarkTinyBench(
              dynamicThreadPoolGroupname,
              WorkerTypes.web,
              PoolTypes.dynamic,
              poolSize,
              {
                taskExecutions,
                workerData,
              },
            )),
          }
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
      return benchmarkReport
    },
    bun: async () => {
      const { parseArgs } = await import('util')
      switch (
        parseArgs({
          args: Bun.argv,
          options: {
            type: {
              type: 'string',
              short: 't',
            },
          },
          strict: true,
          allowPositionals: true,
        }).values.type
      ) {
        case 'tinybench':
        default:
          benchmarkReport = await runPoolifierBenchmarkTinyBench(
            fixedThreadPoolGroupname,
            WorkerTypes.web,
            PoolTypes.fixed,
            poolSize,
            {
              taskExecutions,
              workerData,
            },
          )
          benchmarkReport = {
            ...benchmarkReport,
            ...(await runPoolifierBenchmarkTinyBench(
              dynamicThreadPoolGroupname,
              WorkerTypes.web,
              PoolTypes.dynamic,
              poolSize,
              {
                taskExecutions,
                workerData,
              },
            )),
          }
          break
      }
      return benchmarkReport
    },
  }[runtime]()
}

try {
  const benchmarkReport = await runBenchmark()
  if (envGet('CI') != null) {
    await writeFile(benchmarkReportFile, JSON.stringify(benchmarkReport))
  }
} catch (error) {
  console.error(error)
  exit(1)
}
