/**
 * Enumeration of worker choice strategies.
 */
export const WorkerChoiceStrategies = Object.freeze({
  /**
   * Round robin worker selection strategy.
   */
  ROUND_ROBIN: 'ROUND_ROBIN',
  /**
   * Least used worker selection strategy.
   */
  LEAST_USED: 'LEAST_USED',
  /**
   * Least busy worker selection strategy.
   */
  LEAST_BUSY: 'LEAST_BUSY',
  /**
   * Fair share worker selection strategy.
   */
  FAIR_SHARE: 'FAIR_SHARE',
  /**
   * Weighted round robin worker selection strategy.
   */
  WEIGHTED_ROUND_ROBIN: 'WEIGHTED_ROUND_ROBIN',
  /**
   * Interleaved weighted round robin worker selection strategy.
   *
   * @experimental
   */
  INTERLEAVED_WEIGHTED_ROUND_ROBIN: 'INTERLEAVED_WEIGHTED_ROUND_ROBIN'
} as const)

/**
 * Worker choice strategy.
 */
export type WorkerChoiceStrategy = keyof typeof WorkerChoiceStrategies

/**
 * Worker choice strategy options.
 */
export interface WorkerChoiceStrategyOptions {
  /**
   * Use tasks median runtime instead of average runtime.
   *
   * @defaultValue false
   */
  medRunTime?: boolean
  /**
   * Use tasks median wait time instead of average runtime.
   *
   * @defaultValue false
   */
  medWaitTime?: boolean
  /**
   * Worker weights to use for weighted round robin worker selection strategy.
   * Weight is the tasks maximum average or median runtime in milliseconds.
   *
   * @defaultValue Computed worker weights automatically given the CPU performance.
   */
  weights?: Record<number, number>
}

/**
 * Pool worker tasks usage statistics requirements.
 *
 * @internal
 */
export interface RequiredStatistics {
  /**
   * Require tasks runtime.
   */
  runTime: boolean
  /**
   * Require tasks average runtime.
   */
  avgRunTime: boolean
  /**
   * Require tasks median runtime.
   */
  medRunTime: boolean
  /**
   * Require tasks wait time.
   */
  waitTime: boolean
  /**
   * Require tasks average wait time.
   */
  avgWaitTime: boolean
  /**
   * Require tasks median wait time.
   */
  medWaitTime: boolean
  /**
   * Event loop utilization.
   */
  elu: boolean
}

/**
 * Worker choice strategy interface.
 */
export interface IWorkerChoiceStrategy {
  /**
   * Required tasks usage statistics.
   */
  readonly requiredStatistics: RequiredStatistics
  /**
   * Resets strategy internals.
   *
   * @returns `true` if the reset is successful, `false` otherwise.
   */
  reset: () => boolean
  /**
   * Updates the worker node key strategy internals.
   *
   * @returns `true` if the update is successful, `false` otherwise.
   */
  update: (workerNodeKey: number) => boolean
  /**
   * Chooses a worker node in the pool and returns its key.
   *
   * @returns The worker node key.
   */
  choose: () => number
  /**
   * Removes the worker node key from strategy internals.
   *
   * @param workerNodeKey - The worker node key.
   * @returns `true` if the worker node key is removed, `false` otherwise.
   */
  remove: (workerNodeKey: number) => boolean
  /**
   * Sets the worker choice strategy options.
   *
   * @param opts - The worker choice strategy options.
   */
  setOptions: (opts: WorkerChoiceStrategyOptions) => void
}
