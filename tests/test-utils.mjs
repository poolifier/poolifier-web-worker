import { TaskFunctions } from './test-types.mjs'

export const waitWorkerNodeEvents = async (
  pool,
  workerNodeEvent,
  numberOfEventsToWait,
  timeoutMs = 5000,
) => {
  return await new Promise((resolve, reject) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    const listeners = []
    const timeout = setTimeout(() => {
      listeners.forEach(({ workerNode, listener }) => {
        workerNode.removeEventListener(workerNodeEvent, listener)
      })
      reject(
        new Error(
          `Timed out after ${timeoutMs.toString()}ms waiting for ${numberOfEventsToWait.toString()} '${workerNodeEvent}' events. Received ${events.toString()} events`,
        ),
      )
    }, timeoutMs)
    const listener = () => {
      events++
      if (events === numberOfEventsToWait) {
        clearTimeout(timeout)
        listeners.forEach(({ workerNode, listener }) => {
          workerNode.removeEventListener(workerNodeEvent, listener)
        })
        resolve(events)
      }
    }
    for (const workerNode of pool.workerNodes) {
      listeners.push({ workerNode, listener })
      workerNode.addEventListener(workerNodeEvent, listener)
    }
  })
}

export const waitPoolEvents = async (
  pool,
  poolEvent,
  numberOfEventsToWait,
  timeoutMs = 5000,
) => {
  const eventPromises = []
  const eventPromise = (eventTarget, event, timeoutMs = 5000) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        eventTarget.removeEventListener(event, listener)
        reject(new Error(`Event '${event}' timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      const listener = (evt) => {
        clearTimeout(timeout)
        eventTarget.removeEventListener(event, listener)
        resolve(evt)
      }

      eventTarget.addEventListener(event, listener)
    })
  }
  for (let i = 0; i < numberOfEventsToWait; i++) {
    eventPromises.push(eventPromise(pool.eventTarget, poolEvent, timeoutMs))
  }
  return await Promise.all(eventPromises)
}

export const sleep = async (ms) => {
  return await new Promise((resolve) => setTimeout(resolve, ms))
}

export const sleepTaskFunction = async (
  data,
  ms,
  rejection = false,
  rejectionMessage = '',
) => {
  return await new Promise((resolve, reject) => {
    setTimeout(
      () =>
        rejection === true
          ? reject(new Error(rejectionMessage))
          : resolve(data),
      ms,
    )
  })
}

export const jsonIntegerSerialization = (n) => {
  for (let i = 0; i < n; i++) {
    const o = {
      a: i,
    }
    JSON.stringify(o)
  }
  return { ok: 1 }
}

/**
 * @param {number} n - The number of fibonacci numbers to generate.
 * @returns {number} - The nth fibonacci number.
 */
export const fibonacci = (n) => {
  if (n === 0) {
    return 0n
  }
  if (n === 1) {
    return 1n
  }
  n = BigInt(n)
  let current = 1n
  let previous = 0n
  while (n-- > 1n) {
    const tmp = current
    current += previous
    previous = tmp
  }
  return current
}

/**
 * @param {number} n - The number to calculate the factorial of.
 * @returns {number} - The factorial of n.
 */
export const factorial = (n) => {
  if (n === 0 || n === 1) {
    return 1n
  }
  n = BigInt(n)
  let factorial = 1n
  for (let i = 1n; i <= n; i++) {
    factorial *= i
  }
  return factorial
}

export const executeTaskFunction = (data) => {
  switch (data.function) {
    case TaskFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.n || 100)
    case TaskFunctions.fibonacci:
      return fibonacci(data.n || 100)
    case TaskFunctions.factorial:
      return factorial(data.n || 100)
    default:
      throw new Error('Unknown worker function')
  }
}
