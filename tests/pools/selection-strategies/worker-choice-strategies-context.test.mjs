import { assertSpyCalls, returnsNext, stub } from '@std/testing/mock'
import { expect } from 'expect'
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
import { WorkerChoiceStrategiesContext } from '../../../src/pools/selection-strategies/worker-choice-strategies-context.ts'

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
    'Verify that constructor() initializes the context with the default choice strategy',
    () => {
      let workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      expect(workerChoiceStrategiesContext.workerChoiceStrategies.size).toBe(1)
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      expect(workerChoiceStrategiesContext.workerChoiceStrategies.size).toBe(1)
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that constructor() initializes the context with retries attribute properly set',
    () => {
      let workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      expect(workerChoiceStrategiesContext.retries).toBe(
        fixedPool.info.maxSize * 2,
      )
      workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      expect(workerChoiceStrategiesContext.retries).toBe(
        dynamicPool.info.maxSize * 2,
      )
    },
  )

  await t.step(
    'Verify that execute() throws error if null or undefined is returned after retries',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      const workerChoiceStrategyUndefinedStub =
        new RoundRobinWorkerChoiceStrategy(fixedPool)
      stub(
        workerChoiceStrategyUndefinedStub,
        'choose',
        returnsNext(Array(7).fill(undefined)),
      )
      workerChoiceStrategiesContext.workerChoiceStrategies.set(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        workerChoiceStrategyUndefinedStub,
      )
      expect(() => workerChoiceStrategiesContext.execute()).toThrow(
        new Error(
          `Worker node key chosen is null or undefined after ${workerChoiceStrategiesContext.retries} retries`,
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
      workerChoiceStrategiesContext.workerChoiceStrategies.set(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        workerChoiceStrategyNullStub,
      )
      expect(() => workerChoiceStrategiesContext.execute()).toThrow(
        new Error(
          `Worker node key chosen is null or undefined after ${workerChoiceStrategiesContext.retries} retries`,
        ),
      )
      workerChoiceStrategyNullStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() retry until a worker node is chosen',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        fixedPool,
      )
      stub(
        workerChoiceStrategyStub,
        'choose',
        returnsNext(Array(5).fill(undefined).concat(Array(1).fill(1))),
      )
      expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategiesContext.workerChoiceStrategies.set(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      const chosenWorkerKey = workerChoiceStrategiesContext.execute()
      assertSpyCalls(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ).choose,
        6,
      )
      expect(chosenWorkerKey).toBe(1)
      workerChoiceStrategyStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() return the worker node key chosen by the strategy with fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        fixedPool,
      )
      stub(workerChoiceStrategyStub, 'choose', returnsNext([0]))
      expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategiesContext.workerChoiceStrategies.set(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      const chosenWorkerKey = workerChoiceStrategiesContext.execute()
      assertSpyCalls(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ).choose,
        1,
      )
      expect(chosenWorkerKey).toBe(0)
      workerChoiceStrategyStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() return the worker node key chosen by the strategy with dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      const workerChoiceStrategyStub = new RoundRobinWorkerChoiceStrategy(
        dynamicPool,
      )
      stub(workerChoiceStrategyStub, 'choose', returnsNext([0]))
      expect(workerChoiceStrategiesContext.defaultWorkerChoiceStrategy).toBe(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      workerChoiceStrategiesContext.workerChoiceStrategies.set(
        workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        workerChoiceStrategyStub,
      )
      const chosenWorkerKey = workerChoiceStrategiesContext.execute()
      assertSpyCalls(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ).choose,
        1,
      )
      expect(chosenWorkerKey).toBe(0)
      workerChoiceStrategyStub.choose.restore()
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with ROUND_ROBIN and fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with ROUND_ROBIN and dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.ROUND_ROBIN,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(RoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with LEAST_USED and fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.LEAST_USED,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with LEAST_USED and dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.LEAST_USED,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastUsedWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with LEAST_BUSY and fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.LEAST_BUSY,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with LEAST_BUSY and dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.LEAST_BUSY,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(LeastBusyWorkerChoiceStrategy)
    },
  )

  // await t.step(
  //   'Verify that setDefaultWorkerChoiceStrategy() works with LEAST_ELU and fixed pool',
  //   () => {
  //     const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
  //       fixedPool,
  //     )
  //     workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
  //       WorkerChoiceStrategies.LEAST_ELU,
  //     )
  //     expect(
  //       workerChoiceStrategiesContext.workerChoiceStrategies.get(
  //         workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
  //       ),
  //     ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
  //   },
  // )

  // await t.step(
  //   'Verify that setDefaultWorkerChoiceStrategy() works with LEAST_ELU and dynamic pool',
  //   () => {
  //     const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
  //       dynamicPool,
  //     )
  //     workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
  //       WorkerChoiceStrategies.LEAST_ELU,
  //     )
  //     expect(
  //       workerChoiceStrategiesContext.workerChoiceStrategies.get(
  //         workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
  //       ),
  //     ).toBeInstanceOf(LeastEluWorkerChoiceStrategy)
  //   },
  // )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with FAIR_SHARE and fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.FAIR_SHARE,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with FAIR_SHARE and dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.FAIR_SHARE,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(FairShareWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with WEIGHTED_ROUND_ROBIN and dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(WeightedRoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and fixed pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that setDefaultWorkerChoiceStrategy() works with INTERLEAVED_WEIGHTED_ROUND_ROBIN and dynamic pool',
    () => {
      const workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
      )
      workerChoiceStrategiesContext.setDefaultWorkerChoiceStrategy(
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
      )
      expect(
        workerChoiceStrategiesContext.workerChoiceStrategies.get(
          workerChoiceStrategiesContext.defaultWorkerChoiceStrategy,
        ),
      ).toBeInstanceOf(InterleavedWeightedRoundRobinWorkerChoiceStrategy)
    },
  )

  await t.step(
    'Verify that worker choice strategy options enable median runtime pool statistics',
    () => {
      const wwrWorkerChoiceStrategy =
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
      let workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
        [wwrWorkerChoiceStrategy],
        {
          runTime: { median: true },
          waitTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .median,
      ).toBe(true)
      workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
        [wwrWorkerChoiceStrategy],
        {
          runTime: { median: true },
          waitTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .median,
      ).toBe(true)
      const fsWorkerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
      workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        fixedPool,
        [fsWorkerChoiceStrategy],
        {
          runTime: { median: true },
          waitTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .median,
      ).toBe(true)
      workerChoiceStrategiesContext = new WorkerChoiceStrategiesContext(
        dynamicPool,
        [fsWorkerChoiceStrategy],
        {
          runTime: { median: true },
          waitTime: { median: true },
        },
      )
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().runTime
          .median,
      ).toBe(true)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .average,
      ).toBe(false)
      expect(
        workerChoiceStrategiesContext.getTaskStatisticsRequirements().waitTime
          .median,
      ).toBe(true)
    },
  )

  await fixedPool.destroy()
  await dynamicPool.destroy()
})
