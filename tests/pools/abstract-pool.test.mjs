import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { CircularBuffer } from '../../src/circular-buffer.ts'
import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
  PoolTypes,
  WorkerChoiceStrategies,
  WorkerTypes,
} from '../../src/mod.ts'
import { version } from '../../src/pools/version.ts'
import { WorkerNode } from '../../src/pools/worker-node.ts'
import { PriorityQueue } from '../../src/queues/priority-queue.ts'
import { defaultBucketSize } from '../../src/queues/queue-types.ts'
import { DEFAULT_TASK_NAME } from '../../src/utils.ts'
import { waitPoolEvents } from '../test-utils.mjs'

describe({
  name: 'Abstract pool test suite',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    const numberOfWorkers = 2
    class StubPoolWithIsMain extends FixedThreadPool {
      isMain() {
        return false
      }
    }

    it('Verify that pool can be created and destroyed', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool).toBeInstanceOf(FixedThreadPool)
      await pool.destroy()
    })

    it('Verify that pool cannot be created from a non main thread/process', () => {
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
    })

    it('Verify that pool statuses properties are set', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool.started).toBe(true)
      expect(pool.starting).toBe(false)
      expect(pool.destroying).toBe(false)
      await pool.destroy()
      expect(pool.started).toBe(false)
      expect(pool.starting).toBe(false)
      expect(pool.destroying).toBe(false)
    })

    it('Verify that specifier is checked', () => {
      expect(() => new FixedThreadPool(numberOfWorkers)).toThrow(
        new TypeError('The worker specifier must be defined'),
      )
      expect(() => new FixedThreadPool(numberOfWorkers, 0)).toThrow(
        new TypeError(
          'The worker specifier must be a string or an instance of URL',
        ),
      )
    })

    it('Verify that numberOfWorkers is checked', () => {
      expect(
        () =>
          new FixedThreadPool(
            undefined,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
          ),
      ).toThrow(
        new Error(
          'Cannot instantiate a pool without specifying the number of workers',
        ),
      )
    })

    it('Verify that a negative number of workers is checked', () => {
      expect(
        () =>
          new FixedThreadPool(
            -1,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
          ),
      ).toThrow(
        new RangeError(
          'Cannot instantiate a pool with a negative number of workers',
        ),
      )
    })

    it('Verify that a non integer number of workers is checked', () => {
      expect(
        () =>
          new FixedThreadPool(
            0.25,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
          ),
      ).toThrow(
        new TypeError(
          'Cannot instantiate a pool with a non safe integer number of workers',
        ),
      )
    })

    it('Verify that pool arguments number and pool type are checked', () => {
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            undefined,
            numberOfWorkers * 2,
          ),
      ).toThrow(
        new Error(
          'Cannot instantiate a fixed pool with a maximum number of workers defined at initialization',
        ),
      )
    })

    it('Verify that dynamic pool sizing is checked', () => {
      expect(
        () =>
          new DynamicThreadPool(
            1,
            undefined,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
          ),
      ).toThrow(
        new RangeError(
          'Cannot instantiate a dynamic pool with a minimum pool size equal to the maximum pool size. Use a fixed pool instead',
        ),
      )
    })

    it('Verify that pool options are checked', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool.eventTarget).toBeInstanceOf(EventTarget)
      expect(pool.opts).toStrictEqual({
        startWorkers: true,
        enableEvents: true,
        restartWorkerOnError: true,
        enableTasksQueue: false,
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
      })
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual({
          runTime: { median: false },
          waitTime: { median: false },
          elu: { median: false },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
      }
      await pool.destroy()
      const testHandler = () => console.info('test handler executed')
      pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
          errorEventHandler: testHandler,
        },
      )
      expect(pool.eventTarget).toBeUndefined()
      expect(pool.opts).toStrictEqual({
        startWorkers: true,
        enableEvents: false,
        restartWorkerOnError: false,
        enableTasksQueue: true,
        tasksQueueOptions: {
          agingFactor: 0.001,
          concurrency: 2,
          loadExponent: 0.6666666666666666,
          size: numberOfWorkers ** 2,
          tasksFinishedTimeout: 2000,
          tasksStealingOnBackPressure: true,
          tasksStealingRatio: 0.6,
          taskStealing: true,
        },
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
        workerChoiceStrategyOptions: {
          runTime: { median: true },
          weights: { 0: 300, 1: 200 },
        },
        messageEventHandler: testHandler,
        messageEventErrorHandler: testHandler,
        errorEventHandler: testHandler,
      })
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual({
          runTime: { median: true },
          waitTime: { median: false },
          elu: { median: false },
          weights: { 0: 300, 1: 200 },
        })
      }
      await pool.destroy()
    })

    it('Verify that pool options are validated', () => {
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              workerChoiceStrategy: 'invalidStrategy',
            },
          ),
      ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { tasksStealingRatio: '' },
            },
          ),
      ).toThrow(
        new TypeError(
          'Invalid worker node tasks stealing ratio: must be a number',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { tasksStealingRatio: 1.1 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks stealing ratio: must be between 0 and 1',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { agingFactor: '' },
            },
          ),
      ).toThrow(
        new TypeError(
          'Invalid worker node tasks queue aging factor: must be a number',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { agingFactor: -1 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks queue aging factor: must be greater than or equal to 0',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { loadExponent: '' },
            },
          ),
      ).toThrow(
        new TypeError(
          'Invalid worker node tasks queue load exponent: must be a number',
        ),
      )
      expect(
        () =>
          new FixedThreadPool(
            numberOfWorkers,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              enableTasksQueue: true,
              tasksQueueOptions: { loadExponent: -1 },
            },
          ),
      ).toThrow(
        new RangeError(
          'Invalid worker node tasks queue load exponent: must be greater than 0',
        ),
      )
    })

    it('Verify that pool worker choice strategy options can be set', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE },
      )
      expect(pool.opts.workerChoiceStrategyOptions).toBeUndefined()
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual({
          runTime: { median: false },
          waitTime: { median: false },
          elu: { median: false },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
      }
      expect(
        pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements(),
      ).toStrictEqual({
        runTime: {
          aggregate: true,
          average: true,
          median: false,
        },
        waitTime: {
          aggregate: true,
          average: true,
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
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual({
          runTime: { median: true },
          waitTime: { median: false },
          elu: { median: true },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
      }
      expect(
        pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements(),
      ).toStrictEqual({
        runTime: {
          aggregate: true,
          average: false,
          median: true,
        },
        waitTime: {
          aggregate: true,
          average: true,
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
      for (
        const [, workerChoiceStrategy] of pool.workerChoiceStrategiesContext
          .workerChoiceStrategies
      ) {
        expect(workerChoiceStrategy.opts).toStrictEqual({
          runTime: { median: false },
          waitTime: { median: false },
          elu: { median: false },
          weights: expect.objectContaining({
            0: expect.any(Number),
            [pool.info.maxSize - 1]: expect.any(Number),
          }),
        })
      }
      expect(
        pool.workerChoiceStrategiesContext.getTaskStatisticsRequirements(),
      ).toStrictEqual({
        runTime: {
          aggregate: true,
          average: true,
          median: false,
        },
        waitTime: {
          aggregate: true,
          average: true,
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
    })

    it('Verify that pool tasks queue can be enabled/disabled', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool.opts.enableTasksQueue).toBe(false)
      expect(pool.opts.tasksQueueOptions).toBeUndefined()
      pool.enableTasksQueue(true)
      expect(pool.opts.enableTasksQueue).toBe(true)
      expect(pool.opts.tasksQueueOptions).toStrictEqual({
        agingFactor: 0.001,
        concurrency: 1,
        loadExponent: 0.6666666666666666,
        size: numberOfWorkers ** 2,
        tasksFinishedTimeout: 2000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.6,
        taskStealing: true,
      })
      pool.enableTasksQueue(true, { concurrency: 2 })
      expect(pool.opts.enableTasksQueue).toBe(true)
      expect(pool.opts.tasksQueueOptions).toStrictEqual({
        agingFactor: 0.001,
        concurrency: 2,
        loadExponent: 0.6666666666666666,
        size: numberOfWorkers ** 2,
        tasksFinishedTimeout: 2000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.6,
        taskStealing: true,
      })
      pool.enableTasksQueue(false)
      expect(pool.opts.enableTasksQueue).toBe(false)
      expect(pool.opts.tasksQueueOptions).toBeUndefined()
      await pool.destroy()
    })

    it('Verify that pool tasks queue options can be set', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
        { enableTasksQueue: true },
      )
      expect(pool.opts.tasksQueueOptions).toStrictEqual({
        agingFactor: 0.001,
        concurrency: 1,
        loadExponent: 0.6666666666666666,
        size: numberOfWorkers ** 2,
        tasksFinishedTimeout: 2000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.6,
        taskStealing: true,
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
        tasksStealingRatio: 0.5,
        tasksFinishedTimeout: 3000,
        agingFactor: 0.002,
        loadExponent: 0.5,
      })
      expect(pool.opts.tasksQueueOptions).toStrictEqual({
        agingFactor: 0.002,
        concurrency: 2,
        loadExponent: 0.5,
        size: 2,
        tasksFinishedTimeout: 3000,
        tasksStealingOnBackPressure: false,
        tasksStealingRatio: 0.5,
        taskStealing: false,
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
        tasksStealingRatio: 0.5,
        tasksFinishedTimeout: 3000,
        agingFactor: 0.002,
        loadExponent: 0.5,
      })
      expect(pool.opts.tasksQueueOptions).toStrictEqual({
        concurrency: 2,
        size: 2,
        taskStealing: false,
        tasksStealingOnBackPressure: false,
        tasksStealingRatio: 0.5,
        tasksFinishedTimeout: 3000,
        agingFactor: 0.002,
        loadExponent: 0.5,
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
        agingFactor: 0.002,
        concurrency: 1,
        loadExponent: 0.5,
        size: 2,
        tasksFinishedTimeout: 3000,
        tasksStealingOnBackPressure: true,
        tasksStealingRatio: 0.5,
        taskStealing: true,
      })
      for (const workerNode of pool.workerNodes) {
        expect(workerNode.tasksQueueBackPressureSize).toBe(
          pool.opts.tasksQueueOptions.size,
        )
      }
      expect(() => pool.setTasksQueueOptions('invalidTasksQueueOptions'))
        .toThrow(
          new TypeError('Invalid tasks queue options: must be a plain object'),
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
      expect(() => pool.setTasksQueueOptions({ tasksStealingRatio: '' }))
        .toThrow(
          new TypeError(
            'Invalid worker node tasks stealing ratio: must be a number',
          ),
        )
      expect(() => pool.setTasksQueueOptions({ tasksStealingRatio: 1.1 }))
        .toThrow(
          new RangeError(
            'Invalid worker node tasks stealing ratio: must be between 0 and 1',
          ),
        )
      expect(() => pool.setTasksQueueOptions({ agingFactor: '' })).toThrow(
        new TypeError(
          'Invalid worker node tasks queue aging factor: must be a number',
        ),
      )
      expect(() => pool.setTasksQueueOptions({ agingFactor: -1 })).toThrow(
        new RangeError(
          'Invalid worker node tasks queue aging factor: must be greater than or equal to 0',
        ),
      )
      expect(() => pool.setTasksQueueOptions({ loadExponent: '' })).toThrow(
        new TypeError(
          'Invalid worker node tasks queue load exponent: must be a number',
        ),
      )
      expect(() => pool.setTasksQueueOptions({ loadExponent: 0 })).toThrow(
        new RangeError(
          'Invalid worker node tasks queue load exponent: must be greater than 0',
        ),
      )
      expect(() => pool.setTasksQueueOptions({ loadExponent: -1 })).toThrow(
        new RangeError(
          'Invalid worker node tasks queue load exponent: must be greater than 0',
        ),
      )
      await pool.destroy()
    })

    it('Verify that pool info is set', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool.info).toStrictEqual({
        version,
        type: PoolTypes.fixed,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: 0,
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
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      expect(pool.info).toStrictEqual({
        version,
        type: PoolTypes.dynamic,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: 0,
        minSize: Math.floor(numberOfWorkers / 2),
        maxSize: numberOfWorkers,
        workerNodes: Math.floor(numberOfWorkers / 2),
        dynamicWorkerNodes: 0,
        idleWorkerNodes: Math.floor(numberOfWorkers / 2),
        busyWorkerNodes: 0,
        executedTasks: 0,
        executingTasks: 0,
        failedTasks: 0,
      })
      await pool.destroy()
    })

    it('Verify that pool worker tasks usage are initialized', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            history: expect.any(CircularBuffer),
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
          elu: {
            idle: {
              history: expect.any(CircularBuffer),
            },
            active: {
              history: expect.any(CircularBuffer),
            },
          },
        })
      }
      await pool.destroy()
    })

    it('Verify that pool worker tasks queue are initialized', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
        expect(workerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
        expect(workerNode.tasksQueue.size).toBe(0)
        expect(workerNode.tasksQueue.maxSize).toBe(0)
        expect(workerNode.tasksQueue.bucketSize).toBe(defaultBucketSize)
        expect(workerNode.tasksQueue.enablePriority).toBe(false)
      }
      await pool.destroy()
      pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
        expect(workerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
        expect(workerNode.tasksQueue.size).toBe(0)
        expect(workerNode.tasksQueue.maxSize).toBe(0)
        expect(workerNode.tasksQueue.bucketSize).toBe(defaultBucketSize)
        expect(workerNode.tasksQueue.enablePriority).toBe(false)
      }
      await pool.destroy()
    })

    it('Verify that pool worker info are initialized', async () => {
      let pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
        expect(workerNode.info).toStrictEqual({
          id: expect.any(String),
          type: WorkerTypes.web,
          dynamic: false,
          ready: true,
          stealing: false,
          stolen: false,
          continuousStealing: false,
          backPressureStealing: false,
          backPressure: false,
          queuedTaskAbortion: false,
        })
      }
      await pool.destroy()
      pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
        expect(workerNode.info).toStrictEqual({
          id: expect.any(String),
          type: WorkerTypes.web,
          dynamic: false,
          ready: true,
          stealing: false,
          stolen: false,
          continuousStealing: false,
          backPressureStealing: false,
          backPressure: false,
          queuedTaskAbortion: false,
        })
      }
      await pool.destroy()
    })

    it('Verify that pool statuses are checked at start or destroy', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
    })

    it('Verify that pool can be started after initialization', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
        {
          startWorkers: false,
        },
      )
      expect(pool.info.started).toBe(false)
      expect(pool.info.ready).toBe(false)
      expect(pool.workerNodes).toStrictEqual([])
      expect(pool.readyEventEmitted).toBe(false)
      expect(pool.busyEventEmitted).toBe(false)
      expect(pool.backPressureEventEmitted).toBe(false)
      pool.start()
      expect(pool.info.started).toBe(true)
      expect(pool.info.ready).toBe(true)
      await waitPoolEvents(pool, PoolEvents.ready, 1)
      expect(pool.readyEventEmitted).toBe(true)
      expect(pool.busyEventEmitted).toBe(false)
      expect(pool.backPressureEventEmitted).toBe(false)
      expect(pool.workerNodes.length).toBe(numberOfWorkers)
      for (const workerNode of pool.workerNodes) {
        expect(workerNode).toBeInstanceOf(WorkerNode)
      }
      await pool.destroy()
    })

    it('Verify that pool execute() arguments are checked', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      await expect(pool.execute(undefined, 0)).rejects.toThrow(
        new TypeError('name argument must be a string'),
      )
      await expect(pool.execute(undefined, '')).rejects.toThrow(
        new TypeError('name argument must not be an empty string'),
      )
      await expect(pool.execute(undefined, undefined, {})).rejects.toThrow(
        new TypeError('abortSignal argument must be an AbortSignal'),
      )
      await expect(
        pool.execute(undefined, undefined, new AbortController().signal, {}),
      ).rejects.toThrow(new TypeError('transferList argument must be an array'))
      await expect(pool.execute(undefined, 'unknown')).rejects.toThrow(
        new Error("Task function 'unknown' not found"),
      )
      await pool.destroy()
      await expect(pool.execute()).rejects.toThrow(
        new Error('Cannot execute a task on not started pool'),
      )
    })

    it('Verify that pool worker tasks usage are computed', async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            history: expect.any(CircularBuffer),
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
          elu: {
            idle: {
              history: expect.any(CircularBuffer),
            },
            active: {
              history: expect.any(CircularBuffer),
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
            history: expect.any(CircularBuffer),
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
          elu: {
            idle: {
              history: expect.any(CircularBuffer),
            },
            active: {
              history: expect.any(CircularBuffer),
            },
          },
        })
      }
      await pool.destroy()
    })

    it("Verify that pool worker tasks usage aren't reset at worker choice strategy change", async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
            history: expect.any(CircularBuffer),
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
          elu: {
            idle: {
              history: expect.any(CircularBuffer),
            },
            active: {
              history: expect.any(CircularBuffer),
            },
          },
        })
        expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
        expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
          numberOfWorkers * maxMultiplier,
        )
      }
      pool.setWorkerChoiceStrategy(WorkerChoiceStrategies.FAIR_SHARE)
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
            history: expect.any(CircularBuffer),
          },
          waitTime: {
            history: expect.any(CircularBuffer),
          },
          elu: {
            idle: {
              history: expect.any(CircularBuffer),
            },
            active: {
              history: expect.any(CircularBuffer),
            },
          },
        })
        expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
        expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
          numberOfWorkers * maxMultiplier,
        )
      }
      await pool.destroy()
    })

    it("Verify that pool event target 'ready' event can register a callback", async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      let poolInfo
      let poolReady = 0
      pool.eventTarget.addEventListener(PoolEvents.ready, (event) => {
        ++poolReady
        poolInfo = event.detail
      })
      await waitPoolEvents(pool, PoolEvents.ready, 1)
      expect(poolReady).toBe(1)
      expect(poolInfo).toStrictEqual({
        version,
        type: PoolTypes.dynamic,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: Math.floor(numberOfWorkers / 2),
        maxSize: numberOfWorkers,
        workerNodes: Math.floor(numberOfWorkers / 2),
        dynamicWorkerNodes: 0,
        idleWorkerNodes: Math.floor(numberOfWorkers / 2),
        busyWorkerNodes: 0,
        executedTasks: 0,
        executingTasks: 0,
        failedTasks: 0,
      })
      await pool.destroy()
    })

    it("Verify that pool event target 'busy' and 'busyEnd' events can register a callback", async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      const promises = new Set()
      let poolBusy = 0
      let poolBusyInfo
      pool.eventTarget.addEventListener(PoolEvents.busy, (event) => {
        ++poolBusy
        poolBusyInfo = event.detail
      })
      let poolBusyEnd = 0
      let poolBusyEndInfo
      pool.eventTarget.addEventListener(PoolEvents.busyEnd, (event) => {
        ++poolBusyEnd
        poolBusyEndInfo = event.detail
      })
      for (let i = 0; i < numberOfWorkers * 2; i++) {
        promises.add(pool.execute())
      }
      await Promise.all(promises)
      expect(poolBusy).toBe(1)
      expect(poolBusyInfo).toStrictEqual({
        version,
        type: PoolTypes.fixed,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: numberOfWorkers,
        maxSize: numberOfWorkers,
        workerNodes: numberOfWorkers,
        idleWorkerNodes: 0,
        busyWorkerNodes: numberOfWorkers,
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      expect(poolBusyEnd).toBe(1)
      expect(poolBusyEndInfo).toStrictEqual({
        version,
        type: PoolTypes.fixed,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: numberOfWorkers,
        maxSize: numberOfWorkers,
        workerNodes: numberOfWorkers,
        idleWorkerNodes: expect.any(Number),
        busyWorkerNodes: expect.any(Number),
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      expect(poolBusyEndInfo.busyWorkerNodes).toBeLessThan(numberOfWorkers)
      await pool.destroy()
    })

    it("Verify that pool event target 'full' and 'fullEnd' events can register a callback", async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      const promises = new Set()
      let poolFull = 0
      let poolFullInfo
      pool.eventTarget.addEventListener(PoolEvents.full, (event) => {
        ++poolFull
        poolFullInfo = event.detail
      })
      let poolFullEnd = 0
      let poolFullEndInfo
      pool.eventTarget.addEventListener(PoolEvents.fullEnd, (event) => {
        ++poolFullEnd
        poolFullEndInfo = event.detail
      })
      for (let i = 0; i < numberOfWorkers * 2; i++) {
        promises.add(pool.execute())
      }
      await Promise.all(promises)
      expect(poolFull).toBe(1)
      expect(poolFullInfo).toStrictEqual({
        version,
        type: PoolTypes.dynamic,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: Math.floor(numberOfWorkers / 2),
        maxSize: numberOfWorkers,
        workerNodes: numberOfWorkers,
        dynamicWorkerNodes: Math.floor(numberOfWorkers / 2),
        idleWorkerNodes: expect.any(Number),
        busyWorkerNodes: expect.any(Number),
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      await waitPoolEvents(pool, PoolEvents.fullEnd, 1)
      expect(poolFullEnd).toBe(1)
      expect(poolFullEndInfo).toStrictEqual({
        version,
        type: PoolTypes.dynamic,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: Math.floor(numberOfWorkers / 2),
        maxSize: numberOfWorkers,
        workerNodes: Math.floor(numberOfWorkers / 2),
        dynamicWorkerNodes: 0,
        idleWorkerNodes: expect.any(Number),
        busyWorkerNodes: expect.any(Number),
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      await pool.destroy()
    })

    it("Verify that pool event target 'backPressure' and 'backPressureEnd' events can register a callback", async () => {
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
        {
          enableTasksQueue: true,
        },
      )
      const promises = new Set()
      let poolBackPressure = 0
      let poolBackPressureInfo
      pool.eventTarget.addEventListener(PoolEvents.backPressure, (event) => {
        ++poolBackPressure
        poolBackPressureInfo = event.detail
      })
      let poolBackPressureEnd = 0
      let poolBackPressureEndInfo
      pool.eventTarget.addEventListener(PoolEvents.backPressureEnd, (event) => {
        ++poolBackPressureEnd
        poolBackPressureEndInfo = event.detail
      })
      for (let i = 0; i < numberOfWorkers * 10; i++) {
        promises.add(pool.execute())
      }
      await Promise.all(promises)
      expect(poolBackPressure).toBe(1)
      expect(poolBackPressureInfo).toStrictEqual({
        version,
        type: PoolTypes.fixed,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        backPressure: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: numberOfWorkers,
        maxSize: numberOfWorkers,
        workerNodes: numberOfWorkers,
        idleWorkerNodes: expect.any(Number),
        busyWorkerNodes: expect.any(Number),
        stealingWorkerNodes: expect.any(Number),
        backPressureWorkerNodes: numberOfWorkers,
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        maxQueuedTasks: expect.any(Number),
        queuedTasks: expect.any(Number),
        stolenTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      expect(poolBackPressureEnd).toBe(1)
      expect(poolBackPressureEndInfo).toStrictEqual({
        version,
        type: PoolTypes.fixed,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        backPressure: false,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: numberOfWorkers,
        maxSize: numberOfWorkers,
        workerNodes: numberOfWorkers,
        idleWorkerNodes: expect.any(Number),
        busyWorkerNodes: expect.any(Number),
        stealingWorkerNodes: expect.any(Number),
        backPressureWorkerNodes: expect.any(Number),
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        maxQueuedTasks: expect.any(Number),
        queuedTasks: expect.any(Number),
        stolenTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      expect(poolBackPressureEndInfo.backPressureWorkerNodes).toBeLessThan(
        numberOfWorkers,
      )
      await pool.destroy()
    })

    it("Verify that pool event target 'empty' event can register a callback", async () => {
      const pool = new DynamicThreadPool(
        0,
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      const promises = new Set()
      let poolEmpty = 0
      let poolInfo
      pool.eventTarget.addEventListener(PoolEvents.empty, (event) => {
        ++poolEmpty
        poolInfo = event.detail
      })
      for (let i = 0; i < numberOfWorkers; i++) {
        promises.add(pool.execute())
      }
      await Promise.all(promises)
      await waitPoolEvents(pool, PoolEvents.empty, 1)
      expect(poolEmpty).toBe(1)
      expect(poolInfo).toStrictEqual({
        version,
        type: PoolTypes.dynamic,
        worker: WorkerTypes.web,
        started: true,
        ready: true,
        defaultStrategy: WorkerChoiceStrategies.LEAST_USED,
        strategyRetries: expect.any(Number),
        minSize: 0,
        maxSize: numberOfWorkers,
        workerNodes: 0,
        dynamicWorkerNodes: 0,
        idleWorkerNodes: 0,
        busyWorkerNodes: 0,
        executedTasks: expect.any(Number),
        executingTasks: expect.any(Number),
        failedTasks: expect.any(Number),
      })
      await pool.destroy()
    })

    it('Verify that destroy() waits for queued tasks to finish', async () => {
      const tasksFinishedTimeout = 2500
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/asyncWorker.mjs', import.meta.url),
        {
          enableTasksQueue: true,
          tasksQueueOptions: { tasksFinishedTimeout },
        },
      )
      const maxMultiplier = 4
      let tasksFinished = 0
      for (const workerNode of pool.workerNodes) {
        workerNode.addEventListener('taskFinished', () => {
          ++tasksFinished
        })
      }
      for (let i = 0; i < numberOfWorkers * maxMultiplier; i++) {
        pool.execute()
      }
      expect(pool.info.queuedTasks).toBeGreaterThan(0)
      const startTime = performance.now()
      await pool.destroy()
      const elapsedTime = performance.now() - startTime
      expect(tasksFinished).toBeLessThanOrEqual(numberOfWorkers * maxMultiplier)
      expect(elapsedTime).toBeGreaterThanOrEqual(2000)
      // Worker kill message response timeout is 1000ms
      expect(elapsedTime).toBeLessThanOrEqual(
        tasksFinishedTimeout + 1000 * tasksFinished + 1000,
      )
    })

    it('Verify that destroy() waits until the tasks finished timeout is reached', async () => {
      const tasksFinishedTimeout = 1000
      const pool = new FixedThreadPool(
        numberOfWorkers,
        new URL('./../worker-files/thread/asyncWorker.mjs', import.meta.url),
        {
          enableTasksQueue: true,
          tasksQueueOptions: { tasksFinishedTimeout },
        },
      )
      const maxMultiplier = 4
      let tasksFinished = 0
      for (const workerNode of pool.workerNodes) {
        workerNode.addEventListener('taskFinished', () => {
          ++tasksFinished
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
      // Worker kill message response timeout is 1000ms
      expect(elapsedTime).toBeLessThanOrEqual(
        tasksFinishedTimeout + 1000 * tasksFinished + 1000,
      )
    })

    it('Verify that hasTaskFunction() is working', async () => {
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
      expect(
        dynamicThreadPool.hasTaskFunction('jsonIntegerSerialization'),
      ).toBe(true)
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

    it('Verify that addTaskFunction() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
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
      await expect(
        dynamicThreadPool.addTaskFunction('test', 0),
      ).rejects.toThrow(
        new TypeError('taskFunction property must be a function'),
      )
      await expect(
        dynamicThreadPool.addTaskFunction('test', ''),
      ).rejects.toThrow(
        new TypeError('taskFunction property must be a function'),
      )
      await expect(
        dynamicThreadPool.addTaskFunction('test', { taskFunction: 0 }),
      ).rejects.toThrow(
        new TypeError('taskFunction property must be a function'),
      )
      await expect(
        dynamicThreadPool.addTaskFunction('test', { taskFunction: '' }),
      ).rejects.toThrow(
        new TypeError('taskFunction property must be a function'),
      )
      await expect(
        dynamicThreadPool.addTaskFunction('test', {
          taskFunction: () => {},
          priority: -21,
        }),
      ).rejects.toThrow(
        new RangeError("Property 'priority' must be between -20 and 19"),
      )
      await expect(
        dynamicThreadPool.addTaskFunction('test', {
          taskFunction: () => {},
          priority: 20,
        }),
      ).rejects.toThrow(
        new RangeError("Property 'priority' must be between -20 and 19"),
      )
      await expect(
        dynamicThreadPool.addTaskFunction('test', {
          taskFunction: () => {},
          strategy: 'invalidStrategy',
        }),
      ).rejects.toThrow(
        new Error("Invalid worker choice strategy 'invalidStrategy'"),
      )
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
      ])
      expect([
        ...dynamicThreadPool.workerChoiceStrategiesContext
          .workerChoiceStrategies.keys(),
      ]).toStrictEqual([WorkerChoiceStrategies.LEAST_USED])
      const echoTaskFunction = (data) => {
        return data
      }
      await expect(
        dynamicThreadPool.addTaskFunction('echo', {
          taskFunction: echoTaskFunction,
          strategy: WorkerChoiceStrategies.LEAST_BUSY,
        }),
      ).resolves.toBe(true)
      expect(dynamicThreadPool.taskFunctions.size).toBe(1)
      expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual({
        taskFunction: echoTaskFunction,
        strategy: WorkerChoiceStrategies.LEAST_BUSY,
      })
      expect([
        ...dynamicThreadPool.workerChoiceStrategiesContext
          .workerChoiceStrategies.keys(),
      ]).toStrictEqual([
        WorkerChoiceStrategies.LEAST_USED,
        WorkerChoiceStrategies.LEAST_BUSY,
      ])
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
        { name: 'echo', strategy: WorkerChoiceStrategies.LEAST_BUSY },
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
          runTime: expect.objectContaining({
            history: expect.any(CircularBuffer),
          }),
          waitTime: expect.objectContaining({
            history: expect.any(CircularBuffer),
          }),
          elu: {
            idle: {
              history: expect.any(CircularBuffer),
            },
            active: {
              history: expect.any(CircularBuffer),
            },
          },
        })
        expect(
          workerNode.getTaskFunctionWorkerUsage('echo').tasks.executed,
        ).toBeGreaterThan(0)
        if (
          workerNode.getTaskFunctionWorkerUsage('echo').runTime.aggregate ==
            null
        ) {
          expect(
            workerNode.getTaskFunctionWorkerUsage('echo').runTime.aggregate,
          ).toBeUndefined()
        } else {
          expect(
            workerNode.getTaskFunctionWorkerUsage('echo').runTime.aggregate,
          ).toBeGreaterThan(0)
        }
        if (
          workerNode.getTaskFunctionWorkerUsage('echo').waitTime.aggregate ==
            null
        ) {
          expect(
            workerNode.getTaskFunctionWorkerUsage('echo').waitTime.aggregate,
          ).toBeUndefined()
        } else {
          expect(
            workerNode.getTaskFunctionWorkerUsage('echo').waitTime.aggregate,
          ).toBeGreaterThan(0)
        }
      }
      await dynamicThreadPool.destroy()
    })

    it('Verify that addTaskFunction() with workerNodeKeys is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      const poolWorkerNodeKeys = [...dynamicThreadPool.workerNodes.keys()]

      // Test with valid workerNodeKeys
      const echoTaskFunction = (data) => {
        return data
      }
      await expect(
        dynamicThreadPool.addTaskFunction('affinityEcho', {
          taskFunction: echoTaskFunction,
          workerNodeKeys: [poolWorkerNodeKeys[0]],
        }),
      ).resolves.toBe(true)
      expect(dynamicThreadPool.taskFunctions.get('affinityEcho')).toStrictEqual(
        {
          taskFunction: echoTaskFunction,
          workerNodeKeys: [poolWorkerNodeKeys[0]],
        },
      )

      // Test with invalid workerNodeKeys (out of range)
      await expect(
        dynamicThreadPool.addTaskFunction('invalidKeys', {
          taskFunction: () => {},
          workerNodeKeys: [999],
        }),
      ).rejects.toThrow(
        new RangeError(
          'Cannot add a task function with invalid worker node keys: 999. Valid keys are: 0..1',
        ),
      )

      // Test with empty array workerNodeKeys
      await expect(
        dynamicThreadPool.addTaskFunction('emptyKeys', {
          taskFunction: () => {},
          workerNodeKeys: [],
        }),
      ).rejects.toThrow(
        new RangeError('Invalid worker node keys: must not be an empty array'),
      )

      // Test exceeding max workers
      const tooManyKeys = Array.from(
        { length: numberOfWorkers + 1 },
        (_, i) => i,
      )
      await expect(
        dynamicThreadPool.addTaskFunction('tooManyKeys', {
          taskFunction: () => {},
          workerNodeKeys: tooManyKeys,
        }),
      ).rejects.toThrow(
        new RangeError(
          'Cannot add a task function with more worker node keys than the maximum number of workers in the pool',
        ),
      )

      // Test with duplicate workerNodeKeys
      await expect(
        dynamicThreadPool.addTaskFunction('duplicateKeys', {
          taskFunction: () => {},
          workerNodeKeys: [poolWorkerNodeKeys[0], poolWorkerNodeKeys[0]],
        }),
      ).rejects.toThrow(
        new TypeError('Invalid worker node keys: must not contain duplicates'),
      )

      // Test with non-integer values
      await expect(
        dynamicThreadPool.addTaskFunction('nonIntegerKeys', {
          taskFunction: () => {},
          workerNodeKeys: [1.5],
        }),
      ).rejects.toThrow(
        new TypeError(
          "Invalid worker node key '1.5': must be a non-negative safe integer",
        ),
      )

      // Test with negative values
      await expect(
        dynamicThreadPool.addTaskFunction('negativeKeys', {
          taskFunction: () => {},
          workerNodeKeys: [-1],
        }),
      ).rejects.toThrow(
        new TypeError(
          "Invalid worker node key '-1': must be a non-negative safe integer",
        ),
      )

      await dynamicThreadPool.destroy()
    })

    it('Verify that execute() respects workerNodeKeys affinity', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      const poolWorkerNodeKeys = [...dynamicThreadPool.workerNodes.keys()]

      // Add task function with affinity to first worker only
      const affinityTaskFunction = (data) => {
        return data
      }
      await dynamicThreadPool.addTaskFunction('affinityTask', {
        taskFunction: affinityTaskFunction,
        workerNodeKeys: [poolWorkerNodeKeys[0]],
      })

      // Reset task counts to track new executions
      for (const workerNode of dynamicThreadPool.workerNodes) {
        workerNode.usage.tasks.executed = 0
      }

      // Execute multiple tasks with affinity
      const numTasks = 5
      const tasks = []
      for (let i = 0; i < numTasks; i++) {
        tasks.push(dynamicThreadPool.execute({ test: i }, 'affinityTask'))
      }
      await Promise.all(tasks)

      // Verify that only the affinity worker received the tasks
      const affinityWorkerNode =
        dynamicThreadPool.workerNodes[poolWorkerNodeKeys[0]]
      expect(affinityWorkerNode.usage.tasks.executed).toBe(numTasks)

      // Other workers should have 0 tasks from affinityTask
      for (let i = 0; i < dynamicThreadPool.workerNodes.length; i++) {
        if (i !== poolWorkerNodeKeys[0]) {
          expect(dynamicThreadPool.workerNodes[i].usage.tasks.executed).toBe(0)
        }
      }

      await dynamicThreadPool.destroy()
    })

    it({
      name:
        'Verify that execute() creates dynamic workers for workerNodeKeys affinity',
      ignore: Deno.build.os === 'linux' &&
        Number.parseInt(Deno.version.deno.split('.')[0]) >= 2,
      fn: async () => {
        const dynamicThreadPool = new DynamicThreadPool(
          1,
          4,
          new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
        )
        await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
        expect(dynamicThreadPool.workerNodes.length).toBe(1)

        await dynamicThreadPool.addTaskFunction('affinityBeyondMin', {
          taskFunction: (data) => data,
          workerNodeKeys: [2, 3],
        })

        for (const workerNode of dynamicThreadPool.workerNodes) {
          workerNode.usage.tasks.executed = 0
        }

        const tasks = []
        for (let i = 0; i < 4; i++) {
          tasks.push(
            dynamicThreadPool.execute({ test: i }, 'affinityBeyondMin'),
          )
        }
        await Promise.all(tasks)

        expect(dynamicThreadPool.workerNodes.length).toBeGreaterThanOrEqual(4)
        const executedOnAffinity =
          dynamicThreadPool.workerNodes[2].usage.tasks.executed +
          dynamicThreadPool.workerNodes[3].usage.tasks.executed
        expect(executedOnAffinity).toBe(4)

        await dynamicThreadPool.destroy()
      },
    })

    it('Verify that removeTaskFunction() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
      ])
      await expect(
        dynamicThreadPool.removeTaskFunction('test'),
      ).rejects.toThrow(
        new Error('Cannot remove a task function not handled on the pool side'),
      )
      const echoTaskFunction = (data) => {
        return data
      }
      await dynamicThreadPool.addTaskFunction('echo', {
        taskFunction: echoTaskFunction,
        strategy: WorkerChoiceStrategies.LEAST_BUSY,
      })
      expect(dynamicThreadPool.taskFunctions.size).toBe(1)
      expect(dynamicThreadPool.taskFunctions.get('echo')).toStrictEqual({
        taskFunction: echoTaskFunction,
        strategy: WorkerChoiceStrategies.LEAST_BUSY,
      })
      expect([
        ...dynamicThreadPool.workerChoiceStrategiesContext
          .workerChoiceStrategies.keys(),
      ]).toStrictEqual([
        WorkerChoiceStrategies.LEAST_USED,
        WorkerChoiceStrategies.LEAST_BUSY,
      ])
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
        { name: 'echo', strategy: WorkerChoiceStrategies.LEAST_BUSY },
      ])
      await expect(dynamicThreadPool.removeTaskFunction('echo')).resolves.toBe(
        true,
      )
      expect(dynamicThreadPool.taskFunctions.size).toBe(0)
      expect(dynamicThreadPool.taskFunctions.get('echo')).toBeUndefined()
      expect([
        ...dynamicThreadPool.workerChoiceStrategiesContext
          .workerChoiceStrategies.keys(),
      ]).toStrictEqual([WorkerChoiceStrategies.LEAST_USED])
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
      ])
      await dynamicThreadPool.destroy()
    })

    it('Verify that listTaskFunctionsProperties() is working', async () => {
      const dynamicThreadPool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
          import.meta.url,
        ),
      )
      await waitPoolEvents(dynamicThreadPool, PoolEvents.ready, 1)
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'jsonIntegerSerialization' },
        { name: 'factorial', priority: 1, workerNodeKeys: [0] },
        { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
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
      expect(fixedClusterPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'jsonIntegerSerialization' },
        { name: 'factorial', priority: 1, workerNodeKeys: [0] },
        { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      ])
      await fixedClusterPool.destroy()
    })

    it('Verify that setDefaultTaskFunction() is working', async () => {
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
      await expect(dynamicThreadPool.setDefaultTaskFunction(0)).rejects.toThrow(
        new Error(
          `Task function operation 'default' failed on worker ${workerId} with error: 'name parameter is not a string'`,
        ),
      )
      await expect(
        dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME),
      ).rejects.toThrow(
        new Error(
          `Task function operation 'default' failed on worker ${workerId} with error: 'Cannot set the default task function reserved name as the default task function'`,
        ),
      )
      await expect(
        dynamicThreadPool.setDefaultTaskFunction('unknown'),
      ).rejects.toThrow(
        new Error(
          `Task function operation 'default' failed on worker ${workerId} with error: 'Cannot set the default task function to a non-existing task function'`,
        ),
      )
      await expect(
        dynamicThreadPool.setDefaultTaskFunction(0),
      ).rejects.toThrow()
      await expect(
        dynamicThreadPool.setDefaultTaskFunction(DEFAULT_TASK_NAME),
      ).rejects.toThrow()
      await expect(
        dynamicThreadPool.setDefaultTaskFunction('unknown'),
      ).rejects.toThrow()
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'jsonIntegerSerialization' },
        { name: 'factorial', priority: 1, workerNodeKeys: [0] },
        { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      ])
      await expect(
        dynamicThreadPool.setDefaultTaskFunction('factorial'),
      ).resolves.toBe(true)
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME, priority: 1, workerNodeKeys: [0] },
        { name: 'factorial', priority: 1, workerNodeKeys: [0] },
        { name: 'jsonIntegerSerialization' },
        { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
      ])
      await expect(
        dynamicThreadPool.setDefaultTaskFunction('fibonacci'),
      ).resolves.toBe(true)
      expect(dynamicThreadPool.listTaskFunctionsProperties()).toStrictEqual([
        { name: DEFAULT_TASK_NAME, priority: 2, workerNodeKeys: [0, 1] },
        { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
        { name: 'jsonIntegerSerialization' },
        { name: 'factorial', priority: 1, workerNodeKeys: [0] },
      ])
      await dynamicThreadPool.destroy()
    })

    it('Verify that multiple task functions worker is working', async () => {
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
      expect(result2).toBe(3628800n)
      const result3 = await pool.execute(data, 'fibonacci')
      expect(result3).toBe(55n)
      expect(pool.info.executingTasks).toBe(0)
      expect(pool.info.executedTasks).toBe(4)
      for (const workerNode of pool.workerNodes) {
        if (workerNode.info.taskFunctionsProperties == null) {
          continue
        }
        expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
          { name: DEFAULT_TASK_NAME },
          { name: 'jsonIntegerSerialization' },
          { name: 'factorial', priority: 1, workerNodeKeys: [0] },
          { name: 'fibonacci', priority: 2, workerNodeKeys: [0, 1] },
        ])
        expect(workerNode.taskFunctionsUsage.size).toBe(3)
        expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
        expect(workerNode.tasksQueue.enablePriority).toBe(true)
        for (
          const taskFunctionProperties of pool.listTaskFunctionsProperties()
        ) {
          expect(
            workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name),
          ).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              failed: 0,
              queued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
            },
            runTime: {
              history: expect.any(CircularBuffer),
            },
            waitTime: {
              history: expect.any(CircularBuffer),
            },
            elu: {
              idle: {
                history: expect.any(CircularBuffer),
              },
              active: {
                history: expect.any(CircularBuffer),
              },
            },
          })
          expect(
            workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
              .tasks.executed,
          ).toBeGreaterThan(0)
        }
        expect(
          workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME),
        ).toStrictEqual(
          workerNode.getTaskFunctionWorkerUsage(
            workerNode.info.taskFunctionsProperties[1].name,
          ),
        )
      }
      await pool.destroy()
    })

    it('Verify that mapExecute() is working', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testMultipleTaskFunctionsWorker.mjs',
          import.meta.url,
        ),
      )
      await expect(pool.mapExecute()).rejects.toThrow(
        new TypeError('data argument must be a defined iterable'),
      )
      await expect(pool.mapExecute(0)).rejects.toThrow(
        new TypeError('data argument must be an iterable'),
      )
      await expect(pool.mapExecute([undefined], 0)).rejects.toThrow(
        new TypeError('name argument must be a string'),
      )
      await expect(pool.mapExecute([undefined], '')).rejects.toThrow(
        new TypeError('name argument must not be an empty string'),
      )
      await expect(pool.mapExecute([undefined], undefined, 0)).rejects.toThrow(
        new TypeError('abortSignals argument must be an iterable'),
      )
      await expect(
        pool.mapExecute([undefined], undefined, [undefined]),
      ).rejects.toThrow(
        new TypeError(
          'abortSignals argument must be an iterable of AbortSignal',
        ),
      )
      await expect(
        pool.mapExecute([undefined], undefined, [
          new AbortController().signal,
          new AbortController().signal,
        ]),
      ).rejects.toThrow(
        new Error('data and abortSignals arguments must have the same length'),
      )
      await expect(
        pool.mapExecute(
          [undefined],
          undefined,
          [new AbortController().signal],
          {},
        ),
      ).rejects.toThrow(new TypeError('transferList argument must be an array'))
      await expect(pool.mapExecute([undefined], 'unknown')).rejects.toThrow(
        new Error("Task function 'unknown' not found"),
      )
      let results = await pool.mapExecute(
        Array(4).fill({}),
        'jsonIntegerSerialization',
        Array(4).fill(AbortSignal.timeout(1000)),
      )
      expect(results).toStrictEqual([
        { ok: 1 },
        { ok: 1 },
        { ok: 1 },
        {
          ok: 1,
        },
      ])
      expect(pool.info.executingTasks).toBe(0)
      expect(pool.info.executedTasks).toBe(4)
      results = await pool.mapExecute(
        [
          { n: 10 },
          { n: 20 },
          { n: 30 },
          {
            n: 40,
          },
        ],
        'factorial',
        Array(4).fill(AbortSignal.timeout(1000)),
      )
      expect(results).toStrictEqual([
        3628800n,
        2432902008176640000n,
        265252859812191058636308480000000n,
        815915283247897734345611269596115894272000000000n,
      ])
      expect(pool.info.executingTasks).toBe(0)
      expect(pool.info.executedTasks).toBe(8)
      results = await pool.mapExecute(
        new Set([{ n: 10 }, { n: 20 }, { n: 30 }, { n: 40 }]),
        'factorial',
        new Set([
          AbortSignal.timeout(1000),
          AbortSignal.timeout(1500),
          AbortSignal.timeout(2000),
          AbortSignal.timeout(2500),
        ]),
      )
      expect(results).toStrictEqual([
        3628800n,
        2432902008176640000n,
        265252859812191058636308480000000n,
        815915283247897734345611269596115894272000000000n,
      ])
      expect(pool.info.executingTasks).toBe(0)
      expect(pool.info.executedTasks).toBe(12)
      await pool.destroy()
    })

    it('Verify that task function objects worker is working', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL(
          './../worker-files/thread/testTaskFunctionObjectsWorker.mjs',
          import.meta.url,
        ),
      )
      const data = { n: 10 }
      const result0 = await pool.execute(data)
      expect(result0).toBe(3628800n)
      const result1 = await pool.execute(data, 'jsonIntegerSerialization')
      expect(result1).toStrictEqual({ ok: 1 })
      const result2 = await pool.execute(data, 'factorial')
      expect(result2).toBe(3628800n)
      const result3 = await pool.execute(data, 'fibonacci')
      expect(result3).toBe(55n)
      expect(pool.info.executingTasks).toBe(0)
      expect(pool.info.executedTasks).toBe(4)
      for (const workerNode of pool.workerNodes) {
        if (workerNode.info.taskFunctionsProperties == null) {
          continue
        }
        expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
          { name: DEFAULT_TASK_NAME, workerNodeKeys: [0] },
          { name: 'factorial', workerNodeKeys: [0] },
          { name: 'fibonacci', priority: -5, workerNodeKeys: [0, 1] },
          { name: 'jsonIntegerSerialization' },
        ])
        expect(workerNode.taskFunctionsUsage.size).toBe(3)
        expect(workerNode.usage.tasks.executed).toBeGreaterThan(0)
        expect(workerNode.tasksQueue.enablePriority).toBe(true)
        for (
          const taskFunctionProperties of pool.listTaskFunctionsProperties()
        ) {
          expect(
            workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name),
          ).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              failed: 0,
              queued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
            },
            runTime: {
              history: expect.any(CircularBuffer),
            },
            waitTime: {
              history: expect.any(CircularBuffer),
            },
            elu: {
              idle: {
                history: expect.any(CircularBuffer),
              },
              active: {
                history: expect.any(CircularBuffer),
              },
            },
          })
          expect(
            workerNode.getTaskFunctionWorkerUsage(taskFunctionProperties.name)
              .tasks.executed,
          ).toBeGreaterThan(0)
        }
        expect(
          workerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME),
        ).toStrictEqual(
          workerNode.getTaskFunctionWorkerUsage(
            workerNode.info.taskFunctionsProperties[1].name,
          ),
        )
      }
      await pool.destroy()
      await expect(pool.mapExecute()).rejects.toThrow(
        new Error('Cannot execute task(s) on not started pool'),
      )
    })

    it('Verify sendKillMessageToWorker()', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      const workerNodeKey = 0
      await expect(
        pool.sendKillMessageToWorker(workerNodeKey),
      ).resolves.toBeUndefined()
      // Simulates destroyWorkerNode()
      pool.workerNodes[workerNodeKey].terminate()
      await pool.destroy()
    })

    it('Verify sendTaskFunctionOperationToWorker()', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      const workerNodeKey = 0
      await expect(
        pool.sendTaskFunctionOperationToWorker(workerNodeKey, {
          taskFunctionOperation: 'add',
          taskFunctionProperties: { name: 'empty' },
          taskFunction: (() => {}).toString(),
        }),
      ).resolves.toBe(true)
      expect(
        pool.workerNodes[workerNodeKey].info.taskFunctionsProperties,
      ).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'test' },
        {
          name: 'empty',
        },
      ])
      await pool.destroy()
    })

    it('Verify sendTaskFunctionOperationToWorkers()', async () => {
      const pool = new DynamicThreadPool(
        Math.floor(numberOfWorkers / 2),
        numberOfWorkers,
        new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      )
      await expect(
        pool.sendTaskFunctionOperationToWorkers({
          taskFunctionOperation: 'add',
          taskFunctionProperties: { name: 'empty' },
          taskFunction: (() => {}).toString(),
        }),
      ).resolves.toBe(true)
      for (const workerNode of pool.workerNodes) {
        expect(workerNode.info.taskFunctionsProperties).toStrictEqual([
          { name: DEFAULT_TASK_NAME },
          { name: 'test' },
          { name: 'empty' },
        ])
      }
      await pool.destroy()
    })
  },
})
