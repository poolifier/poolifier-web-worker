import { expect } from 'expect'
import { CircularBuffer } from '../../src/circular-buffer.ts'
import { WorkerTypes } from '../../src/mod.ts'
import { WorkerNode } from '../../src/pools/worker-node.ts'
import { PriorityQueue } from '../../src/queues/priority-queue.ts'
import { DEFAULT_TASK_NAME } from '../../src/utils.ts'

Deno.test({
  name: 'Worker node test suite',
  fn: async (t) => {
    const threadWorkerNode = new WorkerNode(
      WorkerTypes.web,
      new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
      {
        tasksQueueBackPressureSize: 12,
        tasksQueueBucketSize: 6,
        tasksQueuePriority: true,
      },
    )

    await t.step('Worker node instantiation', () => {
      expect(() => new WorkerNode()).toThrow(
        new TypeError('Cannot construct a worker node without a worker type'),
      )
      expect(
        () =>
          new WorkerNode(
            'invalidWorkerType',
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
          ),
      ).toThrow(
        new TypeError(
          "Cannot construct a worker node with an invalid worker type 'invalidWorkerType'",
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node without worker node options',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            '',
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node with invalid worker node options: must be a plain object',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {},
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node without a tasks queue back pressure size option',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            { tasksQueueBackPressureSize: 'invalidTasksQueueBackPressureSize' },
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            { tasksQueueBackPressureSize: 0.2 },
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node with a tasks queue back pressure size option that is not an integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            { tasksQueueBackPressureSize: 0 },
          ),
      ).toThrow(
        new RangeError(
          'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            { tasksQueueBackPressureSize: -1 },
          ),
      ).toThrow(
        new RangeError(
          'Cannot construct a worker node with a tasks queue back pressure size option that is not a positive integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              tasksQueueBackPressureSize: 12,
            },
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node without a tasks queue bucket size option',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              tasksQueueBackPressureSize: 12,
              tasksQueueBucketSize: 'invalidTasksQueueBucketSize',
            },
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node with a tasks queue bucket size option that is not an integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            { tasksQueueBackPressureSize: 12, tasksQueueBucketSize: 0.2 },
          ),
      ).toThrow(
        new TypeError(
          'Cannot construct a worker node with a tasks queue bucket size option that is not an integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              tasksQueueBackPressureSize: 12,
              tasksQueueBucketSize: 0,
            },
          ),
      ).toThrow(
        new RangeError(
          'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              tasksQueueBackPressureSize: 12,
              tasksQueueBucketSize: -1,
            },
          ),
      ).toThrow(
        new RangeError(
          'Cannot construct a worker node with a tasks queue bucket size option that is not a positive integer',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              tasksQueueBackPressureSize: 12,
              tasksQueueBucketSize: 6,
            },
          ),
      ).toThrow(
        new RangeError(
          'Cannot construct a worker node without a tasks queue priority option',
        ),
      )
      expect(
        () =>
          new WorkerNode(
            WorkerTypes.web,
            new URL('./../worker-files/thread/testWorker.mjs', import.meta.url),
            {
              tasksQueueBackPressureSize: 12,
              tasksQueueBucketSize: 6,
              tasksQueuePriority: 'invalidTasksQueuePriority',
            },
          ),
      ).toThrow(
        new RangeError(
          'Cannot construct a worker node with a tasks queue priority option that is not a boolean',
        ),
      )
      expect(threadWorkerNode).toBeInstanceOf(WorkerNode)
      expect(threadWorkerNode.worker).toBeInstanceOf(Worker)
      expect(threadWorkerNode.info).toStrictEqual({
        id: expect.any(String),
        type: WorkerTypes.web,
        dynamic: false,
        ready: false,
        stealing: false,
        backPressure: false,
      })
      expect(threadWorkerNode.usage).toStrictEqual({
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
      expect(threadWorkerNode.messageChannel).toBeInstanceOf(MessageChannel)
      expect(threadWorkerNode.tasksQueueBackPressureSize).toBe(12)
      expect(threadWorkerNode.tasksQueue).toBeInstanceOf(PriorityQueue)
      expect(threadWorkerNode.tasksQueue.size).toBe(0)
      expect(threadWorkerNode.tasksQueue.bucketSize).toBe(6)
      expect(threadWorkerNode.tasksQueue.enablePriority).toBe(true)
      expect(threadWorkerNode.tasksQueueSize()).toBe(
        threadWorkerNode.tasksQueue.size,
      )
      expect(threadWorkerNode.setBackPressureFlag).toBe(false)
      expect(threadWorkerNode.taskFunctionsUsage).toBeInstanceOf(Map)
    })

    await t.step('Worker node getTaskFunctionWorkerUsage()', () => {
      expect(() =>
        threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
      ).toThrow(
        new TypeError(
          "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function properties list is not yet defined",
        ),
      )
      threadWorkerNode.info.taskFunctionsProperties = [
        {
          name: DEFAULT_TASK_NAME,
        },
        { name: 'fn1' },
      ]
      expect(() =>
        threadWorkerNode.getTaskFunctionWorkerUsage('invalidTaskFunction')
      ).toThrow(
        new TypeError(
          "Cannot get task function worker usage for task function name 'invalidTaskFunction' when task function properties list has less than 3 elements",
        ),
      )
      threadWorkerNode.info.taskFunctionsProperties = [
        { name: DEFAULT_TASK_NAME },
        { name: 'fn1' },
        { name: 'fn2' },
      ]
      expect(
        threadWorkerNode.getTaskFunctionWorkerUsage(DEFAULT_TASK_NAME),
      ).toStrictEqual({
        tasks: {
          executed: 0,
          executing: 0,
          queued: 0,
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
      expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn1')).toStrictEqual({
        tasks: {
          executed: 0,
          executing: 0,
          queued: 0,
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
      expect(threadWorkerNode.getTaskFunctionWorkerUsage('fn2')).toStrictEqual({
        tasks: {
          executed: 0,
          executing: 0,
          queued: 0,
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
      expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
    })

    await t.step('Worker node deleteTaskFunctionWorkerUsage()', () => {
      expect(threadWorkerNode.info.taskFunctionsProperties).toStrictEqual([
        { name: DEFAULT_TASK_NAME },
        { name: 'fn1' },
        { name: 'fn2' },
      ])
      expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
      expect(
        threadWorkerNode.deleteTaskFunctionWorkerUsage('invalidTaskFunction'),
      ).toBe(false)
      expect(threadWorkerNode.taskFunctionsUsage.size).toBe(2)
      expect(threadWorkerNode.deleteTaskFunctionWorkerUsage('fn1')).toBe(true)
      expect(threadWorkerNode.taskFunctionsUsage.size).toBe(1)
    })

    threadWorkerNode.terminate()
  },
})
