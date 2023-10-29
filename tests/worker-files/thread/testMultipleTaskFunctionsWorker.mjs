import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} from '../../test-utils.mjs'

export default new ThreadWorker(
  {
    jsonIntegerSerialization: (data) => jsonIntegerSerialization(data.n),
    factorial: (data) => factorial(data.n),
    fibonacci: (data) => fibonacci(data.n),
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  },
)
