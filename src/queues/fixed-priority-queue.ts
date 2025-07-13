import { AbstractFixedQueue } from './abstract-fixed-queue.ts'
import type { IFixedQueue } from './queue-types.ts'

/**
 * Fixed priority queue.
 *
 * @typeParam T - Type of fixed priority queue data.
 * @internal
 */
export class FixedPriorityQueue<T> extends AbstractFixedQueue<T>
  implements IFixedQueue<T> {
  /** @inheritdoc */
  public enqueue(data: T, priority?: number): number {
    if (this.full()) {
      throw new Error('Fixed priority queue is full')
    }
    priority = priority ?? 0
    let insertionPhysicalIndex = -1
    let currentPhysicalIndex = this.start
    for (let i = 0; i < this.size; i++) {
      if (this.nodeArray[currentPhysicalIndex]!.priority > priority) {
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
    this.nodeArray[insertionPhysicalIndex] = { data, priority }
    return ++this.size
  }
}
