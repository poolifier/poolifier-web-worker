import { expect } from 'expect'
import { FixedThreadPool } from '../../../src/mod.ts'
import { generateRandomInteger } from '../../test-utils.mjs'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.ts'

Deno.test('Weighted round robin strategy worker choice strategy test suite', async (t) => {
  // const min = 1
  const max = 3
  const pool = new FixedThreadPool(
    max,
    new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
  )

  await t.step('Verify that reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.currentWorkerId = generateRandomInteger(
      Number.MAX_SAFE_INTEGER,
      1,
    )
    strategy.workerVirtualTaskRunTime = generateRandomInteger(
      Number.MAX_SAFE_INTEGER,
      1,
    )
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.workerNodeVirtualTaskRunTime).toBe(0)
  })

  await pool.destroy()
})
