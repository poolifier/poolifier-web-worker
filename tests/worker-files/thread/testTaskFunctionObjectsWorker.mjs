import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'
import {
  factorial,
  fibonacci,
  jsonIntegerSerialization,
} from '../../test-utils.mjs'

export default new ThreadWorker(
  {
    factorial: {
      taskFunction: (data) => factorial(data.n),
      workerNodeKeys: [0],
    },
    fibonacci: {
      priority: -5,
      taskFunction: (data) => fibonacci(data.n),
      workerNodeKeys: [0, 1],
    },
    jsonIntegerSerialization: {
      taskFunction: (data) => jsonIntegerSerialization(data.n),
    },
  },
  {
    killBehavior: KillBehaviors.HARD,
    maxInactiveTime: 500,
  },
)
