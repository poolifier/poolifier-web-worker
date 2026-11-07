import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'
import { DynamicThreadPool, FixedThreadPool } from '../../src/mod.ts'

const worker = new URL(
  './../worker-files/thread/workerNameWorker.mjs',
  import.meta.url,
)

const polluteObjectPrototype = (property, value) => {
  Object.defineProperty(Object.prototype, property, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

const clearPrototypePollution = () => {
  Reflect.deleteProperty(Object.prototype, 'name')
  Reflect.deleteProperty(Object.prototype, 'workerOptions')
}

describe({
  name: 'Worker launch prototype pollution test suite',
  sanitizeOps: false,
  sanitizeResources: false,
  fn: () => {
    it('ignores inherited pool worker options', async () => {
      polluteObjectPrototype('workerOptions', { name: 'polluted' })
      let pool
      try {
        pool = new FixedThreadPool(1, worker)
        await expect(pool.execute()).resolves.toBe('')
      } finally {
        clearPrototypePollution()
        if (pool != null) {
          await pool.destroy()
        }
      }
    })

    it('ignores inherited properties in explicit worker options', async () => {
      polluteObjectPrototype('name', 'polluted')
      let pool
      try {
        pool = new FixedThreadPool(1, worker, { workerOptions: {} })
        await expect(pool.execute()).resolves.toBe('')
      } finally {
        clearPrototypePollution()
        if (pool != null) {
          await pool.destroy()
        }
      }
    })

    it('ignores worker options polluted after dynamic pool construction', async () => {
      const pool = new DynamicThreadPool(0, 1, worker)
      polluteObjectPrototype('workerOptions', { name: 'polluted' })
      try {
        await expect(pool.execute()).resolves.toBe('')
      } finally {
        clearPrototypePollution()
        await pool.destroy()
      }
    })

    it('restores startup state after rejecting launch options', async () => {
      const pool = new FixedThreadPool(1, worker, {
        startWorkers: false,
        workerOptions: { preload: new Array(1) },
      })
      try {
        expect(() => pool.start()).toThrow(
          new TypeError(
            'Invalid workerOptions.preload: must not be a sparse array',
          ),
        )
        expect(pool.starting).toBe(false)
        expect(pool.startingMinimumNumberOfWorkers).toBe(false)
        pool.opts.workerOptions = {}
        pool.start()
        await expect(pool.execute()).resolves.toBe('')
      } finally {
        if (pool.info.started) {
          await pool.destroy()
        }
      }
    })
  },
})
