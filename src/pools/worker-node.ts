import { CircularBuffer } from '../circular-buffer.ts'
import { PriorityQueue } from '../queues/priority-queue.ts'
import type { MessageValue, Task } from '../utility-types.ts'
import { DEFAULT_TASK_NAME } from '../utils.ts'
import {
  checkWorkerNodeArguments,
  createWorker,
  getWorkerId,
  getWorkerType,
} from './utils.ts'
import {
  type IWorker,
  type IWorkerNode,
  MeasurementHistorySize,
  type StrategyData,
  type WorkerInfo,
  type WorkerNodeEventDetail,
  type WorkerNodeOptions,
  type WorkerType,
  type WorkerUsage,
} from './worker.ts'

/**
 * Worker node.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 */
export class WorkerNode<Worker extends IWorker, Data = unknown>
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
  private readonly tasksQueue: PriorityQueue<Task<Data>>
  private setBackPressureFlag: boolean
  private readonly taskFunctionsUsage: Map<string, WorkerUsage>

  /**
   * Constructs a new worker node.
   *
   * @param type - The worker type.
   * @param fileURL - URL to the worker file.
   * @param opts - The worker node options.
   */
  constructor(type: WorkerType, fileURL: URL, opts: WorkerNodeOptions) {
    super()
    checkWorkerNodeArguments(type, fileURL, opts)
    this.worker = createWorker<Worker>(type, fileURL, {
      workerOptions: opts.workerOptions,
    })
    this.info = this.initWorkerInfo(this.worker)
    this.usage = this.initWorkerUsage()
    this.messageChannel = new MessageChannel()
    this.messageChannel.port1.onmessage = (
      messageEvent: MessageEvent<MessageValue<Data>>,
    ) => {
      this.dispatchEvent(
        new MessageEvent<MessageValue<Data>>('message', {
          data: messageEvent.data,
        }),
      )
    }
    this.messageChannel.port1.onmessageerror = (
      messageEvent: MessageEvent<MessageValue<Data>>,
    ) => {
      this.dispatchEvent(
        new MessageEvent<MessageValue<Data>>('messageerror', {
          data: messageEvent.data,
        }),
      )
    }
    this.tasksQueueBackPressureSize = opts.tasksQueueBackPressureSize!
    this.tasksQueue = new PriorityQueue<Task<Data>>(
      opts.tasksQueueBucketSize,
      opts.tasksQueuePriority,
    )
    this.setBackPressureFlag = false
    this.taskFunctionsUsage = new Map<string, WorkerUsage>()
  }

  /** @inheritdoc */
  public setTasksQueuePriority(enablePriority: boolean): void {
    this.tasksQueue.enablePriority = enablePriority
  }

  /** @inheritdoc */
  public tasksQueueSize(): number {
    return this.tasksQueue.size
  }

  /** @inheritdoc */
  public enqueueTask(task: Task<Data>): number {
    const tasksQueueSize = this.tasksQueue.enqueue(task, task.priority)
    if (
      !this.setBackPressureFlag &&
      this.hasBackPressure() &&
      !this.info.backPressure
    ) {
      this.setBackPressureFlag = true
      this.info.backPressure = true
      this.dispatchEvent(
        new CustomEvent<WorkerNodeEventDetail>('backPressure', {
          detail: { workerId: this.info.id },
        }),
      )
      this.setBackPressureFlag = false
    }
    return tasksQueueSize
  }

  /** @inheritdoc */
  public dequeueTask(bucket?: number): Task<Data> | undefined {
    const task = this.tasksQueue.dequeue(bucket)
    if (
      !this.setBackPressureFlag &&
      !this.hasBackPressure() &&
      this.info.backPressure
    ) {
      this.setBackPressureFlag = true
      this.info.backPressure = false
      this.setBackPressureFlag = false
    }
    return task
  }

  /** @inheritdoc */
  public dequeueLastPrioritizedTask(): Task<Data> | undefined {
    // Start from the last empty or partially filled bucket
    return this.dequeueTask(this.tasksQueue.buckets + 1)
  }

  /** @inheritdoc */
  public clearTasksQueue(): void {
    this.tasksQueue.clear()
  }

  /**
   * Whether the worker node has back pressure (i.e. its tasks queue is full).
   *
   * @returns `true` if the worker node has back pressure, `false` otherwise.
   */
  private hasBackPressure(): boolean {
    return this.tasksQueue.size >= this.tasksQueueBackPressureSize
  }

  /** @inheritdoc */
  public terminate(): void {
    this.closeMessageChannel()
    this.worker.terminate()
    this.dispatchEvent(new Event('exit'))
  }

  /** @inheritdoc */
  public getTaskFunctionWorkerUsage(name: string): WorkerUsage | undefined {
    if (!Array.isArray(this.info.taskFunctionsProperties)) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function properties list is not yet defined`,
      )
    }
    if (
      Array.isArray(this.info.taskFunctionsProperties) &&
      this.info.taskFunctionsProperties.length < 3
    ) {
      throw new Error(
        `Cannot get task function worker usage for task function name '${name}' when task function properties list has less than 3 elements`,
      )
    }
    if (name === DEFAULT_TASK_NAME) {
      name = this.info.taskFunctionsProperties[1].name
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

  private closeMessageChannel(): void {
    if (this.messageChannel != null) {
      this.messageChannel.port1.close()
      this.messageChannel.port2.close()
      delete this.messageChannel
    }
  }

  private initWorkerInfo(worker: Worker): WorkerInfo {
    return {
      id: getWorkerId(worker),
      type: getWorkerType(worker)!,
      dynamic: false,
      ready: false,
      stealing: false,
      stolen: false,
      continuousStealing: false,
      backPressureStealing: false,
      backPressure: false,
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
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      waitTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      elu: {
        idle: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
        active: {
          history: new CircularBuffer(MeasurementHistorySize),
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
            name === this.info.taskFunctionsProperties![1].name) ||
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
        get queued(): number {
          return getTaskFunctionQueueSize()
        },
        sequentiallyStolen: 0,
        stolen: 0,
        failed: 0,
      },
      runTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      waitTime: {
        history: new CircularBuffer(MeasurementHistorySize),
      },
      elu: {
        idle: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
        active: {
          history: new CircularBuffer(MeasurementHistorySize),
        },
      },
    }
  }
}
