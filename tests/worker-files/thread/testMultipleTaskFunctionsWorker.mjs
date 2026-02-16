import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} from '../../test-utils.mjs'

export default new ThreadWorker(
  {
    jsonIntegerSerialization: (data) => jsonIntegerSerialization(data.n),
    factorial: {
      priority: 1,
      taskFunction: (data) => factorial(data.n),
      workerNodeKeys: [0],
    },
    fibonacci: {
      priority: 2,
      taskFunction: (data) => fibonacci(data.n),
      workerNodeKeys: [0, 1],
    },
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  },
)
