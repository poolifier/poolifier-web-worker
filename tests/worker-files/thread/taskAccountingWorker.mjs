import { ThreadWorker } from '../../../src/mod.ts'

const run = async ({ fail, gate, label }) => {
  self.postMessage({ label })
  if (gate != null) {
    await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
  }
  if (fail === true) {
    throw new Error(label)
  }
  return label
}

// Affinity selects a real queue without replacing the pool's selection logic.
const pinnedWorker = new URL(import.meta.url).searchParams.get('pinned-worker')
const taskFunctions = pinnedWorker == null ? run : {
  run,
  pinned: { taskFunction: run, workerNodeKeys: [Number(pinnedWorker)] },
}

export default new ThreadWorker(taskFunctions, {
  maxInactiveTime: 100,
})
