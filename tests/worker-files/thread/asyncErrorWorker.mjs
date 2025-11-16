import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import { sleepTaskFunction } from '../../test-utils.mjs'

/**
 * Asynchronous error function for testing error handling.
 * @param data - The input data for the error task.
 * @returns A promise that rejects with an error after 2000ms sleep.
 */
async function error(data) {
  return await sleepTaskFunction(
    data,
    2000,
    true,
    'Error Message from ThreadWorker:async',
  )
}

export default new ThreadWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
