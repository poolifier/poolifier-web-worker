export const opaqueThenable = (promise, trap) => {
  let reads = 0
  const target = {
    get then() {
      if (++reads > 1) throw new Error('Thenable then accessed more than once')
      return function (resolve, reject) {
        if (this !== proxy) throw new Error('Incorrect thenable receiver')
        return Reflect.apply(Promise.prototype.then, promise, [resolve, reject])
      }
    },
  }
  const proxy = new Proxy(target, {
    getPrototypeOf() {
      if (trap === 'prototype') throw new Error('Opaque thenable prototype')
      return Promise.prototype
    },
    getOwnPropertyDescriptor() {
      throw new Error('Opaque thenable properties')
    },
  })
  return proxy
}
