import { TaskFunctions } from './test-types.mjs'

export const waitWorkerNodeEvents = async (
  pool,
  workerEvent,
  numberOfEventsToWait,
) => {
  return await new Promise((resolve) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    const eventHandler = () => {
      ;++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    }
    for (const workerNode of pool.workerNodes) {
      switch (workerEvent) {
        case 'message':
          workerNode.addEventListener(workerEvent, eventHandler)
          break
        case 'messageerror':
          workerNode.addEventListener(workerEvent, eventHandler)
          break
        case 'exit':
          workerNode.addEventListener(workerEvent, eventHandler)
          break
        default:
          throw new Error('Invalid worker node event')
      }
    }
  })
}

export const waitPoolEvents = async (pool, poolEvent, numberOfEventsToWait) => {
  return await new Promise((resolve) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    pool.emitter?.on(poolEvent, () => {
      ;++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    })
  })
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

export const generateRandomInteger = (
  max = Number.MAX_SAFE_INTEGER,
  min = 0,
) => {
  if (max < min || max < 0 || min < 0) {
    throw new RangeError('Invalid interval')
  }
  max = Math.floor(max)
  if (min != null && min !== 0) {
    min = Math.ceil(min)
    return Math.floor(Math.random() * (max - min + 1)) + min
  }
  return Math.floor(Math.random() * (max + 1))
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
 * Intentionally inefficient implementation.
 * @param {number} n - The number of fibonacci numbers to generate.
 * @returns {number} - The nth fibonacci number.
 */
export const fibonacci = (n) => {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

/**
 * Intentionally inefficient implementation.
 * @param {number} n - The number to calculate the factorial of.
 * @returns {number} - The factorial of n.
 */
export const factorial = (n) => {
  if (n === 0) {
    return 1
  }
  return factorial(n - 1) * n
}

export const executeTaskFunction = (data) => {
  switch (data.function) {
    case TaskFunctions.jsonIntegerSerialization:
      return jsonIntegerSerialization(data.n || 100)
    case TaskFunctions.fibonacci:
      return fibonacci(data.n || 25)
    case TaskFunctions.factorial:
      return factorial(data.n || 100)
    default:
      throw new Error('Unknown worker function')
  }
}
