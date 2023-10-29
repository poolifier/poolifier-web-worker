import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'

/** */
function error() {
  throw new Error('Error Message from ThreadWorker')
}

export default new ThreadWorker(error, {
  killBehavior: KillBehaviors.HARD,
  maxInactiveTime: 500,
})
