import type { MessageValue } from '../../utility-types.ts'
import { isWebWorker } from '../../utils.ts'
import { AbstractPool } from '../abstract-pool.ts'
import { type PoolOptions, type PoolType, PoolTypes } from '../pool.ts'
import { messageListenerToEventListener } from '../utils.ts'
import { type WorkerType, WorkerTypes } from '../worker.ts'

/**
 * A thread pool with a fixed number of threads.
 *
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 * @author [Alessandro Pio Ardizio](https://github.com/pioardi)
 * @since 0.0.1
 */
export class FixedThreadPool<
  Data = unknown,
  Response = unknown,
> extends AbstractPool<Worker, Data, Response> {
  /**
   * Constructs a new poolifier fixed thread pool.
   *
   * @param numberOfThreads - Number of threads for this pool.
   * @param fileURL - URL to an implementation of a `ThreadWorker` file.
   * @param opts - Options for this fixed thread pool.
   */
  public constructor(
    numberOfThreads: number,
    fileURL: URL,
    opts: PoolOptions<Data> = {},
    maximumNumberOfThreads?: number,
  ) {
    super(numberOfThreads, fileURL, opts, maximumNumberOfThreads)
  }
  /** @inheritDoc */
  protected isMain(): boolean {
    return !isWebWorker()
  }

  /** @inheritDoc */
  protected sendToWorker(
    workerNodeKey: number,
    message: MessageValue<Data>,
    transferList?: Transferable[],
  ): void {
    this.workerNodes[workerNodeKey].messageChannel?.port1?.postMessage(
      { ...message, workerId: this.getWorkerInfo(workerNodeKey).id },
      transferList as Transferable[],
    )
  }

  /** @inheritDoc */
  protected sendStartupMessageToWorker(workerNodeKey: number): void {
    const workerNode = this.workerNodes[workerNodeKey]
    const port2: MessagePort = (workerNode.messageChannel as MessageChannel)
      .port2
    workerNode.worker.postMessage(
      {
        ready: false,
        workerId: this.getWorkerInfo(workerNodeKey).id,
        port: port2,
      },
      [port2],
    )
  }

  /** @inheritDoc */
  protected registerWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void,
  ): void {
    this.workerNodes[workerNodeKey].addEventListener(
      'message',
      messageListenerToEventListener<Message>(listener),
    )
  }

  /** @inheritDoc */
  protected registerOnceWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void,
  ): void {
    this.workerNodes[workerNodeKey].addEventListener(
      'message',
      messageListenerToEventListener<Message>(listener),
      {
        once: true,
      },
    )
  }

  /** @inheritDoc */
  protected deregisterWorkerMessageListener<Message extends Data | Response>(
    workerNodeKey: number,
    listener: (message: MessageValue<Message>) => void,
  ): void {
    this.workerNodes[workerNodeKey].removeEventListener(
      'message',
      messageListenerToEventListener<Message>(listener),
    )
  }

  /** @inheritDoc */
  protected get type(): PoolType {
    return PoolTypes.fixed
  }

  /** @inheritDoc */
  protected get worker(): WorkerType {
    return WorkerTypes.web
  }

  /** @inheritDoc */
  protected get busy(): boolean {
    return this.internalBusy()
  }
}
