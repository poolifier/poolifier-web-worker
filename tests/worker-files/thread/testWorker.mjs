import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import { executeTaskFunction } from '../../test-utils.mjs'
import { TaskFunctions } from '../../test-types.mjs'

/**
 * @param data
 * @returns
 */
function test(data) {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  return executeTaskFunction(data)
}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
