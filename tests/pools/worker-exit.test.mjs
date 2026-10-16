import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import {
  DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies,
} from '../../src/mod.ts'

const workerFile = new URL(
  '../worker-files/thread/crashWorker.mjs',
  import.meta.url,
)
const PoolClass = FixedThreadPool

const bounded = async (promise) => {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Task remained pending')),
          5000,
        )
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}

const once = (target, event) =>
  new Promise((resolve) => {
    target.addEventListener(event, resolve, { once: true })
  })

const listenOnce = (target, event, listener) => {
  target.addEventListener(event, listener, { once: true })
}

const send = (workerNode, message) => workerNode.worker.postMessage(message)

const started = (workerNode, id) =>
  new Promise((resolve) => {
    const listener = ({ data }) => {
      if (data.started === id) {
        workerNode.worker.removeEventListener('message', listener)
        resolve()
      }
    }
    workerNode.worker.addEventListener('message', listener)
  })

const preventWorkerError = (event) => event.preventDefault()

const cleanupRegressionPool = async (pool, capturedNodes = []) => {
  pool.opts.restartWorkerOnError = false
  for (const node of new Set([...capturedNodes, ...pool.workerNodes])) {
    send(node, { releaseAll: true })
  }
  if (pool.info.started) await bounded(pool.destroy())
}

const createPool = async (size = 1, options = {}) => {
  const pool = new FixedThreadPool(size, workerFile, {
    errorEventHandler: preventWorkerError,
    workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
    ...options,
  })
  if (!pool.info.ready) await bounded(once(pool.eventTarget, 'ready'))
  return pool
}

describe({
  name: 'Web worker failure settlement',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    it('settles tasks when replacement construction throws from native error cleanup', async () => {
      const moduleUrl = new URL('../../src/mod.ts', import.meta.url).href
      const script = `
        import { FixedThreadPool } from ${JSON.stringify(moduleUrl)}
        const constructionError = new Error('Replacement construction failed')
        const hostErrors = []
        globalThis.addEventListener('error', event => {
          if (event.error === constructionError) {
            event.preventDefault()
            hostErrors.push(event.error.message)
          }
        })
        let constructions = 0
        const pool = new FixedThreadPool(1, new URL(${
        JSON.stringify(workerFile.href)
      }), {
          enableTasksQueue: true,
          workerOptions: {
            get name() {
              if (++constructions > 1) throw constructionError
              return 'replacement-failure'
            }
          },
          errorEventHandler(event) { event.preventDefault() }
        })
        let timer
        try {
          const node = pool.workerNodes[0]
          const started = new Promise(resolve => {
            node.worker.addEventListener('message', resolve, { once: true })
          })
          const running = pool.execute({ id: 'running', wait: true }).catch(error => error)
          const queued = pool.execute({ id: 'queued' }).catch(error => error)
          await started
          node.worker.postMessage({ crash: true })
          const outcomes = await Promise.race([
            Promise.all([running, queued]),
            new Promise((_, reject) => {
              timer = setTimeout(() => reject(new Error('Tasks remained pending')), 3000)
            })
          ])
          await new Promise(resolve => setTimeout(resolve, 0))
          console.log(JSON.stringify({
            rejected: outcomes.map(value => value instanceof Error),
            hostErrors,
            retainedTasks: pool.promiseResponseMap.size
          }))
        } finally {
          clearTimeout(timer)
          await pool.destroy()
        }
      `
      const output = await bounded(
        new Deno.Command(Deno.execPath(), { args: ['eval', script] }).output(),
      )
      expect(output.success).toBe(true)
      expect(JSON.parse(new TextDecoder().decode(output.stdout))).toStrictEqual(
        {
          rejected: [true, true],
          hostErrors: ['Replacement construction failed'],
          retainedTasks: 0,
        },
      )
    })

    for (const restartWorkerOnError of [true, false]) {
      it(`rejects a crashed worker's running and stranded queued tasks (restart: ${restartWorkerOnError})`, async () => {
        const pool = await createPool(1, {
          enableTasksQueue: true,
          restartWorkerOnError,
        })
        try {
          const workerNode = pool.workerNodes[0]
          const running = started(workerNode, 'running')
          const results = [
            pool.execute({ id: 'running', wait: true }).catch((error) => error),
            pool.execute({ id: 'queued' }).catch((error) => error),
          ]
          await bounded(running)
          const exit = new Promise((resolve) =>
            workerNode.addEventListener('exit', resolve, { once: true })
          )
          send(workerNode, { crash: true })
          const outcomes = await bounded(Promise.all(results))
          expect(outcomes[0]).toBeInstanceOf(Error)
          expect(outcomes[1]).toBeInstanceOf(Error)
          await bounded(exit)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool)
        }
      })
    }

    it('can destroy the pool from backPressureEnd during exit redistribution', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          size: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      let destruction
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const failed = pool
          .execute({ id: 'source', wait: true })
          .catch((error) => error)
        pool.execute({ id: 'destination', wait: true }).catch(() => {})
        const backPressure = once(pool.eventTarget, 'backPressure')
        pool.execute({ id: 'source-queued' }).catch(() => {})
        pool.execute({ id: 'destination-queued' }).catch(() => {})
        await bounded(
          Promise.all([sourceStarted, destinationStarted, backPressure]),
        )
        listenOnce(pool.eventTarget, 'backPressureEnd', () => {
          destruction = pool.destroy()
        })
        send(source, { crash: true })
        expect(await bounded(failed)).toBeInstanceOf(Error)
        await bounded(destruction)
        expect(pool.info.started).toBe(false)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('keeps healthy tasks and redistributed queued tasks after an earlier worker exits', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [failedNode, healthyNode] = pool.workerNodes
        const failedStarted = started(failedNode, 'failed')
        const healthyStarted = started(healthyNode, 'healthy')
        const failed = pool
          .execute({ id: 'failed', wait: true })
          .catch((error) => error)
        const healthyData = { id: 'healthy', wait: true }
        const healthy = pool.execute(healthyData)
        const queuedData = { id: 'redistributed' }
        const queued = pool.execute(queuedData)
        await bounded(Promise.all([failedStarted, healthyStarted]))
        const exit = new Promise((resolve) =>
          failedNode.addEventListener('exit', resolve, { once: true })
        )
        send(failedNode, { crash: true })
        expect(await bounded(failed)).toBeInstanceOf(Error)
        await bounded(exit)
        send(healthyNode, { release: 'healthy' })
        expect(await bounded(healthy)).toStrictEqual(healthyData)
        expect(await bounded(queued)).toStrictEqual(queuedData)
        expect(healthyNode.usage.tasks.executing).toBe(0)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('preserves sparse affinity against live worker indices after a crash', async () => {
      const executions = []
      const completions = []
      class AffinityPool extends PoolClass {
        afterTaskExecutionHook(workerNodeKey, response) {
          if (response.data?.id === 'affinity') {
            completions.push({
              workerId: this.workerNodes[workerNodeKey].info.id,
              workerNodeKey,
            })
          }
          super.afterTaskExecutionHook(workerNodeKey, response)
        }

        beforeTaskExecutionHook(workerNodeKey, task) {
          if (task.data?.id === 'affinity') {
            executions.push({
              workerId: this.workerNodes[workerNodeKey].info.id,
              workerNodeKey,
            })
          }
          super.beforeTaskExecutionHook(workerNodeKey, task)
        }
      }
      const pool = new AffinityPool(3, workerFile, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
        errorEventHandler: preventWorkerError,
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })

      try {
        if (!pool.info.ready) await bounded(once(pool.eventTarget, 'ready'))
        await bounded(
          pool.addTaskFunction('affinityEcho', {
            taskFunction: (data) => data,
            workerNodeKeys: [0, 2],
          }),
        )
        const [source, firstHealthy, secondHealthy] = pool.workerNodes
        const healthyData = [
          { id: 'first-healthy', wait: true },
          { id: 'second-healthy', wait: true },
        ]
        const running = [
          started(firstHealthy, 'first-healthy'),
          started(secondHealthy, 'second-healthy'),
          started(source, 'source'),
        ]
        const healthy = healthyData.map((data) => pool.execute(data))
        const failed = pool
          .execute({ id: 'source', wait: true })
          .catch((error) => error)
        await bounded(Promise.all(running))
        const queuedData = [{ id: 'first-queued' }, { id: 'second-queued' }]
        const queued = queuedData.map((data) => pool.execute(data))
        const affinityData = { id: 'affinity' }
        const affinity = pool
          .execute(affinityData, 'affinityEcho')
          .catch((error) => error)
        expect(source.tasksQueue.size).toBe(1)
        const exit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        await bounded(exit)
        expect(await bounded(failed)).toBeInstanceOf(Error)
        send(firstHealthy, { release: 'first-healthy' })
        send(secondHealthy, { release: 'second-healthy' })
        expect(await bounded(Promise.all(healthy))).toStrictEqual(healthyData)
        expect(await bounded(Promise.all(queued))).toStrictEqual(queuedData)
        expect(await bounded(affinity)).toStrictEqual(affinityData)
        expect(executions).toHaveLength(1)
        expect([0, 2]).toContain(executions[0].workerNodeKey)
        expect(executions[0].workerId).toBe(
          pool.workerNodes[executions[0].workerNodeKey].info.id,
        )
        expect(completions).toStrictEqual(executions)
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('rejects a queued default task pinned to the exited worker', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await bounded(
          pool.addTaskFunction('pinnedEcho', {
            taskFunction: (data) => data,
            workerNodeKeys: [1],
          }),
        )
        const source = pool.workerNodes[1]
        const running = started(source, 'running')
        const runningResult = pool
          .execute({ id: 'running', wait: true })
          .catch((error) => error)
        await bounded(running)
        await bounded(pool.setDefaultTaskFunction('pinnedEcho'))
        const queuedResult = pool
          .execute({ id: 'queued' })
          .catch((error) => error)
        expect(source.tasksQueue.size).toBe(1)
        const exit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        const outcomes = await bounded(
          Promise.all([runningResult, queuedResult]),
        )
        expect(outcomes[0]).toBeInstanceOf(Error)
        expect(outcomes[1]).toBeInstanceOf(Error)
        await bounded(exit)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('redistributes a later eligible task after a stranded pinned task', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await bounded(
          pool.addTaskFunction('pinnedEcho', {
            taskFunction: (data) => data,
            workerNodeKeys: [1],
          }),
        )
        const source = pool.workerNodes[1]
        const running = started(source, 'running')
        const runningResult = pool
          .execute({ id: 'running', wait: true })
          .catch((error) => error)
        await bounded(running)
        const pinnedResult = pool
          .execute({ id: 'pinned' }, 'pinnedEcho')
          .catch((error) => error)
        const quickData = { id: 'quick' }
        expect(await bounded(pool.execute(quickData))).toStrictEqual(quickData)
        const eligibleData = { id: 'eligible' }
        const eligibleResult = pool.execute(eligibleData)
        expect(source.tasksQueue.size).toBe(2)
        const exit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        const outcomes = await bounded(
          Promise.all([runningResult, pinnedResult, eligibleResult]),
        )
        expect(outcomes[0]).toBeInstanceOf(Error)
        expect(outcomes[1]).toBeInstanceOf(Error)
        expect(outcomes[2]).toStrictEqual(eligibleData)
        await bounded(exit)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('rejects a stolen task only when its actual execution worker crashes', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool
          .execute({ id: 'source', wait: true })
          .catch((error) => error)
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const stolenStarted = started(destination, 'stolen')
        let stolenSettled = false
        const stolenResult = pool
          .execute({ id: 'stolen', wait: true })
          .catch((error) => error)
          .then((outcome) => {
            stolenSettled = true
            return outcome
          })
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        pool.stealTask(source, 1)
        send(destination, { release: 'destination' })
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        await bounded(stolenStarted)
        const sourceExit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        await bounded(sourceExit)
        expect(stolenSettled).toBe(false)
        const destinationExit = new Promise((resolve) =>
          destination.addEventListener('exit', resolve, { once: true })
        )
        send(destination, { crash: true })
        expect(await bounded(stolenResult)).toBeInstanceOf(Error)
        await bounded(destinationExit)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('routes a running stolen task abort to its live owner after index shifting', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        restartWorkerOnError: false,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await bounded(pool.execute({ warmup: true }))
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool.execute({ id: 'source', wait: true }).catch(
          (error) => error,
        )
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const controller = new AbortController()
        const stolenStarted = started(destination, 'stolen')
        const stolenResult = pool.execute(
          { id: 'stolen', wait: true },
          undefined,
          controller.signal,
        ).catch((error) => error)
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        pool.stealTask(source, 1)
        send(destination, { release: 'destination' })
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        await bounded(stolenStarted)
        const exit = once(source, 'exit')
        send(source, { crash: true })
        await bounded(exit)
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        expect(pool.workerNodes.indexOf(destination)).toBe(0)
        controller.abort(new Error('Cancel running stolen task'))
        expect(await bounded(stolenResult)).toBeInstanceOf(Error)
        expect(destination.usage.tasks.executing).toBe(0)
        expect(pool.promiseResponseMap.size).toBe(0)
        send(destination, { release: 'stolen' })
        const data = { id: 'followup' }
        expect(await bounded(pool.execute(data))).toStrictEqual(data)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('can abort all redistributing tasks from backPressureEnd', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          size: 2,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool
          .execute({ id: 'source', wait: true })
          .catch((error) => error)
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const controller = new AbortController()
        const backPressure = once(pool.eventTarget, 'backPressure')
        const firstController = new AbortController()
        let firstAbortedError
        const firstAbortedResult = pool
          .execute({ id: 'first-aborted' }, undefined, firstController.signal)
          .catch((error) => {
            firstAbortedError = error
            return error
          })
        const firstHealthyData = { id: 'first-healthy' }
        const firstHealthyResult = pool.execute(firstHealthyData)
        let abortedError
        const abortedResult = pool
          .execute({ id: 'aborted' }, undefined, controller.signal)
          .catch((error) => {
            abortedError = error
            return error
          })
        const healthyData = { id: 'healthy' }
        const healthyResult = pool.execute(healthyData)
        await bounded(
          Promise.all([sourceStarted, destinationStarted, backPressure]),
        )
        expect(source.tasksQueue.size).toBe(2)
        expect(destination.tasksQueue.size).toBe(2)
        listenOnce(pool.eventTarget, 'backPressureEnd', () => {
          firstController.abort()
          controller.abort()
        })
        const exit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        expect(controller.signal.aborted).toBe(true)
        expect(firstController.signal.aborted).toBe(true)
        expect(firstAbortedError).toBeInstanceOf(Error)
        expect(abortedError).toBeInstanceOf(Error)
        send(destination, { release: 'destination' })
        expect(await bounded(abortedResult)).toBeInstanceOf(Error)
        expect(await bounded(firstAbortedResult)).toBeInstanceOf(Error)
        expect(await bounded(firstHealthyResult)).toStrictEqual(
          firstHealthyData,
        )
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        expect(await bounded(healthyResult)).toStrictEqual(healthyData)
        await bounded(exit)
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('skips a detached queued task aborted by an earlier migration hook', async () => {
      const controller = new AbortController()
      const executions = []
      class AbortingPool extends PoolClass {
        beforeTaskExecutionHook(workerNodeKey, task) {
          executions.push(task.data?.id)
          if (task.data?.id === 'first-migrated') controller.abort()
          super.beforeTaskExecutionHook(workerNodeKey, task)
        }
      }
      const pool = new AbortingPool(2, workerFile, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
        errorEventHandler: preventWorkerError,
        workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
      })

      try {
        if (!pool.info.ready) await bounded(once(pool.eventTarget, 'ready'))
        await bounded(pool.execute({ warmup: true }))
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const failed = pool
          .execute({ id: 'source', wait: true })
          .catch((error) => error)
        const healthyData = { id: 'destination', wait: true }
        const healthy = pool.execute(healthyData)
        const firstData = { id: 'first-migrated' }
        const first = pool.execute(firstData)
        const quickData = { id: 'healthy-queued' }
        const quick = pool.execute(quickData)
        const later = pool
          .execute({ id: 'later-migrated' }, undefined, controller.signal)
          .catch((error) => error)
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        expect(source.tasksQueue.size).toBe(2)
        send(destination, { release: 'destination' })
        expect(await bounded(healthy)).toStrictEqual(healthyData)
        expect(await bounded(quick)).toStrictEqual(quickData)
        const exit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        await bounded(exit)
        expect(await bounded(failed)).toBeInstanceOf(Error)
        expect(await bounded(first)).toStrictEqual(firstData)
        expect(await bounded(later)).toBeInstanceOf(Error)
        expect(controller.signal.aborted).toBe(true)
        expect(executions.filter((id) => id === 'first-migrated')).toHaveLength(
          1,
        )
        expect(executions).not.toContain('later-migrated')
        expect(source.tasksQueue.size).toBe(0)
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('routes a queued task abort to its new owner after redistribution and index shifting', async () => {
      const pool = await createPool(2, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        await pool.execute({ warmup: true })
        const [source, destination] = pool.workerNodes
        const sourceStarted = started(source, 'source')
        const destinationStarted = started(destination, 'destination')
        const sourceResult = pool
          .execute({ id: 'source', wait: true })
          .catch((error) => error)
        const destinationData = { id: 'destination', wait: true }
        const destinationResult = pool.execute(destinationData)
        const controller = new AbortController()
        const queued = pool
          .execute({ id: 'aborted' }, undefined, controller.signal)
          .catch((error) => error)
        await bounded(Promise.all([sourceStarted, destinationStarted]))
        const exit = new Promise((resolve) =>
          source.addEventListener('exit', resolve, { once: true })
        )
        send(source, { crash: true })
        expect(await bounded(sourceResult)).toBeInstanceOf(Error)
        await bounded(exit)
        const reason = new Error('Cancel redistributed task')
        controller.abort(reason)
        expect(await bounded(queued)).toBeInstanceOf(Error)
        send(destination, { release: 'destination' })
        expect(await bounded(destinationResult)).toStrictEqual(destinationData)
        expect(destination.tasksQueue.size).toBe(0)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('can destroy the pool immediately after catching a worker failure', async () => {
      const pool = await createPool()
      try {
        const workerNode = pool.workerNodes[0]
        const running = started(workerNode, 'running')
        const result = pool
          .execute({ id: 'running', wait: true })
          .catch((error) => error)
        await bounded(running)
        send(workerNode, { crash: true })
        expect(await bounded(result)).toBeInstanceOf(Error)
        await bounded(pool.destroy())
        expect(pool.info.started).toBe(false)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('does not attribute intentionally terminated tasks to a later crashed worker', async () => {
      const pool = await createPool(2)
      try {
        await pool.execute({ warmup: true })
        const [removed, survivor] = pool.workerNodes
        const removedStarted = started(removed, 'removed')
        const survivorStarted = started(survivor, 'survivor')
        let removedTaskSettled = false
        pool
          .execute({ id: 'removed', wait: true })
          .finally(() => {
            removedTaskSettled = true
          })
          .catch(() => {})
        const survivorResult = pool
          .execute({ id: 'survivor', wait: true })
          .catch((error) => error)
        await bounded(Promise.all([removedStarted, survivorStarted]))
        await bounded(pool.destroyWorkerNode(0))
        send(survivor, { crash: true })
        expect(await bounded(survivorResult)).toBeInstanceOf(Error)
        expect(removedTaskSettled).toBe(false)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    it('does not wait for a taskFinished event for a failed send during destroy', async () => {
      const pool = await createPool(1, {
        enableTasksQueue: true,
        tasksQueueOptions: {
          concurrency: 1,
          tasksFinishedTimeout: 30000,
          tasksStealingOnBackPressure: false,
          taskStealing: false,
        },
      })
      try {
        const workerNode = pool.workerNodes[0]
        const runningStarted = started(workerNode, 'running')
        pool.execute({ id: 'running', wait: true }).catch(() => {})
        await bounded(runningStarted)
        const bad = pool
          .execute({ uncloneable: () => {} })
          .catch((error) => error)
        await bounded(pool.destroy())
        const error = await bounded(bad)
        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('DataCloneError')
        expect(pool.info.started).toBe(false)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    for (const destinationBusy of [false, true]) {
      it(`isolates a queued send failure after worker failure (destination busy: ${destinationBusy})`, async () => {
        const pool = await createPool(2, {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
        })
        try {
          await bounded(pool.execute({ warmup: true }))
          const [source, destination] = pool.workerNodes
          const sourceStarted = started(source, 'source')
          const destinationStarted = started(destination, 'destination')
          const running = pool
            .execute({ id: 'source', wait: true })
            .catch((error) => error)
          const healthyData = { id: 'destination', wait: true }
          const healthy = pool.execute(healthyData)
          await bounded(Promise.all([sourceStarted, destinationStarted]))
          await bounded(
            pool.addTaskFunction('migratingEcho', {
              taskFunction: (data) => ({ id: data.id }),
              workerNodeKeys: [0],
            }),
          )
          const bad = pool
            .execute(
              { id: 'bad', uncloneable: () => {} },
              'migratingEcho',
            )
            .catch((error) => error)
          const laterData = { id: 'later' }
          const later = pool.execute(laterData, 'migratingEcho')
          expect(source.tasksQueue.size).toBe(2)
          if (!destinationBusy) {
            send(destination, { release: 'destination' })
            expect(await bounded(healthy)).toStrictEqual(healthyData)
          }
          const exit = new Promise((resolve) =>
            source.addEventListener('exit', resolve, { once: true })
          )
          send(source, { crash: true })
          await bounded(exit)
          if (destinationBusy) {
            expect(destination.tasksQueue.size).toBe(2)
            send(destination, { release: 'destination' })
            expect(await bounded(healthy)).toStrictEqual(healthyData)
          }
          const outcomes = await bounded(Promise.all([running, bad, later]))
          expect(outcomes[0]).toBeInstanceOf(Error)
          expect(outcomes[1]).toBeInstanceOf(Error)
          expect(outcomes[1].name).toBe('DataCloneError')
          expect(outcomes[2]).toStrictEqual(laterData)
          const followupData = { id: 'followup' }
          expect(await bounded(pool.execute(followupData))).toStrictEqual(
            followupData,
          )
          expect(source.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
          expect(destination.usage.tasks.executing).toBe(0)
          expect(
            destination.getTaskFunctionWorkerUsage('migratingEcho').tasks
              .executing,
          ).toBe(0)
        } finally {
          await cleanupRegressionPool(pool)
        }
      })
    }

    for (
      const [description, message] of [
        ['number', { crashWith: 42 }],
        ['string', { crashWith: 'Worker threw a string' }],
        ['false', { crashWith: false }],
        ['undefined', { crashWith: undefined }],
        ['Error', { crash: true }],
      ]
    ) {
      it(`settles a task with an Error after a native ${description} failure`, async () => {
        const pool = await createPool()
        try {
          const node = pool.workerNodes[0]
          const running = started(node, 'running')
          const result = pool.execute({ id: 'running', wait: true }).catch(
            (error) => error,
          )
          await bounded(running)
          send(node, message)
          expect(await bounded(result)).toBeInstanceOf(Error)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool)
        }
      })
    }

    for (const abortTarget of ['healthy-flush', 'detached-migration']) {
      it(`defers backPressureEnd until fullEnd queue-disable handoffs finish (${abortTarget})`, async () => {
        const DynamicPoolClass = DynamicThreadPool
        const pool = new DynamicPoolClass(1, 2, workerFile, {
          enableTasksQueue: true,
          restartWorkerOnError: false,
          tasksQueueOptions: {
            concurrency: 1,
            size: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
          errorEventHandler: preventWorkerError,
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        })

        const capturedNodes = new Set(pool.workerNodes)
        try {
          if (!pool.info.ready) await bounded(once(pool.eventTarget, 'ready'))
          const minimumNode = pool.workerNodes[0]
          const minimumStarted = started(minimumNode, 'minimum')
          const minimumData = { id: 'minimum', wait: true }
          const minimum = pool.execute(minimumData).catch((error) => error)
          await bounded(minimumStarted)
          const full = once(pool.eventTarget, 'full')
          const failed = pool
            .execute({ id: 'dynamic', wait: true })
            .catch((error) => error)
          const source = pool.workerNodes[1]
          capturedNodes.add(source)
          await bounded(Promise.all([full, started(source, 'dynamic')]))
          for (
            const [name, workerNodeKeys] of [
              ['cursorEcho', [0]],
              ['migratingEcho', [0, 1]],
            ]
          ) {
            await bounded(
              pool.addTaskFunction(name, {
                taskFunction: async (data) =>
                  data.wait ? await new Promise(() => {}) : data,
                workerNodeKeys,
              }),
            )
          }
          const controller = new AbortController()
          const abortReason = new Error(`Abort ${abortTarget} after handoff`)
          const healthyData = {
            id: 'healthy-queued',
            wait: abortTarget === 'healthy-flush',
          }
          const detachedData = {
            id: 'detached-queued',
            wait: abortTarget === 'detached-migration',
          }
          const backPressure = once(pool.eventTarget, 'backPressure')
          const healthy = pool
            .execute(
              healthyData,
              'cursorEcho',
              abortTarget === 'healthy-flush' ? controller.signal : undefined,
            )
            .catch((error) => error)
          const healthyWrapper = [...pool.promiseResponseMap.values()].at(-1)
          const detached = pool
            .execute(
              detachedData,
              'migratingEcho',
              abortTarget === 'detached-migration'
                ? controller.signal
                : undefined,
            )
            .catch((error) => error)
          const detachedWrapper = [...pool.promiseResponseMap.values()].at(-1)
          await bounded(backPressure)
          expect(minimumNode.tasksQueue.size).toBe(1)
          expect(source.tasksQueue.size).toBe(1)
          let fullEndCalls = 0
          let endState
          listenOnce(pool.eventTarget, 'fullEnd', () => {
            ++fullEndCalls
            pool.enableTasksQueue(false)
          })
          listenOnce(pool.eventTarget, 'backPressureEnd', () => {
            endState = {
              detachedOwner: detachedWrapper.workerNodeKey,
              executing: minimumNode.usage.tasks.executing,
              healthyOwner: healthyWrapper.workerNodeKey,
              sourceQueue: source.tasksQueue.size,
            }
            controller.abort(abortReason)
          })
          const exit = new Promise((resolve) =>
            source.addEventListener('exit', resolve, { once: true })
          )
          send(source, { crash: true })
          await bounded(exit)
          expect(await bounded(failed)).toBeInstanceOf(Error)
          expect(
            await bounded(abortTarget === 'healthy-flush' ? healthy : detached),
          ).toBe(abortReason)
          expect(
            await bounded(abortTarget === 'healthy-flush' ? detached : healthy),
          ).toStrictEqual(
            abortTarget === 'healthy-flush' ? detachedData : healthyData,
          )
          expect(endState).toStrictEqual({
            detachedOwner: 0,
            executing: 3,
            healthyOwner: 0,
            sourceQueue: 0,
          })
          expect(fullEndCalls).toBe(1)
          send(minimumNode, { release: 'minimum' })
          expect(await bounded(minimum)).toStrictEqual(minimumData)
          expect(minimumNode.tasksQueue.size).toBe(0)
          expect(source.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool, capturedNodes)
        }
      })
    }

    for (
      const abortReason of [
        new Error('Detached task cancelled'),
        'Detached task cancelled',
        42,
      ]
    ) {
      it(`preserves a detached task abort reason from fullEnd (${String(abortReason)})`, async () => {
        const DynamicPoolClass = DynamicThreadPool
        const executions = []
        class ObservedDynamicPool extends DynamicPoolClass {
          beforeTaskExecutionHook(workerNodeKey, task) {
            executions.push(task.data?.id)
            super.beforeTaskExecutionHook(workerNodeKey, task)
          }
        }
        const pool = new ObservedDynamicPool(1, 2, workerFile, {
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 1,
            tasksStealingOnBackPressure: false,
            taskStealing: false,
          },
          errorEventHandler: preventWorkerError,
          workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
        })

        const capturedNodes = new Set(pool.workerNodes)
        try {
          if (!pool.info.ready) await bounded(once(pool.eventTarget, 'ready'))
          const minimumNode = pool.workerNodes[0]
          const minimumStarted = started(minimumNode, 'minimum')
          const minimumData = { id: 'minimum', wait: true }
          const minimum = pool.execute(minimumData).catch((error) => error)
          await bounded(minimumStarted)
          const full = once(pool.eventTarget, 'full')
          const failed = pool
            .execute({ id: 'dynamic', wait: true })
            .catch((error) => error)
          const source = pool.workerNodes[1]
          capturedNodes.add(source)
          await bounded(Promise.all([full, started(source, 'dynamic')]))
          await bounded(
            pool.addTaskFunction('cursorEcho', {
              taskFunction: (data) => data,
              workerNodeKeys: [0],
            }),
          )
          await bounded(
            pool.addTaskFunction('migratingEcho', {
              taskFunction: (data) => data,
              workerNodeKeys: [0, 1],
            }),
          )
          const cursorData = { id: 'cursor' }
          const cursor = pool
            .execute(cursorData, 'cursorEcho')
            .catch((error) => error)
          const controller = new AbortController()
          const target = pool
            .execute({ id: 'detached' }, 'migratingEcho', controller.signal)
            .catch((error) => error)
          expect(source.tasksQueue.size).toBe(1)
          let fullEndCalls = 0
          listenOnce(pool.eventTarget, 'fullEnd', () => {
            ++fullEndCalls
            controller.abort(abortReason)
          })
          const exit = new Promise((resolve) =>
            source.addEventListener('exit', resolve, { once: true })
          )
          // Abrupt external termination supplies the exit-only path without a native error.
          source.terminate()
          await bounded(exit)
          expect(await bounded(failed)).toBeInstanceOf(Error)
          const aborted = await bounded(target)
          if (abortReason instanceof Error) {
            expect(aborted).toBe(abortReason)
          } else {
            expect(aborted).toBeInstanceOf(Error)
            if (typeof abortReason === 'string') {
              expect(aborted.message).toBe(abortReason)
            } else {
              expect(aborted.message).toMatch(
                /^Task 'migratingEcho' id '[\da-f-]+' aborted$/,
              )
            }
          }
          expect(fullEndCalls).toBe(1)
          expect(controller.signal.aborted).toBe(true)
          expect(executions).not.toContain('detached')
          expect(minimumNode.tasksQueue.size).toBe(1)
          send(minimumNode, { release: 'minimum' })
          expect(await bounded(minimum)).toStrictEqual(minimumData)
          expect(await bounded(cursor)).toStrictEqual(cursorData)
          expect(source.tasksQueue.size).toBe(0)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool, capturedNodes)
        }
      })
    }

    for (const fail of [false, true]) {
      it(`settles a buffered response/error race without losing delivered responses (task failure: ${fail})`, async () => {
        const pool = await createPool()
        try {
          const source = pool.workerNodes[0]
          const exit = once(source, 'exit')
          let responseReceived = false
          source.addEventListener('message', ({ data: message }) => {
            if (message.taskId != null) responseReceived = true
          })
          const status = new Int32Array(new SharedArrayBuffer(4))
          const response = { completed: true }
          const result = pool.execute({
            crashAfterResponse: status.buffer,
            fail,
            response,
          }).catch((error) => error)
          // Hold the main loop until both the private response and native error
          // are posted. Web Workers have no receiveMessageOnPort drain API.
          Atomics.wait(status, 0, 0, 5000)
          expect(Atomics.load(status, 0)).toBe(1)
          const outcome = await bounded(result)
          if (!responseReceived) {
            expect(outcome).toBeInstanceOf(Error)
            expect(outcome.message).toContain(
              'Worker crashed after task response',
            )
          } else if (fail) {
            expect(outcome).toBeInstanceOf(Error)
            expect(outcome.message).toBe('Task failed before worker crash')
          } else {
            expect(outcome).toStrictEqual(response)
          }
          await bounded(exit)
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          await cleanupRegressionPool(pool)
        }
      })
    }

    it('isolates an uncloneable task without retaining execution usage', async () => {
      const pool = await createPool()
      try {
        await bounded(pool.addTaskFunction('echo', (data) => data))
        const source = pool.workerNodes[0]
        const error = await bounded(
          pool.execute({ uncloneable: () => {} }, 'echo').catch((error) =>
            error
          ),
        )
        expect(error).toBeInstanceOf(Error)
        expect(error.name).toBe('DataCloneError')
        expect(pool.promiseResponseMap.size).toBe(0)
        expect(source.usage.tasks.executing).toBe(0)
        expect(source.getTaskFunctionWorkerUsage('echo').tasks.executing).toBe(
          0,
        )
        const data = { id: 'followup' }
        expect(await bounded(pool.execute(data, 'echo'))).toStrictEqual(data)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    for (const event of ['busyEnd', 'exit']) {
      it(`can destroy the pool from a ${event} listener after a worker failure`, async () => {
        const pool = await createPool()
        try {
          const node = pool.workerNodes[0]
          const running = started(node, 'running')
          const result = pool.execute({ id: 'running', wait: true }).catch(
            (error) => error,
          )
          await bounded(running)
          let destruction
          listenOnce(event === 'exit' ? node : pool.eventTarget, event, () => {
            destruction = pool.destroy()
          })
          send(node, { crash: true })
          expect(await bounded(result)).toBeInstanceOf(Error)
          await bounded(destruction)
          expect(pool.info.started).toBe(false)
        } finally {
          await cleanupRegressionPool(pool)
        }
      })
    }

    it('rejects a failed dynamic worker task and accepts subsequent work', async () => {
      const pool = new DynamicThreadPool(0, 1, workerFile, {
        errorEventHandler: preventWorkerError,
      })
      try {
        const result = pool.execute({ id: 'dynamic', wait: true }).catch(
          (error) => error,
        )
        const source = pool.workerNodes[0]
        await bounded(started(source, 'dynamic'))
        send(source, { crash: true })
        expect(await bounded(result)).toBeInstanceOf(Error)
        const data = { recovered: true }
        expect(await bounded(pool.execute(data))).toStrictEqual(data)
        expect(pool.promiseResponseMap.size).toBe(0)
      } finally {
        await cleanupRegressionPool(pool)
      }
    })

    for (
      const {
        mode,
        defaultPinned = false,
        live = false,
        reject = false,
        sourceIndex = 1,
        unrestricted = false,
      } of [
        { mode: 'named pinned rejection', reject: true },
        { mode: 'default pinned rejection', defaultPinned: true, reject: true },
        { mode: 'legal pinned migration after compaction', sourceIndex: 0 },
        { mode: 'unrestricted migration', unrestricted: true },
        { mode: 'live unrestricted metadata precedence', live: true },
        {
          mode: 'live default mapping precedence',
          defaultPinned: true,
          live: true,
        },
      ]
    ) {
      it(`preserves detached bootstrap affinity metadata: ${mode}`, async () => {
        const pool = new DynamicThreadPool(
          0,
          2,
          new URL(
            '../worker-files/thread/bootstrapAffinityWorker.mjs',
            import.meta.url,
          ),
          {
            enableTasksQueue: true,
            restartWorkerOnError: false,
            errorEventHandler: preventWorkerError,
            tasksQueueOptions: {
              concurrency: 1,
              tasksStealingOnBackPressure: false,
              taskStealing: false,
            },
            workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
          },
        )
        const capturedNodes = []
        const held = []
        const metadataReady = (node) => {
          if (node.info.taskFunctionsProperties?.length > 0) {
            return Promise.resolve()
          }
          return new Promise((resolve) => {
            const listener = ({ data }) => {
              if (data.ready === true && data.taskFunctionsProperties != null) {
                node.removeEventListener('message', listener)
                resolve()
              }
            }
            node.addEventListener('message', listener)
          })
        }
        const bootstrapReceived = (node) =>
          new Promise((resolve) => {
            const listener = ({ data }) => {
              if (data.bootstrapReceived === true) {
                node.worker.removeEventListener('message', listener)
                resolve()
              }
            }
            node.worker.addEventListener('message', listener)
          })
        const configureSource = (node) =>
          send(node, {
            releaseBootstrap: { defaultPinned, workerNodeKeys: [sourceIndex] },
          })
        const targetIndex = 1 - sourceIndex
        try {
          held.push(
            pool.execute({ id: 'held-0', wait: true }, 'echo').catch((error) =>
              error
            ),
          )
          capturedNodes.push(pool.workerNodes[0])
          const heldStarted = [started(capturedNodes[0], 'held-0')]
          await bounded(bootstrapReceived(capturedNodes[0]))
          if (sourceIndex === 0) {
            configureSource(capturedNodes[0])
            await bounded(metadataReady(capturedNodes[0]))
          }
          held.push(
            pool.execute({ id: 'held-1', wait: true }, 'echo').catch((error) =>
              error
            ),
          )
          capturedNodes.push(pool.workerNodes[1])
          heldStarted.push(started(capturedNodes[1], 'held-1'))
          await bounded(bootstrapReceived(capturedNodes[1]))
          const source = capturedNodes[sourceIndex]
          const target = capturedNodes[targetIndex]
          if (sourceIndex === 1) configureSource(source)
          await bounded(
            Promise.all([metadataReady(source), heldStarted[sourceIndex]]),
          )
          expect(
            source.info.taskFunctionsProperties.find((properties) =>
              properties.name === 'pinned'
            ).workerNodeKeys,
          )
            .toStrictEqual([sourceIndex])
          if (defaultPinned) {
            expect(source.info.taskFunctionsProperties[1].name).toBe('pinned')
          }
          expect(target.info.taskFunctionsProperties ?? []).toHaveLength(0)
          expect(target.info.ready).toBe(true)
          let filler
          if (unrestricted) {
            filler = pool.execute({ id: 'filler' }, 'echo').catch((error) =>
              error
            )
            expect(target.tasksQueue.size).toBe(1)
          }
          const queuedData = { id: 'queued' }
          const queued = pool.execute(
            queuedData,
            defaultPinned ? undefined : unrestricted ? 'echo' : 'pinned',
          ).catch((error) => error)
          const queuedTaskId = [...pool.promiseResponseMap.keys()].at(-1)
          expect(source.tasksQueue.size).toBe(1)
          if (live) {
            const ready = metadataReady(target)
            send(target, { releaseBootstrap: {} })
            await bounded(Promise.all([ready, heldStarted[targetIndex]]))
            expect(
              target.info.taskFunctionsProperties.find((properties) =>
                properties.name === 'pinned'
              ).workerNodeKeys,
            )
              .toBeUndefined()
            if (defaultPinned) {
              expect(target.info.taskFunctionsProperties[1].name).toBe('echo')
            }
          }
          const exit = once(source, 'exit')
          send(source, { crash: true })
          await bounded(exit)
          expect(await bounded(held[sourceIndex])).toBeInstanceOf(Error)
          expect(pool.workerNodes).toStrictEqual([target])
          expect(source.tasksQueue.size).toBe(0)
          if (reject) {
            expect(target.info.taskFunctionsProperties ?? []).toHaveLength(0)
            expect(target.tasksQueue.size).toBe(0)
            expect(pool.promiseResponseMap.has(queuedTaskId)).toBe(false)
            expect(await bounded(queued)).toBeInstanceOf(Error)
          } else {
            expect(target.tasksQueue.size).toBe(unrestricted ? 2 : 1)
          }
          send(target, { releaseBootstrap: {} })
          await bounded(heldStarted[targetIndex])
          send(target, { release: `held-${targetIndex}` })
          expect(await bounded(held[targetIndex])).toMatchObject({
            id: `held-${targetIndex}`,
            workerId: target.info.id,
          })
          if (!reject) {
            expect(await bounded(queued)).toStrictEqual({
              ...queuedData,
              taskFunction: defaultPinned || unrestricted ? 'echo' : 'pinned',
              workerId: target.info.id,
            })
          }
          if (filler != null) {
            expect(await bounded(filler)).toMatchObject({
              id: 'filler',
              workerId: target.info.id,
            })
          }
          expect(pool.promiseResponseMap.size).toBe(0)
        } finally {
          for (const node of capturedNodes) send(node, { releaseBootstrap: {} })
          await cleanupRegressionPool(pool, capturedNodes)
        }
      })
    }
  },
})
