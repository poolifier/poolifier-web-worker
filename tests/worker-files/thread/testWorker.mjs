import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import { TaskFunctions } from '../../test-types.mjs'
import { executeTaskFunction } from '../../test-utils.mjs'

/**
 * Test function that executes various task functions for testing purposes.
 * @param data - The input data containing function type and parameters.
 * @returns The result of executing the specified task function.
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
