import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { CircularBuffer } from '../../src/circular-buffer.ts'
import { WorkerTypes } from '../../src/mod.ts'
import {
  buildWebWorkerOptions,
  checkValidWorkerNodeKeys,
  createWorker,
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  exportedUpdateMeasurementStatistics,
  getDefaultTasksQueueOptions,
  initWorkerInfo,
} from '../../src/pools/utils.ts'
import { MeasurementHistorySize } from '../../src/pools/worker.ts'

describe('Pool utils test suite', () => {
  it('Verify DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS values', () => {
    expect(DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS).toStrictEqual({
      aggregate: false,
      average: false,
      median: false,
    })
  })

  it('Verify getDefaultTasksQueueOptions() behavior', () => {
    const poolMaxSize = 4
    expect(getDefaultTasksQueueOptions(poolMaxSize)).toStrictEqual({
      agingFactor: 0.001,
      concurrency: 1,
      loadExponent: 0.6666666666666666,
      size: poolMaxSize ** 2,
      tasksFinishedTimeout: 2000,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      taskStealing: true,
    })
  })

  it('builds web worker options from own properties', () => {
    Object.defineProperties(Object.prototype, {
      0: {
        configurable: true,
        enumerable: true,
        value: 'file:///polluted-preload.ts',
        writable: true,
      },
      name: {
        configurable: true,
        enumerable: true,
        value: 'polluted',
        writable: true,
      },
      read: {
        configurable: true,
        enumerable: true,
        value: ['/'],
        writable: true,
      },
    })
    const preload = [
      'file:///explicit-preload-zero.ts',
      'file:///explicit-preload-one.ts',
    ]
    try {
      const workerOptions = buildWebWorkerOptions({
        credentials: 'omit',
        deno: {
          permissions: {
            write: false,
          },
        },
        preload,
      })
      expect(Object.getPrototypeOf(workerOptions)).toBeNull()
      expect(workerOptions.type).toBe('module')
      expect(workerOptions.credentials).toBe('omit')
      expect(Object.hasOwn(workerOptions, 'name')).toBe(false)
      expect(workerOptions.name).toBeUndefined()
      expect(workerOptions.preload).not.toBe(preload)
      expect(Object.hasOwn(workerOptions.preload, 0)).toBe(true)
      expect(workerOptions.preload[0]).toBe(
        'file:///explicit-preload-zero.ts',
      )
      expect(workerOptions.preload[1]).toBe(
        'file:///explicit-preload-one.ts',
      )
      expect(Object.getPrototypeOf(workerOptions.deno)).toBeNull()
      expect(Object.getPrototypeOf(workerOptions.deno.permissions)).toBeNull()
      expect(workerOptions.deno.permissions.write).toBe(false)
      expect(Object.hasOwn(workerOptions.deno.permissions, 'read')).toBe(false)
      expect(workerOptions.deno.permissions.read).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, '0')
      Reflect.deleteProperty(Object.prototype, 'name')
      Reflect.deleteProperty(Object.prototype, 'read')
    }
  })

  it('normalizes Deno option dictionaries with custom prototypes', () => {
    Object.defineProperty(Object.prototype, 'read', {
      configurable: true,
      enumerable: true,
      value: true,
      writable: true,
    })
    const permissions = Object.assign(Object.create({ run: true }), {
      write: false,
    })
    const deno = Object.assign(Object.create({ namespace: true }), {
      permissions,
    })
    try {
      const workerOptions = buildWebWorkerOptions({ deno })
      expect(Object.getPrototypeOf(workerOptions.deno)).toBeNull()
      expect(Object.hasOwn(workerOptions.deno, 'namespace')).toBe(false)
      expect(workerOptions.deno.namespace).toBeUndefined()
      expect(Object.getPrototypeOf(workerOptions.deno.permissions)).toBeNull()
      expect(workerOptions.deno.permissions.write).toBe(false)
      expect(Object.hasOwn(workerOptions.deno.permissions, 'read')).toBe(false)
      expect(workerOptions.deno.permissions.read).toBeUndefined()
      expect(Object.hasOwn(workerOptions.deno.permissions, 'run')).toBe(false)
      expect(workerOptions.deno.permissions.run).toBeUndefined()
    } finally {
      Reflect.deleteProperty(Object.prototype, 'read')
    }
  })

  it('preserves non-enumerable own Deno permission options', () => {
    const deno = {}
    Object.defineProperty(deno, 'permissions', {
      configurable: true,
      value: 'none',
    })
    const explicitWorkerOptions = {}
    Object.defineProperty(explicitWorkerOptions, 'deno', { value: deno })
    const environment = {}
    Object.defineProperty(explicitWorkerOptions, 'env', { value: environment })
    Object.defineProperty(explicitWorkerOptions, 'type', { value: 'classic' })
    const workerOptions = buildWebWorkerOptions(explicitWorkerOptions)
    expect(Object.hasOwn(workerOptions.deno, 'permissions')).toBe(true)
    expect(workerOptions.deno.permissions).toBe('none')
    expect(Object.hasOwn(workerOptions, 'env')).toBe(true)
    expect(workerOptions.env).toBe(environment)
    expect(workerOptions.type).toBe('module')

    const permissions = {}
    Object.defineProperty(permissions, 'read', { value: false })
    Object.defineProperty(deno, 'permissions', {
      configurable: true,
      value: permissions,
    })
    const workerOptionsWithPermissionDictionary = buildWebWorkerOptions(
      explicitWorkerOptions,
    )
    expect(
      Object.hasOwn(
        workerOptionsWithPermissionDictionary.deno.permissions,
        'read',
      ),
    ).toBe(true)
    expect(
      workerOptionsWithPermissionDictionary.deno.permissions.read,
    ).toBe(false)
  })

  it('does not evaluate unknown Deno option accessors', () => {
    let accessorCalls = 0
    const permissions = {
      get ignored() {
        accessorCalls++
        throw new Error('Unexpected permission option access')
      },
      read: false,
    }
    const deno = {
      get ignored() {
        accessorCalls++
        throw new Error('Unexpected Deno option access')
      },
      permissions,
    }
    const explicitWorkerOptions = { deno }
    Object.defineProperty(explicitWorkerOptions, 'ignored', {
      get() {
        accessorCalls++
        throw new Error('Unexpected top-level option access')
      },
    })
    const workerOptions = buildWebWorkerOptions(explicitWorkerOptions)
    expect(workerOptions.deno.permissions.read).toBe(false)
    expect(accessorCalls).toBe(0)
  })

  it('normalizes Bun worker option arrays from own slots', () => {
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      enumerable: true,
      value: 'polluted',
      writable: true,
    })
    const argv = new Array(2)
    argv[1] = 'explicit'
    const execArgv = ['--smol']
    const transferable = new ArrayBuffer(8)
    const transferList = new Array(2)
    transferList[1] = transferable
    try {
      const workerOptions = buildWebWorkerOptions({
        argv,
        execArgv,
        transferList,
      })
      expect(workerOptions.argv).not.toBe(argv)
      expect(Object.hasOwn(workerOptions.argv, 0)).toBe(true)
      expect(workerOptions.argv[0]).toBeUndefined()
      expect(workerOptions.argv[1]).toBe('explicit')
      expect(workerOptions.execArgv).not.toBe(execArgv)
      expect(workerOptions.execArgv).toStrictEqual(execArgv)
      expect(workerOptions.transferList).not.toBe(transferList)
      expect(Object.hasOwn(workerOptions.transferList, 0)).toBe(true)
      expect(workerOptions.transferList[0]).toBeUndefined()
      expect(workerOptions.transferList[1]).toBe(transferable)
    } finally {
      Reflect.deleteProperty(Object.prototype, '0')
    }
  })

  it('rejects sparse executable option arrays', () => {
    Object.defineProperty(Object.prototype, '0', {
      configurable: true,
      enumerable: true,
      value: 'file:///polluted-preload.ts',
      writable: true,
    })
    try {
      for (const optionName of ['execArgv', 'preload']) {
        expect(() =>
          buildWebWorkerOptions({
            [optionName]: new Array(1),
          })
        ).toThrow(
          new TypeError(
            `Invalid workerOptions.${optionName}: must not be a sparse array`,
          ),
        )
      }
    } finally {
      Reflect.deleteProperty(Object.prototype, '0')
    }
  })

  it('Verify updateMeasurementStatistics() behavior', () => {
    const measurementStatistics = {
      history: new CircularBuffer(MeasurementHistorySize),
    }
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.01,
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.01,
      maximum: 0.01,
      minimum: 0.01,
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.02,
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.03,
      maximum: 0.02,
      minimum: 0.01,
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.001,
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.031,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.0010000000474974513,
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.003,
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.034,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.0020000000367872417,
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: true },
      0.006,
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.04,
      maximum: 0.02,
      minimum: 0.001,
      median: 0.003000000026077032,
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.01,
    )
    expect(measurementStatistics).toMatchObject({
      aggregate: 0.05,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.004999999975552782,
    })
  })

  it('Verify createWorker() behavior', () => {
    const worker = createWorker(
      WorkerTypes.web,
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      {},
    )
    expect(worker).toBeInstanceOf(Worker)
    worker.terminate()
  })

  it('Verify initWorkerInfo() behavior', () => {
    const worker = createWorker(
      WorkerTypes.web,
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      {},
    )
    const workerInfo = initWorkerInfo(worker)
    expect(workerInfo).toStrictEqual({
      backPressure: false,
      backPressureStealing: false,
      continuousStealing: false,
      queuedTaskAbortion: false,
      dynamic: false,
      id: expect.any(String),
      ready: false,
      stealing: false,
      stolen: false,
      type: WorkerTypes.web,
    })
    expect(workerInfo.id).toMatch(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    )
    worker.terminate()
  })

  it('Verify checkValidWorkerNodeKeys() behavior', () => {
    // Should not throw for undefined
    expect(() => checkValidWorkerNodeKeys(undefined)).not.toThrow()
    // Should not throw for null
    expect(() => checkValidWorkerNodeKeys(null)).not.toThrow()
    // Should not throw for valid array with elements
    expect(() => checkValidWorkerNodeKeys([0, 1, 2])).not.toThrow()
    // Should throw TypeError for non-array
    expect(() => checkValidWorkerNodeKeys('not an array')).toThrow(
      new TypeError('Invalid worker node keys: must be an array'),
    )
    expect(() => checkValidWorkerNodeKeys(123)).toThrow(
      new TypeError('Invalid worker node keys: must be an array'),
    )
    expect(() => checkValidWorkerNodeKeys({})).toThrow(
      new TypeError('Invalid worker node keys: must be an array'),
    )
    // Should throw RangeError for empty array
    expect(() => checkValidWorkerNodeKeys([])).toThrow(
      new RangeError('Invalid worker node keys: must not be an empty array'),
    )
    // Should throw TypeError for non-integer values
    expect(() => checkValidWorkerNodeKeys([1.5])).toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer",
      ),
    )
    expect(() => checkValidWorkerNodeKeys([0, 1.5, 2])).toThrow(
      new TypeError(
        "Invalid worker node key '1.5': must be a non-negative safe integer",
      ),
    )
    // Should throw TypeError for negative values
    expect(() => checkValidWorkerNodeKeys([-1])).toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer",
      ),
    )
    expect(() => checkValidWorkerNodeKeys([0, -1, 2])).toThrow(
      new TypeError(
        "Invalid worker node key '-1': must be a non-negative safe integer",
      ),
    )
    // Should throw TypeError for NaN
    expect(() => checkValidWorkerNodeKeys([Number.NaN])).toThrow(
      new TypeError(
        "Invalid worker node key 'NaN': must be a non-negative safe integer",
      ),
    )
    // Should throw TypeError for Infinity
    expect(() => checkValidWorkerNodeKeys([Number.POSITIVE_INFINITY])).toThrow(
      new TypeError(
        "Invalid worker node key 'Infinity': must be a non-negative safe integer",
      ),
    )
    expect(() => checkValidWorkerNodeKeys([Number.NEGATIVE_INFINITY])).toThrow(
      new TypeError(
        "Invalid worker node key '-Infinity': must be a non-negative safe integer",
      ),
    )
    // Should throw TypeError for duplicate keys
    expect(() => checkValidWorkerNodeKeys([0, 0, 1])).toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates'),
    )
    expect(() => checkValidWorkerNodeKeys([1, 2, 1])).toThrow(
      new TypeError('Invalid worker node keys: must not contain duplicates'),
    )
    // Should not throw with maxPoolSize when keys are in range
    expect(() => checkValidWorkerNodeKeys([0, 1, 2], 4)).not.toThrow()
    // Should throw RangeError when keys exceed maxPoolSize count
    expect(() => checkValidWorkerNodeKeys([0, 1, 2, 3, 4], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with more worker node keys than the maximum number of workers in the pool',
      ),
    )
    // Should throw RangeError when a key is out of range
    expect(() => checkValidWorkerNodeKeys([0, 4], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 4. Valid keys are: 0..3',
      ),
    )
    expect(() => checkValidWorkerNodeKeys([999], 4)).toThrow(
      new RangeError(
        'Cannot add a task function with invalid worker node keys: 999. Valid keys are: 0..3',
      ),
    )
  })
})
