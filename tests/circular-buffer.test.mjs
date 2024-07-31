import { describe, it } from '@std/testing/bdd'
import { expect } from 'expect'
import { CircularBuffer, defaultBufferSize } from '../src/circular-buffer.ts'

describe('Circular buffer test suite', () => {
  it('Verify that circular buffer can be instantiated', () => {
    const circularBuffer = new CircularBuffer()
    expect(circularBuffer).toBeInstanceOf(CircularBuffer)
    expect(circularBuffer.readIdx).toBe(0)
    expect(circularBuffer.writeIdx).toBe(0)
    expect(circularBuffer.maxArrayIdx).toBe(defaultBufferSize - 1)
    expect(circularBuffer.size).toBe(0)
    expect(circularBuffer.items).toBeInstanceOf(Float32Array)
    expect(circularBuffer.items.length).toBe(defaultBufferSize)
  })

  it('Verify that circular buffer size can be set at instance creation', () => {
    const size = 1000
    const circularBuffer = new CircularBuffer(size)
    expect(circularBuffer.maxArrayIdx).toBe(size - 1)
    expect(circularBuffer.items).toBeInstanceOf(Float32Array)
    expect(circularBuffer.items.length).toBe(size)
  })

  it('Verify that circular buffer size is valid at instance creation', () => {
    expect(() => new CircularBuffer(0.25)).toThrow(
      new TypeError("Invalid circular buffer size: '0.25' is not an integer"),
    )
    expect(() => new CircularBuffer(-1)).toThrow(
      new RangeError('Invalid circular buffer size: -1 < 0'),
    )
    expect(() => new CircularBuffer(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      new TypeError(
        `Invalid circular buffer size: '${
          Number.MAX_SAFE_INTEGER + 1
        }' is not an integer`,
      ),
    )
  })

  it('Verify that circular buffer put() works as intended', () => {
    const circularBuffer = new CircularBuffer(4)
    circularBuffer.put(1)
    expect(circularBuffer.items).toStrictEqual(
      new Float32Array([1, -1, -1, -1]),
    )
    expect(circularBuffer.writeIdx).toBe(1)
    expect(circularBuffer.size).toBe(1)
    circularBuffer.put(2)
    expect(circularBuffer.items).toStrictEqual(new Float32Array([1, 2, -1, -1]))
    expect(circularBuffer.writeIdx).toBe(2)
    expect(circularBuffer.size).toBe(2)
    circularBuffer.put(3)
    expect(circularBuffer.items).toStrictEqual(new Float32Array([1, 2, 3, -1]))
    expect(circularBuffer.writeIdx).toBe(3)
    expect(circularBuffer.size).toBe(3)
    circularBuffer.put(4)
    expect(circularBuffer.items).toStrictEqual(new Float32Array([1, 2, 3, 4]))
    expect(circularBuffer.writeIdx).toBe(0)
    expect(circularBuffer.size).toBe(4)
    circularBuffer.put(5)
    expect(circularBuffer.items).toStrictEqual(new Float32Array([5, 2, 3, 4]))
    expect(circularBuffer.writeIdx).toBe(1)
    expect(circularBuffer.size).toBe(4)
    circularBuffer.put(6)
    expect(circularBuffer.items).toStrictEqual(new Float32Array([5, 6, 3, 4]))
    expect(circularBuffer.writeIdx).toBe(2)
    expect(circularBuffer.size).toBe(4)
  })

  it('Verify that circular buffer get() works as intended', () => {
    const circularBuffer = new CircularBuffer(4)
    circularBuffer.put(1)
    circularBuffer.put(2)
    circularBuffer.put(3)
    circularBuffer.put(4)
    expect(circularBuffer.get()).toBe(1)
    expect(circularBuffer.readIdx).toBe(1)
    expect(circularBuffer.size).toBe(3)
    expect(circularBuffer.get()).toBe(2)
    expect(circularBuffer.readIdx).toBe(2)
    expect(circularBuffer.size).toBe(2)
    circularBuffer.put(5)
    circularBuffer.put(6)
    expect(circularBuffer.get()).toBe(3)
    expect(circularBuffer.readIdx).toBe(3)
    expect(circularBuffer.size).toBe(3)
    expect(circularBuffer.get()).toBe(4)
    expect(circularBuffer.readIdx).toBe(0)
    expect(circularBuffer.size).toBe(2)
    expect(circularBuffer.get()).toBe(5)
    expect(circularBuffer.readIdx).toBe(1)
    expect(circularBuffer.size).toBe(1)
    expect(circularBuffer.get()).toBe(6)
    expect(circularBuffer.readIdx).toBe(2)
    expect(circularBuffer.size).toBe(0)
    expect(circularBuffer.get()).toBe(undefined)
    expect(circularBuffer.readIdx).toBe(2)
    expect(circularBuffer.size).toBe(0)
  })

  it('Verify that circular buffer empty() works as intended', () => {
    const circularBuffer = new CircularBuffer(4)
    expect(circularBuffer.empty()).toBe(true)
    circularBuffer.put(1)
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.put(2)
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.put(3)
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.put(4)
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.empty()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.empty()).toBe(true)
  })

  it('Verify that circular buffer full() works as intended', () => {
    const circularBuffer = new CircularBuffer(4)
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.put(1)
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.put(2)
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.put(3)
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.put(4)
    expect(circularBuffer.full()).toBe(true)
    circularBuffer.get()
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.put(5)
    expect(circularBuffer.full()).toBe(true)
    circularBuffer.get()
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.full()).toBe(false)
    circularBuffer.get()
    expect(circularBuffer.full()).toBe(false)
    expect(circularBuffer.empty()).toBe(true)
  })

  it('Verify that circular buffer toArray() works as intended', () => {
    const circularBuffer = new CircularBuffer(4)
    circularBuffer.put(1)
    circularBuffer.put(2)
    circularBuffer.put(3)
    circularBuffer.put(4)
    circularBuffer.put(5)
    circularBuffer.put(6)
    expect(circularBuffer.toArray()).toStrictEqual([5, 6, 3, 4])
  })
})
