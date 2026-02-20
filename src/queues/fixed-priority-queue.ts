import { AbstractFixedQueue } from './abstract-fixed-queue.ts'
import {
  defaultAgingFactor,
  defaultLoadExponent,
  type IFixedQueue,
} from './queue-types.ts'

/**
 * Fixed priority queue.
 *
 * @typeParam T - Type of fixed priority queue data.
 * @internal
 */
export class FixedPriorityQueue<T> extends AbstractFixedQueue<T>
  implements IFixedQueue<T> {
  private readonly agingFactor: number
  private readonly loadExponent: number

  /**
   * Constructs a fixed priority queue.
   * @param size - Fixed priority queue size.
   * @defaultValue defaultQueueSize
   * @param agingFactor - Aging factor for priority boosting (priority points per millisecond).
   * @defaultValue defaultAgingFactor
   * @param loadExponent - Load exponent for aging adjustment based on queue fill ratio.
   * @defaultValue defaultLoadExponent
   * @returns IFixedQueue.
   */
  public constructor(
    size?: number,
    agingFactor = defaultAgingFactor,
    loadExponent = defaultLoadExponent,
  ) {
    super(size)
    this.agingFactor = agingFactor
    this.loadExponent = loadExponent
  }

  /** @inheritdoc */
  public enqueue(data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Fixed priority queue is full')
    }
    priority = priority ?? 0
    const now = performance.now()
    const effectiveAgingFactor = this.agingFactor *
      (1 + ((this.size + 1) / this.capacity) ** this.loadExponent)
    let insertionPhysicalIndex = -1
    let currentPhysicalIndex = this.start
    for (let i = 0; i < this.size; i++) {
      const node = this.nodeArray[currentPhysicalIndex]!
      const nodeEffectivePriority = node.priority -
        (now - node.timestamp) * effectiveAgingFactor
      if (nodeEffectivePriority > priority) {
        insertionPhysicalIndex = currentPhysicalIndex
        break
      }
      ++currentPhysicalIndex
      if (currentPhysicalIndex === this.capacity) {
        currentPhysicalIndex = 0
      }
    }
    let endPhysicalIndex = this.start + this.size
    if (endPhysicalIndex >= this.capacity) {
      endPhysicalIndex -= this.capacity
    }
    if (insertionPhysicalIndex === -1) {
      insertionPhysicalIndex = endPhysicalIndex
    } else {
      let shiftPhysicalIndex = endPhysicalIndex
      while (shiftPhysicalIndex !== insertionPhysicalIndex) {
        const previousPhysicalIndex = shiftPhysicalIndex === 0
          ? this.capacity - 1
          : shiftPhysicalIndex - 1
        this.nodeArray[shiftPhysicalIndex] =
          this.nodeArray[previousPhysicalIndex]
        shiftPhysicalIndex = previousPhysicalIndex
      }
    }
    this.nodeArray[insertionPhysicalIndex] = { data, priority, timestamp: now }
    return ++this.size
  }
}
