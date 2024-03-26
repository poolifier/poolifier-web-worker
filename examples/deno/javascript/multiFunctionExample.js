import {
  availableParallelism,
  FixedThreadPool,
} from 'jsr:@poolifier/poolifier-web-worker@^0.3.8'

const pool = new FixedThreadPool(
  availableParallelism(),
  new URL('./multiFunctionWorker.js', import.meta.url),
)

pool
  .execute({ text: 'hello' }, 'fn0')
  .then((res) => console.info(res))
  .catch((err) => console.error(err))
pool
  .execute({ text: 'multiple functions' }, 'fn1')
  .then((res) => console.info(res))
  .catch((err) => console.error(err))

setTimeout(async () => await pool.destroy(), 3000)
