import type { TaskFunctionProperties } from './utility-types.ts'
import type { TaskFunctionObject } from './worker/task-functions.ts'
import type { KillBehavior } from './worker/worker-options.ts'

/**
 * Default task name.
 */
export const DEFAULT_TASK_NAME = 'default'

/**
 * An intentional empty function.
 */
export const EMPTY_FUNCTION: () => void = Object.freeze(() => {
  /* Intentionally empty */
})

/**
 * Returns safe host OS optimized estimate of the default amount of parallelism a pool should use.
 * Always returns a value greater than zero.
 *
 * @returns The host OS optimized maximum pool size.
 */
export const availableParallelism = (): number => {
  return navigator.hardwareConcurrency ?? 1
}

/**
 * Sleeps for the given amount of milliseconds.
 *
 * @param ms - The amount of milliseconds to sleep.
 * @returns A promise that resolves after the given amount of milliseconds.
 * @internal
 */
export const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Computes the retry delay in milliseconds using an exponential back off algorithm.
 *
 * @param retryNumber - The number of retries that have already been attempted
 * @param delayFactor - The base delay factor in milliseconds
 * @returns Delay in milliseconds
 * @internal
 */
export const exponentialDelay = (
  retryNumber = 0,
  delayFactor = 100,
): number => {
  const delay = 2 ** retryNumber * delayFactor
  const randomSum = delay * 0.2 * secureRandom() // 0-20% of the delay
  return delay + randomSum
}

/**
 * Computes the average of the given data set.
 *
 * @param dataSet - Data set.
 * @returns The average of the given data set.
 * @internal
 */
export const average = (dataSet: number[]): number => {
  if (Array.isArray(dataSet) && dataSet.length === 0) {
    return 0
  }
  if (Array.isArray(dataSet) && dataSet.length === 1) {
    return dataSet[0]
  }
  return (
    dataSet.reduce((accumulator, number) => accumulator + number, 0) /
    dataSet.length
  )
}

/**
 * Computes the median of the given data set.
 *
 * @param dataSet - Data set.
 * @returns The median of the given data set.
 * @internal
 */
export const median = (dataSet: number[]): number => {
  if (Array.isArray(dataSet) && dataSet.length === 0) {
    return 0
  }
  if (Array.isArray(dataSet) && dataSet.length === 1) {
    return dataSet[0]
  }
  const sortedDataSet = dataSet.slice().sort((a, b) => a - b)
  return (
    (sortedDataSet[(sortedDataSet.length - 1) >> 1] +
      sortedDataSet[sortedDataSet.length >> 1]) /
    2
  )
}

/**
 * Rounds the given number to the given scale.
 * The rounding is done using the "round half away from zero" method.
 *
 * @param num - The number to round.
 * @param scale - The scale to round to.
 * @returns The rounded number.
 * @internal
 */
export const round = (num: number, scale = 2): number => {
  const rounder = 10 ** scale
  return Math.round(num * rounder * (1 + Number.EPSILON)) / rounder
}

/**
 * Is the given value a plain object?
 *
 * @param value - The value to check.
 * @returns `true` if the given value is a plain object, `false` otherwise.
 * @internal
 */
export const isPlainObject = (value: unknown): value is object =>
  typeof value === 'object' &&
  value !== null &&
  value.constructor === Object &&
  Object.prototype.toString.call(value) === '[object Object]'

/**
 * Detects whether the given value is a kill behavior or not.
 *
 * @typeParam KB - Which specific KillBehavior type to test against.
 * @param killBehavior - Which kind of kill behavior to detect.
 * @param value - Unknown value.
 * @returns `true` if `value` was strictly equals to `killBehavior`, otherwise `false`.
 * @internal
 */
export const isKillBehavior = <KB extends KillBehavior>(
  killBehavior: KB,
  value: unknown,
): value is KB => {
  return value === killBehavior
}

type AsyncFunctionType<A extends unknown[], R> = (...args: A) => PromiseLike<R>

/**
 * Detects whether the given value is an asynchronous function or not.
 *
 * @param fn - Unknown value.
 * @returns `true` if `fn` was an asynchronous function, otherwise `false`.
 * @internal
 */
export const isAsyncFunction = (
  fn: unknown,
): fn is AsyncFunctionType<unknown[], unknown> => {
  return fn?.constructor === (async () => {}).constructor
}

/**
 * Generates a cryptographically secure random number in the [0,1[ range
 *
 * @returns A number in the [0,1[ range
 * @internal
 */
export const secureRandom = (): number => {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 0x100000000
}

/**
 * Returns the minimum of the given numbers.
 * If no numbers are given, `Number.POSITIVE_INFINITY` is returned.
 *
 * @param args - The numbers to get the minimum of.
 * @returns The minimum of the given numbers.
 * @internal
 */
export const min = (...args: number[]): number =>
  args.reduce(
    (minimum, num) => (minimum < num ? minimum : num),
    Number.POSITIVE_INFINITY,
  )

/**
 * Returns the maximum of the given numbers.
 * If no numbers are given, `Number.NEGATIVE_INFINITY` is returned.
 *
 * @param args - The numbers to get the maximum of.
 * @returns The maximum of the given numbers.
 * @internal
 */
export const max = (...args: number[]): number =>
  args.reduce(
    (maximum, num) => (maximum > num ? maximum : num),
    Number.NEGATIVE_INFINITY,
  )

/**
 * Wraps a function so that it can only be called once.
 *
 * @param fn - The function to wrap.
 * @param context - The context to bind the function to.
 * @returns The wrapped function.
 *
 * @typeParam A - The function's arguments.
 * @typeParam R - The function's return value.
 * @typeParam C - The function's context.
 * @internal
 */
// deno-lint-ignore no-explicit-any
export const once = <A extends any[], R, C extends ThisType<any>>(
  fn: (...args: A) => R,
  context: C,
): (...args: A) => R => {
  let result: R
  return (...args: A) => {
    if (fn != null) {
      result = fn.apply<C, A, R>(context, args)
      ;(fn as unknown as undefined) =
        (context as unknown as undefined) =
          undefined
    }
    return result
  }
}

export const buildTaskFunctionProperties = <Data, Response>(
  name: string,
  taskFunctionObject: TaskFunctionObject<Data, Response> | undefined,
): TaskFunctionProperties => {
  return {
    name,
    ...(taskFunctionObject?.priority != null && {
      priority: taskFunctionObject.priority,
    }),
    ...(taskFunctionObject?.strategy != null && {
      strategy: taskFunctionObject.strategy,
    }),
  }
}

/**
 * Indicates if running in Bun runtime.
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
const isBun: boolean = !!(globalThis as any).Bun ||
  // deno-lint-ignore no-explicit-any
  !!(globalThis as any).process?.versions?.bun

/**
 * Indicates if running in Deno runtime.
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
const isDeno: boolean = !!(globalThis as any).Deno

/**
 * Indicates if running in browser runtime.
 *
 * @internal
 */
// deno-lint-ignore no-explicit-any
const isBrowser: boolean = !!(globalThis as any).window &&
  // deno-lint-ignore no-explicit-any
  !!(globalThis as any).navigator

/**
 * JavaScript runtime environments enumeration.
 *
 * @internal
 */
export enum JSRuntime {
  bun = 'bun',
  deno = 'deno',
  browser = 'browser',
}

/**
 * JavaScript runtime environment.
 *
 * @internal
 */
export const runtime: JSRuntime = (() => {
  if (isBun) return JSRuntime.bun
  if (isDeno) return JSRuntime.deno
  if (isBrowser) return JSRuntime.browser
  throw new Error('Unsupported JavaScript runtime environment')
})()

const isMainThread: boolean | undefined = await (async (): Promise<
  boolean | undefined
> => {
  return await {
    browser: () => undefined,
    deno: () => undefined,
    bun: async () => {
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      return (await import('node:worker_threads')).isMainThread
    },
  }[runtime]()
})()

/**
 * The current environment name.
 *
 * @internal
 */
export const environment: string = await (async (): Promise<string> => {
  return await {
    browser: () => 'production',
    deno: () => {
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      return Deno.env.get('ENVIRONMENT') ?? 'production'
    },
    bun: async () => {
      // deno-lint-ignore ban-ts-comment
      // @ts-ignore
      return (await import('node:process')).env.ENVIRONMENT ?? 'production'
    },
  }[runtime]()
})()

/**
 * Whether the current environment is a web worker or not.
 *
 * @internal
 */
export const isWebWorker: boolean = isMainThread != null
  ? !isMainThread
  : typeof WorkerGlobalScope !== 'undefined' &&
    self instanceof WorkerGlobalScope
