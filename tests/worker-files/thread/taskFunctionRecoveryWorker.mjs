import { ThreadWorker } from '../../../src/mod.ts'

const notify = (message) => self.postMessage(message)

class TaskFunctionRecoveryWorker extends ThreadWorker {
  constructor(...args) {
    super(...args)
    self.addEventListener('message', ({ data: message }) => {
      if (message.control === 'hold') {
        this.heldOperation = {
          name: message.name,
          operation: message.operation,
        }
      } else if (message.control === 'release') {
        const pending = this.pendingOperation
        this.pendingOperation = undefined
        if (pending != null) super.handleTaskFunctionOperationMessage(pending)
      } else if (message.control === 'refuseRemoval') {
        this.refusedRemoval = message.name
        this.refusedRemovalPrerequisite = message.prerequisite
        this.refusedRemovalResult =
          message.name == null || message.prerequisite != null
            ? undefined
            : super.removeTaskFunction(message.name)
      } else {
        return
      }
      notify({ control: message.control, workerId: this.id })
    })
  }

  handleTaskFunctionOperationMessage(message) {
    if (
      this.heldOperation?.operation === message.taskFunctionOperation &&
      this.heldOperation.name === message.taskFunctionProperties?.name
    ) {
      this.heldOperation = undefined
      this.pendingOperation = message
      notify({
        heldOperation: message.taskFunctionOperation,
        workerId: this.id,
      })
      return
    }
    super.handleTaskFunctionOperationMessage(message)
  }

  removeTaskFunction(name) {
    if (this.refusedRemoval != null && name === this.refusedRemoval) {
      return this.refusedRemovalPrerequisite == null
        ? this.refusedRemovalResult
        : super.removeTaskFunction(this.refusedRemovalPrerequisite)
    }
    return super.removeTaskFunction(name)
  }
}

export default new TaskFunctionRecoveryWorker({ echo: (data) => data })
