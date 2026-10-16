import { ThreadWorker } from '../../../src/mod.ts'

let killGate

const waitForGate = async (gate) => {
  await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
}

const run = async ({ gate, label }) => {
  self.postMessage({ label, workerId: worker.id })
  await waitForGate(gate)
  return { label, workerId: worker.id }
}

// Entry order defines the default function independently of key sorting.
const taskFunctions = Object.fromEntries([
  ['loader', { taskFunction: run, workerNodeKeys: [0] }],
  ['anchor', { taskFunction: run, workerNodeKeys: [0, 2] }],
  ['survivor', { taskFunction: run, workerNodeKeys: [0, 3] }],
])

const worker = new ThreadWorker(taskFunctions, {
  killHandler: () => {
    self.postMessage({ label: 'kill-handler', workerId: worker.id })
    if (killGate != null) {
      Atomics.wait(new Int32Array(killGate), 0, 0)
    }
    // Return synchronously so ThreadWorker sends kill:success before closing its
    // port. The pool then performs native termination (including on Deno).
  },
  maxInactiveTime: 1000,
})

self.addEventListener('message', ({ data }) => {
  if (data.killGate != null) {
    killGate = data.killGate
    self.postMessage({ label: 'configured', workerId: worker.id })
  }
})

export default worker
