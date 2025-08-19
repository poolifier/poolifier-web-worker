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
 * Selects the next worker with a weighted round robin scheduling algorithm.
 * Loosely modeled after the weighted round robin queueing algorithm: https://en.wikipedia.org/wiki/Weighted_round_robin.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class WeightedRoundRobinWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy =
    WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN

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
      elu: { ...DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS },
    })

  /**
   * Worker node virtual task execution time.
   */
  private workerNodeVirtualTaskExecutionTime = 0

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
    this.resetWorkerNodeKeyProperties()
    this.workerNodeVirtualTaskExecutionTime = 0
    return true
  }

  /** @inheritDoc */
  public update(): boolean {
    return true
  }

  /** @inheritDoc */
  public choose(): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    this.weightedRoundRobinNextWorkerNodeKey()
    if (!this.isWorkerNodeReady(this.nextWorkerNodeKey!)) {
      return undefined
    }
    return this.checkWorkerNodeKey(this.nextWorkerNodeKey)
  }

  /** @inheritDoc */
  public remove(workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      return this.reset()
    }
    if (this.nextWorkerNodeKey === workerNodeKey) {
      this.workerNodeVirtualTaskExecutionTime = 0
    }
    if (
      this.nextWorkerNodeKey != null &&
      this.nextWorkerNodeKey >= workerNodeKey
    ) {
      this.nextWorkerNodeKey =
        (this.nextWorkerNodeKey - 1 + this.pool.workerNodes.length) %
        this.pool.workerNodes.length
      if (this.previousWorkerNodeKey >= workerNodeKey) {
        this.previousWorkerNodeKey = this.nextWorkerNodeKey
      }
    }
    return true
  }

  private weightedRoundRobinNextWorkerNodeKey(): number | undefined {
    const workerNodeKey = this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
    const workerWeight = this.opts!.weights![workerNodeKey]
    if (this.workerNodeVirtualTaskExecutionTime < workerWeight) {
      this.workerNodeVirtualTaskExecutionTime +=
        this.getWorkerNodeTaskWaitTime(workerNodeKey) +
        this.getWorkerNodeTaskRunTime(workerNodeKey)
    } else {
      this.nextWorkerNodeKey =
        this.nextWorkerNodeKey === this.pool.workerNodes.length - 1
          ? 0
          : workerNodeKey + 1
      this.workerNodeVirtualTaskExecutionTime = 0
    }
    return this.nextWorkerNodeKey
  }
}
