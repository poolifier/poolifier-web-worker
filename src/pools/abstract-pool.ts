import { defaultBucketSize } from '../queues/queue-types.ts'
import type {
  MessageValue,
  PromiseResponseWrapper,
  Task,
  TaskFunctionProperties,
  UUID,
} from '../utility-types.ts'
import {
  average,
  buildTaskFunctionProperties,
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  exponentialDelay,
  isKillBehavior,
  isPlainObject,
  JSRuntime,
  max,
  median,
  min,
  round,
  runtime,
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
  checkSpecifier,
  checkValidPriority,
  checkValidTasksQueueOptions,
  checkValidWorkerChoiceStrategy,
  checkValidWorkerNodeKeys,
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

// Browsers do not provide the native compatibility module.
type ReceiveMessageOnPort = (
  port: MessagePort,
) => { message: unknown } | undefined
const receiveMessageOnPort: ReceiveMessageOnPort | undefined =
  runtime !== JSRuntime.browser
    // @ts-ignore Node.js compatibility modules are not public declaration dependencies.
    ? (await import('node:worker_threads'))
      .receiveMessageOnPort as unknown as ReceiveMessageOnPort
    : undefined

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
  protected promiseResponseMap: Map<UUID, PromiseResponseWrapper<Response>> =
    new Map<UUID, PromiseResponseWrapper<Response>>()

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
   * - `value`: The captured task function registration message.
   */
  private readonly taskFunctions: Map<
    string,
    Required<
      Pick<
        MessageValue<Data>,
        'taskFunction' | 'taskFunctionOperation' | 'taskFunctionProperties'
      >
    >
  >

  /**
   * Queue tail for pool-wide task function mutations.
   */
  private taskFunctionOperationsQueue?: Promise<void>

  /**
   * The last explicit default acknowledged by an operation's worker cohort.
   */
  private defaultTaskFunctionName?: string
  private pendingTaskFunctionOperations = 0
  private resolveTaskFunctionOperations?: (value: undefined) => void
  private taskFunctionOperationsFinished?: Promise<undefined>
  private readonly workerTaskFunctionBootstraps = new Map<
    IWorkerNode<Worker, Data>,
    { promise?: Promise<void>; ready: boolean }
  >()
  private readonly workerTaskFunctionOperationExitListeners = new Map<
    IWorkerNode<Worker, Data>,
    Set<() => void>
  >()

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
   * Whether task dequeuing events are deferred until worker exit handoffs finish.
   */
  private taskDequeuingEventsDeferred = false

  /**
   * Worker nodes whose termination was requested by the pool.
   */
  private readonly terminatingWorkerNodes = new WeakSet<
    IWorkerNode<Worker, Data>
  >()

  /**
   * Constructs a new poolifier pool.
   *
   * @param minimumNumberOfWorkers - Minimum number of workers that this pool manages.
   * @param specifier - Specifier to the worker file.
   * @param opts - Options for the pool.
   * @param maximumNumberOfWorkers - Maximum number of workers that this pool manages.
   */
  public constructor(
    protected readonly minimumNumberOfWorkers: number,
    protected readonly specifier: URL | string,
    protected readonly opts: PoolOptions,
    protected readonly maximumNumberOfWorkers?: number,
  ) {
    if (!this.isMain()) {
      throw new Error(
        'Cannot start a pool from a worker with the same type as the pool',
      )
    }
    this.checkPoolType()
    checkSpecifier(this.specifier)
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

    this.taskFunctions = new Map()

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
        'Cannot instantiate a fixed pool with a maximum number of workers defined at initialization',
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
        WorkerChoiceStrategies.LEAST_USED
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
    const taskStatisticsRequirements = this.workerChoiceStrategiesContext
      ?.getTaskStatisticsRequirements()
    return {
      version,
      type: this.type,
      worker: this.worker,
      started: this.started,
      ready: this.ready,
      defaultStrategy: this.opts.workerChoiceStrategy!,
      strategyRetries:
        this.workerChoiceStrategiesContext?.getStrategyRetries() ?? 0,
      minSize: this.minimumNumberOfWorkers,
      maxSize: this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
      ...(taskStatisticsRequirements?.runTime.aggregate === true &&
        taskStatisticsRequirements.waitTime.aggregate && {
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
        stealingWorkerNodes: this.getStealingWorkerNodes(),
        queuedTasks: this.getQueuedTasks(),
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
      ...(taskStatisticsRequirements?.runTime.aggregate === true && {
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
          ...(taskStatisticsRequirements?.runTime.average && {
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
          ...(taskStatisticsRequirements?.runTime.median && {
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
      ...(taskStatisticsRequirements?.waitTime.aggregate === true && {
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
          ...(taskStatisticsRequirements?.waitTime.average && {
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
          ...(taskStatisticsRequirements?.waitTime.median && {
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
    if (!Number.isFinite(poolTimeCapacity) || poolTimeCapacity <= 0) {
      return 0
    }
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
   * @throws {Error} If the worker id is invalid.
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
        this.workerNodeIdleEventListener as EventListener,
      )
    }
  }

  private unsetTaskStealing(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.workerNodes[workerNodeKey].removeEventListener(
        'idle',
        this.workerNodeIdleEventListener as EventListener,
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
    if (this.workerNodes.length === 0) return false
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

  private queueTaskFunctionOperation(
    operation: () => Promise<boolean>,
  ): Promise<boolean> {
    const result = (this.taskFunctionOperationsQueue ?? Promise.resolve()).then(
      operation,
    )
    this.taskFunctionOperationsQueue = result.then(
      EMPTY_FUNCTION,
      EMPTY_FUNCTION,
    )
    return result
  }

  private async sendTaskFunctionOperationToWorker(
    workerNodeKey: number,
    message: MessageValue<Data>,
  ): Promise<boolean> {
    const workerNode = this.workerNodes[workerNodeKey]
    const workerId = this.getWorkerInfo(workerNodeKey)?.id
    const taskFunctionOperationId = crypto.randomUUID()
    const { promise, reject, resolve } = Promise.withResolvers<boolean>()
    const listener = (message: MessageValue<Response>): void => {
      if (
        message.taskFunctionOperationStatus != null &&
        message.workerId === workerId &&
        (message.taskFunctionOperationId == null ||
          message.taskFunctionOperationId === taskFunctionOperationId)
      ) {
        this.checkMessageWorkerId(message)
        if (message.taskFunctionOperationId == null) {
          reject(
            this.getTaskFunctionOperationAcknowledgementError(message.workerId),
          )
          return
        }
        if (message.taskFunctionOperationStatus) {
          resolve(true)
          return
        }
        reject(
          new Error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Task function operation '${message.taskFunctionOperation?.toString()}' failed on worker ${message.workerId?.toString()} with error: '${
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              message.workerError?.error?.message}'`,
          ),
        )
      }
    }
    const cleanup = this.createWorkerMessageListenerCleanup(
      workerNode,
      listener,
    )
    const exitListener = (): void => {
      cleanup()
      reject(
        new Error(
          `Worker ${
            String(workerId)
          } exited before acknowledging task function operation '${
            message.taskFunctionOperation ?? 'unknown'
          }'`,
        ),
      )
    }
    try {
      this.registerTaskFunctionOperationExitListener(workerNode, exitListener)
      this.registerWorkerMessageListener(workerNodeKey, listener)
      this.sendToWorker(workerNodeKey, {
        ...message,
        taskFunctionOperationId,
      })
    } catch (error) {
      reject(error)
    }
    try {
      return await promise
    } finally {
      this.deregisterTaskFunctionOperationExitListener(workerNode, exitListener)
      cleanup()
    }
  }

  private async sendTaskFunctionOperationToWorkers(
    message: MessageValue<Data>,
  ): Promise<boolean> {
    if (this.workerNodes.length === 0) {
      return true
    }
    const taskFunctionOperationId = crypto.randomUUID()
    const responsesReceived = new Map<
      WorkerInfo['id'] | undefined,
      MessageValue<Response> | undefined
    >()
    for (const workerNode of this.workerNodes) {
      responsesReceived.set(workerNode.info.id, undefined)
    }
    let remainingResponses = responsesReceived.size
    let errorResponse: MessageValue<Response> | undefined
    let protocolError: Error | undefined
    const { promise, reject, resolve } = Promise.withResolvers<boolean>()
    const listeners: {
      cleanup: () => void
      exitListener: () => void
      workerNode: IWorkerNode<Worker, Data>
    }[] = []
    const complete = (): void => {
      if (remainingResponses !== 0) return
      if (protocolError != null) {
        reject(protocolError)
      } else if (errorResponse != null) {
        reject(
          new Error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `Task function operation '${message
              .taskFunctionOperation as string}' failed on worker ${errorResponse.workerId?.toString()} with error: '${
              errorResponse.workerError?.error?.message ?? 'Unknown error'
            }'`,
          ),
        )
      } else if (responsesReceived.size === 0) {
        reject(
          new Error(
            `All targets exited before acknowledging task function operation '${
              message.taskFunctionOperation ?? 'unknown'
            }'`,
          ),
        )
      } else {
        resolve(true)
      }
    }
    const listener = (message: MessageValue<Response>): void => {
      if (
        message.taskFunctionOperationStatus != null &&
        (message.taskFunctionOperationId == null ||
          message.taskFunctionOperationId === taskFunctionOperationId) &&
        responsesReceived.has(message.workerId) &&
        responsesReceived.get(message.workerId) == null
      ) {
        this.checkMessageWorkerId(message)
        responsesReceived.set(message.workerId, message)
        --remainingResponses
        if (message.taskFunctionOperationId == null) {
          protocolError ??= this.getTaskFunctionOperationAcknowledgementError(
            message.workerId,
          )
        } else if (!message.taskFunctionOperationStatus) {
          errorResponse ??= message
        }
        complete()
      }
    }
    try {
      for (const workerId of responsesReceived.keys()) {
        const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
        const workerNode = this.workerNodes[workerNodeKey]
        const cleanup = this.createWorkerMessageListenerCleanup(
          workerNode,
          listener,
        )
        const exitListener = (): void => {
          cleanup()
          if (
            responsesReceived.has(workerId) &&
            responsesReceived.get(workerId) == null
          ) {
            responsesReceived.delete(workerId)
            --remainingResponses
            complete()
          }
        }
        listeners.push({ cleanup, exitListener, workerNode })
        this.registerTaskFunctionOperationExitListener(workerNode, exitListener)
        this.registerWorkerMessageListener(workerNodeKey, listener)
        this.sendToWorker(workerNodeKey, {
          ...message,
          taskFunctionOperationId,
        })
      }
    } catch (error) {
      reject(error)
    }
    try {
      return await promise
    } finally {
      for (const { cleanup, exitListener, workerNode } of listeners) {
        this.deregisterTaskFunctionOperationExitListener(
          workerNode,
          exitListener,
        )
        cleanup()
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
    const taskFunction = typeof fn === 'function' ? fn : fn.taskFunction
    if (typeof taskFunction !== 'function') {
      throw new TypeError('taskFunction property must be a function')
    }
    const definition: TaskFunctionObject<Data, Response> = { taskFunction }
    if (typeof fn !== 'function') {
      const { priority, strategy, workerNodeKeys } = fn
      if (priority !== undefined) definition.priority = priority
      if (strategy !== undefined) definition.strategy = strategy
      if (workerNodeKeys !== undefined) {
        definition.workerNodeKeys = Array.isArray(workerNodeKeys)
          ? [...workerNodeKeys]
          : workerNodeKeys
      }
    }
    checkValidPriority(definition.priority)
    checkValidWorkerChoiceStrategy(definition.strategy)
    checkValidWorkerNodeKeys(
      definition.workerNodeKeys,
      this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
    )
    const message = {
      taskFunction: taskFunction.toString(),
      taskFunctionOperation: 'add',
      taskFunctionProperties: buildTaskFunctionProperties(name, definition),
    } satisfies MessageValue<Data>
    return await this.queueTaskFunctionOperation(async () => {
      while (this.workerTaskFunctionBootstraps.size > 0) {
        await this.waitForWorkerTaskFunctionBootstraps()
      }
      this.beginTaskFunctionOperation()
      try {
        const opResult = await this.sendTaskFunctionOperationToWorkers(message)
        this.taskFunctions.set(name, message)
        this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
          this.getWorkerChoiceStrategies(),
        )
        for (const workerNodeKey of this.workerNodes.keys()) {
          this.sendStatisticsMessageToWorker(workerNodeKey)
        }
        return opResult
      } finally {
        this.endTaskFunctionOperation()
      }
    })
  }

  /** @inheritDoc */
  public async removeTaskFunction(name: string): Promise<boolean> {
    return await this.queueTaskFunctionOperation(async () => {
      if (!this.taskFunctions.has(name)) {
        throw new Error(
          'Cannot remove a task function not handled on the pool side',
        )
      }
      while (this.workerTaskFunctionBootstraps.size > 0) {
        await this.waitForWorkerTaskFunctionBootstraps()
      }
      this.beginTaskFunctionOperation()
      try {
        const opResult = await this.sendTaskFunctionOperationToWorkers({
          taskFunctionOperation: 'remove',
          taskFunctionProperties: this.taskFunctions.get(name)
            ?.taskFunctionProperties ?? { name },
        })
        for (const workerNode of this.workerNodes) {
          workerNode.deleteTaskFunctionWorkerUsage(name)
        }
        this.taskFunctions.delete(name)
        if (this.defaultTaskFunctionName === name) {
          this.defaultTaskFunctionName = undefined
        }
        this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
          this.getWorkerChoiceStrategies(),
        )
        for (const workerNodeKey of this.workerNodes.keys()) {
          this.sendStatisticsMessageToWorker(workerNodeKey)
        }
        return opResult
      } finally {
        this.endTaskFunctionOperation()
      }
    })
  }

  /** @inheritDoc */
  public listTaskFunctionsProperties(): TaskFunctionProperties[] {
    let fallback: TaskFunctionProperties[] | undefined
    for (const workerNode of this.workerNodes) {
      const properties = workerNode.info.taskFunctionsProperties
      if (Array.isArray(properties) && properties.length > 0) {
        if (workerNode.info.ready) return properties
        fallback ??= properties
      }
    }
    return fallback ?? []
  }

  private readonly getAbortError = (
    taskName: string,
    taskId: undefined | UUID,
    abortSignal?: AbortSignal,
  ): Error => {
    const abortError = abortSignal?.reason as Error | string
    return abortError instanceof Error
      ? abortError
      : typeof abortError === 'string'
      ? new Error(abortError)
      : new Error(
        `Task '${taskName}' id '${taskId ?? crypto.randomUUID()}' aborted`,
      )
  }

  private getQueuedTasks(): number {
    return this.workerNodes.reduce((accumulator, workerNode) => {
      return accumulator + workerNode.usage.tasks.queued
    }, 0)
  }

  private getStealingWorkerNodes(): number {
    return this.workerNodes.reduce(
      (accumulator, _, workerNodeKey) =>
        this.isWorkerNodeStealing(workerNodeKey)
          ? accumulator + 1
          : accumulator,
      0,
    )
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
   * Gets task function worker node keys affinity array, if any.
   * @param name - The task function name.
   * @param taskFunctionsProperties - The task function properties used to resolve affinity.
   * @returns The task function worker node keys affinity array, or `undefined` if not defined.
   */
  private readonly getTaskFunctionWorkerNodeKeys = (
    name?: string,
    taskFunctionsProperties: readonly TaskFunctionProperties[] = this
      .listTaskFunctionsProperties(),
  ): readonly number[] | undefined => {
    name = name ?? DEFAULT_TASK_NAME
    if (name === DEFAULT_TASK_NAME) {
      name = taskFunctionsProperties[1]?.name
    }
    for (let i = 0; i < taskFunctionsProperties.length; i++) {
      const taskFunctionProperties = taskFunctionsProperties[i]
      if (taskFunctionProperties.name === name) {
        return taskFunctionProperties.workerNodeKeys
      }
    }
    return undefined
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
  private readonly getWorkerChoiceStrategies = (
    taskFunctionsProperties: readonly TaskFunctionProperties[] = this
      .listTaskFunctionsProperties(),
  ): Set<WorkerChoiceStrategy> => {
    return new Set([
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.opts.workerChoiceStrategy!,
      ...taskFunctionsProperties
        .map(
          (taskFunctionProperties: TaskFunctionProperties) =>
            taskFunctionProperties.strategy,
        )
        .filter(
          (strategy: undefined | WorkerChoiceStrategy) => strategy != null,
        ),
    ])
  }

  /** @inheritDoc */
  public async setDefaultTaskFunction(name: string): Promise<boolean> {
    return await this.queueTaskFunctionOperation(async () => {
      while (this.workerTaskFunctionBootstraps.size > 0) {
        await this.waitForWorkerTaskFunctionBootstraps()
      }
      this.beginTaskFunctionOperation()
      try {
        const hadTargets = this.workerNodes.length > 0
        const opResult = await this.sendTaskFunctionOperationToWorkers({
          taskFunctionOperation: 'default',
          taskFunctionProperties: this.taskFunctions.get(name)
            ?.taskFunctionProperties ?? { name },
        })
        if (hadTargets) this.defaultTaskFunctionName = name
        return opResult
      } finally {
        this.endTaskFunctionOperation()
      }
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
    transferList?: readonly Transferable[],
  ): Promise<Response> {
    this.throwIfTaskAborted(name, abortSignal)
    const timestamp = performance.now()
    let chosenWorkerNodeKey = this.chooseWorkerNode(name)
    while (chosenWorkerNodeKey == null) {
      await this.waitForWorkerTaskFunctionBootstraps(abortSignal, name, 'first')
      this.throwIfTaskAborted(name, abortSignal)
      if (!this.started) {
        throw new Error('Cannot execute a task on not started pool')
      }
      if (this.destroying) {
        throw new Error('Cannot execute a task on destroying pool')
      }
      chosenWorkerNodeKey = this.chooseWorkerNode(name)
    }
    const workerNodeKey = chosenWorkerNodeKey
    return await new Promise<Response>((resolve, reject) => {
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
      const promiseResponse: PromiseResponseWrapper<Response> = {
        reject,
        resolve,
        workerNodeKey,
        abortSignal,
        ...(transferList != null && transferList.length > 0 && {
          originalData: task.data,
        }),
      }
      this.promiseResponseMap.set(task.taskId!, promiseResponse)
      abortSignal?.addEventListener(
        'abort',
        () => {
          const workerNodeKey = this.promiseResponseMap.get(task.taskId!)
            ?.workerNodeKey
          if (workerNodeKey != null) {
            const workerNode = this.workerNodes[workerNodeKey]
            workerNode?.dispatchEvent(
              new CustomEvent<WorkerNodeEventDetail>('abortTask', {
                detail: {
                  taskId: task.taskId,
                  workerId: workerNode.info.id,
                },
              }),
            )
          }
        },
        { once: true },
      )
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
    transferList = transferList != null && transferList.length > 0
      ? Array.from(transferList)
      : undefined
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
      if (!Array.isArray(abortSignals)) {
        abortSignals = [...abortSignals]
      }
      for (const abortSignal of abortSignals) {
        if (!(abortSignal instanceof AbortSignal)) {
          throw new TypeError(
            'abortSignals argument must be an iterable of AbortSignal',
          )
        }
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
    transferList = transferList != null && transferList.length > 0
      ? Array.from(transferList)
      : undefined
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
   * @param initWorkerNodeUsage - Whether to initialize the worker node usage or not.
   * @defaultValue false
   */
  private startMinimumNumberOfWorkers(initWorkerNodeUsage = false): void {
    if (this.minimumNumberOfWorkers === 0) {
      return
    }
    this.startingMinimumNumberOfWorkers = true
    try {
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
    } finally {
      this.startingMinimumNumberOfWorkers = false
    }
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
    try {
      this.startMinimumNumberOfWorkers()
      this.startTimestamp = performance.now()
    } finally {
      this.starting = false
    }
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
    try {
      await Promise.allSettled(
        this.workerNodes.map(async (_, workerNodeKey) => {
          try {
            await this.destroyWorkerNode(workerNodeKey)
          } catch (error) {
            this.eventTarget?.dispatchEvent(
              new ErrorEvent(PoolEvents.error, { error }),
            )
          }
        }),
      )
    } finally {
      delete this.startTimestamp
      this.destroying = false
      this.started = false
      if (this.eventTarget != null) {
        this.eventTarget.dispatchEvent(
          new CustomEvent<PoolInfo>(PoolEvents.destroy, { detail: this.info }),
        )
        this.readyEventEmitted = false
      }
    }
  }

  private async sendKillMessageToWorker(
    workerNodeKey: number,
    timeout = 1000,
  ): Promise<void> {
    const workerNode = this.workerNodes[workerNodeKey]
    const workerId = this.getWorkerInfo(workerNodeKey)?.id
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
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
          if (message.workerId !== workerId) {
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
      if (killMessageListener != null && workerNode != null) {
        this.createWorkerMessageListenerCleanup(
          workerNode,
          killMessageListener,
        )()
      }
    }
  }

  /**
   * Terminates the worker node given its worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected async destroyWorkerNode(workerNodeKey: number): Promise<void> {
    const workerNode = this.workerNodes[workerNodeKey]
    this.terminatingWorkerNodes.add(workerNode)
    this.flagWorkerNodeAsNotReady(workerNodeKey)
    const flushedTasks = this.flushTasksQueue(workerNodeKey)
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
    try {
      const currentWorkerNodeKey = this.workerNodes.indexOf(workerNode)
      if (currentWorkerNodeKey !== -1) {
        await this.sendKillMessageToWorker(currentWorkerNodeKey)
      }
    } finally {
      workerNode.terminate()
    }
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
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey),
      ) &&
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
   * Hook executed after task execution for a live worker node.
   * Can be overridden.
   *
   * @param workerNodeKey - The live worker node key.
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
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey),
      ) &&
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
   * @param workerInfo - The worker information.
   * @returns `true` if the worker node shall update its task function worker usage, `false` otherwise.
   */
  private shallUpdateTaskFunctionWorkerUsage(
    workerInfo: WorkerInfo | undefined,
  ): boolean {
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
  private chooseWorkerNode(name?: string): number | undefined {
    const workerNodeKeys = this.getTaskFunctionWorkerNodeKeys(name)
    if (workerNodeKeys != null) {
      const maxPoolSize = this.maximumNumberOfWorkers ??
        this.minimumNumberOfWorkers
      const targetSize = max(...workerNodeKeys) + 1
      while (
        this.started &&
        !this.destroying &&
        this.workerNodes.length < targetSize &&
        this.workerNodes.length < maxPoolSize
      ) {
        this.createAndSetupDynamicWorkerNode()
      }
    } else if (this.shallCreateDynamicWorker()) {
      const workerNodeKey = this.createAndSetupDynamicWorkerNode()
      if (
        this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerUsage ===
          true &&
        !this.workerTaskFunctionBootstraps.has(this.workerNodes[workerNodeKey])
      ) {
        return workerNodeKey
      }
    }
    const eligibleWorkerNodeKeys = workerNodeKeys != null
      ? new Set(workerNodeKeys)
      : undefined
    if (this.workerTaskFunctionBootstraps.size > 0) {
      let readyWorkerFound = false
      for (
        let workerNodeKey = 0;
        workerNodeKey < this.workerNodes.length;
        ++workerNodeKey
      ) {
        if (
          this.workerNodes[workerNodeKey].info.ready &&
          (eligibleWorkerNodeKeys == null ||
            eligibleWorkerNodeKeys.has(workerNodeKey))
        ) {
          readyWorkerFound = true
          break
        }
      }
      if (!readyWorkerFound) return
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return this.workerChoiceStrategiesContext!.execute(
      this.getTaskFunctionWorkerChoiceStrategy(name),
      eligibleWorkerNodeKeys,
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
    const taskStatisticsRequirements = this.workerChoiceStrategiesContext
      ?.getTaskStatisticsRequirements()
    if (taskStatisticsRequirements?.runTime.aggregate === true) {
      workerNode.usage.runTime.aggregate = min(
        ...this.workerNodes.map(
          (workerNode) =>
            workerNode.usage.runTime.aggregate ?? Number.POSITIVE_INFINITY,
        ),
      )
    }
    if (taskStatisticsRequirements?.waitTime.aggregate === true) {
      workerNode.usage.waitTime.aggregate = min(
        ...this.workerNodes.map(
          (workerNode) =>
            workerNode.usage.waitTime.aggregate ?? Number.POSITIVE_INFINITY,
        ),
      )
    }
    if (taskStatisticsRequirements?.elu.aggregate === true) {
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
    let workerError: Error | undefined
    let taskResponses: MessageValue<Response>[] | undefined
    workerNode.worker.onmessage = this.opts.messageEventHandler ??
      EMPTY_FUNCTION
    workerNode.worker.onmessageerror = (messageEvent) => {
      this.eventTarget?.dispatchEvent(
        new ErrorEvent(PoolEvents.messageerror, { error: messageEvent }),
      )
    }
    workerNode.worker.onerror = (errorEvent) => {
      const rawWorkerError: unknown = errorEvent.error
      workerError = rawWorkerError instanceof Error
        ? rawWorkerError
        : new Error(
          typeof rawWorkerError === 'string'
            ? rawWorkerError
            : errorEvent.message || 'Worker failed with a non-Error value',
          { cause: rawWorkerError },
        )
      taskResponses = this.captureTaskResponses(
        workerNode,
        receiveMessageOnPort != null ? taskResponses ??= [] : taskResponses,
      )
      workerNode.info.ready = false
      try {
        this.eventTarget?.dispatchEvent(
          new ErrorEvent(PoolEvents.error, { error: workerError }),
        )
        if (this.started && !this.destroying) {
          if (this.opts.restartWorkerOnError === true) {
            if (workerNode.info.dynamic) {
              this.createAndSetupDynamicWorkerNode()
            } else if (!this.startingMinimumNumberOfWorkers) {
              this.startMinimumNumberOfWorkers(true)
            }
          }
        }
      } finally {
        workerNode.terminate()
      }
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
        const taskDequeuingEventsDeferred = this.taskDequeuingEventsDeferred
        try {
          const settlingTasks = workerError != null ||
            !this.terminatingWorkerNodes.has(workerNode)
          workerNode.info.ready = false
          const lifecycleCleanups = this.workerLifecycleMessageListenerCleanups
            .get(workerNode)
          if (lifecycleCleanups != null) {
            this.workerLifecycleMessageListenerCleanups.delete(workerNode)
            for (const cleanup of lifecycleCleanups) cleanup()
          }
          // Native Web exit dispatch is synchronous and closes the port afterwards.
          // Preserve dedicated cleanup ACKs even during intentional retirement.
          taskResponses = this.captureTaskResponses(
            workerNode,
            receiveMessageOnPort != null ? taskResponses ??= [] : taskResponses,
          )
          const operationExitListeners = this
            .workerTaskFunctionOperationExitListeners.get(workerNode)
          if (operationExitListeners != null) {
            this.workerTaskFunctionOperationExitListeners.delete(workerNode)
            // Settle in dispatch order before removal or fallible replacement setup.
            for (const listener of operationExitListeners) listener()
          }
          let workerNodeTasks:
            | Map<UUID, PromiseResponseWrapper<Response>>
            | undefined
          if (settlingTasks) {
            const workerNodeKey = this.workerNodes.indexOf(workerNode)
            for (const [taskId, promiseResponse] of this.promiseResponseMap) {
              if (promiseResponse.workerNodeKey === workerNodeKey) {
                ;(workerNodeTasks ??= new Map()).set(taskId, promiseResponse)
              }
            }
            this.taskDequeuingEventsDeferred = true
          }
          this.removeWorkerNode(workerNode)
          try {
            if (
              this.started &&
              !this.startingMinimumNumberOfWorkers &&
              !this.destroying
            ) {
              this.startMinimumNumberOfWorkers(true)
            }
          } finally {
            try {
              if (settlingTasks) {
                this.redistributeQueuedTasks(workerNode)
              }
            } finally {
              if (settlingTasks) {
                workerNode.clearTasksQueue()
                this.taskDequeuingEventsDeferred = taskDequeuingEventsDeferred
                this.checkAndEmitTaskDequeuingEvents()
              }
              if (settlingTasks && taskResponses != null) {
                for (const message of taskResponses) {
                  this.handleTaskExecutionResponse(message)
                }
              }
              if (workerNodeTasks != null) {
                this.rejectWorkerNodeTasks(workerNodeTasks, workerError)
              }
              this.checkAndEmitTaskExecutionFinishedEvents()
            }
          }
        } finally {
          this.taskDequeuingEventsDeferred = taskDequeuingEventsDeferred
        }
      },
      { once: true },
    )
    const workerNodeKey = this.addWorkerNode(workerNode)
    if (
      this.pendingTaskFunctionOperations > 0 ||
      this.taskFunctions.size > 0 ||
      this.defaultTaskFunctionName != null
    ) {
      const bootstrap: { promise?: Promise<void>; ready: boolean } = {
        ready: false,
      }
      workerNode.info.ready = false
      this.workerTaskFunctionBootstraps.set(workerNode, bootstrap)
      bootstrap.promise = this.replayTaskFunctionsAfterOperations(
        workerNode,
        bootstrap,
      )
      bootstrap.promise.catch((error: unknown) => {
        this.eventTarget?.dispatchEvent(
          new ErrorEvent(PoolEvents.error, { error }),
        )
      })
    }
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
    this.registerWorkerLifecycleMessageListener(workerNodeKey, (message) => {
      if (
        this.destroying ||
        message.kill === 'success' ||
        message.kill === 'failure' ||
        message.taskFunctionOperationStatus != null
      ) {
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
    const workerNode = this.workerNodes[workerNodeKey]
    workerNode.info.dynamic = true
    if (
      this.workerChoiceStrategiesContext?.getPolicy().dynamicWorkerReady ===
        true &&
      !this.workerTaskFunctionBootstraps.has(workerNode)
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
   * Deregisters a listener callback on a worker node.
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
   * Deregisters a listener using its original worker node.
   *
   * @param workerNode - The original worker node.
   * @param listener - The message listener callback.
   */
  protected deregisterWorkerNodeMessageListener<
    Message extends Data | Response,
  >(
    workerNode: IWorkerNode<Worker, Data>,
    listener: (message: MessageValue<Message>) => void,
  ): void {
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey >= 0) {
      this.deregisterWorkerMessageListener(workerNodeKey, listener)
    }
  }

  /**
   * Method hooked up after a worker node has been newly created.
   * Can be overridden.
   *
   * @param workerNodeKey - The newly created worker node key.
   */
  protected afterWorkerNodeSetup(workerNodeKey: number): void {
    // Listen to worker messages.
    this.registerWorkerLifecycleMessageListener(
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
          this.workerNodeIdleEventListener as EventListener,
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
    const taskStatisticsRequirements = this.workerChoiceStrategiesContext
      ?.getTaskStatisticsRequirements()
    this.sendToWorker(workerNodeKey, {
      statistics: {
        runTime: taskStatisticsRequirements?.runTime.aggregate ?? false,
        // elu: taskStatisticsRequirements?.elu.aggregate ?? false,
      },
    })
  }

  private cannotStealTask(): boolean {
    return (
      !this.started ||
      this.destroying ||
      this.workerNodes.length <= 1 ||
      this.getQueuedTasks() === 0
    )
  }

  private handleTask(workerNodeKey: number, task: Task<Data>): void {
    if (this.shallExecuteTask(workerNodeKey)) {
      this.executeTask(workerNodeKey, task)
    } else {
      this.enqueueTask(workerNodeKey, task)
    }
  }

  private redistributeQueuedTasks(
    sourceWorkerNode: IWorkerNode<Worker, Data>,
  ): void {
    while (sourceWorkerNode.tasksQueue.size > 0) {
      const task = sourceWorkerNode.dequeueTask()!
      const { taskId } = task
      if (taskId == null) {
        continue
      }
      const promiseResponse = this.promiseResponseMap.get(taskId)
      if (promiseResponse == null) {
        continue
      }
      if (promiseResponse.abortSignal?.aborted === true) {
        this.rejectTask(
          taskId,
          promiseResponse,
          this.getAbortError(
            task.name ?? DEFAULT_TASK_NAME,
            taskId,
            promiseResponse.abortSignal,
          ),
        )
        continue
      }
      if (!this.started || this.destroying) {
        continue
      }
      const liveTaskFunctionsProperties = this.listTaskFunctionsProperties()
      const workerNodeKeys = this.getTaskFunctionWorkerNodeKeys(
        task.name,
        liveTaskFunctionsProperties.length > 0
          ? liveTaskFunctionsProperties
          : (sourceWorkerNode.info.taskFunctionsProperties ??
            liveTaskFunctionsProperties),
      )
      const candidateCount = workerNodeKeys?.length ?? this.workerNodes.length
      let destinationWorkerNodeKey = -1
      let minimumQueuedTasks = Number.POSITIVE_INFINITY
      for (let i = 0; i < candidateCount; i++) {
        const candidateWorkerNodeKey = workerNodeKeys == null
          ? i
          : workerNodeKeys[i]
        if (candidateWorkerNodeKey >= this.workerNodes.length) {
          continue
        }
        const candidateWorkerNode = this.workerNodes[candidateWorkerNodeKey]
        if (!candidateWorkerNode.info.ready) {
          continue
        }
        const queuedTasks = candidateWorkerNode.usage.tasks.queued
        if (
          queuedTasks < minimumQueuedTasks ||
          (queuedTasks === minimumQueuedTasks &&
            candidateWorkerNodeKey < destinationWorkerNodeKey)
        ) {
          destinationWorkerNodeKey = candidateWorkerNodeKey
          minimumQueuedTasks = queuedTasks
        }
      }
      if (destinationWorkerNodeKey === -1) {
        continue
      }
      if (this.opts.enableTasksQueue === true) {
        this.handleTask(destinationWorkerNodeKey, task)
      } else {
        this.executeTask(destinationWorkerNodeKey, task)
      }
    }
  }

  private rejectTask(
    taskId: UUID,
    promiseResponse: PromiseResponseWrapper<Response>,
    error: unknown,
  ): void {
    if (this.promiseResponseMap.get(taskId) !== promiseResponse) {
      return
    }
    this.promiseResponseMap.delete(taskId)
    promiseResponse.reject(error)
  }

  /**
   * Rejects tasks still owned by a worker that cannot complete them.
   * @param workerNodeTasks - The task wrappers owned by the failed worker node.
   * @param error - The worker failure.
   */
  private rejectWorkerNodeTasks(
    workerNodeTasks: Map<UUID, PromiseResponseWrapper<Response>>,
    error?: Error,
  ): void {
    for (const [taskId, promiseResponse] of workerNodeTasks) {
      if (
        this.promiseResponseMap.get(taskId) === promiseResponse &&
        promiseResponse.workerNodeKey === -1
      ) {
        error ??= new Error('Worker exited before completing the task')
        this.rejectTask(taskId, promiseResponse, error)
      }
    }
  }

  /**
   * Updates task ownership before dispatch or synchronous queue events.
   * @param workerNodeKey - The destination worker node key.
   * @param task - The task being moved.
   */
  private updateTaskWorkerNodeKey(
    workerNodeKey: number,
    task: Task<Data>,
  ): void {
    if (task.taskId != null) {
      const promiseResponse = this.promiseResponseMap.get(task.taskId)
      if (promiseResponse != null) {
        promiseResponse.workerNodeKey = workerNodeKey
      }
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
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey),
      ) &&
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
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey),
      ) &&
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
      this.shallUpdateTaskFunctionWorkerUsage(
        this.getWorkerInfo(workerNodeKey),
      ) &&
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
    const stolenTask = sourceWorkerNode.dequeueLastPrioritizedTask()
    if (stolenTask == null) {
      sourceWorkerNode.info.stolen = false
      destinationWorkerNode.info.stealing = false
      return
    }
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
      this.getStealingWorkerNodes() >
        Math.ceil(
          this.workerNodes.length *
            this.opts.tasksQueueOptions!.tasksStealingRatio!,
        )
    )
  }

  private readonly workerNodeIdleEventListener = (
    event: CustomEvent<WorkerNodeEventDetail>,
  ): void => {
    this.handleWorkerNodeIdleEvent(event.detail)
  }

  private readonly handleWorkerNodeIdleEvent = (
    eventDetail: WorkerNodeEventDetail,
    previousStolenTask?: Task<Data>,
  ): void => {
    const { workerNodeKey } = eventDetail
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
        // Worker nodes can be removed during the delay, shifting the keys.
        const currentWorkerNodeKey = this.workerNodes.indexOf(workerNode)
        if (currentWorkerNodeKey === -1) {
          return undefined
        }
        this.handleWorkerNodeIdleEvent(
          { ...eventDetail, workerNodeKey: currentWorkerNodeKey },
          stolenTask,
        )
        return undefined
      })
      .catch((error: unknown) => {
        this.eventTarget?.dispatchEvent(
          new ErrorEvent(PoolEvents.error, { error }),
        )
      })
  }

  private readonly workerNodeStealTask = (
    workerNodeKey: number,
  ): Task<Data> | undefined => {
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) return
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeB.usage.tasks.queued - workerNodeA.usage.tasks.queued,
      )
    const sourceWorkerNode = workerNodes.find(
      (sourceWorkerNode) =>
        sourceWorkerNode !== workerNode &&
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
    const sourceWorkerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const sourceWorkerNode = this.workerNodes[sourceWorkerNodeKey]
    if (sourceWorkerNode == null) {
      return
    }
    const workerNodes = this.workerNodes
      .slice()
      .sort(
        (workerNodeA, workerNodeB) =>
          workerNodeA.usage.tasks.queued - workerNodeB.usage.tasks.queued,
      )
    for (const workerNode of workerNodes) {
      if (sourceWorkerNode.usage.tasks.queued === 0) {
        break
      }
      if (
        workerNode !== sourceWorkerNode &&
        !workerNode.info.backPressureStealing &&
        workerNode.usage.tasks.queued <
          this.opts.tasksQueueOptions!.size! - sizeOffset
      ) {
        const workerNodeKey = this.workerNodes.indexOf(workerNode)
        workerNode.info.backPressureStealing = true
        this.stealTask(sourceWorkerNode, workerNodeKey)
        workerNode.info.backPressureStealing = false
      }
    }
  }

  private setTasksQueuePriority(workerNodeKey: number): void {
    this.workerNodes[workerNodeKey].setTasksQueuePriority(
      this.getTasksQueuePriority(
        this.workerNodes[workerNodeKey].info.taskFunctionsProperties,
      ),
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
    // Kill and task-function operation responses have dedicated listeners.
    if (kill != null || message.taskFunctionOperationStatus != null) {
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
    const { ready, taskFunctionsProperties, workerId } = message
    if (ready == null || !ready) {
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      throw new Error(`Worker ${workerId?.toString()} failed to initialize`)
    }
    const maxPoolSize = this.maximumNumberOfWorkers ??
      this.minimumNumberOfWorkers
    for (const taskFunctionProperties of taskFunctionsProperties ?? []) {
      checkValidWorkerNodeKeys(
        taskFunctionProperties.workerNodeKeys,
        maxPoolSize,
      )
    }
    const workerNodeKey = this.getWorkerNodeKeyByWorkerId(workerId)
    const workerNode = this.workerNodes[workerNodeKey]
    const bootstrap = this.workerTaskFunctionBootstraps.get(workerNode)
    if (bootstrap != null) bootstrap.ready = ready
    workerNode.info.ready = bootstrap == null
    workerNode.info.taskFunctionsProperties = taskFunctionsProperties
    this.sendStatisticsMessageToWorker(workerNodeKey)
    this.setTasksQueuePriority(workerNodeKey)
    this.checkAndEmitReadyEvent()
  }

  private handleTaskExecutionResponse(message: MessageValue<Response>): void {
    const { name, taskId, data } = message
    let { workerError } = message
    const promiseResponse = this.promiseResponseMap.get(taskId!)
    if (promiseResponse != null) {
      const { resolve, reject, workerNodeKey } = promiseResponse
      if (
        workerError != null && Object.hasOwn(promiseResponse, 'originalData')
      ) {
        workerError = { ...workerError, data: promiseResponse.originalData }
      }
      const workerNode = this.workerNodes[workerNodeKey]
      let error: Error | undefined
      if (workerError != null) {
        error = workerError.aborted
          ? this.getAbortError(
            workerError.name ?? name ?? DEFAULT_TASK_NAME,
            taskId!,
            promiseResponse.abortSignal,
          )
          : workerError.error
      }
      this.promiseResponseMap.delete(taskId!)
      if (workerError != null) {
        this.eventTarget?.dispatchEvent(
          new ErrorEvent(PoolEvents.taskError, { error: workerError }),
        )
        reject(error)
      } else {
        resolve(data!)
      }
      if (workerNode != null) {
        this.afterTaskExecutionHook(workerNodeKey, message)
      }
      queueMicrotask(() => {
        let currentWorkerNodeKey =
          this.workerNodes[workerNodeKey] === workerNode
            ? workerNodeKey
            : this.workerNodes.indexOf(workerNode)
        workerNode?.dispatchEvent(new Event('taskFinished'))
        this.checkAndEmitTaskExecutionFinishedEvents()
        if (currentWorkerNodeKey === -1 || !workerNode.info.ready) {
          return
        }
        if (
          this.started &&
          this.opts.enableTasksQueue === true &&
          !this.destroying
        ) {
          while (
            !this.isWorkerNodeBusy(currentWorkerNodeKey) &&
            this.tasksQueueSize(currentWorkerNodeKey) > 0
          ) {
            if (
              this.executeTask(
                currentWorkerNodeKey,
                this.dequeueTask(currentWorkerNodeKey)!,
              )
            ) {
              break
            }
            currentWorkerNodeKey = this.workerNodes.indexOf(workerNode)
            if (
              currentWorkerNodeKey === -1 ||
              !this.started ||
              this.destroying ||
              !workerNode.info.ready ||
              !this.opts.enableTasksQueue
            ) {
              return
            }
          }
          if (this.isWorkerNodeIdle(currentWorkerNodeKey)) {
            workerNode.dispatchEvent(
              new CustomEvent<WorkerNodeEventDetail>('idle', {
                detail: { workerNodeKey: currentWorkerNodeKey },
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
      !this.taskDequeuingEventsDeferred &&
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

  private getTasksQueuePriority(
    taskFunctionsProperties: readonly TaskFunctionProperties[] = this
      .listTaskFunctionsProperties(),
  ): boolean {
    return taskFunctionsProperties.some(
      (taskFunctionProperties) => taskFunctionProperties.priority != null,
    )
  }

  /**
   * Creates a worker node.
   *
   * @returns The created worker node.
   */
  private createWorkerNode(): IWorkerNode<Worker, Data> {
    const workerNode = new WorkerNode<Worker, Data>(
      this.worker,
      this.specifier,
      {
        workerOptions: Object.hasOwn(this.opts, 'workerOptions')
          ? this.opts.workerOptions
          : undefined,
        tasksQueueBackPressureSize: this.opts.tasksQueueOptions?.size ??
          getDefaultTasksQueueOptions(
            this.maximumNumberOfWorkers ?? this.minimumNumberOfWorkers,
          ).size,
        tasksQueueBucketSize: defaultBucketSize,
        tasksQueuePriority: this.getTasksQueuePriority(),
        tasksQueueAgingFactor: this.opts.tasksQueueOptions?.agingFactor,
        tasksQueueLoadExponent: this.opts.tasksQueueOptions?.loadExponent,
      },
    )
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
    if (taskId == null) {
      return
    }
    const promiseResponse = this.promiseResponseMap.get(taskId)
    if (promiseResponse == null) {
      return
    }
    const { abortSignal } = promiseResponse
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
          workerNode.info.queuedTaskAbortion = false

          this.rejectTask(
            taskId,
            promiseResponse,
            this.getAbortError(name ?? DEFAULT_TASK_NAME, taskId, abortSignal),
          )
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
   * @throws {Error} If the added worker node is not found.
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
    this.workerTaskFunctionBootstraps.delete(workerNode)
    const workerNodeKey = this.workerNodes.indexOf(workerNode)
    if (workerNodeKey !== -1) {
      this.workerNodes.splice(workerNodeKey, 1)
      for (const promiseResponse of this.promiseResponseMap.values()) {
        if (promiseResponse.workerNodeKey === workerNodeKey) {
          promiseResponse.workerNodeKey = -1
        } else if (promiseResponse.workerNodeKey > workerNodeKey) {
          --promiseResponse.workerNodeKey
        }
      }
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
    if (this.workerNodes.length === 0) return false
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
   * @returns Whether the worker accepted the task.
   */
  private executeTask(workerNodeKey: number, task: Task<Data>): boolean {
    this.updateTaskWorkerNodeKey(workerNodeKey, task)
    const workerNode = this.workerNodes[workerNodeKey]
    const { transferList } = task
    this.beforeTaskExecutionHook(workerNodeKey, task)
    try {
      this.sendToWorker(workerNodeKey, task, transferList)
    } catch (error) {
      if (workerNode.usage.tasks.executing > 0) {
        --workerNode.usage.tasks.executing
      }
      if (this.shallUpdateTaskFunctionWorkerUsage(workerNode.info)) {
        const taskFunctionWorkerUsage = workerNode.getTaskFunctionWorkerUsage(
          task.name!,
        )
        if (
          taskFunctionWorkerUsage != null &&
          taskFunctionWorkerUsage.tasks.executing > 0
        ) {
          --taskFunctionWorkerUsage.tasks.executing
        }
      }
      if (task.taskId != null) {
        const promiseResponse = this.promiseResponseMap.get(task.taskId)
        if (promiseResponse != null) {
          this.rejectTask(task.taskId, promiseResponse, error)
        }
      }
      return false
    }
    this.checkAndEmitTaskExecutionEvents()
    return true
  }

  private enqueueTask(workerNodeKey: number, task: Task<Data>): number {
    this.updateTaskWorkerNodeKey(workerNodeKey, task)
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
    const workerNode = this.workerNodes[workerNodeKey]
    if (workerNode == null) {
      return 0
    }
    return workerNode.tasksQueueSize()
  }

  protected flushTasksQueue(workerNodeKey: number): number {
    let flushedTasks = 0
    while (this.tasksQueueSize(workerNodeKey) > 0) {
      if (
        this.executeTask(
          workerNodeKey,
          this.dequeueTask(workerNodeKey) as Task<Data>,
        )
      ) {
        ++flushedTasks
      }
    }
    this.workerNodes[workerNodeKey].clearTasksQueue()
    return flushedTasks
  }

  private flushTasksQueues(): void {
    for (const workerNodeKey of this.workerNodes.keys()) {
      this.flushTasksQueue(workerNodeKey)
    }
  }

  private beginTaskFunctionOperation(): void {
    if (this.pendingTaskFunctionOperations++ === 0) {
      const { promise, resolve } = Promise.withResolvers<undefined>()
      this.taskFunctionOperationsFinished = promise
      this.resolveTaskFunctionOperations = resolve
    }
  }

  private endTaskFunctionOperation(): void {
    if (--this.pendingTaskFunctionOperations === 0) {
      const resolve = this.resolveTaskFunctionOperations
      delete this.taskFunctionOperationsFinished
      delete this.resolveTaskFunctionOperations
      resolve?.(undefined)
    }
  }

  private deregisterTaskFunctionOperationExitListener(
    workerNode: IWorkerNode<Worker, Data>,
    listener: () => void,
  ): void {
    const listeners = this.workerTaskFunctionOperationExitListeners.get(
      workerNode,
    )
    if (listeners != null) {
      listeners.delete(listener)
      if (listeners.size === 0) {
        this.workerTaskFunctionOperationExitListeners.delete(workerNode)
      }
    }
  }

  private registerTaskFunctionOperationExitListener(
    workerNode: IWorkerNode<Worker, Data>,
    listener: () => void,
  ): void {
    let listeners = this.workerTaskFunctionOperationExitListeners.get(
      workerNode,
    )
    if (listeners == null) {
      listeners = new Set()
      this.workerTaskFunctionOperationExitListeners.set(workerNode, listeners)
    }
    listeners.add(listener)
  }

  private async replayTaskFunctions(workerNodeKey: number): Promise<void> {
    if (this.taskFunctions.size === 0) return
    const workerNode = this.workerNodes[workerNodeKey]
    for (const message of this.taskFunctions.values()) {
      const currentWorkerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
      if (currentWorkerNodeKey === -1) return
      await this.sendTaskFunctionOperationToWorker(
        currentWorkerNodeKey,
        message,
      )
    }
  }

  private async replayTaskFunctionsAfterOperations(
    workerNode: IWorkerNode<Worker, Data>,
    bootstrap: { ready: boolean },
  ): Promise<void> {
    try {
      // Publish the bootstrap promise before sending replay requests.
      do {
        await this.taskFunctionOperationsFinished
      } while (this.taskFunctionOperationsFinished != null)
      let workerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
      if (workerNodeKey === -1) return
      await this.replayTaskFunctions(workerNodeKey)
      workerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
      if (workerNodeKey === -1) return
      if (this.defaultTaskFunctionName != null) {
        await this.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunctionOperation: 'default',
          taskFunctionProperties: this.taskFunctions.get(
            this.defaultTaskFunctionName,
          )?.taskFunctionProperties ?? { name: this.defaultTaskFunctionName },
        })
        workerNodeKey = this.getWorkerNodeKeyForBootstrap(workerNode)
        if (workerNodeKey === -1) return
      }
      // Keep strategies needed by ready peers while this worker becomes selectable.
      const workerChoiceStrategies = this.getWorkerChoiceStrategies(
        workerNode.info.taskFunctionsProperties ?? [],
      )
      for (const readyWorkerNode of this.workerNodes) {
        if (
          readyWorkerNode === workerNode ||
          !readyWorkerNode.info.ready ||
          this.terminatingWorkerNodes.has(readyWorkerNode)
        ) {
          continue
        }
        const taskFunctionsProperties =
          readyWorkerNode.info.taskFunctionsProperties
        if (taskFunctionsProperties != null) {
          for (const { strategy } of taskFunctionsProperties) {
            if (strategy != null) workerChoiceStrategies.add(strategy)
          }
        }
      }
      this.workerChoiceStrategiesContext?.syncWorkerChoiceStrategies(
        workerChoiceStrategies,
      )
      this.sendStatisticsMessageToWorker(workerNodeKey)
      workerNode.info.ready = bootstrap.ready
      this.checkAndEmitReadyEvent()
    } catch (error) {
      // Retired bootstraps no longer block waiting submissions.
      if (this.workerNodes.includes(workerNode)) throw error
    } finally {
      this.workerTaskFunctionBootstraps.delete(workerNode)
    }
  }

  private getWorkerNodeKeyForBootstrap(
    workerNode: IWorkerNode<Worker, Data>,
  ): number {
    if (this.destroying || this.terminatingWorkerNodes.has(workerNode)) {
      return -1
    }
    return this.workerNodes.indexOf(workerNode)
  }

  private async waitForWorkerTaskFunctionBootstraps(
    abortSignal?: AbortSignal,
    name?: string,
    waitMode: 'all' | 'first' = 'all',
  ): Promise<void> {
    let abortPromise: Promise<undefined> | undefined
    let abortListener: (() => void) | undefined
    if (abortSignal != null) {
      this.throwIfTaskAborted(name, abortSignal)
      const { promise, reject } = Promise.withResolvers<undefined>()
      abortPromise = promise
      abortListener = () => {
        reject(
          this.getAbortError(name ?? DEFAULT_TASK_NAME, undefined, abortSignal),
        )
      }
      abortSignal.addEventListener('abort', abortListener, { once: true })
    }
    try {
      while (this.workerTaskFunctionBootstraps.size > 0) {
        if (waitMode === 'first') {
          const promises: Promise<void>[] = []
          for (
            const [workerNode, bootstrap] of this
              .workerTaskFunctionBootstraps
          ) {
            if (bootstrap.promise != null) {
              promises.push(
                bootstrap.promise.catch((error: unknown) => {
                  const workerNodeKey = this.workerNodes.indexOf(workerNode)
                  if (workerNodeKey === -1) return
                  const taskFunctionsProperties = this
                    .listTaskFunctionsProperties()
                  const taskFunctionName =
                    name == null || name === DEFAULT_TASK_NAME
                      ? (this.defaultTaskFunctionName ??
                        taskFunctionsProperties[1]?.name)
                      : name
                  const registration = taskFunctionName != null
                    ? this.taskFunctions.get(taskFunctionName)
                    : undefined
                  const workerNodeKeys = registration != null
                    ? registration.taskFunctionProperties.workerNodeKeys
                    : this.getTaskFunctionWorkerNodeKeys(
                      taskFunctionName,
                      taskFunctionsProperties,
                    )
                  // Ineligible failures still wake selection without rejecting the task.
                  if (
                    workerNodeKeys == null ||
                    workerNodeKeys.includes(workerNodeKey)
                  ) {
                    throw error
                  }
                }),
              )
            }
          }
          if (promises.length === 0) return
          if (abortPromise != null) promises.push(abortPromise)
          await Promise.race(promises)
          return
        }
        for (const bootstrap of this.workerTaskFunctionBootstraps.values()) {
          if (bootstrap.promise != null) {
            if (abortPromise != null) {
              await Promise.race([bootstrap.promise, abortPromise])
            } else {
              await bootstrap.promise
            }
          }
        }
      }
    } finally {
      if (abortListener != null) {
        abortSignal?.removeEventListener('abort', abortListener)
      }
    }
  }

  private throwIfTaskAborted(name?: string, abortSignal?: AbortSignal): void {
    if (abortSignal?.aborted === true) {
      throw this.getAbortError(
        name ?? DEFAULT_TASK_NAME,
        undefined,
        abortSignal,
      )
    }
  }

  /**
   * Builds the error for a task function operation acknowledgement without a UUID.
   * @param workerId - The worker id that sent the acknowledgement.
   * @returns The task function operation acknowledgement error.
   */
  private readonly getTaskFunctionOperationAcknowledgementError = (
    workerId?: WorkerInfo['id'],
  ): Error =>
    new Error(
      `Task function operation acknowledgement from worker ${
        String(workerId)
      } is missing taskFunctionOperationId`,
    )

  private readonly workerLifecycleMessageListenerCleanups = new Map<
    IWorkerNode<Worker, Data>,
    Set<() => void>
  >()

  private registerWorkerLifecycleMessageListener(
    workerNodeKey: number,
    listener: (message: MessageValue<Response>) => void,
  ): void {
    const workerNode = this.workerNodes[workerNodeKey]
    const cleanup = this.createWorkerMessageListenerCleanup(
      workerNode,
      listener,
    )
    let cleanups = this.workerLifecycleMessageListenerCleanups.get(workerNode)
    if (cleanups == null) {
      cleanups = new Set()
      this.workerLifecycleMessageListenerCleanups.set(workerNode, cleanups)
    }
    cleanups.add(cleanup)
    this.registerWorkerMessageListener(workerNodeKey, listener)
  }

  private createWorkerMessageListenerCleanup(
    workerNode: IWorkerNode<Worker, Data>,
    listener: (message: MessageValue<Response>) => void,
  ): () => void {
    let cleaned = false
    return () => {
      if (cleaned) return
      cleaned = true
      try {
        const workerNodeKey = this.workerNodes.indexOf(workerNode)
        if (workerNodeKey !== -1) {
          this.deregisterWorkerMessageListener(workerNodeKey, listener)
        }
      } finally {
        this.deregisterWorkerNodeMessageListener(workerNode, listener)
      }
    }
  }

  private captureTaskResponses(
    workerNode: IWorkerNode<Worker, Data>,
    taskResponses: MessageValue<Response>[] | undefined,
  ): MessageValue<Response>[] | undefined {
    // Capture before termination closes the thread's private channel.
    while (receiveMessageOnPort != null && workerNode.messageChannel != null) {
      const response = receiveMessageOnPort(workerNode.messageChannel.port1)
      if (response == null) {
        break
      }
      const message = response.message as MessageValue<Response>
      if (message.taskId != null) {
        this.checkMessageWorkerId(message)
        ;(taskResponses ??= []).push(message)
      } else if (
        message.taskFunctionOperationStatus != null ||
        message.kill === 'success' || message.kill === 'failure'
      ) {
        workerNode.dispatchEvent(new MessageEvent('message', { data: message }))
      }
    }
    return taskResponses
  }
}
