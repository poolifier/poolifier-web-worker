import {
  assertSpyCalls,
  returnsNext,
  stub,
} from 'https://deno.land/std@0.209.0/testing/mock.ts'
import { expect } from 'npm:expect'
import {
  DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies,
} from '../../../src/mod.ts'
import { FairShareWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/fair-share-worker-choice-strategy.ts'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/interleaved-weighted-round-robin-worker-choice-strategy.ts'
import { LeastBusyWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/least-busy-worker-choice-strategy.ts'
// import { LeastEluWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/least-elu-worker-choice-strategy.ts'
import { LeastUsedWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/least-used-worker-choice-strategy.ts'
import { RoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/round-robin-worker-choice-strategy.ts'
import { WeightedRoundRobinWorkerChoiceStrategy } from '../../../src/pools/selection-strategies/weighted-round-robin-worker-choice-strategy.ts'
import { WorkerChoiceStrategyContext } from '../../../src/pools/selection-strategies/worker-choice-strategy-context.ts'

Deno.test('Worker choice strategy context test suite', async (t) => {
  const min = 1
  const max = 3
  const fixedPool = new FixedThreadPool(
    max,
    new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
  )
  const dynamicPool = new DynamicThreadPool(
    min,
    max,
    new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
  )

  await t.step(
    'Verify that constructor() initializes the context with all the available worker choice strategies',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      expect(workerChoiceStrategyContext.workerChoiceStrategies.size).toBe(
        Object.keys(WorkerChoiceStrategies).length,
      )
    },
  )

  await t.step(
    'Verify that execute() return the worker node key chosen by the strategy with fixed pool',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        fixedPool,
      )
      stub(workerChoiceStrategyStub, 'choose', returnsNext([0]))
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategyContext.workerChoiceStrategies.set(
        workerChoiceStrategyContext.workerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      const chosenWorkerKey = workerChoiceStrategyContext.execute()
      assertSpyCalls(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategyContext.workerChoiceStrategy,
        ).choose,
        1,
      )
      expect(chosenWorkerKey).toBe(0)
      workerChoiceStrategyStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() throws error if null or undefined is returned after retries',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      const workerChoiceStrategyUndefinedStub =
        new RoundRobinWorkerChoiceStrategy(fixedPool)
      stub(
        workerChoiceStrategyUndefinedStub,
        'choose',
        returnsNext(Array(7).fill(undefined)),
      )
      workerChoiceStrategyContext.workerChoiceStrategies.set(
        workerChoiceStrategyContext.workerChoiceStrategy,
        workerChoiceStrategyUndefinedStub,
      )
      expect(() => workerChoiceStrategyContext.execute()).toThrow(
        new Error(
          `Worker node key chosen is null or undefined after ${
            fixedPool.info.maxSize +
            Object.keys(workerChoiceStrategyContext.opts.weights).length
          } retries`,
        ),
      )
      workerChoiceStrategyUndefinedStub.choose.restore()
      const workerChoiceStrategyNullStub = new RoundRobinWorkerChoiceStrategy(
        fixedPool,
      )
      stub(
        workerChoiceStrategyNullStub,
        'choose',
        returnsNext(Array(7).fill(null)),
      )
      workerChoiceStrategyContext.workerChoiceStrategies.set(
        workerChoiceStrategyContext.workerChoiceStrategy,
        workerChoiceStrategyNullStub,
      )
      expect(() => workerChoiceStrategyContext.execute()).toThrow(
        new Error(
          `Worker node key chosen is null or undefined after ${
            fixedPool.info.maxSize +
            Object.keys(workerChoiceStrategyContext.opts.weights).length
          } retries`,
        ),
      )
      workerChoiceStrategyNullStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() retry until a worker node is ready and chosen',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        fixedPool,
      )
      stub(
        workerChoiceStrategyStub,
        'hasPoolWorkerNodesReady',
        returnsNext(Array(5).fill(false).concat(Array(1).fill(true))),
      )
      stub(
        workerChoiceStrategyStub,
        'choose',
        returnsNext([1]),
      )
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategyContext.workerChoiceStrategies.set(
        workerChoiceStrategyContext.workerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      const chosenWorkerKey = workerChoiceStrategyContext.execute()
      assertSpyCalls(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategyContext.workerChoiceStrategy,
        ).hasPoolWorkerNodesReady,
        6,
      )
      assertSpyCalls(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategyContext.workerChoiceStrategy,
        ).choose,
        1,
      )
      expect(chosenWorkerKey).toBe(1)
      workerChoiceStrategyStub.hasPoolWorkerNodesReady.restore()
      workerChoiceStrategyStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() throws error if worker choice strategy recursion reach the maximum depth',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        fixedPool,
      )
      stub(
        workerChoiceStrategyStub,
        'hasPoolWorkerNodesReady',
        returnsNext(Array(100000).fill(false)),
      )
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategyContext.workerChoiceStrategies.set(
        workerChoiceStrategyContext.workerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      expect(() => workerChoiceStrategyContext.execute()).toThrow(
        new RangeError('Maximum call stack size exceeded'),
      )
      workerChoiceStrategyStub.hasPoolWorkerNodesReady.restore()
    },
  )

  await t.step(
    'Verify that execute() return the worker node key chosen by the strategy with dynamic pool',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        dynamicPool,
      )
      stub(workerChoiceStrategyStub, 'choose', returnsNext([0]))
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategyContext.workerChoiceStrategies.set(
        workerChoiceStrategyContext.workerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      const chosenWorkerKey = workerChoiceStrategyContext.execute()
      assertSpyCalls(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategyContext.workerChoiceStrategy,
        ).choose,
        1,
      )
      expect(chosenWorkerKey).toBe(0)
      workerChoiceStrategyStub.choose.restore()
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with ROUND_ROBIN and dynamic pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with LEAST_USED and fixed pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with LEAST_USED and dynamic pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with LEAST_BUSY and fixed pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with LEAST_BUSY and dynamic pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  // await t.step(
  //   'Verify that setWorkerChoiceStrategy() works with LEAST_ELU and fixed pool',
  //   () => {
  //     const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
  //     const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
  //       fixedPool,
  //     )
  //     workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
  //     expect(
  //       workerChoiceStrategyContext.workerChoiceStrategies.get(
  //         workerChoiceStrategy,
  //       ),
  //     ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
  //     expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
  //       workerChoiceStrategy,
  //     )
  //   },
  // )

  // await t.step(
  //   'Verify that setWorkerChoiceStrategy() works with LEAST_ELU and dynamic pool',
  //   () => {
  //     const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
  //     const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
  //       dynamicPool,
  //     )
  //     workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
  //     expect(
  //       workerChoiceStrategyContext.workerChoiceStrategies.get(
  //         workerChoiceStrategy,
  //       ),
  //     ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
  //     expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
  //       workerChoiceStrategy,
  //     )
  //   },
  // )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with FAIR_SHARE and fixed pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with FAIR_SHARE and dynamic pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and fixed pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and dynamic pool',
    () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and fixed pool',
    () => {
      const workerChoiceStrategy =
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that setWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and dynamic pool',
    () => {
      const workerChoiceStrategy =
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
      )
      workerChoiceStrategyContext.setWorkerChoiceStrategy(workerChoiceStrategy)
      expect(
        workerChoiceStrategyContext.workerChoiceStrategies.get(
          workerChoiceStrategy,
        ),
      ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
      expect(workerChoiceStrategyContext.workerChoiceStrategy).toBe(
        workerChoiceStrategy,
      )
    },
  )

  await t.step(
    'Verify that worker choice strategy options enable median runtime pool statistics',
    () => {
      const wwrWorkerChoiceStrategy =
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      let workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
        wwrWorkerChoiceStrategy,
        {
          runTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
        wwrWorkerChoiceStrategy,
        {
          runTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      const fsWorkerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
      workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
        fsWorkerChoiceStrategy,
        {
          runTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        dynamicPool,
        fsWorkerChoiceStrategy,
        {
          runTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategyContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
    },
  )

  await fixedPool.destroy()
  await dynamicPool.destroy()
})
