import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import { sleepTaskFunction } from '../../test-utils.mjs'

/**
 * @param data
 * @returns
 */
async function sleep(data) {
  return await sleepTaskFunction(data, 2000)
}

export default new ThreadWorker(sleep, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
