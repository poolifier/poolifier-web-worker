import type { IPool } from '../pool.ts'
import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.ts'
import type { IWorker } from '../worker.ts'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.ts'
import {
  type IWorkerChoiceStrategy,
  type TaskStatisticsRequirements,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.ts'

/**
 * Selects the least busy worker.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastBusyWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY

  /** @inheritDoc */
  public override readonly taskStatisticsRequirements:
    TaskStatisticsRequirements = Object.freeze({
      runTime: {
        aggregate: true,
        average: false,
        median: false,
      },
      waitTime: {
        aggregate: true,
        average: false,
        median: false,
      },
      elu: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
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
    return true
  }

  /** @inheritDoc */
  public update(): boolean {
    return true
  }

  /** @inheritDoc */
  public choose(workerNodeKeysSet?: ReadonlySet<number>): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.leastBusyNextWorkerNodeKey(workerNodeKeysSet)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove(): boolean {
    return true
  }

  private leastBusyNextWorkerNodeKey(
    workerNodeKeysSet?: ReadonlySet<number>,
  ): number | undefined {
    if (workerNodeKeysSet?.size === 0) {
      return undefined
    }
    if (workerNodeKeysSet?.size === 1) {
      return this.getSingleWorkerNodeKey(workerNodeKeysSet)
    }
    const chosenWorkerNodeKey = this.pool.workerNodes.reduce(
      (minWorkerNodeKey: number, workerNode, workerNodeKey, workerNodes) => {
        if (!this.isWorkerNodeEligible(workerNodeKey, workerNodeKeysSet)) {
          return minWorkerNodeKey
        }
        if (minWorkerNodeKey === -1) {
          return workerNodeKey
        }
        return (workerNode.usage.waitTime.aggregate ?? 0) +
              (workerNode.usage.runTime.aggregate ?? 0) <
            (workerNodes[minWorkerNodeKey].usage.waitTime.aggregate ?? 0) +
              (workerNodes[minWorkerNodeKey].usage.runTime.aggregate ?? 0)
          ? workerNodeKey
          : minWorkerNodeKey
      },
      -1,
    )
    return chosenWorkerNodeKey === -1 ? undefined : chosenWorkerNodeKey
  }
}
