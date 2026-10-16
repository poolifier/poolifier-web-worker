import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import {
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
  WorkerChoiceStrategies,
} from '../../src/mod.ts'
import { bounded, sleep, waitForMessage } from '../test-utils.mjs'

const workerFile = new URL(
  '../worker-files/thread/taskAccountingWorker.mjs',
  import.meta.url,
)

const createGate = () => new SharedArrayBuffer(4)

const release = (gate) => {
  Atomics.store(new Int32Array(gate), 0, 1)
  Atomics.notify(new Int32Array(gate), 0)
}

const once = (target, event) =>
  new Promise((resolve) => {
    target.addEventListener(event, resolve, { once: true })
  })

const waitUntil = async (predicate, message, timeoutMs = 5000) => {
  const deadline = performance.now() + timeoutMs
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(message)
    await sleep(5)
  }
}

const createOptions = (started) => ({
  enableTasksQueue: true,
  messageEventHandler: ({ data: { label } }) => started.add(label),
  tasksQueueOptions: {
    concurrency: 1,
    tasksStealingOnBackPressure: false,
    taskStealing: false,
  },
  workerChoiceStrategy: WorkerChoiceStrategies.ROUND_ROBIN,
})

const waitForStart = async (started, label) => {
  await waitUntil(() => started.has(label), `Task '${label}' did not start`)
}

const trackTask = (tasks, task) => {
  // Observe failures immediately, including failures during incomplete setup.
  tasks.push(task.then((value) => ({ value }), (error) => ({ error })))
  return task
}

const finishTasksAndDestroy = async (pool, tasks) => {
  let timeout
  try {
    // Give released tasks time to respond before termination can discard replies,
    // without replacing an assertion failure with a cleanup timeout.
    await Promise.race([
      Promise.all(tasks),
      new Promise((resolve) => {
        timeout = setTimeout(resolve, 5000)
      }),
    ])
  } finally {
    clearTimeout(timeout)
    await bounded(pool.destroy(), 'Accounting pool cleanup remained pending')
  }
}

const ready = async (pool, message) => {
  if (!pool.info.ready) {
    await bounded(once(pool.eventTarget, PoolEvents.ready), message)
  }
}

const withPinnedWorker = (workerNodeKey) => {
  const url = new URL(workerFile)
  url.searchParams.set('pinned-worker', workerNodeKey.toString())
  return url
}

describe({
  name: 'Task response worker accounting',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    for (const fail of [false, true]) {
      it(`accounts for a shifted dynamic worker after idle retirement (failure: ${fail})`, async () => {
        const started = new Set()
        const pool = new DynamicThreadPool(
          1,
          3,
          workerFile,
          createOptions(started),
        )
        const gates = [createGate(), createGate(), createGate()]
        const tasks = []
        try {
          await ready(pool, 'Accounting pool readiness remained pending')
          for (let i = 0; i < gates.length; i++) {
            trackTask(
              tasks,
              pool.execute({
                fail: i === 2 && fail,
                gate: gates[i],
                label: `task-${i}`,
              }),
            )
            await waitForStart(started, `task-${i}`)
          }
          const shiftedWorker = pool.workerNodes[2]
          const retired = once(pool.workerNodes[1], 'exit')
          release(gates[1])
          await bounded(tasks[1], 'Retiring worker task remained pending')
          await bounded(retired, 'Idle worker retirement remained pending')
          expect(pool.workerNodes.indexOf(shiftedWorker)).toBe(1)

          release(gates[2])
          const result = await bounded(
            tasks[2],
            'Shifted worker task remained pending',
          )
          if (fail) {
            expect(result.error.message).toBe('task-2')
          } else {
            expect(result.value).toBe('task-2')
          }
          expect(shiftedWorker.usage.tasks.executing).toBe(0)
          expect(shiftedWorker.usage.tasks.executed).toBe(fail ? 0 : 1)
          expect(shiftedWorker.usage.tasks.failed).toBe(fail ? 1 : 0)

          // Minimum-worker accounting is unaffected by surplus-worker retirement.
          release(gates[0])
          await bounded(tasks[0], 'Minimum worker task remained pending')
          expect(pool.workerNodes[0].usage.tasks.executing).toBe(0)
          expect(pool.workerNodes[0].usage.tasks.executed).toBe(1)
          await waitUntil(
            () => pool.workerNodes.length === 1,
            'Surplus accounting worker did not retire',
          )
        } finally {
          gates.forEach(release)
          await finishTasksAndDestroy(pool, tasks)
        }
      })
    }

    it('drains the actual worker queue after its array index changes', async () => {
      const started = new Set()
      const pool = new DynamicThreadPool(
        1,
        3,
        withPinnedWorker(2),
        createOptions(started),
      )
      const gates = [createGate(), createGate(), createGate()]
      const tasks = []
      try {
        await ready(pool, 'Queue regression pool readiness remained pending')
        for (let i = 0; i < gates.length; i++) {
          trackTask(tasks, pool.execute({ gate: gates[i], label: `task-${i}` }))
          await waitForStart(started, `task-${i}`)
        }
        const shiftedWorker = pool.workerNodes[2]
        const queued = trackTask(
          tasks,
          pool.execute({ label: 'queued' }, 'pinned'),
        )
        expect(shiftedWorker.usage.tasks.queued).toBe(1)
        const retired = once(pool.workerNodes[1], 'exit')
        release(gates[1])
        await bounded(tasks[1], 'Retiring worker task remained pending')
        await bounded(
          retired,
          'Queue regression worker retirement remained pending',
        )
        expect(pool.workerNodes.indexOf(shiftedWorker)).toBe(1)
        release(gates[2])
        await bounded(tasks[2], 'Shifted worker task remained pending')
        await waitForStart(started, 'queued')
        expect(await bounded(queued, 'Queued task remained pending')).toBe(
          'queued',
        )
        expect(shiftedWorker.usage.tasks.executing).toBe(0)
        expect(shiftedWorker.usage.tasks.executed).toBe(2)
        expect(shiftedWorker.usage.tasks.queued).toBe(0)
      } finally {
        gates.forEach(release)
        await finishTasksAndDestroy(pool, tasks)
      }
    })

    it('accounts for tasks stolen from a different worker queue', async () => {
      const started = new Set()
      const pool = new FixedThreadPool(2, workerFile, {
        ...createOptions(started),
        workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
      })
      const gates = [createGate(), createGate()]
      const tasks = []
      try {
        await ready(pool, 'Stealing regression pool readiness remained pending')
        for (let i = 0; i < gates.length; i++) {
          trackTask(tasks, pool.execute({ gate: gates[i], label: `task-${i}` }))
          await waitForStart(started, `task-${i}`)
        }
        const [source, destination] = pool.workerNodes
        expect(source.usage.tasks.executing).toBe(1)
        expect(destination.usage.tasks.executing).toBe(1)
        const stolen = trackTask(tasks, pool.execute({ label: 'stolen' }))
        expect(source.usage.tasks.queued).toBe(1)
        // Exercise the migration helper shared by idle/back-pressure stealing.
        pool.stealTask(source, 1)
        expect(source.usage.tasks.queued).toBe(0)
        expect(destination.usage.tasks.queued).toBe(1)
        release(gates[1])
        await bounded(tasks[1], 'Destination worker task remained pending')
        await waitForStart(started, 'stolen')
        expect(await bounded(stolen, 'Stolen task remained pending')).toBe(
          'stolen',
        )
        expect(source.usage.tasks.executing).toBe(1)
        expect(source.usage.tasks.executed).toBe(0)
        expect(destination.usage.tasks.executing).toBe(0)
        expect(destination.usage.tasks.executed).toBe(2)
      } finally {
        gates.forEach(release)
        await finishTasksAndDestroy(pool, tasks)
      }
    })

    it('preserves worker info overrides in task function statistics', async () => {
      class ProjectedInfoPool extends FixedThreadPool {
        projectInfo = false

        getWorkerInfo(workerNodeKey) {
          const workerInfo = super.getWorkerInfo(workerNodeKey)
          return this.projectInfo && workerInfo != null
            ? {
              ...workerInfo,
              taskFunctionsProperties: workerInfo.taskFunctionsProperties
                ?.slice(0, 2),
            }
            : workerInfo
        }
      }

      const pool = new ProjectedInfoPool(1, workerFile)
      try {
        await ready(pool, 'Override regression pool readiness remained pending')
        const workerNode = pool.workerNodes[0]
        const metadata = waitForMessage(
          workerNode.messageChannel.port1,
          (message) =>
            message.taskFunctionsProperties?.length === 3 &&
            message.taskFunctionsProperties.some(({ name }) =>
              name === 'extra'
            ),
        )
        const [, added] = await bounded(
          Promise.all([
            metadata,
            pool.addTaskFunction('extra', (data) => data),
          ]),
          'Extra task function metadata remained pending',
        )
        expect(added).toBe(true)
        const taskFunctionUsage = workerNode.getTaskFunctionWorkerUsage('extra')
        const controlData = { phase: 'control' }
        expect(
          await bounded(
            pool.execute(controlData, 'extra'),
            'Control task remained pending',
          ),
        ).toStrictEqual(controlData)
        expect(workerNode.usage.tasks.executed).toBe(1)
        expect(taskFunctionUsage.tasks.executed).toBe(1)
        expect(taskFunctionUsage.tasks.executing).toBe(0)

        pool.projectInfo = true
        const projectedData = { phase: 'projected' }
        expect(
          await bounded(
            pool.execute(projectedData, 'extra'),
            'Projected task remained pending',
          ),
        ).toStrictEqual(projectedData)
        expect(workerNode.usage.tasks.executed).toBe(2)
        expect(workerNode.usage.tasks.executing).toBe(0)
        expect(taskFunctionUsage.tasks.executed).toBe(1)
        expect(taskFunctionUsage.tasks.executing).toBe(0)
      } finally {
        pool.projectInfo = false
        await bounded(
          pool.destroy(),
          'Override regression pool cleanup remained pending',
        )
      }
    })
  },
})

describe({
  name: 'Idle stealing retry accounting',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    for (const retireRetryOwner of [false, true]) {
      const name = retireRetryOwner
        ? 'stops the idle stealing retry when its worker is natively terminated'
        : 'keeps the idle stealing retry on its worker after native retirement shifts its index'
      it(name, async () => {
        const received = []
        const gates = {
          anchor: createGate(),
          block: createGate(),
          kill: createGate(),
          loader1: createGate(),
          loader2: createGate(),
          survivor: createGate(),
        }
        const waitForReceived = async (predicate) => {
          await waitUntil(
            () => received.some(predicate),
            'Idle retry worker message remained pending',
          )
          return received.find(predicate)
        }
        const pool = new DynamicThreadPool(
          1,
          4,
          new URL(
            '../worker-files/thread/taskStealingRetryWorker.mjs',
            import.meta.url,
          ),
          {
            enableTasksQueue: true,
            messageEventHandler: ({ data }) => received.push(data),
            tasksQueueOptions: {
              concurrency: 1,
              tasksStealingOnBackPressure: false,
              taskStealing: true,
            },
            workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED,
          },
        )
        const tasks = []
        const execute = (gate, label, name) => {
          trackTask(tasks, pool.execute({ gate, label }, name))
        }
        try {
          await ready(pool, 'Idle retry pool readiness remained pending')
          execute(gates.block, 'block')
          await waitForReceived((message) => message.label === 'block')
          execute(gates.loader1, 'loader-1')
          execute(gates.loader2, 'loader-2')
          execute(gates.anchor, 'anchor', 'anchor')
          execute(gates.survivor, 'survivor', 'survivor')
          const [, retiree, retrying, wrongTarget] = pool.workerNodes
          // Native Web Workers have no workerData; configure the public kill hook
          // over their normal message transport before the inactivity interval.
          for (const node of pool.workerNodes) {
            node.worker.postMessage({ killGate: gates.kill })
          }
          for (const node of pool.workerNodes) {
            await waitForReceived((message) =>
              message.label === 'configured' &&
              message.workerId === node.info.id
            )
          }
          await waitForReceived((message) => message.label === 'anchor')
          await waitForReceived((message) => message.label === 'survivor')

          // A genuine SOFT retirement is blocked inside its public killHandler.
          await waitForReceived((message) =>
            message.label === 'kill-handler' &&
            message.workerId === retiree.info.id
          )
          expect(pool.workerNodes.indexOf(retrying)).toBe(2)
          release(gates.anchor)
          const stolenMessage = await waitForReceived((message) =>
            ['loader-1', 'loader-2'].includes(message.label) &&
            message.workerId === retrying.info.id
          )
          expect(retrying.usage.tasks.sequentiallyStolen).toBe(1)
          expect(retrying.info.continuousStealing).toBe(true)
          expect(pool.workerNodes).toHaveLength(4)
          if (retireRetryOwner) {
            const ownerRetired = once(retrying, 'exit')
            // Terminate the actual native owner while its real retry is sleeping.
            // Its stale numeric key now refers to the still-busy survivor.
            retrying.terminate()
            await bounded(
              ownerRetired,
              'Idle retry owner retirement remained pending',
            )
            expect(pool.workerNodes.indexOf(retrying)).toBe(-1)
            expect(pool.workerNodes.indexOf(wrongTarget)).toBe(2)
            const stolenTaskIndex = stolenMessage.label === 'loader-1' ? 1 : 2
            expect((await bounded(tasks[stolenTaskIndex])).error)
              .toBeInstanceOf(Error)
            // One successful steal schedules a real 200–240ms exponential delay.
            // There is no owner left whose retry completion could be awaited.
            await sleep(300)
            expect(wrongTarget.usage.tasks.stolen).toBe(0)
            expect(wrongTarget.usage.tasks.queued).toBe(0)
            expect(wrongTarget.usage.tasks.executing).toBe(1)
            expect(wrongTarget.usage.tasks.executed).toBe(0)
            expect(pool.workerNodes[0].usage.tasks.executing).toBe(1)
            expect(pool.workerNodes[0].usage.tasks.executed).toBe(0)
            expect(
              received.filter((message) =>
                message.label === stolenMessage.label
              ),
            ).toHaveLength(1)
            return
          }
          const retired = once(retiree, 'exit')
          const acknowledged = waitForMessage(
            retiree,
            (message) => message.kill === 'success',
          )
          release(gates.kill)
          await bounded(
            Promise.all([acknowledged, retired]),
            'Acknowledged native worker retirement remained pending',
          )
          expect(pool.workerNodes.indexOf(retrying)).toBe(1)
          expect(pool.workerNodes.indexOf(wrongTarget)).toBe(2)
          // Prove the splice occurred inside the real delayed retry window.
          expect(retrying.usage.tasks.sequentiallyStolen).toBe(1)
          expect(retrying.info.continuousStealing).toBe(true)
          expect(wrongTarget.usage.tasks.stolen).toBe(0)

          await waitUntil(
            () =>
              retrying.usage.tasks.sequentiallyStolen === 0 ||
              wrongTarget.usage.tasks.stolen > 0,
            'Idle stealing retry did not run',
            2000,
          )
          // A stale-key retry steals a real queued loader into the busy wrong worker.
          expect(wrongTarget.usage.tasks.stolen).toBe(0)
          expect(wrongTarget.usage.tasks.queued).toBe(0)
          expect(retrying.usage.tasks.sequentiallyStolen).toBe(0)
          expect(pool.info.stolenTasks).toBe(1)
        } finally {
          Object.values(gates).forEach(release)
          await finishTasksAndDestroy(pool, tasks)
        }
      })
    }
  },
})
