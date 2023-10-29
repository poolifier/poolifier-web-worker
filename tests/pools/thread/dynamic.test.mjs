import { expect } from 'npm:expect'
import { DynamicThreadPool, PoolEvents } from '../../../src/mod.ts'
import { TaskFunctions } from '../../test-types.mjs'
import { sleep, waitWorkerNodeEvents } from '../../test-utils.mjs'

Deno.test({
  name: 'Dynamic thread pool test suite',
  fn: async (t) => {
    const min = 1
    const max = 3
    const pool = new DynamicThreadPool(
      min,
      max,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
      {
        messageEventErrorHandler: (e) => console.error(e),
      },
    )

    await t.step(
      'Verify that the function is executed in a worker thread',
      async () => {
        let result = await pool.execute({
          function: TaskFunctions.fibonacci,
        })
        expect(result).toBe(75025)
        result = await pool.execute({
          function: TaskFunctions.factorial,
        })
        expect(result).toBe(9.33262154439441e157)
      },
    )

    await t.step(
      'Verify that new workers are created when required, max size is not exceeded and that after a while new workers will die',
      async () => {
        let poolBusy = 0
        pool.emitter.on(PoolEvents.busy, () => ++poolBusy)
        for (let i = 0; i < max * 2; i++) {
          pool.execute()
        }
        expect(pool.workerNodes.length).toBeLessThanOrEqual(max)
        expect(pool.workerNodes.length).toBeGreaterThan(min)
        expect(poolBusy).toBe(1)
        const numberOfExitEvents = await waitWorkerNodeEvents(
          pool,
          'exit',
          max - min,
        )
        expect(numberOfExitEvents).toBe(max - min)
      },
    )

    await t.step('Verify scale thread up and down is working', async () => {
      expect(pool.workerNodes.length).toBe(min)
      for (let i = 0; i < max * 2; i++) {
        pool.execute()
      }
      expect(pool.workerNodes.length).toBe(max)
      await waitWorkerNodeEvents(pool, 'exit', max - min)
      expect(pool.workerNodes.length).toBe(min)
      for (let i = 0; i < max * 2; i++) {
        pool.execute()
      }
      expect(pool.workerNodes.length).toBe(max)
      await waitWorkerNodeEvents(pool, 'exit', max - min)
      expect(pool.workerNodes.length).toBe(min)
    })

    await t.step('Shutdown test', async () => {
      const exitPromise = waitWorkerNodeEvents(pool, 'exit', min)
      expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
      let poolDestroy = 0
      pool.emitter.on(PoolEvents.destroy, () => ++poolDestroy)
      expect(pool.emitter.eventNames()).toStrictEqual([
        PoolEvents.busy,
        PoolEvents.destroy,
      ])
      await pool.destroy()
      const numberOfExitEvents = await exitPromise
      expect(pool.started).toBe(false)
      expect(pool.workerNodes.length).toBeLessThan(min)
      expect(numberOfExitEvents).toBe(min)
      expect(poolDestroy).toBe(1)
    })

    await t.step('Validation of inputs test', () => {
      expect(() => new DynamicThreadPool(min)).toThrow(
        'Cannot find the worker URL \'undefined\'',
      )
    })

    await t.step('Should work even without opts in input', async () => {
      const pool = new DynamicThreadPool(
        min,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      const res = await pool.execute()
      expect(res).toStrictEqual({ ok: 1 })
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    await t.step(
      'Verify scale thread up and down is working when long executing task is used:hard',
      async () => {
        const longRunningPool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/longRunningWorkerHardBehavior.mjs',
            import.meta.url,
          ),
          {
            messageEventErrorHandler: (e) => console.error(e),
          },
        )
        expect(longRunningPool.workerNodes.length).toBe(min)
        for (let i = 0; i < max * 2; i++) {
          longRunningPool.execute()
        }
        expect(longRunningPool.workerNodes.length).toBe(max)
        await waitWorkerNodeEvents(longRunningPool, 'exit', max - min)
        expect(longRunningPool.workerNodes.length).toBe(min)
        expect(
          longRunningPool.workerChoiceStrategyContext.workerChoiceStrategies
            .get(
              longRunningPool.workerChoiceStrategyContext.workerChoiceStrategy,
            ).nextWorkerNodeKey,
        ).toBeLessThan(longRunningPool.workerNodes.length)
        // We need to clean up the resources after our test
        await longRunningPool.destroy()
      },
    )

    await t.step(
      'Verify scale thread up and down is working when long executing task is used:soft',
      async () => {
        const longRunningPool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/longRunningWorkerSoftBehavior.mjs',
            import.meta.url,
          ),
          {
            messageEventErrorHandler: (e) => console.error(e),
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
      },
    )

    await t.step(
      'Verify that a pool with zero worker can be instantiated',
      async () => {
        const pool = new DynamicThreadPool(
          0,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool).toBeInstanceOf(DynamicThreadPool)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await pool.destroy()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})
