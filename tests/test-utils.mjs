import { TaskFunctions } from './test-types.mjs'

export const waitWorkerNodeEvents = async (
  pool,
  workerNodeEvent,
  numberOfEventsToWait,
) => {
  return await new Promise((resolve) => {
    let events = 0
    if (numberOfEventsToWait === 0) {
      resolve(events)
      return
    }
    const eventHandler = () => {
      ++events
      if (events === numberOfEventsToWait) {
        resolve(events)
      }
    }
    for (const workerNode of pool.workerNodes) {
      switch (workerNodeEvent) {
        case 'message':
        case 'messageerror':
        case 'taskFinished':
        case 'backPressure':
        case 'idle':
        case 'exit':
          workerNode.addEventListener(workerNodeEvent, eventHandler)
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
    pool.eventTarget?.addEventListener(poolEvent, () => {
      ++events
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
  n = BigInt(n)
  let current = 1n
  let previous = 0n
  while (--n) {
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
