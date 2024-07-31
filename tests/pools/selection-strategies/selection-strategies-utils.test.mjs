import { describe, it } from '@std/testing/bdd'
import { expect } from 'expect'

import { FixedThreadPool } from '../../../src/mod.ts'
import {
  buildWorkerChoiceStrategyOptions,
  getWorkerChoiceStrategiesRetries,
} from '../../../src/pools/selection-strategies/selection-strategies-utils.ts'

describe('Selection strategies utils test suite', () => {
  it('Verify buildWorkerChoiceStrategyOptions() behavior', async () => {
    const numberOfThreads = 4
    const pool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
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
  })

  it('Verify getWorkerChoiceStrategiesRetries() behavior', async () => {
    const numberOfThreads = 4
    const pool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    )
    expect(getWorkerChoiceStrategiesRetries(pool)).toBe(pool.info.maxSize * 2)
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
      getWorkerChoiceStrategiesRetries(pool, workerChoiceStrategyOptions),
    ).toBe(
      pool.info.maxSize +
        Object.keys(workerChoiceStrategyOptions.weights).length,
    )
    await pool.destroy()
  })
})
