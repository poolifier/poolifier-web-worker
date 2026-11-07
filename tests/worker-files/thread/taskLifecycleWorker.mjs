import { ThreadWorker } from '../../../src/mod.ts'

let executions = 0
const echo = (data) => ({ value: data.value, executions: ++executions })
const gate = async ({ gate, value }) => {
  executions++
  self.postMessage({ started: value })
  await Atomics.waitAsync(new Int32Array(gate), 0, 0).value
  self.postMessage({ released: value })
  return value
}

class TaskLifecycleWorker extends ThreadWorker {
  holdOperations = false
  operationSequence = 0
  pendingOperations = new Map()
  registrationCounts = new Map()

  handleTaskFunctionOperationMessage(message) {
    if (message.taskFunctionOperation === 'add') {
      const name = message.taskFunctionProperties.name
      this.registrationCounts.set(
        name,
        (this.registrationCounts.get(name) ?? 0) + 1,
      )
    }
    if (this.holdOperations) {
      const sequence = ++this.operationSequence
      this.pendingOperations.set(sequence, message)
      self.postMessage({
        operationQueued: sequence,
        operationId: message.taskFunctionOperationId,
        operation: message.taskFunctionOperation,
        name: message.taskFunctionProperties.name,
      })
      return
    }
    super.handleTaskFunctionOperationMessage(message)
  }

  releaseOperation(sequence, repeat = false) {
    const message = this.pendingOperations.get(sequence)
    if (message == null) return
    this.pendingOperations.delete(sequence)
    super.handleTaskFunctionOperationMessage(message)
    if (repeat) {
      // Process a duplicate real request, producing a second genuine native ACK.
      super.handleTaskFunctionOperationMessage(message)
    }
  }
}

const worker = new TaskLifecycleWorker({ echo, named: gate, gate })

self.addEventListener('message', ({ data }) => {
  if (data.crash === true) throw new Error('Lifecycle worker crashed')
  if (data.configureOperations != null) {
    worker.holdOperations = data.configureOperations
    worker.operationSequence = 0
    self.postMessage({ configured: data.token })
  }
  if (data.releaseOperation != null) {
    worker.releaseOperation(data.releaseOperation, data.repeat)
  }
  if (data.releaseAllOperations === true) {
    worker.holdOperations = false
    for (const sequence of worker.pendingOperations.keys()) {
      worker.releaseOperation(sequence)
    }
  }
  if (data.registrationCounts != null) {
    self.postMessage({
      registrationCounts: data.registrationCounts,
      counts: [...worker.registrationCounts],
    })
  }
})

export default worker
