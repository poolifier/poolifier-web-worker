import {
  availableParallelism,
  PoolTypes,
  WorkerTypes,
} from '../../src/index.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import { runPoolifierPoolDenoBenchmark } from '../benchmarks-utils.mjs'

const poolSize = availableParallelism()
const taskExecutions = 1
const workerData = {
  function: TaskFunctions.jsonIntegerSerialization,
  taskSize: 1000,
}

// FixedThreadPool
await runPoolifierPoolDenoBenchmark(
  'Poolifier FixedThreadPool',
  WorkerTypes.web,
  PoolTypes.fixed,
  poolSize,
  {
    taskExecutions,
    workerData,
  },
)

// DynamicThreadPool
await runPoolifierPoolDenoBenchmark(
  'Poolifier DynamicThreadPool',
  WorkerTypes.web,
  PoolTypes.dynamic,
  poolSize,
  {
    taskExecutions,
    workerData,
  },
)
