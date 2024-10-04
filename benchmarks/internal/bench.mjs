import { availableParallelism, PoolTypes, WorkerTypes } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  runPoolifierBenchmarkDenoBench,
  runPoolifierBenchmarkTatamiNg,
  runtime,
} from '../benchmarks-utils.mjs'
import { bmf } from '@poolifier/tatami-ng'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 1000,
}
const benchmarkReportFile = 'benchmark-report.json'
let benchmarkReport

const runBenchmark = async () => {
  const fixedThreadPoolGroupname = `FixedThreadPool on ${runtime}`
  const dynamicThreadPoolGroupname = `DynamicThreadPool on ${runtime}`
  return await {
    browser: () => {
      throw new Error('Benchmark on a browser runtime is not supported')
    },
    deno: async () => {
      const { parseArgs } = await import('@std/cli/parse-args')
      switch (parseArgs(Deno.args).t) {
        case 'tatami-ng':
          benchmarkReport = bmf(
            await runPoolifierBenchmarkTatamiNg(
              fixedThreadPoolGroupname,
              WorkerTypes.web,
              PoolTypes.fixed,
              poolSize,
              {
                taskExecutions,
                workerData,
              },
            ),
          )
          benchmarkReport = {
            ...benchmarkReport,
            ...bmf(
              await runPoolifierBenchmarkTatamiNg(
                dynamicThreadPoolGroupname,
                WorkerTypes.web,
                PoolTypes.dynamic,
                poolSize,
                {
                  taskExecutions,
                  workerData,
                },
              ),
            ),
          }
          Deno.env.get('CI') != null &&
            Deno.writeTextFileSync(
              benchmarkReportFile,
              JSON.stringify(benchmarkReport),
            )
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
            type: {
              type: 'string',
              short: 't',
            },
          },
          strict: true,
          allowPositionals: true,
        }).values.type
      ) {
        case 'tatami-ng':
        default:
          benchmarkReport = bmf(
            await runPoolifierBenchmarkTatamiNg(
              fixedThreadPoolGroupname,
              WorkerTypes.web,
              PoolTypes.fixed,
              poolSize,
              {
                taskExecutions,
                workerData,
              },
            ),
          )
          benchmarkReport = {
            ...benchmarkReport,
            ...bmf(
              await runPoolifierBenchmarkTatamiNg(
                dynamicThreadPoolGroupname,
                WorkerTypes.web,
                PoolTypes.dynamic,
                poolSize,
                {
                  taskExecutions,
                  workerData,
                },
              ),
            ),
          }
          Bun.env.CI != null &&
            (await Bun.write(
              benchmarkReportFile,
              JSON.stringify(benchmarkReport),
            ))
          break
      }
    },
  }[runtime]()
}

await runBenchmark()
