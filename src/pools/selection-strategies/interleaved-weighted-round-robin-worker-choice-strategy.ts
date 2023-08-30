import type { IWorker } from '../worker'
import type { IPool } from '../pool'
import {
  DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
  DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
} from '../../utils'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy'
import type {
  IWorkerChoiceStrategy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategyOptions
} from './selection-strategies-types'

/**
 * Selects the next worker with an interleaved weighted round robin scheduling algorithm.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class InterleavedWeightedRoundRobinWorkerChoiceStrategy<
    Worker extends IWorker,
    Data = unknown,
    Response = unknown
  >
  extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements = {
    runTime: {
      aggregate: true,
      average: true,
      median: false
    },
    waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS
  }

  /**
   * Round id.
   */
  private roundId: number = 0
  /**
   * Default worker weight.
   */
  private readonly defaultWorkerWeight: number
  /**
   * Round weights.
   */
  private roundWeights: number[]
  /**
   * Worker node id.
   */
  private workerNodeId: number = 0
  /**
   * Worker virtual task runtime.
   */
  private workerVirtualTaskRunTime: number = 0

  /** @inheritDoc */
  public constructor (
    pool: IPool<Worker, Data, Response>,
    opts: WorkerChoiceStrategyOptions = DEFAULT_WORKER_CHOICE_STRATEGY_OPTIONS
  ) {
    super(pool, opts)
    this.setTaskStatisticsRequirements(this.opts)
    this.defaultWorkerWeight = this.computeDefaultWorkerWeight()
    this.roundWeights = this.getRoundWeights()
  }

  /** @inheritDoc */
  public reset (): boolean {
    this.resetWorkerNodeKeyProperties()
    this.roundId = 0
    this.workerNodeId = 0
    this.workerVirtualTaskRunTime = 0
    return true
  }

  /** @inheritDoc */
  public update (): boolean {
    return true
  }

  /** @inheritDoc */
  public choose (): number | undefined {
    for (
      let roundIndex = this.roundId;
      roundIndex < this.roundWeights.length;
      roundIndex++
    ) {
      this.roundId = roundIndex
      for (
        let workerNodeKey = this.workerNodeId;
        workerNodeKey < this.pool.workerNodes.length;
        workerNodeKey++
      ) {
        this.workerNodeId = workerNodeKey
        if (
          this.workerNodeId !== this.nextWorkerNodeKey &&
          this.workerVirtualTaskRunTime !== 0
        ) {
          this.workerVirtualTaskRunTime = 0
        }
        const workerWeight =
          this.opts.weights?.[workerNodeKey] ?? this.defaultWorkerWeight
        if (
          workerWeight >= this.roundWeights[roundIndex] &&
          this.workerVirtualTaskRunTime < workerWeight
        ) {
          this.workerVirtualTaskRunTime =
            this.workerVirtualTaskRunTime +
            this.getWorkerTaskRunTime(workerNodeKey)
          this.previousWorkerNodeKey =
            this.nextWorkerNodeKey ?? this.previousWorkerNodeKey
          this.nextWorkerNodeKey = workerNodeKey
          return this.nextWorkerNodeKey
        }
      }
    }
    this.interleavedWeightedRoundRobinNextWorkerNodeId()
  }

  private interleavedWeightedRoundRobinNextWorkerNodeId (): void {
    if (
      this.roundId === this.roundWeights.length - 1 &&
      this.workerNodeId === this.pool.workerNodes.length - 1
    ) {
      this.roundId = 0
      this.workerNodeId = 0
    } else if (this.workerNodeId === this.pool.workerNodes.length - 1) {
      this.roundId = this.roundId + 1
      this.workerNodeId = 0
    } else {
      this.workerNodeId = this.workerNodeId + 1
    }
  }

  /** @inheritDoc */
  public remove (workerNodeKey: number): boolean {
    if (this.nextWorkerNodeKey === workerNodeKey) {
      if (this.pool.workerNodes.length === 0) {
        this.roundId = 0
        this.workerNodeId = 0
        this.nextWorkerNodeKey = 0
      } else if (this.nextWorkerNodeKey > this.pool.workerNodes.length - 1) {
        if (this.workerNodeId === this.nextWorkerNodeKey) {
          this.workerNodeId = this.pool.workerNodes.length - 1
        }
        this.nextWorkerNodeKey = this.pool.workerNodes.length - 1
      }
      this.workerVirtualTaskRunTime = 0
    }
    return true
  }

  /** @inheritDoc */
  public setOptions (opts: WorkerChoiceStrategyOptions): void {
    super.setOptions(opts)
    this.roundWeights = this.getRoundWeights()
  }

  private getRoundWeights (): number[] {
    if (this.opts.weights == null) {
      return [this.defaultWorkerWeight]
    }
    return [
      ...new Set(
        Object.values(this.opts.weights)
          .slice()
          .sort((a, b) => a - b)
      )
    ]
  }
}
