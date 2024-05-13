import { availableParallelism, PoolTypes, WorkerTypes } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  convertTatamiNgToBmf,
  runPoolifierBenchmarkDenoBench,
  runPoolifierBenchmarkTatamiNg,
  runtime,
} from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 1000,
}
const benchmarkReportFile = 'benchmark-report.json'
let benchmarkReport

const unsupportedJsRuntime = () => {
  console.error(`Unsupported JavaScript runtime environment: ${runtime}`)
}

const runBenchmark = async () => {
  const fixedThreadPoolGroupname = `FixedThreadPool on ${runtime}`
  const dynamicThreadPoolGroupname = `DynamicThreadPool on ${runtime}`
  return await {
    unknown: () => console.error('Unknown JavaScript runtime environment'),
    browser: unsupportedJsRuntime,
    deno: async () => {
      const { parseArgs } = await import('@std/cli/parse-args')
      switch (parseArgs(Deno.args).t) {
        case 'tatami-ng':
          benchmarkReport = convertTatamiNgToBmf(
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
            ...(await runPoolifierBenchmarkTatamiNg(
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
          benchmarkReport = convertTatamiNgToBmf(
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
            ...convertTatamiNgToBmf(
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
    node: unsupportedJsRuntime,
    workerd: unsupportedJsRuntime,
  }[runtime]()
}

await runBenchmark()
