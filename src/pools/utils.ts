import {
  availableParallelism,
  average,
  isBun,
  isDeno,
  isPlainObject,
  max,
  median,
  min,
} from '../utils.ts'
import {
  type MeasurementStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies/selection-strategies-types.ts'
import type { IPool, TasksQueueOptions } from './pool.ts'
import {
  type IWorker,
  type IWorkerNode,
  type MeasurementStatistics,
  type WorkerNodeOptions,
  type WorkerType,
  WorkerTypes,
  type WorkerUsage,
} from './worker.ts'
import type { MessageValue, Task } from '../utility-types.ts'
import type { WorkerChoiceStrategyContext } from './selection-strategies/worker-choice-strategy-context.ts'

/**
 * Default measurement statistics requirements.
 */
export const DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS:
  MeasurementStatisticsRequirements = {
    aggregate: false,
    average: false,
    median: false,
  }

export const getDefaultTasksQueueOptions = (
  poolMaxSize: number,
): Required<TasksQueueOptions> => {
  return {
    size: Math.pow(poolMaxSize, 2),
    concurrency: 1,
    taskStealing: true,
    tasksStealingOnBackPressure: true,
    tasksFinishedTimeout: 2000,
  }
}

export const getWorkerChoiceStrategyRetries = <
  Worker extends IWorker,
  Data,
  Response,
>(
  pool: IPool<Worker, Data, Response>,
  opts?: WorkerChoiceStrategyOptions,
): number => {
  return (
    pool.info.maxSize +
    Object.keys(opts?.weights ?? getDefaultWeights(pool.info.maxSize)).length
  )
}

export const buildWorkerChoiceStrategyOptions = <
  Worker extends IWorker,
  Data,
  Response,
>(
  pool: IPool<Worker, Data, Response>,
  opts?: WorkerChoiceStrategyOptions,
): WorkerChoiceStrategyOptions => {
  opts = clone(opts ?? {})
  opts.weights = opts.weights ?? getDefaultWeights(pool.info.maxSize)
  return {
    ...{
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false },
    },
    ...opts,
  }
}

const clone = <T>(object: T): T => {
  return structuredClone<T>(object)
}

const getDefaultWeights = (
  poolMaxSize: number,
  defaultWorkerWeight?: number,
): Record<number, number> => {
  defaultWorkerWeight = defaultWorkerWeight ?? getDefaultWorkerWeight()
  const weights: Record<number, number> = {}
  for (let workerNodeKey = 0; workerNodeKey < poolMaxSize; workerNodeKey++) {
    weights[workerNodeKey] = defaultWorkerWeight
  }
  return weights
}

const estimatedCpuSpeed = (): number => {
  const runs = 150000000
  const begin = performance.now()
  // deno-lint-ignore no-empty
  for (let i = runs; i > 0; i--) {}
  const end = performance.now()
  const duration = end - begin
  return Math.trunc(runs / duration / 1000) // in MHz
}

let cpusInfo: { speed: number }[]
if (isDeno || isBun) {
  try {
    ;(async () => {
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      cpusInfo = (await import('node:os')).cpus()
    })()
  } catch {
    // Ignore
  }
}

const buildCpus = (): { speed: number }[] => {
  if (cpusInfo != null) {
    return cpusInfo
  } else {
    const estCpuSpeed = estimatedCpuSpeed()
    return Array(availableParallelism()).fill({
      speed: estCpuSpeed,
    })
  }
}

const getDefaultWorkerWeight = (cpus = buildCpus()): number => {
  if (isDeno || isBun) {
    let estCpuSpeed: number | undefined
    if (cpus.every((cpu) => cpu.speed == null || cpu.speed === 0)) {
      estCpuSpeed = estimatedCpuSpeed()
    }
    for (const cpu of cpus) {
      if (cpu.speed == null || cpu.speed === 0) {
        cpu.speed = cpus.find((cpu) =>
          cpu.speed != null && cpu.speed !== 0
        )?.speed ??
          estCpuSpeed ??
          2000
      }
    }
  }
  let cpusCycleTimeWeight = 0
  for (const cpu of cpus) {
    // CPU estimated cycle time
    const numberOfDigits = cpu.speed.toString().length - 1
    const cpuCycleTime = 1 / (cpu.speed / Math.pow(10, numberOfDigits))
    cpusCycleTimeWeight += cpuCycleTime * Math.pow(10, numberOfDigits)
  }
  return Math.round(cpusCycleTimeWeight / cpus.length)
}

export const checkFileURL = (fileURL: URL | undefined): void => {
  if (fileURL == null) {
    throw new TypeError('The worker URL must be specified')
  }
  if (fileURL instanceof URL === false) {
    throw new TypeError('The worker URL must be an instance of URL')
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
  } else if (!Number.isSafeInteger(max)) {
    throw new TypeError(
      'Cannot instantiate a dynamic pool with a non safe integer maximum pool size',
    )
  } else if (min > max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size',
    )
  } else if (max === 0) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a maximum pool size equal to zero',
    )
  } else if (min === max) {
    throw new RangeError(
      'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead',
    )
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
      `Invalid worker node tasks concurrency: ${tasksQueueOptions.concurrency} is a negative integer or zero`,
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
      `Invalid worker node tasks queue size: ${tasksQueueOptions.size} is a negative integer or zero`,
    )
  }
}

export const checkWorkerNodeArguments = (
  type: WorkerType | undefined,
  fileURL: URL | undefined,
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
  checkFileURL(fileURL)
  if (opts == null) {
    throw new TypeError(
      'Cannot construct a worker node without worker node options',
    )
  }
  if (!isPlainObject(opts)) {
    throw new TypeError(
      'Cannot construct a worker node with invalid options: must be a plain object',
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
}

/**
 * Updates the given measurement statistics.
 *
 * @param measurementStatistics - The measurement statistics to update.
 * @param measurementRequirements - The measurement statistics requirements.
 * @param measurementValue - The measurement value.
 * @internal
 */
// FIXME: should not be exported
export const updateMeasurementStatistics = (
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
      measurementStatistics.minimum ?? Infinity,
    )
    measurementStatistics.maximum = max(
      measurementValue,
      measurementStatistics.maximum ?? -Infinity,
    )
    if (measurementRequirements.average || measurementRequirements.median) {
      measurementStatistics.history.push(measurementValue)
      if (measurementRequirements.average) {
        measurementStatistics.average = average(measurementStatistics.history)
      } else if (measurementStatistics.average != null) {
        delete measurementStatistics.average
      }
      if (measurementRequirements.median) {
        measurementStatistics.median = median(measurementStatistics.history)
      } else if (measurementStatistics.median != null) {
        delete measurementStatistics.median
      }
    }
  }
}

export const updateWaitTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
>(
  workerChoiceStrategyContext:
    | WorkerChoiceStrategyContext<Worker, Data, Response>
    | undefined,
  workerUsage: WorkerUsage,
  task: Task<Data>,
): void => {
  const timestamp = performance.now()
  const taskWaitTime = timestamp - (task.timestamp ?? timestamp)
  updateMeasurementStatistics(
    workerUsage.waitTime,
    workerChoiceStrategyContext?.getTaskStatisticsRequirements().waitTime,
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
    ;--workerTaskStatistics.executing
  }
  if (message.workerError == null) {
    ;++workerTaskStatistics.executed
  } else {
    ;++workerTaskStatistics.failed
  }
}

export const updateRunTimeWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
>(
  workerChoiceStrategyContext:
    | WorkerChoiceStrategyContext<Worker, Data, Response>
    | undefined,
  workerUsage: WorkerUsage,
  message: MessageValue<Response>,
): void => {
  if (message.workerError != null) {
    return
  }
  updateMeasurementStatistics(
    workerUsage.runTime,
    workerChoiceStrategyContext?.getTaskStatisticsRequirements().runTime,
    message.taskPerformance?.runTime ?? 0,
  )
}

export const updateEluWorkerUsage = <
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
>(
  workerChoiceStrategyContext:
    | WorkerChoiceStrategyContext<Worker, Data, Response>
    | undefined,
  workerUsage: WorkerUsage,
  message: MessageValue<Response>,
): void => {
  if (message.workerError != null) {
    return
  }
  const eluTaskStatisticsRequirements = workerChoiceStrategyContext
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
      if (workerUsage.elu.utilization != null) {
        workerUsage.elu.utilization = (workerUsage.elu.utilization +
          message.taskPerformance.elu.utilization) /
          2
      } else {
        workerUsage.elu.utilization = message.taskPerformance.elu.utilization
      }
    }
  }
}

export const messageListenerToEventListener = <Message = unknown>(
  listener: (message: MessageValue<Message>) => void,
): (event: Event) => void =>
(event: Event) => listener((event as CustomEvent<MessageValue<Message>>).detail)

export const createWorker = <Worker extends IWorker>(
  type: WorkerType,
  fileURL: URL,
  opts: { workerOptions?: WorkerOptions },
): Worker => {
  switch (type) {
    case WorkerTypes.web:
      return new Worker(fileURL, {
        ...(isBun && { smol: true }),
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
export const getWorkerType = (worker: IWorker): WorkerType | undefined => {
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
export const getWorkerId = (worker: IWorker): string | undefined => {
  if (worker instanceof Worker) {
    return crypto.randomUUID()
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
): Promise<number> => {
  return await new Promise<number>((resolve) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    workerNode.addEventListener(workerNodeEvent, () => {
      ;++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    })
    if (timeout >= 0) {
      setTimeout(() => {
        resolve(events)
      }, timeout)
    }
  })
}
