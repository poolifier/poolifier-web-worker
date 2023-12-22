import { expect } from 'npm:expect'
import {
  DynamicThreadPool,
  FixedThreadPool,
  WorkerChoiceStrategies,
} from '../../../src/mod.ts'
import { CircularArray } from '../../../src/circular-array.ts'

Deno.test({
  name: 'Selection strategies test suite',
  fn: async (t) => {
    const min = 0
    const max = 3

    await t.step(
      'Verify that WorkerChoiceStrategies enumeration provides string values',
      () => {
        expect(WorkerChoiceStrategies.ROUND_ROBIN).toBe('ROUND_ROBIN')
        expect(WorkerChoiceStrategies.LEAST_USED).toBe('LEAST_USED')
        expect(WorkerChoiceStrategies.LEAST_BUSY).toBe('LEAST_BUSY')
        // expect(WorkerChoiceStrategies.LEAST_ELU).toBe('LEAST_ELU')
        expect(WorkerChoiceStrategies.FAIR_SHARE).toBe('FAIR_SHARE')
        expect(WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN).toBe(
          'WEIGHTED_ROUND_ROBIN',
        )
        expect(WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN).toBe(
          'INTERLEAVED_WEIGHTED_ROUND_ROBIN',
        )
      },
    )

    await t.step(
      'Verify ROUND_ROBIN strategy is the default at pool creation',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.opts.workerChoiceStrategy).toBe(
          WorkerChoiceStrategies.ROUND_ROBIN,
        )
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify available strategies are taken at pool creation',
      async () => {
        for (
          const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)
        ) {
          const pool = new FixedThreadPool(
            max,
            new URL(
              './../../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            { workerChoiceStrategy },
          )
          expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
          expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
            workerChoiceStrategy,
          )
          await pool.destroy()
        }
      },
    )

    await t.step(
      'Verify available strategies can be set after pool creation',
      async () => {
        for (
          const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)
        ) {
          const pool = new FixedThreadPool(
            max,
            new URL(
              './../../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
          )
          pool.setWorkerChoiceStrategy(workerChoiceStrategy)
          expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
          expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
            workerChoiceStrategy,
          )
          expect(pool.opts.workerChoiceStrategyOptions).toBeUndefined()
          expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
            retries: pool.info.maxSize +
              Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
            runTime: { median: false },
            waitTime: { median: false },
            elu: { median: false },
            weights: expect.objectContaining({
              0: expect.any(Number),
              [pool.info.maxSize - 1]: expect.any(Number),
            }),
          })
          await pool.destroy()
        }
        for (
          const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)
        ) {
          const pool = new DynamicThreadPool(
            min,
            max,
            new URL(
              './../../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
          )
          pool.setWorkerChoiceStrategy(workerChoiceStrategy)
          expect(pool.opts.workerChoiceStrategy).toBe(workerChoiceStrategy)
          expect(pool.workerChoiceStrategyContext.workerChoiceStrategy).toBe(
            workerChoiceStrategy,
          )
          expect(pool.opts.workerChoiceStrategyOptions).toBeUndefined()
          expect(pool.workerChoiceStrategyContext.opts).toStrictEqual({
            retries: pool.info.maxSize +
              Object.keys(pool.workerChoiceStrategyContext.opts.weights).length,
            runTime: { median: false },
            waitTime: { median: false },
            elu: { median: false },
            weights: expect.objectContaining({
              0: expect.any(Number),
              [pool.info.maxSize - 1]: expect.any(Number),
            }),
          })
          await pool.destroy()
        }
      },
    )

    await t.step(
      'Verify available strategies default internals at pool creation',
      async () => {
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        for (
          const workerChoiceStrategy of Object.values(WorkerChoiceStrategies)
        ) {
          expect(
            pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
              workerChoiceStrategy,
            ).nextWorkerNodeKey,
          ).toBe(0)
          expect(
            pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
              workerChoiceStrategy,
            ).previousWorkerNodeKey,
          ).toBe(0)
          if (
            workerChoiceStrategy === WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
          ) {
            expect(
              pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
                workerChoiceStrategy,
              ).workerNodeVirtualTaskRunTime,
            ).toBe(0)
          } else if (
            workerChoiceStrategy ===
              WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
          ) {
            expect(
              pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
                workerChoiceStrategy,
              ).workerNodeVirtualTaskRunTime,
            ).toBe(0)
            expect(
              pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
                workerChoiceStrategy,
              ).roundId,
            ).toBe(0)
            expect(
              pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
                workerChoiceStrategy,
              ).workerNodeId,
            ).toBe(0)
            expect(
              pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
                workerChoiceStrategy,
              ).roundWeights.length,
            ).toBe(1)
            expect(
              Number.isSafeInteger(
                pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
                  workerChoiceStrategy,
                ).roundWeights[0],
              ),
            ).toBe(true)
          }
        }
        await pool.destroy()
      },
    )

    await t.step(
      'Verify strategies wait for worker node readiness in dynamic pool',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(pool.starting).toBe(false)
        expect(pool.workerNodes.length).toBe(min)
        const maxMultiplier = 10000
        const promises = new Set()
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        expect(pool.workerNodes.length).toBe(max)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step('Verify ROUND_ROBIN strategy default policy', async () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
      let pool = new FixedThreadPool(
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      await pool.destroy()
      pool = new DynamicThreadPool(
        min,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    await t.step(
      'Verify ROUND_ROBIN strategy default tasks statistics requirements',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify ROUND_ROBIN strategy can be run in a fixed pool',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        // TODO: Create a better test to cover `RoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: maxMultiplier,
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: new CircularArray(),
            },
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(pool.workerNodes.length - 1)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify ROUND_ROBIN strategy can be run in a dynamic pool',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        // TODO: Create a better test to cover `RoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: new CircularArray(),
            },
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(pool.workerNodes.length - 1)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step('Verify ROUND_ROBIN strategy runtime behavior', async () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
      const pool = new FixedThreadPool(
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      const results = new Set()
      for (let i = 0; i < max; i++) {
        results.add(pool.workerNodes[pool.chooseWorkerNode()].info.id)
      }
      expect(results.size).toBe(max)
      await pool.destroy()
    })

    await t.step(
      'Verify ROUND_ROBIN strategy internals are resets after setting it',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN },
        )
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBeDefined()
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN },
        )
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBeDefined()
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step('Verify LEAST_USED strategy default policy', async () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
      let pool = new FixedThreadPool(
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      await pool.destroy()
      pool = new DynamicThreadPool(
        min,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    await t.step(
      'Verify LEAST_USED strategy default tasks statistics requirements',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_USED
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify LEAST_USED strategy can be run in a fixed pool',
      async () => {
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED },
        )
        // TODO: Create a better test to cover `LeastUsedWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: new CircularArray(),
            },
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify LEAST_USED strategy can be run in a dynamic pool',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_USED },
        )
        // TODO: Create a better test to cover `LeastUsedWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: {
              history: new CircularArray(),
            },
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step('Verify LEAST_BUSY strategy default policy', async () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
      let pool = new FixedThreadPool(
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      await pool.destroy()
      pool = new DynamicThreadPool(
        min,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    await t.step(
      'Verify LEAST_BUSY strategy default tasks statistics requirements',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_BUSY
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
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
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
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
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify LEAST_BUSY strategy can be run in a fixed pool',
      async () => {
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_BUSY },
        )
        // TODO: Create a better test to cover `LeastBusyWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.waitTime.aggregate == null) {
            expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
          }
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify LEAST_BUSY strategy can be run in a dynamic pool',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_BUSY },
        )
        // TODO: Create a better test to cover `LeastBusyWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.waitTime.aggregate == null) {
            expect(workerNode.usage.waitTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.waitTime.aggregate).toBeGreaterThan(0)
          }
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    // await t.step('Verify LEAST_ELU strategy default policy', async () => {
    //   const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    //   let pool = new FixedThreadPool(
    //     max,
    //     new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    //     { workerChoiceStrategy },
    //   )
    //   expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
    //     .toStrictEqual({
    //       dynamicWorkerUsage: false,
    //       dynamicWorkerReady: true,
    //     })
    //   await pool.destroy()
    //   pool = new DynamicThreadPool(
    //     min,
    //     max,
    //     new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    //     { workerChoiceStrategy },
    //   )
    //   expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
    //     .toStrictEqual({
    //       dynamicWorkerUsage: false,
    //       dynamicWorkerReady: true,
    //     })
    //   // We need to clean up the resources after our test
    //   await pool.destroy()
    // })

    // await t.step(
    //   'Verify LEAST_ELU strategy default tasks statistics requirements',
    //   async () => {
    //     const workerChoiceStrategy = WorkerChoiceStrategies.LEAST_ELU
    //     let pool = new FixedThreadPool(
    //       max,
    //       new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    //       { workerChoiceStrategy },
    //     )
    //     expect(
    //       pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
    //     ).toStrictEqual({
    //       runTime: {
    //         aggregate: false,
    //         average: false,
    //         median: false,
    //       },
    //       waitTime: {
    //         aggregate: false,
    //         average: false,
    //         median: false,
    //       },
    //       elu: {
    //         aggregate: true,
    //         average: false,
    //         median: false,
    //       },
    //     })
    //     await pool.destroy()
    //     pool = new DynamicThreadPool(
    //       min,
    //       max,
    //       new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    //       { workerChoiceStrategy },
    //     )
    //     expect(
    //       pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
    //     ).toStrictEqual({
    //       runTime: {
    //         aggregate: false,
    //         average: false,
    //         median: false,
    //       },
    //       waitTime: {
    //         aggregate: false,
    //         average: false,
    //         median: false,
    //       },
    //       elu: {
    //         aggregate: true,
    //         average: false,
    //         median: false,
    //       },
    //     })
    //     // We need to clean up the resources after our test
    //     await pool.destroy()
    //   },
    // )

    // await t.step(
    //   'Verify LEAST_ELU strategy can be run in a fixed pool',
    //   async () => {
    //     const pool = new FixedThreadPool(
    //       max,
    //       new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    //       { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_ELU },
    //     )
    //     // TODO: Create a better test to cover `LeastEluWorkerChoiceStrategy#choose`
    //     const promises = new Set()
    //     const maxMultiplier = 2
    //     for (let i = 0; i < max * maxMultiplier; i++) {
    //       promises.add(pool.execute())
    //     }
    //     await Promise.all(promises)
    //     for (const workerNode of pool.workerNodes) {
    //       expect(workerNode.usage).toStrictEqual({
    //         tasks: {
    //           executed: expect.any(Number),
    //           executing: 0,
    //           queued: 0,
    //           maxQueued: 0,
    //           sequentiallyStolen: 0,
    //           stolen: 0,
    //           failed: 0,
    //         },
    //         runTime: {
    //           history: new CircularArray(),
    //         },
    //         waitTime: {
    //           history: new CircularArray(),
    //         },
    //         elu: expect.objectContaining({
    //           idle: expect.objectContaining({
    //             history: expect.any(CircularArray),
    //           }),
    //           active: expect.objectContaining({
    //             history: expect.any(CircularArray),
    //           }),
    //         }),
    //       })
    //       expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
    //       expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
    //         max * maxMultiplier,
    //       )
    //       if (workerNode.usage.elu.active.aggregate == null) {
    //         expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
    //       } else {
    //         expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
    //       }
    //       if (workerNode.usage.elu.idle.aggregate == null) {
    //         expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
    //       } else {
    //         expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
    //       }
    //       if (workerNode.usage.elu.utilization == null) {
    //         expect(workerNode.usage.elu.utilization).toBeUndefined()
    //       } else {
    //         expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
    //         expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
    //       }
    //     }
    //     expect(
    //       pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
    //         pool.workerChoiceStrategyContext.workerChoiceStrategy,
    //       ).nextWorkerNodeKey,
    //     ).toEqual(expect.any(Number))
    //     expect(
    //       pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
    //         pool.workerChoiceStrategyContext.workerChoiceStrategy,
    //       ).previousWorkerNodeKey,
    //     ).toEqual(expect.any(Number))
    //     // We need to clean up the resources after our test
    //     await pool.destroy()
    //   },
    // )

    // await t.step(
    //   'Verify LEAST_ELU strategy can be run in a dynamic pool',
    //   async () => {
    //     const pool = new DynamicThreadPool(
    //       min,
    //       max,
    //       new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
    //       { workerChoiceStrategy: WorkerChoiceStrategies.LEAST_ELU },
    //     )
    //     // TODO: Create a better test to cover `LeastEluWorkerChoiceStrategy#choose`
    //     const promises = new Set()
    //     const maxMultiplier = 2
    //     for (let i = 0; i < max * maxMultiplier; i++) {
    //       promises.add(pool.execute())
    //     }
    //     await Promise.all(promises)
    //     for (const workerNode of pool.workerNodes) {
    //       expect(workerNode.usage).toStrictEqual({
    //         tasks: {
    //           executed: expect.any(Number),
    //           executing: 0,
    //           queued: 0,
    //           maxQueued: 0,
    //           sequentiallyStolen: 0,
    //           stolen: 0,
    //           failed: 0,
    //         },
    //         runTime: {
    //           history: new CircularArray(),
    //         },
    //         waitTime: {
    //           history: new CircularArray(),
    //         },
    //         elu: expect.objectContaining({
    //           idle: expect.objectContaining({
    //             history: expect.any(CircularArray),
    //           }),
    //           active: expect.objectContaining({
    //             history: expect.any(CircularArray),
    //           }),
    //         }),
    //       })
    //       expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
    //       expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
    //         max * maxMultiplier,
    //       )
    //       if (workerNode.usage.elu.active.aggregate == null) {
    //         expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
    //       } else {
    //         expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
    //       }
    //       if (workerNode.usage.elu.idle.aggregate == null) {
    //         expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
    //       } else {
    //         expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(0)
    //       }
    //       if (workerNode.usage.elu.utilization == null) {
    //         expect(workerNode.usage.elu.utilization).toBeUndefined()
    //       } else {
    //         expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
    //         expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
    //       }
    //     }
    //     expect(
    //       pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
    //         pool.workerChoiceStrategyContext.workerChoiceStrategy,
    //       ).nextWorkerNodeKey,
    //     ).toEqual(expect.any(Number))
    //     expect(
    //       pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
    //         pool.workerChoiceStrategyContext.workerChoiceStrategy,
    //       ).previousWorkerNodeKey,
    //     ).toEqual(expect.any(Number))
    //     // We need to clean up the resources after our test
    //     await pool.destroy()
    //   },
    // )

    await t.step('Verify FAIR_SHARE strategy default policy', async () => {
      const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
      let pool = new FixedThreadPool(
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      await pool.destroy()
      pool = new DynamicThreadPool(
        min,
        max,
        new URL('./../../worker-files/thread/testWorker.mjs', import.meta.url),
        { workerChoiceStrategy },
      )
      expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
        .toStrictEqual({
          dynamicWorkerUsage: false,
          dynamicWorkerReady: true,
        })
      // We need to clean up the resources after our test
      await pool.destroy()
    })

    await t.step(
      'Verify FAIR_SHARE strategy default tasks statistics requirements',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: true,
            average: true,
            median: false,
          },
        })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: true,
            average: true,
            median: false,
          },
        })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify FAIR_SHARE strategy can be run in a fixed pool',
      async () => {
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE },
        )
        // TODO: Create a better test to cover `FairShareChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: expect.objectContaining({
              idle: expect.objectContaining({
                history: expect.any(CircularArray),
              }),
              active: expect.objectContaining({
                history: expect.any(CircularArray),
              }),
            }),
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.runTime.average == null) {
            expect(workerNode.usage.runTime.average).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
          }
          // if (workerNode.usage.elu.active.aggregate == null) {
          //   expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
          // }
          // if (workerNode.usage.elu.idle.aggregate == null) {
          //   expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(
          //     0,
          //   )
          // }
          // if (workerNode.usage.elu.utilization == null) {
          //   expect(workerNode.usage.elu.utilization).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
          //   expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
          // }
          expect(workerNode.strategyData.virtualTaskEndTimestamp)
            .toBeGreaterThan(
              0,
            )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify FAIR_SHARE strategy can be run in a dynamic pool',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE },
        )
        // TODO: Create a better test to cover `FairShareChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: expect.objectContaining({
              idle: expect.objectContaining({
                history: expect.any(CircularArray),
              }),
              active: expect.objectContaining({
                history: expect.any(CircularArray),
              }),
            }),
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.runTime.average == null) {
            expect(workerNode.usage.runTime.average).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
          }
          // if (workerNode.usage.elu.active.aggregate == null) {
          //   expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
          // }
          // if (workerNode.usage.elu.idle.aggregate == null) {
          //   expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(
          //     0,
          //   )
          // }
          // if (workerNode.usage.elu.utilization == null) {
          //   expect(workerNode.usage.elu.utilization).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
          //   expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
          // }
          expect(workerNode.strategyData.virtualTaskEndTimestamp)
            .toBeGreaterThan(
              0,
            )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify FAIR_SHARE strategy can be run in a dynamic pool with median runtime statistic',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            workerChoiceStrategy: WorkerChoiceStrategies.FAIR_SHARE,
            workerChoiceStrategyOptions: {
              runTime: { median: true },
            },
          },
        )
        // TODO: Create a better test to cover `FairShareChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: expect.objectContaining({
              idle: expect.objectContaining({
                history: expect.any(CircularArray),
              }),
              active: expect.objectContaining({
                history: expect.any(CircularArray),
              }),
            }),
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.runTime.median == null) {
            expect(workerNode.usage.runTime.median).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.median).toBeGreaterThan(0)
          }
          // if (workerNode.usage.elu.active.aggregate == null) {
          //   expect(workerNode.usage.elu.active.aggregate).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.active.aggregate).toBeGreaterThan(0)
          // }
          // if (workerNode.usage.elu.idle.aggregate == null) {
          //   expect(workerNode.usage.elu.idle.aggregate).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.idle.aggregate).toBeGreaterThanOrEqual(
          //     0,
          //   )
          // }
          // if (workerNode.usage.elu.utilization == null) {
          //   expect(workerNode.usage.elu.utilization).toBeUndefined()
          // } else {
          //   expect(workerNode.usage.elu.utilization).toBeGreaterThanOrEqual(0)
          //   expect(workerNode.usage.elu.utilization).toBeLessThanOrEqual(1)
          // }
          expect(workerNode.strategyData.virtualTaskEndTimestamp)
            .toBeGreaterThan(
              0,
            )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toEqual(expect.any(Number))
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(expect.any(Number))
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify FAIR_SHARE strategy internals are resets after setting it',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.FAIR_SHARE
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        for (const workerNode of pool.workerNodes) {
          workerNode.strategyData = {
            virtualTaskEndTimestamp: performance.now(),
          }
        }
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.strategyData.virtualTaskEndTimestamp)
            .toBeUndefined()
        }
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        for (const workerNode of pool.workerNodes) {
          workerNode.strategyData = {
            virtualTaskEndTimestamp: performance.now(),
          }
        }
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.strategyData.virtualTaskEndTimestamp)
            .toBeUndefined()
        }
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify WEIGHTED_ROUND_ROBIN strategy default policy',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
          .toStrictEqual({
            dynamicWorkerUsage: false,
            dynamicWorkerReady: true,
          })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
          .toStrictEqual({
            dynamicWorkerUsage: false,
            dynamicWorkerReady: true,
          })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify WEIGHTED_ROUND_ROBIN strategy default tasks statistics requirements',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify WEIGHTED_ROUND_ROBIN strategy can be run in a fixed pool',
      async () => {
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN },
        )
        // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.runTime.average == null) {
            expect(workerNode.usage.runTime.average).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
          }
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBeGreaterThanOrEqual(0)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN },
        )
        // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.runTime.average == null) {
            expect(workerNode.usage.runTime.average).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.average).toBeGreaterThan(0)
          }
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBeGreaterThanOrEqual(0)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool with median runtime statistic',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            workerChoiceStrategy: WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN,
            workerChoiceStrategyOptions: {
              runTime: { median: true },
            },
          },
        )
        // TODO: Create a better test to cover `WeightedRoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
          if (workerNode.usage.runTime.aggregate == null) {
            expect(workerNode.usage.runTime.aggregate).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.aggregate).toBeGreaterThan(0)
          }
          if (workerNode.usage.runTime.median == null) {
            expect(workerNode.usage.runTime.median).toBeUndefined()
          } else {
            expect(workerNode.usage.runTime.median).toBeGreaterThan(0)
          }
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBeGreaterThanOrEqual(0)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it',
      async () => {
        const workerChoiceStrategy = WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBeDefined()
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBe(0)
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBeDefined()
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeVirtualTaskRunTime,
        ).toBe(0)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy default policy',
      async () => {
        const workerChoiceStrategy =
          WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
          .toStrictEqual({
            dynamicWorkerUsage: false,
            dynamicWorkerReady: true,
          })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(pool.workerChoiceStrategyContext.getStrategyPolicy())
          .toStrictEqual({
            dynamicWorkerUsage: false,
            dynamicWorkerReady: true,
          })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy default tasks statistics requirements',
      async () => {
        const workerChoiceStrategy =
          WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          { workerChoiceStrategy },
        )
        expect(
          pool.workerChoiceStrategyContext.getTaskStatisticsRequirements(),
        ).toStrictEqual({
          runTime: {
            aggregate: true,
            average: true,
            median: false,
          },
          waitTime: {
            aggregate: false,
            average: false,
            median: false,
          },
          elu: {
            aggregate: false,
            average: false,
            median: false,
          },
        })
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy can be run in a fixed pool',
      async () => {
        const pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            workerChoiceStrategy:
              WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
          },
        )
        // TODO: Create a better test to cover `InterleavedWeightedRoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundWeights.length,
        ).toBe(1)
        expect(
          Number.isSafeInteger(
            pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
              pool.workerChoiceStrategyContext.workerChoiceStrategy,
            ).roundWeights[0],
          ),
        ).toBe(true)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy can be run in a dynamic pool',
      async () => {
        const pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
          {
            workerChoiceStrategy:
              WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN,
          },
        )
        // TODO: Create a better test to cover `InterleavedWeightedRoundRobinWorkerChoiceStrategy#choose`
        const promises = new Set()
        const maxMultiplier = 2
        for (let i = 0; i < max * maxMultiplier; i++) {
          promises.add(pool.execute())
        }
        await Promise.all(promises)
        for (const workerNode of pool.workerNodes) {
          expect(workerNode.usage).toStrictEqual({
            tasks: {
              executed: expect.any(Number),
              executing: 0,
              queued: 0,
              maxQueued: 0,
              sequentiallyStolen: 0,
              stolen: 0,
              failed: 0,
            },
            runTime: expect.objectContaining({
              history: expect.any(CircularArray),
            }),
            waitTime: {
              history: new CircularArray(),
            },
            elu: {
              idle: {
                history: new CircularArray(),
              },
              active: {
                history: new CircularArray(),
              },
            },
          })
          expect(workerNode.usage.tasks.executed).toBeGreaterThanOrEqual(0)
          expect(workerNode.usage.tasks.executed).toBeLessThanOrEqual(
            max * maxMultiplier,
          )
        }
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toEqual(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundWeights.length,
        ).toBe(1)
        expect(
          Number.isSafeInteger(
            pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
              pool.workerChoiceStrategyContext.workerChoiceStrategy,
            ).roundWeights[0],
          ),
        ).toBe(true)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step(
      'Verify INTERLEAVED_WEIGHTED_ROUND_ROBIN strategy internals are resets after setting it',
      async () => {
        const workerChoiceStrategy =
          WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN
        let pool = new FixedThreadPool(
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).roundId,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).workerNodeId,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).roundWeights,
        ).toBeDefined()
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundWeights.length,
        ).toBe(1)
        expect(
          Number.isSafeInteger(
            pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
              pool.workerChoiceStrategyContext.workerChoiceStrategy,
            ).roundWeights[0],
          ),
        ).toBe(true)
        await pool.destroy()
        pool = new DynamicThreadPool(
          min,
          max,
          new URL(
            './../../worker-files/thread/testWorker.mjs',
            import.meta.url,
          ),
        )
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).roundId,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).workerNodeId,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBeDefined()
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            workerChoiceStrategy,
          ).roundWeights,
        ).toBeDefined()
        pool.setWorkerChoiceStrategy(workerChoiceStrategy)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).workerNodeId,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).nextWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).previousWorkerNodeKey,
        ).toBe(0)
        expect(
          pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
            pool.workerChoiceStrategyContext.workerChoiceStrategy,
          ).roundWeights.length,
        ).toBe(1)
        expect(
          Number.isSafeInteger(
            pool.workerChoiceStrategyContext.workerChoiceStrategies.get(
              pool.workerChoiceStrategyContext.workerChoiceStrategy,
            ).roundWeights[0],
          ),
        ).toBe(true)
        // We need to clean up the resources after our test
        await pool.destroy()
      },
    )

    await t.step('Verify unknown strategy throw error', () => {
      expect(
        () =>
          new DynamicThreadPool(
            min,
            max,
            new URL(
              './../../worker-files/thread/testWorker.mjs',
              import.meta.url,
            ),
            { workerChoiceStrategy: 'UNKNOWN_STRATEGY' },
          ),
      ).toThrow("Invalid worker choice strategy 'UNKNOWN_STRATEGY'")
    })
  },
  sanitizeResources: false,
  sanitizeOps: false,
})
