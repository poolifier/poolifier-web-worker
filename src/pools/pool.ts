import type { TaskFunctionProperties } from '../utility-types.ts'
import type {
  TaskFunction,
  TaskFunctionObject,
} from '../worker/task-functions.ts'
import type {
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies/selection-strategies-types.ts'
import type {
  ErrorEventHandler,
  IWorker,
  IWorkerNode,
  MessageEventErrorHandler,
  MessageEventHandler,
  WorkerType,
} from './worker.ts'

/**
 * Enumeration of pool types.
 */
export const PoolTypes: Readonly<{ fixed: 'fixed'; dynamic: 'dynamic' }> =
  Object.freeze(
    {
      /**
       * Fixed pool type.
       */
      fixed: 'fixed',
      /**
       * Dynamic pool type.
       */
      dynamic: 'dynamic',
    } as const,
  )

/**
 * Pool type.
 */
export type PoolType = keyof typeof PoolTypes

/**
 * Enumeration of pool events.
 */
export const PoolEvents: Readonly<{
  ready: 'ready'
  busy: 'busy'
  busyEnd: 'busyEnd'
  full: 'full'
  fullEnd: 'fullEnd'
  empty: 'empty'
  destroy: 'destroy'
  error: 'error'
  messageerror: 'messageerror'
  taskError: 'taskError'
  backPressure: 'backPressure'
  backPressureEnd: 'backPressureEnd'
}> = Object.freeze(
  {
    ready: 'ready',
    busy: 'busy',
    busyEnd: 'busyEnd',
    full: 'full',
    fullEnd: 'fullEnd',
    empty: 'empty',
    destroy: 'destroy',
    error: 'error',
    messageerror: 'messageerror',
    taskError: 'taskError',
    backPressure: 'backPressure',
    backPressureEnd: 'backPressureEnd',
  } as const,
)

/**
 * Pool event.
 */
export type PoolEvent = keyof typeof PoolEvents

/**
 * Pool information.
 */
export interface PoolInfo {
  readonly version: string
  readonly type: PoolType
  readonly worker: WorkerType
  readonly started: boolean
  readonly ready: boolean
  readonly defaultStrategy: WorkerChoiceStrategy
  readonly strategyRetries: number
  readonly minSize: number
  readonly maxSize: number
  /** Pool utilization. */
  readonly utilization?: number
  /** Pool total worker nodes. */
  readonly workerNodes: number
  /** Pool dynamic worker nodes. */
  readonly dynamicWorkerNodes?: number
  /** Pool idle worker nodes. */
  readonly idleWorkerNodes: number
  /** Pool busy worker nodes. */
  readonly busyWorkerNodes: number
  /** Pool tasks stealing worker nodes. */
  readonly stealingWorkerNodes?: number
  /** Pool tasks back pressure worker nodes. */
  readonly backPressureWorkerNodes?: number
  readonly executedTasks: number
  readonly executingTasks: number
  readonly queuedTasks?: number
  readonly maxQueuedTasks?: number
  readonly backPressure?: boolean
  readonly stolenTasks?: number
  readonly failedTasks: number
  readonly runTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average?: number
    readonly median?: number
  }
  readonly waitTime?: {
    readonly minimum: number
    readonly maximum: number
    readonly average?: number
    readonly median?: number
  }
}

/**
 * Worker node tasks queue options.
 */
export interface TasksQueueOptions {
  /**
   * Maximum tasks queue size per worker node flagging it as back pressured.
   *
   * @defaultValue (pool maximum size)^2
   */
  readonly size?: number
  /**
   * Maximum number of tasks that can be executed concurrently on a worker node.
   *
   * @defaultValue 1
   */
  readonly concurrency?: number
  /**
   * Whether to enable task stealing on idle.
   *
   * @defaultValue true
   */
  readonly taskStealing?: boolean
  /**
   * Whether to enable tasks stealing under back pressure.
   *
   * @defaultValue true
   */
  readonly tasksStealingOnBackPressure?: boolean
  /**
   * Ratio of worker nodes that can steal tasks from another worker node.
   *
   * @defaultValue 0.6
   */
  readonly tasksStealingRatio?: number
  /**
   * Queued tasks finished timeout in milliseconds at worker node termination.
   *
   * @defaultValue 2000
   */
  readonly tasksFinishedTimeout?: number
}

/**
 * Options for a poolifier pool.
 */
export interface PoolOptions {
  /**
   * A function that will listen for message event on each worker.
   *
   * @defaultValue `() => {}`
   */
  messageEventHandler?: MessageEventHandler
  /**
   * A function that will listen for message event processing error on each worker.
   *
   * @defaultValue `() => {}`
   */
  messageEventErrorHandler?: MessageEventErrorHandler
  /**
   * A function that will listen for error event on each worker.
   *
   * @defaultValue `() => {}`
   */
  errorEventHandler?: ErrorEventHandler
  /**
   * Whether to start the minimum number of workers at pool initialization.
   *
   * @defaultValue true
   */
  startWorkers?: boolean
  /**
   * The default worker choice strategy to use in this pool.
   *
   * @defaultValue WorkerChoiceStrategies.ROUND_ROBIN
   */
  workerChoiceStrategy?: WorkerChoiceStrategy
  /**
   * The worker choice strategy options.
   */
  workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions
  /**
   * Restart worker on error.
   */
  restartWorkerOnError?: boolean
  /**
   * Pool events emission.
   *
   * @defaultValue true
   */
  enableEvents?: boolean
  /**
   * Pool worker node tasks queue.
   *
   * @defaultValue false
   */
  enableTasksQueue?: boolean
  /**
   * Pool worker node tasks queue options.
   */
  tasksQueueOptions?: TasksQueueOptions
  /**
   * Worker options.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#options
   */
  workerOptions?: WorkerOptions
}

/**
 * Contract definition for a poolifier pool.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export interface IPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> {
  /**
   * Pool information.
   */
  readonly info: PoolInfo
  /**
   * Pool worker nodes.
   *
   * @internal
   */
  readonly workerNodes: IWorkerNode<Worker, Data>[]
  /**
   * Pool event target.
   *
   * Events that can currently be listened to:
   *
   * - `'ready'`: Emitted when the number of workers created in the pool has reached the minimum size expected and are ready. If the pool is dynamic with a minimum number of workers set to zero, this event is emitted when the pool is started.
   * - `'busy'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are executing concurrently their tasks quota.
   * - `'busyEnd'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are no longer executing concurrently their tasks quota.
   * - `'full'`: Emitted when the pool is dynamic and the number of workers created has reached the maximum size expected.
   * - `'fullEnd'`: Emitted when the pool is dynamic and the number of workers created has no longer reached the maximum size expected.
   * - `'empty'`: Emitted when the pool is dynamic with a minimum number of workers set to zero and the number of workers has reached the minimum size expected.
   * - `'destroy'`: Emitted when the pool is destroyed.
   * - `'error'`: Emitted when an uncaught error occurs.
   * - `'messageerror'`: Emitted when an error occurs while processing a message event.
   * - `'taskError'`: Emitted when an error occurs while executing a task.
   * - `'backPressure'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are back pressured (i.e. their tasks queue is full: queue size \>= maximum queue size).
   * - `'backPressureEnd'`: Emitted when the number of workers created in the pool has reached the maximum size expected and are no longer back pressured (i.e. their tasks queue is no longer full: queue size \< maximum queue size).
   */
  readonly eventTarget?: EventTarget
  /**
   * Executes the specified function in the worker constructor with the task data input parameter.
   *
   * @param data - The optional task input data for the specified task function. This can only be structured-cloneable data.
   * @param name - The optional name of the task function to execute. If not specified, the default task function will be executed.
   * @param abortSignal - The optional AbortSignal to abort the task.
   * @param transferList - The optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's web worker and they should not be used in the main thread afterwards.
   * @returns Promise with a task function response that will be fulfilled when the task is completed.
   */
  readonly execute: (
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[],
  ) => Promise<Response>
  /**
   * Executes the specified function in the worker constructor with the tasks data iterable input parameter.
   *
   * @param data - The tasks iterable input data for the specified task function. This can only be an iterable of structured-cloneable data.
   * @param name - The optional name of the task function to execute. If not specified, the default task function will be executed.
   * @param abortSignals - The optional iterable of AbortSignal to abort the tasks iterable.
   * @param transferList - The optional array of transferable objects to transfer ownership of. Ownership of the transferred objects is given to the chosen pool's worker_threads worker and they should not be used in the main thread afterwards.
   * @returns Promise with an array of task function responses that will be fulfilled when the tasks are completed.
   */
  readonly mapExecute: (
    data: Iterable<Data>,
    name?: string,
    abortSignals?: Iterable<AbortSignal>,
    transferList?: readonly Transferable[],
  ) => Promise<Response[]>
  /**
   * Starts the minimum number of workers in this pool.
   */
  readonly start: () => void
  /**
   * Terminates all workers in this pool.
   */
  readonly destroy: () => Promise<void>
  /**
   * Whether the specified task function exists in this pool.
   *
   * @param name - The name of the task function.
   * @returns `true` if the task function exists, `false` otherwise.
   */
  readonly hasTaskFunction: (name: string) => boolean
  /**
   * Adds a task function to this pool.
   * If a task function with the same name already exists, it will be overwritten.
   *
   * @param name - The name of the task function.
   * @param fn - The task function.
   * @returns `true` if the task function was added, `false` otherwise.
   * @throws {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError} If the `name` parameter is not a string or an empty string.
   * @throws {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/TypeError} If the `fn` parameter is not a function or task function object.
   */
  readonly addTaskFunction: (
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>,
  ) => Promise<boolean>
  /**
   * Removes a task function from this pool.
   *
   * @param name - The name of the task function.
   * @returns `true` if the task function was removed, `false` otherwise.
   */
  readonly removeTaskFunction: (name: string) => Promise<boolean>
  /**
   * Lists the properties of task functions available in this pool.
   *
   * @returns The properties of task functions available in this pool.
   */
  readonly listTaskFunctionsProperties: () => TaskFunctionProperties[]
  /**
   * Sets the default task function in this pool.
   *
   * @param name - The name of the task function.
   * @returns `true` if the default task function was set, `false` otherwise.
   */
  readonly setDefaultTaskFunction: (name: string) => Promise<boolean>
  /**
   * Sets the default worker choice strategy in this pool.
   *
   * @param workerChoiceStrategy - The default worker choice strategy.
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   */
  readonly setWorkerChoiceStrategy: (
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions,
  ) => void
  /**
   * Sets the worker choice strategy options in this pool.
   *
   * @param workerChoiceStrategyOptions - The worker choice strategy options.
   * @returns `true` if the worker choice strategy options were set, `false` otherwise.
   */
  readonly setWorkerChoiceStrategyOptions: (
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions,
  ) => boolean
  /**
   * Enables/disables the worker node tasks queue in this pool.
   *
   * @param enable - Whether to enable or disable the worker node tasks queue.
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly enableTasksQueue: (
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions,
  ) => void
  /**
   * Sets the worker node tasks queue options in this pool.
   *
   * @param tasksQueueOptions - The worker node tasks queue options.
   */
  readonly setTasksQueueOptions: (tasksQueueOptions: TasksQueueOptions) => void
}
