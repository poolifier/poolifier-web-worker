import { /* assertSpyCalls, */ returnsNext, stub } from '$std/testing/mock.ts'
import { EventEmitter } from 'node:events'
import { expect } from 'expect'
import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
} from '../../src/mod.ts'
import { waitPoolEvents } from '../test-utils.mjs'
import { version } from '../../src/pools/version.ts'
import { DEFAULT_TASK_NAME } from '../../src/utils.ts'
import { CircularArray } from '../../src/circular-array.ts'
import { WorkerNode } from '../../src/pools/worker-node.ts'
import { Deque } from '../../src/deque.ts'

Deno.test({
  name: 'Abstract pool test suite',
  fn: async (t) => {
    const numberOfWorkers = 2
    class StubPoolWithIsMain extends FixedThreadPool {
      isMain() {
        return false
      }
    }

    await t.step('Verify that pool can be created and destroyed', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      expect(pool).toBeInstanceOf(FixedThreadPool)
      await pool.destroy()
    })

    await t.step(
      'Verify that pool cannot be created from a non main thread/process',
      () => {
        expect(
          () =>
            new StubPoolWithIsMain(
              numberOfWorkers,
              './tests/worker-files/thread/testWorker.mjs',
            ),
        ).toThrow(
          new Error(
            'Cannot start a pool from a worker with the same type as the pool',
          ),
        )
      },
    )

    await t.step('Verify that pool statuses properties are set', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      expect(pool.started).toBe(true)
      expect(pool.starting).toBe(false)
      expect(pool.destroying).toBe(false)
      await pool.destroy()
    })

    await t.step('Verify that fileURL is checked', () => {
      expect(() => new FixedThreadPool(numberOfWorkers)).toThrow(
        new TypeError(
          'The worker URL must be specified',
        ),
      )
      expect(() => new FixedThreadPool(numberOfWorkers, 0)).toThrow(
        new TypeError('The worker URL must be an instance of URL'),
      )
      const dummyWorkerURL = new URL('./dummyWorker.ts', import.meta.url)
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            dummyWorkerURL,
          ),
      ).toThrow(new Error(`Cannot find the worker URL '${dummyWorkerURL}'`))
    })

    await t.step('Verify that numberOfWorkers is checked', () => {
      expect(
        () =>
          new FixedThreadPool(
            undefined,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
          ),
      ).toThrow(
        new Error(
          'Cannot instantiate a pool without specifying the number of workers',
        ),
      )
    })

    await t.step('Verify that a negative number of workers is checked', () => {
      expect(
        () =>
          new FixedThreadPool(
            -1,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
          ),
      ).toThrow(
        new RangeError(
          'Cannot instantiate a pool with a negative number of workers',
        ),
      )
    })

    await t.step(
      'Verify that a non integer number of workers is checked',
      () => {
        expect(
          () =>
            new FixedThreadPool(
              0.25,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new TypeError(
            'Cannot instantiate a pool with a non safe integer number of workers',
          ),
        )
      },
    )

    await t.step(
      'Verify that pool arguments number and pool type are checked',
      () => {
        expect(
          () =>
            new FixedThreadPool(
              numberOfWorkers,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
              undefined,
              numberOfWorkers * 2,
            ),
        ).toThrow(
          new Error(
            'Cannot instantiate a fixed pool with a maximum number of workers specified at initialization',
          ),
        )
      },
    )

    await t.step(
      'Verify that dynamic pool sizing is checked',
      () => {
        expect(
          () =>
            new DynamicThreadPool(
              1,
              undefined,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new TypeError(
            'Cannot instantiate a dynamic pool without specifying the maximum pool size',
          ),
        )
        expect(
          () =>
            new DynamicThreadPool(
              0.5,
              1,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new TypeError(
            'Cannot instantiate a pool with a non safe integer number of workers',
          ),
        )
        expect(
          () =>
            new DynamicThreadPool(
              0,
              0.5,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new TypeError(
            'Cannot instantiate a dynamic pool with a non safe integer maximum pool size',
          ),
        )
        expect(
          () =>
            new DynamicThreadPool(
              2,
              1,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new RangeError(
            'Cannot instantiate a dynamic pool with a maximum pool size inferior to the minimum pool size',
          ),
        )
        expect(
          () =>
            new DynamicThreadPool(
              0,
              0,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new RangeError(
            'Cannot instantiate a dynamic pool with a maximum pool size equal to zero',
          ),
        )
        expect(
          () =>
            new DynamicThreadPool(
              1,
              1,
              new URL(
                './../worker-files/thread/testWorker.mjs',
                import.meta.url,
              ),
            ),
        ).toThrow(
          new RangeError(
            'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead',
          ),
        )
      },
    )

    await t.step('Verify that pool options are checked', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      expect(pool.emitter).toBeInstanceOf(EventEmitter)
      expect(pool.opts).toStrictEqual({
        startWorkers: true,
        enableEvents: true,
        restartWorkerOnError: true,
        enableTasksQueue: false,
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
        retries: pool.info.maxSize +
          Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
        runTime: { median: false },
        waitTime: { median: false },
        elu: { median: false },
        weights: expect.objectContaining({
          0: expect.any(Number),
          [pool.info.maxSize - 1]: expect.any(Number),
        }),
      })
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual(
          {
            retries: pool.info.maxSize +
              Object.keys(workerChoiceStrategy.opts.weights).length,
            runTime: { median: false },
            waitTime: { median: false },
            elu: { median: false },
            weights: expect.objectContaining({
              0: expect.any(Number),
              [pool.info.maxSize - 1]: expect.any(Number),
            }),
          },
        )
      }
      await pool.destroy()
      const testHandler = () => console.info('test handler executed')
      pool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
        {
          workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
          workerChoiceStrategyOptions: {
            runTime: { median: true },
            weights: { 0: 300, 1: 200 },
          },
          enableEvents: false,
          restartWorkerOnError: false,
          enableTasksQueue: true,
          tasksQueueOptions: { concurrency: 2 },
          messageEventHandler: testHandler,
          messageEventErrorHandler: testHandler,
        },
      )
      expect(pool.emitter).toBeUndefined()
      expect(pool.opts).toStrictEqual({
        startWorkers: true,
        enableEvents: false,
        restartWorkerOnError: false,
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 2,
          size: Math.pow(numberOfWorkers, 2),
          taskStealing: true,
          tasksStealingOnBackPressure: true,
          tasksFinishedTimeout: 2000,
        },
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
        workerChoiceStrategyOptions: {
          runTime: { median: true },
          weights: { 0: 300, 1: 200 },
        },
        messageEventHandler: testHandler,
        messageEventErrorHandler: testHandler,
      })
      expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
        retries: pool.info.maxSize +
          Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
        runTime: { median: true },
        waitTime: { median: false },
        elu: { median: false },
        weights: { 0: 300, 1: 200 },
      })
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual({
          retries: pool.info.maxSize +
            Object.keys(workerChoiceStrategy.opts.weights).length,
          runTime: { median: true },
          waitTime: { median: false },
          elu: { median: false },
          weights: { 0: 300, 1: 200 },
        })
      }
      await pool.destroy()
    })

    await t.step('Verify that pool options are validated', () => {
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              workerChoiceStrategy: 'invalidStrategy',
            },
          ),
      ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              workerChoiceStrategyOptions: { weights: {} },
            },
          ),
      ).toThrow(
        new Error(
          'Invalid worker choice strategy options: must have a weight for each worker node',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              workerChoiceStrategyOptions: {
                measurement: 'invalidMeasurement',
              },
            },
          ),
      ).toThrow(
        new Error(
          "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'",
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: 'invalidTasksQueueOptions',
            },
          ),
      ).toThrow(
        new TypeError('Invalid tasks queue options: must be a plain object'),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { concurrency: 0 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks concurrency: 0 is a negative integer or zero',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { concurrency: -1 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks concurrency: -1 is a negative integer or zero',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { concurrency: 0.2 },
            },
          ),
      ).toThrow(
        new TypeError(
          'Invalid worker node tasks concurrency: must be an integer',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { size: 0 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks queue size: 0 is a negative integer or zero',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { size: -1 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks queue size: -1 is a negative integer or zero',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL(
              './../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { size: 0.2 },
            },
          ),
      ).toThrow(
        new TypeError(
          'Invalid worker node tasks queue size: must be an integer',
        ),
      )
    })

    await t.step(
      'Verify that pool worker choice strategy options can be set',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE },
        )
        expect(pool.opts.workerChoiceStrategyOptions).toBeUndefined()
        expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
          retries: pool.info.maxSize +
            Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
          runTime: { median: false },
          waitTime: { median: false },
          elu: { median: false },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
        for (
          const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
            .workerChoiceStrategies
        ) {
          expect(workerChoiceStrategy.opts).toStrictEqual(
            {
              retries: pool.info.maxSize +
                Object.keys(workerChoiceStrategy.opts.weights).length,
              runTime: { median: false },
              waitTime: { median: false },
              elu: { median: false },
              weights: expect.objectContaining({
                0: expect.any(Number),
                [pool.info.maxSize - 1]: expect.any(Number),
              }),
            },
          )
        }
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: true,
            average: true,
            median: false,
          },
        })
        pool.setWorkerChoiceStrategyOptions({
          runTime: { median: true },
          elu: { median: true },
        })
        expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
          runTime: { median: true },
          elu: { median: true },
        })
        expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
          retries: pool.info.maxSize +
            Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
          runTime: { median: true },
          waitTime: { median: false },
          elu: { median: true },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
        for (
          const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
            .workerChoiceStrategies
        ) {
          expect(workerChoiceStrategy.opts).toStrictEqual(
            {
              retries: pool.info.maxSize +
                Object.keys(workerChoiceStrategy.opts.weights).length,
              runTime: { median: true },
              waitTime: { median: false },
              elu: { median: true },
              weights: expect.objectContaining({
                0: expect.any(Number),
                [pool.info.maxSize - 1]: expect.any(Number),
              }),
            },
          )
        }
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: false,
            median: true,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: true,
            average: false,
            median: true,
          },
        })
        pool.setWorkerChoiceStrategyOptions({
          runTime: { median: false },
          elu: { median: false },
        })
        expect(pool.opts.workerChoiceStrategyOptions).toStrictEqual({
          runTime: { median: false },
          elu: { median: false },
        })
        expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
          retries: pool.info.maxSize +
            Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
          runTime: { median: false },
          waitTime: { median: false },
          elu: { median: false },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
        for (
          const [, workerChoiceStrategy] of pool.workerChoiceStrategyContext
            .workerChoiceStrategies
        ) {
          expect(workerChoiceStrategy.opts).toStrictEqual(
            {
              retries: pool.info.maxSize +
                Object.keys(workerChoiceStrategy.opts.weights).length,
              runTime: { median: false },
              waitTime: { median: false },
              elu: { median: false },
              weights: expect.objectContaining({
                0: expect.any(Number),
                [pool.info.maxSize - 1]: expect.any(Number),
              }),
            },
          )
        }
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: true,
            average: true,
            median: false,
          },
        })
        expect(() =>
          pool.setWorkerChoiceStrategyOptions(
            'invalidWorkerChoiceStrategyOptions',
          )
        ).toThrow(
          new TypeError(
            'Invalid worker choice strategy options: must be a plain object',
          ),
        )
        expect(() => pool.setWorkerChoiceStrategyOptions({ weights: {} }))
          .toThrow(
            new Error(
              'Invalid worker choice strategy options: must have a weight for each worker node',
            ),
          )
        expect(() =>
          pool.setWorkerChoiceStrategyOptions({
            measurement: 'invalidMeasurement',
          })
        ).toThrow(
          new Error(
            "Invalid worker choice strategy options: invalid measurement 'invalidMeasurement'",
          ),
        )
        await pool.destroy()
      },
    )

    await t.step(
      'Verify that pool tasks queue can be enabled/disabled',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.opts.enableTasksQueue).toBe(false)
        expect(pool.opts.tasksQueueOptions).toBeUndefined()
        pool.enableTasksQueue(true)
        expect(pool.opts.enableTasksQueue).toBe(true)
        expect(pool.opts.tasksQueueOptions).toStrictEqual({
          concurrency: 1,
          size: Math.pow(numberOfWorkers, 2),
          taskStealing: true,
          tasksStealingOnBackPressure: true,
          tasksFinishedTimeout: 2000,
        })
        pool.enableTasksQueue(true, { concurrency: 2 })
        expect(pool.opts.enableTasksQueue).toBe(true)
        expect(pool.opts.tasksQueueOptions).toStrictEqual({
          concurrency: 2,
          size: Math.pow(numberOfWorkers, 2),
          taskStealing: true,
          tasksStealingOnBackPressure: true,
          tasksFinishedTimeout: 2000,
        })
        pool.enableTasksQueue(false)
        expect(pool.opts.enableTasksQueue).toBe(false)
        expect(pool.opts.tasksQueueOptions).toBeUndefined()
        await pool.destroy()
      },
    )

    await t.step(
      'Verify that pool tasks queue options can be set',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { enableTasksQueue: true },
        )
        expect(pool.opts.tasksQueueOptions).toStrictEqual({
          concurrency: 1,
          size: Math.pow(numberOfWorkers, 2),
          taskStealing: true,
          tasksStealingOnBackPressure: true,
          tasksFinishedTimeout: 2000,
        })
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.tasksQueueBackPressureSize).toBe(
            pool.opts.tasksQueueOptions.size,
          )
        }
        pool.setTasksQueueOptions({
          concurrency: 2,
          size: 2,
          taskStealing: false,
          tasksStealingOnBackPressure: false,
          tasksFinishedTimeout: 3000,
        })
        expect(pool.opts.tasksQueueOptions).toStrictEqual({
          concurrency: 2,
          size: 2,
          taskStealing: false,
          tasksStealingOnBackPressure: false,
          tasksFinishedTimeout: 3000,
        })
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.tasksQueueBackPressureSize).toBe(
            pool.opts.tasksQueueOptions.size,
          )
        }
        pool.setTasksQueueOptions({
          concurrency: 1,
          taskStealing: true,
          tasksStealingOnBackPressure: true,
        })
        expect(pool.opts.tasksQueueOptions).toStrictEqual({
          concurrency: 1,
          size: Math.pow(numberOfWorkers, 2),
          taskStealing: true,
          tasksStealingOnBackPressure: true,
          tasksFinishedTimeout: 2000,
        })
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.tasksQueueBackPressureSize).toBe(
            pool.opts.tasksQueueOptions.size,
          )
        }
        expect(() => pool.setTasksQueueOptions('invalidTasksQueueOptions'))
          .toThrow(
            new TypeError(
              'Invalid tasks queue options: must be a plain object',
            ),
          )
        expect(() => pool.setTasksQueueOptions({ concurrency: 0 })).toThrow(
          new RangeError(
            'Invalid worker node tasks concurrency: 0 is a negative integer or zero',
          ),
        )
        expect(() => pool.setTasksQueueOptions({ concurrency: -1 })).toThrow(
          new RangeError(
            'Invalid worker node tasks concurrency: -1 is a negative integer or zero',
          ),
        )
        expect(() => pool.setTasksQueueOptions({ concurrency: 0.2 })).toThrow(
          new TypeError(
            'Invalid worker node tasks concurrency: must be an integer',
          ),
        )
        expect(() => pool.setTasksQueueOptions({ size: 0 })).toThrow(
          new RangeError(
            'Invalid worker node tasks queue size: 0 is a negative integer or zero',
          ),
        )
        expect(() => pool.setTasksQueueOptions({ size: -1 })).toThrow(
          new RangeError(
            'Invalid worker node tasks queue size: -1 is a negative integer or zero',
          ),
        )
        expect(() => pool.setTasksQueueOptions({ size: 0.2 })).toThrow(
          new TypeError(
            'Invalid worker node tasks queue size: must be an integer',
          ),
        )
        await pool.destroy()
      },
    )

    await t.step('Verify that pool info is set', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      expect(pool.info).toStrictEqual({
        version,
        type: PoolTypes.fixed,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        strategy: WorkerChoiceStrategies.ROUND_ROBIN,
        minSize: numberOfWorkers,
        maxSize: numberOfWorkers,
        workerNodes: numberOfWorkers,
        idleWorkerNodes: numberOfWorkers,
        busyWorkerNodes: 0,
        executedTasks: 0,
        executingTasks: 0,
        failedTasks: 0,
      })
      await pool.destroy()
      pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      expect(pool.info).toStrictEqual({
        version,
        type: PoolTypes.dynamic,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        strategy: WorkerChoiceStrategies.ROUND_ROBIN,
        minSize: Math.floor(numberOfWorkers / 2),
        maxSize: numberOfWorkers,
        workerNodes: Math.floor(numberOfWorkers / 2),
        idleWorkerNodes: Math.floor(numberOfWorkers / 2),
        busyWorkerNodes: 0,
        executedTasks: 0,
        executingTasks: 0,
        failedTasks: 0,
      })
      await pool.destroy()
    })

    await t.step(
      'Verify that pool worker tasks usage are initialized',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        for (const workerNode of pool.workerNodes) {
          expect(workerNode).toBeInstanceOf(WorkerNode)
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: 0,
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: new CircularArray(),
            },
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
        }
        await pool.destroy()
      },
    )

    await t.step(
      'Verify that pool worker tasks queue are initialized',
      async () => {
        let pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        for (const workerNode of pool.workerNodes) {
          expect(workerNode).toBeInstanceOf(WorkerNode)
          expect(workerNode.tasksQueue).toBeInstanceOf(Deque)
          expect(workerNode.tasksQueue.size).toBe(0)
          expect(workerNode.tasksQueue.maxSize).toBe(0)
        }
        await pool.destroy()
        pool = new DynamicThreadPool(
          Math.floor(numberOfWorkers / 2),
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        for (const workerNode of pool.workerNodes) {
          expect(workerNode).toBeInstanceOf(WorkerNode)
          expect(workerNode.tasksQueue).toBeInstanceOf(Deque)
          expect(workerNode.tasksQueue.size).toBe(0)
          expect(workerNode.tasksQueue.maxSize).toBe(0)
        }
        await pool.destroy()
      },
    )

    await t.step('Verify that pool worker info are initialized', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
        expect(workerNode.info).toStrictEqual({
          id: expect.any(String),
          type: WorkerTypes.web,
          dynamic: false,
          ready: true,
          stealing: false,
        })
      }
      await pool.destroy()
      pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
        expect(workerNode.info).toStrictEqual({
          id: expect.any(String),
          type: WorkerTypes.web,
          dynamic: false,
          ready: true,
          stealing: false,
        })
      }
      await pool.destroy()
    })

    await t.step(
      'Verify that pool statuses are checked at start or destroy',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.info.started).toBe(true)
        expect(pool.info.ready).toBe(true)
        expect(() => pool.start()).toThrow(
          new Error('Cannot start an already started pool'),
        )
        await pool.destroy()
        expect(pool.info.started).toBe(false)
        expect(pool.info.ready).toBe(false)
        await expect(pool.destroy()).rejects.toThrow(
          new Error('Cannot destroy an already destroyed pool'),
        )
      },
    )

    await t.step(
      'Verify that pool can be started after initialization',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            startWorkers: false,
          },
        )
        expect(pool.info.started).toBe(false)
        expect(pool.info.ready).toBe(false)
        expect(pool.readyEventEmitted).toBe(false)
        expect(pool.workerNodes).toStrictEqual([])
        await expect(pool.execute()).rejects.toThrow(
          new Error('Cannot execute a task on not started pool'),
        )
        pool.start()
        expect(pool.info.started).toBe(true)
        expect(pool.info.ready).toBe(true)
        await waitPoolEvents(pool, PoolEvents.ready, 1)
        expect(pool.readyEventEmitted).toBe(true)
        expect(pool.workerNodes.length).toBe(numberOfWorkers)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode).toBeInstanceOf(WorkerNode)
        }
        await pool.destroy()
      },
    )

    await t.step(
      'Verify that pool execute() arguments are checked',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        await expect(pool.execute(undefined, 0)).rejects.toThrow(
          new TypeError('name argument must be a string'),
        )
        await expect(pool.execute(undefined, '')).rejects.toThrow(
          new TypeError('name argument must not be an empty string'),
        )
        await expect(pool.execute(undefined, undefined, {})).rejects.toThrow(
          new TypeError('transferList argument must be an array'),
        )
        await expect(pool.execute(undefined, 'unknown')).rejects.toBe(
          "Task function 'unknown' not found",
        )
        await pool.destroy()
        await expect(pool.execute()).rejects.toThrow(
          new Error('Cannot execute a task on not started pool'),
        )
      },
    )

    await t.step(
      'Verify that pool worker tasks usage are computed',
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: 0,
              executing: maxMultiplier,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: expect.any(CircularArray),
            },
            waitTime: {
              history: expect.any(CircularArray),
            },
            elu: {
              idle: {
                history: expect.any(CircularArray),
              },
              active: {
                history: expect.any(CircularArray),
              },
            },
          })
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: maxMultiplier,
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: expect.any(CircularArray),
            },
            waitTime: {
              history: expect.any(CircularArray),
            },
            elu: {
              idle: {
                history: expect.any(CircularArray),
              },
              active: {
                history: expect.any(CircularArray),
              },
            },
          })
        }
        await pool.destroy()
      },
    )

    await t.step(
      'Verify that pool worker tasks usage are reset at worker choice strategy change',
      async () => {
        const pool = new DynamicThreadPool(
          Math.floor(numberOfWorkers / 2),
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: expect.any(CircularArray),
            },
            waitTime: {
              history: expect.any(CircularArray),
            },
            elu: {
              idle: {
                history: expect.any(CircularArray),
              },
              active: {
                history: expect.any(CircularArray),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            numberOfWorkers * maxMultiplier,
          )
          expect(workerNode.usage.runTime.history.length).toBe(0)
          expect(workerNode.usage.waitTime.history.length).toBe(0)
          expect(workerNode.usage.elu.idle.history.length).toBe(0)
          expect(workerNode.usage.elu.active.history.length).toBe(0)
        }
        pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: 0,
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: expect.any(CircularArray),
            },
            waitTime: {
              history: expect.any(CircularArray),
            },
            elu: {
              idle: {
                history: expect.any(CircularArray),
              },
              active: {
                history: expect.any(CircularArray),
              },
            },
          })
          expect(workerNode.usage.runTime.history.length).toBe(0)
          expect(workerNode.usage.waitTime.history.length).toBe(0)
          expect(workerNode.usage.elu.idle.history.length).toBe(0)
          expect(workerNode.usage.elu.active.history.length).toBe(0)
        }
        await pool.destroy()
      },
    )

    await t.step(
      "Verify that pool event emitter 'ready' event can register a callback",
      async () => {
        const pool = new DynamicThreadPool(
          Math.floor(numberOfWorkers / 2),
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.emitter.eventNames()).toStrictEqual([])
        let poolInfo
        let poolReady = 0
        pool.emitter.on(PoolEvents.ready, (info) => {
          ;++poolReady
          poolInfo = info
        })
        await waitPoolEvents(pool, PoolEvents.ready, 1)
        expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.ready])
        expect(poolReady).toBe(1)
        expect(poolInfo).toStrictEqual({
          version,
          type: PoolTypes.dynamic,
          worker: WorkerTypes.web,
          started: true,
          ready: true,
          strategy: WorkerChoiceStrategies.ROUND_ROBIN,
          minSize: expect.any(Number),
          maxSize: expect.any(Number),
          workerNodes: expect.any(Number),
          idleWorkerNodes: expect.any(Number),
          busyWorkerNodes: expect.any(Number),
          executedTasks: expect.any(Number),
          executingTasks: expect.any(Number),
          failedTasks: expect.any(Number),
        })
        await pool.destroy()
      },
    )

    await t.step(
      "Verify that pool event emitter 'busy' event can register a callback",
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.emitter.eventNames()).toStrictEqual([])
        const promises = new Set()
        let poolBusy = 0
        let poolInfo
        pool.emitter.on(PoolEvents.busy, (info) => {
          ;++poolBusy
          poolInfo = info
        })
        expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.busy])
        for (let i = 0; i < numberOfWorkers * 2; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        // The `busy` event is triggered when the number of submitted tasks at once reach the number of fixed pool workers.
        // So in total numberOfWorkers + 1 times for a loop submitting up to numberOfWorkers * 2 tasks to the fixed pool.
        expect(poolBusy).toBe(numberOfWorkers + 1)
        expect(poolInfo).toStrictEqual({
          version,
          type: PoolTypes.fixed,
          worker: WorkerTypes.web,
          started: true,
          ready: true,
          strategy: WorkerChoiceStrategies.ROUND_ROBIN,
          minSize: expect.any(Number),
          maxSize: expect.any(Number),
          workerNodes: expect.any(Number),
          idleWorkerNodes: expect.any(Number),
          busyWorkerNodes: expect.any(Number),
          executedTasks: expect.any(Number),
          executingTasks: expect.any(Number),
          failedTasks: expect.any(Number),
        })
        await pool.destroy()
      },
    )

    await t.step(
      "Verify that pool event emitter 'full' event can register a callback",
      async () => {
        const pool = new DynamicThreadPool(
          Math.floor(numberOfWorkers / 2),
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.emitter.eventNames()).toStrictEqual([])
        const promises = new Set()
        let poolFull = 0
        let poolInfo
        pool.emitter.on(PoolEvents.full, (info) => {
          ;++poolFull
          poolInfo = info
        })
        expect(pool.emitter.eventNames()).toStrictEqual([PoolEvents.full])
        for (let i = 0; i < numberOfWorkers * 2; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        expect(poolFull).toBe(1)
        expect(poolInfo).toStrictEqual({
          version,
          type: PoolTypes.dynamic,
          worker: WorkerTypes.web,
          started: true,
          ready: true,
          strategy: WorkerChoiceStrategies.ROUND_ROBIN,
          minSize: expect.any(Number),
          maxSize: expect.any(Number),
          workerNodes: expect.any(Number),
          idleWorkerNodes: expect.any(Number),
          busyWorkerNodes: expect.any(Number),
          executedTasks: expect.any(Number),
          executingTasks: expect.any(Number),
          failedTasks: expect.any(Number),
        })
        await pool.destroy()
      },
    )

    await t.step(
      "Verify that pool event emitter 'backPressure' event can register a callback",
      async () => {
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            enableTasksQueue: true,
          },
        )
        stub(
          pool,
          'hasBackPressure',
          returnsNext(Array(10).fill(true)),
        )
        expect(pool.emitter.eventNames()).toStrictEqual([])
        const promises = new Set()
        let poolBackPressure = 0
        let poolInfo
        pool.emitter.on(PoolEvents.backPressure, (info) => {
          ;++poolBackPressure
          poolInfo = info
        })
        expect(pool.emitter.eventNames()).toStrictEqual([
          PoolEvents.backPressure,
        ])
        for (let i = 0; i < numberOfWorkers + 1; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        expect(poolBackPressure).toBe(1)
        expect(poolInfo).toStrictEqual({
          version,
          type: PoolTypes.fixed,
          worker: WorkerTypes.web,
          started: true,
          ready: true,
          strategy: WorkerChoiceStrategies.ROUND_ROBIN,
          minSize: expect.any(Number),
          maxSize: expect.any(Number),
          workerNodes: expect.any(Number),
          idleWorkerNodes: expect.any(Number),
          stealingWorkerNodes: expect.any(Number),
          busyWorkerNodes: expect.any(Number),
          executedTasks: expect.any(Number),
          executingTasks: expect.any(Number),
          maxQueuedTasks: expect.any(Number),
          queuedTasks: expect.any(Number),
          backPressure: true,
          stolenTasks: expect.any(Number),
          failedTasks: expect.any(Number),
        })
        // FIXME: test for calls count >= 7
        // assertSpyCalls(pool.hasBackPressure, 7)
        pool.hasBackPressure.restore()
        await pool.destroy()
      },
    )

    await t.step(
      'Verify that destroy() waits for queued tasks to finish',
      async () => {
        const tasksFinishedTimeout = 2500
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/asyncWorker.mjs',
            import.meta.url,
          ),
          {
            enableTasksQueue: true,
            tasksQueueOptions: { tasksFinishedTimeout },
          },
        )
        const maxMultiplier = 4
        let tasksFinished = 0
        for (const workerNode of pool.workerNodes) {
          workerNode.addEventListener('taskFinished', () => {
            ;++tasksFinished
          })
        }
        for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
          pool.execute()
        }
        expect(pool.info.queuedTasks).toBeGreaterThan(0)
        const startTime = performance.now()
        await pool.destroy()
        const elapsedTime = performance.now() - startTime
        expect(tasksFinished).toBeLessThanOrEqual(
          numberOfWorkers * maxMultiplier,
        )
        expect(elapsedTime).toBeGreaterThanOrEqual(2000)
        expect(elapsedTime).toBeLessThanOrEqual(tasksFinishedTimeout + 100)
      },
    )

    await t.step(
      'Verify that destroy() waits until the tasks finished timeout is reached',
      async () => {
        const tasksFinishedTimeout = 1000
        const pool = new FixedThreadPool(
          numberOfWorkers,
          new URL(
            './../worker-files/thread/asyncWorker.mjs',
            import.meta.url,
          ),
          {
            enableTasksQueue: true,
            tasksQueueOptions: { tasksFinishedTimeout },
          },
        )
        const maxMultiplier = 4
        let tasksFinished = 0
        for (const workerNode of pool.workerNodes) {
          workerNode.addEventListener('taskFinished', () => {
            ;++tasksFinished
          })
        }
        for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
          pool.execute()
        }
        expect(pool.info.queuedTasks).toBeGreaterThan(0)
        const startTime = performance.now()
        await pool.destroy()
        const elapsedTime = performance.now() - startTime
        expect(tasksFinished).toBe(0)
        expect(elapsedTime).toBeLessThanOrEqual(tasksFinishedTimeout + 100)
      },
    )

    await t.step('Verify that hasTaskFunction() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      expect(dynamicThreadPool.hasTaskFunction(DEFAULT_TASK_NAME)).toBe(true)
      expect(dynamicThreadPool.hasTaskFunction('jsonIntegerSerialization'))
        .toBe(
          true,
        )
      expect(dynamicThreadPool.hasTaskFunction('factorial')).toBe(true)
      expect(dynamicThreadPool.hasTaskFunction('fibonacci')).toBe(true)
      expect(dynamicThreadPool.hasTaskFunction('unknown')).toBe(false)
      await dynamicThreadPool.destroy()
      const fixedClusterPool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
      expect(fixedClusterPool.hasTaskFunction(DEFAULT_TASK_NAME)).toBe(true)
      expect(fixedClusterPool.hasTaskFunction('jsonIntegerSerialization')).toBe(
        true,
      )
      expect(fixedClusterPool.hasTaskFunction('factorial')).toBe(true)
      expect(fixedClusterPool.hasTaskFunction('fibonacci')).toBe(true)
      expect(fixedClusterPool.hasTaskFunction('unknown')).toBe(false)
      await fixedClusterPool.destroy()
    })

    await t.step('Verify that addTaskFunction() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      await expect(
        dynamicThreadPool.addTaskFunction(0, () => {}),
      ).rejects.toThrow(new TypeError('name argument must be a string'))
      await expect(
        dynamicThreadPool.addTaskFunction('', () => {}),
      ).rejects.toThrow(
        new TypeError('name argument must not be an empty string'),
      )
      await expect(dynamicThreadPool.addTaskFunction('test', 0)).rejects
        .toThrow(
          new TypeError('fn argument must be a function'),
        )
      await expect(dynamicThreadPool.addTaskFunction('test', '')).rejects
        .toThrow(
          new TypeError('fn argument must be a function'),
        )
      expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'test',
      ])
      const echoTaskFunction = (data) => {
        return data
      }
      await expect(
        dynamicThreadPool.addTaskFunction('echo', echoTaskFunction),
      ).resolves.toBe(true)
      expect(dynamicThreadPool.taskFunctions.size).toBe(1)
      expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual(
        echoTaskFunction,
      )
      expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'test',
        'echo',
      ])
      const taskFunctionData = { test: 'test' }
      const echoResult = await dynamicThreadPool.execute(
        taskFunctionData,
        'echo',
      )
      expect(echoResult).toStrictEqual(taskFunctionData)
      for (const workerNode of dynamicThreadPool.workerNodes) {
        expect(workerNode.getTaskFunctionWorkerUsage('echo')).toStrictEqual({
          tasks: {
            executed: expect.any(Number),
            executing: 0,
            queued: 0,
            sequentiallyStolen: 0,
            stolen: 0,
            failed: 0,
          },
          runTime: {
            history: new CircularArray(),
          },
          waitTime: {
            history: new CircularArray(),
          },
          elu: {
            idle: {
              history: new CircularArray(),
            },
            active: {
              history: new CircularArray(),
            },
          },
        })
      }
      await dynamicThreadPool.destroy()
    })

    await t.step('Verify that removeTaskFunction() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'test',
      ])
      await expect(dynamicThreadPool.removeTaskFunction('test')).rejects
        .toThrow(
          new Error(
            'Cannot remove a task function not handled on the pool side',
          ),
        )
      const echoTaskFunction = (data) => {
        return data
      }
      await dynamicThreadPool.addTaskFunction('echo', echoTaskFunction)
      expect(dynamicThreadPool.taskFunctions.size).toBe(1)
      expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual(
        echoTaskFunction,
      )
      expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'test',
        'echo',
      ])
      await expect(dynamicThreadPool.removeTaskFunction('echo')).resolves.toBe(
        true,
      )
      expect(dynamicThreadPool.taskFunctions.size).toBe(0)
      expect(dynamicThreadPool.taskFunctions.get('echo')).toBeUndefined()
      expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'test',
      ])
      await dynamicThreadPool.destroy()
    })

    await t.step('Verify that listTaskFunctionNames() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'jsonIntegerSerialization',
        'factorial',
        'fibonacci',
      ])
      await dynamicThreadPool.destroy()
      const fixedClusterPool = new FixedThreadPool(
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(fixedClusterPool, PoolEvents.ready, 1)
      expect(fixedClusterPool.listTaskFunctionNames()).toStrictEqual([
        DEFAULT_TASK_NAME,
        'jsonIntegerSerialization',
        'factorial',
        'fibonacci',
      ])
      await fixedClusterPool.destroy()
    })

    await t.step(
      'Verify that setDefaultTaskFunction() is working',
      async () => {
        const dynamicThreadPool = new DynamicThreadPool(
          Math.floor(numberOfWorkers / 2),
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
            import.meta.url,
          ),
        )
        await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
        const workerId = dynamicThreadPool.workerNodes[0].info.id
        await expect(dynamicThreadPool.setDefaultTaskFunction(0)).rejects
          .toThrow(
            new Error(
              `Task function operation 'default' failed on worker ${workerId} with error: 'TypeError: name parameter is not a string'`,
            ),
          )
        await expect(
          dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME),
        ).rejects.toThrow(
          new Error(
            `Task function operation 'default' failed on worker ${workerId} with error: 'Error: Cannot set the default task function reserved name as the default task function'`,
          ),
        )
        await expect(
          dynamicThreadPool.setDefaultTaskFunction('unknown'),
        ).rejects.toThrow(
          new Error(
            `Task function operation 'default' failed on worker ${workerId} with error: 'Error: Cannot set the default task function to a non-existing task function'`,
          ),
        )
        await expect(dynamicThreadPool.setDefaultTaskFunction(0)).rejects
          .toThrow()
        await expect(
          dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME),
        ).rejects.toThrow()
        await expect(
          dynamicThreadPool.setDefaultTaskFunction('unknown'),
        ).rejects.toThrow()
        expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
          DEFAULT_TASK_NAME,
          'jsonIntegerSerialization',
          'factorial',
          'fibonacci',
        ])
        await expect(
          dynamicThreadPool.setDefaultTaskFunction('factorial'),
        ).resolves.toBe(true)
        expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
          DEFAULT_TASK_NAME,
          'factorial',
          'jsonIntegerSerialization',
          'fibonacci',
        ])
        await expect(
          dynamicThreadPool.setDefaultTaskFunction('fibonacci'),
        ).resolves.toBe(true)
        expect(dynamicThreadPool.listTaskFunctionNames()).toStrictEqual([
          DEFAULT_TASK_NAME,
          'fibonacci',
          'jsonIntegerSerialization',
          'factorial',
        ])
        await dynamicThreadPool.destroy()
      },
    )

    await t.step(
      'Verify that multiple task functions worker is working',
      async () => {
        const pool = new DynamicThreadPool(
          Math.floor(numberOfWorkers / 2),
          numberOfWorkers,
          new URL(
            './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
            import.meta.url,
          ),
        )
        const data = { n: 10 }
        const result0 = await pool.execute(data)
        expect(result0).toStrictEqual({ ok: 1 })
        const result1 = await pool.execute(data, 'jsonIntegerSerialization')
        expect(result1).toStrictEqual({ ok: 1 })
        const result2 = await pool.execute(data, 'factorial')
        expect(result2).toBe(3628800)
        const result3 = await pool.execute(data, 'fibonacci')
        expect(result3).toBe(55)
        expect(pool.info.executingTasks).toBe(0)
        expect(pool.info.executedTasks).toBe(4)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.info.taskFunctionNames).toStrictEqual([
            DEFAULT_TASK_NAME,
            'jsonIntegerSerialization',
            'factorial',
            'fibonacci',
          ])
          expect(workerNode.taskFunctionsUsage.size).toBe(3)
          for (const name of pool.listTaskFunctionNames()) {
            expect(workerNode.getTaskFunctionWorkerUsage(name)).toStrictEqual({
              tasks: {
                executed: expect.any(Number),
                executing: 0,
                failed: 0,
                queued: 0,
                sequentiallyStolen: 0,
                stolen: 0,
              },
              runTime: {
                history: expect.any(CircularArray),
              },
              waitTime: {
                history: expect.any(CircularArray),
              },
              elu: {
                idle: {
                  history: expect.any(CircularArray),
                },
                active: {
                  history: expect.any(CircularArray),
                },
              },
            })
            expect(
              workerNode.getTaskFunctionWorkerUsage(name).tasks.executed,
            ).toBeGreaterThan(0)
          }
          expect(
            workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME),
          ).toStrictEqual(
            workerNode.getTaskFunctionWorkerUsage(
              workerNode.info.taskFunctionNames[1],
            ),
          )
        }
        await pool.destroy()
      },
    )

    await t.step('Verify sendKillMessageToWorker()', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      const workerNodeKey = 0
      await expect(
        pool.sendKillMessageToWorker(workerNodeKey),
      ).resolves.toBeUndefined()
      await expect(
        pool.sendKillMessageToWorker(numberOfWorkers),
      ).resolves.toBeUndefined()
      pool.destroy()
    })

    await t.step('Verify sendTaskFunctionOperationToWorker()', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      const workerNodeKey = 0
      await expect(
        pool.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunctionOperation: 'add',
          taskFunctionName: 'empty',
          taskFunction: (() => {}).toString(),
        }),
      ).resolves.toBe(true)
      expect(
        pool.workerNodes[workerNodeKey].info.taskFunctionNames,
      ).toStrictEqual([DEFAULT_TASK_NAME, 'test', 'empty'])
      await pool.destroy()
    })

    await t.step('Verify sendTaskFunctionOperationToWorkers()', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testWorker.mjs',
          import.meta.url,
        ),
      )
      await expect(
        pool.sendTaskFunctionOperationToWorkers({
          taskFunctionOperation: 'add',
          taskFunctionName: 'empty',
          taskFunction: (() => {}).toString(),
        }),
      ).resolves.toBe(true)
      for (const workerNode of pool.workerNodes) {
        expect(workerNode.info.taskFunctionNames).toStrictEqual([
          DEFAULT_TASK_NAME,
          'test',
          'empty',
        ])
      }
      await pool.destroy()
    })
  },
  sanitizeResources: false,
  sanitizeOps: false,
})
