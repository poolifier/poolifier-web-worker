import { expect } from '@std/expect'
import { describe, it } from '@std/testing/bdd'

import { FixedQueue } from '../../src/queues/fixed-queue.ts'
import { defaultQueueSize } from '../../src/queues/queue-types.ts'

describe('Fixed queue test suite', () => {
  it('Verify constructor() behavior', () => {
    expect(() => new FixedQueue('')).toThrow(
      new TypeError("Invalid fixed queue size: '' is not an integer"),
    )
    expect(() => new FixedQueue(-1)).toThrow(
      new RangeError('Invalid fixed queue size: -1 < 0'),
    )
    const fixedQueue = new FixedQueue()
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(0)
    expect(fixedQueue.nodeArray).toBeInstanceOf(Array)
    expect(fixedQueue.capacity).toBe(defaultQueueSize)
  })

  it('Verify enqueue() behavior', () => {
    const queueSize = 5
    const fixedQueue = new FixedQueue(queueSize)
    let rtSize = fixedQueue.enqueue(1)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(1)
    expect(rtSize).toBe(fixedQueue.size)
    expect(fixedQueue.nodeArray).toMatchObject([{ data: 1, priority: 0 }])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtSize = fixedQueue.enqueue(2)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(2)
    expect(rtSize).toBe(fixedQueue.size)
    expect(fixedQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtSize = fixedQueue.enqueue(3)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(3)
    expect(rtSize).toBe(fixedQueue.size)
    expect(fixedQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtSize = fixedQueue.enqueue(3, -1)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(4)
    expect(rtSize).toBe(fixedQueue.size)
    expect(fixedQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
      { data: 3, priority: -1 },
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtSize = fixedQueue.enqueue(1, 1)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(5)
    expect(rtSize).toBe(fixedQueue.size)
    expect(fixedQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
      { data: 3, priority: -1 },
      { data: 1, priority: 1 },
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    expect(() => fixedQueue.enqueue(4)).toThrow(
      new Error('Fixed queue is full'),
    )
  })

  it('Verify get() behavior', () => {
    const fixedQueue = new FixedQueue()
    fixedQueue.enqueue(1)
    fixedQueue.enqueue(2, -1)
    fixedQueue.enqueue(3)
    expect(fixedQueue.get(0)).toBe(1)
    expect(fixedQueue.get(1)).toBe(2)
    expect(fixedQueue.get(2)).toBe(3)
    expect(fixedQueue.get(3)).toBe(undefined)
  })

  it('Verify dequeue() behavior', () => {
    const queueSize = 5
    const fixedQueue = new FixedQueue(queueSize)
    fixedQueue.enqueue(1)
    fixedQueue.enqueue(2, -1)
    fixedQueue.enqueue(3)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(3)
    expect(fixedQueue.capacity).toBe(queueSize)
    let rtItem = fixedQueue.dequeue()
    expect(fixedQueue.start).toBe(1)
    expect(fixedQueue.size).toBe(2)
    expect(rtItem).toBe(1)
    expect(fixedQueue.nodeArray).toMatchObject([
      undefined,
      { data: 2, priority: -1 },
      { data: 3, priority: 0 },
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtItem = fixedQueue.dequeue()
    expect(fixedQueue.start).toBe(2)
    expect(fixedQueue.size).toBe(1)
    expect(rtItem).toBe(2)
    expect(fixedQueue.nodeArray).toMatchObject([
      undefined,
      undefined,
      { data: 3, priority: 0 },
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtItem = fixedQueue.dequeue()
    expect(fixedQueue.start).toBe(3)
    expect(fixedQueue.size).toBe(0)
    expect(rtItem).toBe(3)
    expect(fixedQueue.nodeArray).toMatchObject([
      undefined,
      undefined,
      undefined,
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
    rtItem = fixedQueue.dequeue()
    expect(fixedQueue.start).toBe(3)
    expect(fixedQueue.size).toBe(0)
    expect(rtItem).toBe(undefined)
    expect(fixedQueue.nodeArray).toMatchObject([
      undefined,
      undefined,
      undefined,
    ])
    expect(fixedQueue.capacity).toBe(queueSize)
  })

  it('Verify delete() behavior', () => {
    const fixedQueue = new FixedQueue()
    fixedQueue.enqueue(1)
    fixedQueue.enqueue(2, -1)
    fixedQueue.enqueue(3)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(3)
    expect(fixedQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 2, priority: -1 },
      { data: 3, priority: 0 },
    ])
    expect(fixedQueue.delete(2)).toBe(true)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(2)
    expect(fixedQueue.nodeArray).toMatchObject([
      { data: 1, priority: 0 },
      { data: 3, priority: 0 },
    ])
    expect(fixedQueue.delete(3)).toBe(true)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(1)
    expect(fixedQueue.nodeArray).toMatchObject([{ data: 1, priority: 0 }])
    expect(fixedQueue.delete(1)).toBe(true)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(0)
    expect(fixedQueue.nodeArray).toMatchObject([])
    expect(fixedQueue.delete(2)).toBe(false)
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(0)
    expect(fixedQueue.nodeArray).toMatchObject([])
  })

  it('Verify iterator behavior', () => {
    const fixedQueue = new FixedQueue()
    fixedQueue.enqueue(1)
    fixedQueue.enqueue(2)
    fixedQueue.enqueue(3)
    let i = fixedQueue.start + 1
    for (const value of fixedQueue) {
      expect(value).toBe(i)
      ++i
    }
    fixedQueue.dequeue()
    i = fixedQueue.start + 1
    for (const value of fixedQueue) {
      expect(value).toBe(i)
      ++i
    }
  })

  it('Verify empty() behavior', () => {
    const fixedQueue = new FixedQueue()
    expect(fixedQueue.empty()).toBe(true)
    fixedQueue.enqueue(1)
    expect(fixedQueue.empty()).toBe(false)
    fixedQueue.dequeue()
    expect(fixedQueue.empty()).toBe(true)
  })

  it('Verify full() behavior', () => {
    const fixedQueue = new FixedQueue(2)
    expect(fixedQueue.full()).toBe(false)
    fixedQueue.enqueue(1)
    expect(fixedQueue.full()).toBe(false)
    fixedQueue.enqueue(2)
    expect(fixedQueue.full()).toBe(true)
    fixedQueue.dequeue()
    expect(fixedQueue.full()).toBe(false)
  })

  it('Verify clear() behavior', () => {
    const fixedQueue = new FixedQueue(2)
    fixedQueue.start = 1
    fixedQueue.size = 2
    fixedQueue.nodeArray = [
      { data: 2, priority: 0 },
      { data: 3, priority: 0 },
    ]
    fixedQueue.clear()
    expect(fixedQueue.start).toBe(0)
    expect(fixedQueue.size).toBe(0)
    expect(fixedQueue.nodeArray).toStrictEqual([undefined, undefined])
  })
})
