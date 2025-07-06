/**
 * Default buffer size.
 */
export const defaultBufferSize = 2048

/**
 * Circular buffer designed for numbers.
 *
 * @internal
 */
export class CircularBuffer {
  private readIdx: number
  private writeIdx: number
  private readonly items: Float32Array
  private readonly maxArrayIdx: number
  public size: number

  /**
   * @param size - Buffer size. @defaultValue defaultBufferSize
   * @returns CircularBuffer.
   */
  constructor(size: number = defaultBufferSize) {
    this.checkSize(size)
    this.readIdx = 0
    this.writeIdx = 0
    this.maxArrayIdx = size - 1
    this.size = 0
    this.items = new Float32Array(size)
  }

  /**
   * Checks whether the buffer is empty.
   *
   * @returns Whether the buffer is empty.
   */
  public empty(): boolean {
    return this.size === 0
  }

  /**
   * Checks whether the buffer is full.
   *
   * @returns Whether the buffer is full.
   */
  public full(): boolean {
    return this.size === this.items.length
  }

  /**
   * Puts number into buffer.
   *
   * @param number - Number to put into buffer.
   */
  public put(number: number): void {
    if (this.full()) {
      this.readIdx = this.readIdx === this.maxArrayIdx ? 0 : this.readIdx + 1
    } else {
      ++this.size
    }
    this.items[this.writeIdx] = number
    this.writeIdx = this.writeIdx === this.maxArrayIdx ? 0 : this.writeIdx + 1
  }

  /**
   * Gets number from buffer.
   *
   * @returns Number from buffer.
   */
  public get(): number | undefined {
    if (this.empty()) {
      return undefined
    }
    const number = this.items[this.readIdx]
    this.readIdx = this.readIdx === this.maxArrayIdx ? 0 : this.readIdx + 1
    --this.size
    return number
  }

  /**
   * Returns buffer as numbers' array.
   *
   * @returns Numbers' array.
   */
  public toArray(): number[] {
    const array: number[] = []
    if (this.empty()) {
      return array
    }
    let currentIdx = this.readIdx
    for (let i = 0; i < this.size; i++) {
      array.push(this.items[currentIdx])
      currentIdx = currentIdx === this.maxArrayIdx ? 0 : currentIdx + 1
    }
    return array
  }

  /**
   * Checks the buffer size.
   *
   * @param size - Buffer size.
   */
  private checkSize(size: number): void {
    if (!Number.isSafeInteger(size)) {
      throw new TypeError(
        `Invalid circular buffer size: '${size.toString()}' is not an integer`,
      )
    }
    if (size < 0) {
      throw new RangeError(
        `Invalid circular buffer size: ${size.toString()} < 0`,
      )
    }
  }
}
