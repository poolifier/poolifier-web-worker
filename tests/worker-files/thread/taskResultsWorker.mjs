import { ThreadWorker } from '../../../src/mod.ts'

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
  return new Promise((resolve, reject) => {
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
        }
      }
      self.addEventListener('message', release)
      self.postMessage({ started: data.label })
    } else {
      complete()
    }
  })
}

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
  asynchronous,
})
