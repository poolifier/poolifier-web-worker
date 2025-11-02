import { KillBehaviors, ThreadWorker } from '../../../src/mod.ts'

/**
 * Echo function that returns the input data unchanged.
 * @param data - The input data to echo.
 * @returns The same data that was passed in.
 */
function echo(data) {
  return data
}

export default new ThreadWorker(echo, {
  killBehavior: KillBehaviors.HARD,
})
