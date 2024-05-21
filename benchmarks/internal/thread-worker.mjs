import { ThreadWorker } from '../../src/mod.ts'
import { TaskFunctions } from '../benchmarks-types.mjs'
import { executeTaskFunction } from '../benchmarks-utils.mjs'

const taskFunction = (data) => {
  data = data || {}
  data.function = data.function || TaskFunctions.factorial
  const res = executeTaskFunction(data)
  return res
}

export default new ThreadWorker(taskFunction)
