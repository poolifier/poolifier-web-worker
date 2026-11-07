export const singleReadPromise = (promise) => {
  const then = promise.then
  let read = false
  Object.defineProperty(promise, 'then', {
    get() {
      if (read) throw new Error('Promise then accessed more than once')
      read = true
      return then
    },
  })
  return promise
}
