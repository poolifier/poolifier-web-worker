import { assertSpyCalls, stub } from '$std/testing/mock.ts'
import { expect } from 'expect'
import { ThreadWorker } from '../../src/mod.ts'
import { DEFAULT_TASK_NAME } from '../../src/utils.ts'

Deno.test('Thread worker test suite', async (t) => {
  await t.step(
    'Verify that sync kill handler is called when worker is killed',
    () => {
      const worker = new ThreadWorker(() => {}, {
        killHandler: stub(() => {}),
      })
      worker.port = {
        postMessage: stub(() => {}),
        close: stub(() => {}),
      }
      worker.handleKillMessage()
      assertSpyCalls(worker.port.postMessage, 1)
      assertSpyCalls(worker.port.close, 1)
      assertSpyCalls(worker.opts.killHandler, 1)
      worker.opts.killHandler.restore()
      worker.port.postMessage.restore()
      worker.port.close.restore()
    },
  )

  await t.step('Verify that removeTaskFunction() is working', () => {
    const fn1 = () => {
      return 1
    }
    const fn2 = () => {
      return 2
    }
    const worker = new ThreadWorker({ fn1, fn2 })
    worker.port = {
      postMessage: stub(() => {}),
    }
    expect(worker.removeTaskFunction(0, fn1)).toStrictEqual({
      status: false,
      error: new TypeError('name parameter is not a string'),
    })
    expect(worker.removeTaskFunction('', fn1)).toStrictEqual({
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
    worker.removeTaskFunction('fn2')
    expect(worker.taskFunctions.get(DEFAULT_TASK_NAME)).toBeInstanceOf(
      Function,
    )
    expect(worker.taskFunctions.get('fn1')).toBeInstanceOf(Function)
    expect(worker.taskFunctions.get('fn2')).toBeUndefined()
    expect(worker.taskFunctions.size).toBe(2)
    assertSpyCalls(worker.port.postMessage, 1)
    worker.port.postMessage.restore()
  })

  await t.step('Verify that handleError() method is working properly', () => {
    const error = new Error('Error as an error')
    const worker = new ThreadWorker(() => {})
    expect(worker.handleError(error)).toBeInstanceOf(Error)
    expect(worker.handleError(error)).toStrictEqual(error)
    const errorMessage = 'Error as a string'
    expect(worker.handleError(errorMessage)).toStrictEqual(errorMessage)
  })

  await t.step(
    'Verify that sendToMainWorker() method invokes the port property postMessage() method',
    () => {
      const worker = new ThreadWorker(() => {})
      worker.port = {
        postMessage: stub(() => {}),
      }
      worker.sendToMainWorker({ ok: 1 })
      assertSpyCalls(worker.port.postMessage, 1)
      worker.port.postMessage.restore()
    },
  )
})
