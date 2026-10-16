import { ThreadWorker } from '../../../src/mod.ts'

const pendingTasks = new Map()
let released = false

self.addEventListener('message', ({ data: message }) => {
  if (Object.hasOwn(message, 'crashWith')) {
    throw message.crashWith
  }
  if (message.crash === true) {
    throw new Error('Worker crashed')
  }
  if (message.release != null) {
    pendingTasks.get(message.release)?.()
    pendingTasks.delete(message.release)
  }
  if (message.releaseAll === true) {
    released = true
    for (const resolve of pendingTasks.values()) resolve()
    pendingTasks.clear()
  }
})

export default new ThreadWorker(async (data) => {
  if (data.crashAfterResponse != null) {
    const status = new Int32Array(data.crashAfterResponse)
    setTimeout(() => {
      Atomics.store(status, 0, 1)
      Atomics.notify(status, 0)
      throw new Error('Worker crashed after task response')
    }, 0)
    if (data.fail === true) throw new Error('Task failed before worker crash')
    return data.response
  }
  if (data.wait === true && !released) {
    await new Promise((resolve) => {
      pendingTasks.set(data.id, resolve)
      self.postMessage({ started: data.id })
    })
  }
  return data
})
