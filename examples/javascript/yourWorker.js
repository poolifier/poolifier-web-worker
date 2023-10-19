import { ThreadWorker } from 'https://deno.land/x/poolifier@v0.0.4/src/index.ts'

function yourFunction() {
  for (let i = 0; i <= 1000; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

export default new ThreadWorker(yourFunction)
