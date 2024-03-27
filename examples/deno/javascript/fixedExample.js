import {
  availableParallelism,
  FixedThreadPool,
  PoolEvents,
} from 'jsr:@poolifier/poolifier-web-worker@^0.3.9'

const pool = new FixedThreadPool(
  availableParallelism(),
  new URL('./yourWorker.js', import.meta.url),
)
let poolReady = 0
let poolBusy = 0
pool.eventTarget?.addEventListener(PoolEvents.ready, () => poolReady++)
pool.eventTarget?.addEventListener(PoolEvents.busy, () => poolBusy++)

let resolved = 0
const start = performance.now()
const iterations = 1000
for (let i = 1; i <= iterations; i++) {
  pool
    .execute()
    .then(() => {
      resolved++
      if (resolved === iterations) {
        console.info(
          `Time taken is ${(performance.now() - start).toFixed(2)}ms`,
        )
        console.info(`The pool was ready for ${poolReady} times`)
        console.info(`The pool was busy for ${poolBusy} times`)
        return pool.destroy()
      }
    })
    .catch((err) => console.error(err))
}
