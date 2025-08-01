import { expect } from '@std/expect'
import { before, describe, it } from '@std/testing/bdd'
import {
  DynamicThreadPool,
  PoolEvents,
  WorkerChoiceStrategies,
} from '../../../src/mod.ts'
import { TaskFunctions } from '../../test-types.mjs'
import {
  sleep,
  waitPoolEvents,
  waitWorkerNodeEvents,
} from '../../test-utils.mjs'

describe({
  name: 'Dynamic thread pool test suite',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const min = 1
    const max = 3
    let pool

    before(() => {
      pool = new DynamicThreadPool(
        min,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        {
          errorEventHandler: (e) => console.error(e),
        },
      )
    })

    it('Verify that the function is executed in a worker thread', async () => {
      let result = await pool.execute(
        {
          function: TaskFunctions.fibonacci,
        },
        'default',
        AbortSignal.timeout(2000),
      )
      expect(result).toBe(354224848179261915075n)
      result = await pool.execute(
        {
          function: TaskFunctions.factorial,
        },
        'default',
        AbortSignal.timeout(2000),
      )
      expect(result).toBe(
        93326215443944152681699238856266700490715968264381621468592963895217599993229915608941463976156518286253697920827223758251185210916864000000000000000000000000n,
      )
    })

    it('Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die', async () => {
      let poolBusy = 0
      pool.eventTarget.addEventListener(PoolEvents.busy, () => ++poolBusy)
      for (let i = 0; i < max * 2; i++) {
        pool.execute()
      }
      expect(pool.workerNodes.length).toBeLessThanOrEqual(max)
      expect(pool.workerNodes.length).toBeGreaterThan(min)
      expect(poolBusy).toBe(1)
      const exitEvents = await waitWorkerNodeEvents(pool, 'exit', max - min)
      expect(exitEvents).toBe(max - min)
      expect(pool.workerNodes.length).toBe(min)
    })

    it('Verify scale thread up and down is working', async () => {
      for (let i = 0; i < max * 2; i++) {
        pool.execute()
      }
      expect(pool.workerNodes.length).toBe(max)
      let exitEvents = await waitWorkerNodeEvents(pool, 'exit', max - min)
      expect(exitEvents).toBe(max - min)
      expect(pool.workerNodes.length).toBe(min)
      for (let i = 0; i < max * 2; i++) {
        pool.execute()
      }
      expect(pool.workerNodes.length).toBe(max)
      exitEvents = await waitWorkerNodeEvents(pool, 'exit', max - min)
      expect(exitEvents).toBe(max - min)
      expect(pool.workerNodes.length).toBe(min)
    })

    it('Shutdown test', async () => {
      const exitPromise = waitWorkerNodeEvents(pool, 'exit', min)
      let poolDestroy = 0
      pool.eventTarget.addEventListener(PoolEvents.destroy, () => ++poolDestroy)
      await pool.destroy()
      const exitEvents = await exitPromise
      expect(pool.info.started).toBe(false)
      expect(pool.info.ready).toBe(false)
      expect(pool.readyEventEmitted).toBe(false)
      expect(pool.emptyEventEmitted).toBe(false)
      expect(pool.fullEventEmitted).toBe(false)
      expect(pool.busyEventEmitted).toBe(false)
      expect(pool.backPressureEventEmitted).toBe(false)
      expect(pool.workerNodes.length).toBe(0)
      expect(exitEvents).toBe(min)
      expect(poolDestroy).toBe(1)
    })

    it('Validation of inputs test', () => {
      expect(() => new DynamicThreadPool(min)).toThrow(
        'The worker specifier must be defined',
      )
    })

    it('Verify scale thread up and down is working when long executing task is used:hard', async () => {
      const longRunningPool = new DynamicThreadPool(
        min,
        max,
        new URL(
          './../../worker-files/thread/longRunningWorkerHardBehavior.mjs',
          import.meta.url,
        ),
        {
          errorEventHandler: (e) => console.error(e),
        },
      )
      expect(longRunningPool.workerNodes.length).toBe(min)
      for (let i = 0; i < max * 2; i++) {
        longRunningPool.execute()
      }
      expect(longRunningPool.workerNodes.length).toBe(max)
      const exitEvents = await waitWorkerNodeEvents(
        longRunningPool,
        'exit',
        max - min,
      )
      expect(exitEvents).toBe(max - min)
      expect(longRunningPool.workerNodes.length).toBe(min)
      expect(
        longRunningPool.workerChoiceStrategiesContext.workerChoiceStrategies
          .get(
            longRunningPool.workerChoiceStrategiesContext
              .defaultWorkerChoiceStrategy,
          ).nextWorkerNodeKey,
      ).toBeLessThan(longRunningPool.workerNodes.length)
      // We need to clean up the resources after our test
      await longRunningPool.destroy()
    })

    it('Verify scale thread up and down is working when long executing task is used:soft', async () => {
      const longRunningPool = new DynamicThreadPool(
        min,
        max,
        new URL(
          './../../worker-files/thread/longRunningWorkerSoftBehavior.mjs',
          import.meta.url,
        ),
        {
          errorEventHandler: (e) => console.error(e),
        },
      )
      expect(longRunningPool.workerNodes.length).toBe(min)
      for (let i = 0; i < max * 2; i++) {
        longRunningPool.execute()
      }
      expect(longRunningPool.workerNodes.length).toBe(max)
      await sleep(1000)
      // Here we expect the workerNodes to be at the max size since the task is still executing
      expect(longRunningPool.workerNodes.length).toBe(max)
      // We need to clean up the resources after our test
      await longRunningPool.destroy()
    })

    it('Verify that a pool with zero worker can be instantiated', async () => {
      const pool = new DynamicThreadPool(
        0,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool).toBeInstanceOf(DynamicThreadPool)
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    it('Verify that a pool with zero worker works', async () => {
      for (
        const workerChoiceStrategy of Object.values(
          WorkerChoiceStrategies,
        )
      ) {
        if (
          workerChoiceStrategy ===
            WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
        ) {
          continue
        }
        const pool = new DynamicThreadPool(
          0,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            startWorkers: false,
            workerChoiceStrategy,
          },
        )
        for (let run = 0; run < 2; run++) {
          expect(pool.info.started).toBe(false)
          expect(pool.info.ready).toBe(false)
          pool.start()
          expect(pool.info.started).toBe(true)
          expect(pool.info.ready).toBe(true)
          run % 2 !== 0 && pool.enableTasksQueue(true)
          const maxMultiplier = 4
          const promises = new Set()
          expect(pool.workerNodes.length).toBe(pool.info.minSize)
          for (let i = 0; i < max * maxMultiplier; i++) {
            promises.add(pool.execute())
          }
          await Promise.all(promises)
          expect(pool.workerNodes.length).toBeGreaterThan(pool.info.minSize)
          expect(pool.workerNodes.length).toBeLessThanOrEqual(pool.info.maxSize)
          await waitPoolEvents(pool, PoolEvents.empty, 1)
          expect(pool.workerNodes.length).toBe(pool.info.minSize)
          // We need to clean up the resources after our test
          await pool.destroy()
        }
      }
    })
  },
})
