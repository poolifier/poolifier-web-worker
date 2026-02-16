import type { IPool } from '../pool.ts'
import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.ts'
import type { IWorker } from '../worker.ts'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.ts'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.ts'

/**
 * Selects the worker with the least ELU.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class LeastEluWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  // public readonly name: WorkerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
  public readonly name: WorkerChoiceStrategy = 'LEAST_ELU'

  /** @inheritDoc */
  public override readonly taskStatisticsRequirements:
    TaskStatisticsRequirements = Object.freeze({
      runTime: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
      waitTime: {
        aggregate: true,
        average: false,
        median: false,
      },
      elu: {
        aggregate: true,
        average: false,
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
    return true
  }

  /** @inheritDoc */
  public update(): boolean {
    return true
  }

  /** @inheritDoc */
  public choose(workerNodeKeysSet?: ReadonlySet<number>): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.nextWorkerNodeKey = this.leastEluNextWorkerNodeKey(workerNodeKeysSet)
    return this.nextWorkerNodeKey
  }

  /** @inheritDoc */
  public remove(): boolean {
    return true
  }

  private leastEluNextWorkerNodeKey(
    workerNodeKeysSet?: ReadonlySet<number>,
  ): number | undefined {
    const chosenWorkerNodeKey = this.pool.workerNodes.reduce(
      (minWorkerNodeKey: number, workerNode, workerNodeKey, workerNodes) => {
        if (!this.isWorkerNodeEligible(workerNodeKey, workerNodeKeysSet)) {
          return minWorkerNodeKey
        }
        if (minWorkerNodeKey === -1) {
          return workerNodeKey
        }
        return (workerNode.usage.waitTime.aggregate ?? 0) +
              (workerNode.usage.elu.active.aggregate ?? 0) <
            (workerNodes[minWorkerNodeKey].usage.waitTime.aggregate ?? 0) +
              (workerNodes[minWorkerNodeKey].usage.elu.active.aggregate ?? 0)
          ? workerNodeKey
          : minWorkerNodeKey
      },
      -1,
    )
    return chosenWorkerNodeKey === -1 ? undefined : chosenWorkerNodeKey
  }
}
