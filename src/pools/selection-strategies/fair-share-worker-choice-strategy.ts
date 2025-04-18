import type { IPool } from '../pool.ts'
import type { IWorker } from '../worker.ts'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.ts'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.ts'

/**
 * Selects the next worker with a fair share scheduling algorithm.
 * Loosely modeled after the fair queueing algorithm: https://en.wikipedia.org/wiki/Fair_queuing.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class FairShareWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public override readonly taskStatisticsRequirements:
    TaskStatisticsRequirements = Object.freeze({
      runTime: {
        aggregate: true,
        average: true,
        median: false,
      },
      waitTime: {
        aggregate: true,
        average: true,
        median: false,
      },
      elu: {
        aggregate: true,
        average: true,
        median: false,
      },
    })

  /** @inheritDoc */
  public constructor(
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions,
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
  }

  /** @inheritDoc */
  public reset(): boolean {
    for (const workerNode of this.pool.workerNodes) {
      delete workerNode.strategyData?.virtualTaskEndTimestamp
    }
    return true
  }

  /** @inheritDoc */
  public update(workerNodeKey: number): boolean {
    this.pool.workerNodes[workerNodeKey].strategyData = {
      virtualTaskEndTimestamp: this.computeWorkerNodeVirtualTaskEndTimestamp(
        workerNodeKey,
      ),
    }
    return true
  }

  /** @inheritDoc */
  public choose(): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.fairShareNextWorkerNodeKey()
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove(): boolean {
    return true
  }

  private fairShareNextWorkerNodeKey(): number | undefined {
    return this.pool.workerNodes.reduce(
      (minWorkerNodeKey, workerNode, workerNodeKey, workerNodes) => {
        if (workerNode.strategyData?.virtualTaskEndTimestamp == null) {
          workerNode.strategyData = {
            virtualTaskEndTimestamp: this
              .computeWorkerNodeVirtualTaskEndTimestamp(workerNodeKey),
          }
        }
        return this.isWorkerNodeReady(workerNodeKey) &&
            workerNode.strategyData.virtualTaskEndTimestamp! <
              workerNodes[minWorkerNodeKey].strategyData!
                .virtualTaskEndTimestamp!
          ? workerNodeKey
          : minWorkerNodeKey
      },
      0,
    )
  }

  /**
   * Computes the worker node key virtual task end timestamp.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker node key virtual task end timestamp.
   */
  private computeWorkerNodeVirtualTaskEndTimestamp(
    workerNodeKey: number,
  ): number {
    return this.getWorkerNodeVirtualTaskEndTimestamp(
      workerNodeKey,
      this.getWorkerNodeVirtualTaskStartTimestamp(workerNodeKey),
    )
  }

  private getWorkerNodeVirtualTaskEndTimestamp(
    workerNodeKey: number,
    workerNodeVirtualTaskStartTimestamp: number,
  ): number {
    return (
      workerNodeVirtualTaskStartTimestamp +
      this.getWorkerNodeTaskWaitTime(workerNodeKey) +
      this.getWorkerNodeTaskRunTime(workerNodeKey)
    )
  }

  private getWorkerNodeVirtualTaskStartTimestamp(
    workerNodeKey: number,
  ): number {
    const virtualTaskEndTimestamp = this.pool.workerNodes[workerNodeKey]
      ?.strategyData
      ?.virtualTaskEndTimestamp
    const now = performance.now()
    return now < (virtualTaskEndTimestamp ?? Number.NEGATIVE_INFINITY)
      ? virtualTaskEndTimestamp!
      : now
  }
}
