import { KillBehaviors, ThreadWorker } from '../../../src/index.ts'

/** */
function test() {}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
