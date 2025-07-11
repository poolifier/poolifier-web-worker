import { expect } from '@std/expect'
import { after, before, describe, it } from '@std/testing/bdd'
import { FixedThreadPool, PoolEvents } from '../../../src/mod.ts'
import { DEFAULT_TASK_NAME } from '../../../src/utils.ts'
import { TaskFunctions } from '../../test-types.mjs'
import { waitWorkerNodeEvents } from '../../test-utils.mjs'

describe({
  name: 'Fixed thread pool test suite',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const numberOfThreads = 6
    const tasksConcurrency = 2
    let pool,
      queuePool,
      emptyPool,
      echoPool,
      errorPool,
      asyncErrorPool,
      asyncPool

    before(() => {
      pool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        {
          errorEventHandler: (e) => console.error(e),
        },
      )
      queuePool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: tasksConcurrency,
          },
          errorEventHandler: (e) => console.error(e),
        },
      )
      emptyPool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/emptyWorker.mjs', import.meta.url),
      )
      echoPool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/echoWorker.mjs', import.meta.url),
      )
      errorPool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/errorWorker.mjs', import.meta.url),
        {
          errorEventHandler: (e) => console.error(e),
        },
      )
      asyncErrorPool = new FixedThreadPool(
        numberOfThreads,
        new URL(
          './../../worker-files/thread/asyncErrorWorker.mjs',
          import.meta.url,
        ),
        {
          errorEventHandler: (e) => console.error(e),
        },
      )
      asyncPool = new FixedThreadPool(
        numberOfThreads,
        new URL('./../../worker-files/thread/asyncWorker.mjs', import.meta.url),
      )
    })

    after(async () => {
      // We need to clean up the resources after our tests
      await echoPool.destroy()
      await asyncPool.destroy()
      await errorPool.destroy()
      await asyncErrorPool.destroy()
      await emptyPool.destroy()
      await queuePool.destroy()
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

    it('Verify that is possible to invoke the execute() method without input', async () => {
      const result = await pool.execute()
      expect(result).toStrictEqual({ ok: 1 })
    })

    it('Verify that tasks queuing is working', async () => {
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

    it('Verify that is possible to have a worker that return undefined', async () => {
      const result = await emptyPool.execute()
      expect(result).toBeUndefined()
    })

    it('Verify that data are sent to the worker correctly', async () => {
      const data = { f: 10 }
      const result = await echoPool.execute(data)
      expect(result).toStrictEqual(data)
    })

    it('Verify that transferable objects are sent to the worker correctly', async () => {
      let error
      let result
      try {
        result = await pool.execute(undefined, undefined, undefined, [
          new ArrayBuffer(16),
          new MessageChannel().port1,
        ])
      } catch (e) {
        error = e
      }
      expect(result).toStrictEqual({ ok: 1 })
      expect(error).toBeUndefined()
      try {
        result = await pool.execute(undefined, undefined, undefined, [
          new SharedArrayBuffer(16),
        ])
      } catch (e) {
        error = e
      }
      expect(result).toStrictEqual({ ok: 1 })
      expect(error).toBeInstanceOf(Error)
    })

    it('Verify that error handling is working properly:sync', async () => {
      const data = { f: 10 }
      let taskError
      errorPool.eventTarget.addEventListener(PoolEvents.taskError, (event) => {
        taskError = event.error
      })
      let inError
      try {
        await errorPool.execute(data)
      } catch (e) {
        inError = e
      }
      expect(inError).toBeInstanceOf(Error)
      expect(inError.message).toStrictEqual('Error Message from ThreadWorker')
      expect(taskError).toStrictEqual({
        aborted: false,
        data,
        error: inError,
        name: DEFAULT_TASK_NAME,
      })
      expect(
        errorPool.workerNodes.some(
          (workerNode) => workerNode.usage.tasks.failed === 1,
        ),
      ).toBe(true)
    })

    it('Verify that error handling is working properly:async', async () => {
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
      expect(inError).toBeInstanceOf(Error)
      expect(inError.message).toStrictEqual(
        'Error Message from ThreadWorker:async',
      )
      expect(taskError).toStrictEqual({
        aborted: false,
        data,
        error: inError,
        name: DEFAULT_TASK_NAME,
      })
      expect(
        asyncErrorPool.workerNodes.some(
          (workerNode) => workerNode.usage.tasks.failed === 1,
        ),
      ).toBe(true)
    })

    it('Verify that task can be aborted', async () => {
      let error

      try {
        await asyncErrorPool.execute({}, 'default', AbortSignal.timeout(500))
      } catch (e) {
        error = e
      }
      expect(error).toBeInstanceOf(Error)
      expect(error.name).toBe('TimeoutError')
      expect(error.message).toBe('Signal timed out.')
      expect(error.stack).toBeDefined()

      const abortController = new AbortController()
      setTimeout(() => {
        abortController.abort(new Error('Task aborted'))
      }, 500)
      try {
        await asyncErrorPool.execute({}, 'default', abortController.signal)
      } catch (e) {
        error = e
      }
      expect(error).toBeInstanceOf(Error)
      expect(error.message).toBe('Task aborted')
      expect(error.stack).toBeDefined()
    })

    it('Verify that async function is working properly', async () => {
      const data = { f: 10 }
      const startTime = performance.now()
      const result = await asyncPool.execute(data)
      const usedTime = performance.now() - startTime
      expect(result).toStrictEqual(data)
      expect(usedTime).toBeGreaterThanOrEqual(2000)
    })

    it('Shutdown test', async () => {
      const exitPromise = waitWorkerNodeEvents(pool, 'exit', numberOfThreads)
      let poolDestroy = 0
      pool.eventTarget.addEventListener(PoolEvents.destroy, () => ++poolDestroy)
      await pool.destroy()
      const exitEvents = await exitPromise
      expect(pool.info.started).toBe(false)
      expect(pool.info.ready).toBe(false)
      expect(pool.readyEventEmitted).toBe(false)
      expect(pool.busyEventEmitted).toBe(false)
      expect(pool.backPressureEventEmitted).toBe(false)
      expect(pool.workerNodes.length).toBe(0)
      expect(exitEvents).toBe(numberOfThreads)
      expect(poolDestroy).toBe(1)
    })

    it('Verify that thread pool options are checked', async () => {
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

    it('Verify destroyWorkerNode()', async () => {
      const workerFilePath = './../../worker-files/thread/testWorker.mjs'
      const pool = new FixedThreadPool(
        numberOfThreads,
        new URL(workerFilePath, import.meta.url),
      )
      const workerNodeKey = 0
      let exitEvent = 0
      pool.workerNodes[workerNodeKey].addEventListener('exit', () => {
        ++exitEvent
      })
      await expect(
        pool.destroyWorkerNode(workerNodeKey),
      ).resolves.toBeUndefined()
      expect(exitEvent).toBe(1)
      // Simulates an illegitimate worker node destroy and the minimum number of worker nodes is guaranteed
      expect(pool.workerNodes.length).toBe(numberOfThreads)
      await pool.destroy()
    })

    it('Verify that a pool with zero worker fails', () => {
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
  },
})
