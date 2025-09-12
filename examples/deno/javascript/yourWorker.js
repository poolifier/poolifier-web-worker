import { ThreadWorker } from '@poolifier/poolifier-web-worker'

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
