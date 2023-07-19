import cluster, { type Worker } from 'node:cluster'
import type { MessageValue } from '../utility-types'
import { AbstractWorker } from './abstract-worker'
import type { WorkerOptions } from './worker-options'
import type { TaskFunctions, WorkerFunction } from './worker-functions'

/**
 * A cluster worker used by a poolifier `ClusterPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main worker.
 *
 * If you use a `DynamicClusterPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main worker. This can only be structured-cloneable data.
 * @author [Christopher Quadflieg](https://github.com/Shinigami92)
 * @since 2.0.0
 */
export class ClusterWorker<
  Data = unknown,
  Response = unknown
> extends AbstractWorker<Worker, Data, Response> {
  /**
   * Constructs a new poolifier cluster worker.
   *
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked.
   * @param opts - Options for the worker.
   */
  public constructor (
    taskFunctions:
    | WorkerFunction<Data, Response>
    | TaskFunctions<Data, Response>,
    opts: WorkerOptions = {}
  ) {
    super(
      'worker-cluster-pool:poolifier',
      cluster.isPrimary,
      cluster.worker as Worker,
      taskFunctions,
      opts
    )
    if (!this.isMain) {
      this.getMainWorker()?.on('message', this.messageListener.bind(this))
    }
  }

  /** @inheritDoc */
  protected handleReadyMessage (message: MessageValue<Data>): void {
    if (message.workerId === this.id && message.ready != null) {
      !this.isMain && this.sendToMainWorker({ ready: true, workerId: this.id })
    }
  }

  /** @inheritDoc */
  protected get id (): number {
    return this.getMainWorker().id
  }

  /** @inheritDoc */
  protected sendToMainWorker (message: MessageValue<Response>): void {
    this.getMainWorker().send(message)
  }
}
