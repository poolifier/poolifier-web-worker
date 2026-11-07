import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { FixedThreadPool, PoolEvents } from '../../src/mod.ts'
import { bounded, waitForMessage } from '../test-utils.mjs'

const workerFile = new URL(
  '../worker-files/thread/taskResultsWorker.mjs',
  import.meta.url,
)
const killWorkerFile = new URL(
  '../worker-files/thread/killHandlerWorker.mjs',
  import.meta.url,
)

const connect = async (url, initialMessage) => {
  const worker = new Worker(url, { type: 'module' })
  const channel = new MessageChannel()
  const workerId = crypto.randomUUID()
  channel.port1.start()
  try {
    const ready = waitForMessage(channel.port1, (message) => message.ready)
    worker.postMessage(
      { ready: false, workerId, port: channel.port2 },
      [channel.port2],
    )
    await bounded(ready, 'Native worker readiness remained pending')
    if (initialMessage != null) {
      const configured = waitForMessage(
        worker,
        (message) => message.configured === true,
      )
      worker.postMessage(initialMessage)
      await bounded(configured, 'Native worker configuration remained pending')
    }
    return { worker, port: channel.port1, workerId }
  } catch (error) {
    channel.port1.close()
    channel.port2.close()
    worker.terminate()
    throw error
  }
}

const ready = async (pool) => {
  if (!pool.info.ready) {
    await bounded(
      new Promise((resolve) => {
        pool.eventTarget.addEventListener(PoolEvents.ready, resolve, {
          once: true,
        })
      }),
      'Result worker readiness remained pending',
    )
  }
}

const destroy = async (pool) => {
  await bounded(pool.destroy(), 'Result worker cleanup remained pending')
}

describe({
  name: 'Native worker result and cleanup contracts',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    it('preserves async execution overrides that expect a callable task function', async () => {
      const pool = new FixedThreadPool(1, workerFile)
      try {
        await ready(pool)
        expect(
          await bounded(pool.execute(
            { label: 'legacy', legacyHook: true },
            'asynchronous',
          )),
        ).toStrictEqual({ calls: 1, value: 'legacy', legacyHook: true })
      } finally {
        await destroy(pool)
      }
    })

    for (const trap of ['prototype', 'descriptor']) {
      for (const abortable of [false, true]) {
        it(`settles thenables with opaque ${trap} inspection (abortable: ${abortable})`, async () => {
          const pool = new FixedThreadPool(1, workerFile)
          const signal = abortable ? new AbortController().signal : undefined
          try {
            await ready(pool)
            expect(
              await bounded(pool.execute(
                { label: 'opaque result', trap },
                'opaqueThenable',
                signal,
              )),
            ).toStrictEqual({ calls: 1, value: 'opaque result' })
            await expect(bounded(pool.execute(
              { label: 'opaque failure', trap, fail: true },
              'opaqueThenable',
              signal,
            ))).rejects.toThrow('opaque failure')
            expect(
              await bounded(pool.execute(
                { label: 'worker remains usable' },
                'synchronous',
              )),
            ).toStrictEqual({ calls: 3, value: 'worker remains usable' })
          } finally {
            await destroy(pool)
          }
        })
      }
    }

    for (const realm of ['local', 'foreign']) {
      for (const abortable of [false, true]) {
        it(`settles ${abortable ? 'abortable' : 'non-abortable'} ${realm} Promises with a single-read then accessor`, async () => {
          const url = new URL(workerFile)
          url.searchParams.set('realm', realm)
          const pool = new FixedThreadPool(1, url)
          try {
            await ready(pool)
            expect(
              await bounded(pool.execute(
                { label: 'decorated result' },
                'singleReadPromise',
                abortable ? new AbortController().signal : undefined,
              )),
            ).toStrictEqual({ calls: 1, value: 'decorated result' })
            await expect(bounded(pool.execute(
              { label: 'decorated failure', fail: true },
              'singleReadPromise',
              abortable ? new AbortController().signal : undefined,
            ))).rejects.toThrow('decorated failure')
            expect(pool.workerNodes[0].usage.tasks.executing).toBe(0)
            expect(pool.workerNodes[0].usage.tasks.executed).toBe(1)
            expect(pool.workerNodes[0].usage.tasks.failed).toBe(1)
          } finally {
            await destroy(pool)
          }
        })
      }

      for (const fail of [false, true]) {
        it(`keeps decorated ${realm} cancellation settled after late ${fail ? 'rejection' : 'fulfillment'}`, async () => {
          const url = new URL(workerFile)
          url.searchParams.set('realm', realm)
          const pool = new FixedThreadPool(1, url)
          const label = 'decorated pending result'
          const responses = []
          let worker
          try {
            await ready(pool)
            const node = pool.workerNodes[0]
            worker = node.worker
            node.addEventListener('message', ({ data }) => {
              if (data.taskId != null) responses.push(data)
            })
            const started = waitForMessage(
              worker,
              (message) => message.started === label,
            )
            const controller = new AbortController()
            const reason = new Error('Consumer cancelled decorated Promise')
            const outcome = pool.execute(
              { label, wait: true, fail },
              'singleReadPromise',
              controller.signal,
            ).then((value) => ({ value }), (error) => ({ error }))
            await bounded(started)
            controller.abort(reason)
            expect((await bounded(outcome)).error).toBe(reason)
            const settled = waitForMessage(
              worker,
              (message) => message.settled === label,
            )
            worker.postMessage({ release: label })
            await bounded(settled)
            expect(
              await bounded(pool.execute(
                { label: 'following task' },
                'ordinaryPromise',
              )),
            ).toStrictEqual({ calls: 2, value: 'following task' })
            expect(responses).toHaveLength(2)
            expect(responses[0].workerError.aborted).toBe(true)
            expect(responses[1].workerError).toBeUndefined()
            expect(pool.workerNodes[0]).toBe(node)
            expect(pool.promiseResponseMap.size).toBe(0)
            expect(node.usage.tasks.executing).toBe(0)
          } finally {
            worker?.postMessage({ release: label })
            await destroy(pool)
          }
        })
      }

      it(`settles ${realm} Promise results and invokes every task exactly once`, async () => {
        const url = new URL(workerFile)
        url.searchParams.set('realm', realm)
        const pool = new FixedThreadPool(1, url)
        try {
          await ready(pool)
          expect(
            await bounded(pool.execute(
              { label: 'first' },
              'ordinaryPromise',
            )),
          ).toStrictEqual({ calls: 1, value: 'first' })
          await expect(bounded(pool.execute(
            { fail: true, label: 'ordinary rejection' },
            'ordinaryPromise',
          ))).rejects.toThrow('ordinary rejection')
          expect(
            await bounded(pool.execute(
              { label: 'after rejection' },
              'synchronous',
            )),
          ).toStrictEqual({ calls: 3, value: 'after rejection' })
          expect(pool.workerNodes[0].usage.tasks.executing).toBe(0)
          expect(pool.workerNodes[0].usage.tasks.executed).toBe(2)
          expect(pool.workerNodes[0].usage.tasks.failed).toBe(1)
        } finally {
          await destroy(pool)
        }
      })

      it(`keeps a pending ${realm} Promise abortable until it settles`, async () => {
        const url = new URL(workerFile)
        url.searchParams.set('realm', realm)
        const pool = new FixedThreadPool(1, url)
        const label = 'pending ordinary promise'
        let worker
        try {
          await ready(pool)
          worker = pool.workerNodes[0].worker
          const started = waitForMessage(
            worker,
            (message) => message.started === label,
          )
          const controller = new AbortController()
          const task = pool.execute(
            { label, wait: true },
            'ordinaryPromise',
            controller.signal,
          ).then((value) => ({ value }), (error) => ({ error }))
          await bounded(started, 'Ordinary Promise task did not start')
          controller.abort()
          const { error } = await bounded(
            task,
            'Ordinary Promise abort remained pending',
          )
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toContain('aborted')
          expect(pool.workerNodes[0].usage.tasks.executing).toBe(0)
          worker.postMessage({ release: label })
          expect(
            await bounded(pool.execute(
              { label: 'after abort' },
              'ordinaryPromise',
            )),
          ).toStrictEqual({ calls: 2, value: 'after abort' })
        } finally {
          worker?.postMessage({ release: label })
          await destroy(pool)
        }
      })
    }

    for (const taskName of ['synchronous', 'ordinaryPromise', 'asynchronous']) {
      for (const transferredPort of [false, true]) {
        it(`rejects ${taskName} failures with ${transferredPort ? 'transferred ports' : 'cloneable input data'}`, async () => {
          const pool = new FixedThreadPool(1, workerFile)
          const channel = transferredPort ? new MessageChannel() : undefined
          try {
            await ready(pool)
            const data = { fail: true, label: `${taskName} failure` }
            if (channel != null) data.port = channel.port2
            const errorEvent = new Promise((resolve) => {
              pool.eventTarget.addEventListener(PoolEvents.taskError, resolve, {
                once: true,
              })
            })
            await expect(bounded(pool.execute(
              data,
              taskName,
              undefined,
              channel != null ? [channel.port2] : undefined,
            ))).rejects.toThrow(data.label)
            const { error } = await bounded(
              errorEvent,
              'Task error event remained pending',
            )
            expect(error.error.message).toBe(data.label)
            if (channel == null) {
              expect(error.data).toStrictEqual(data)
            } else {
              expect(error.data).toBe(data)
              // Retaining the original input must not transfer ownership back to the caller.
              channel.port1.start()
              const echo = waitForMessage(
                channel.port1,
                (message) => message === 'still owned',
              )
              channel.port1.postMessage('still owned')
              await bounded(
                echo,
                'Transferred input port lost its worker owner',
              )
            }
            expect(
              await bounded(pool.execute(
                { label: 'worker remains usable' },
                'synchronous',
              )),
            ).toStrictEqual({ calls: 2, value: 'worker remains usable' })
          } finally {
            channel?.port1.close()
            channel?.port2.close()
            await destroy(pool)
          }
        })
      }
    }

    for (const transferredPort of [false, true]) {
      it(`reports unknown task errors with ${transferredPort ? 'transferred ports' : 'cloneable input data'}`, async () => {
        const connection = await connect(workerFile)
        const channel = transferredPort ? new MessageChannel() : undefined
        try {
          const taskId = crypto.randomUUID()
          const data = { label: 'unknown task' }
          if (channel != null) data.port = channel.port2
          const response = waitForMessage(
            connection.port,
            (message) => message.taskId === taskId,
          )
          connection.port.postMessage(
            { workerId: connection.workerId, taskId, name: 'missing', data },
            channel != null ? [channel.port2] : [],
          )
          const { workerError } = await bounded(
            response,
            'Unknown task error remained pending',
          )
          expect(workerError.error.message).toBe(
            "Task function 'missing' not found",
          )
          expect(workerError.aborted).toBe(false)
          if (channel == null) expect(workerError.data).toStrictEqual(data)
          else expect(workerError).not.toHaveProperty('data')
        } finally {
          channel?.port1.close()
          channel?.port2.close()
          connection.port.close()
          connection.worker.terminate()
        }
      })
    }

    it('reports rejected cleanup and terminates the worker after its Promise settles', async () => {
      const url = new URL(killWorkerFile)
      url.searchParams.set('mode', 'promise')
      url.searchParams.set('failure', 'true')
      const state = new SharedArrayBuffer(8)
      const values = new Int32Array(state)
      const pool = new FixedThreadPool(1, url)
      const errors = []
      pool.eventTarget.addEventListener(PoolEvents.error, (event) => {
        errors.push(event.error)
      })
      let worker
      try {
        await ready(pool)
        worker = pool.workerNodes[0].worker
        const configured = waitForMessage(
          worker,
          (message) => message.configured,
        )
        worker.postMessage({ state })
        await bounded(configured)
        const started = waitForMessage(
          worker,
          (message) => message.cleanup === 'started',
        )
        let destroyed = false
        const destruction = pool.destroy().then(() => {
          destroyed = true
        })
        await bounded(started)
        expect(destroyed).toBe(false)
        expect(Atomics.load(values, 0)).toBe(1)
        worker.postMessage({ release: true })
        await bounded(destruction)
        expect(Atomics.load(values, 0)).toBe(2)
        expect(Atomics.load(values, 1)).toBe(1)
        expect(errors).toHaveLength(1)
        expect(errors[0]).toBeInstanceOf(Error)
        expect(pool.info.started).toBe(false)
        expect(pool.workerNodes).toHaveLength(0)
      } finally {
        worker?.postMessage({ release: true })
        if (pool.info.started) await destroy(pool)
        for (const node of [...pool.workerNodes]) node.terminate()
      }
    })

    for (
      const mode of [
        'sync',
        'async',
        'promise',
        'foreign',
        'decorated',
        'foreign-decorated',
        'opaque-prototype',
        'opaque-descriptor',
      ]
    ) {
      for (const failure of [false, true]) {
        it(`acknowledges ${mode} cleanup ${failure ? 'failure' : 'success'} after completion`, async () => {
          const url = new URL(killWorkerFile)
          url.searchParams.set('mode', mode)
          url.searchParams.set('failure', failure.toString())
          const state = new SharedArrayBuffer(8)
          const values = new Int32Array(state)
          const connection = await connect(url, { state })
          let acknowledgedEarly = false
          try {
            connection.port.postMessage({
              workerId: connection.workerId,
              statistics: { runTime: false },
            })
            const started = waitForMessage(
              connection.worker,
              (message) => message.cleanup === 'started',
            )
            const acknowledged = waitForMessage(
              connection.port,
              (message) =>
                message.kill === 'success' || message.kill === 'failure',
            ).then((message) => {
              acknowledgedEarly = true
              return { message, state: Atomics.load(values, 0) }
            })
            connection.port.postMessage({
              workerId: connection.workerId,
              kill: true,
            })
            await bounded(started, 'Cleanup handler did not start')
            if (mode !== 'sync') {
              expect(Atomics.load(values, 0)).toBe(1)
              const taskId = crypto.randomUUID()
              const sentinel = waitForMessage(
                connection.port,
                (message) => message.taskId === taskId,
              )
              connection.port.postMessage({
                workerId: connection.workerId,
                taskId,
                data: {},
              })
              expect(
                (await bounded(
                  sentinel,
                  'Cleanup closed its channel before settlement',
                )).data,
              )
                .toBe('ready')
              expect(acknowledgedEarly).toBe(false)
              connection.worker.postMessage({ release: true })
            }
            const acknowledgment = await bounded(
              acknowledged,
              'Cleanup acknowledgment remained pending',
            )
            expect(acknowledgment.message.kill).toBe(
              failure ? 'failure' : 'success',
            )
            expect(acknowledgment.state).toBe(2)
            expect(Atomics.load(values, 1)).toBe(1)
          } finally {
            connection.port.close()
            connection.worker.terminate()
          }
        })
      }
    }
  },
})
