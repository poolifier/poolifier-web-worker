import { ThreadWorker } from 'jsr:@poolifier/poolifier-web-worker@^0.5.8' // x-release-please-version

function fn0(data) {
  console.info('Executing fn0')
  return { data: `fn0 input text was '${data.text}'` }
}

function fn1(data) {
  console.info('Executing fn1')
  return { data: `fn1 input text was '${data.text}'` }
}

export default new ThreadWorker({ fn0, fn1 })
