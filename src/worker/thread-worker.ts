import type { MessageValue, MsgEvent } from '../utility-types.ts'
import { AbstractWorker } from './abstract-worker.ts'
import type { WorkerOptions } from './worker-options.ts'
import type { TaskFunction, TaskFunctions } from './task-functions.ts'
import { isWebWorker } from '../utils.ts'

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
> extends AbstractWorker<typeof globalThis, Data, Response> {
  /**
   * Message port used to communicate with the main worker.
   */
  private port?: MessagePort
  /** @inheritdoc */
  public id?: string
  /**
   * Constructs a new poolifier thread worker.
   *
   * @param taskFunctions - Task function(s) processed by the worker when the pool's `execution` function is invoked.
   * @param opts - Options for the worker.
   */
  public constructor(
    taskFunctions: TaskFunction<Data, Response> | TaskFunctions<Data, Response>,
    opts: WorkerOptions = {},
  ) {
    super(
      !isWebWorker(),
      self,
      taskFunctions,
      opts,
    )
  }

  /** @inheritDoc */
  protected handleReadyMessageEvent(
    message: MsgEvent<MessageValue<Data>>,
  ): void {
    if (this.id != null) {
      return
    } else if (
      message.data?.workerId != null &&
      message.data?.ready === false &&
      message.data?.port != null
    ) {
      try {
        this.id = message.data.workerId
        this.port = message.data.port
        this.port.onmessage = this.messageEventListener.bind(this)
        this.sendToMainWorker({
          ready: true,
          taskFunctionNames: this.listTaskFunctionNames(),
        })
      } catch {
        this.sendToMainWorker({
          ready: false,
          taskFunctionNames: this.listTaskFunctionNames(),
        })
      }
    }
  }

  /** @inheritDoc */
  protected handleKillMessage(message: MessageValue<Data>): void {
    super.handleKillMessage(message)
    this.port?.close()
  }

  /** @inheritDoc */
  protected readonly sendToMainWorker = (
    message: MessageValue<Response>,
  ): void => {
    this.port?.postMessage({ ...message, workerId: this.id })
  }

  /**
   * @inheritDoc
   * @override
   */
  protected handleError(error: Error | string): string {
    return error as string
  }
}
