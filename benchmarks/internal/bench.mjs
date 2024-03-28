import { availableParallelism, PoolTypes, WorkerTypes } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  runPoolifierPoolBenchmark,
  runPoolifierPoolDenoBenchmark,
} from '../benchmarks-utils.mjs'
import { parseArgs } from '@std/cli/parse_args'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.factorial,
  taskSize: 50000,
}

switch (parseArgs(Deno.args).t) {
  case 'javascript':
    await runPoolifierPoolBenchmark(
      'FixedThreadPool',
      WorkerTypes.web,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData,
      },
    )
    await runPoolifierPoolBenchmark(
      'DynamicThreadPool',
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
  case 'deno':
  default:
    runPoolifierPoolDenoBenchmark(
      'FixedThreadPool',
      WorkerTypes.web,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData,
      },
    )
    runPoolifierPoolDenoBenchmark(
      'DynamicThreadPool',
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
