import { defaultBucketSize } from '../queues/queue-types.ts'
import type {
  MessageValue,
  PromiseResponseWrapper,
  Task,
  TaskFunctionProperties,
} from '../utility-types.ts'
import {
  average,
  buildTaskFunctionProperties,
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  exponentialDelay,
  isKillBehavior,
  isPlainObject,
  max,
  median,
  min,
  round,
  sleep,
} from '../utils.ts'
import type {
  TaskFunction,
  TaskFunctionObject,
} from '../worker/task-functions.ts'
import { KillBehaviors } from '../worker/worker-options.ts'
import {
  type IPool,
  PoolEvents,
  type PoolInfo,
  type PoolOptions,
  type PoolType,
  PoolTypes,
  type TasksQueueOptions,
} from './pool.ts'
import {
  Measurements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies/selection-strategies-types.ts'
import { WorkerChoiceStrategiesContext } from './selection-strategies/worker-choice-strategies-context.ts'
import {
  checkFileURL,
  checkValidPriority,
  checkValidTasksQueueOptions,
  checkValidWorkerChoiceStrategy,
  getDefaultTasksQueueOptions,
  updateEluWorkerUsage,
  updateRunTimeWorkerUsage,
  updateTaskStatisticsWorkerUsage,
  updateWaitTimeWorkerUsage,
  waitWorkerNodeEvents,
} from './utils.ts'
import { version } from './version.ts'
import type {
  IWorker,
  IWorkerNode,
  WorkerInfo,
  WorkerNodeEventDetail,
  WorkerType,
} from './worker.ts'
import { WorkerNode } from './worker-node.ts'

/**
 * Base class that implements some shared logic for all poolifier pools.
 *
 * @typeParam Worker - Type of worker which manages this pool.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractPool<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> implements IPool<Worker, Data, Response> {
  /** @inheritDoc */
  public readonly workerNodes: IWorkerNode<Worker, Data>[] = []

  /** @inheritDoc */
  public eventTarget?: EventTarget

  /**
   * The task execution response promise map:
   * - `key`: The message id of each submitted task.
   * - `value`: An object that contains task's worker node key, execution response promise resolve and reject callbacks.
   *
   * When we receive a message from the worker, we get a map entry with the promise resolve/reject bound to the message id.
   */
  protected promiseResponseMap: Map<
    `${string}-${string}-${string}-${string}-${string}`,
    PromiseResponseWrapper<Response>
  > = new Map<
    `${string}-${string}-${string}-${string}-${string}`,
    PromiseResponseWrapper<Response>
  >()

  /**
   * Worker choice strategies context referencing worker choice algorithms implementation.
   */
  protected workerChoiceStrategiesContext?: WorkerChoiceStrategiesContext<
    Worker,
    Data,
    Response
  >

  /**
   * Whether the pool is started or not.
   */
  protected started: boolean
  /**
   * Whether the pool is starting or not.
   */
  protected starting: boolean
  /**
   * Whether the pool is destroying or not.
   */
  protected destroying: boolean

  /**
   * The task functions added at runtime map:
   * - `key`: The task function name.
   * - `value`: The task function object.
   */
  private readonly taskFunctions: Map<
    string,
    TaskFunctionObject<Data, Response>
  >

  /**
   * Whether the minimum number of workers is starting or not.
   */
  private startingMinimumNumberOfWorkers: boolean
  /**
   * Whether the pool ready event has been emitted or not.
   */
  private readyEventEmitted: boolean
  /**
   * Whether the pool back pressure event has been emitted or not.
   */
  private backPressureEventEmitted: boolean
  /**
   * Whether the pool busy event has been emitted or not.
   */
  private busyEventEmitted: boolean
  /**
   * The start timestamp of the pool.
   */
  private startTimestamp?: number

  /**
   * Constructs a new poolifier pool.
   *
   * @param minimumNumberOfWorkers - Minimum number of workers that this pool manages.
   * @param fileURL - URL to the worker file.
   * @param opts - Options for the pool.
   * @param maximumNumberOfWorkers - Maximum number of workers that this pool manages.
   */
  public constructor(
    protected readonly minimumNumberOfWorkers: number,
    protected readonly fileURL: URL,
    protected readonly opts: PoolOptions,
    protected readonly maximumNumberOfWorkers?: number,
  ) {
    if (!this.isMain()) {
      throw new Error(
        'Cannot start a pool from a worker with the same type as the pool',
      )
    }
    this.checkPoolType()
    checkFileURL(this.fileURL)
    this.checkMinimumNumberOfWorkers(this.minimumNumberOfWorkers)
    this.checkPoolOptions(this.opts)

    this.chooseWorkerNode = this.chooseWorkerNode.bind(this)
    this.executeTask = this.executeTask.bind(this)
    this.enqueueTask = this.enqueueTask.bind(this)

    if (this.opts.enableEvents === true) {
      this.initEventTarget()
    }
    this.workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext<
      Worker,
      Data,
      Response
    >(
      this,
      [this.opts.workerChoiceStrategy!],
      this.opts.workerChoiceStrategyOptions,
    )

    this.setupHook()

    this.taskFunctions = new Map<string, TaskFunctionObject<Data, Response>>()

    this.started = false
    this.starting = false
    this.destroying = false
    this.startingMinimumNumberOfWorkers = false
    this.readyEventEmitted = false
    this.busyEventEmitted = false
    this.backPressureEventEmitted = false
    if (this.opts.startWorkers === true) {
      this.start()
    }
  }

  private checkPoolType(): void {
    if (this.type === PoolTypes.fixed && this.maximumNumberOfWorkers != null) {
      throw new Error(
        'Cannot instantiate a fixed pool with a maximum number of workers specified at initialization',
      )
    }
  }

  private checkMinimumNumberOfWorkers(
    minimumNumberOfWorkers: number | undefined,
  ): void {
    if (minimumNumberOfWorkers == null) {
      throw new Error(
        'Cannot instantiate a pool without specifying the number of workers',
      )
    }
    if (!Number.isSafeInteger(minimumNumberOfWorkers)) {
      throw new TypeError(
        'Cannot instantiate a pool with a non safe integer number of workers',
      )
    }
    if (minimumNumberOfWorkers < 0) {
      throw new RangeError(
        'Cannot instantiate a pool with a negative number of workers',
      )
    }
    if (this.type === PoolTypes.fixed && minimumNumberOfWorkers === 0) {
      throw new RangeError('Cannot instantiate a fixed pool with zero worker')
    }
  }

  private checkPoolOptions(opts: PoolOptions): void {
    if (isPlainObject(opts)) {
      this.opts.startWorkers = opts.startWorkers ?? true
      checkValidWorkerChoiceStrategy(opts.workerChoiceStrategy)
      this.opts.workerChoiceStrategy = opts.workerChoiceStrategy ??
        WorkerChoiceStrategies.ROUND_ROBIN
      this.checkValidWorkerChoiceStrategyOptions(
        opts.workerChoiceStrategyOptions,
      )
      if (opts.workerChoiceStrategyOptions != null) {
        this.opts.workerChoiceStrategyOptions = opts.workerChoiceStrategyOptions
      }
      this.opts.restartWorkerOnError = opts.restartWorkerOnError ?? true
      this.opts.enableEvents = opts.enableEvents ?? true
      this.opts.enableTasksQueue = opts.enableTasksQueue ?? false
      if (this.opts.enableTasksQueue) {
        checkValidTasksQueueOptions(opts.tasksQueueOptions)
        this.opts.tasksQueueOptions = this.buildTasksQueueOptions(
          opts.tasksQueueOptions,
        )
      }
    } else {
      throw new TypeError('Invalid pool options: must be a plain object')
    }
  }

  private checkValidWorkerChoiceStrategyOptions(
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions | undefined,
  ): void {
    if (
      workerChoiceStrategyOptions != null &&
      !isPlainObject(workerChoiceStrategyOptions)
    ) {
      throw new TypeError(
        'Invalid worker choice strategy options: must be a plain object',
      )
    }
    if (
      workerChoiceStrategyOptions?.weights != null &&
      Object.keys(workerChoiceStrategyOptions.weights).length !==
        (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    ) {
      throw new Error(
        'Invalid worker choice strategy options: must have a weight for each worker node',
      )
    }
    if (
      workerChoiceStrategyOptions?.measurement != null &&
      !Object.values(Measurements).includes(
        workerChoiceStrategyOptions.measurement,
      )
    ) {
      throw new Error(
        `Invalid worker choice strategy options: invalid measurement '${workerChoiceStrategyOptions.measurement}'`,
      )
    }
  }

  private initEventTarget(): void {
    this.eventTarget = new EventTarget()
  }

  /** @inheritDoc */
  public get info(): PoolInfo {
    return {
      version,
      type: this.type,
      worker: this.worker,
      started: this.started,
      ready: this.ready,
      defaultStrategy: this.opts.workerChoiceStrategy!,
      strategyRetries: this.workerChoiceStrategiesContext?.retriesCount ?? 0,
      minSize: this.minimumNumberOfWorkers,
      maxSize: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
            .runTime.aggregate === true &&
        this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
          .waitTime.aggregate &&
        {
          utilization: round(this.utilization),
        }),
      workerNodes: this.workerNodes.length,
      ...(this.type === PoolTypes.dynamic && {
        dynamicWorkerNodes: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            workerNode.info.dynamic ? accumulator + 1 : accumulator,
          0,
        ),
      }),
      idleWorkerNodes: this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeIdle(workerNodeKey) ? accumulator + 1 : accumulator,
        0,
      ),
      busyWorkerNodes: this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBusy(workerNodeKey) ? accumulator + 1 : accumulator,
        0,
      ),
      executedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.executed,
        0,
      ),
      executingTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.executing,
        0,
      ),
      failedTasks: this.workerNodes.reduce(
        (accumulator, workerNode) =>
          accumulator + workerNode.usage.tasks.failed,
        0,
      ),
      ...(this.opts.enableTasksQueue === true && {
        backPressure: this.backPressure,
        backPressureWorkerNodes: this.workerNodes.reduce(
          (accumulator, _, workerNodeKey) =>
            this.isWorkerNodeBackPressured(workerNodeKey)
              ? accumulator + 1
              : accumulator,
          0,
        ),
        stealingWorkerNodes: this.workerNodes.reduce(
          (accumulator, _, workerNodeKey) =>
            this.isWorkerNodeStealing(workerNodeKey)
              ? accumulator + 1
              : accumulator,
          0,
        ),
        queuedTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + workerNode.usage.tasks.queued,
          0,
        ),
        maxQueuedTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + (workerNode.usage.tasks.maxQueued ?? 0),
          0,
        ),
        stolenTasks: this.workerNodes.reduce(
          (accumulator, workerNode) =>
            accumulator + workerNode.usage.tasks.stolen,
          0,
        ),
      }),
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
            .runTime.aggregate === true && {
        runTime: {
          minimum: round(
            min(
              ...this.workerNodes.map(
                (workerNode) =>
                  workerNode.usage.runTime.minimum ?? Number.POSITIVE_INFINITY,
              ),
            ),
          ),
          maximum: round(
            max(
              ...this.workerNodes.map(
                (workerNode) =>
                  workerNode.usage.runTime.maximum ?? Number.NEGATIVE_INFINITY,
              ),
            ),
          ),
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .runTime.average && {
            average: round(
              average(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.runTime.history.toArray(),
                    ),
                  [],
                ),
              ),
            ),
          }),
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .runTime.median && {
            median: round(
              median(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.runTime.history.toArray(),
                    ),
                  [],
                ),
              ),
            ),
          }),
        },
      }),
      ...(this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
            .waitTime.aggregate === true && {
        waitTime: {
          minimum: round(
            min(
              ...this.workerNodes.map(
                (workerNode) =>
                  workerNode.usage.waitTime.minimum ?? Number.POSITIVE_INFINITY,
              ),
            ),
          ),
          maximum: round(
            max(
              ...this.workerNodes.map(
                (workerNode) =>
                  workerNode.usage.waitTime.maximum ?? Number.NEGATIVE_INFINITY,
              ),
            ),
          ),
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .waitTime.average && {
            average: round(
              average(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.waitTime.history.toArray(),
                    ),
                  [],
                ),
              ),
            ),
          }),
          ...(this.workerChoiceStrategiesContext.getTaskStatisticsRequirements()
            .waitTime.median && {
            median: round(
              median(
                this.workerNodes.reduce<number[]>(
                  (accumulator, workerNode) =>
                    accumulator.concat(
                      workerNode.usage.waitTime.history.toArray(),
                    ),
                  [],
                ),
              ),
            ),
          }),
        },
      }),
    }
  }

  /**
   * Whether the pool is ready or not.
   *
   * @returns The pool readiness boolean status.
   */
  private get ready(): boolean {
    if (!this.started) {
      return false
    }
    return (
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          !workerNode.info.dynamic && workerNode.info.ready
            ? accumulator + 1
            : accumulator,
        0,
      ) >= this.minimumNumberOfWorkers
    )
  }

  /**
   * The approximate pool utilization.
   *
   * @returns The pool utilization.
   */
  private get utilization(): number {
    if (this.startTimestamp == null) {
      return 0
    }
    const poolTimeCapacity = (performance.now() - this.startTimestamp) *
      (this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers)
    const totalTasksRunTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.runTime.aggregate ?? 0),
      0,
    )
    const totalTasksWaitTime = this.workerNodes.reduce(
      (accumulator, workerNode) =>
        accumulator + (workerNode.usage.waitTime.aggregate ?? 0),
      0,
    )
    return (totalTasksRunTime + totalTasksWaitTime) / poolTimeCapacity
  }

  /**
   * The pool type.
   *
   * If it is `'dynamic'`, it provides the `max` property.
   */
  protected abstract get type(): PoolType

  /**
   * The worker type.
   */
  protected abstract get worker(): WorkerType

  /**
   * Checks if the worker id sent in the received message from a worker is valid.
   *
   * @param message - The received message.
   * @throws {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error} If the worker id is invalid.
   */
  private checkMessageWorkerId(message: MessageValue<Data | Response>): void {
    if (message.workerId == null) {
      throw new Error(
        `Worker message '${
          JSON.stringify(message)
        }' received without worker id`,
      )
    }
    if (this.getWorkerNodeKeyByWorkerId(message.workerId) === -1) {
      throw new Error(
        `Worker message '${
          JSON.stringify(
            message,
          )
        }' received from unknown worker ${message.workerId.toString()}`,
      )
    }
  }

  /**
   * Gets the worker node key given its worker id.
   *
   * @param workerId - The worker id.
   * @returns The worker node key if the worker id is found in the pool worker nodes, `-1` otherwise.
   */
  private getWorkerNodeKeyByWorkerId(workerId: string | undefined): number {
    return this.workerNodes.findIndex(
      (workerNode) => workerNode.info.id === workerId,
    )
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategy(
    workerChoiceStrategy: WorkerChoiceStrategy,
    workerChoiceStrategyOptions?: WorkerChoiceStrategyOptions,
  ): void {
    let requireSync = false
    checkValidWorkerChoiceStrategy(workerChoiceStrategy)
    if (workerChoiceStrategyOptions != null) {
      requireSync = !this.setWorkerChoiceStrategyOptions(
        workerChoiceStrategyOptions,
      )
    }
    if (workerChoiceStrategy !== this.opts.workerChoiceStrategy) {
      this.opts.workerChoiceStrategy = workerChoiceStrategy
      this.workerChoiceStrategiesContext?.setDefaultWorkerChoiceStrategy(
        this.opts.workerChoiceStrategy,
        this.opts.workerChoiceStrategyOptions,
      )
      requireSync = true
    }
    if (requireSync) {
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(),
        this.opts.workerChoiceStrategyOptions,
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
    }
  }

  /** @inheritDoc */
  public setWorkerChoiceStrategyOptions(
    workerChoiceStrategyOptions: WorkerChoiceStrategyOptions | undefined,
  ): boolean {
    this.checkValidWorkerChoiceStrategyOptions(workerChoiceStrategyOptions)
    if (workerChoiceStrategyOptions != null) {
      this.opts.workerChoiceStrategyOptions = {
        ...this.opts.workerChoiceStrategyOptions,
        ...workerChoiceStrategyOptions,
      }
      this.workerChoiceStrategiesContext?.setOptions(
        this.opts.workerChoiceStrategyOptions,
      )
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        this.getWorkerChoiceStrategies(),
        this.opts.workerChoiceStrategyOptions,
      )
      for (const workerNodeKey of this.workerNodes.keys()) {
        this.sendStatisticsMessageToWorker(workerNodeKey)
      }
      return true
    }
    return false
  }

  /** @inheritDoc */
  public enableTasksQueue(
    enable: boolean,
    tasksQueueOptions?: TasksQueueOptions,
  ): void {
    if (this.opts.enableTasksQueue === true && !enable) {
      this.unsetTaskStealing()
      this.unsetTasksStealingOnBackPressure()
      this.flushTasksQueues()
    }
    this.opts.enableTasksQueue = enable
    this.setTasksQueueOptions(tasksQueueOptions)
  }

  /** @inheritDoc */
  public setTasksQueueOptions(
    tasksQueueOptions: TasksQueueOptions | undefined,
  ): void {
    if (this.opts.enableTasksQueue === true) {
      checkValidTasksQueueOptions(tasksQueueOptions)
      this.opts.tasksQueueOptions = this.buildTasksQueueOptions(
        tasksQueueOptions,
      )
      this.setTasksQueueSize(this.opts.tasksQueueOptions.size!)
      if (this.opts.tasksQueueOptions.taskStealing === true) {
        this.unsetTaskStealing()
        this.setTaskStealing()
      } else {
        this.unsetTaskStealing()
      }
      if (this.opts.tasksQueueOptions.tasksStealingOnBackPressure === true) {
        this.unsetTasksStealingOnBackPressure()
        this.setTasksStealingOnBackPressure()
      } else {
        this.unsetTasksStealingOnBackPressure()
      }
    } else if (this.opts.tasksQueueOptions != null) {
      delete this.opts.tasksQueueOptions
    }
  }

  private buildTasksQueueOptions(
    tasksQueueOptions: TasksQueueOptions | undefined,
  ): TasksQueueOptions {
    return {
      ...getDefaultTasksQueueOptions(
        this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      ),
      ...this.opts.tasksQueueOptions,
      ...tasksQueueOptions,
    }
  }

  private setTasksQueueSize(size: number): void {
    for (const workerNode of this.workerNodes) {
      workerNode.tasksQueueBackPressureSize = size
    }
  }

  private setTaskStealing(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].addEventListener(
        'idle',
        this.handleWorkerNodeIdleEvent as EventListener,
      )
    }
  }

  private unsetTaskStealing(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].removeEventListener(
        'idle',
        this.handleWorkerNodeIdleEvent as EventListener,
      )
    }
  }

  private setTasksStealingOnBackPressure(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].addEventListener(
        'backPressure',
        this.handleWorkerNodeBackPressureEvent as EventListener,
      )
    }
  }

  private unsetTasksStealingOnBackPressure(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].removeEventListener(
        'backPressure',
        this.handleWorkerNodeBackPressureEvent as EventListener,
      )
    }
  }

  /**
   * Whether the pool is back pressured or not.
   *
   * @returns The pool back pressure boolean status.
   */
  protected abstract get backPressure(): boolean

  /**
   * Whether the pool is busy or not.
   *
   * @returns The pool busyness boolean status.
   */
  protected abstract get busy(): boolean

  /**
   * Whether worker nodes are executing concurrently their tasks quota or not.
   *
   * @returns Worker nodes busyness boolean status.
   */
  protected internalBusy(): boolean {
    return (
      this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBusy(workerNodeKey) ? accumulator + 1 : accumulator,
        0,
      ) === this.workerNodes.length
    )
  }

  private isWorkerNodeBackPressured(workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) {
      return false
    }
    return workerNode.info.ready && workerNode.info.backPressure
  }

  private isWorkerNodeBusy(workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) {
      return false
    }
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.info.ready &&
        workerNode.usage.tasks.executing >=
          this.opts.tasksQueueOptions!.concurrency!
      )
    }
    return workerNode.info.ready && workerNode.usage.tasks.executing > 0
  }

  private isWorkerNodeIdle(workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) {
      return false
    }
    if (this.opts.enableTasksQueue === true) {
      return (
        workerNode.info.ready &&
        workerNode.usage.tasks.executing === 0 &&
        this.tasksQueueSize(workerNodeKey) === 0
      )
    }
    return workerNode.info.ready && workerNode.usage.tasks.executing === 0
  }

  private isWorkerNodeStealing(workerNodeKey: number): boolean {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) {
      return false
    }
    return (
      workerNode.info.ready &&
      (workerNode.info.continuousStealing ||
        workerNode.info.backPressureStealing)
    )
  }

  private async sendTaskFunctionOperationToWorker(
    workerNodeKey: number,
    message: MessageValue<Data>,
  ): Promise<boolean> {
    let taskFunctionOperationListener:
      | ((message: MessageValue<Response>) => void)
      | undefined
    try {
      return await new Promise<boolean>((resolve, reject) => {
        taskFunctionOperationListener = (
          message: MessageValue<Response>,
        ): void => {
          this.checkMessageWorkerId(message)
          const workerId = this.getWorkerInfo(workerNodeKey)?.id
          if (
            message.taskFunctionOperationStatus != null &&
            message.workerId === workerId
          ) {
            if (message.taskFunctionOperationStatus) {
              resolve(true)
              return
            }
            reject(
              new Error(
                `Task function operation '${message.taskFunctionOperation?.toString()}' failed on worker ${message.workerId?.toString()} with error: '${message.workerError?.error.message}'`,
              ),
            )
          }
        }
        this.registerWorkerMessageListener(
          workerNodeKey,
          taskFunctionOperationListener,
        )
        this.sendToWorker(workerNodeKey, message)
      })
    } finally {
      if (taskFunctionOperationListener != null) {
        this.deregisterWorkerMessageListener(
          workerNodeKey,
          taskFunctionOperationListener,
        )
      }
    }
  }

  private async sendTaskFunctionOperationToWorkers(
    message: MessageValue<Data>,
  ): Promise<boolean> {
    const targetWorkerNodeKeys = [...this.workerNodes.keys()]
    const taskFunctionOperationsListener = (
      message: MessageValue<Response>,
      resolve: (value: boolean | PromiseLike<boolean>) => void,
      reject: (reason?: unknown) => void,
    ): void => {
      const responsesReceived: MessageValue<Response>[] = []
      this.checkMessageWorkerId(message)
      if (
        message.taskFunctionOperationStatus != null &&
        targetWorkerNodeKeys.includes(
          this.getWorkerNodeKeyByWorkerId(message.workerId),
        )
      ) {
        responsesReceived.push(message)
        if (responsesReceived.length >= targetWorkerNodeKeys.length) {
          if (
            responsesReceived.every(
              (msg) => msg.taskFunctionOperationStatus === true,
            )
          ) {
            resolve(true)
          } else {
            const errorResponse = responsesReceived.find(
              (msg) => msg.taskFunctionOperationStatus === false,
            )
            reject(
              new Error(
                `Task function operation '${message.taskFunctionOperation}' failed on worker ${errorResponse?.workerId?.toString()} with error: '${
                  errorResponse?.workerError?.error?.message ?? 'Unknown error'
                }'`,
              ),
            )
          }
        }
      }
    }
    let listener: ((message: MessageValue<Response>) => void) | undefined
    try {
      return await new Promise<boolean>((resolve, reject) => {
        listener = (message: MessageValue<Response>) => {
          taskFunctionOperationsListener(message, resolve, reject)
        }
        for (const workerNodeKey of targetWorkerNodeKeys) {
          this.registerWorkerMessageListener(workerNodeKey, listener)
          this.sendToWorker(workerNodeKey, message)
        }
      })
    } finally {
      if (listener != null) {
        for (const workerNodeKey of targetWorkerNodeKeys) {
          this.deregisterWorkerMessageListener(workerNodeKey, listener)
        }
      }
    }
  }

  /** @inheritDoc */
  public hasTaskFunction(name: string): boolean {
    return this.listTaskFunctionsProperties().some(
      (taskFunctionProperties) => taskFunctionProperties.name === name,
    )
  }

  /** @inheritDoc */
  public async addTaskFunction(
    name: string,
    fn: TaskFunction<Data, Response> | TaskFunctionObject<Data, Response>,
  ): Promise<boolean> {
    if (typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (typeof fn === 'function') {
      fn = { taskFunction: fn } satisfies TaskFunctionObject<Data, Response>
    }
    if (typeof fn.taskFunction !== 'function') {
      throw new TypeError('taskFunction property must be a function')
    }
    checkValidPriority(fn.priority)
    checkValidWorkerChoiceStrategy(fn.strategy)
    const opResult = await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'add',
      taskFunctionProperties: buildTaskFunctionProperties(name, fn),
      taskFunction: fn.taskFunction.toString(),
    })
    this.taskFunctions.set(name, fn)
    this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
      this.getWorkerChoiceStrategies(),
    )
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.sendStatisticsMessageToWorker(workerNodeKey)
    }
    return opResult
  }

  /** @inheritDoc */
  public async removeTaskFunction(name: string): Promise<boolean> {
    if (!this.taskFunctions.has(name)) {
      throw new Error(
        'Cannot remove a task function not handled on the pool side',
      )
    }
    const opResult = await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'remove',
      taskFunctionProperties: buildTaskFunctionProperties(
        name,
        this.taskFunctions.get(name),
      ),
    })
    for (const workerNode of this.workerNodes) {
      workerNode.deleteTaskFunctionWorkerUsage(name)
    }
    this.taskFunctions.delete(name)
    this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
      this.getWorkerChoiceStrategies(),
    )
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.sendStatisticsMessageToWorker(workerNodeKey)
    }
    return opResult
  }

  /** @inheritDoc */
  public listTaskFunctionsProperties(): TaskFunctionProperties[] {
    for (const workerNode of this.workerNodes) {
      if (
        Array.isArray(workerNode.info.taskFunctionsProperties) &&
        workerNode.info.taskFunctionsProperties.length > 0
      ) {
        return workerNode.info.taskFunctionsProperties
      }
    }
    return []
  }

  private readonly getAbortError = (
    taskName: string,
    taskId: `${string}-${string}-${string}-${string}-${string}`,
  ): Error => {
    const abortError = this.promiseResponseMap.get(taskId)?.abortSignal
      ?.reason as Error | string
    return abortError instanceof Error
      ? abortError
      : typeof abortError === 'string'
      ? new Error(abortError)
      : new Error(`Task '${taskName}' id '${taskId}' aborted`)
  }

  /**
   * Gets task function worker choice strategy, if any.
   *
   * @param name - The task function name.
   * @returns The task function worker choice strategy if the task function worker choice strategy is defined, `undefined` otherwise.
   */
  private readonly getTaskFunctionWorkerChoiceStrategy = (
    name?: string,
  ): WorkerChoiceStrategy | undefined => {
    name = name ?? DEFAULT_TASK_NAME
    const taskFunctionsProperties = this.listTaskFunctionsProperties()
    if (name === DEFAULT_TASK_NAME) {
      name = taskFunctionsProperties[1]?.name
    }
    return taskFunctionsProperties.find(
      (taskFunctionProperties: TaskFunctionProperties) =>
        taskFunctionProperties.name === name,
    )?.strategy
  }

  /**
   * Gets worker node task function worker choice strategy, if any.
   *
   * @param workerNodeKey - The worker node key.
   * @param name - The task function name.
   * @returns The worker node task function worker choice strategy if the worker node task function worker choice strategy is defined, `undefined` otherwise.
   */
  private readonly getWorkerNodeTaskFunctionWorkerChoiceStrategy = (
    workerNodeKey: number,
    name?: string,
  ): WorkerChoiceStrategy | undefined => {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    if (workerInfo == null) {
      return
    }
    name = name ?? DEFAULT_TASK_NAME
    if (name === DEFAULT_TASK_NAME) {
      name = workerInfo.taskFunctionsProperties?.[1]?.name
    }
    return workerInfo.taskFunctionsProperties?.find(
      (taskFunctionProperties: TaskFunctionProperties) =>
        taskFunctionProperties.name === name,
    )?.strategy
  }

  /**
   * Gets worker node task function priority, if any.
   *
   * @param workerNodeKey - The worker node key.
   * @param name - The task function name.
   * @returns The worker node task function priority if the worker node task function priority is defined, `undefined` otherwise.
   */
  private readonly getWorkerNodeTaskFunctionPriority = (
    workerNodeKey: number,
    name?: string,
  ): number | undefined => {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    if (workerInfo == null) {
      return
    }
    name = name ?? DEFAULT_TASK_NAME
    if (name === DEFAULT_TASK_NAME) {
      name = workerInfo.taskFunctionsProperties?.[1]?.name
    }
    return workerInfo.taskFunctionsProperties?.find(
      (taskFunctionProperties: TaskFunctionProperties) =>
        taskFunctionProperties.name === name,
    )?.priority
  }

  /**
   * Gets the worker choice strategies registered in this pool.
   *
   * @returns The worker choice strategies.
   */
  private readonly getWorkerChoiceStrategies = (): Set<
    WorkerChoiceStrategy
  > => {
    return new Set([
      this.opts.workerChoiceStrategy!,
      ...(this.listTaskFunctionsProperties()
        .map(
          (taskFunctionProperties: TaskFunctionProperties) =>
            taskFunctionProperties.strategy,
        )
        .filter(
          (strategy: WorkerChoiceStrategy | undefined) => strategy != null,
        ) as WorkerChoiceStrategy[]),
    ])
  }

  /** @inheritDoc */
  public async setDefaultTaskFunction(name: string): Promise<boolean> {
    return await this.sendTaskFunctionOperationToWorkers({
      taskFunctionOperation: 'default',
      taskFunctionProperties: buildTaskFunctionProperties(
        name,
        this.taskFunctions.get(name),
      ),
    })
  }

  private shallExecuteTask(workerNodeKey: number): boolean {
    return (
      this.tasksQueueSize(workerNodeKey) === 0 &&
      this.workerNodes[workerNodeKey].usage.tasks.executing <
        this.opts.tasksQueueOptions!.concurrency!
    )
  }

  public async internalExecute(
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: Transferable[],
  ): Promise<Response> {
    return await new Promise<Response>((resolve, reject) => {
      const timestamp = performance.now()
      const workerNodeKey = this.chooseWorkerNode(name)
      const task: Task<Data> = {
        abortable: abortSignal != null,
        name: name ?? DEFAULT_TASK_NAME,
        data: data ?? ({} as Data),
        priority: this.getWorkerNodeTaskFunctionPriority(workerNodeKey, name),
        strategy: this.getWorkerNodeTaskFunctionWorkerChoiceStrategy(
          workerNodeKey,
          name,
        ),
        transferList,
        timestamp,
        taskId: crypto.randomUUID(),
      }
      abortSignal?.addEventListener(
        'abort',
        () => {
          this.workerNodes[workerNodeKey]?.dispatchEvent(
            new CustomEvent<WorkerNodeEventDetail>('abortTask', {
              detail: {
                taskId: task.taskId,
                workerId: this.getWorkerInfo(workerNodeKey)!.id!,
              },
            }),
          )
        },
        { once: true },
      )
      this.promiseResponseMap.set(task.taskId!, {
        reject,
        resolve,
        workerNodeKey,
        abortSignal,
      })
      if (
        this.opts.enableTasksQueue === false ||
        (this.opts.enableTasksQueue === true &&
          this.shallExecuteTask(workerNodeKey))
      ) {
        this.executeTask(workerNodeKey, task)
      } else {
        this.enqueueTask(workerNodeKey, task)
      }
    })
  }

  /** @inheritDoc */
  public async execute(
    data?: Data,
    name?: string,
    abortSignal?: AbortSignal,
    transferList?: readonly Transferable[],
  ): Promise<Response> {
    if (!this.started) {
      throw new Error('Cannot execute a task on not started pool')
    }
    if (this.destroying) {
      throw new Error('Cannot execute a task on destroying pool')
    }
    if (name != null && typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name != null && typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (abortSignal != null && !(abortSignal instanceof AbortSignal)) {
      throw new TypeError('abortSignal argument must be an AbortSignal')
    }
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    return await this.internalExecute(data, name, abortSignal, transferList)
  }

  /** @inheritDoc */
  public async mapExecute(
    data: Iterable<Data>,
    name?: string,
    abortSignals?: Iterable<AbortSignal>,
    transferList?: readonly Transferable[],
  ): Promise<Response[]> {
    if (!this.started) {
      throw new Error('Cannot execute task(s) on not started pool')
    }
    if (this.destroying) {
      throw new Error('Cannot execute task(s) on destroying pool')
    }
    if (data == null) {
      throw new TypeError('data argument must be a defined iterable')
    }
    if (typeof data[Symbol.iterator] !== 'function') {
      throw new TypeError('data argument must be an iterable')
    }
    if (name != null && typeof name !== 'string') {
      throw new TypeError('name argument must be a string')
    }
    if (name != null && typeof name === 'string' && name.trim().length === 0) {
      throw new TypeError('name argument must not be an empty string')
    }
    if (!Array.isArray(data)) {
      data = [...data]
    }
    if (abortSignals != null) {
      if (typeof abortSignals[Symbol.iterator] !== 'function') {
        throw new TypeError('abortSignals argument must be an iterable')
      }
      for (const abortSignal of abortSignals) {
        if (!(abortSignal instanceof AbortSignal)) {
          throw new TypeError(
            'abortSignals argument must be an iterable of AbortSignal',
          )
        }
      }
      if (!Array.isArray(abortSignals)) {
        abortSignals = [...abortSignals]
      }
      if ((data as Data[]).length !== (abortSignals as AbortSignal[]).length) {
        throw new Error(
          'data and abortSignals arguments must have the same length',
        )
      }
    }
    if (transferList != null && !Array.isArray(transferList)) {
      throw new TypeError('transferList argument must be an array')
    }
    const tasks: [Data, AbortSignal | undefined][] = Array.from(
      { length: (data as Data[]).length },
      (_, i) => [
        (data as Data[])[i],
        abortSignals != null ? (abortSignals as AbortSignal[])[i] : undefined,
      ],
    )
    return await Promise.all(
      tasks.map(([data, abortSignal]) =>
        this.internalExecute(data, name, abortSignal, transferList)
      ),
    )
  }

  /**
   * Starts the minimum number of workers.
   *
   * @param initWorkerNodeUsage - Whether to initialize the worker node usage or not. @defaultValue false
   */
  private startMinimumNumberOfWorkers(initWorkerNodeUsage = false): void {
    if (this.minimumNumberOfWorkers === 0) {
      return
    }
    this.startingMinimumNumberOfWorkers = true
    while (
      this.workerNodes.reduce(
        (accumulator, workerNode) =>
          !workerNode.info.dynamic ? accumulator + 1 : accumulator,
        0,
      ) < this.minimumNumberOfWorkers
    ) {
      const workerNodeKey = this.createAndSetupWorkerNode()
      initWorkerNodeUsage &&
        this.initWorkerNodeUsage(this.workerNodes[workerNodeKey])
    }
    this.startingMinimumNumberOfWorkers = false
  }

  /** @inheritdoc */
  public start(): void {
    if (this.started) {
      throw new Error('Cannot start an already started pool')
    }
    if (this.starting) {
      throw new Error('Cannot start an already starting pool')
    }
    if (this.destroying) {
      throw new Error('Cannot start a destroying pool')
    }
    this.starting = true
    this.startMinimumNumberOfWorkers()
    this.startTimestamp = performance.now()
    this.starting = false
    this.started = true
  }

  /** @inheritDoc */
  public async destroy(): Promise<void> {
    if (!this.started) {
      throw new Error('Cannot destroy an already destroyed pool')
    }
    if (this.starting) {
      throw new Error('Cannot destroy an starting pool')
    }
    if (this.destroying) {
      throw new Error('Cannot destroy an already destroying pool')
    }
    this.destroying = true
    await Promise.all(
      this.workerNodes.map(async (_, workerNodeKey) => {
        await this.destroyWorkerNode(workerNodeKey)
      }),
    )
    if (this.eventTarget != null) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.destroy, { detail: this.info }),
      )
      this.readyEventEmitted = false
    }
    delete this.startTimestamp
    this.destroying = false
    this.started = false
  }

  private async sendKillMessageToWorker(
    workerNodeKey: number,
    timeout = 1000,
  ): Promise<void> {
    let timeoutHandle: number | undefined
    let killMessageListener:
      | ((message: MessageValue<Response>) => void)
      | undefined
    try {
      await new Promise<void>((resolve, reject) => {
        timeoutHandle = timeout >= 0
          ? setTimeout(() => {
            resolve()
          }, timeout)
          : undefined
        killMessageListener = (message: MessageValue<Response>): void => {
          if (
            this.workerNodes.length === 0 ||
            this.workerNodes[workerNodeKey] == null
          ) {
            resolve()
            return
          }
          if (message.kill === 'success') {
            resolve()
          } else if (message.kill === 'failure') {
            reject(
              new Error(
                `Kill message handling failed on worker ${message.workerId?.toString()}`,
              ),
            )
          }
        }
        this.registerWorkerMessageListener(workerNodeKey, killMessageListener)
        this.sendToWorker(workerNodeKey, { kill: true })
      })
    } finally {
      if (timeoutHandle != null) {
        clearTimeout(timeoutHandle)
      }
      if (killMessageListener != null) {
        this.deregisterWorkerMessageListener(workerNodeKey, killMessageListener)
      }
    }
  }

  /**
   * Terminates the worker node given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected async destroyWorkerNode(workerNodeKey: number): Promise<void> {
    this.flagWorkerNodeAsNotReady(workerNodeKey)
    const flushedTasks = this.flushTasksQueue(workerNodeKey)
    const workerNode = this.workerNodes[workerNodeKey]
    await waitWorkerNodeEvents(
      workerNode,
      'taskFinished',
      flushedTasks,
      this.opts.tasksQueueOptions?.tasksFinishedTimeout ??
        getDefaultTasksQueueOptions(
          this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
        ).tasksFinishedTimeout,
      false,
    )
    await this.sendKillMessageToWorker(workerNodeKey)
    workerNode.terminate()
  }

  /**
   * Setup hook to execute code before worker nodes are created in the abstract constructor.
   * Can be overridden.
   *
   * @virtual
   */
  protected setupHook(): void {
    /* Intentionally empty */
  }

  /**
   * Returns whether the worker is the main worker or not.
   *
   * @returns `true` if the worker is the main worker, `false` otherwise.
   */
  protected abstract isMain(): boolean

  /**
   * Hook executed before the worker task execution.
   * Can be overridden.
   *
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   */
  protected beforeTaskExecutionHook(
    workerNodeKey: number,
    task: Task<Data>,
  ): void {
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      ++workerUsage.tasks.executing
      updateWaitTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        workerUsage,
        task,
      )
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      this.workerNodes[workerNodeKey].getTaskFunctionWorkerUsage(task.name!) !=
        null
    ) {
      const taskFunctionWorkerUsage = this.workerNodes[
        workerNodeKey
      ].getTaskFunctionWorkerUsage(task.name!)!
      ++taskFunctionWorkerUsage.tasks.executing
      updateWaitTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        taskFunctionWorkerUsage,
        task,
      )
    }
  }

  /**
   * Hook executed after the worker task execution.
   * Can be overridden.
   *
   * @param workerNodeKey - The worker node key.
   * @param message - The received message.
   */
  protected afterTaskExecutionHook(
    workerNodeKey: number,
    message: MessageValue<Response>,
  ): void {
    let needWorkerChoiceStrategiesUpdate = false
    if (this.workerNodes[workerNodeKey]?.usage != null) {
      const workerUsage = this.workerNodes[workerNodeKey].usage
      updateTaskStatisticsWorkerUsage(workerUsage, message)
      updateRunTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        workerUsage,
        message,
      )
      updateEluWorkerUsage(
        this.workerChoiceStrategiesContext,
        workerUsage,
        message,
      )
      needWorkerChoiceStrategiesUpdate = true
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      message.taskPerformance?.name != null &&
      this.workerNodes[workerNodeKey].getTaskFunctionWorkerUsage(
          message.taskPerformance.name,
        ) != null
    ) {
      const taskFunctionWorkerUsage = this.workerNodes[
        workerNodeKey
      ].getTaskFunctionWorkerUsage(message.taskPerformance.name)!
      updateTaskStatisticsWorkerUsage(taskFunctionWorkerUsage, message)
      updateRunTimeWorkerUsage(
        this.workerChoiceStrategiesContext,
        taskFunctionWorkerUsage,
        message,
      )
      updateEluWorkerUsage(
        this.workerChoiceStrategiesContext,
        taskFunctionWorkerUsage,
        message,
      )
      needWorkerChoiceStrategiesUpdate = true
    }
    if (needWorkerChoiceStrategiesUpdate) {
      this.workerChoiceStrategiesContext?.update(workerNodeKey)
    }
  }

  /**
   * Whether the worker node shall update its task function worker usage or not.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the worker node shall update its task function worker usage, `false` otherwise.
   */
  private shallUpdateTaskFunctionWorkerUsage(workerNodeKey: number): boolean {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    return (
      workerInfo != null &&
      Array.isArray(workerInfo.taskFunctionsProperties) &&
      workerInfo.taskFunctionsProperties.length > 2
    )
  }

  /**
   * Chooses a worker node for the next task.
   *
   * @param name - The task function name.
   * @returns The chosen worker node key.
   */
  private chooseWorkerNode(name?: string): number {
    if (this.shallCreateDynamicWorker()) {
      const workerNodeKey = this.createAndSetupDynamicWorkerNode()
      if (
        this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerUsage ===
          true
      ) {
        return workerNodeKey
      }
    }
    return this.workerChoiceStrategiesContext!.execute(
      this.getTaskFunctionWorkerChoiceStrategy(name),
    )
  }

  /**
   * Conditions for dynamic worker creation.
   *
   * @returns Whether to create a dynamic worker or not.
   */
  protected abstract shallCreateDynamicWorker(): boolean

  /**
   * Sends a message to worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param message - The message.
   * @param transferList - The optional array of transferable objects.
   */
  protected abstract sendToWorker(
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: readonly Transferable[],
  ): void

  /**
   * Initializes the worker node usage with sensible default values gathered during runtime.
   *
   * @param workerNode - The worker node.
   */
  private initWorkerNodeUsage(workerNode: IWorkerNode<Worker, Data>): void {
    if (
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .runTime.aggregate === true
    ) {
      workerNode.usage.runTime.aggregate = min(
        ...this.workerNodes.map(
          (workerNode) =>
            workerNode.usage.runTime.aggregate ?? Number.POSITIVE_INFINITY,
        ),
      )
    }
    if (
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        .waitTime.aggregate === true
    ) {
      workerNode.usage.waitTime.aggregate = min(
        ...this.workerNodes.map(
          (workerNode) =>
            workerNode.usage.waitTime.aggregate ?? Number.POSITIVE_INFINITY,
        ),
      )
    }
    if (
      this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements().elu
        .aggregate === true
    ) {
      workerNode.usage.elu.active.aggregate = min(
        ...this.workerNodes.map(
          (workerNode) =>
            workerNode.usage.elu.active.aggregate ?? Number.POSITIVE_INFINITY,
        ),
      )
    }
  }

  /**
   * Creates a new, completely set up worker node.
   *
   * @returns New, completely set up worker node key.
   */
  protected createAndSetupWorkerNode(): number {
    const workerNode = this.createWorkerNode()
    workerNode.worker.onmessage = this.opts.messageEventHandler ??
      EMPTY_FUNCTION
    workerNode.worker.onmessageerror = (messageEvent) => {
      this.eventTarget?.dispatchEvent(
        new ErrorEvent(PoolEvents.messageerror, { error: messageEvent }),
      )
    }
    workerNode.worker.onerror = (errorEvent) => {
      workerNode.info.ready = false
      this.eventTarget?.dispatchEvent(
        new ErrorEvent(PoolEvents.error, errorEvent),
      )
      if (
        this.started &&
        !this.destroying &&
        this.opts.restartWorkerOnError === true
      ) {
        if (workerNode.info.dynamic) {
          this.createAndSetupDynamicWorkerNode()
        } else if (!this.startingMinimumNumberOfWorkers) {
          this.startMinimumNumberOfWorkers(true)
        }
      }
      if (
        this.started &&
        !this.destroying &&
        this.opts.enableTasksQueue === true
      ) {
        this.redistributeQueuedTasks(this.workerNodes.indexOf(workerNode))
      }
      workerNode?.terminate()
    }
    workerNode.worker.addEventListener(
      'messageerror',
      this.opts.messageEventErrorHandler ?? EMPTY_FUNCTION,
    )
    workerNode.worker.addEventListener(
      'error',
      this.opts.errorEventHandler ?? EMPTY_FUNCTION,
    )
    workerNode.addEventListener(
      'exit',
      () => {
        this.removeWorkerNode(workerNode)
        if (
          this.started &&
          !this.startingMinimumNumberOfWorkers &&
          !this.destroying
        ) {
          this.startMinimumNumberOfWorkers(true)
        }
      },
      { once: true },
    )
    const workerNodeKey = this.addWorkerNode(workerNode)
    this.afterWorkerNodeSetup(workerNodeKey)
    return workerNodeKey
  }

  /**
   * Creates a new, completely set up dynamic worker node.
   *
   * @returns New, completely set up dynamic worker node key.
   */
  protected createAndSetupDynamicWorkerNode(): number {
    const workerNodeKey = this.createAndSetupWorkerNode()
    this.registerWorkerMessageListener(workerNodeKey, (message) => {
      if (this.destroying) {
        return
      }
      this.checkMessageWorkerId(message)
      const localWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(
        message.workerId,
      )
      // Kill message received from worker
      if (
        isKillBehavior(KillBehaviors.HARD, message.kill) ||
        (isKillBehavior(KillBehaviors.SOFT, message.kill) &&
          this.isWorkerNodeIdle(localWorkerNodeKey) &&
          !this.isWorkerNodeStealing(localWorkerNodeKey))
      ) {
        this.destroyWorkerNode(localWorkerNodeKey).catch((error) => {
          this.eventTarget?.dispatchEvent(
            new ErrorEvent(PoolEvents.error, { error }),
          )
        })
      }
    })
    this.sendToWorker(workerNodeKey, {
      checkActive: true,
    })
    if (this.taskFunctions.size > 0) {
      for (const [taskFunctionName, taskFunctionObject] of this.taskFunctions) {
        this.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunctionOperation: 'add',
          taskFunctionProperties: buildTaskFunctionProperties(
            taskFunctionName,
            taskFunctionObject,
          ),
          taskFunction: taskFunctionObject.taskFunction.toString(),
        }).catch((error) => {
          this.eventTarget?.dispatchEvent(
            new ErrorEvent(PoolEvents.error, { error }),
          )
        })
      }
    }
    const workerNode = this.workerNodes[workerNodeKey]
    workerNode.info.dynamic = true
    if (
      this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerReady ===
        true
    ) {
      workerNode.info.ready = true
    }
    this.initWorkerNodeUsage(workerNode)
    this.checkAndEmitDynamicWorkerCreationEvents()
    return workerNodeKey
  }

  /**
   * Registers a listener callback on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract registerWorkerMessageListener<
    Message extends Data | Response,
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void,
  ): void

  /**
   * Registers once a listener callback on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract registerOnceWorkerMessageListener<
    Message extends Data | Response,
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void,
  ): void

  /**
   * Deregisters a listener callback on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param listener - The message listener callback.
   */
  protected abstract deregisterWorkerMessageListener<
    Message extends Data | Response,
  >(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void,
  ): void

  /**
   * Method hooked up after a worker node has been newly created.
   * Can be overridden.
   *
   * @param workerNodeKey - The newly created worker node key.
   */
  protected afterWorkerNodeSetup(workerNodeKey: number): void {
    // Listen to worker messages.
    this.registerWorkerMessageListener(
      workerNodeKey,
      this.workerMessageListener,
    )
    // Send the startup message to worker.
    this.sendStartupMessageToWorker(workerNodeKey)
    // Send the statistics message to worker.
    this.sendStatisticsMessageToWorker(workerNodeKey)
    if (this.opts.enableTasksQueue === true) {
      if (this.opts.tasksQueueOptions?.taskStealing === true) {
        this.workerNodes[workerNodeKey].addEventListener(
          'idle',
          this.handleWorkerNodeIdleEvent as EventListener,
        )
      }
      if (this.opts.tasksQueueOptions?.tasksStealingOnBackPressure === true) {
        this.workerNodes[workerNodeKey].addEventListener(
          'backPressure',
          this.handleWorkerNodeBackPressureEvent as EventListener,
        )
      }
    }
    this.workerNodes[workerNodeKey].addEventListener(
      'abortTask',
      this.abortTask as EventListener,
    )
  }

  /**
   * Sends the startup message to worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected abstract sendStartupMessageToWorker(workerNodeKey: number): void

  /**
   * Sends the statistics message to worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  private sendStatisticsMessageToWorker(workerNodeKey: number): void {
    this.sendToWorker(workerNodeKey, {
      statistics: {
        runTime:
          this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
            .runTime.aggregate ?? false,
        // elu: this.workerChoiceStrategiesContext?.getTaskStatisticsRequirements()
        //   .elu.aggregate ?? false,
      },
    })
  }

  private cannotStealTask(): boolean {
    return (
      !this.started ||
      this.destroying ||
      this.workerNodes.length <= 1 ||
      this.info.queuedTasks === 0
    )
  }

  private handleTask(workerNodeKey: number, task: Task<Data>): void {
    if (this.shallExecuteTask(workerNodeKey)) {
      this.executeTask(workerNodeKey, task)
    } else {
      this.enqueueTask(workerNodeKey, task)
    }
  }

  private redistributeQueuedTasks(sourceWorkerNodeKey: number): void {
    if (sourceWorkerNodeKey === -1 || this.cannotStealTask()) {
      return
    }
    while (this.tasksQueueSize(sourceWorkerNodeKey) > 0) {
      const destinationWorkerNodeKey = this.workerNodes.reduce(
        (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
          return workerNodeKey !== sourceWorkerNodeKey &&
              workerNode.info.ready &&
              workerNode.usage.tasks.queued <
                workerNodes[minWorkerNodeKey].usage.tasks.queued
            ? workerNodeKey
            : minWorkerNodeKey
        },
        0,
      )
      this.handleTask(
        destinationWorkerNodeKey,
        this.dequeueTask(sourceWorkerNodeKey) as Task<Data>,
      )
    }
  }

  private updateTaskStolenStatisticsWorkerUsage(
    workerNodeKey: number,
    taskName: string,
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode?.usage != null) {
      ++workerNode.usage.tasks.stolen
    }
    if (
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      ++workerNode.getTaskFunctionWorkerUsage(taskName)!.tasks.stolen
    }
  }

  private updateTaskSequentiallyStolenStatisticsWorkerUsage(
    workerNodeKey: number,
    taskName?: string,
    previousTaskName?: string,
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode?.usage != null && taskName != null) {
      ++workerNode.usage.tasks.sequentiallyStolen
    }
    if (
      taskName != null &&
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      const taskFunctionWorkerUsage = workerNode.getTaskFunctionWorkerUsage(
        taskName,
      )!
      if (
        taskFunctionWorkerUsage.tasks.sequentiallyStolen === 0 ||
        (previousTaskName != null &&
          previousTaskName === taskName &&
          taskFunctionWorkerUsage.tasks.sequentiallyStolen > 0)
      ) {
        ++taskFunctionWorkerUsage.tasks.sequentiallyStolen
      } else if (taskFunctionWorkerUsage.tasks.sequentiallyStolen > 0) {
        taskFunctionWorkerUsage.tasks.sequentiallyStolen = 0
      }
    }
  }

  private resetTaskSequentiallyStolenStatisticsWorkerUsage(
    workerNodeKey: number,
    taskName?: string,
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode?.usage != null) {
      workerNode.usage.tasks.sequentiallyStolen = 0
    }
    if (
      taskName != null &&
      this.shallUpdateTaskFunctionWorkerUsage(workerNodeKey) &&
      workerNode.getTaskFunctionWorkerUsage(taskName) != null
    ) {
      workerNode.getTaskFunctionWorkerUsage(
        taskName,
      )!.tasks.sequentiallyStolen = 0
    }
  }

  private readonly stealTask = (
    sourceWorkerNode: IWorkerNode<Worker, Data>,
    destinationWorkerNodeKey: number,
  ): Task<Data> | undefined => {
    const destinationWorkerNode = this.workerNodes[destinationWorkerNodeKey]
    if (destinationWorkerNode == null) {
      return
    }
    // Avoid cross and cascade task stealing. Could be smarter by checking stealing/stolen worker ids pair.
    if (
      !sourceWorkerNode.info.ready ||
      sourceWorkerNode.info.stolen ||
      sourceWorkerNode.info.stealing ||
      sourceWorkerNode.info.queuedTaskAbortion ||
      !destinationWorkerNode.info.ready ||
      destinationWorkerNode.info.stolen ||
      destinationWorkerNode.info.stealing ||
      destinationWorkerNode.info.queuedTaskAbortion
    ) {
      return
    }
    destinationWorkerNode.info.stealing = true
    sourceWorkerNode.info.stolen = true
    const stolenTask = sourceWorkerNode.dequeueLastPrioritizedTask()!
    sourceWorkerNode.info.stolen = false
    destinationWorkerNode.info.stealing = false
    this.handleTask(destinationWorkerNodeKey, stolenTask)
    this.updateTaskStolenStatisticsWorkerUsage(
      destinationWorkerNodeKey,
      stolenTask.name!,
    )
    return stolenTask
  }

  private readonly isStealingRatioReached = (): boolean => {
    return (
      this.opts.tasksQueueOptions?.tasksStealingRatio === 0 ||
      (this.info.stealingWorkerNodes ?? 0) >
        Math.ceil(
          this.workerNodes.length *
            this.opts.tasksQueueOptions!.tasksStealingRatio!,
        )
    )
  }

  private readonly handleWorkerNodeIdleEvent = (
    event: CustomEvent<WorkerNodeEventDetail>,
    previousStolenTask?: Task<Data>,
  ): void => {
    const { workerNodeKey } = event.detail
    if (workerNodeKey == null) {
      throw new Error(
        "WorkerNode event detail 'workerNodeKey' property must be defined",
      )
    }
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) {
      return
    }
    if (
      !workerNode.info.continuousStealing &&
      (this.cannotStealTask() || this.isStealingRatioReached())
    ) {
      return
    }
    const workerNodeTasksUsage = workerNode.usage.tasks
    if (
      workerNode.info.continuousStealing &&
      !this.isWorkerNodeIdle(workerNodeKey)
    ) {
      workerNode.info.continuousStealing = false
      if (workerNodeTasksUsage.sequentiallyStolen > 0) {
        this.resetTaskSequentiallyStolenStatisticsWorkerUsage(
          workerNodeKey,
          previousStolenTask?.name,
        )
      }
      return
    }
    workerNode.info.continuousStealing = true
    const stolenTask = this.workerNodeStealTask(workerNodeKey)
    this.updateTaskSequentiallyStolenStatisticsWorkerUsage(
      workerNodeKey,
      stolenTask?.name,
      previousStolenTask?.name,
    )
    sleep(exponentialDelay(workerNodeTasksUsage.sequentiallyStolen))
      .then(() => {
        this.handleWorkerNodeIdleEvent(event, stolenTask)
      })
      .catch((error) => {
        this.eventTarget?.dispatchEvent(
          new ErrorEvent(PoolEvents.error, { error }),
        )
      })
  }

  private readonly workerNodeStealTask = (
    workerNodeKey: number,
  ): Task<Data> | undefined => {
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeB.usage.tasks.queued - workerNodeA.usage.tasks.queued,
      )
    const sourceWorkerNode = workerNodes.find(
      (sourceWorkerNode, sourceWorkerNodeKey) =>
        sourceWorkerNodeKey !== workerNodeKey &&
        sourceWorkerNode.usage.tasks.queued > 0,
    )
    if (sourceWorkerNode != null) {
      return this.stealTask(sourceWorkerNode, workerNodeKey)
    }
  }

  private readonly handleWorkerNodeBackPressureEvent = (
    event: CustomEvent<WorkerNodeEventDetail>,
  ): void => {
    if (
      this.cannotStealTask() ||
      this.backPressure ||
      this.isStealingRatioReached()
    ) {
      return
    }
    const sizeOffset = 1
    if (this.opts.tasksQueueOptions!.size! <= sizeOffset) {
      return
    }
    const { workerId } = event.detail
    const sourceWorkerNode =
      this.workerNodes[this.getWorkerNodeKeyByWorkerId(workerId)]
    if (sourceWorkerNode == null) {
      return
    }
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeA.usage.tasks.queued - workerNodeB.usage.tasks.queued,
      )
    for (const [workerNodeKey, workerNode] of workerNodes.entries()) {
      if (sourceWorkerNode.usage.tasks.queued === 0) {
        break
      }
      if (
        workerNode.info.id !== workerId &&
        !workerNode.info.backPressureStealing &&
        workerNode.usage.tasks.queued <
          this.opts.tasksQueueOptions!.size! - sizeOffset
      ) {
        workerNode.info.backPressureStealing = true
        this.stealTask(sourceWorkerNode, workerNodeKey)
        workerNode.info.backPressureStealing = false
      }
    }
  }

  private setTasksQueuePriority(workerNodeKey: number): void {
    this.workerNodes[workerNodeKey].setTasksQueuePriority(
      this.getTasksQueuePriority(),
    )
  }

  /**
   * This method is the message listener registered on each worker.
   *
   * @param message - The message received from the worker.
   */
  protected readonly workerMessageListener = (
    message: MessageValue<Response>,
  ): void => {
    const { kill, ready, taskFunctionsProperties, taskId, workerId } = message
    const workerReadyMessage = ready != null && taskFunctionsProperties != null
    // Late worker ready message received
    if (this.destroying && workerReadyMessage) {
      return
    }
    // Kill messages responses are handled in dedicated listeners
    if (kill != null) {
      return
    }
    this.checkMessageWorkerId(message)
    if (workerReadyMessage) {
      // Worker ready response received from worker
      this.handleWorkerReadyResponse(message)
    } else if (taskFunctionsProperties != null) {
      // Task function properties message received from worker
      const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
      const workerInfo = this.getWorkerInfo(workerNodeKey)
      if (workerInfo != null) {
        workerInfo.taskFunctionsProperties = taskFunctionsProperties
        this.sendStatisticsMessageToWorker(workerNodeKey)
        this.setTasksQueuePriority(workerNodeKey)
      }
    } else if (taskId != null) {
      // Task execution response received from worker
      this.handleTaskExecutionResponse(message)
    }
  }

  private checkAndEmitReadyEvent(): void {
    if (this.eventTarget != null && !this.readyEventEmitted && this.ready) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.ready, { detail: this.info }),
      )
      this.readyEventEmitted = true
    }
  }

  private handleWorkerReadyResponse(message: MessageValue<Response>): void {
    const { workerId, ready, taskFunctionsProperties } = message
    if (ready == null || !ready) {
      throw new Error(`Worker ${workerId?.toString()} failed to initialize`)
    }
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const workerNode = this.workerNodes[workerNodeKey]
    workerNode.info.ready = ready
    workerNode.info.taskFunctionsProperties = taskFunctionsProperties
    this.sendStatisticsMessageToWorker(workerNodeKey)
    this.setTasksQueuePriority(workerNodeKey)
    this.checkAndEmitReadyEvent()
  }

  private handleTaskExecutionResponse(message: MessageValue<Response>): void {
    const { name, taskId, workerError, data } = message
    const promiseResponse = this.promiseResponseMap.get(taskId!)
    if (promiseResponse != null) {
      const { resolve, reject, workerNodeKey } = promiseResponse
      const workerNode = this.workerNodes[workerNodeKey]
      if (workerError != null) {
        this.eventTarget?.dispatchEvent(
          new ErrorEvent(PoolEvents.taskError, { error: workerError }),
        )
        const { aborted, error } = workerError
        let wError: Error = error
        if (aborted) {
          wError = this.getAbortError(name!, taskId!)
        }
        reject(wError)
      } else {
        resolve(data!)
      }
      this.afterTaskExecutionHook(workerNodeKey, message)
      queueMicrotask(() => {
        this.checkAndEmitTaskExecutionFinishedEvents()
        workerNode?.dispatchEvent(new Event('taskFinished'))
        this.promiseResponseMap.delete(taskId!)
        if (this.opts.enableTasksQueue === true && !this.destroying) {
          if (
            !this.isWorkerNodeBusy(workerNodeKey) &&
            this.tasksQueueSize(workerNodeKey) > 0
          ) {
            this.executeTask(
              workerNodeKey,
              this.dequeueTask(workerNodeKey) as Task<Data>,
            )
          }
          if (this.isWorkerNodeIdle(workerNodeKey)) {
            workerNode.dispatchEvent(
              new CustomEvent<WorkerNodeEventDetail>('idle', {
                detail: { workerNodeKey },
              }),
            )
          }
        }
        if (this.shallCreateDynamicWorker()) {
          this.createAndSetupDynamicWorkerNode()
        }
      })
    }
  }

  private checkAndEmitTaskExecutionEvents(): void {
    if (this.eventTarget != null && !this.busyEventEmitted && this.busy) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.busy, { detail: this.info }),
      )
      this.busyEventEmitted = true
    }
  }

  private checkAndEmitTaskExecutionFinishedEvents(): void {
    if (this.eventTarget != null && this.busyEventEmitted && !this.busy) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.busyEnd, { detail: this.info }),
      )
      this.busyEventEmitted = false
    }
  }

  private checkAndEmitTaskQueuingEvents(): void {
    if (
      this.eventTarget != null &&
      !this.backPressureEventEmitted &&
      this.backPressure
    ) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.backPressure, {
          detail: this.info,
        }),
      )
      this.backPressureEventEmitted = true
    }
  }

  private checkAndEmitTaskDequeuingEvents(): void {
    if (
      this.eventTarget != null &&
      this.backPressureEventEmitted &&
      !this.backPressure
    ) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.backPressureEnd, {
          detail: this.info,
        }),
      )
      this.backPressureEventEmitted = false
    }
  }

  /**
   * Emits dynamic worker creation events.
   */
  protected abstract checkAndEmitDynamicWorkerCreationEvents(): void

  /**
   * Emits dynamic worker destruction events.
   */
  protected abstract checkAndEmitDynamicWorkerDestructionEvents(): void

  /**
   * Gets the worker information given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker information.
   */
  protected getWorkerInfo(workerNodeKey: number): WorkerInfo | undefined {
    return this.workerNodes[workerNodeKey]?.info
  }

  private getTasksQueuePriority(): boolean {
    return this.listTaskFunctionsProperties().some(
      (taskFunctionProperties) => taskFunctionProperties.priority != null,
    )
  }

  /**
   * Creates a worker node.
   *
   * @returns The created worker node.
   */
  private createWorkerNode(): IWorkerNode<Worker, Data> {
    const workerNode = new WorkerNode<Worker, Data>(this.worker, this.fileURL, {
      workerOptions: this.opts.workerOptions,
      tasksQueueBackPressureSize: this.opts.tasksQueueOptions?.size ??
        getDefaultTasksQueueOptions(
          this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
        ).size,
      tasksQueueBucketSize: defaultBucketSize,
      tasksQueuePriority: this.getTasksQueuePriority(),
    })
    // Flag the worker node as ready at pool startup.
    if (this.starting) {
      workerNode.info.ready = true
    }
    return workerNode
  }

  private readonly abortTask = (
    event: CustomEvent<WorkerNodeEventDetail>,
  ): void => {
    if (!this.started) {
      return
    }
    const { taskId, workerId } = event.detail
    const promiseResponse = this.promiseResponseMap.get(taskId!)
    if (promiseResponse == null) {
      return
    }
    const { abortSignal, reject } = promiseResponse
    if (abortSignal?.aborted === false) {
      return
    }
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const workerNode = this.workerNodes[workerNodeKey]
    if (!workerNode.info.ready) {
      return
    }
    if (this.opts.enableTasksQueue === true) {
      for (const task of workerNode.tasksQueue) {
        const { abortable, name } = task
        if (taskId === task.taskId && abortable === true) {
          workerNode.info.queuedTaskAbortion = true
          workerNode.deleteTask(task)
          this.promiseResponseMap.delete(taskId!)
          workerNode.info.queuedTaskAbortion = false
          reject(this.getAbortError(name!, taskId!))
          return
        }
      }
    }
    this.sendToWorker(workerNodeKey, { taskId, taskOperation: 'abort' })
  }

  /**
   * Adds the given worker node in the pool worker nodes.
   *
   * @param workerNode - The worker node.
   * @returns The added worker node key.
   * @throws {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error} If the added worker node is not found.
   */
  private addWorkerNode(workerNode: IWorkerNode<Worker, Data>): number {
    this.workerNodes.push(workerNode)
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey === -1) {
      throw new Error('Worker node added not found in pool worker nodes')
    }
    return workerNodeKey
  }

  /**
   * Removes the worker node from the pool worker nodes.
   *
   * @param workerNode - The worker node.
   */
  protected removeWorkerNode(workerNode: IWorkerNode<Worker, Data>): void {
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      this.workerChoiceStrategiesContext?.remove(workerNodeKey)
      workerNode.info.dynamic &&
        this.checkAndEmitDynamicWorkerDestructionEvents()
    }
  }

  protected flagWorkerNodeAsNotReady(workerNodeKey: number): void {
    const workerInfo = this.getWorkerInfo(workerNodeKey)
    if (workerInfo != null) {
      workerInfo.ready = false
    }
  }

  /**
   * Whether the worker nodes are back pressured or not.
   *
   * @returns Worker nodes back pressure boolean status.
   */
  protected internalBackPressure(): boolean {
    return (
      this.workerNodes.reduce(
        (accumulator, _, workerNodeKey) =>
          this.isWorkerNodeBackPressured(workerNodeKey)
            ? accumulator + 1
            : accumulator,
        0,
      ) === this.workerNodes.length
    )
  }

  /**
   * Executes the given task on the worker given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   * @param task - The task to execute.
   */
  private executeTask(workerNodeKey: number, task: Task<Data>): void {
    const { transferList } = task
    this.beforeTaskExecutionHook(workerNodeKey, task)
    this.sendToWorker(workerNodeKey, task, transferList)
    this.checkAndEmitTaskExecutionEvents()
  }

  private enqueueTask(workerNodeKey: number, task: Task<Data>): number {
    const tasksQueueSize = this.workerNodes[workerNodeKey].enqueueTask(task)
    this.checkAndEmitTaskQueuingEvents()
    return tasksQueueSize
  }

  private dequeueTask(workerNodeKey: number): Task<Data> | undefined {
    const task = this.workerNodes[workerNodeKey].dequeueTask()
    this.checkAndEmitTaskDequeuingEvents()
    return task
  }

  private tasksQueueSize(workerNodeKey: number): number {
    return this.workerNodes[workerNodeKey].tasksQueueSize()
  }

  protected flushTasksQueue(workerNodeKey: number): number {
    let flushedTasks = 0
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      this.executeTask(
        workerNodeKey,
        this.dequeueTask(workerNodeKey) as Task<Data>,
      )
      ++flushedTasks
    }
    this.workerNodes[workerNodeKey].clearTasksQueue()
    return flushedTasks
  }

  private flushTasksQueues(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }
}
