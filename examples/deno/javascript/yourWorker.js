import { ThreadWorker } from 'jsr:@poolifier/poolifier-web-worker@^0.4.21' // x-release-please-version

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
