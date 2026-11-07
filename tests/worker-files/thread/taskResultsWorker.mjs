import { ThreadWorker } from '../../../src/mod.ts'
import { opaqueThenable } from './opaqueThenable.mjs'
import { singleReadPromise as withSingleReadThen } from './singleReadPromise.mjs'

const PromiseConstructor =
  new URL(import.meta.url).searchParams.get('realm') === 'foreign'
    ? (await import('node:vm')).runInNewContext('Promise')
    : Promise

let calls = 0

const prepare = (data) => {
  calls++
  if (data.port != null) {
    data.port.onmessage = ({ data: message }) => {
      data.port.postMessage(message)
    }
  }
}

const result = (data) => {
  if (data.fail === true) throw new Error(data.label)
  return { calls, value: data.label }
}

const synchronous = (data) => {
  prepare(data)
  return result(data)
}

const ordinaryPromise = (data) => {
  prepare(data)
  return new PromiseConstructor((resolve, reject) => {
    const complete = () => {
      try {
        resolve(result(data))
      } catch (error) {
        reject(error)
      }
    }
    if (data.wait === true) {
      const release = ({ data: message }) => {
        if (message.release === data.label) {
          self.removeEventListener('message', release)
          complete()
          self.postMessage({ settled: data.label })
        }
      }
      self.addEventListener('message', release)
      self.postMessage({ started: data.label })
    } else {
      complete()
    }
  })
}

const singleReadPromise = (data) => withSingleReadThen(ordinaryPromise(data))

const asynchronous = async (data) => {
  prepare(data)
  await Promise.resolve()
  return result(data)
}

class HookedThreadWorker extends ThreadWorker {
  runAsync = ((original) => (fn, task) => {
    if (task.data?.legacyHook === true) {
      original(
        async (data) => ({ ...await fn(data), legacyHook: true }),
        task,
      )
    } else {
      original(fn, task)
    }
  })(this.runAsync)
}

export default new HookedThreadWorker({
  synchronous,
  ordinaryPromise,
  singleReadPromise,
  opaqueThenable: (data) => opaqueThenable(ordinaryPromise(data), data.trap),
  asynchronous,
})
