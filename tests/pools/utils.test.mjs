import { expect } from 'expect'
import {
  CircularArray,
  DEFAULT_CIRCULAR_ARRAY_SIZE,
} from '../../src/circular-array.ts'
import {
  buildWorkerChoiceStrategyOptions,
  createWorker,
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  exportedUpdateMeasurementStatistics,
  getDefaultTasksQueueOptions,
  getWorkerChoiceStrategyRetries,
  getWorkerId,
  getWorkerType,
} from '../../src/pools/utils.ts'
import { FixedThreadPool, WorkerTypes } from '../../src/mod.ts'

Deno.test('Pool utils test suite', async (t) => {
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
  await t.step('Verify getDefaultTasksQueueOptions() behavior', () => {
    const poolMaxSize = 4
    expect(getDefaultTasksQueueOptions(poolMaxSize)).toStrictEqual({
      concurrency: 1,
      size: Math.pow(poolMaxSize, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksFinishedTimeout: 2000,
    })
  })

  await t.step('Verify getWorkerChoiceStrategyRetries() behavior', async () => {
    const numberOfThreads = 4
    const pool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
    )
    expect(getWorkerChoiceStrategyRetries(pool)).toBe(pool.info.maxSize * 2)
    const workerChoiceStrategyOptions = {
      runTime: { median: true },
      waitTime: { median: true },
      elu: { median: true },
      weights: {
        0: 100,
        1: 100,
      },
    }
    expect(
      getWorkerChoiceStrategyRetries(pool, workerChoiceStrategyOptions),
    ).toBe(
      pool.info.maxSize +
        Object.keys(workerChoiceStrategyOptions.weights).length,
    )
    await pool.destroy()
  })

  await t.step(
    'Verify buildWorkerChoiceStrategyOptions() behavior',
    async () => {
      const numberOfThreads = 4
      const pool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(buildWorkerChoiceStrategyOptions(pool)).toStrictEqual({
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
      const workerChoiceStrategyOptions = {
        runTime: { median: true },
        waitTime: { median: true },
        elu: { median: true },
        weights: {
          0: 100,
          1: 100,
        },
      }
      expect(
        buildWorkerChoiceStrategyOptions(pool, workerChoiceStrategyOptions),
      ).toStrictEqual(workerChoiceStrategyOptions)
      await pool.destroy()
    },
  )

  await t.step('Verify updateMeasurementStatistics() behavior', () => {
    const measurementStatistics = {
      history: new CircularArray(),
    }
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.01,
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.01,
      maximum: 0.01,
      minimum: 0.01,
      history: new CircularArray(),
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: false },
      0.02,
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.03,
      maximum: 0.02,
      minimum: 0.01,
      history: new CircularArray(),
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.001,
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.031,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.001,
      history: new CircularArray(DEFAULT_CIRCULAR_ARRAY_SIZE, 0.001),
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.003,
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.034,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.002,
      history: new CircularArray(DEFAULT_CIRCULAR_ARRAY_SIZE, 0.001, 0.003),
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: false, median: true },
      0.006,
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.04,
      maximum: 0.02,
      minimum: 0.001,
      median: 0.003,
      history: new CircularArray(
        DEFAULT_CIRCULAR_ARRAY_SIZE,
        0.001,
        0.003,
        0.006,
      ),
    })
    exportedUpdateMeasurementStatistics(
      measurementStatistics,
      { aggregate: true, average: true, median: false },
      0.01,
    )
    expect(measurementStatistics).toStrictEqual({
      aggregate: 0.05,
      maximum: 0.02,
      minimum: 0.001,
      average: 0.005,
      history: new CircularArray(
        DEFAULT_CIRCULAR_ARRAY_SIZE,
        0.001,
        0.003,
        0.006,
        0.01,
      ),
    })
  })

  await t.step('Verify createWorker() behavior', () => {
    const worker = createWorker(
      WorkerTypes.web,
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      {},
    )
    expect(worker).toBeInstanceOf(Worker)
    worker.terminate()
  })

  await t.step('Verify getWorkerType() behavior', () => {
    const worker = new Worker(
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      {
        type: 'module',
      },
    )
    expect(getWorkerType(worker)).toBe(WorkerTypes.web)
    worker.terminate()
  })

  await t.step('Verify getWorkerId() behavior', () => {
    const worker = new Worker(
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      {
        type: 'module',
      },
    )
    expect(getWorkerId(worker)).toMatch(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    )
    worker.terminate()
  })
})
