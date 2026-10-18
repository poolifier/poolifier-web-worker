import { expect } from '@std/expect'
import { it } from '@std/testing/bdd'
import {
  DynamicThreadPool as BaseDynamicThreadPool,
  FixedThreadPool as BaseFixedThreadPool,
} from '../src/mod.ts'

const configuredPool = (Pool, optionsIndex) =>
  class extends Pool {
    constructor(...args) {
      const options = args[optionsIndex]
      if (options?.workerOptions != null) {
        const original = options.workerOptions
        const descriptors = Object.getOwnPropertyDescriptors(original)
        delete descriptors.workerData
        args[optionsIndex] = {
          ...options,
          workerOptions: Object.defineProperties({}, descriptors),
          fixtureConfiguration: () => original.workerData,
        }
      }
      super(...args)
    }

    sendStartupMessageToWorker(workerNodeKey) {
      const node = this.workerNodes[workerNodeKey]
      node.worker.addEventListener('error', (event) => event.preventDefault())
      const fixtureData = {
        ...this.opts.fixtureConfiguration?.(),
        bufferedAck: new SharedArrayBuffer(4),
      }
      node.fixtureData = fixtureData
      const port = node.messageChannel.port2
      node.worker.postMessage({
        ready: false,
        workerId: node.info.id,
        port,
        fixtureData,
      }, [port])
    }
  }

export const FixedThreadPool = configuredPool(BaseFixedThreadPool, 2)
export const DynamicThreadPool = configuredPool(BaseDynamicThreadPool, 3)

export const once = (target, event) =>
  new Promise((resolve) => {
    target.addEventListener(event, resolve, { once: true })
  })

export const each = (cases) => (name, run) => {
  for (const entry of cases) {
    const args = Array.isArray(entry) ? entry : [entry]
    let index = 0
    const title = name.replace(/%[si]/g, () => String(args[index++]))
    it(title, () => run(...args))
  }
}

export const waitFor = async (assertion, { timeout = 5000 } = {}) => {
  const deadline = performance.now() + timeout
  for (;;) {
    try {
      await assertion()
      return
    } catch (error) {
      if (performance.now() >= deadline) throw error
      await new Promise((resolve) => setTimeout(resolve, 5))
    }
  }
}

export const deferWorkerMessagesUntilExit = (node) => {
  const port = node.messageChannel.port1
  const listener = port.onmessage
  // Block the parent event loop until a real native port response is queued.
  // The exit consumer must drain it before WorkerNode closes the port.
  port.onmessage = null
  const state = new Int32Array(node.fixtureData.bufferedAck)
  expect(Atomics.wait(state, 0, 0, 5000)).not.toBe('timed-out')
  node.terminate()
  return () => {
    if (node.messageChannel != null) port.onmessage = listener
  }
}
