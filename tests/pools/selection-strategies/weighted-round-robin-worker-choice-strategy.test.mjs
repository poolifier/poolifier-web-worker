import { randomInt } from 'node:crypto'
import { expect } from 'expect'
import { FixedThreadPool } from '../../../src/mod.ts'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.ts'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.ts'

Deno.test(
  'Weighted round robin strategy worker choice strategy test suite',
  async (t) => {
    // const min = 1
    const max = 3
    const pool = new FixedThreadPool(
      max,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    )

    await t.step('Verify that WRR reset() resets internals', () => {
      const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
      strategy.nextWorkerNodeKey = randomInt(1, 281474976710656)
      strategy.previousWorkerNodeKey = randomInt(1, 281474976710656)
      strategy.workerNodeVirtualTaskRunTime = randomInt(1, 281474976710656)
      expect(strategy.nextWorkerNodeKey).toBeGreaterThan(0)
      expect(strategy.previousWorkerNodeKey).toBeGreaterThan(0)
      expect(strategy.workerNodeVirtualTaskRunTime).toBeGreaterThan(0)
      expect(strategy.reset()).toBe(true)
      expect(strategy.nextWorkerNodeKey).toBe(0)
      expect(strategy.previousWorkerNodeKey).toBe(0)
      expect(strategy.workerNodeVirtualTaskRunTime).toBe(0)
    })

    await t.step('Verify that IWRR reset() resets internals', () => {
      const strategy = new InterleavedWeightedRoundRobinWorkerChoiceStrategy(
        pool,
      )
      strategy.nextWorkerNodeKey = randomInt(1, 281474976710656)
      strategy.previousWorkerNodeKey = randomInt(1, 281474976710656)
      strategy.roundId = randomInt(1, 281474976710656)
      strategy.workerNodeId = randomInt(1, 281474976710656)
      strategy.workerNodeVirtualTaskRunTime = randomInt(1, 281474976710656)
      expect(strategy.nextWorkerNodeKey).toBeGreaterThan(0)
      expect(strategy.previousWorkerNodeKey).toBeGreaterThan(0)
      expect(strategy.roundId).toBeGreaterThan(0)
      expect(strategy.workerNodeId).toBeGreaterThan(0)
      expect(strategy.workerNodeVirtualTaskRunTime).toBeGreaterThan(0)
      expect(strategy.reset()).toBe(true)
      expect(strategy.nextWorkerNodeKey).toBe(0)
      expect(strategy.previousWorkerNodeKey).toBe(0)
      expect(strategy.roundId).toBe(0)
      expect(strategy.workerNodeId).toBe(0)
      expect(strategy.workerNodeVirtualTaskRunTime).toBe(0)
    })

    await pool.destroy()
  },
)
