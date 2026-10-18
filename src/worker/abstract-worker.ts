import type {
  MessageValue,
  Task,
  TaskFunctionProperties,
  TaskPerformance,
  UUID,
  WorkerStatistics,
} from '../utility-types.ts'
import {
  buildTaskFunctionProperties,
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  isAsyncFunction,
  isPlainObject,
  JSRuntime,
  runtime,
} from '../utils.ts'
import { AbortError } from './abort-error.ts'
import type {
  TaskAsyncFunction,
  TaskFunction,
  TaskFunctionObject,
  TaskFunctionOperationResult,
  TaskFunctions,
  TaskSyncFunction,
} from './task-functions.ts'
import {
  checkTaskFunctionName,
  checkValidTaskFunctionObjectEntry,
  checkValidWorkerOptions,
} from './utils.ts'
import { KillBehaviors, type WorkerOptions } from './worker-options.ts'

const DEFAULT_MAX_INACTIVE_TIME = 60000
const DEFAULT_WORKER_OPTIONS: Readonly<WorkerOptions> = Object.freeze({
  /**
   * The kill behavior option on this worker or its default value.
   */
  killBehavior: KillBehaviors.SOFT,
  /**
   * The maximum time to keep this worker active while idle.
   * The pool automatically checks and terminates this worker when the time expires.
   */
  maxInactiveTime: DEFAULT_MAX_INACTIVE_TIME,
  /**
   * The function to call when the worker is killed.
   */
  killHandler: EMPTY_FUNCTION,
})

interface TaskFunctionOperationContext {
  getStore(): UUID | undefined
  run<Args extends unknown[], Result>(
    store: UUID | undefined,
    callback: (...args: Args) => Result,
    ...args: Args
  ): Result
}

class SynchronousTaskFunctionOperationContext
  implements TaskFunctionOperationContext {
  private store?: UUID

  public getStore(): UUID | undefined {
    return this.store
  }

  public run<Args extends unknown[], Result>(
    store: UUID | undefined,
    callback: (...args: Args) => Result,
    ...args: Args
  ): Result {
    const previous = this.store
    this.store = store
    try {
      return callback(...args)
    } finally {
      this.store = previous
    }
  }
}

// Browsers do not provide these native compatibility modules.
const AsyncLocalStorage: (new () => TaskFunctionOperationContext) | undefined =
  runtime !== JSRuntime.browser
    // @ts-ignore Node.js compatibility modules are not public declaration dependencies.
    ? (await import('node:async_hooks')).AsyncLocalStorage
    : undefined
const isPromise:
  | ((value: unknown) => value is Promise<unknown>)
  | undefined = runtime !== JSRuntime.browser
    // @ts-ignore Node.js compatibility modules are not public declaration dependencies.
    ? (await import('node:util/types')).isPromise
    : undefined

/**
 * Base class that implements some shared logic for all poolifier workers.
 *
 * @typeParam MainWorker - Type of main worker.
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be structured-cloneable data.
 */
export abstract class AbstractWorker<
  MainWorker extends Pick<EventTarget, 'addEventListener'>,
  Data = unknown,
  Response = unknown,
> {
  /**
   * Worker id.
   */
  protected abstract readonly id?:
    `${string}-${string}-${string}-${string}-${string}`
  /**
   * Task function(s) object processed by the worker when the pool's `execute` method is invoked.
   */
  protected taskFunctions!: Map<string, TaskFunctionObject<Data, Response>>
  /**
   * Timestamp of the last task processed by this worker.
   */
  protected lastTaskTimestamp!: number
  /**
   * Performance statistics computation requirements.
   */
  protected statistics?: WorkerStatistics
  /**
   * Task abort functions processed by the worker when task operation 'abort' is received.
   */
  protected taskAbortFunctions: Map<UUID, () => void>
  /**
   * Handler id of the `activeInterval` worker activity check.
   */
  protected activeInterval?: ReturnType<typeof setInterval>

  /**
   * Correlation of task function operations across protected handler overrides.
   */
  protected readonly taskFunctionOperationContext:
    TaskFunctionOperationContext = AsyncLocalStorage != null
      ? new AsyncLocalStorage()
      : new SynchronousTaskFunctionOperationContext()

  private readonly taskFunctionOperationIds = new WeakMap<
    TaskFunctionProperties,
    UUID
  >()

  /**
   * Constructs a new poolifier worker.
   * @param isMain - Whether this is the main worker or not.
   * @param mainWorker - Reference to main worker.
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execute` method is invoked. The first function is the default function.
   * @param opts - Options for the worker.
   */
  public constructor(
    private readonly isMain: boolean | undefined,
    private readonly mainWorker: MainWorker | undefined,
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    protected opts: WorkerOptions = DEFAULT_WORKER_OPTIONS,
  ) {
    if (this.isMain == null) {
      throw new Error('isMain parameter is mandatory')
    }
    this.checkTaskFunctions(taskFunctions)
    this.taskAbortFunctions = new Map<UUID, () => void>()
    this.checkWorkerOptions(this.opts)
    if (!this.isMain) {
      this.getMainWorker().addEventListener(
        'message',
        this.handleReadyMessageEvent.bind(this) as EventListener,
        {
          once: true,
        },
      )
    }
  }

  private checkWorkerOptions(opts: WorkerOptions): void {
    checkValidWorkerOptions(opts)
    this.opts = { ...DEFAULT_WORKER_OPTIONS, ...opts }
  }

  /**
   * Checks if the `taskFunctions` parameter is passed to the constructor and valid.
   *
   * @param taskFunctions - The task function(s) parameter that should be checked.
   */
  private checkTaskFunctions(
    taskFunctions:
      | TaskFunction<Data, Response>
      | TaskFunctions<Data, Response>
      | undefined,
  ): void {
    if (taskFunctions == null) {
      throw new Error('taskFunctions parameter is mandatory')
    }
    this.taskFunctions = new Map<string, TaskFunctionObject<Data, Response>>()
    if (typeof taskFunctions === 'function') {
      const fnObj = { taskFunction: taskFunctions.bind(this) }
      this.taskFunctions.set(DEFAULT_TASK_NAME, fnObj)
      this.taskFunctions.set(
        typeof taskFunctions.name === 'string' &&
          taskFunctions.name.trim().length > 0
          ? taskFunctions.name
          : 'fn1',
        fnObj,
      )
    } else if (isPlainObject(taskFunctions)) {
      let firstEntry = true
      for (let [name, fnObj] of Object.entries(taskFunctions)) {
        if (typeof fnObj === 'function') {
          fnObj = { taskFunction: fnObj } satisfies TaskFunctionObject<
            Data,
            Response
          >
        }
        checkValidTaskFunctionObjectEntry<Data, Response>(name, fnObj)
        fnObj.taskFunction = fnObj.taskFunction.bind(this)
        if (firstEntry) {
          this.taskFunctions.set(DEFAULT_TASK_NAME, fnObj)
          firstEntry = false
        }
        this.taskFunctions.set(name, fnObj)
      }
      if (firstEntry) {
        throw new Error('taskFunctions parameter object is empty')
      }
    } else {
      throw new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      )
    }
  }

  /**
   * Checks if the worker has a task function with the given name.
   *
   * @param name - The name of the task function to check.
   * @returns Whether the worker has a task function with the given name or not.
   */
  public hasTaskFunction(name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
    } catch (error) {
      return { status: false, error: error as Error }
    }
    return { status: this.taskFunctions.has(name) }
  }

  /**
   * Adds a task function to the worker.
   * If a task function with the same name already exists, it is replaced.
   *
   * @param name - The name of the task function to add.
   * @param fn - The task function to add.
   * @returns Whether the task function was added or not.
   */
  public addTaskFunction(
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>,
  ): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
      if (name === DEFAULT_TASK_NAME) {
        throw new Error(
          'Cannot add a task function with the default reserved name',
        )
      }
      if (typeof fn === 'function') {
        fn = { taskFunction: fn } satisfies TaskFunctionObject<Data, Response>
      }
      checkValidTaskFunctionObjectEntry<Data, Response>(name, fn)
      fn.taskFunction = fn.taskFunction.bind(this)
      if (
        this.taskFunctions.get(name) ===
          this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        this.taskFunctions.set(DEFAULT_TASK_NAME, fn)
      }
      this.taskFunctions.set(name, fn)
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: true }
    } catch (error) {
      return { status: false, error: error as Error }
    }
  }

  /**
   * Removes a task function from the worker.
   *
   * @param name - The name of the task function to remove.
   * @returns Whether the task function existed and was removed or not.
   */
  public removeTaskFunction(name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
      if (name === DEFAULT_TASK_NAME) {
        throw new Error(
          'Cannot remove the task function with the default reserved name',
        )
      }
      if (
        this.taskFunctions.get(name) ===
          this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        throw new Error(
          'Cannot remove the task function used as the default task function',
        )
      }
      const deleteStatus = this.taskFunctions.delete(name)
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: deleteStatus }
    } catch (error) {
      return { status: false, error: error as Error }
    }
  }

  /**
   * Lists the properties of the worker's task functions.
   *
   * @returns The properties of the worker's task functions.
   */
  public listTaskFunctionsProperties(): TaskFunctionProperties[] {
    let defaultTaskFunctionName = DEFAULT_TASK_NAME
    for (const [name, fnObj] of this.taskFunctions) {
      if (
        name !== DEFAULT_TASK_NAME &&
        fnObj === this.taskFunctions.get(DEFAULT_TASK_NAME)
      ) {
        defaultTaskFunctionName = name
        break
      }
    }
    const taskFunctionsProperties: TaskFunctionProperties[] = []
    for (const [name, fnObj] of this.taskFunctions) {
      if (name === DEFAULT_TASK_NAME || name === defaultTaskFunctionName) {
        continue
      }
      taskFunctionsProperties.push(buildTaskFunctionProperties(name, fnObj))
    }
    return [
      buildTaskFunctionProperties(
        DEFAULT_TASK_NAME,
        this.taskFunctions.get(DEFAULT_TASK_NAME),
      ),
      buildTaskFunctionProperties(
        defaultTaskFunctionName,
        this.taskFunctions.get(defaultTaskFunctionName),
      ),
      ...taskFunctionsProperties,
    ]
  }

  /**
   * Sets the default task function to use in the worker.
   *
   * @param name - The name of the task function to use as default task function.
   * @returns Whether the default task function was set or not.
   */
  public setDefaultTaskFunction(name: string): TaskFunctionOperationResult {
    try {
      checkTaskFunctionName(name)
      if (name === DEFAULT_TASK_NAME) {
        throw new Error(
          'Cannot set the default task function reserved name as the default task function',
        )
      }
      if (!this.taskFunctions.has(name)) {
        throw new Error(
          'Cannot set the default task function to a non-existing task function',
        )
      }
      this.taskFunctions.set(
        DEFAULT_TASK_NAME,
        this.taskFunctions.get(name) as TaskFunctionObject<Data, Response>,
      )
      this.sendTaskFunctionsPropertiesToMainWorker()
      return { status: true }
    } catch (error) {
      return { status: false, error: error as Error }
    }
  }

  /**
   * Handles the ready message event sent by the main worker.
   *
   * @param messageEvent - The ready message event.
   */
  protected abstract handleReadyMessageEvent(
    messageEvent: MessageEvent<MessageValue<Data>>,
  ): void

  /**
   * Worker message event listener.
   *
   * @param messageEvent - The received message event.
   */
  protected messageEventListener(
    messageEvent: MessageEvent<MessageValue<Data>>,
  ): void {
    const { data: message } = messageEvent
    this.checkMessageWorkerId(message)
    const {
      checkActive,
      data,
      kill,
      statistics,
      taskFunctionOperation,
      taskId,
      taskOperation,
    } = message
    if (statistics != null) {
      // Statistics message received
      this.statistics = statistics
    } else if (checkActive != null) {
      // Check active message received
      checkActive ? this.startCheckActive() : this.stopCheckActive()
    } else if (taskFunctionOperation != null) {
      // Task function operation message received
      if (
        message.taskFunctionProperties != null &&
        typeof message.taskFunctionProperties === 'object' &&
        message.taskFunctionOperationId != null
      ) {
        this.taskFunctionOperationIds.set(
          message.taskFunctionProperties,
          message.taskFunctionOperationId,
        )
      }
      this.taskFunctionOperationContext.run(
        message.taskFunctionOperationId,
        this.runTaskFunctionOperation,
        message,
      )
    } else if (taskId != null && data != null) {
      // Task message received
      this.run(message)
    } else if (taskOperation === 'abort' && taskId != null) {
      // Abort task operation message received
      if (this.taskAbortFunctions.has(taskId)) {
        this.taskAbortFunctions.get(taskId)?.()
      }
    } else if (kill === true) {
      // Kill message received
      this.handleKillMessage(message)?.catch((error: unknown) => {
        queueMicrotask(() => {
          throw error
        })
      })
    }
  }

  /**
   * Handles a task function operation.
   * Deferred overrides must retain the task function properties reference or the
   * operation UUID when forwarding outside the incoming asynchronous context.
   * An acknowledgement without a recoverable UUID rejects the pool operation.
   * @param message - The task function operation request.
   */
  protected handleTaskFunctionOperationMessage(
    message: MessageValue<Data>,
  ): void {
    const { taskFunction, taskFunctionOperation, taskFunctionProperties } =
      message
    if (taskFunctionProperties == null) {
      throw new Error(
        'Cannot handle task function operation message without task function properties',
      )
    }
    let response: TaskFunctionOperationResult
    switch (taskFunctionOperation) {
      case 'add':
        if (typeof taskFunction !== 'string') {
          throw new Error(
            `Cannot handle task function operation ${taskFunctionOperation} message without task function`,
          )
        }
        response = this.addTaskFunction(taskFunctionProperties.name, {
          taskFunction: new Function(
            `return (${taskFunction})`,
          )() as TaskFunction<Data, Response>,
          ...(taskFunctionProperties.priority != null && {
            priority: taskFunctionProperties.priority,
          }),
          ...(taskFunctionProperties.strategy != null && {
            strategy: taskFunctionProperties.strategy,
          }),
          ...(taskFunctionProperties.workerNodeKeys != null && {
            workerNodeKeys: taskFunctionProperties.workerNodeKeys,
          }),
        })
        break
      case 'default':
        response = this.setDefaultTaskFunction(taskFunctionProperties.name)
        break
      case 'remove':
        response = this.removeTaskFunction(taskFunctionProperties.name)
        break
      default:
        response = {
          error: new Error(
            `Unknown task function operation: ${taskFunctionOperation}`,
          ),
          status: false,
        }
        break
    }
    const { error, status } = response
    this.sendToMainWorker({
      taskFunctionOperation,
      taskFunctionOperationId: this.getTaskFunctionOperationId(message),
      taskFunctionOperationStatus: status,
      taskFunctionProperties,
      ...(!status &&
        error != null && {
        workerError: {
          name: taskFunctionProperties.name,
          aborted: error instanceof AbortError,
          error,
        },
      }),
    })
  }

  /**
   * Handles a kill message sent by the main worker.
   *
   * @param _message - The kill message.
   */
  protected handleKillMessage(
    _message: MessageValue<Data>,
  ): void | Promise<void> {
    this.stopCheckActive()
    let promise: Promise<void> | undefined
    try {
      promise = this.getResultPromise(this.opts.killHandler?.())
    } catch {
      this.sendToMainWorker({ kill: 'failure' })
      return
    }
    if (promise != null) {
      return promise.then(
        () => {
          this.sendToMainWorker({ kill: 'success' })
          return undefined
        },
        () => {
          this.sendToMainWorker({ kill: 'failure' })
          return undefined
        },
      )
    }
    this.sendToMainWorker({ kill: 'success' })
  }

  /**
   * Check if the message worker id is set and matches the worker id.
   *
   * @param message - The message to check.
   * @throws {Error} If the message worker id is not set or does not match the worker id.
   */
  private checkMessageWorkerId(message: MessageValue<Data>): void {
    if (message.workerId == null) {
      throw new Error(
        `Message worker id is not set: ${JSON.stringify(message)}`,
      )
    }
    if (message.workerId !== this.id) {
      throw new Error(
        `Message worker id ${message.workerId.toString()} does not match the worker id ${this.id}: ${
          JSON.stringify(
            message,
          )
        }`,
      )
    }
  }

  /**
   * Gets abortable task function.
   * An abortable promise is built to permit the task to be aborted.
   * @param name - The name of the task.
   * @param taskId - The task id.
   * @returns The abortable task function.
   */
  private getAbortableTaskFunction(
    name: string,
    taskId: UUID,
  ): TaskAsyncFunction<Data, Response> {
    return async (data?: Data): Promise<Response> => {
      let result: PromiseLike<Response> | Response | undefined
      // Keep cancellation active while awaiting the task. Resolve only this gate,
      // not the task result, to avoid an extra promise assimilation.
      await new Promise<void>((resolve, reject: (reason?: unknown) => void) => {
        this.taskAbortFunctions.set(taskId, () => {
          reject(new AbortError(`Task '${name}' id '${taskId}' aborted`))
        })
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const taskFunction = this.taskFunctions.get(name)!.taskFunction
        const value = taskFunction(data)
        const promise = this.getResultPromise(value)
        if (promise != null) {
          // eslint-disable-next-line promise/catch-or-return -- The second callback handles rejection.
          promise.then((value) => {
            result = value
            resolve()
            return undefined
          }, reject)
        } else {
          result = value
          resolve()
        }
      })
      return result as Response
    }
  }

  /**
   * Starts the worker check active interval.
   */
  private startCheckActive(): void {
    this.lastTaskTimestamp = performance.now()
    this.activeInterval = setInterval(
      this.checkActive.bind(this),
      (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME) / 2,
    )
  }

  /**
   * Stops the worker check active interval.
   */
  private stopCheckActive(): void {
    if (this.activeInterval != null) {
      clearInterval(this.activeInterval)
      this.activeInterval = undefined
    }
  }

  /**
   * Checks if the worker should be terminated, because its living too long.
   */
  private checkActive(): void {
    if (
      performance.now() - this.lastTaskTimestamp >
        (this.opts.maxInactiveTime ?? DEFAULT_MAX_INACTIVE_TIME)
    ) {
      this.sendToMainWorker({ kill: this.opts.killBehavior })
    }
  }

  /**
   * Returns the main worker.
   *
   * @returns Reference to the main worker.
   * @throws {Error} If the main worker is not set.
   */
  protected getMainWorker(): MainWorker {
    if (this.mainWorker == null) {
      throw new Error('Main worker not set')
    }
    return this.mainWorker
  }

  /**
   * Sends a message to main worker.
   *
   * @param message - The response message.
   */
  protected abstract sendToMainWorker(
    message: MessageValue<Response, Data>,
  ): void

  /**
   * Sends task functions properties to the main worker.
   */
  protected sendTaskFunctionsPropertiesToMainWorker(): void {
    this.sendToMainWorker({
      taskFunctionsProperties: this.listTaskFunctionsProperties(),
    })
  }

  /**
   * Runs the given task.
   *
   * @param task - The task to execute.
   */
  protected readonly run = (task: Task<Data>): void => {
    const { abortable, name, taskId } = task
    const taskFunctionName = name ?? DEFAULT_TASK_NAME
    if (!this.taskFunctions.has(taskFunctionName)) {
      this.sendTaskError(
        task,
        new Error(`Task function '${taskFunctionName}' not found`),
      )
      return
    }
    let fn: TaskFunction<Data, Response>
    if (abortable === true) {
      fn = this.getAbortableTaskFunction(taskFunctionName, taskId!)
    } else {
      fn = this.taskFunctions.get(taskFunctionName)!.taskFunction
    }
    if (isAsyncFunction(fn)) {
      this.runAsync(fn as TaskAsyncFunction<Data, Response>, task)
    } else {
      this.runSync(fn as TaskSyncFunction<Data, Response>, task)
    }
  }

  /**
   * Runs a task through the synchronous execution hook.
   *
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected readonly runSync = (
    fn: TaskSyncFunction<Data, Response>,
    task: Task<Data>,
  ): void => {
    const { data, name, taskId } = task
    let asynchronous = false
    try {
      let taskPerformance = this.beginTaskPerformance(name)
      const res = fn(data)
      const promise = this.getResultPromise(res)
      if (promise != null) {
        this.completeAsyncTask(promise, task, taskPerformance)
        asynchronous = true
        return
      }
      taskPerformance = this.endTaskPerformance(taskPerformance)
      this.sendToMainWorker({
        data: res,
        taskId,
        taskPerformance,
      })
    } catch (error) {
      this.sendTaskError(task, error as Error)
    } finally {
      if (!asynchronous) this.finishTask(task)
    }
  }

  /**
   * Runs the given asynchronous task function.
   *
   * @param fn - Task function that will be executed.
   * @param task - Input data for the task function.
   */
  protected readonly runAsync = (
    fn: TaskAsyncFunction<Data, Response>,
    task: Task<Data>,
  ): void => {
    try {
      const taskPerformance = this.beginTaskPerformance(task.name)
      const result = fn(task.data)
      this.completeAsyncTask(
        this.getResultPromise(result) ?? Promise.resolve(result),
        task,
        taskPerformance,
      )
    } catch (error) {
      try {
        this.sendTaskError(task, error as Error)
      } finally {
        this.finishTask(task)
      }
    }
  }

  private completeAsyncTask(
    promise: Promise<Response>,
    task: Task<Data>,
    taskPerformance: TaskPerformance,
  ): void {
    const { taskId } = task
    promise
      .then((res) => {
        taskPerformance = this.endTaskPerformance(taskPerformance)
        this.sendToMainWorker({
          data: res,
          taskId,
          taskPerformance,
        })
        return undefined
      })
      .catch((error: unknown) => {
        this.sendTaskError(task, error as Error)
      })
      .finally(() => {
        this.finishTask(task)
      })
      .catch((error: unknown) => {
        queueMicrotask(() => {
          throw error
        })
      })
  }

  private sendTaskError(task: Task<Data>, error: Error): void {
    const message = {
      taskId: task.taskId,
      workerError: {
        ...((task.transferList == null || task.transferList.length === 0) && {
          data: task.data,
        }),
        name: task.name,
        aborted: error instanceof AbortError,
        error,
      },
    } satisfies MessageValue<Response, Data>
    try {
      this.sendToMainWorker(message)
    } catch (sendError) {
      if (
        !(sendError instanceof Error) ||
        sendError.name !== 'DataCloneError' ||
        !Object.hasOwn(message.workerError, 'data')
      ) {
        throw sendError
      }
      delete message.workerError.data
      this.sendToMainWorker(message)
    }
  }

  private finishTask(task: Task<Data>): void {
    this.updateLastTaskTimestamp()
    if (task.abortable === true && task.taskId != null) {
      this.taskAbortFunctions.delete(task.taskId)
    }
  }

  private beginTaskPerformance(name?: string): TaskPerformance {
    if (this.statistics == null) {
      throw new Error('Performance statistics computation requirements not set')
    }
    return {
      name: name ?? DEFAULT_TASK_NAME,
      timestamp: performance.now(),
      // ...(this.statistics.elu && { elu: performance.eventLoopUtilization() }),
    }
  }

  private endTaskPerformance(
    taskPerformance: TaskPerformance,
  ): TaskPerformance {
    if (this.statistics == null) {
      throw new Error('Performance statistics computation requirements not set')
    }
    return {
      ...taskPerformance,
      ...(this.statistics.runTime && {
        runTime: performance.now() - taskPerformance.timestamp,
      }),
      // ...(this.statistics.elu && {
      //   elu: performance.eventLoopUtilization(taskPerformance.elu),
      // }),
    }
  }

  private updateLastTaskTimestamp(): void {
    if (this.activeInterval != null) {
      this.lastTaskTimestamp = performance.now()
    }
  }

  protected getTaskFunctionOperationId(
    message: MessageValue,
  ): undefined | UUID {
    return (
      message.taskFunctionOperationId ??
        (message.taskFunctionProperties != null
          ? this.taskFunctionOperationIds.get(message.taskFunctionProperties)
          : undefined) ??
        this.taskFunctionOperationContext.getStore()
    )
  }

  private getResultPromise<Result>(
    result: PromiseLike<Result> | Result,
  ): Promise<Result> | undefined {
    if (
      result == null ||
      (typeof result !== 'object' && typeof result !== 'function')
    ) {
      return
    }
    if (
      (isPromise == null || isPromise(result)) &&
      Object.getPrototypeOf(result) === Promise.prototype &&
      !Object.hasOwn(result, 'then')
    ) {
      return isPromise != null
        ? result as Promise<Result>
        : Promise.resolve(result as Promise<Result>)
    }
    const then: unknown = Reflect.get(result, 'then')
    if (typeof then === 'function') {
      // The declared result type determines the callable's fulfillment type.
      const promiseThen = then as PromiseLike<Result>['then']
      return Promise.resolve({
        then(...args: Parameters<typeof promiseThen>): void {
          Reflect.apply(promiseThen, result, args)
        },
      })
    }
    return undefined
  }

  private readonly runTaskFunctionOperation = (
    message: MessageValue<Data>,
  ): void => {
    this.handleTaskFunctionOperationMessage(message)
  }
}
