import type { MessageValue } from '../utility-types.ts'
import { isWebWorker } from '../utils.ts'
import { AbstractWorker } from './abstract-worker.ts'
import type { TaskFunction, TaskFunctions } from './task-functions.ts'
import type { WorkerOptions } from './worker-options.ts'

/**
 * A thread worker used by a poolifier `ThreadPool`.
 *
 * When this worker is inactive for more than the given `maxInactiveTime`,
 * it will send a termination request to its main thread.
 *
 * If you use a `DynamicThreadPool` the extra workers that were created will be terminated,
 * but the minimum number of workers will be guaranteed.
 *
 * @typeParam Data - Type of data this worker receives from pool's execution. This can only be structured-cloneable data.
 * @typeParam Response - Type of response the worker sends back to the main thread. This can only be structured-cloneable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class ThreadWorker<
  Data = unknown,
  Response = unknown,
> extends AbstractWorker<
  WorkerGlobalScope & typeof globalThis,
  Data,
  Response
> {
  /**
   * Message port used to communicate with the main worker.
   */
  private port?: MessagePort
  /** @inheritdoc */
  public id?: `${string}-${string}-${string}-${string}-${string}`

  /**
   * Constructs a new poolifier thread worker.
   *
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execute` method is invoked.
   * @param opts - Options for the worker.
   */
  public constructor(
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    opts: WorkerOptions = {},
  ) {
    super(!isWebWorker, self, taskFunctions, opts)
  }

  /** @inheritDoc */
  protected handleReadyMessageEvent(
    messageEvent: MessageEvent<MessageValue<Data>>,
  ): void {
    if (
      messageEvent.data?.workerId != null &&
      messageEvent.data?.ready === false &&
      messageEvent.data?.port != null
    ) {
      try {
        this.id = messageEvent.data.workerId
        this.port = messageEvent.data.port
        this.port.onmessage = this.messageEventListener.bind(this)
        this.sendToMainWorker({
          ready: true,
          taskFunctionsProperties: this.listTaskFunctionsProperties(),
        })
      } catch {
        this.sendToMainWorker({
          ready: false,
          taskFunctionsProperties: this.listTaskFunctionsProperties(),
        })
      }
    }
  }

  /** @inheritDoc */
  protected override handleKillMessage(message: MessageValue<Data>): void {
    super.handleKillMessage(message)
    this.port?.close()
  }

  /** @inheritDoc */
  protected readonly sendToMainWorker = (
    message: MessageValue<Response>,
  ): void => {
    this.port?.postMessage(
      {
        ...message,
        workerId: this.id,
      } satisfies MessageValue<Response>,
    )
  }
}
