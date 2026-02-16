import type { IPool } from '../pool.ts'
import type { IWorker } from '../worker.ts'
import { AbstractWorkerChoiceStrategy } from './abstract-worker-choice-strategy.ts'
import {
  type IWorkerChoiceStrategy,
  WorkerChoiceStrategies,
  type WorkerChoiceStrategy,
  type WorkerChoiceStrategyOptions,
} from './selection-strategies-types.ts'

/**
 * Selects the next worker in a round robin fashion.
 *
 * @typeParam Worker - Type of worker which manages the strategy.
 * @typeParam Data - Type of data sent to the worker. This can only be structured-cloneable data.
 * @typeParam Response - Type of execution response. This can only be structured-cloneable data.
 */
export class RoundRobinWorkerChoiceStrategy<
  Worker extends IWorker,
  Data = unknown,
  Response = unknown,
> extends AbstractWorkerChoiceStrategy<Worker, Data, Response>
  implements IWorkerChoiceStrategy {
  /** @inheritDoc */
  public readonly name: WorkerChoiceStrategy =
    WorkerChoiceStrategies.ROUND_ROBIN

  /** @inheritDoc */
  public constructor(
    pool: IPool<Worker, Data, Response>,
    opts?: WorkerChoiceStrategyOptions,
  ) {
    super(pool, opts)
  }

  /** @inheritDoc */
  public reset(): boolean {
    this.resetWorkerNodeKeyProperties()
    return true
  }

  /** @inheritDoc */
  public update(): boolean {
    return true
  }

  /** @inheritDoc */
  public choose(workerNodeKeysSet?: ReadonlySet<number>): number | undefined {
    this.setPreviousWorkerNodeKey(this.nextWorkerNodeKey)
    const chosenWorkerNodeKey = this.roundRobinNextWorkerNodeKey(
      workerNodeKeysSet,
    )
    if (chosenWorkerNodeKey == null) {
      return undefined
    }
    if (!this.isWorkerNodeEligible(chosenWorkerNodeKey, workerNodeKeysSet)) {
      return undefined
    }
    return this.checkWorkerNodeKey(chosenWorkerNodeKey)
  }

  /** @inheritDoc */
  public remove(workerNodeKey: number): boolean {
    if (this.pool.workerNodes.length === 0) {
      return this.reset()
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

  private roundRobinNextWorkerNodeKey(
    workerNodeKeysSet?: ReadonlySet<number>,
  ): number | undefined {
    if (workerNodeKeysSet == null) {
      this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
      return this.nextWorkerNodeKey
    }
    if (workerNodeKeysSet.size === 0) {
      return undefined
    }
    if (workerNodeKeysSet.size === 1) {
      const selectedWorkerNodeKey = this.getSingleWorkerNodeKey(
        workerNodeKeysSet,
      )
      if (selectedWorkerNodeKey != null) {
        this.nextWorkerNodeKey = selectedWorkerNodeKey
      }
      return selectedWorkerNodeKey
    }
    const workerNodesCount = this.pool.workerNodes.length
    for (let i = 0; i < workerNodesCount; i++) {
      this.nextWorkerNodeKey = this.getRoundRobinNextWorkerNodeKey()
      if (workerNodeKeysSet.has(this.nextWorkerNodeKey)) {
        return this.nextWorkerNodeKey
      }
    }
    return undefined
  }
}
