import {
  availableParallelism,
  FixedThreadPool,
} from 'https://deno.land/x/poolifier/src/index.ts'

const pool = new FixedThreadPool(
  availableParallelism(),
  new URL('./multiFunctionWorker.js', import.meta.url),
  {
    errorHandler: (e) => console.error(e),
    onlineHandler: () => console.info('worker is online'),
  },
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
