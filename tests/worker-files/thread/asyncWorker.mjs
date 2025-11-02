import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import { sleepTaskFunction } from '../../test-utils.mjs'

/**
 * Asynchronous sleep function for testing purposes.
 * @param data - The input data for the sleep task.
 * @returns A promise that resolves after sleeping for 2000ms.
 */
async function sleep(data) {
  return await sleepTaskFunction(data, 2000)
}

export default new ThreadWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
