// FIXME: cleanup exported modules
export type { AbstractPool } from './pools/abstract-pool.ts'
export { PoolEvents, PoolTypes } from './pools/pool.ts'
export type {
  IPool,
  PoolEvent,
  PoolInfo,
  PoolOptions,
  PoolType,
  TasksQueueOptions,
} from './pools/pool.ts'
export { WorkerTypes } from './pools/worker.ts'
export type {
  ErrorEventHandler,
  EventLoopUtilizationMeasurementStatistics,
  IWorker,
  IWorkerNode,
  MeasurementStatistics,
  MessageEventErrorHandler,
  MessageEventHandler,
  StrategyData,
  TaskStatistics,
  WorkerInfo,
  WorkerType,
  WorkerUsage,
} from './pools/worker.ts'
export {
  Measurements,
  WorkerChoiceStrategies,
} from './pools/selection-strategies/selection-strategies-types.ts'
export type {
  IWorkerChoiceStrategy,
  Measurement,
  MeasurementOptions,
  MeasurementStatisticsRequirements,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './pools/selection-strategies/selection-strategies-types.ts'
export { DynamicThreadPool } from './pools/thread/dynamic.ts'
export {
  FixedThreadPool,
  type ThreadPoolOptions,
} from './pools/thread/fixed.ts'
export type { AbstractWorker } from './worker/abstract-worker.ts'
export { ThreadWorker } from './worker/thread-worker.ts'
export { KillBehaviors } from './worker/worker-options.ts'
export type {
  KillBehavior,
  KillHandler,
  WorkerOptions,
} from './worker/worker-options.ts'
export type {
  TaskAsyncFunction,
  TaskFunction,
  TaskFunctionOperationResult,
  TaskFunctions,
  TaskSyncFunction,
} from './worker/task-functions.ts'
export type {
  MessageValue,
  PromiseResponseWrapper,
  Task,
  TaskPerformance,
  WorkerError,
  WorkerStatistics,
  Writable,
} from './utility-types.ts'
export { CircularArray, DEFAULT_CIRCULAR_ARRAY_SIZE } from './circular-array.ts'
export { Deque, type Node } from './deque.ts'
export { WorkerNode } from './pools/worker-node.ts'
export { availableParallelism } from './utils.ts'
