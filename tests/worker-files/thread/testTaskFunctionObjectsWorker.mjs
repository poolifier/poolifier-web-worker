import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} from '../../test-utils.mjs'

export default new ThreadWorker(
  {
    jsonIntegerSerialization: {
      taskFunction: (data) => jsonIntegerSerialization(data.n),
    },
    factorial: { taskFunction: (data) => factorial(data.n) },
    fibonacci: { taskFunction: (data) => fibonacci(data.n), priority: -5 },
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  },
)
