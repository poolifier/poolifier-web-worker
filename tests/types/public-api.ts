import {
  AbstractPool,
  AbstractWorker,
  CircularBuffer,
  FixedThreadPool,
  PriorityQueue,
  ThreadWorker,
  WorkerChoiceStrategiesContext,
} from '../../dist/esm/mod.js'

export type InternalTypes = {
  pool: AbstractPool<never, unknown, unknown>
  worker: AbstractWorker<EventTarget>
  buffer: CircularBuffer
  queue: PriorityQueue<unknown>
  strategies: WorkerChoiceStrategiesContext<never, unknown, unknown>
}

const pool = new FixedThreadPool<{ value: number }, { value: number }>(
  1,
  new URL('./worker.js', import.meta.url),
)
const response: Promise<{ value: number }> = pool.execute(
  { value: 1 },
  undefined,
  new AbortController().signal,
)
const worker = new ThreadWorker<{ value: number }, { value: number }>(
  (data) => Promise.resolve({ value: data?.value ?? 0 }),
  { killHandler: () => Promise.resolve() },
)
void [response, worker]

// @ts-expect-error Type-only export.
void AbstractPool
// @ts-expect-error Type-only export.
void AbstractWorker
// @ts-expect-error Type-only export.
void CircularBuffer
// @ts-expect-error Type-only export.
void PriorityQueue
// @ts-expect-error Type-only export.
void WorkerChoiceStrategiesContext

import type {
  KillHandler,
  MessageValue,
  Task,
  TaskAsyncFunction,
  TaskFunction,
  TaskSyncFunction,
  WorkerError,
} from '../../dist/esm/mod.js'

const thenable: PromiseLike<number> = {
  then(onfulfilled, onrejected) {
    return Promise.resolve(42).then(onfulfilled, onrejected)
  },
}
const mixed: TaskFunction<number, number> = (data) => data === 0 ? 0 : thenable
const cleanup: KillHandler = () => ({
  then(onfulfilled, onrejected) {
    return Promise.resolve().then(onfulfilled, onrejected)
  },
})
const mixedWorker = new ThreadWorker<number, number>(mixed, {
  killHandler: cleanup,
})
const mixedPool = new FixedThreadPool<number, number>(
  1,
  new URL('./worker.js', import.meta.url),
)
void mixedPool.addTaskFunction('mixed', mixed)
void mixedPool.addTaskFunction('thenable', { taskFunction: () => thenable })

// @ts-expect-error A string promise-like result is not a number result.
const wrongResult: TaskFunction<number, number> = () => Promise.resolve('wrong')
// @ts-expect-error The async hook retains its native Promise contract.
const wrongAsyncHook: TaskAsyncFunction<number, number> = () => thenable

class ConsumerWorker extends ThreadWorker<number, number> {
  public checkHooks(task: Task<number>, message: MessageValue<number>): void {
    const runAsync: (
      fn: TaskAsyncFunction<number, number>,
      task: Task<number>,
    ) => void = this.runAsync
    const runSync: (
      fn: TaskSyncFunction<number, number>,
      task: Task<number>,
    ) => void = this.runSync
    runAsync(() => Promise.resolve(42), task)
    runSync(() => 42, task)
    this.handleTaskFunctionOperationMessage(message)
    this.sendToMainWorker(message)
    const id = this.getTaskFunctionOperationId(message)
    this.taskFunctionOperationContext.run(id, () => undefined)
  }
}

class ConsumerPool extends FixedThreadPool<number, number> {
  public checkHooks(workerNodeKey: number): void {
    const listener = (_message: MessageValue<number>): void => {}
    this.registerWorkerMessageListener(workerNodeKey, listener)
    this.deregisterWorkerMessageListener(workerNodeKey, listener)
    this.afterWorkerNodeSetup(workerNodeKey)
  }
}

const typedError: WorkerError<number> = {
  aborted: false,
  error: new Error('Task failure'),
  name: 'mixed',
  data: 42,
}
void [
  mixedWorker,
  wrongResult,
  wrongAsyncHook,
  ConsumerWorker,
  ConsumerPool,
  typedError,
]
