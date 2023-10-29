import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'

/** */
function test() {}

export default new ThreadWorker(test, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
