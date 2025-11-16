import { ThreadWorker } from '../../../src/mod.ts'
import { sleepTaskFunction } from '../../test-utils.mjs'

/**
 * Long-running sleep function for testing soft kill behavior.
 * @param data - The input data for the sleep task.
 * @returns A promise that resolves after sleeping for 50000ms.
 */
async function sleep(data) {
  return await sleepTaskFunction(data, 50000)
}

export default new ThreadWorker(sleep, {
  maxInactiveTime: 500,
})
