import { PoolEvents, type PoolInfo, type PoolType, PoolTypes } from '../pool.ts'
import { checkDynamicPoolSize } from '../utils.ts'
import { FixedThreadPool, type ThreadPoolOptions } from './fixed.ts'

/**
 * A thread pool with a dynamic number of threads, but a guaranteed minimum number of threads.
 *
 * This thread pool creates new threads when the others are busy, up to the maximum number of threads.
 * When the maximum number of threads is reached and workers are busy, an event is emitted. If you want to listen to this event, use the pool's `eventTarget`.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class DynamicThreadPool<
  Data = unknown,
  Response = unknown,
> extends FixedThreadPool<Data, Response> {
  /**
   * Whether the pool full event has been emitted or not.
   */
  private fullEventEmitted: boolean

  /**
   * Constructs a new poolifier dynamic thread pool.
   *
   * @param min - Minimum number of threads which are always active.
   * @param max - Maximum number of threads that can be created by this pool.
   * @param fileURL - URL to an implementation of a `ThreadWorker` file.
   * @param opts - Options for this dynamic thread pool.
   */
  public constructor(
    min: number,
    max: number,
    fileURL: URL,
    opts: ThreadPoolOptions = {},
  ) {
    super(min, fileURL, opts, max)
    checkDynamicPoolSize(
      this.minimumNumberOfWorkers,
      this.maximumNumberOfWorkers!,
    )
    this.fullEventEmitted = false
  }

  /** @inheritDoc */
  protected shallCreateDynamicWorker(): boolean {
    return (!this.full && this.internalBusy()) || this.empty
  }

  /** @inheritDoc */
  protected checkAndEmitDynamicWorkerCreationEvents(): void {
    if (this.eventTarget != null && !this.fullEventEmitted && this.full) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.full, { detail: this.info }),
      )
      this.fullEventEmitted = true
    }
  }

  /** @inheritDoc */
  protected checkAndEmitDynamicWorkerDestructionEvents(): void {
    if (this.eventTarget != null && this.fullEventEmitted && !this.full) {
      this.eventTarget.dispatchEvent(
        new CustomEvent<PoolInfo>(PoolEvents.fullEnd, { detail: this.info }),
      )
      this.fullEventEmitted = false
    }
  }

  /** @inheritDoc */
  protected get type(): PoolType {
    return PoolTypes.dynamic
  }

  /** @inheritDoc */
  protected get backPressure(): boolean {
    return this.full && this.internalBackPressure()
  }

  /** @inheritDoc */
  protected get busy(): boolean {
    return this.full && this.internalBusy()
  }
}
