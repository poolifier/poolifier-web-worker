import type { WorkerChoiceStrategy } from './pools/selection-strategies/selection-strategies-types.ts'
import type { KillBehavior } from './worker/worker-options.ts'

/**
 * UUID returned by the Web Crypto API.
 *
 * @internal
 */
export type UUID = `${string}-${string}-${string}-${string}-${string}`

/**
 * Worker error.
 *
 * @typeParam Data - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
 */
export interface WorkerError<Data = unknown> {
  /**
   * Whether the error is an abort error or not.
   */
  readonly aborted: boolean
  /**
   * Data triggering the error.
   * Transferred task errors expose the original pool input without returning ownership.
   * Worker-side errors omit transferred input data.
   */
  readonly data?: Data
  /**
   * Error object.
   */
  readonly error: Error
  /**
   * Task function name triggering the error.
   */
  readonly name?: string
}

/**
 * Event loop utilization.
 */
interface EventLoopUtilization {
  idle: number
  active: number
  utilization: number
}

/**
 * Task performance.
 *
 * @internal
 */
export interface TaskPerformance {
  /**
   * Task name.
   */
  readonly name: string
  /**
   * Task performance timestamp.
   */
  readonly timestamp: number
  /**
   * Task runtime.
   */
  readonly runTime?: number
  /**
   * Task event loop utilization.
   */
  readonly elu?: EventLoopUtilization
}

/**
 * Worker task performance statistics computation settings.
 *
 * @internal
 */
export interface WorkerStatistics {
  /**
   * Whether the worker computes the task runtime or not.
   */
  readonly runTime: boolean
  // /**
  //  * Whether the worker computes the task event loop utilization (ELU) or not.
  //  */
  // readonly elu: boolean
}

/**
 * Task function properties.
 */
export interface TaskFunctionProperties {
  /**
   * Task function name.
   */
  readonly name: string
  /**
   * Task function priority. Lower values have higher priority.
   */
  readonly priority?: number
  /**
   * Task function worker choice strategy.
   */
  readonly strategy?: WorkerChoiceStrategy
  /**
   * Task function worker node keys affinity.
   * Restricts initial task dispatch to specified worker nodes by their indices.
   * Task stealing ignores affinity.
   * Must contain valid indices within [0, pool max size - 1].
   * If undefined, task can execute on any worker node.
   */
  readonly workerNodeKeys?: number[]
}

/**
 * Message object that is passed as a task between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @internal
 */
export interface Task<Data = unknown> {
  /**
   * Whether the task is abortable or not.
   */
  readonly abortable?: boolean
  /**
   * Task name.
   */
  readonly name?: string
  /**
   * Task input data that will be passed to the worker.
   */
  readonly data?: Data
  /**
   * Task priority. Lower values have higher priority.
   *
   * @defaultValue 0
   */
  readonly priority?: number
  /**
   * Task worker choice strategy.
   */
  readonly strategy?: WorkerChoiceStrategy
  /**
   * Array of transferable objects.
   */
  readonly transferList?: readonly Transferable[]
  /**
   * Timestamp.
   */
  readonly timestamp?: number
  /**
   * Task UUID.
   */
  readonly taskId?: UUID
}

/**
 * Message object that is passed between main worker and worker.
 *
 * @typeParam Data - Type of data sent to the worker or execution response. This can only be structured-cloneable data.
 * @typeParam ErrorData - Type of data sent to the worker triggering an error. This can only be structured-cloneable data.
 * @internal
 */
export interface MessageValue<Data = unknown, ErrorData = unknown>
  extends Task<Data> {
  /**
   * Worker id.
   */
  readonly workerId?: `${string}-${string}-${string}-${string}-${string}`
  /**
   * Kill code.
   */
  readonly kill?: KillBehavior | true | 'success' | 'failure'
  /**
   * Worker error.
   */
  readonly workerError?: WorkerError<ErrorData>
  /**
   * Task performance.
   */
  readonly taskPerformance?: TaskPerformance
  /**
   * Task function operation:
   * - `'add'` - Add a task function.
   * - `'remove'` - Remove a task function.
   * - `'default'` - Set a task function as default.
   */
  readonly taskFunctionOperation?: 'add' | 'remove' | 'default'
  /**
   * Task function operation request UUID.
   */
  readonly taskFunctionOperationId?: UUID
  /**
   * Whether removal confirmed that the requested task function was absent.
   */
  readonly taskFunctionOperationNotFound?: boolean
  /**
   * Whether the task function operation is successful or not.
   */
  readonly taskFunctionOperationStatus?: boolean
  /**
   * Task function properties.
   */
  readonly taskFunctionProperties?: TaskFunctionProperties
  /**
   * Task function serialized to string.
   */
  readonly taskFunction?: string
  /**
   * Task function properties.
   */
  readonly taskFunctionsProperties?: TaskFunctionProperties[]
  /**
   * Task operation:
   * - `'abort'` - Abort a task.
   */
  readonly taskOperation?: 'abort'
  /**
   * Whether the worker computes the given statistics or not.
   */
  readonly statistics?: WorkerStatistics
  /**
   * Whether the worker is ready or not.
   */
  readonly ready?: boolean
  /**
   * Whether the worker starts or stops its activity check.
   */
  readonly checkActive?: boolean
  /**
   * Message port.
   */
  readonly port?: MessagePort
}

/**
 * An object holding the task execution response promise resolve/reject callbacks.
 *
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @internal
 */
export interface PromiseResponseWrapper<Response = unknown> {
  /**
   * Original task input retained when its transfer list is nonempty.
   */
  readonly originalData?: unknown
  /**
   * The task abort signal.
   */
  readonly abortSignal?: AbortSignal
  /**
   * Resolve callback to fulfill the promise.
   */
  readonly resolve: (value: Response | PromiseLike<Response>) => void
  /**
   * Reject callback to reject the promise.
   */
  readonly reject: (reason?: unknown) => void
  /**
   * The worker node key owning the task, or -1 after its removal.
   */
  workerNodeKey: number
}

/**
 * Remove readonly modifier from all properties of T.
 * @typeParam T - Type to remove readonly modifier.
 * @internal
 */
export type Writable<T> = { -readonly [P in keyof T]: T[P] }
