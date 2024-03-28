import { expect } from 'expect'
import { FixedThreadPool, PoolEvents } from '../../../src/mod.ts'
import { TaskFunctions } from '../../test-types.mjs'
import { waitPoolEvents, waitWorkerNodeEvents } from '../../test-utils.mjs'
import { DEFAULT_TASK_NAME } from '../../../src/utils.ts'

Deno.test({
  name: 'Fixed thread pool test suite',
  fn: async (t) => {
    const numberOfThreads = 6
    const tasksConcurrency = 2
    const pool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
      {
        messageEventErrorHandler: (e) => console.error(e),
      },
    )
    const queuePool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
      {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: tasksConcurrency,
        },
        messageEventErrorHandler: (e) => console.error(e),
      },
    )
    const emptyPool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/emptyWorker.mjs', import.meta.url),
    )
    const echoPool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/echoWorker.mjs', import.meta.url),
    )
    const errorPool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/errorWorker.mjs', import.meta.url),
      {
        messageEventErrorHandler: (e) => console.error(e),
      },
    )
    const asyncErrorPool = new FixedThreadPool(
      numberOfThreads,
      new URL(
        './../../worker-files/thread/asyncErrorWorker.mjs',
        import.meta.url,
      ),
      {
        messageEventErrorHandler: (e) => console.error(e),
      },
    )
    const asyncPool = new FixedThreadPool(
      numberOfThreads,
      new URL('./../../worker-files/thread/asyncWorker.mjs', import.meta.url),
    )

    await t.step(
      'Verify that the function is executed in a worker thread',
      async () => {
        let result = await pool.execute({
          function: TaskFunctions.fibonacci,
        })
        expect(result).toBe(354224848179261915075n)
        result = await pool.execute({
          function: TaskFunctions.factorial,
        })
        expect(result).toBe(
          93326215443944152681699238856266700490715968264381621468592963895217599993229915608941463976156518286253697920827223758251185210916864000000000000000000000000n,
        )
      },
    )

    await t.step(
      'Verify that is possible to invoke the execute() method without input',
      async () => {
        const result = await pool.execute()
        expect(result).toStrictEqual({ ok: 1 })
      },
    )

    await t.step("Verify that 'ready' event is emitted", async () => {
      const pool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        {
          messageEventErrorHandler: (e) => console.error(e),
        },
      )
      let poolReady = 0
      pool.eventTarget.addEventListener(PoolEvents.ready, () => ++poolReady)
      await waitPoolEvents(pool, PoolEvents.ready, 1)
      expect(poolReady).toBe(1)
      await pool.destroy()
    })

    await t.step("Verify that 'busy' event is emitted", async () => {
      const promises = new Set()
      let poolBusy = 0
      pool.eventTarget.addEventListener(PoolEvents.busy, () => ++poolBusy)
      for (let i = 0; i < numberOfThreads * 2; i++) {
        promises.add(pool.execute())
      }
      await Promise.all(promises)
      // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
      // So in total numberOfThreads + 1 times for a loop submitting up to numberOfThreads * 2 tasks to the fixed pool.
      expect(poolBusy).toBe(numberOfThreads + 1)
    })

    await t.step('Verify that tasks queuing is working', async () => {
      const promises = new Set()
      const maxMultiplier = 3 // Must be greater than tasksConcurrency
      for (let i = 0; i < numberOfThreads * maxMultiplier; i++) {
        promises.add(queuePool.execute())
      }
      expect(promises.size).toBe(numberOfThreads * maxMultiplier)
      for (const workerNode of queuePool.workerNodes) {
        expect(workerNode.usage.tasks.executing).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
          queuePool.opts.tasksQueueOptions.concurrency,
        )
        expect(workerNode.usage.tasks.executed).toBe(0)
        expect(workerNode.usage.tasks.queued).toBe(
          maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency,
        )
        expect(workerNode.usage.tasks.maxQueued).toBe(
          maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency,
        )
        expect(workerNode.usage.tasks.sequentiallyStolen).toBe(0)
        expect(workerNode.usage.tasks.stolen).toBe(0)
      }
      expect(queuePool.info.executedTasks).toBe(0)
      expect(queuePool.info.executingTasks).toBe(
        numberOfThreads * queuePool.opts.tasksQueueOptions.concurrency,
      )
      expect(queuePool.info.queuedTasks).toBe(
        numberOfThreads *
          (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency),
      )
      expect(queuePool.info.maxQueuedTasks).toBe(
        numberOfThreads *
          (maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency),
      )
      expect(queuePool.info.backPressure).toBe(false)
      expect(queuePool.info.stolenTasks).toBe(0)
      await Promise.all(promises)
      for (const workerNode of queuePool.workerNodes) {
        expect(workerNode.usage.tasks.executing).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.tasks.executing).toBeLessThanOrEqual(
          numberOfThreads * maxMultiplier,
        )
        expect(workerNode.usage.tasks.executed).toBe(maxMultiplier)
        expect(workerNode.usage.tasks.queued).toBe(0)
        expect(workerNode.usage.tasks.maxQueued).toBe(
          maxMultiplier - queuePool.opts.tasksQueueOptions.concurrency,
        )
        expect(
          workerNode.usage.tasks.sequentiallyStolen,
        ).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.tasks.sequentiallyStolen).toBeLessThanOrEqual(
          numberOfThreads * maxMultiplier,
        )
        expect(workerNode.usage.tasks.stolen).toBeGreaterThanOrEqual(0)
        expect(workerNode.usage.tasks.stolen).toBeLessThanOrEqual(
          numberOfThreads * maxMultiplier,
        )
      }
      expect(queuePool.info.executedTasks).toBe(numberOfThreads * maxMultiplier)
      expect(queuePool.info.backPressure).toBe(false)
      expect(queuePool.info.stolenTasks).toBeGreaterThanOrEqual(0)
      expect(queuePool.info.stolenTasks).toBeLessThanOrEqual(
        numberOfThreads * maxMultiplier,
      )
    })

    await t.step(
      'Verify that is possible to have a worker that return undefined',
      async () => {
        const result = await emptyPool.execute()
        expect(result).toBeUndefined()
      },
    )

    await t.step(
      'Verify that data are sent to the worker correctly',
      async () => {
        const data = { f: 10 }
        const result = await echoPool.execute(data)
        expect(result).toStrictEqual(data)
      },
    )

    await t.step(
      'Verify that transferable objects are sent to the worker correctly',
      async () => {
        let error
        let result
        try {
          result = await pool.execute(undefined, undefined, [
            new ArrayBuffer(16),
            new MessageChannel().port1,
          ])
        } catch (e) {
          error = e
        }
        expect(result).toStrictEqual({ ok: 1 })
        expect(error).toBeUndefined()
        try {
          result = await pool.execute(undefined, undefined, [
            new SharedArrayBuffer(16),
          ])
        } catch (e) {
          error = e
        }
        expect(result).toStrictEqual({ ok: 1 })
        expect(error).toBeInstanceOf(Error)
      },
    )

    await t.step(
      'Verify that error handling is working properly:sync',
      async () => {
        const data = { f: 10 }
        let taskError
        errorPool.eventTarget.addEventListener(
          PoolEvents.taskError,
          (event) => {
            taskError = event.error
          },
        )
        let inError
        try {
          await errorPool.execute(data)
        } catch (e) {
          inError = e
        }
        expect(inError).toBeDefined()
        expect(inError).toBeInstanceOf(Error)
        expect(inError.message).toBeDefined()
        expect(typeof inError.message === 'string').toBe(true)
        expect(inError.message).toBe('Error Message from ThreadWorker')
        expect(taskError).toStrictEqual({
          name: DEFAULT_TASK_NAME,
          message: new Error('Error Message from ThreadWorker'),
          data,
        })
        expect(
          errorPool.workerNodes.some(
            (workerNode) => workerNode.usage.tasks.failed === 1,
          ),
        ).toBe(true)
      },
    )

    await t.step(
      'Verify that error handling is working properly:async',
      async () => {
        const data = { f: 10 }
        let taskError
        asyncErrorPool.eventTarget.addEventListener(
          PoolEvents.taskError,
          (event) => {
            taskError = event.error
          },
        )
        let inError
        try {
          await asyncErrorPool.execute(data)
        } catch (e) {
          inError = e
        }
        expect(inError).toBeDefined()
        expect(inError).toBeInstanceOf(Error)
        expect(inError.message).toBeDefined()
        expect(typeof inError.message === 'string').toBe(true)
        expect(inError.message).toBe('Error Message from ThreadWorker:async')
        expect(taskError).toStrictEqual({
          name: DEFAULT_TASK_NAME,
          message: new Error('Error Message from ThreadWorker:async'),
          data,
        })
        expect(
          asyncErrorPool.workerNodes.some(
            (workerNode) => workerNode.usage.tasks.failed === 1,
          ),
        ).toBe(true)
      },
    )

    await t.step('Verify that async function is working properly', async () => {
      const data = { f: 10 }
      const startTime = performance.now()
      const result = await asyncPool.execute(data)
      const usedTime = performance.now() - startTime
      expect(result).toStrictEqual(data)
      expect(usedTime).toBeGreaterThanOrEqual(2000)
    })

    await t.step('Shutdown test', async () => {
      const exitPromise = waitWorkerNodeEvents(pool, 'exit', numberOfThreads)
      let poolDestroy = 0
      pool.eventTarget.addEventListener(PoolEvents.destroy, () => ++poolDestroy)
      await pool.destroy()
      const numberOfExitEvents = await exitPromise
      expect(pool.started).toBe(false)
      expect(pool.readyEventEmitted).toBe(false)
      expect(pool.workerNodes.length).toBeLessThan(numberOfThreads)
      expect(numberOfExitEvents).toBe(numberOfThreads)
      expect(poolDestroy).toBe(1)
    })

    await t.step('Verify that thread pool options are checked', async () => {
      const workerFilePath = './../../worker-files/thread/testWorker.mjs'
      let pool = new FixedThreadPool(
        numberOfThreads,
        new URL(workerFilePath, import.meta.url),
      )
      expect(pool.opts.workerOptions).toBeUndefined()
      await pool.destroy()
      pool = new FixedThreadPool(
        numberOfThreads,
        new URL(workerFilePath, import.meta.url),
        {
          workerOptions: {
            name: 'test',
          },
        },
      )
      expect(pool.opts.workerOptions).toStrictEqual({
        name: 'test',
      })
      await pool.destroy()
    })

    await t.step('Should work even without opts in input', async () => {
      const workerFilePath = './../../worker-files/thread/testWorker.mjs'
      const pool = new FixedThreadPool(
        numberOfThreads,
        new URL(workerFilePath, import.meta.url),
      )
      const res = await pool.execute()
      expect(res).toStrictEqual({ ok: 1 })
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    await t.step('Verify destroyWorkerNode()', async () => {
      const workerFilePath = './../../worker-files/thread/testWorker.mjs'
      const pool = new FixedThreadPool(
        numberOfThreads,
        new URL(workerFilePath, import.meta.url),
      )
      const workerNodeKey = 0
      let exitEvent = 0
      pool.workerNodes[workerNodeKey].addEventListener('exit', () => {
        ;++exitEvent
      })
      await expect(
        pool.destroyWorkerNode(workerNodeKey),
      ).resolves.toBeUndefined()
      expect(exitEvent).toBe(1)
      expect(pool.workerNodes.length).toBe(numberOfThreads - 1)
      await pool.destroy()
    })

    await t.step('Verify that a pool with zero worker fails', () => {
      expect(
        () =>
          new FixedThreadPool(
            0,
            new URL(
              './../../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
          ),
      ).toThrow('Cannot instantiate a fixed pool with zero worker')
    })

    // We need to clean up the resources after our steps
    await echoPool.destroy()
    await asyncPool.destroy()
    await errorPool.destroy()
    await asyncErrorPool.destroy()
    await emptyPool.destroy()
    await queuePool.destroy()
  },
  sanitizeResources: false,
  sanitizeOps: false,
})
