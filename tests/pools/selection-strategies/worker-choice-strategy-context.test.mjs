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
      let workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      expect(workerChoiceStrategyContext.workerChoiceStrategies.size).toBe(
        Object.keys(WorkerChoiceStrategies).length,
      )
      workerChoiceStrategyContext = new WorkerChoiceStrategyContext(dynamicPool)
      expect(workerChoiceStrategyContext.workerChoiceStrategies.size).toBe(
        Object.keys(WorkerChoiceStrategies).length,
      )
    },
  )

  await t.step(
    'Verify that constructor() initializes the context with retries attribute properly set',
    () => {
      let workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
        fixedPool,
      )
      expect(workerChoiceStrategyContext.retries).toBe(
        fixedPool.info.maxSize * 2,
      )
      workerChoiceStrategyContext = new WorkerChoiceStrategyContext(dynamicPool)
      expect(workerChoiceStrategyContext.retries).toBe(
        dynamicPool.info.maxSize * 2,
      )
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
          `Worker node key chosen is null or undefined after ${workerChoiceStrategyContext.retries} retries`,
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
          `Worker node key chosen is null or undefined after ${workerChoiceStrategyContext.retries} retries`,
        ),
      )
      workerChoiceStrategyNullStub.choose.restore()
    },
  )

  await t.step(
    'Verify that execute() retry until a worker node is chosen',
    () => {
      const workerChoiceStrategyContext = new WorkerChoiceStrategyContext(
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
        6,
      )
      expect(chosenWorkerKey).toBe(1)
      workerChoiceStrategyStub.choose.restore()
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
