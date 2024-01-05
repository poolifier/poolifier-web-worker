import { getWorkerChoiceStrategyRetries } from '../../utils.ts'
import type { IPool } from '../pool.ts'
import type { IWorker } from '../worker.ts'
import { FairShareWorkerChoiceStrategy } from './fair-share-worker-choice-strategy.ts'
import { InterleavedWeightedRoundRobinWorkerChoiceStrategy } from './interleaved-weighted-round-robin-worker-choice-strategy.ts'
import { LeastBusyWorkerChoiceStrategy } from './least-busy-worker-choice-strategy.ts'
import { LeastUsedWorkerChoiceStrategy } from './least-used-worker-choice-strategy.ts'
// import { LeastEluWorkerChoiceStrategy } from './least-elu-worker-choice-strategy.ts'
import { RoundRobinWorkerChoiceStrategy } from './round-robin-worker-choice-strategy.ts'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.ts'
import { WorkerChoiceStrategies } from './selection-strategies-types.ts'
import { WeightedRoundRobinWorkerChoiceStrategy } from './weighted-round-robin-worker-choice-strategy.ts'

/**
 * The worker choice strategy context.
 *
 * @typeParam Worker - Type of worker.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class WorkerChoiceStrategyContext<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> {
  /**
   * The worker choice strategy instances registered in the context.
   */
  private readonly workerChoiceStrategies: Map<
    WorkerChoiceStrategy,
    IWorkerChoiceStrategy
  >

  /**
   * The number of worker choice strategy execution retries.
   */
  private readonly retries: number

  /**
   * Worker choice strategy context constructor.
   *
   * @param pool - The pool instance.
   * @param workerChoiceStrategy - The worker choice strategy.
   * @param opts - The worker choice strategy options.
   */
  public constructor(
    pool: IPool<Worker, Data, Response>,
    private workerChoiceStrategy: WorkerChoiceStrategy =
      WorkerChoiceStrategies.ROUND_ROBIN,
    opts?: WorkerChoiceStrategyOptions,
  ) {
    this.execute = this.execute.bind(this)
    this.workerChoiceStrategies = new Map<
      WorkerChoiceStrategy,
      IWorkerChoiceStrategy
    >([
      [
        WorkerChoiceStrategies.ROUND_ROBIN,
        new (RoundRobinWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts,
        ),
      ],
      [
        WorkerChoiceStrategies.LEAST_USED,
        new (LeastUsedWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts,
        ),
      ],
      [
        WorkerChoiceStrategies.LEAST_BUSY,
        new (LeastBusyWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts,
        ),
      ],
      // [
      //   WorkerChoiceStrategies.LEAST_ELU,
      //   new (LeastEluWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
      //     pool,
      //     opts,
      //   ),
      // ],
      [
        WorkerChoiceStrategies.FAIR_SHARE,
        new (FairShareWorkerChoiceStrategy.bind(this))<Worker, Data, Response>(
          pool,
          opts,
        ),
      ],
      [
        WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
        new (WeightedRoundRobinWorkerChoiceStrategy.bind(this))<
          Worker,
          Data,
          Response
        >(pool, opts),
      ],
      [
        WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
        new (InterleavedWeightedRoundRobinWorkerChoiceStrategy.bind(this))<
          Worker,
          Data,
          Response
        >(pool, opts),
      ],
    ])
    this.retries = getWorkerChoiceStrategyRetries(pool, opts)
  }

  /**
   * Gets the strategy policy in the context.
   *
   * @returns The strategy policy.
   */
  public getStrategyPolicy(): StrategyPolicy {
    return this.workerChoiceStrategies.get(this.workerChoiceStrategy)!
      .strategyPolicy
  }

  /**
   * Gets the worker choice strategy in the context task statistics requirements.
   *
   * @returns The task statistics requirements.
   */
  public getTaskStatisticsRequirements(): TaskStatisticsRequirements {
    return this.workerChoiceStrategies.get(this.workerChoiceStrategy)!
      .taskStatisticsRequirements
  }

  /**
   * Sets the worker choice strategy to use in the context.
   *
   * @param workerChoiceStrategy - The worker choice strategy to set.
   */
  public setWorkerChoiceStrategy(
    workerChoiceStrategy: WorkerChoiceStrategy,
  ): void {
    if (this.workerChoiceStrategy !== workerChoiceStrategy) {
      this.workerChoiceStrategy = workerChoiceStrategy
    }
    this.workerChoiceStrategies.get(this.workerChoiceStrategy)?.reset()
  }

  /**
   * Updates the worker node key in the worker choice strategy in the context internals.
   *
   * @returns `true` if the update is successful, `false` otherwise.
   */
  public update(workerNodeKey: number): boolean {
    return this.workerChoiceStrategies.get(this.workerChoiceStrategy)!.update(
      workerNodeKey,
    )
  }

  /**
   * Executes the worker choice strategy in the context algorithm.
   *
   * @returns The key of the worker node.
   * @throws {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error} If after computed retries the worker node key is null or undefined.
   */
  public execute(): number {
    return this.executeStrategy(
      this.workerChoiceStrategies.get(
        this.workerChoiceStrategy,
      )!,
    )
  }

  /**
   * Executes the given worker choice strategy.
   *
   * @param workerChoiceStrategy - The worker choice strategy.
   * @returns The key of the worker node.
   * @throws {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error} If after computed retries the worker node key is null or undefined.
   */
  private executeStrategy(workerChoiceStrategy: IWorkerChoiceStrategy): number {
    let workerNodeKey: number | undefined
    let chooseCount = 0
    let retriesCount = 0
    do {
      workerNodeKey = workerChoiceStrategy.choose()
      if (workerNodeKey != null && workerNodeKey < 0) {
        workerNodeKey = undefined
      }
      if (workerNodeKey == null && chooseCount > 0) {
        retriesCount++
      }
      chooseCount++
    } while (
      workerNodeKey == null &&
      retriesCount < this.retries
    )
    if (workerNodeKey == null) {
      throw new Error(
        `Worker node key chosen is null or undefined after ${retriesCount} retries`,
      )
    }
    return workerNodeKey
  }

  /**
   * Removes the worker node key from the worker choice strategy in the context.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the removal is successful, `false` otherwise.
   */
  public remove(workerNodeKey: number): boolean {
    return this.workerChoiceStrategies.get(this.workerChoiceStrategy)!.remove(
      workerNodeKey,
    )
  }

  /**
   * Sets the worker choice strategies in the context options.
   *
   * @param opts - The worker choice strategy options.
   */
  public setOptions(
    opts: WorkerChoiceStrategyOptions | undefined,
  ): void {
    for (const workerChoiceStrategy of this.workerChoiceStrategies.values()) {
      workerChoiceStrategy.setOptions(opts)
    }
  }
}
