import { describe, expect, mock, test } from 'bun:test'
import { DEFAULT_TASK_NAME, ThreadWorker } from '../../lib/index.js'

describe('Thread worker test suite', () => {
  class SpyWorker extends ThreadWorker {
    constructor (fn) {
      super(fn)
      this.port = {
        postMessage: mock(() => {})
      }
    }
  }

  test('Verify that sync kill handler is called when worker is killed', () => {
    const worker = new ThreadWorker(() => {}, {
      killHandler: mock(() => {})
    })
    worker.isMain = false
    worker.port = {
      postMessage: mock(() => {}),
      unref: mock(() => {}),
      close: mock(() => {})
    }
    worker.handleKillMessage()
    expect(worker.port.postMessage).toHaveBeenCalledTimes(1)
    expect(worker.port.unref).toHaveBeenCalledTimes(1)
    expect(worker.port.close).toHaveBeenCalledTimes(1)
    expect(worker.opts.killHandler).toHaveBeenCalledTimes(1)
  })

  test('Verify that removeTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    expect(worker.removeTaskFunction(0, fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string')
    })
    expect(worker.removeTaskFunction('', fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is an empty string')
    })
    worker.port = {
      postMessage: mock(() => {})
    }
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.size).toBe(3)
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toStrictEqual(
      worker.taskFunctions.get('fn1')
    )
    expect(worker.removeTaskFunction(DEFAULT_TASK_NAME)).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot remove the task function with the default reserved name'
      )
    })
    expect(worker.removeTaskFunction('fn1')).toStrictEqual({
      status: false,
      error: new Error(
        'Cannot remove the task function used as the default task function'
      )
    })
    worker.removeTaskFunction('fn2')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeUndefined()
    expect(worker.taskFunctions.size).toBe(2)
    expect(worker.port.postMessage).toHaveBeenCalledTimes(1)
  })

  test('Verify that handleError() method is working properly', () => {
    const error = new Error('Error as an error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toBeInstanceOf(Error)
    expect(worker.handleError(error)).toStrictEqual(error)
    const errorMessage = 'Error as a string'
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })

  test('Verify worker invokes the postMessage() method on port property', () => {
    const worker = new SpyWorker(() => {})
    worker.sendToMainWorker({ ok: 1 })
    expect(worker.port.postMessage).toHaveBeenCalledTimes(1)
  })
})
