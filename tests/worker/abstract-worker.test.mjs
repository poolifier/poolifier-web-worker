import {
  assertSpyCalls,
  stub,
} from 'https://deno.land/std@0.208.0/testing/mock.ts'
import { expect } from 'npm:expect'
import { KillBehaviors, ThreadWorker } from '../../src/mod.ts'
import { DEFAULT_TASK_NAME, EMPTY_FUNCTION } from '../../src/utils.ts'

Deno.test('Abstract worker test suite', async (t) => {
  await t.step('Verify worker options default values', () => {
    const worker = new ThreadWorker(() => {})
    expect(worker.opts).toStrictEqual({
      killBehavior: KillBehaviors.SOFT,
      maxInactiveTime: 60000,
      killHandler: EMPTY_FUNCTION,
    })
  })

  await t.step(
    'Verify that worker options are checked at worker creation',
    () => {
      expect(() => new ThreadWorker(() => {}, '')).toThrow(
        new TypeError('opts worker options parameter is not a plain object'),
      )
      expect(() => new ThreadWorker(() => {}, { killBehavior: '' })).toThrow(
        new TypeError('killBehavior option \'\' is not valid'),
      )
      expect(() => new ThreadWorker(() => {}, { killBehavior: 0 })).toThrow(
        new TypeError('killBehavior option \'0\' is not valid'),
      )
      expect(() => new ThreadWorker(() => {}, { maxInactiveTime: '' })).toThrow(
        new TypeError('maxInactiveTime option is not an integer'),
      )
      expect(() => new ThreadWorker(() => {}, { maxInactiveTime: 0.5 }))
        .toThrow(
          new TypeError('maxInactiveTime option is not an integer'),
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
    },
  )

  await t.step('Verify that worker options are set at worker creation', () => {
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

  await t.step('Verify that taskFunctions parameter is mandatory', () => {
    expect(() => new ThreadWorker()).toThrow(
      new Error('taskFunctions parameter is mandatory'),
    )
  })

  await t.step(
    'Verify that taskFunctions parameter is a function or a plain object',
    () => {
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
    },
  )

  await t.step(
    'Verify that taskFunctions parameter is not an empty object',
    () => {
      expect(() => new ThreadWorker({})).toThrow(
        new Error('taskFunctions parameter object is empty'),
      )
    },
  )

  await t.step(
    'Verify that taskFunctions parameter with unique function is taken',
    () => {
      const worker = new ThreadWorker(() => {})
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
        Function,
      )
      expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
      expect(worker.taskFunctions.size).toBe(2)
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
        worker.taskFunctions.get('fn1'),
      )
    },
  )

  await t.step(
    'Verify that taskFunctions parameter with multiple task functions is checked',
    () => {
      const fn1 = () => {
        return 1
      }
      const fn2 = ''
      expect(() => new ThreadWorker({ '': fn1 })).toThrow(
        new TypeError(
          'A taskFunctions parameter object key is an empty string',
        ),
      )
      expect(() => new ThreadWorker({ fn1, fn2 })).toThrow(
        new TypeError(
          'A taskFunctions parameter object value is not a function',
        ),
      )
    },
  )

  await t.step(
    'Verify that taskFunctions parameter with multiple task functions is taken',
    () => {
      const fn1 = () => {
        return 1
      }
      const fn2 = () => {
        return 2
      }
      const worker = new ThreadWorker({ fn1, fn2 })
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
        Function,
      )
      expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
      expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Function)
      expect(worker.taskFunctions.size).toBe(3)
      expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
        worker.taskFunctions.get('fn1'),
      )
    },
  )

  await t.step(
    'Verify that async kill handler is called when worker is killed',
    () => {
      const killHandlerStub = stub(() => {})
      const worker = new ThreadWorker(() => {}, {
        killHandler: async () => await Promise.resolve(killHandlerStub()),
      })
      worker.handleKillMessage()
      assertSpyCalls(killHandlerStub, 1)
      killHandlerStub.restore()
    },
  )

  await t.step('Verify that hasTaskFunction() is working', () => {
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

  await t.step('Verify that addTaskFunction() is working', () => {
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
    expect(worker.addTaskFunction('fn3', '')).toStrictEqual({
      status: false,
      error: new TypeError('fn parameter is not a function'),
    })
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
      Function,
    )
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
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
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
      Function,
    )
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
    worker.addTaskFunction('fn1', fn1Replacement)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
      Function,
    )
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1'),
    )
  })

  await t.step('Verify that listTaskFunctionNames() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.listTaskFunctionNames()).toStrictEqual([
      DEFAULT_TASK_NAME,
      'fn1',
      'fn2',
    ])
  })

  await t.step('Verify that setDefaultTaskFunction() is working', () => {
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
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
      Function,
    )
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Function)
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
