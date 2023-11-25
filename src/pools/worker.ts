import type { CircularArray } from '../circular-array.ts'
import type { Task } from '../utility-types.ts'

/**
 * Callback invoked if the worker has received a message event.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export type MessageEventHandler<Data = unknown> = (
  e: MessageEvent<Data>,
) => void

/**
 * Callback invoked if the worker raised an error at processing a message event.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export type MessageEventErrorHandler<Data = unknown> = (
  e: MessageEvent<Data>,
) => void

/**
 * Callback invoked if the worker raised an error event.
 */
export type ErrorEventHandler = (e: ErrorEvent) => void

/**
 * Measurement statistics.
 *
 * @internal
 */
export interface MeasurementStatistics {
  /**
   * Measurement aggregate.
   */
  aggregate?: number
  /**
   * Measurement minimum.
   */
  minimum?: number
  /**
   * Measurement maximum.
   */
  maximum?: number
  /**
   * Measurement average.
   */
  average?: number
  /**
   * Measurement median.
   */
  median?: number
  /**
   * Measurement history.
   */
  readonly history: CircularArray<number>
}

/**
 * Event loop utilization measurement statistics.
 *
 * @internal
 */
export interface EventLoopUtilizationMeasurementStatistics {
  readonly idle: MeasurementStatistics
  readonly active: MeasurementStatistics
  utilization?: number
}

/**
 * Task statistics.
 *
 * @internal
 */
export interface TaskStatistics {
  /**
   * Number of executed tasks.
   */
  executed: number
  /**
   * Number of executing tasks.
   */
  executing: number
  /**
   * Number of queued tasks.
   */
  readonly queued: number
  /**
   * Maximum number of queued tasks.
   */
  readonly maxQueued?: number
  /**
   * Number of sequentially stolen tasks.
   */
  sequentiallyStolen: number
  /**
   * Number of stolen tasks.
   */
  stolen: number
  /**
   * Number of failed tasks.
   */
  failed: number
}

/**
 * Enumeration of worker types.
 */
export const WorkerTypes = Object.freeze(
  {
    web: 'web',
  } as const,
)

/**
 * Worker type.
 */
export type WorkerType = keyof typeof WorkerTypes

/**
 * Worker information.
 *
 * @internal
 */
export interface WorkerInfo {
  /**
   * Worker id.
   */
  readonly id: string | undefined
  /**
   * Worker type.
   */
  readonly type: WorkerType
  /**
   * Dynamic flag.
   */
  dynamic: boolean
  /**
   * Ready flag.
   */
  ready: boolean
  /**
   * Task function names.
   */
  taskFunctionNames?: string[]
}

/**
 * Worker usage statistics.
 *
 * @internal
 */
export interface WorkerUsage {
  /**
   * Tasks statistics.
   */
  readonly tasks: TaskStatistics
  /**
   * Tasks runtime statistics.
   */
  readonly runTime: MeasurementStatistics
  /**
   * Tasks wait time statistics.
   */
  readonly waitTime: MeasurementStatistics
  /**
   * Tasks event loop utilization statistics.
   */
  readonly elu: EventLoopUtilizationMeasurementStatistics
}

/**
 * Worker choice strategy data.
 *
 * @internal
 */
export interface StrategyData {
  virtualTaskEndTimestamp?: number
}

/**
 * Worker interface.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export interface IWorker<Data = unknown> {
  /**
   * Worker `message` event handler.
   */
  onmessage?: MessageEventHandler<Data>
  /**
   * Worker `messageerror` event handler.
   */
  onmessageerror?: MessageEventErrorHandler<Data>
  /**
   * Worker `error` event handler.
   */
  onerror?: ErrorEventHandler
  /**
   * Terminates the worker.
   */
  terminate: () => void
}

/**
 * Worker node event detail.
 *
 * @internal
 */
export interface WorkerNodeEventDetail {
  workerId: string
  workerNodeKey?: number
}

/**
 * Worker node interface.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface IWorkerNode<Worker extends IWorker<Data>, Data = unknown>
  extends EventTarget {
  /**
   * Worker.
   */
  readonly worker: Worker
  /**
   * Worker info.
   */
  readonly info: WorkerInfo
  /**
   * Worker usage statistics.
   */
  readonly usage: WorkerUsage
  /**
   * Worker choice strategy data.
   * This is used to store data that are specific to the worker choice strategy.
   */
  strategyData?: StrategyData
  /**
   * Message channel (worker_threads only).
   */
  readonly messageChannel?: MessageChannel
  /**
   * Tasks queue back pressure size.
   * This is the number of tasks that can be enqueued before the worker node has back pressure.
   */
  tasksQueueBackPressureSize: number
  /**
   * Tasks queue size.
   *
   * @returns The tasks queue size.
   */
  readonly tasksQueueSize: () => number
  /**
   * Enqueue task.
   *
   * @param task - The task to queue.
   * @returns The tasks queue size.
   */
  readonly enqueueTask: (task: Task<Data>) => number
  /**
   * Prepends a task to the tasks queue.
   *
   * @param task - The task to prepend.
   * @returns The tasks queue size.
   */
  readonly unshiftTask: (task: Task<Data>) => number
  /**
   * Dequeue task.
   *
   * @returns The dequeued task.
   */
  readonly dequeueTask: () => Task<Data> | undefined
  /**
   * Pops a task from the tasks queue.
   *
   * @returns The popped task.
   */
  readonly popTask: () => Task<Data> | undefined
  /**
   * Clears tasks queue.
   */
  readonly clearTasksQueue: () => void
  /**
   * Whether the worker node has back pressure (i.e. its tasks queue is full).
   *
   * @returns `true` if the worker node has back pressure, `false` otherwise.
   */
  readonly hasBackPressure: () => boolean
  /**
   * Resets usage statistics.
   */
  readonly resetUsage: () => void
  /**
   * Terminates the worker node.
   */
  readonly terminate: () => void
  /**
   * Gets task function worker usage statistics.
   *
   * @param name - The task function name.
   * @returns The task function worker usage statistics if the task function worker usage statistics are initialized, `undefined` otherwise.
   */
  readonly getTaskFunctionWorkerUsage: (
    name: string,
  ) => WorkerUsage | undefined
  /**
   * Deletes task function worker usage statistics.
   *
   * @param name - The task function name.
   * @returns `true` if the task function worker usage statistics were deleted, `false` otherwise.
   */
  readonly deleteTaskFunctionWorkerUsage: (name: string) => boolean
}
