import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { assertSpyCalls, stub } from '@std/testing/mock'
import {
  KillBehaviors,
  ThreadWorker,
  WorkerChoiceStrategies,
} from '../../src/mod.ts'
import { DEFAULT_TASK_NAME, EMPTY_FUNCTION } from '../../src/utils.ts'

describe('Abstract worker test suite', () => {
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

  it('Verify that async kill handler is called when worker is killed', () => {
    const killHandlerStub = stub(() => {})
    const worker = new ThreadWorker(() => {}, {
      killHandler: async () => await Promise.resolve(killHandlerStub()),
    })
    worker.handleKillMessage()
    assertSpyCalls(killHandlerStub, 1)
    killHandlerStub.restore()
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
})
