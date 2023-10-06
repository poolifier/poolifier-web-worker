import { ThreadWorker } from '../../../src/index.ts'
import { sleepTaskFunction } from '../../test-utils.mjs'

/**
 * @param data
 * @returns
 */
async function sleep(data) {
  return await sleepTaskFunction(data, 50000)
}

export default new ThreadWorker(sleep, {
  maxInactiveTime: 500,
})
