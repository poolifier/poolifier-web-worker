import { ThreadWorker } from '../../../src/mod.ts'
import { singleReadPromise } from './singleReadPromise.mjs'

const params = new URL(import.meta.url).searchParams
const mode = params.get('mode')
const failure = params.get('failure') === 'true'
const PromiseConstructor = mode === 'foreign' || mode === 'foreign-decorated'
  ? (await import('node:vm')).runInNewContext('Promise')
  : Promise
let state
let calls = 0

self.addEventListener('message', ({ data }) => {
  if (data.state != null) {
    state = new Int32Array(data.state)
    self.postMessage({ configured: true })
  }
})

const finish = () => {
  Atomics.store(state, 0, 2)
  if (failure) throw new Error('Cleanup failed')
}

const begin = () => {
  calls++
  Atomics.store(state, 1, calls)
  Atomics.store(state, 0, 1)
  self.postMessage({ cleanup: 'started' })
}

const ordinaryPromise = () => {
  begin()
  return new PromiseConstructor((resolve, reject) => {
    self.addEventListener('message', ({ data }) => {
      if (data.release !== true) return
      try {
        finish()
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
}

const asynchronous = async () => {
  await ordinaryPromise()
}

const synchronous = () => {
  begin()
  finish()
}

const killHandlers = {
  async: asynchronous,
  promise: ordinaryPromise,
  foreign: ordinaryPromise,
  decorated: () => singleReadPromise(ordinaryPromise()),
  'foreign-decorated': () => singleReadPromise(ordinaryPromise()),
}
const killHandler = killHandlers[mode] ?? synchronous

export default new ThreadWorker(() => 'ready', { killHandler })
