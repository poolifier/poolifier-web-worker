import { ThreadWorker } from '../../src/mod.ts'
import { executeTaskFunction } from '../benchmarks-utils.mjs'
import { TaskFunctions } from '../benchmarks-types.mjs'

const taskFunction = (data) => {
  data = data || {}
  data.function = data.function || TaskFunctions.jsonIntegerSerialization
  const res = executeTaskFunction(data)
  return res
}

export default new ThreadWorker(taskFunction)
