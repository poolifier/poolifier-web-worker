import { ThreadWorker } from 'https://deno.land/x/poolifier@v0.0.3/src/index.ts'

function fn0(data) {
  console.info('Executing fn0')
  return { data: `fn0 input text was '${data.text}'` }
}

function fn1(data) {
  console.info('Executing fn1')
  return { data: `fn1 input text was '${data.text}'` }
}

export default new ThreadWorker({ fn0, fn1 })
