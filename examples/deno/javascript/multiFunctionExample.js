import {
  availableParallelism,
  FixedThreadPool,
} from 'jsr:@poolifier/poolifier-web-worker@^0.5.2' // x-release-please-version

const pool = new FixedThreadPool(
  availableParallelism(),
  new URL('./multiFunctionWorker.js', import.meta.url),
  {
    errorEventHandler: (e) => {
      console.error(e)
    },
  },
)

try {
  const res = await pool.execute({ text: 'hello' }, 'fn0')
  console.info(res)
} catch (err) {
  console.error(err)
}

try {
  const res = await pool.execute({ text: 'multiple functions' }, 'fn1')
  console.info(res)
} catch (err) {
  console.error(err)
}

setTimeout(async () => await pool.destroy(), 3000)
