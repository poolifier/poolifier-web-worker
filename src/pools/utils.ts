import type { MessageValue, Task } from '../utility-types.ts'
import {
  average,
  environment,
  isPlainObject,
  JSRuntime,
  max,
  median,
  min,
  runtime,
} from '../utils.ts'
import type { TasksQueueOptions } from './pool.ts'
import {
  type MeasurementStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
} from './selection-strategies/selection-strategies-types.ts'
import type { WorkerChoiceStrategiesContext } from './selection-strategies/worker-choice-strategies-context.ts'
import {
  type IWorker,
  type IWorkerNode,
  type MeasurementStatistics,
  type WorkerInfo,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage,
} from './worker.ts'

let exportedUpdateMeasurementStatistics: (
  measurementStatistics: MeasurementStatistics,
  measurementRequirements: MeasurementStatisticsRequirements | undefined,
  measurementValue: number | undefined,
) => void
export { exportedUpdateMeasurementStatistics }

/**
 * Default measurement statistics requirements.
 */
export const DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS: Readonly<
  MeasurementStatisticsRequirements
> = Object.freeze({
  aggregate: false,
  average: false,
  median: false,
})

export const getDefaultTasksQueueOptions = (
  poolMaxSize: number,
): Required<Readonly<TasksQueueOptions>> => {
  return Object.freeze({
    size: poolMaxSize ** 2,
    concurrency: 1,
    taskStealing: true,
    tasksStealingOnBackPressure: true,
    tasksStealingRatio: 0.6,
    tasksFinishedTimeout: 2000,
  })
}

export const checkSpecifier = (specifier: URL | string | undefined): void => {
  if (specifier == null) {
    throw new TypeError('The worker specifier must be defined')
  }
  if (typeof specifier !== 'string' && !(specifier instanceof URL)) {
    throw new TypeError(
      'The worker specifier must be a string or an instance of URL',
    )
  }
}

export const checkDynamicPoolSize = (
  min: number,
  max: number | undefined,
): void => {
  if (max == null) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool without specifying the maximum pool size',
    )
  }
  if (!Number.isSafeInteger(max)) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool with a non safe integer maximum pool size',
    )
  }
  if (min > max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size',
    )
  }
  if (max === 0) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size equal to zero',
    )
  }
  if (min === max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead',
    )
  }
}

export const checkValidPriority = (priority: number | undefined): void => {
  if (priority != null && !Number.isSafeInteger(priority)) {
    throw new TypeError(`Invalid property 'priority': '${priority.toString()}'`)
  }
  if (
    priority != null &&
    Number.isSafeInteger(priority) &&
    (priority < -20 || priority > 19)
  ) {
    throw new RangeError("Property 'priority' must be between -20 and 19")
  }
}

export const checkValidWorkerChoiceStrategy = (
  workerChoiceStrategy: WorkerChoiceStrategy | undefined,
): void => {
  if (
    workerChoiceStrategy != null &&
    !Object.values(WorkerChoiceStrategies).includes(workerChoiceStrategy)
  ) {
    throw new Error(`Invalid worker choice strategy '${workerChoiceStrategy}'`)
  }
}

export const checkValidWorkerNodeKeys = (
  workerNodeKeys: null | number[] | undefined,
  maxPoolSize?: number,
): void => {
  if (workerNodeKeys != null && !Array.isArray(workerNodeKeys)) {
    throw new TypeError('Invalid worker node keys: must be an array')
  }
  if (workerNodeKeys?.length === 0) {
    throw new RangeError('Invalid worker node keys: must not be an empty array')
  }
  if (workerNodeKeys != null) {
    for (const workerNodeKey of workerNodeKeys) {
      if (!Number.isSafeInteger(workerNodeKey) || workerNodeKey < 0) {
        throw new TypeError(
          `Invalid worker node key '${workerNodeKey.toString()}': must be a non-negative safe integer`,
        )
      }
    }
  }
  if (
    workerNodeKeys != null &&
    new Set(workerNodeKeys).size !== workerNodeKeys.length
  ) {
    throw new TypeError('Invalid worker node keys: must not contain duplicates')
  }
  if (maxPoolSize != null && workerNodeKeys != null) {
    if (workerNodeKeys.length > maxPoolSize) {
      throw new RangeError(
        'Cannot add a task function with more worker node keys than the maximum number of workers in the pool',
      )
    }
    const invalidWorkerNodeKeys = workerNodeKeys.filter(
      (workerNodeKey) => workerNodeKey >= maxPoolSize,
    )
    if (invalidWorkerNodeKeys.length > 0) {
      throw new RangeError(
        `Cannot add a task function with invalid worker node keys: ${invalidWorkerNodeKeys.toString()}. Valid keys are: 0..${(maxPoolSize - 1).toString()}`,
      )
    }
  }
}

export const checkValidTasksQueueOptions = (
  tasksQueueOptions: TasksQueueOptions | undefined,
): void => {
  if (tasksQueueOptions != null && !isPlainObject(tasksQueueOptions)) {
    throw new TypeError('Invalid tasks queue options: must be a plain object')
  }
  if (
    tasksQueueOptions?.concurrency != null &&
    !Number.isSafeInteger(tasksQueueOptions.concurrency)
  ) {
    throw new TypeError(
      'Invalid worker node tasks concurrency: must be an integer',
    )
  }
  if (
    tasksQueueOptions?.concurrency != null &&
    tasksQueueOptions.concurrency <= 0
  ) {
    throw new RangeError(
      `Invalid worker node tasks concurrency: ${tasksQueueOptions.concurrency.toString()} is a negative integer or zero`,
    )
  }
  if (
    tasksQueueOptions?.size != null &&
    !Number.isSafeInteger(tasksQueueOptions.size)
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue size: must be an integer',
    )
  }
  if (tasksQueueOptions?.size != null && tasksQueueOptions.size <= 0) {
    throw new RangeError(
      `Invalid worker node tasks queue size: ${tasksQueueOptions.size.toString()} is a negative integer or zero`,
    )
  }
  if (
    tasksQueueOptions?.tasksStealingRatio != null &&
    typeof tasksQueueOptions.tasksStealingRatio !== 'number'
  ) {
    throw new TypeError(
      'Invalid worker node tasks stealing ratio: must be a number',
    )
  }
  if (
    tasksQueueOptions?.tasksStealingRatio != null &&
    (tasksQueueOptions.tasksStealingRatio < 0 ||
      tasksQueueOptions.tasksStealingRatio > 1)
  ) {
    throw new RangeError(
      'Invalid worker node tasks stealing ratio: must be between 0 and 1',
    )
  }
}

export const checkWorkerNodeArguments = (
  type: WorkerType | undefined,
  specifier: URL | string | undefined,
  opts: WorkerNodeOptions | undefined,
): void => {
  if (type == null) {
    throw new TypeError('Cannot construct a worker node without a worker type')
  }
  if (!Object.values(WorkerTypes).includes(type)) {
    throw new TypeError(
      `Cannot construct a worker node with an invalid worker type '${type}'`,
    )
  }
  checkSpecifier(specifier)
  if (opts == null) {
    throw new TypeError(
      'Cannot construct a worker node without worker node options',
    )
  }
  if (!isPlainObject(opts)) {
    throw new TypeError(
      'Cannot construct a worker node with invalid worker node options: must be a plain object',
    )
  }
  if (opts.tasksQueueBackPressureSize == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue back pressure size option',
    )
  }
  if (!Number.isSafeInteger(opts.tasksQueueBackPressureSize)) {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer',
    )
  }
  if (opts.tasksQueueBackPressureSize <= 0) {
    throw new RangeError(
      'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer',
    )
  }
  if (opts.tasksQueueBucketSize == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue bucket size option',
    )
  }
  if (!Number.isSafeInteger(opts.tasksQueueBucketSize)) {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue bucket size option that is not an integer',
    )
  }
  if (opts.tasksQueueBucketSize <= 0) {
    throw new RangeError(
      'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer',
    )
  }
  if (opts.tasksQueuePriority == null) {
    throw new TypeError(
      'Cannot construct a worker node without a tasks queue priority option',
    )
  }
  if (typeof opts.tasksQueuePriority !== 'boolean') {
    throw new TypeError(
      'Cannot construct a worker node with a tasks queue priority option that is not a boolean',
    )
  }
}

/**
 * Updates the given measurement statistics.
 *
 * @param measurementStatistics - The measurement statistics to update.
 * @param measurementRequirements - The measurement statistics requirements.
 * @param measurementValue - The measurement value.
 * @internal
 */
const updateMeasurementStatistics = (
  measurementStatistics: MeasurementStatistics,
  measurementRequirements: MeasurementStatisticsRequirements | undefined,
  measurementValue: number | undefined,
): void => {
  if (
    measurementRequirements != null &&
    measurementValue != null &&
    measurementRequirements.aggregate
  ) {
    measurementStatistics.aggregate = (measurementStatistics.aggregate ?? 0) +
      measurementValue
    measurementStatistics.minimum = min(
      measurementValue,
      measurementStatistics.minimum ?? Number.POSITIVE_INFINITY,
    )
    measurementStatistics.maximum = max(
      measurementValue,
      measurementStatistics.maximum ?? Number.NEGATIVE_INFINITY,
    )
    if (measurementRequirements.average || measurementRequirements.median) {
      measurementStatistics.history.put(measurementValue)
      if (measurementRequirements.average) {
        measurementStatistics.average = average(
          measurementStatistics.history.toArray(),
        )
      } else if (measurementStatistics.average != null) {
        measurementStatistics.average = undefined
      }
      if (measurementRequirements.median) {
        measurementStatistics.median = median(
          measurementStatistics.history.toArray(),
        )
      } else if (measurementStatistics.median != null) {
        measurementStatistics.median = undefined
      }
    }
  }
}
if (environment === 'test') {
  exportedUpdateMeasurementStatistics = updateMeasurementStatistics
}

export const updateWaitTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
>(
  workerChoiceStrategiesContext:
    | WorkerChoiceStrategiesContext<Worker, Data, Response>
    | undefined,
  workerUsage: WorkerUsage,
  task: Task<Data>,
): void => {
  const timestamp = performance.now()
  const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
  updateMeasurementStatistics(
    workerUsage.waitTime,
    workerChoiceStrategiesContext?.getTaskStatisticsRequirements().waitTime,
    taskWaitTime,
  )
}

export const updateTaskStatisticsWorkerUsage = <Response = unknown>(
  workerUsage: WorkerUsage,
  message: MessageValue<Response>,
): void => {
  const workerTaskStatistics = workerUsage.tasks
  if (
    workerTaskStatistics.executing != null &&
    workerTaskStatistics.executing > 0
  ) {
    --workerTaskStatistics.executing
  }
  if (message.workerError == null) {
    ++workerTaskStatistics.executed
  } else {
    ++workerTaskStatistics.failed
  }
}

export const updateRunTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
>(
  workerChoiceStrategiesContext:
    | WorkerChoiceStrategiesContext<Worker, Data, Response>
    | undefined,
  workerUsage: WorkerUsage,
  message: MessageValue<Response>,
): void => {
  if (message.workerError != null) {
    return
  }
  updateMeasurementStatistics(
    workerUsage.runTime,
    workerChoiceStrategiesContext?.getTaskStatisticsRequirements().runTime,
    message.taskPerformance?.runTime ?? 0,
  )
}

export const updateEluWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
>(
  workerChoiceStrategiesContext:
    | WorkerChoiceStrategiesContext<Worker, Data, Response>
    | undefined,
  workerUsage: WorkerUsage,
  message: MessageValue<Response>,
): void => {
  if (message.workerError != null) {
    return
  }
  const eluTaskStatisticsRequirements = workerChoiceStrategiesContext
    ?.getTaskStatisticsRequirements().elu
  updateMeasurementStatistics(
    workerUsage.elu.active,
    eluTaskStatisticsRequirements,
    message.taskPerformance?.elu?.active ?? 0,
  )
  updateMeasurementStatistics(
    workerUsage.elu.idle,
    eluTaskStatisticsRequirements,
    message.taskPerformance?.elu?.idle ?? 0,
  )
  if (eluTaskStatisticsRequirements?.aggregate === true) {
    if (message.taskPerformance?.elu != null) {
      workerUsage.elu.count = (workerUsage.elu.count ?? 0) + 1
      workerUsage.elu.utilization =
        ((workerUsage.elu.utilization ?? 0) * (workerUsage.elu.count - 1) +
          message.taskPerformance.elu.utilization) /
        workerUsage.elu.count
    }
  }
}

export const messageListenerToEventListener = <Message = unknown>(
  listener: (message: MessageValue<Message>) => void,
): (event: Event) => void =>
(event: Event) => listener((event as MessageEvent<MessageValue<Message>>).data)

export const createWorker = <Worker extends IWorker>(
  type: WorkerType,
  specifier: URL | string,
  opts: { workerOptions?: WorkerOptions },
): Worker => {
  switch (type) {
    case WorkerTypes.web:
      return new Worker(specifier, {
        ...(runtime === JSRuntime.bun && { smol: true }),
        ...opts.workerOptions,
        type: 'module',
      }) as Worker
    default:
      throw new Error(`Unknown worker type '${type}'`)
  }
}

/**
 * Returns the worker type of the given worker.
 *
 * @param worker - The worker to get the type of.
 * @returns The worker type of the given worker.
 * @internal
 */
const getWorkerType = (worker: IWorker): WorkerType | undefined => {
  if (worker instanceof Worker) {
    return WorkerTypes.web
  }
}

/**
 * Returns the worker id of the given worker.
 *
 * @param worker - The worker to get the id of.
 * @returns The worker id of the given worker.
 * @internal
 */
const getWorkerId = (
  worker: IWorker,
): `${string}-${string}-${string}-${string}-${string}` | undefined => {
  if (worker instanceof Worker) {
    return crypto.randomUUID()
  }
}

export const initWorkerInfo = (worker: IWorker): WorkerInfo => {
  return {
    backPressure: false,
    backPressureStealing: false,
    continuousStealing: false,
    queuedTaskAbortion: false,
    dynamic: false,
    id: getWorkerId(worker),
    ready: false,
    stealing: false,
    stolen: false,
    type: getWorkerType(worker)!,
  }
}

export const waitWorkerNodeEvents = async <
  Worker extends IWorker,
  Data = unknown,
>(
  workerNode: IWorkerNode<Worker, Data>,
  workerNodeEvent: string,
  numberOfEventsToWait: number,
  timeout: number,
  timeoutRejection = true,
): Promise<number> => {
  return await new Promise<number>((resolve, reject) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    const listener = () => {
      ++events
      if (events >= numberOfEventsToWait) {
        if (timeoutHandle != null) clearTimeout(timeoutHandle)
        workerNode.removeEventListener(workerNodeEvent, listener)
        resolve(events)
      }
    }
    const timeoutHandle = timeout >= 0
      ? setTimeout(() => {
        workerNode.removeEventListener(workerNodeEvent, listener)
        timeoutRejection
          ? reject(
            new Error(
              `Timed out after ${timeout.toString()}ms waiting for ${numberOfEventsToWait.toString()} '${workerNodeEvent}' events. Received ${events.toString()} events`,
            ),
          )
          : resolve(events)
      }, timeout)
      : undefined
    switch (workerNodeEvent) {
      case 'message':
      case 'messageerror':
      case 'taskFinished':
      case 'backPressure':
      case 'idle':
      case 'exit':
        workerNode.addEventListener(workerNodeEvent, listener)
        break
      default:
        if (timeoutHandle != null) clearTimeout(timeoutHandle)
        reject(new Error('Invalid worker node event'))
    }
  })
}
