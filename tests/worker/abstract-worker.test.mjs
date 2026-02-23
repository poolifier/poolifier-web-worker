import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { assertSpyCall, assertSpyCalls, stub } from '@std/testing/mock'
import {
  KillBehaviors,
  ThreadWorker,
  WorkerChoiceStrategies,
} from '../../src/mod.ts'
import { DEFAULT_TASK_NAME, EMPTY_FUNCTION } from '../../src/utils.ts'
import { sleep } from '../test-utils.mjs'

describe('Abstract worker test suite', () => {
  class StubWorkerWithMainWorker extends ThreadWorker {
    constructor(fn, opts) {
      super(fn, opts)
      delete this.mainWorker
    }
  }

  it('Verify worker options default values', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.opts).toStrictEqual({
      killBehavior: KillBehaviors.SOFT,
      maxInactiveTime: 60000,
      killHandler: EMPTY_FUNCTION,
    })
  })

  it('Verify that worker options are checked at worker creation', () => {
    expect(() => new ThreadWorker(() => {}, '')).toThrow(
      new TypeError('opts worker options parameter is not a plain object'),
    )
    expect(() => new ThreadWorker(() => {}, { killBehavior: '' })).toThrow(
      new TypeError("killBehavior option '' is not valid"),
    )
    expect(() => new ThreadWorker(() => {}, { killBehavior: 0 })).toThrow(
      new TypeError("killBehavior option '0' is not valid"),
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: '' })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5',
      ),
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 0.5 })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5',
      ),
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 0 })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5',
      ),
    )
    expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 4 })).toThrow(
      new TypeError(
        'maxInactiveTime option is not a positive integer greater or equal than 5',
      ),
    )
    expect(() => new ThreadWorker(() => {}, { killHandler: '' })).toThrow(
      new TypeError('killHandler option is not a function'),
    )
    expect(() => new ThreadWorker(() => {}, { killHandler: 0 })).toThrow(
      new TypeError('killHandler option is not a function'),
    )
  })

  it('Verify that worker options are set at worker creation', () => {
    const killHandler = () => {
      console.info('Worker received kill message')
    }
    const worker = new ThreadWorker(() => {}, {
      killBehavior: KillBehaviors.HARD,
      maxInactiveTime: 6000,
      killHandler,
    })
    expect(worker.opts).toStrictEqual({
      killBehavior: KillBehaviors.HARD,
      maxInactiveTime: 6000,
      killHandler,
    })
  })

  it('Verify that taskFunctions parameter is mandatory', () => {
    expect(() => new ThreadWorker()).toThrow(
      new Error('taskFunctions parameter is mandatory'),
    )
  })

  it('Verify that taskFunctions parameter is a function or a plain object', () => {
    expect(() => new ThreadWorker(0)).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker('')).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker(true)).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker([])).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker(new Map())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker(new Set())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker(new WeakMap())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
    expect(() => new ThreadWorker(new WeakSet())).toThrow(
      new TypeError(
        'taskFunctions parameter is not a function or a plain object',
      ),
    )
  })

  it('Verify that taskFunctions parameter is not an empty object', () => {
    expect(() => new ThreadWorker({})).toThrow(
      new Error('taskFunctions parameter object is empty'),
    )
  })

  it('Verify that taskFunctions parameter with unique function is taken', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
  })

  it('Verify that taskFunctions parameter with multiple task functions is checked', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = ''
    expect(() => new ThreadWorker({ '': fn1 })).toThrow(
      new TypeError('name parameter is an empty string'),
    )
    expect(() => new ThreadWorker({ fn1, fn2 })).toThrow(
      new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function",
      ),
    )
    expect(() => new ThreadWorker({ fn1: { fn1 } })).toThrow(
      new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function",
      ),
    )
    expect(() => new ThreadWorker({ fn2: { taskFunction: fn2 } })).toThrow(
      new TypeError(
        "taskFunction object 'taskFunction' property '' is not a function",
      ),
    )
    expect(
      () => new ThreadWorker({ fn1: { taskFunction: fn1, priority: '' } }),
    ).toThrow(new TypeError("Invalid property 'priority': ''"))
    expect(
      () => new ThreadWorker({ fn1: { taskFunction: fn1, priority: -21 } }),
    ).toThrow(new RangeError("Property 'priority' must be between -20 and 19"))
    expect(
      () => new ThreadWorker({ fn1: { taskFunction: fn1, priority: 20 } }),
    ).toThrow(new RangeError("Property 'priority' must be between -20 and 19"))
    expect(
      () =>
        new ThreadWorker({
          fn1: { taskFunction: fn1, strategy: 'invalidStrategy' },
        }),
    ).toThrow(new Error("Invalid worker choice strategy 'invalidStrategy'"))
  })

  it('Verify that taskFunctions parameter with multiple task functions is taken', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
  })

  it('Verify that taskFunctions parameter with multiple task functions object is taken', () => {
    const fn1Obj = {
      taskFunction: () => {
        return 1
      },
      priority: 5,
    }
    const fn2Obj = {
      taskFunction: () => {
        return 2
      },
      priority: 6,
      strategy: WorkerChoiceStrategies.LESS_BUSY,
    }
    const worker = new ThreadWorker({
      fn1: fn1Obj,
      fn2: fn2Obj,
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(fn1Obj)
    expect(worker.taskFunctions.get('fn1')).toStrictEqual(fn1Obj)
    expect(worker.taskFunctions.get('fn2')).toStrictEqual(fn2Obj)
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
  })

  it('Verify that getMainWorker() throw error if main worker is not set', () => {
    expect(() =>
      new StubWorkerWithMainWorker(() => {}).getMainWorker()
    ).toThrow('Main worker not set')
  })

  it('Verify that hasTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.hasTaskFunction(0)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string'),
    })
    expect(worker.hasTaskFunction('')).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string'),
    })
    expect(worker.hasTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      status: true,
    })
    expect(worker.hasTaskFunction('fn1')).toStrictEqual({ status: true })
    expect(worker.hasTaskFunction('fn2')).toStrictEqual({ status: true })
    expect(worker.hasTaskFunction('fn3')).toStrictEqual({ status: false })
  })

  it('Verify that addTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const fn1Replacement = () => {
      return 3
    }
    const worker = new ThreadWorker(fn1)
    expect(worker.addTaskFunction(0, fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string'),
    })
    expect(worker.addTaskFunction('', fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string'),
    })
    expect(worker.addTaskFunction('fn2', 0)).toStrictEqual({
      status: false,
      error: new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function",
      ),
    })
    expect(worker.addTaskFunction('fn3', '')).toStrictEqual({
      status: false,
      error: new TypeError(
        "taskFunction object 'taskFunction' property 'undefined' is not a function",
      ),
    })
    expect(worker.addTaskFunction('fn2', { taskFunction: 0 })).toStrictEqual({
      status: false,
      error: new TypeError(
        "taskFunction object 'taskFunction' property '0' is not a function",
      ),
    })
    expect(worker.addTaskFunction('fn3', { taskFunction: '' })).toStrictEqual({
      status: false,
      error: new TypeError(
        "taskFunction object 'taskFunction' property '' is not a function",
      ),
    })
    expect(
      worker.addTaskFunction('fn2', { taskFunction: () => {}, priority: -21 }),
    ).toStrictEqual({
      status: false,
      error: new RangeError("Property 'priority' must be between -20 and 19"),
    })
    expect(
      worker.addTaskFunction('fn3', { taskFunction: () => {}, priority: 20 }),
    ).toStrictEqual({
      status: false,
      error: new RangeError("Property 'priority' must be between -20 and 19"),
    })
    expect(
      worker.addTaskFunction('fn2', {
        taskFunction: () => {},
        strategy: 'invalidStrategy',
      }),
    ).toStrictEqual({
      status: false,
      error: new Error("Invalid worker choice strategy 'invalidStrategy'"),
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
    expect(worker.addTaskFunction(DEFAULT_TASK_NAME, fn2)).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot add a task function with the default reserved name',
      ),
    })
    worker.addTaskFunction('fn2', fn2)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
    worker.addTaskFunction('fn1', fn1Replacement)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
  })

  it('Verify that listTaskFunctionsProperties() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.listTaskFunctionsProperties()).toStrictEqual([
      { name: DEFAULT_TASK_NAME },
      { name: 'fn1' },
      { name: 'fn2' },
    ])
  })

  it('Verify that setDefaultTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.setDefaultTaskFunction(0, fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string'),
    })
    expect(worker.setDefaultTaskFunction('', fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string'),
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn1')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.get('fn2')).toStrictEqual({
      taskFunction: expect.any(Function),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
    expect(worker.setDefaultTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot set the default task function reserved name as the default task function',
      ),
    })
    expect(worker.setDefaultTaskFunction('fn3')).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot set the default task function to a non-existing task function',
      ),
    })
    worker.setDefaultTaskFunction('fn1')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
    worker.setDefaultTaskFunction('fn2')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn2'),
    )
  })

  it('Verify that removeTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
    expect(worker.removeTaskFunction(0)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string'),
    })
    expect(worker.removeTaskFunction('')).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string'),
    })
    expect(worker.removeTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot remove the task function with the default reserved name',
      ),
    })
    expect(worker.removeTaskFunction('fn1')).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot remove the task function used as the default task function',
      ),
    })
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.removeTaskFunction('fn2')).toStrictEqual({ status: true })
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.taskFunctions.has('fn2')).toBe(false)
    sendToMainWorkerStub.restore()
  })

  describe('Message handling', () => {
    it('Verify that messageEventListener() handles statistics message', () => {
      const worker = new ThreadWorker(() => {})
      // Set worker id manually for testing (normally set by handleReadyMessageEvent)
      worker.id = '550e8400-e29b-41d4-a716-446655440000'
      worker.messageEventListener({
        data: {
          statistics: { elu: true, runTime: true },
          workerId: worker.id,
        },
      })
      expect(worker.statistics).toStrictEqual({ elu: true, runTime: true })
    })

    it('Verify that messageEventListener() handles checkActive message', () => {
      const worker = new ThreadWorker(() => {})
      // Set worker id manually for testing
      worker.id = '550e8400-e29b-41d4-a716-446655440000'
      worker.messageEventListener({
        data: {
          checkActive: true,
          workerId: worker.id,
        },
      })
      expect(worker.activeInterval).toBeDefined()
      worker.messageEventListener({
        data: {
          checkActive: false,
          workerId: worker.id,
        },
      })
      expect(worker.activeInterval).toBeUndefined()
    })

    it('Verify that messageEventListener() handles kill message', () => {
      const worker = new ThreadWorker(() => {})
      // Set worker id manually for testing
      worker.id = '550e8400-e29b-41d4-a716-446655440000'
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.messageEventListener({
        data: {
          kill: true,
          workerId: worker.id,
        },
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      expect(sendToMainWorkerStub.calls[0].args[0]).toMatchObject({
        kill: 'success',
      })
      sendToMainWorkerStub.restore()
    })

    it('Verify that async kill handler is called when worker is killed', async () => {
      const killHandlerStub = stub(() => {})
      const worker = new ThreadWorker(() => {}, {
        killHandler: async () => await Promise.resolve(killHandlerStub()),
      })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.handleKillMessage()
      await sleep(10)
      assertSpyCalls(killHandlerStub, 1)
      assertSpyCalls(sendToMainWorkerStub, 1)
      assertSpyCall(sendToMainWorkerStub, 0, { args: [{ kill: 'success' }] })
      sendToMainWorkerStub.restore()
      killHandlerStub.restore()
    })

    it('Verify that messageEventListener() throws on missing workerId', () => {
      const worker = new ThreadWorker(() => {})
      expect(() => worker.messageEventListener({ data: {} })).toThrow(
        /Message worker id is not set/,
      )
    })

    it('Verify that messageEventListener() throws on mismatched workerId', () => {
      const worker = new ThreadWorker(() => {})
      // Set worker id manually for testing
      worker.id = '550e8400-e29b-41d4-a716-446655440000'
      expect(() =>
        worker.messageEventListener({ data: { workerId: 'wrong-id' } })
      ).toThrow(/Message worker id .* does not match/)
    })
  })

  describe('Task execution', () => {
    it('Verify that run() executes sync task function', () => {
      const worker = new ThreadWorker((data) => data * 2)
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: 21,
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].data).toBe(42)
      expect(lastCall.args[0].taskId).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      )
      expect(lastCall.args[0].taskPerformance).toBeDefined()
      sendToMainWorkerStub.restore()
    })

    it('Verify that run() executes async task function', async () => {
      const worker = new ThreadWorker(
        async (data) => await Promise.resolve(data * 2),
      )
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: 21,
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      await sleep(10)
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].data).toBe(42)
      expect(lastCall.args[0].taskId).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      )
      sendToMainWorkerStub.restore()
    })

    it('Verify that run() handles task function not found', () => {
      const worker = new ThreadWorker(() => {})
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: {},
        name: 'unknown',
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].workerError).toBeDefined()
      expect(lastCall.args[0].workerError.error.message).toMatch(
        /Task function 'unknown' not found/,
      )
      sendToMainWorkerStub.restore()
    })

    it('Verify that runSync() handles task function error', () => {
      const worker = new ThreadWorker(() => {
        throw new Error('Task error')
      })
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: {},
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].workerError).toBeDefined()
      expect(lastCall.args[0].workerError.error.message).toBe('Task error')
      sendToMainWorkerStub.restore()
    })

    it('Verify that runAsync() handles task function error', async () => {
      const worker = new ThreadWorker(async () => {
        return await Promise.reject(new Error('Async task error'))
      })
      worker.statistics = { elu: false, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: {},
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      await sleep(10)
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].workerError).toBeDefined()
      expect(lastCall.args[0].workerError.error.message).toBe('Async task error')
      sendToMainWorkerStub.restore()
    })

    it('Verify that run() with runTime statistics works', () => {
      const worker = new ThreadWorker((data) => data)
      worker.statistics = { elu: false, runTime: true }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: 'test',
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].taskPerformance.runTime).toBeGreaterThanOrEqual(0)
      sendToMainWorkerStub.restore()
    })

    it('Verify that run() with elu statistics works', () => {
      const worker = new ThreadWorker((data) => data)
      worker.statistics = { elu: true, runTime: false }
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.run({
        data: 'test',
        name: DEFAULT_TASK_NAME,
        taskId: '550e8400-e29b-41d4-a716-446655440000',
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].taskPerformance).toBeDefined()
      sendToMainWorkerStub.restore()
    })
  })

  describe('Task function operations via messages', () => {
    it('Verify that handleTaskFunctionOperationMessage() handles add operation', () => {
      const worker = new ThreadWorker(() => {})
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.handleTaskFunctionOperationMessage({
        taskFunction: '(data) => data * 3',
        taskFunctionOperation: 'add',
        taskFunctionProperties: { name: 'newFn' },
      })
      expect(worker.taskFunctions.has('newFn')).toBe(true)
      // Called twice: once for sendTaskFunctionsPropertiesToMainWorker, once for operation response
      expect(sendToMainWorkerStub.calls.length).toBeGreaterThanOrEqual(1)
      const lastCall = sendToMainWorkerStub.calls[sendToMainWorkerStub.calls.length - 1]
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(true)
      sendToMainWorkerStub.restore()
    })

    it('Verify that handleTaskFunctionOperationMessage() handles remove operation', () => {
      const fn1 = () => 1
      const fn2 = () => 2
      const worker = new ThreadWorker({ fn1, fn2 })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      expect(worker.taskFunctions.has('fn2')).toBe(true)
      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'remove',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.has('fn2')).toBe(false)
      // Called twice: once for sendTaskFunctionsPropertiesToMainWorker, once for operation response
      expect(sendToMainWorkerStub.calls.length).toBeGreaterThanOrEqual(1)
      const lastCall = sendToMainWorkerStub.calls[sendToMainWorkerStub.calls.length - 1]
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(true)
      sendToMainWorkerStub.restore()
    })

    it('Verify that handleTaskFunctionOperationMessage() handles default operation', () => {
      const fn1 = () => 1
      const fn2 = () => 2
      const worker = new ThreadWorker({ fn1, fn2 })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'default',
        taskFunctionProperties: { name: 'fn2' },
      })
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
        worker.taskFunctions.get('fn2'),
      )
      // Called twice: once for sendTaskFunctionsPropertiesToMainWorker, once for operation response
      expect(sendToMainWorkerStub.calls.length).toBeGreaterThanOrEqual(1)
      const lastCall = sendToMainWorkerStub.calls[sendToMainWorkerStub.calls.length - 1]
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(true)
      sendToMainWorkerStub.restore()
    })

    it('Verify that handleTaskFunctionOperationMessage() handles unknown operation', () => {
      const worker = new ThreadWorker(() => {})
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.handleTaskFunctionOperationMessage({
        taskFunctionOperation: 'unknown',
        taskFunctionProperties: { name: 'fn' },
      })
      assertSpyCalls(sendToMainWorkerStub, 1)
      const lastCall = sendToMainWorkerStub.calls[0]
      expect(lastCall.args[0].taskFunctionOperationStatus).toBe(false)
      expect(lastCall.args[0].workerError.error.message).toMatch(
        /Unknown task function operation/,
      )
      sendToMainWorkerStub.restore()
    })

    it('Verify that handleTaskFunctionOperationMessage() throws without properties', () => {
      const worker = new ThreadWorker(() => {})
      expect(() =>
        worker.handleTaskFunctionOperationMessage({
          taskFunctionOperation: 'add',
        })
      ).toThrow(
        /Cannot handle task function operation message without task function properties/,
      )
    })

    it('Verify that handleTaskFunctionOperationMessage() throws add without function', () => {
      const worker = new ThreadWorker(() => {})
      expect(() =>
        worker.handleTaskFunctionOperationMessage({
          taskFunctionOperation: 'add',
          taskFunctionProperties: { name: 'fn' },
        })
      ).toThrow(
        /Cannot handle task function operation add message without task function/,
      )
    })
  })

  describe('Check active mechanism', () => {
    it('Verify that startCheckActive() starts the interval', () => {
      const worker = new ThreadWorker(() => {})
      expect(worker.activeInterval).toBeUndefined()
      worker.startCheckActive()
      expect(worker.activeInterval).toBeDefined()
      worker.stopCheckActive()
    })

    it('Verify that stopCheckActive() stops the interval', () => {
      const worker = new ThreadWorker(() => {})
      worker.startCheckActive()
      expect(worker.activeInterval).toBeDefined()
      worker.stopCheckActive()
      expect(worker.activeInterval).toBeUndefined()
    })

    it('Verify that checkActive() sends kill on inactivity', async () => {
      const worker = new ThreadWorker(() => {}, { maxInactiveTime: 10 })
      const sendToMainWorkerStub = stub(worker, 'sendToMainWorker')
      worker.startCheckActive()
      await sleep(20)
      // May be called multiple times due to interval, check at least once
      expect(sendToMainWorkerStub.calls.length).toBeGreaterThanOrEqual(1)
      expect(sendToMainWorkerStub.calls[0].args[0]).toStrictEqual({
        kill: KillBehaviors.SOFT,
      })
      worker.stopCheckActive()
      sendToMainWorkerStub.restore()
    })
  })
})
