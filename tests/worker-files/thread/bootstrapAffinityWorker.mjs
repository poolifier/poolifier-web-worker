import { ThreadWorker } from '../../../src/mod.ts'

const pendingTasks = new Map()
let released = false

const run = async (data, taskFunction) => {
  if (data.wait === true && !released) {
    await new Promise((resolve) => {
      pendingTasks.set(data.id, resolve)
      self.postMessage({ started: data.id })
    })
  }
  return { ...data, taskFunction, workerId: worker.id }
}

// Keep the real transferred bootstrap port unopened until the test releases it.
// This represents a worker whose module/task metadata has not finished loading.
class BootstrapAffinityWorker extends ThreadWorker {
  bootstrapEvent

  handleReadyMessageEvent(event) {
    this.bootstrapEvent = event
    self.postMessage({ bootstrapReceived: true })
  }

  releaseBootstrap(configuration = {}) {
    if (this.id != null) return
    this.addTaskFunction('pinned', {
      taskFunction: async (data) => await run(data, 'pinned'),
      ...(configuration.workerNodeKeys != null && {
        workerNodeKeys: configuration.workerNodeKeys,
      }),
    })
    if (configuration.defaultPinned === true) {
      this.setDefaultTaskFunction('pinned')
    }
    super.handleReadyMessageEvent(this.bootstrapEvent)
  }
}

const worker = new BootstrapAffinityWorker({
  echo: async (data) => await run(data, 'echo'),
})

self.addEventListener('message', ({ data: message }) => {
  if (message.crash === true) throw new Error('Worker crashed')
  if (message.releaseBootstrap != null) {
    worker.releaseBootstrap(message.releaseBootstrap)
  }
  if (message.release != null) {
    const resolve = pendingTasks.get(message.release)
    if (typeof resolve === 'function') resolve()
    pendingTasks.delete(message.release)
  }
  if (message.releaseAll === true) {
    released = true
    for (const resolve of pendingTasks.values()) resolve()
    pendingTasks.clear()
  }
})
