import { MessageChannel } from 'node:worker_threads'
import { CircularArray } from '../circular-array'
import type { Task } from '../utility-types'
import {
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  exponentialDelay,
  sleep
} from '../utils'
import { Deque } from '../deque'
import {
  type IWorker,
  type IWorkerNode,
  type WorkerInfo,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage
} from './worker'

type EmptyQueueCallback = (workerId: number) => void
type BackPressureCallback = EmptyQueueCallback

/**
 * Worker node.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export class WorkerNode<Worker extends IWorker, Data = unknown>
implements IWorkerNode<Worker, Data> {
  /** @inheritdoc */
  public readonly worker: Worker
  /** @inheritdoc */
  public readonly info: WorkerInfo
  /** @inheritdoc */
  public usage: WorkerUsage
  /** @inheritdoc */
  public messageChannel?: MessageChannel
  /** @inheritdoc */
  public tasksQueueBackPressureSize: number
  /** @inheritdoc */
  public onBackPressure?: BackPressureCallback
  /** @inheritdoc */
  public onEmptyQueue?: EmptyQueueCallback
  private readonly tasksQueue: Deque<Task<Data>>
  private onEmptyQueueCount: number
  private readonly taskFunctionsUsage: Map<string, WorkerUsage>

  /**
   * Constructs a new worker node.
   *
   * @param worker - The worker.
   * @param workerType - The worker type.
   * @param tasksQueueBackPressureSize - The tasks queue back pressure size.
   */
  constructor (
    worker: Worker,
    workerType: WorkerType,
    tasksQueueBackPressureSize: number
  ) {
    if (worker == null) {
      throw new TypeError('Cannot construct a worker node without a worker')
    }
    if (workerType == null) {
      throw new TypeError(
        'Cannot construct a worker node without a worker type'
      )
    }
    if (tasksQueueBackPressureSize == null) {
      throw new TypeError(
        'Cannot construct a worker node without a tasks queue back pressure size'
      )
    }
    if (!Number.isSafeInteger(tasksQueueBackPressureSize)) {
      throw new TypeError(
        'Cannot construct a worker node with a tasks queue back pressure size that is not an integer'
      )
    }
    this.worker = worker
    this.info = this.initWorkerInfo(worker, workerType)
    this.usage = this.initWorkerUsage()
    if (workerType === WorkerTypes.thread) {
      this.messageChannel = new MessageChannel()
    }
    this.tasksQueueBackPressureSize = tasksQueueBackPressureSize
    this.tasksQueue = new Deque<Task<Data>>()
    this.onEmptyQueueCount = 0
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
  }

  /** @inheritdoc */
  public tasksQueueSize (): number {
    return this.tasksQueue.size
  }

  /** @inheritdoc */
  public enqueueTask (task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.push(task)
    if (this.onBackPressure != null && this.hasBackPressure()) {
      this.onBackPressure(this.info.id as number)
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public unshiftTask (task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.unshift(task)
    if (this.onBackPressure != null && this.hasBackPressure()) {
      this.onBackPressure(this.info.id as number)
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public dequeueTask (): Task<Data> | undefined {
    const task = this.tasksQueue.shift()
    if (this.onEmptyQueue != null && this.tasksQueue.size === 0) {
      this.startOnEmptyQueue().catch(EMPTY_FUNCTION)
    }
    return task
  }

  /** @inheritdoc */
  public popTask (): Task<Data> | undefined {
    const task = this.tasksQueue.pop()
    if (this.onEmptyQueue != null && this.tasksQueue.size === 0) {
      this.startOnEmptyQueue().catch(EMPTY_FUNCTION)
    }
    return task
  }

  /** @inheritdoc */
  public clearTasksQueue (): void {
    this.tasksQueue.clear()
  }

  /** @inheritdoc */
  public hasBackPressure (): boolean {
    return this.tasksQueue.size >= this.tasksQueueBackPressureSize
  }

  /** @inheritdoc */
  public resetUsage (): void {
    this.usage = this.initWorkerUsage()
    this.taskFunctionsUsage.clear()
  }

  /** @inheritdoc */
  public closeChannel (): void {
    if (this.messageChannel != null) {
      this.messageChannel?.port1.unref()
      this.messageChannel?.port2.unref()
      this.messageChannel?.port1.close()
      this.messageChannel?.port2.close()
      delete this.messageChannel
    }
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage (name: string): WorkerUsage | undefined {
    if (!Array.isArray(this.info.taskFunctions)) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function names list is not yet defined`
      )
    }
    if (
      Array.isArray(this.info.taskFunctions) &&
      this.info.taskFunctions.length < 3
    ) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function names list has less than 3 elements`
      )
    }
    if (name === DEFAULT_TASK_NAME) {
      name = this.info.taskFunctions[1]
    }
    if (!this.taskFunctionsUsage.has(name)) {
      this.taskFunctionsUsage.set(name, this.initTaskFunctionWorkerUsage(name))
    }
    return this.taskFunctionsUsage.get(name)
  }

  private async startOnEmptyQueue (): Promise<void> {
    if (
      this.onEmptyQueueCount > 0 &&
      (this.usage.tasks.executing > 0 || this.tasksQueue.size > 0)
    ) {
      this.onEmptyQueueCount = 0
      return
    }
    (this.onEmptyQueue as EmptyQueueCallback)(this.info.id as number)
    ++this.onEmptyQueueCount
    await sleep(exponentialDelay(this.onEmptyQueueCount))
    await this.startOnEmptyQueue()
  }

  private initWorkerInfo (worker: Worker, workerType: WorkerType): WorkerInfo {
    return {
      id: this.getWorkerId(worker, workerType),
      type: workerType,
      dynamic: false,
      ready: false
    }
  }

  private initWorkerUsage (): WorkerUsage {
    const getTasksQueueSize = (): number => {
      return this.tasksQueue.size
    }
    const getTasksQueueMaxSize = (): number => {
      return this.tasksQueue.maxSize
    }
    return {
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTasksQueueSize()
        },
        get maxQueued (): number {
          return getTasksQueueMaxSize()
        },
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    }
  }

  private initTaskFunctionWorkerUsage (name: string): WorkerUsage {
    const getTaskFunctionQueueSize = (): number => {
      let taskFunctionQueueSize = 0
      for (const task of this.tasksQueue) {
        if (
          (task.name === DEFAULT_TASK_NAME &&
            name === (this.info.taskFunctions as string[])[1]) ||
          (task.name !== DEFAULT_TASK_NAME && name === task.name)
        ) {
          ++taskFunctionQueueSize
        }
      }
      return taskFunctionQueueSize
    }
    return {
      tasks: {
        executed: 0,
        executing: 0,
        get queued (): number {
          return getTaskFunctionQueueSize()
        },
        stolen: 0,
        failed: 0
      },
      runTime: {
        history: new CircularArray()
      },
      waitTime: {
        history: new CircularArray()
      },
      elu: {
        idle: {
          history: new CircularArray()
        },
        active: {
          history: new CircularArray()
        }
      }
    }
  }

  /**
   * Gets the worker id.
   *
   * @param worker - The worker.
   * @param workerType - The worker type.
   * @returns The worker id.
   */
  private getWorkerId (
    worker: Worker,
    workerType: WorkerType
  ): number | undefined {
    if (workerType === WorkerTypes.thread) {
      return worker.threadId
    } else if (workerType === WorkerTypes.cluster) {
      return worker.id
    }
  }
}
