import { KillBehaviors, ThreadWorker } from '../../../src/index.ts'
import { sleepTaskFunction } from '../../test-utils.mjs'

/**
 * @param data
 * @returns
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
