import { CircularArray } from '../circular-array.ts'
import type { MessageValue, Task } from '../utility-types.ts'
import {
  DEFAULT_TASK_NAME,
  EMPTY_FUNCTION,
  exponentialDelay,
  getWorkerType,
  sleep,
} from '../utils.ts'
import { Deque } from '../deque.ts'
import {
  type IWorker,
  type IWorkerNode,
  type StrategyData,
  type WorkerInfo,
  WorkerNodeEventDetail,
  type WorkerType,
  type WorkerUsage,
} from './worker.ts'
import { checkWorkerNodeArguments } from './utils.ts'
import { randomUUID } from 'node:crypto'

/**
 * Worker node.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export class WorkerNode<Worker extends IWorker<Data>, Data = unknown>
  extends EventTarget
  implements IWorkerNode<Worker, Data> {
  /** @inheritdoc */
  public readonly worker: Worker
  /** @inheritdoc */
  public readonly info: WorkerInfo
  /** @inheritdoc */
  public usage: WorkerUsage
  /** @inheritdoc */
  public strategyData?: StrategyData
  /** @inheritdoc */
  public messageChannel?: MessageChannel
  /** @inheritdoc */
  public tasksQueueBackPressureSize: number
  private readonly tasksQueue: Deque<Task<Data>>
  private onBackPressureStarted: boolean
  private onEmptyQueueCount: number
  private readonly taskFunctionsUsage: Map<string, WorkerUsage>

  /**
   * Constructs a new worker node.
   *
   * @param worker - The worker.
   * @param tasksQueueBackPressureSize - The tasks queue back pressure size.
   */
  constructor(worker: Worker, tasksQueueBackPressureSize: number) {
    super()
    checkWorkerNodeArguments<Worker, Data>(worker, tasksQueueBackPressureSize)
    this.worker = worker
    this.info = this.initWorkerInfo(worker)
    this.usage = this.initWorkerUsage()
    this.messageChannel = new MessageChannel()
    this.messageChannel.port1.onmessage = (
      messageEvent: MessageEvent<MessageValue<Data>>,
    ) => {
      this.dispatchEvent(
        new CustomEvent<MessageValue<Data>>('message', {
          detail: messageEvent.data,
        }),
      )
    }
    this.messageChannel.port1.onmessageerror = (
      messageEvent: MessageEvent<MessageValue<Data>>,
    ) => {
      this.dispatchEvent(
        new CustomEvent<MessageValue<Data>>('messageerror', {
          detail: messageEvent.data,
        }),
      )
    }
    this.tasksQueueBackPressureSize = tasksQueueBackPressureSize
    this.tasksQueue = new Deque<Task<Data>>()
    this.onBackPressureStarted = false
    this.onEmptyQueueCount = 0
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
  }

  /** @inheritdoc */
  public tasksQueueSize(): number {
    return this.tasksQueue.size
  }

  /** @inheritdoc */
  public enqueueTask(task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.push(task)
    if (
      this.hasBackPressure() &&
      !this.onBackPressureStarted
    ) {
      this.onBackPressureStarted = true
      this.dispatchEvent(
        new CustomEvent<WorkerNodeEventDetail>('backpressure', {
          detail: { workerId: this.info.id as string },
        }),
      )
      this.onBackPressureStarted = false
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public unshiftTask(task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.unshift(task)
    if (
      this.hasBackPressure() &&
      !this.onBackPressureStarted
    ) {
      this.onBackPressureStarted = true
      this.dispatchEvent(
        new CustomEvent<WorkerNodeEventDetail>('backpressure', {
          detail: { workerId: this.info.id as string },
        }),
      )
      this.onBackPressureStarted = false
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public dequeueTask(): Task<Data> | undefined {
    const task = this.tasksQueue.shift()
    if (
      this.tasksQueue.size === 0 &&
      this.onEmptyQueueCount === 0
    ) {
      this.startOnEmptyQueue().catch(EMPTY_FUNCTION)
    }
    return task
  }

  /** @inheritdoc */
  public popTask(): Task<Data> | undefined {
    const task = this.tasksQueue.pop()
    if (
      this.tasksQueue.size === 0 &&
      this.onEmptyQueueCount === 0
    ) {
      this.startOnEmptyQueue().catch(EMPTY_FUNCTION)
    }
    return task
  }

  /** @inheritdoc */
  public clearTasksQueue(): void {
    this.tasksQueue.clear()
  }

  /** @inheritdoc */
  public hasBackPressure(): boolean {
    return this.tasksQueue.size >= this.tasksQueueBackPressureSize
  }

  /** @inheritdoc */
  public resetUsage(): void {
    this.usage = this.initWorkerUsage()
    this.taskFunctionsUsage.clear()
  }

  /** @inheritdoc */
  public terminate(): void {
    if (this.messageChannel != null) {
      this.messageChannel.port1.close()
      this.messageChannel.port2.close()
      delete this.messageChannel
    }
    this.worker.terminate()
    this.dispatchEvent(new Event('exit'))
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage(name: string): WorkerUsage | undefined {
    if (!Array.isArray(this.info.taskFunctionNames)) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function names list is not yet defined`,
      )
    }
    if (
      Array.isArray(this.info.taskFunctionNames) &&
      this.info.taskFunctionNames.length < 3
    ) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function names list has less than 3 elements`,
      )
    }
    if (name === DEFAULT_TASK_NAME) {
      name = this.info.taskFunctionNames[1]
    }
    if (!this.taskFunctionsUsage.has(name)) {
      this.taskFunctionsUsage.set(name, this.initTaskFunctionWorkerUsage(name))
    }
    return this.taskFunctionsUsage.get(name)
  }

  /** @inheritdoc */
  public deleteTaskFunctionWorkerUsage(name: string): boolean {
    return this.taskFunctionsUsage.delete(name)
  }

  private async startOnEmptyQueue(): Promise<void> {
    if (
      this.onEmptyQueueCount > 0 &&
      (this.usage.tasks.executing > 0 || this.tasksQueue.size > 0)
    ) {
      this.onEmptyQueueCount = 0
      return
    }
    ;++this.onEmptyQueueCount
    this.dispatchEvent(
      new CustomEvent<WorkerNodeEventDetail>('emptyqueue', {
        detail: { workerId: this.info.id as string },
      }),
    )
    await sleep(exponentialDelay(this.onEmptyQueueCount))
    await this.startOnEmptyQueue()
  }

  private initWorkerInfo(worker: Worker): WorkerInfo {
    return {
      id: randomUUID(),
      type: getWorkerType<Data>(worker) as WorkerType,
      dynamic: false,
      ready: false,
    }
  }

  private initWorkerUsage(): WorkerUsage {
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
        get queued(): number {
          return getTasksQueueSize()
        },
        get maxQueued(): number {
          return getTasksQueueMaxSize()
        },
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: new CircularArray<number>(),
      },
      waitTime: {
        history: new CircularArray<number>(),
      },
      elu: {
        idle: {
          history: new CircularArray<number>(),
        },
        active: {
          history: new CircularArray<number>(),
        },
      },
    }
  }

  private initTaskFunctionWorkerUsage(name: string): WorkerUsage {
    const getTaskFunctionQueueSize = (): number => {
      let taskFunctionQueueSize = 0
      for (const task of this.tasksQueue) {
        if (
          (task.name === DEFAULT_TASK_NAME &&
            name === (this.info.taskFunctionNames as string[])[1]) ||
          (task.name !== DEFAULT_TASK_NAME && name === task.name)
        ) {
          ;++taskFunctionQueueSize
        }
      }
      return taskFunctionQueueSize
    }
    return {
      tasks: {
        executed: 0,
        executing: 0,
        get queued(): number {
          return getTaskFunctionQueueSize()
        },
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: new CircularArray<number>(),
      },
      waitTime: {
        history: new CircularArray<number>(),
      },
      elu: {
        idle: {
          history: new CircularArray<number>(),
        },
        active: {
          history: new CircularArray<number>(),
        },
      },
    }
  }
}
