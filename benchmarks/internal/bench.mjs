import { availableParallelism, PoolTypes, WorkerTypes } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import {
  runPoolifierPoolBenchmark,
  runPoolifierPoolDenoBenchmark,
} from '../benchmarks-utils.mjs'
import { parseArgs } from 'https://deno.land/std@0.208.0/cli/parse_args.ts'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.jsonIntegerSerialization,
  taskSize: 1000,
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
    break
  case 'deno':
  default:
    await runPoolifierPoolDenoBenchmark(
      'FixedThreadPool',
      WorkerTypes.web,
      PoolTypes.fixed,
      poolSize,
      {
        taskExecutions,
        workerData,
      },
    )
    await runPoolifierPoolDenoBenchmark(
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
Deno.exit()
