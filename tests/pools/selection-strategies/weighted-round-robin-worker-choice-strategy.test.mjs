import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import {
  FixedThreadPool,
  WeightedRoundRobinWorkerChoiceStrategy
} from '../../../lib/index.js'
import { generateRandomInteger } from '../../test-utils.js'

describe('Weighted round robin strategy worker choice strategy test suite', () => {
  // const min = 1
  const max = 3
  let pool

  beforeAll(() => {
    pool = new FixedThreadPool(
      max,
      './tests/worker-files/thread/testWorker.mjs'
    )
  })

  afterAll(async () => {
    await pool.destroy()
  })

  test('Verify that reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.currentWorkerId = generateRandomInteger(Number.MAX_SAFE_INTEGER, 1)
    strategy.workerVirtualTaskRunTime = generateRandomInteger(
      Number.MAX_SAFE_INTEGER,
      1
    )
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.workerNodeVirtualTaskRunTime).toBe(0)
  })
})
