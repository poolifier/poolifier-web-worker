import type { CircularBuffer } from '../circular-buffer.ts'
import type { Task, TaskFunctionProperties } from '../utility-types.ts'

/**
 * Callback invoked if the worker has received a message event.
 */
export type MessageEventHandler =
  // deno-lint-ignore no-explicit-any
  ((ev: MessageEvent<any>) => any) | null

/**
 * Callback invoked if the worker raised an error at processing a message event.
 */
export type MessageEventErrorHandler =
  // deno-lint-ignore no-explicit-any
  ((ev: MessageEvent<any>) => any) | null

/**
 * Callback invoked if the worker raised an error event.
 */
export type ErrorEventHandler =
  // deno-lint-ignore no-explicit-any
  ((ev: ErrorEvent) => any) | null

/**
 * Measurement history size.
 */
export const MeasurementHistorySize = 386

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
  readonly history: CircularBuffer
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
export const WorkerTypes: Readonly<{ web: 'web' }> = Object.freeze(
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
  readonly id: `${string}-${string}-${string}-${string}-${string}` | undefined
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
   * Stealing flag.
   * This flag is set to `true` when worker node is stealing one task from another worker node.
   */
  stealing: boolean
  /**
   * Stolen flag.
   * This flag is set to `true` when worker node has one task stolen from another worker node.
   */
  stolen: boolean
  /**
   * Continuous stealing flag.
   * This flag is set to `true` when worker node is continuously stealing tasks from other worker nodes.
   */
  continuousStealing: boolean
  /**
   * Back pressure stealing flag.
   * This flag is set to `true` when worker node is stealing one task from another back pressured worker node.
   */
  backPressureStealing: boolean
  /**
   * Back pressure flag.
   * This flag is set to `true` when worker node tasks queue is back pressured.
   */
  backPressure: boolean
  /**
   * Task functions properties.
   */
  taskFunctionsProperties?: TaskFunctionProperties[]
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
 */
export interface IWorker extends EventTarget {
  /**
   * Worker `message` event handler.
   */
  onmessage: MessageEventHandler
  /**
   * Worker `messageerror` event handler.
   */
  onmessageerror: MessageEventErrorHandler
  /**
   * Worker `error` event handler.
   */
  onerror: ErrorEventHandler
  /**
   * Clones message and transmits it to worker's global environment. transfer can be passed as a list of objects that are to be transferred rather than cloned.
   *
   * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Worker/postMessage)
   */
  // deno-lint-ignore no-explicit-any
  postMessage(message: any, transfer: Transferable[]): void
  // deno-lint-ignore no-explicit-any
  postMessage(message: any, options?: StructuredSerializeOptions): void
  /**
   * Terminates the worker.
   */
  terminate: () => void
  addEventListener<K extends keyof WorkerEventMap>(
    type: K,
    // deno-lint-ignore no-explicit-any
    listener: (this: this, ev: WorkerEventMap[K]) => any,
    options?: boolean | AddEventListenerOptions,
  ): void
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void
  removeEventListener<K extends keyof WorkerEventMap>(
    type: K,
    // deno-lint-ignore no-explicit-any
    listener: (this: this, ev: WorkerEventMap[K]) => any,
    options?: boolean | EventListenerOptions,
  ): void
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void
}

/**
 * Worker node options.
 *
 * @internal
 */
export interface WorkerNodeOptions {
  workerOptions?: WorkerOptions
  tasksQueueBackPressureSize: number | undefined
  tasksQueueBucketSize: number | undefined
  tasksQueuePriority: boolean | undefined
}

/**
 * Worker node interface.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface IWorkerNode<Worker extends IWorker, Data = unknown>
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
   * Message channel (worker thread only).
   */
  readonly messageChannel?: MessageChannel
  /**
   * Tasks queue back pressure size.
   * This is the number of tasks that can be enqueued before the worker node has back pressure.
   */
  tasksQueueBackPressureSize: number
  /**
   * Sets tasks queue priority.
   *
   * @param enablePriority - Whether to enable tasks queue priority.
   */
  readonly setTasksQueuePriority: (enablePriority: boolean) => void
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
   * Dequeue task.
   *
   * @returns The dequeued task.
   */
  readonly dequeueTask: (bucket?: number) => Task<Data> | undefined
  /**
   * Dequeue last prioritized task.
   *
   * @returns The dequeued task.
   */
  readonly dequeueLastPrioritizedTask: () => Task<Data> | undefined
  /**
   * Clears tasks queue.
   */
  readonly clearTasksQueue: () => void
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
  readonly getTaskFunctionWorkerUsage: (name: string) => WorkerUsage | undefined
  /**
   * Deletes task function worker usage statistics.
   *
   * @param name - The task function name.
   * @returns `true` if the task function worker usage statistics were deleted, `false` otherwise.
   */
  readonly deleteTaskFunctionWorkerUsage: (name: string) => boolean
}

/**
 * Worker node event detail.
 *
 * @internal
 */
export interface WorkerNodeEventDetail {
  workerId?: `${string}-${string}-${string}-${string}-${string}`
  workerNodeKey?: number
}
