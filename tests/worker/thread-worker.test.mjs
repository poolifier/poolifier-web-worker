import { describe, expect, mock, test } from 'bun:test'
import { ThreadWorker } from '../../lib/index.js'

describe('Thread worker test suite', () => {
  class SpyWorker extends ThreadWorker {
    constructor (fn) {
      super(fn)
      this.port = {
        postMessage: mock(() => {})
      }
    }
  }

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
