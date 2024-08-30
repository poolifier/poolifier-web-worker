import {
  availableParallelism,
  DynamicThreadPool,
  PoolEvents,
} from 'jsr:@poolifier/poolifier-web-worker@^0.4.25' // x-release-please-version

const pool = new DynamicThreadPool(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  new URL('./yourWorker.js', import.meta.url),
  {
    errorEventHandler: (e) => {
      console.error(e)
    },
  },
)
let poolFull = 0
let poolReady = 0
let poolBusy = 0
pool.eventTarget?.addEventListener(PoolEvents.full, () => poolFull++)
pool.eventTarget?.addEventListener(PoolEvents.ready, () => poolReady++)
pool.eventTarget?.addEventListener(PoolEvents.busy, () => poolBusy++)

let resolved = 0
const start = performance.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  try {
    await pool.execute()
    resolved++
    if (resolved === iterations) {
      console.info(`Time taken is ${(performance.now() - start).toFixed(2)}ms`)
      console.info(`The pool was full for ${poolFull} times`)
      console.info(`The pool was ready for ${poolReady} times`)
      console.info(`The pool was busy for ${poolBusy} times`)
      await pool.destroy()
      break
    }
  } catch (err) {
    console.error(err)
  }
}
