import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { DynamicThreadPool, FixedThreadPool } from '../../src/mod.ts'
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

const release = (gate) => {
  Atomics.store(new Int32Array(gate), 0, 1)
  Atomics.notify(new Int32Array(gate), 0)
}

const checkReason = (error, reason, name) => {
  expect(error).toBeInstanceOf(Error)
  if (reason instanceof Error) {
    expect(error).toBe(reason)
  } else if (typeof reason === 'string') {
    expect(error.message).toBe(reason)
  } else {
    expect(error.message).toMatch(
      new RegExp(`^Task '${name}' id '[^']+' aborted$`),
    )
  }
}

const reasons = [
  ['Error', () => new Error('Consumer cancellation')],
  ['string', () => 'Consumer cancellation'],
  ['number', () => 42],
]

const queueOptions = {
  enableTasksQueue: true,
  tasksQueueOptions: {
    concurrency: 1,
    taskStealing: false,
    tasksStealingOnBackPressure: false,
  },
}

describe({
  name: 'Task cancellation lifecycle',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    for (const [kind, createReason] of reasons) {
      it(`rejects an already-aborted task before creating a worker or transferring data (${kind})`, async () => {
        const pool = new DynamicThreadPool(0, 1, workerFile, queueOptions)
        const reason = createReason()
        const controller = new AbortController()
        controller.abort(reason)
        const buffer = new ArrayBuffer(8)
        try {
          const error = await bounded(
            pool.execute({ buffer }, 'echo', controller.signal, [buffer])
              .catch((error) => error),
          )
          checkReason(error, reason, 'echo')
          expect(buffer.byteLength).toBe(8)
          expect(pool.workerNodes.length).toBe(0)
          expect(pool.info.queuedTasks).toBe(0)
          expect(pool.info.executingTasks).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await bounded(pool.destroy())
        }
      })

      it(`does not dispatch an already-aborted task on a ready worker (${kind})`, async () => {
        const pool = new FixedThreadPool(1, workerFile)
        const reason = createReason()
        const controller = new AbortController()
        controller.abort(reason)
        try {
          await ready(pool)
          expect(await bounded(pool.execute({ value: 'before' }, 'echo')))
            .toStrictEqual({ value: 'before', executions: 1 })
          const error = await bounded(
            pool.execute({ value: 'cancelled' }, 'echo', controller.signal)
              .catch((error) => error),
          )
          checkReason(error, reason, 'echo')
          expect(await bounded(pool.execute({ value: 'after' }, 'echo')))
            .toStrictEqual({ value: 'after', executions: 2 })
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await bounded(pool.destroy())
        }
      })

      it(`preserves a queued cancellation reason without executing the task (${kind})`, async () => {
        const pool = new FixedThreadPool(1, workerFile, queueOptions)
        const gate = new SharedArrayBuffer(4)
        let blocking
        try {
          await ready(pool)
          const started = waitForMessage(
            pool.workerNodes[0].worker,
            (message) => message.started === 'blocking',
          )
          blocking = pool.execute({ gate, value: 'blocking' }, 'gate')
          await bounded(started)
          const controller = new AbortController()
          const reason = createReason()
          const cancelled = pool.execute(
            { value: 'cancelled' },
            'echo',
            controller.signal,
          ).catch((error) => error)
          expect(pool.info.queuedTasks).toBe(1)
          controller.abort(reason)
          checkReason(await bounded(cancelled), reason, 'echo')
          expect(pool.info.queuedTasks).toBe(0)
          release(gate)
          expect(await bounded(blocking)).toBe('blocking')
          expect(await bounded(pool.execute({ value: 'after' }, 'echo')))
            .toStrictEqual({ value: 'after', executions: 2 })
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          release(gate)
          if (blocking != null) await bounded(blocking.catch(() => {}))
          await bounded(pool.destroy())
        }
      })

      it(`uses the running task name and preserves its cancellation reason (${kind})`, async () => {
        const pool = new FixedThreadPool(1, workerFile)
        const gate = new SharedArrayBuffer(4)
        const controller = new AbortController()
        try {
          await ready(pool)
          const node = pool.workerNodes[0]
          const started = waitForMessage(
            node.worker,
            (message) => message.started === 'running',
          )
          const cancelled = pool.execute(
            { gate, value: 'running' },
            'named',
            controller.signal,
          ).catch((error) => error)
          await bounded(started)
          const reason = createReason()
          controller.abort(reason)
          checkReason(await bounded(cancelled), reason, 'named')
          const released = waitForMessage(
            node.worker,
            (message) => message.released === 'running',
          )
          release(gate)
          await bounded(released)
          expect(await bounded(pool.execute({ value: 'after' }, 'echo')))
            .toStrictEqual({ value: 'after', executions: 2 })
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          release(gate)
          controller.abort()
          await bounded(pool.destroy())
        }
      })
    }

    it('materializes a one-shot signal iterable once before validation and execution', async () => {
      const pool = new FixedThreadPool(1, workerFile)
      let iterations = 0
      const signals = {
        *[Symbol.iterator]() {
          if (++iterations > 1) throw new Error('Signals iterated twice')
          yield new AbortController().signal
          yield new AbortController().signal
        },
      }
      try {
        await ready(pool)
        const values = await bounded(pool.mapExecute(
          [{ value: 'first' }, { value: 'second' }],
          'echo',
          signals,
        ))
        expect(values).toStrictEqual([
          { value: 'first', executions: 1 },
          { value: 'second', executions: 2 },
        ])
        expect(iterations).toBe(1)
      } finally {
        await bounded(pool.destroy())
      }
    })

    it('rejects invalid one-shot signals and length mismatches before dispatching any task', async () => {
      const pool = new FixedThreadPool(1, workerFile)
      function* invalidSignals() {
        yield new AbortController().signal
        yield null
      }
      function* shortSignals() {
        yield new AbortController().signal
      }
      try {
        await ready(pool)
        await expect(bounded(pool.mapExecute(
          [{ value: 'first' }, { value: 'second' }],
          'echo',
          invalidSignals(),
        ))).rejects.toThrow(
          'abortSignals argument must be an iterable of AbortSignal',
        )
        await expect(bounded(pool.mapExecute(
          [{ value: 'first' }, { value: 'second' }],
          'echo',
          shortSignals(),
        ))).rejects.toThrow(
          'data and abortSignals arguments must have the same length',
        )
        expect(await bounded(pool.execute({ value: 'after' }, 'echo')))
          .toStrictEqual({ value: 'after', executions: 1 })
      } finally {
        await bounded(pool.destroy())
      }
    })
  },
})
