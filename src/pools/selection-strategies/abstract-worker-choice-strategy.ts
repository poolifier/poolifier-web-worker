import type { IPool } from '../pool.ts'
import { DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS } from '../utils.ts'
import type { IWorker } from '../worker.ts'
import type {
  IWorkerChoiceStrategy,
  StrategyPolicy,
  TaskStatisticsRequirements,
  WorkerChoiceStrategy,
  WorkerChoiceStrategyOptions,
} from './selection-strategies-types.ts'
import {
  buildWorkerChoiceStrategyOptions,
  toggleMedianMeasurementStatisticsRequirements,
} from './selection-strategies-utils.ts'

/**
 * Worker choice strategy abstract base class.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export abstract class AbstractWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public abstract readonly name: WorkerChoiceStrategy

  /**
   * The next worker node key.
   */
  protected nextWorkerNodeKey: number | undefined = 0

  /**
   * The previous worker node key.
   */
  protected previousWorkerNodeKey = 0

  /** @inheritDoc */
  public readonly strategyPolicy: StrategyPolicy = Object.freeze({
    dynamicWorkerUsage: false,
    dynamicWorkerReady: true,
  })

  /** @inheritDoc */
  public readonly taskStatisticsRequirements: TaskStatisticsRequirements =
    Object.freeze({
      runTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
      waitTime: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
      elu: DEFAULT_MEASUREMENT_STATISTICS_REQUIREMENTS,
    })

  /**
   * Constructs a worker choice strategy bound to the pool.
   *
   * @param pool - The pool instance.
   * @param opts - The worker choice strategy options.
   */
  public constructor(
    protected readonly pool: IPool<Worker, Data, Response>,
    protected opts?: WorkerChoiceStrategyOptions,
  ) {
    this.choose = this.choose.bind(this)
    this.setOptions(this.opts)
  }

  protected setTaskStatisticsRequirements(
    opts: WorkerChoiceStrategyOptions | undefined,
  ): void {
    toggleMedianMeasurementStatisticsRequirements(
      this.taskStatisticsRequirements.runTime,
      opts!.runTime!.median,
    )
    toggleMedianMeasurementStatisticsRequirements(
      this.taskStatisticsRequirements.waitTime,
      opts!.waitTime!.median,
    )
    toggleMedianMeasurementStatisticsRequirements(
      this.taskStatisticsRequirements.elu,
      opts!.elu!.median,
    )
  }

  protected resetWorkerNodeKeyProperties(): void {
    this.nextWorkerNodeKey = 0
    this.previousWorkerNodeKey = 0
  }

  /** @inheritDoc */
  public abstract reset(): boolean

  /** @inheritDoc */
  public abstract update(workerNodeKey: number): boolean

  /** @inheritDoc */
  public abstract choose(): number | undefined

  /** @inheritDoc */
  public abstract remove(workerNodeKey: number): boolean

  /** @inheritDoc */
  public setOptions(opts: WorkerChoiceStrategyOptions | undefined): void {
    this.opts = buildWorkerChoiceStrategyOptions<Worker, Data, Response>(
      this.pool,
      opts,
    )
    this.setTaskStatisticsRequirements(this.opts)
  }

  /**
   * Whether the worker node is ready or not.
   *
   * @param workerNodeKey - The worker node key.
   * @returns Whether the worker node is ready or not.
   */
  protected isWorkerNodeReady(workerNodeKey: number): boolean {
    return this.pool.workerNodes[workerNodeKey]?.info.ready ?? false
  }

  /**
   * Check the worker node key.
   *
   * @param workerNodeKey - The worker node key to check.
   * @returns The worker node key if it is valid, otherwise undefined.
   */
  protected checkWorkerNodeKey(
    workerNodeKey: number | undefined,
  ): number | undefined {
    if (
      workerNodeKey == null ||
      workerNodeKey < 0 ||
      workerNodeKey >= this.pool.workerNodes.length
    ) {
      return undefined
    }
    return workerNodeKey
  }

  /**
   * Gets the worker node task runtime.
   * If the task statistics require the average runtime, the average runtime is returned.
   * If the task statistics require the median runtime, the median runtime is returned.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker node task runtime.
   */
  protected getWorkerNodeTaskRunTime(workerNodeKey: number): number {
    return this.taskStatisticsRequirements.runTime.median
      ? (this.pool.workerNodes[workerNodeKey]?.usage.runTime.median ?? 0)
      : (this.pool.workerNodes[workerNodeKey]?.usage.runTime.average ?? 0)
  }

  /**
   * Gets the worker node task wait time.
   * If the task statistics require the average wait time, the average wait time is returned.
   * If the task statistics require the median wait time, the median wait time is returned.
   *
   * @param workerNodeKey - The worker node key.
   * @returns The worker node task wait time.
   */
  protected getWorkerNodeTaskWaitTime(workerNodeKey: number): number {
    return this.taskStatisticsRequirements.waitTime.median
      ? (this.pool.workerNodes[workerNodeKey]?.usage.waitTime.median ?? 0)
      : (this.pool.workerNodes[workerNodeKey]?.usage.waitTime.average ?? 0)
  }

  // /**
  //  * Gets the worker node task ELU.
  //  * If the task statistics require the average ELU, the average ELU is returned.
  //  * If the task statistics require the median ELU, the median ELU is returned.
  //  *
  //  * @param workerNodeKey - The worker node key.
  //  * @returns The worker node task ELU.
  //  */
  // protected getWorkerNodeTaskElu(workerNodeKey: number): number {
  //   return this.taskStatisticsRequirements.elu.median
  //     ? this.pool.workerNodes[workerNodeKey]?.usage.elu.active.median ?? 0
  //     : this.pool.workerNodes[workerNodeKey]?.usage.elu.active.average ?? 0
  // }

  /**
   * Sets safely the previous worker node key.
   *
   * @param workerNodeKey - The worker node key.
   */
  protected setPreviousWorkerNodeKey(workerNodeKey: number | undefined): void {
    this.previousWorkerNodeKey = workerNodeKey != null && workerNodeKey >= 0
      ? workerNodeKey
      : this.previousWorkerNodeKey
  }
}
