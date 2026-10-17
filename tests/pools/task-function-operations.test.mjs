import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import {
  DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies,
} from '../../src/mod.ts'
import { bounded, waitForMessage } from '../test-utils.mjs'

const workerFile = new URL(
  '../worker-files/thread/taskLifecycleWorker.mjs',
  import.meta.url,
)

const once = (target, event) =>
  new Promise((resolve) =>
    target.addEventListener(event, resolve, { once: true })
  )

const ready = async (pool) => {
  if (!pool.info.ready) await bounded(once(pool.eventTarget, 'ready'))
}

const configure = async (node) => {
  const token = crypto.randomUUID()
  const configured = waitForMessage(
    node.worker,
    (message) => message.configured === token,
  )
  node.worker.postMessage({ configureOperations: true, token })
  await bounded(configured)
}

const queued = (node) =>
  waitForMessage(node.worker, (message) => message.operationQueued != null)

const release = async (node, operation, repeat = false) => {
  const acknowledged = new Promise((resolve) => {
    let count = 0
    const listener = ({ data }) => {
      if (
        data.taskFunctionOperationId === operation.operationId &&
        data.taskFunctionOperationStatus != null &&
        ++count === (repeat ? 2 : 1)
      ) {
        node.removeEventListener('message', listener)
        resolve()
      }
    }
    node.addEventListener('message', listener)
  })
  node.worker.postMessage({
    releaseOperation: operation.operationQueued,
    repeat,
  })
  await bounded(acknowledged)
}

const cleanup = async (pool) => {
  for (const node of pool.workerNodes) {
    node.worker.postMessage({ releaseAllOperations: true })
  }
  await bounded(pool.destroy())
}

const getRegistrationCounts = async (node) => {
  const token = crypto.randomUUID()
  const response = waitForMessage(
    node.worker,
    (message) => message.registrationCounts === token,
  )
  node.worker.postMessage({ registrationCounts: token })
  return new Map((await bounded(response)).counts)
}

// Count actual native event dispatches through the adapters, without replacing
// EventTarget, pool listeners, worker methods, or protocol responses.
const messageReads = new WeakMap()
class DispatchCountingPool extends FixedThreadPool {
  afterWorkerNodeSetup(workerNodeKey) {
    const node = this.workerNodes[workerNodeKey]
    messageReads.set(node, 0)
    node.addEventListener('message', (event) => {
      const data = event.data
      Object.defineProperty(event, 'data', {
        get() {
          if (data.taskId != null) {
            messageReads.set(node, messageReads.get(node) + 1)
          }
          return data
        },
      })
    })
    super.afterWorkerNodeSetup(workerNodeKey)
  }
}

describe({
  name: 'Task function operation lifecycle',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    it('captures reused definitions and affinity arrays before queueing and replacement replay', async () => {
      const pool = new FixedThreadPool(1, workerFile, {
        errorEventHandler: (event) => event.preventDefault(),
      })
      try {
        await ready(pool)
        const keys = [0]
        const definition = {
          taskFunction: (data) => ({ revision: 1, value: data.value }),
          workerNodeKeys: keys,
        }
        const first = pool.addTaskFunction('first', definition)
        definition.taskFunction = (data) => ({ revision: 2, value: data.value })
        const second = pool.addTaskFunction('second', definition)
        definition.taskFunction = () => ({ revision: 3 })
        definition.workerNodeKeys = [1]
        keys[0] = 1
        expect(await bounded(Promise.all([first, second]))).toStrictEqual([
          true,
          true,
        ])
        const execute = async (value) => {
          expect(await bounded(pool.execute({ value }, 'first')))
            .toStrictEqual({ revision: 1, value })
          expect(await bounded(pool.execute({ value }, 'second')))
            .toStrictEqual({ revision: 2, value })
        }
        await execute('before crash')
        const original = pool.workerNodes[0]
        const exited = once(original, 'exit')
        original.worker.postMessage({ crash: true })
        await bounded(exited)
        const replacement = pool.workerNodes[0]
        if (!replacement.info.ready) {
          await bounded(
            waitForMessage(replacement, (message) => message.ready === true),
          )
        }
        expect(replacement).not.toBe(original)
        await execute('after crash')
      } finally {
        await cleanup(pool)
      }
    })

    it('correlates concurrent single-worker success, delayed failure and following requests', async () => {
      const pool = new FixedThreadPool(1, workerFile)
      const submit = (operation, name) =>
        pool.sendTaskFunctionOperationToWorker(0, {
          taskFunctionOperation: operation,
          taskFunctionProperties: { name },
          ...(operation === 'add' && { taskFunction: 'data => data' }),
        })
      try {
        await ready(pool)
        const node = pool.workerNodes[0]
        await configure(node)
        const validQueued = queued(node)
        const valid = submit('add', 'valid')
        const validOperation = await bounded(validQueued)
        const invalidQueued = queued(node)
        let invalidSettled = false
        const invalid = submit('default', 'absent').catch((error) => {
          invalidSettled = true
          return error
        })
        const invalidOperation = await bounded(invalidQueued)
        await release(node, validOperation)
        expect(await bounded(valid)).toBe(true)
        expect(invalidSettled).toBe(false)
        const followingQueued = queued(node)
        let followingSettled = false
        const following = submit('add', 'following').then((value) => {
          followingSettled = true
          return value
        })
        const followingOperation = await bounded(followingQueued)
        await release(node, invalidOperation)
        expect(await bounded(invalid)).toBeInstanceOf(Error)
        expect(followingSettled).toBe(false)
        await release(node, followingOperation)
        expect(await bounded(following)).toBe(true)
        expect(
          await bounded(pool.execute({ value: 'registered' }, 'following')),
        )
          .toStrictEqual({ value: 'registered' })
      } finally {
        await cleanup(pool)
      }
    })

    it('correlates concurrent single-worker requests with the same operation and name', async () => {
      const pool = new FixedThreadPool(1, workerFile)
      const remove = () =>
        pool.sendTaskFunctionOperationToWorker(0, {
          taskFunctionOperation: 'remove',
          taskFunctionProperties: { name: 'temporary' },
        })
      try {
        await ready(pool)
        await bounded(pool.addTaskFunction('temporary', (data) => data))
        const node = pool.workerNodes[0]
        await configure(node)
        let firstSettled = false
        const firstQueued = queued(node)
        const first = remove().then(
          (value) => {
            firstSettled = true
            return value
          },
          (error) => {
            firstSettled = true
            return error
          },
        )
        const firstOperation = await bounded(firstQueued)
        const secondQueued = queued(node)
        const second = remove().catch((error) => error)
        const secondOperation = await bounded(secondQueued)
        await release(node, secondOperation)
        expect(await bounded(second)).toBe(true)
        expect(firstSettled).toBe(false)
        await release(node, firstOperation)
        expect(await bounded(first)).toBeInstanceOf(Error)
        await expect(bounded(pool.execute({}, 'temporary'))).rejects
          .toBeInstanceOf(Error)
        expect(await bounded(pool.execute({ value: 'healthy' }, 'echo')))
          .toStrictEqual({ value: 'healthy', executions: 1 })
      } finally {
        await cleanup(pool)
      }
    })

    it('orders public mutations and continues after a rejected operation', async () => {
      const pool = new FixedThreadPool(2, workerFile)
      try {
        await ready(pool)
        const outcomes = await bounded(Promise.allSettled([
          pool.addTaskFunction('runtime', (data) => data),
          pool.setDefaultTaskFunction('absent'),
          pool.addTaskFunction(
            'following',
            (data) => ({ following: data.value }),
          ),
        ]))
        expect(outcomes.map(({ status }) => status)).toStrictEqual([
          'fulfilled',
          'rejected',
          'fulfilled',
        ])
        const removals = await bounded(Promise.allSettled([
          pool.removeTaskFunction('runtime'),
          pool.removeTaskFunction('runtime'),
        ]))
        expect(removals.map(({ status }) => status)).toStrictEqual([
          'fulfilled',
          'rejected',
        ])
        expect(
          await bounded(Promise.all([
            pool.addTaskFunction('transient', (data) => data),
            pool.removeTaskFunction('transient'),
          ])),
        ).toStrictEqual([true, true])
        expect(pool.hasTaskFunction('transient')).toBe(false)
        expect(
          await bounded(pool.mapExecute(
            [{ value: 'one' }, { value: 'two' }],
            'following',
          )),
        ).toStrictEqual([
          { following: 'one' },
          { following: 'two' },
        ])
      } finally {
        await cleanup(pool)
      }
    })

    it('does not count duplicate native acknowledgements as another worker response', async () => {
      const pool = new FixedThreadPool(2, workerFile)
      try {
        await ready(pool)
        const [first, second] = pool.workerNodes
        await Promise.all([configure(first), configure(second)])
        const waiting = [queued(first), queued(second)]
        let settled = false
        const operation = pool.addTaskFunction('duplicate', (data) => data)
          .then(
            (value) => {
              settled = true
              return value
            },
            (error) => {
              settled = true
              return error
            },
          )
        const operations = await bounded(Promise.all(waiting))
        await release(first, operations[0], true)
        expect(settled).toBe(false)
        await release(second, operations[1])
        expect(await bounded(operation)).toBe(true)
        expect(await bounded(pool.mapExecute([1, 2], 'duplicate')))
          .toStrictEqual([1, 2])
      } finally {
        await cleanup(pool)
      }
    })

    it('keeps the original worker snapshot when a completed target is replaced', async () => {
      const pool = new DispatchCountingPool(2, workerFile, {
        errorEventHandler: (event) => event.preventDefault(),
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      try {
        await ready(pool)
        const [first, shifted] = pool.workerNodes
        await Promise.all([configure(first), configure(shifted)])
        const waiting = [queued(first), queued(shifted)]
        let settled = false
        const operation = pool.addTaskFunction('snapshot', (data) => data).then(
          (value) => {
            settled = true
            return value
          },
          (error) => {
            settled = true
            return error
          },
        )
        const operations = await bounded(Promise.all(waiting))
        await release(first, operations[0])
        const exited = once(first, 'exit')
        first.worker.postMessage({ crash: true })
        await bounded(exited)
        expect(pool.workerNodes[0]).toBe(shifted)
        const replacement = pool.workerNodes[1]
        if (!replacement.info.ready) {
          await bounded(
            waitForMessage(replacement, (message) => message.ready === true),
          )
        }
        expect(settled).toBe(false)
        await release(shifted, operations[1])
        expect(await bounded(operation)).toBe(true)

        const shiftedInvalidQueued = queued(shifted)
        const replacementInvalidAck = waitForMessage(
          replacement,
          (message) => message.taskFunctionOperationStatus != null,
        )
        const invalid = pool.setDefaultTaskFunction('absent').catch((error) =>
          error
        )
        const shiftedInvalid = await bounded(shiftedInvalidQueued)
        await bounded(replacementInvalidAck)
        await release(shifted, shiftedInvalid)
        expect(await bounded(invalid)).toBeInstanceOf(Error)

        const before = pool.workerNodes.map((node) => messageReads.get(node))
        await bounded(
          pool.mapExecute([{ value: 'one' }, { value: 'two' }], 'echo'),
        )
        expect(
          pool.workerNodes.map((node, i) => messageReads.get(node) - before[i]),
        )
          .toStrictEqual([1, 1])
      } finally {
        await cleanup(pool)
      }
    })

    it('keeps newer definitions ordered when an older request enrolls a replacement', async () => {
      const pool = new FixedThreadPool(2, workerFile, {
        errorEventHandler: (event) => event.preventDefault(),
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      try {
        await ready(pool)
        const [first, shifted] = pool.workerNodes
        await Promise.all([configure(first), configure(shifted)])
        const waiting = [queued(first), queued(shifted)]
        const older = pool.addTaskFunction(
          'runtime',
          (data) => ({ revision: 'older', value: data.value }),
        )
        const operations = await bounded(Promise.all(waiting))
        await release(first, operations[0])
        const exited = once(first, 'exit')
        first.worker.postMessage({ crash: true })
        await bounded(exited)
        const replacement = pool.workerNodes[1]
        if (!replacement.info.ready) {
          await bounded(waitForMessage(replacement, (message) => message.ready))
        }
        const newerQueued = queued(shifted)
        const newer = pool.addTaskFunction(
          'runtime',
          (data) => ({ revision: 'newer', value: data.value }),
        )
        await release(shifted, operations[1])
        expect(await bounded(older)).toBe(true)
        await release(shifted, await bounded(newerQueued))
        expect(await bounded(newer)).toBe(true)
        expect(
          await bounded(pool.mapExecute(
            [{ value: 'one' }, { value: 'two' }],
            'runtime',
          )),
        ).toStrictEqual([
          { revision: 'newer', value: 'one' },
          { revision: 'newer', value: 'two' },
        ])
      } finally {
        await cleanup(pool)
      }
    })

    it('does not send a failed mutation to a replacement during reentrant ACK retirement', async () => {
      const pool = new FixedThreadPool(1, workerFile, {
        errorEventHandler: (event) => event.preventDefault(),
      })
      try {
        await ready(pool)
        const original = pool.workerNodes[0]
        original.addEventListener('message', ({ data }) => {
          if (
            data.taskFunctionOperationStatus === true &&
            data.taskFunctionProperties?.name === 'runtime'
          ) {
            original.terminate()
          }
        })
        const exited = once(original, 'exit')
        const mutation = pool.addTaskFunction('runtime', (data) => data)
          .catch((error) => error)
        await bounded(exited)
        expect(await bounded(mutation)).toBeInstanceOf(Error)
        const replacement = pool.workerNodes[0]
        if (!replacement.info.ready) {
          await bounded(waitForMessage(replacement, (message) => message.ready))
        }
        await expect(bounded(pool.execute({}, 'runtime'))).rejects
          .toBeInstanceOf(Error)
        expect(await bounded(pool.execute({ value: 'healthy' }, 'echo')))
          .toStrictEqual({ value: 'healthy', executions: 1 })
      } finally {
        await cleanup(pool)
      }
    })

    it('rejects an unacknowledged native exit and permits the next mutation', async () => {
      const pool = new FixedThreadPool(2, workerFile, {
        errorEventHandler: (event) => event.preventDefault(),
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      try {
        await ready(pool)
        const [first, shifted] = pool.workerNodes
        await Promise.all([configure(first), configure(shifted)])
        const waiting = [queued(first), queued(shifted)]
        const interrupted = pool.addTaskFunction('runtime', (data) => data)
          .catch((error) => error)
        await bounded(Promise.all(waiting))
        const exited = once(first, 'exit')
        first.worker.postMessage({ crash: true })
        await bounded(exited)
        expect(
          await bounded(
            interrupted,
            'Operation ignored an unacknowledged exit',
            1000,
          ),
        ).toBeInstanceOf(Error)
        const followingQueued = queued(shifted)
        const following = pool.addTaskFunction(
          'following',
          (data) => ({ following: data.value }),
        )
        await release(shifted, await bounded(followingQueued))
        expect(await bounded(following)).toBe(true)
        expect(
          await bounded(pool.mapExecute(
            [{ value: 'one' }, { value: 'two' }],
            'following',
          )),
        ).toStrictEqual([
          { following: 'one' },
          { following: 'two' },
        ])
      } finally {
        await cleanup(pool)
      }
    })

    for (const mutation of ['add', 'remove']) {
      it(`preserves ${mutation} on a replacement created during a pending operation`, async () => {
        const pool = new FixedThreadPool(2, workerFile, {
          errorEventHandler: (event) => event.preventDefault(),
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        })
        try {
          await ready(pool)
          if (mutation === 'remove') {
            await bounded(pool.addTaskFunction(
              'runtime',
              (data) => ({ runtime: data.value }),
            ))
          }
          const [first, shifted] = pool.workerNodes
          await Promise.all([configure(first), configure(shifted)])
          const waiting = [queued(first), queued(shifted)]
          const operation = mutation === 'add'
            ? pool.addTaskFunction(
              'runtime',
              (data) => ({ runtime: data.value }),
            )
            : pool.removeTaskFunction('runtime')
          const operations = await bounded(Promise.all(waiting))
          await release(first, operations[0])
          const exited = once(first, 'exit')
          first.worker.postMessage({ crash: true })
          await bounded(exited)
          const replacement = pool.workerNodes[1]
          if (!replacement.info.ready) {
            await bounded(
              waitForMessage(replacement, (message) => message.ready),
            )
          }
          if (
            mutation === 'remove' &&
            !replacement.info.taskFunctionsProperties?.some(
              ({ name }) => name === 'runtime',
            )
          ) {
            await bounded(waitForMessage(
              replacement,
              (message) =>
                message.taskFunctionsProperties?.some(
                  ({ name }) => name === 'runtime',
                ),
            ))
          }
          await release(shifted, operations[1])
          expect(await bounded(operation)).toBe(true)
          const outcomes = await bounded(Promise.all(
            [{ value: 'one' }, { value: 'two' }].map((data) =>
              pool.execute(data, 'runtime').catch((error) => error)
            ),
          ))
          if (mutation === 'add') {
            expect(outcomes).toStrictEqual([
              { runtime: 'one' },
              { runtime: 'two' },
            ])
          } else {
            for (const outcome of outcomes) {
              expect(outcome).toBeInstanceOf(Error)
            }
            expect(
              await bounded(pool.mapExecute(
                [{ value: 'one' }, { value: 'two' }],
                'echo',
              )),
            ).toStrictEqual([
              { value: 'one', executions: 1 },
              { value: 'two', executions: 1 },
            ])
          }
        } finally {
          await cleanup(pool)
        }
      })
    }

    it('preserves numeric listener overrides during CRUD and destruction', async () => {
      class IndexedListenerPool extends FixedThreadPool {
        deregisterWorkerMessageListener(workerNodeKey, listener) {
          this.lastCleanedWorkerId = this.workerNodes[workerNodeKey].info.id
          super.deregisterWorkerMessageListener(workerNodeKey, listener)
        }
      }
      const pool = new IndexedListenerPool(1, workerFile)
      try {
        await ready(pool)
        expect(await bounded(pool.addTaskFunction('runtime', (data) => data)))
          .toBe(true)
        expect(await bounded(pool.execute({ registered: true }, 'runtime')))
          .toStrictEqual({ registered: true })
        expect(await bounded(pool.removeTaskFunction('runtime'))).toBe(true)
        await bounded(pool.destroy())
        expect(pool.workerNodes).toHaveLength(0)
      } finally {
        if (pool.info.started) await cleanup(pool)
      }
    })

    for (const poolType of ['fixed', 'dynamic minimum']) {
      it(`replays registered functions once after a native ${poolType} worker crash`, async () => {
        const options = { errorEventHandler: (event) => event.preventDefault() }
        const pool = poolType === 'fixed'
          ? new FixedThreadPool(1, workerFile, options)
          : new DynamicThreadPool(1, 2, workerFile, options)
        try {
          await ready(pool)
          await bounded(
            pool.addTaskFunction(
              'runtime',
              (data) => ({ runtime: data.value }),
            ),
          )
          expect(await bounded(pool.execute({ value: 'before' }, 'runtime')))
            .toStrictEqual({ runtime: 'before' })
          const oldNode = pool.workerNodes[0]
          const exited = once(oldNode, 'exit')
          oldNode.worker.postMessage({ crash: true })
          await bounded(exited)
          const replacement = pool.workerNodes[0]
          if (!replacement.info.ready) {
            await bounded(
              waitForMessage(replacement, (message) => message.ready === true),
            )
          }
          expect(replacement).not.toBe(oldNode)
          expect(replacement.info.dynamic).toBe(false)
          expect(await bounded(pool.execute({ value: 'after' }, 'runtime')))
            .toStrictEqual({ runtime: 'after' })
          expect((await getRegistrationCounts(replacement)).get('runtime'))
            .toBe(1)
        } finally {
          await cleanup(pool)
        }
      })
    }

    it('replays registered functions once on a late dynamic worker', async () => {
      const pool = new DynamicThreadPool(0, 1, workerFile)
      try {
        expect(await bounded(pool.addTaskFunction('runtime', (data) => data)))
          .toBe(true)
        expect(pool.workerNodes.length).toBe(0)
        expect(await bounded(pool.execute({ value: 'late' }, 'runtime')))
          .toStrictEqual({ value: 'late' })
        expect(
          (await getRegistrationCounts(pool.workerNodes[0])).get('runtime'),
        ).toBe(1)
      } finally {
        await cleanup(pool)
      }
    })

    it('keeps native message dispatch stable across ten CRUD cycles on multiple workers', async () => {
      const pool = new DispatchCountingPool(2, workerFile, {
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })
      const measure = async () => {
        const before = pool.workerNodes.map((node) => messageReads.get(node))
        await bounded(
          pool.mapExecute([{ value: 'one' }, { value: 'two' }], 'echo'),
        )
        return pool.workerNodes.map((node, i) =>
          messageReads.get(node) - before[i]
        )
      }
      try {
        await ready(pool)
        const baseline = await measure()
        expect(baseline).toStrictEqual([1, 1])
        for (let cycle = 0; cycle < 10; cycle++) {
          expect(
            await bounded(pool.addTaskFunction('temporary', (data) => data)),
          ).toBe(true)
          expect(await bounded(pool.execute({ cycle }, 'temporary')))
            .toStrictEqual({ cycle })
          expect(
            await bounded(
              pool.addTaskFunction(
                'temporary',
                (data) => ({ updated: data.cycle }),
              ),
            ),
          ).toBe(true)
          expect(await bounded(pool.execute({ cycle }, 'temporary')))
            .toStrictEqual({ updated: cycle })
          expect(await bounded(pool.setDefaultTaskFunction('temporary'))).toBe(
            true,
          )
          expect(await bounded(pool.execute({ cycle }))).toStrictEqual({
            updated: cycle,
          })
          expect(await bounded(pool.setDefaultTaskFunction('echo'))).toBe(true)
          expect(await bounded(pool.removeTaskFunction('temporary'))).toBe(true)
          expect(pool.hasTaskFunction('temporary')).toBe(false)
          expect(await measure()).toStrictEqual(baseline)
        }
      } finally {
        await cleanup(pool)
      }
    })
  },
})
