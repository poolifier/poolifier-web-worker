import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { CircularBuffer } from '../../src/circular-buffer.ts'
import { WorkerTypes } from '../../src/mod.ts'
import {
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
      concurrency: 1,
      size: Math.pow(poolMaxSize, 2),
      taskStealing: true,
      tasksStealingOnBackPressure: true,
      tasksStealingRatio: 0.6,
      tasksFinishedTimeout: 2000,
    })
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
})
