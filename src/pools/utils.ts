import type { CircularBuffer } from '../circular-buffer.ts'
import {
  defaultAgingFactor,
  defaultLoadExponent,
} from '../queues/queue-types.ts'
import type { MessageValue, Task } from '../utility-types.ts'
import { isPlainObject, JSRuntime, max, min, runtime } from '../utils.ts'
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

/**
 * Copies own enumerable properties into an object without a prototype.
 *
 * @param sources - Objects to copy properties from.
 * @returns A new object without a prototype.
 * @internal
 */
export const withNullPrototype = <T extends object>(
  ...sources: (Partial<T> | undefined)[]
): T => {
  const target = Object.create(null) as T
  Object.assign(target, ...sources)
  return target
}

const defineEnumerableDataProperty = (
  target: object,
  key: PropertyKey,
  value: unknown,
): void => {
  const descriptor = Object.create(null) as PropertyDescriptor
  descriptor.configurable = true
  descriptor.enumerable = true
  descriptor.value = value
  descriptor.writable = true
  Object.defineProperty(target, key, descriptor)
}

const cloneOwnPropertiesWithNullPrototype = (
  source: object,
  materializedKeys: readonly PropertyKey[],
  materializeEnumerableProperties = false,
  omittedKeys: readonly PropertyKey[] = [],
): Record<PropertyKey, unknown> => {
  const clone = Object.create(null) as Record<PropertyKey, unknown>
  for (const key of Reflect.ownKeys(source)) {
    const descriptor = Object.getOwnPropertyDescriptor(source, key)
    if (descriptor == null) {
      continue
    }
    if (omittedKeys.includes(key)) {
      if (materializeEnumerableProperties && descriptor.enumerable === true) {
        Reflect.get(source, key)
      }
      continue
    }
    if (
      materializedKeys.includes(key) ||
      (materializeEnumerableProperties && descriptor.enumerable === true)
    ) {
      defineEnumerableDataProperty(clone, key, Reflect.get(source, key))
    } else {
      Object.setPrototypeOf(descriptor, null)
      Object.defineProperty(clone, key, descriptor)
    }
  }
  return clone
}

const materializeArray = <T>(values: readonly T[]): (T | undefined)[] => {
  const clone = new Array<T | undefined>(values.length)
  for (let index = 0; index < values.length; index++) {
    defineEnumerableDataProperty(
      clone,
      index,
      Object.hasOwn(values, index) ? values[index] : undefined,
    )
  }
  return clone
}

const cloneDenseStringArray = (
  values: readonly string[],
  optionName: string,
): string[] => {
  const clone = new Array<string>(values.length)
  for (let index = 0; index < values.length; index++) {
    if (!Object.hasOwn(values, index)) {
      throw new TypeError(
        `Invalid ${optionName}: must not be a sparse array`,
      )
    }
    defineEnumerableDataProperty(clone, index, values[index])
  }
  return clone
}

const denoPermissionOptionKeys: readonly PropertyKey[] = [
  'env',
  'ffi',
  'import',
  'net',
  'read',
  'run',
  'sys',
  'write',
]
const denoWorkerOptionKeys: readonly PropertyKey[] = [
  'namespace',
  'permissions',
]
const runtimeWorkerOptionKeys: readonly PropertyKey[] = [
  'argv',
  'credentials',
  'data',
  'deno',
  'env',
  'eval',
  'execArgv',
  'name',
  'preload',
  'ref',
  'shareEnv',
  'smol',
  'transferList',
  'workerData',
]
const forcedWorkerOptionKeys: readonly PropertyKey[] = ['type']

const isObjectLike = (value: unknown): value is object =>
  (typeof value === 'object' && value !== null) || typeof value === 'function'

interface RuntimeWorkerOptions extends WorkerOptions {
  argv?: unknown[]
  execArgv?: string[]
  preload?: string | string[]
  ref?: boolean
  smol?: boolean
  transferList?: unknown[]
}

const normalizeDenoWorkerOptions = (
  workerOptions: RuntimeWorkerOptions,
): void => {
  if (!Object.hasOwn(workerOptions, 'deno')) {
    return
  }
  const deno = Reflect.get(workerOptions, 'deno') as unknown
  if (!isObjectLike(deno)) {
    return
  }
  const normalizedDeno = cloneOwnPropertiesWithNullPrototype(
    deno,
    denoWorkerOptionKeys,
  )
  const permissions = normalizedDeno.permissions
  if (
    Object.hasOwn(normalizedDeno, 'permissions') &&
    isObjectLike(permissions)
  ) {
    const normalizedPermissions = cloneOwnPropertiesWithNullPrototype(
      permissions,
      denoPermissionOptionKeys,
    )
    for (const key of denoPermissionOptionKeys) {
      const value = normalizedPermissions[key]
      if (Array.isArray(value)) {
        normalizedPermissions[key] = materializeArray(value)
      }
    }
    normalizedDeno.permissions = normalizedPermissions
  }
  Reflect.set(workerOptions, 'deno', normalizedDeno)
}

/**
 * Builds options for a web worker launch.
 *
 * @param workerOptions - Explicit worker options.
 * @returns Normalized worker options.
 * @internal
 */
export const buildWebWorkerOptions = (
  workerOptions: WorkerOptions | undefined,
): WorkerOptions => {
  const normalizedWorkerOptions = workerOptions == null
    ? withNullPrototype<RuntimeWorkerOptions>()
    : cloneOwnPropertiesWithNullPrototype(
      workerOptions,
      runtimeWorkerOptionKeys,
      true,
      forcedWorkerOptionKeys,
    ) as RuntimeWorkerOptions
  if (
    runtime === JSRuntime.bun &&
    !Object.hasOwn(normalizedWorkerOptions, 'smol')
  ) {
    defineEnumerableDataProperty(normalizedWorkerOptions, 'smol', true)
  }
  defineEnumerableDataProperty(normalizedWorkerOptions, 'type', 'module')
  if (Array.isArray(normalizedWorkerOptions.argv)) {
    normalizedWorkerOptions.argv = materializeArray(
      normalizedWorkerOptions.argv,
    )
  }
  if (Array.isArray(normalizedWorkerOptions.execArgv)) {
    normalizedWorkerOptions.execArgv = cloneDenseStringArray(
      normalizedWorkerOptions.execArgv,
      'workerOptions.execArgv',
    )
  }
  if (Array.isArray(normalizedWorkerOptions.preload)) {
    normalizedWorkerOptions.preload = cloneDenseStringArray(
      normalizedWorkerOptions.preload,
      'workerOptions.preload',
    )
  }
  if (Array.isArray(normalizedWorkerOptions.transferList)) {
    normalizedWorkerOptions.transferList = materializeArray(
      normalizedWorkerOptions.transferList,
    )
  }
  normalizeDenoWorkerOptions(normalizedWorkerOptions)
  return normalizedWorkerOptions
}

export const getDefaultTasksQueueOptions = (
  poolMaxSize: number,
): Required<Readonly<TasksQueueOptions>> => {
  return Object.freeze({
    agingFactor: defaultAgingFactor,
    concurrency: 1,
    loadExponent: defaultLoadExponent,
    size: poolMaxSize ** 2,
    taskStealing: true,
    tasksFinishedTimeout: 2000,
    tasksStealingOnBackPressure: true,
    tasksStealingRatio: 0.6,
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
        `Cannot add a task function with invalid worker node keys: ${invalidWorkerNodeKeys.toString()}. Valid keys are: 0..${
          (
            maxPoolSize - 1
          ).toString()
        }`,
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
    tasksQueueOptions?.agingFactor != null &&
    typeof tasksQueueOptions.agingFactor !== 'number'
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue aging factor: must be a number',
    )
  }
  if (
    tasksQueueOptions?.agingFactor != null &&
    tasksQueueOptions.agingFactor < 0
  ) {
    throw new RangeError(
      'Invalid worker node tasks queue aging factor: must be greater than or equal to 0',
    )
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
    tasksQueueOptions?.loadExponent != null &&
    typeof tasksQueueOptions.loadExponent !== 'number'
  ) {
    throw new TypeError(
      'Invalid worker node tasks queue load exponent: must be a number',
    )
  }
  if (
    tasksQueueOptions?.loadExponent != null &&
    tasksQueueOptions.loadExponent <= 0
  ) {
    throw new RangeError(
      'Invalid worker node tasks queue load exponent: must be greater than 0',
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
 * Reusable snapshot buffer for measurement history statistics.
 * The main thread computes statistics sequentially, one history at a time.
 */
let measurementSnapshot = new Float32Array(0)

/**
 * Snapshots the given measurement history, in logical order, into the shared
 * snapshot buffer.
 *
 * @param history - Measurement history to snapshot.
 * @returns The number of snapshot values.
 */
const snapshotMeasurementHistory = (history: CircularBuffer): number => {
  const size = history.size
  if (measurementSnapshot.length < size) {
    measurementSnapshot = new Float32Array(size)
  }
  history.copyTo(measurementSnapshot)
  return size
}

/**
 * Computes the average of the given measurement history.
 * Bit-for-bit equivalent to `average(history.toArray())`: same values, same
 * summation order, no allocation.
 *
 * @param history - Measurement history.
 * @returns The average of the history values.
 */
const averageMeasurementHistory = (history: CircularBuffer): number => {
  const size = history.size
  if (size === 0) {
    return 0
  }
  if (size === 1) {
    // Return the raw element instead of `sum()`: accumulating `0 + value`
    // would fold `- 0` into `+ 0`, while `average()` returned `dataSet[0]`
    // as is.
    snapshotMeasurementHistory(history)
    return measurementSnapshot[0]
  }
  return history.sum() / size
}

/**
 * Swaps two elements of the given array.
 *
 * @param data - Array whose elements are swapped.
 * @param i - Index of the first element.
 * @param j - Index of the second element.
 */
const swap = (data: Float32Array, i: number, j: number): void => {
  if (i !== j) {
    const value = data[i]
    data[i] = data[j]
    data[j] = value
  }
}

/**
 * Width under which rank selection sorts its slice instead of partitioning.
 */
const SELECTION_INSERTION_CUTOFF = 12
/**
 * Maximum number of quickselect partitions, as a factor of the slice height,
 * before rank selection falls back to a native sort.
 */
const SELECTION_DEPTH_FACTOR = 2

/**
 * Selects the value at rank `k` of `data[0, size)` in place (partial sort).
 * Quickselect with median-of-three pivot, insertion cutoff and a depth limit
 * falling back to native sort, keeping the worst case at O(size log size).
 *
 * @param data - Data to partially sort.
 * @param size - Number of leading elements to consider.
 * @param k - Rank to select.
 * @returns The value at rank `k`.
 */
const selectAtRank = (data: Float32Array, size: number, k: number): number => {
  let left = 0
  let right = size - 1
  let depthLeft = SELECTION_DEPTH_FACTOR * Math.ceil(Math.log2(size + 1))
  for (;;) {
    const width = right - left + 1
    if (width <= SELECTION_INSERTION_CUTOFF) {
      for (let i = left + 1; i <= right; i++) {
        const value = data[i]
        let j = i - 1
        while (j >= left && data[j] > value) {
          data[j + 1] = data[j]
          --j
        }
        data[j + 1] = value
      }
      return data[k]
    }
    if (--depthLeft < 0) {
      data.subarray(left, right + 1).sort()
      return data[k]
    }
    // Median-of-three pivot, stashed at the right end.
    const middle = (left + right) >> 1
    if (data[middle] < data[left]) swap(data, middle, left)
    if (data[right] < data[middle]) {
      swap(data, middle, right)
      if (data[middle] < data[left]) swap(data, middle, left)
    }
    const pivot = data[middle]
    swap(data, middle, right)
    let lessEnd = left
    for (let i = left; i < right; i++) {
      if (data[i] < pivot) {
        swap(data, i, lessEnd)
        ++lessEnd
      }
    }
    let equalEnd = lessEnd
    for (let i = lessEnd; i < right; i++) {
      if (data[i] === pivot) {
        swap(data, i, equalEnd)
        ++equalEnd
      }
    }
    swap(data, right, equalEnd)
    if (k < lessEnd) {
      right = lessEnd - 1
    } else if (k > equalEnd) {
      left = equalEnd + 1
    } else {
      return pivot
    }
  }
}

/**
 * Computes the median of the given measurement history.
 * Returns the same two middle values as `median(history.toArray())` for
 * finite inputs: the middle values are selected elements, not interpolated
 * ones. Inputs no measurement producer can emit (`- 0`, `NaN`) may pick a
 * different occurrence among equal-comparing values than the comparator
 * based sort did.
 *
 * @param history - Measurement history.
 * @returns The median of the history values.
 */
const medianMeasurementHistory = (history: CircularBuffer): number => {
  const size = snapshotMeasurementHistory(history)
  if (size === 0) {
    return 0
  }
  if (size === 1) {
    return measurementSnapshot[0]
  }
  const upperRank = size >> 1
  const lowerRank = (size - 1) >> 1
  const upper = selectAtRank(measurementSnapshot, size, upperRank)
  // After the first selection, the leading `upperRank` elements are the
  // smallest ones, so the lower middle value is selected within that prefix.
  const lower = lowerRank === upperRank
    ? upper
    : selectAtRank(measurementSnapshot, upperRank, lowerRank)
  return (lower + upper) / 2
}
/**
 * Selects the worker node to steal a task from: the one with the highest
 * number of queued tasks among the other non-empty ones. Ties are broken by
 * the lowest worker node key order, identical to selecting the first element
 * of a stable sort by decreasing queued tasks count.
 *
 * @param workerNodes - The worker nodes to select from.
 * @param stealingWorkerNode - The worker node requesting the task to steal.
 * @returns The worker node to steal a task from, if any.
 * @internal
 */
const selectStealSourceWorkerNode = <Node extends { usage: WorkerUsage }>(
  workerNodes: Node[],
  stealingWorkerNode: Node,
): Node | undefined => {
  let sourceWorkerNode: Node | undefined
  for (const candidateWorkerNode of workerNodes) {
    if (
      candidateWorkerNode !== stealingWorkerNode &&
      candidateWorkerNode.usage.tasks.queued > 0 &&
      (sourceWorkerNode === undefined ||
        candidateWorkerNode.usage.tasks.queued >
          sourceWorkerNode.usage.tasks.queued)
    ) {
      sourceWorkerNode = candidateWorkerNode
    }
  }
  return sourceWorkerNode
}

export { selectStealSourceWorkerNode }

/**
 * Updates the given measurement statistics.
 *
 * @param measurementStatistics - The measurement statistics to update.
 * @param measurementRequirements - The measurement statistics requirements.
 * @param measurementValue - The measurement value.
 * @internal
 */
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
      measurementStatistics.minimum ?? Number.POSITIVE_INFINITY,
    )
    measurementStatistics.maximum = max(
      measurementValue,
      measurementStatistics.maximum ?? Number.NEGATIVE_INFINITY,
    )
    if (measurementRequirements.average || measurementRequirements.median) {
      measurementStatistics.history.put(measurementValue)
      if (measurementRequirements.average) {
        measurementStatistics.average = averageMeasurementHistory(
          measurementStatistics.history,
        )
      } else if (measurementStatistics.average != null) {
        measurementStatistics.average = undefined
      }
      if (measurementRequirements.median) {
        measurementStatistics.median = medianMeasurementHistory(
          measurementStatistics.history,
        )
      } else if (measurementStatistics.median != null) {
        measurementStatistics.median = undefined
      }
    }
  }
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
      return new Worker(
        specifier,
        buildWebWorkerOptions(
          Object.hasOwn(opts, 'workerOptions') ? opts.workerOptions : undefined,
        ),
      ) as Worker
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
