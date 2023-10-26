import os from 'node:os'
import { randomInt } from 'node:crypto'
import { expect } from 'npm:expect'
import {
  availableParallelism,
  KillBehaviors,
  WorkerTypes,
} from '../src/index.ts'
import {
  average,
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_TASK_NAME,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS,
  EMPTY_FUNCTION,
  exponentialDelay,
  getWorkerId,
  getWorkerType,
  isAsyncFunction,
  isKillBehavior,
  isPlainObject,
  isWebWorker,
  max,
  median,
  min,
  once,
  round,
  secureRandom,
  sleep,
} from '../src/utils.ts'

Deno.test('Utils test suite', async (t) => {
  await t.step('Verify DEFAULT_TASK_NAME value', () => {
    expect(DEFAULT_TASK_NAME).toBe('default')
  })

  await t.step('Verify EMPTY_FUNCTION value', () => {
    expect(EMPTY_FUNCTION).toStrictEqual(expect.any(Function))
  })

  await t.step('Verify DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS values', () => {
    expect(DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS).toStrictEqual({
      retries: 6,
      runTime: { median: false },
      waitTime: { median: false },
      elu: { median: false },
    })
  })

  await t.step(
    'Verify DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS values',
    () => {
      expect(DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS).toStrictEqual({
        aggregate: false,
        average: false,
        median: false,
      })
    },
  )

  await t.step('Verify availableParallelism() behavior', () => {
    const parallelism = availableParallelism()
    expect(typeof parallelism === 'number').toBe(true)
    expect(Number.isSafeInteger(parallelism)).toBe(true)
    let expectedParallelism = 1
    try {
      expectedParallelism = os.availableParallelism()
    } catch {
      expectedParallelism = os.cpus().length
    }
    expect(parallelism).toBe(expectedParallelism)
  })

  await t.step('Verify getWorkerType() behavior', () => {
    const worker = new Worker(
      new URL(
        './../tests/worker-files/thread/testWorker.mjs',
        import.meta.url,
      ),
      {
        type: 'module',
      },
    )
    expect(
      getWorkerType(worker),
    ).toBe(WorkerTypes.web)
    worker.terminate()
  })

  await t.step('Verify getWorkerId() behavior', () => {
    const worker = new Worker(
      new URL(
        './../tests/worker-files/thread/testWorker.mjs',
        import.meta.url,
      ),
      {
        type: 'module',
      },
    )
    expect(getWorkerId(worker)).toMatch(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    )
    worker.terminate()
  })

  await t.step('Verify sleep() behavior', async () => {
    const start = performance.now()
    await sleep(1000)
    const elapsed = performance.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(1000)
  })

  await t.step('Verify exponentialDelay() behavior', () => {
    const delay = exponentialDelay(randomInt(1000))
    expect(typeof delay === 'number').toBe(true)
    expect(delay).toBeGreaterThanOrEqual(Number.MIN_VALUE)
    expect(delay).toBeLessThanOrEqual(Number.MAX_VALUE)
  })

  await t.step('Verify average() computation', () => {
    expect(average([])).toBe(0)
    expect(average([0.08])).toBe(0.08)
    expect(average([0.25, 4.75, 3.05, 6.04, 1.01, 2.02, 5.03])).toBe(
      3.1642857142857146,
    )
    expect(average([0.25, 4.75, 3.05, 6.04, 1.01, 2.02])).toBe(
      2.8533333333333335,
    )
  })

  await t.step('Verify median() computation', () => {
    expect(median([])).toBe(0)
    expect(median([0.08])).toBe(0.08)
    expect(median([0.25, 4.75, 3.05, 6.04, 1.01, 2.02, 5.03])).toBe(3.05)
    expect(median([0.25, 4.75, 3.05, 6.04, 1.01, 2.02])).toBe(2.535)
  })

  await t.step('Verify round() behavior', () => {
    expect(round(0)).toBe(0)
    expect(round(0.5, 0)).toBe(1)
    expect(round(0.5)).toBe(0.5)
    expect(round(-0.5, 0)).toBe(-1)
    expect(round(-0.5)).toBe(-0.5)
    expect(round(1.005)).toBe(1.01)
    expect(round(2.175)).toBe(2.18)
    expect(round(5.015)).toBe(5.02)
    expect(round(-1.005)).toBe(-1.01)
    expect(round(-2.175)).toBe(-2.18)
    expect(round(-5.015)).toBe(-5.02)
  })

  await t.step('Verify isPlainObject() behavior', () => {
    expect(isPlainObject(null)).toBe(false)
    expect(isPlainObject(undefined)).toBe(false)
    expect(isPlainObject(true)).toBe(false)
    expect(isPlainObject(false)).toBe(false)
    expect(isPlainObject(0)).toBe(false)
    expect(isPlainObject('')).toBe(false)
    expect(isPlainObject([])).toBe(false)
    expect(isPlainObject(() => {})).toBe(false)
    expect(isPlainObject(new Date())).toBe(false)
    expect(isPlainObject(new RegExp())).toBe(false)
    expect(isPlainObject(new Error())).toBe(false)
    expect(isPlainObject(new Map())).toBe(false)
    expect(isPlainObject(new Set())).toBe(false)
    expect(isPlainObject(new WeakMap())).toBe(false)
    expect(isPlainObject(new WeakSet())).toBe(false)
    expect(isPlainObject(new Int8Array())).toBe(false)
    expect(isPlainObject(new Uint8Array())).toBe(false)
    expect(isPlainObject(new Uint8ClampedArray())).toBe(false)
    expect(isPlainObject(new Int16Array())).toBe(false)
    expect(isPlainObject(new Uint16Array())).toBe(false)
    expect(isPlainObject(new Int32Array())).toBe(false)
    expect(isPlainObject(new Uint32Array())).toBe(false)
    expect(isPlainObject(new Float32Array())).toBe(false)
    expect(isPlainObject(new Float64Array())).toBe(false)
    expect(isPlainObject(new BigInt64Array())).toBe(false)
    expect(isPlainObject(new BigUint64Array())).toBe(false)
    expect(isPlainObject(new Promise(() => {}))).toBe(false)
    expect(isPlainObject(new WeakRef({}))).toBe(false)
    expect(isPlainObject(new FinalizationRegistry(() => {}))).toBe(false)
    expect(isPlainObject(new ArrayBuffer())).toBe(false)
    expect(isPlainObject(new SharedArrayBuffer())).toBe(false)
    expect(isPlainObject(new DataView(new ArrayBuffer()))).toBe(false)
    expect(isPlainObject({})).toBe(true)
    expect(isPlainObject({ a: 1 })).toBe(true)
  })

  await t.step('Verify isKillBehavior() behavior', () => {
    expect(isKillBehavior(KillBehaviors.SOFT, KillBehaviors.SOFT)).toBe(true)
    expect(isKillBehavior(KillBehaviors.SOFT, KillBehaviors.HARD)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD, KillBehaviors.HARD)).toBe(true)
    expect(isKillBehavior(KillBehaviors.HARD, KillBehaviors.SOFT)).toBe(false)
    expect(isKillBehavior(KillBehaviors.SOFT)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD, null)).toBe(false)
    expect(isKillBehavior(KillBehaviors.HARD, undefined)).toBe(false)
    expect(isKillBehavior(KillBehaviors.SOFT, 'unknown')).toBe(false)
  })

  await t.step('Verify isAsyncFunction() behavior', () => {
    expect(isAsyncFunction(null)).toBe(false)
    expect(isAsyncFunction(undefined)).toBe(false)
    expect(isAsyncFunction(true)).toBe(false)
    expect(isAsyncFunction(false)).toBe(false)
    expect(isAsyncFunction(0)).toBe(false)
    expect(isAsyncFunction('')).toBe(false)
    expect(isAsyncFunction([])).toBe(false)
    expect(isAsyncFunction(new Date())).toBe(false)
    expect(isAsyncFunction(new RegExp())).toBe(false)
    expect(isAsyncFunction(new Error())).toBe(false)
    expect(isAsyncFunction(new Map())).toBe(false)
    expect(isAsyncFunction(new Set())).toBe(false)
    expect(isAsyncFunction(new WeakMap())).toBe(false)
    expect(isAsyncFunction(new WeakSet())).toBe(false)
    expect(isAsyncFunction(new Int8Array())).toBe(false)
    expect(isAsyncFunction(new Uint8Array())).toBe(false)
    expect(isAsyncFunction(new Uint8ClampedArray())).toBe(false)
    expect(isAsyncFunction(new Int16Array())).toBe(false)
    expect(isAsyncFunction(new Uint16Array())).toBe(false)
    expect(isAsyncFunction(new Int32Array())).toBe(false)
    expect(isAsyncFunction(new Uint32Array())).toBe(false)
    expect(isAsyncFunction(new Float32Array())).toBe(false)
    expect(isAsyncFunction(new Float64Array())).toBe(false)
    expect(isAsyncFunction(new BigInt64Array())).toBe(false)
    expect(isAsyncFunction(new BigUint64Array())).toBe(false)
    expect(isAsyncFunction(new Promise(() => {}))).toBe(false)
    expect(isAsyncFunction(new WeakRef({}))).toBe(false)
    expect(isAsyncFunction(new FinalizationRegistry(() => {}))).toBe(false)
    expect(isAsyncFunction(new ArrayBuffer())).toBe(false)
    expect(isAsyncFunction(new SharedArrayBuffer())).toBe(false)
    expect(isAsyncFunction(new DataView(new ArrayBuffer()))).toBe(false)
    expect(isAsyncFunction({})).toBe(false)
    expect(isAsyncFunction({ a: 1 })).toBe(false)
    expect(isAsyncFunction(() => {})).toBe(false)
    expect(isAsyncFunction(function () {})).toBe(false)
    expect(isAsyncFunction(function named() {})).toBe(false)
    expect(isAsyncFunction(async () => {})).toBe(true)
    expect(isAsyncFunction(async function () {})).toBe(true)
    expect(isAsyncFunction(async function named() {})).toBe(true)
  })

  await t.step('Verify secureRandom() behavior', () => {
    const randomNumber = secureRandom()
    expect(typeof randomNumber === 'number').toBe(true)
    expect(randomNumber).toBeGreaterThanOrEqual(0)
    expect(randomNumber).toBeLessThan(1)
  })

  await t.step('Verify min() behavior', () => {
    expect(min()).toBe(Infinity)
    expect(min(1, 2)).toBe(1)
    expect(min(2, 1)).toBe(1)
    expect(min(1, 1)).toBe(1)
  })

  await t.step('Verify max() behavior', () => {
    expect(max()).toBe(-Infinity)
    expect(max(1, 2)).toBe(2)
    expect(max(2, 1)).toBe(2)
    expect(max(1, 1)).toBe(1)
  })

  await t.step('Verify once()', () => {
    let called = 0
    const fn = () => ++called
    const onceFn = once(fn, this)
    const result1 = onceFn()
    expect(called).toBe(1)
    expect(result1).toBe(1)
    const result2 = onceFn()
    expect(called).toBe(1)
    expect(result2).toBe(1)
    const result3 = onceFn()
    expect(called).toBe(1)
    expect(result3).toBe(1)
  })

  await t.step('Verify isWebWorker()', () => {
    expect(isWebWorker()).toBe(false)
  })
})
