import { randomInt } from 'node:crypto'
import { expect } from '@std/expect'
import { after, before, describe, it } from '@std/testing/bdd'
import { FixedThreadPool } from '../../../src/mod.ts'
import { FairShareWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/fair-share-worker-choice-strategy.ts'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.ts'
import { LeastBusyWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/least-busy-worker-choice-strategy.ts'
// LeastEluWorkerChoiceStrategy is not available in web workers (no ELU metrics)
// import { LeastEluWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/least-elu-worker-choice-strategy.ts'
import { LeastUsedWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/least-used-worker-choice-strategy.ts'
import { RoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/round-robin-worker-choice-strategy.ts'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.ts'

describe('Weighted round robin worker choice strategy test suite', () => {
  const max = 3
  let pool

  before(() => {
    pool = new FixedThreadPool(
      max,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    )
  })

  after(async () => {
    await pool.destroy()
  })

  it('Verify that WRR reset() resets internals', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.nextWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.previousWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.workerNodeVirtualTaskExecutionTime = randomInt(1, 281474976710656)
    expect(strategy.nextWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.previousWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.workerNodeVirtualTaskExecutionTime).toBeGreaterThan(0)
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.workerNodeVirtualTaskExecutionTime).toBe(0)
  })

  it('Verify that IWRR reset() resets internals', () => {
    const strategy = new InterleavedWeightedRoundRobinWorkerChoiceStrategy(pool)
    strategy.nextWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.previousWorkerNodeKey = randomInt(1, 281474976710656)
    strategy.roundId = randomInt(1, 281474976710656)
    strategy.workerNodeId = randomInt(1, 281474976710656)
    strategy.workerNodeVirtualTaskExecutionTime = randomInt(1, 281474976710656)
    expect(strategy.nextWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.previousWorkerNodeKey).toBeGreaterThan(0)
    expect(strategy.roundId).toBeGreaterThan(0)
    expect(strategy.workerNodeId).toBeGreaterThan(0)
    expect(strategy.workerNodeVirtualTaskExecutionTime).toBeGreaterThan(0)
    expect(strategy.reset()).toBe(true)
    expect(strategy.nextWorkerNodeKey).toBe(0)
    expect(strategy.previousWorkerNodeKey).toBe(0)
    expect(strategy.roundId).toBe(0)
    expect(strategy.workerNodeId).toBe(0)
    expect(strategy.workerNodeVirtualTaskExecutionTime).toBe(0)
  })

  it('Verify that RoundRobin choose() with empty workerNodeKeysSet returns undefined', () => {
    const strategy = new RoundRobinWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set())).toBe(undefined)
  })

  it('Verify that RoundRobin choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new RoundRobinWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set([0]))).toBe(0)
  })

  it('Verify that RoundRobin choose() respects workerNodeKeys affinity', () => {
    const strategy = new RoundRobinWorkerChoiceStrategy(pool)
    const workerNodeKeysSet = new Set([1, 2])
    expect(workerNodeKeysSet.has(strategy.choose(workerNodeKeysSet))).toBe(true)
  })

  it('Verify that LeastUsed choose() with empty workerNodeKeysSet returns undefined', () => {
    const strategy = new LeastUsedWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set())).toBe(undefined)
  })

  it('Verify that LeastUsed choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new LeastUsedWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set([0]))).toBe(0)
  })

  it('Verify that LeastUsed choose() respects workerNodeKeys affinity', () => {
    const strategy = new LeastUsedWorkerChoiceStrategy(pool)
    const workerNodeKeysSet = new Set([1, 2])
    expect(workerNodeKeysSet.has(strategy.choose(workerNodeKeysSet))).toBe(true)
  })

  it('Verify that LeastBusy choose() with empty workerNodeKeysSet returns undefined', () => {
    const strategy = new LeastBusyWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set())).toBe(undefined)
  })

  it('Verify that LeastBusy choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new LeastBusyWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set([0]))).toBe(0)
  })

  it('Verify that LeastBusy choose() respects workerNodeKeys affinity', () => {
    const strategy = new LeastBusyWorkerChoiceStrategy(pool)
    const workerNodeKeysSet = new Set([1, 2])
    expect(workerNodeKeysSet.has(strategy.choose(workerNodeKeysSet))).toBe(true)
  })

  // LeastElu tests are commented out because LeastEluWorkerChoiceStrategy
  // is not available in web workers (no ELU metrics support)
  // it('Verify that LeastElu choose() with empty workerNodeKeysSet returns undefined', () => {
  //   const strategy = new LeastEluWorkerChoiceStrategy(pool)
  //   expect(strategy.choose(new Set())).toBe(undefined)
  // })

  // it('Verify that LeastElu choose() with single workerNodeKey returns that key if ready', () => {
  //   const strategy = new LeastEluWorkerChoiceStrategy(pool)
  //   expect(strategy.choose(new Set([0]))).toBe(0)
  // })

  // it('Verify that LeastElu choose() respects workerNodeKeys affinity', () => {
  //   const strategy = new LeastEluWorkerChoiceStrategy(pool)
  //   const workerNodeKeysSet = new Set([1, 2])
  //   expect(workerNodeKeysSet.has(strategy.choose(workerNodeKeysSet))).toBe(true)
  // })

  it('Verify that FairShare choose() with empty workerNodeKeysSet returns undefined', () => {
    const strategy = new FairShareWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set())).toBe(undefined)
  })

  it('Verify that FairShare choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new FairShareWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set([0]))).toBe(0)
  })

  it('Verify that FairShare choose() respects workerNodeKeys affinity', () => {
    const strategy = new FairShareWorkerChoiceStrategy(pool)
    const workerNodeKeysSet = new Set([1, 2])
    expect(workerNodeKeysSet.has(strategy.choose(workerNodeKeysSet))).toBe(true)
  })

  it('Verify that WeightedRoundRobin choose() with empty workerNodeKeysSet returns undefined', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set())).toBe(undefined)
  })

  it('Verify that WeightedRoundRobin choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set([0]))).toBe(0)
  })

  it('Verify that WeightedRoundRobin choose() respects workerNodeKeys affinity', () => {
    const strategy = new WeightedRoundRobinWorkerChoiceStrategy(pool)
    const workerNodeKeysSet = new Set([1, 2])
    const result = strategy.choose(workerNodeKeysSet)
    expect(result === undefined || workerNodeKeysSet.has(result)).toBe(true)
  })

  it('Verify that InterleavedWeightedRoundRobin choose() with empty workerNodeKeysSet returns undefined', () => {
    const strategy = new InterleavedWeightedRoundRobinWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set())).toBe(undefined)
  })

  it('Verify that InterleavedWeightedRoundRobin choose() with single workerNodeKey returns that key if ready', () => {
    const strategy = new InterleavedWeightedRoundRobinWorkerChoiceStrategy(pool)
    expect(strategy.choose(new Set([0]))).toBe(0)
  })

  it('Verify that InterleavedWeightedRoundRobin choose() respects workerNodeKeys affinity', () => {
    const strategy = new InterleavedWeightedRoundRobinWorkerChoiceStrategy(pool)
    const workerNodeKeysSet = new Set([1, 2])
    const result = strategy.choose(workerNodeKeysSet)
    expect(result === undefined || workerNodeKeysSet.has(result)).toBe(true)
  })
})
