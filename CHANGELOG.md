# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.15](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.14...v0.4.15) (2024-07-11)

### 🐞 Bug Fixes

- null exception when a task errored
  ([328023f](https://github.com/poolifier/poolifier-web-worker/commit/328023fdcb13631d7f97182fc37ee162406ccfed)),
  closes [#49](https://github.com/poolifier/poolifier-web-worker/issues/49)

### ✨ Polish

- **priority-queue:** cleanup intermediate variables namespace
  ([a550353](https://github.com/poolifier/poolifier-web-worker/commit/a550353fb054b0fbabffe7f2a6de2635e5af03d3))

### 🧪 Tests

- improve WorkerNode init coverage
  ([7210f30](https://github.com/poolifier/poolifier-web-worker/commit/7210f30076c1771172871ad84c23c52e70344886))
- revert incorrect change
  ([53fb53d](https://github.com/poolifier/poolifier-web-worker/commit/53fb53da3e8204cd8467ca9cea178b871ae79119))

### 📚 Documentation

- cleanup bun runtime usage
  ([f802707](https://github.com/poolifier/poolifier-web-worker/commit/f802707b748a602d40d65b6d9f1b51b3949f71f7))
- fix PR template formatting
  ([1d79921](https://github.com/poolifier/poolifier-web-worker/commit/1d79921cde2b2bff2b4c2e3c60ca353a405bbaeb))
- flag WorkerChoiceStrategiesContext class as internal
  ([ba6948a](https://github.com/poolifier/poolifier-web-worker/commit/ba6948adfedbc03ac6439fdadc804007812b8505))

## [0.4.14](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.13...v0.4.14) (2024-07-07)

### ⚡ Performance

- optimize tasks queuing implementation
  ([4c4cdc0](https://github.com/poolifier/poolifier-web-worker/commit/4c4cdc0978a2f87c348cc1441bf8993ce8eba562))

### ✨ Polish

- factor out fixed queue common code in an abstract class
  ([55070de](https://github.com/poolifier/poolifier-web-worker/commit/55070dee5570bdbf4e8d4e72d227ab82d772ebb4))
- move queueing code into its own directory
  ([f8f1e26](https://github.com/poolifier/poolifier-web-worker/commit/f8f1e266d9dbe4bcab6111af53f133b90485e485))

## [0.4.13](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.12...v0.4.13) (2024-07-05)

### 🚀 Features

- release with release-please
  ([bc35b50](https://github.com/poolifier/poolifier-web-worker/commit/bc35b5019b23e07f1053989efca9c29009069f36))

### 🐞 Fixes

- ensure checks are run on release PR
  ([71c26f3](https://github.com/poolifier/poolifier-web-worker/commit/71c26f39ac6e82fcc67c5c06f6364f86e26062f1))

### 📚 Documentation

- ensure version is bumped on release in examples
  ([a9b9dce](https://github.com/poolifier/poolifier-web-worker/commit/a9b9dce33870d434292a9cfa56c01518114eec51))
- refine contribution documentation
  ([c0c1ac7](https://github.com/poolifier/poolifier-web-worker/commit/c0c1ac75a96b1a9257fbf1e0d4e08eb1ebb32e26))
- refine PR template
  ([369d51c](https://github.com/poolifier/poolifier-web-worker/commit/369d51c26335a21e352ae6511484115fc3bd0740))
- refine README.md
  ([a25a2d1](https://github.com/poolifier/poolifier-web-worker/commit/a25a2d167c24e292767c988743c631bf96378225))
- refine README.md badges
  ([4d91cd9](https://github.com/poolifier/poolifier-web-worker/commit/4d91cd994f0f9bfdd14cd02a6d9a6bb193f948d8))

### ✨ Polish

- **ci:** cleanup GH action
  ([a4b1ef1](https://github.com/poolifier/poolifier-web-worker/commit/a4b1ef1cb7392a6b26cfa42b6d9e83176d1660b6))

### 🤖 Automation

- **ci:** add autofix GH action
  ([9fde7c1](https://github.com/poolifier/poolifier-web-worker/commit/9fde7c167f55b1dae67706fde7cd3f8850bf96d7))
- **ci:** do not cancel workflow of autofix.ci fails
  ([d1fe8c4](https://github.com/poolifier/poolifier-web-worker/commit/d1fe8c47614406f90149af707c768e4f4eb39c65))
- **deps-dev:** apply updates
  ([2b2a96a](https://github.com/poolifier/poolifier-web-worker/commit/2b2a96aa1ef2ae087e6b47af78e7eb523f058aa4))
- **deps-dev:** apply updates
  ([7394780](https://github.com/poolifier/poolifier-web-worker/commit/739478062ce0b765349b28bff91e500af6af450d))
- **deps:** Bump oven-sh/setup-bun from 1 to 2
  ([d5c4430](https://github.com/poolifier/poolifier-web-worker/commit/d5c44308a6645a083e95e549e16ecc66fedbfb44))

## [0.4.12] - 2024-06-21

### Fixed

- Fix priority queue dequeue() from the last prioritized bucket.

## [0.4.11] - 2024-06-12

### Changed

- Add mapExecute() helper to execute a task function on an iterable data's
  input.

## [0.4.10] - 2024-05-29

### Changed

- Optimize tasks queue implementation.
- Enable prioritized tasks queueing only when necessary.

## [0.4.9] - 2024-05-25

### Changed

- Optimize circular buffer implementation to store task execution measurements.

## [0.4.8] - 2024-05-22

### Changed

- Switch to optimized circular buffer implementation to store task execution
  measurements.

## [0.4.7] - 2024-05-20

### Changed

- Bump version to deal with npm package publication issue.

## [0.4.6] - 2024-05-20

### Fixed

- Ensure tasks stealing dynamic worker node is not destroyed on inactivity.

## [0.4.5] - 2024-05-15

### Fixed

- Fix default task function worker choice strategy and priority handling.

## [0.4.4] - 2024-05-10

### Fixed

- Avoid queued tasks redistribution on the errored worker node.
- Fix pools' `addTaskFunction()` type definition.

## [0.4.3] - 2024-05-09

### Fixed

- Disable `tasksStealingOnBackPressure` by default until performance issues
  under heavy load are sorted out.

## [0.4.2] - 2024-05-08

### Changed

- Optimize task(s) stealing by dequeuing task(s) from the last prioritized
  bucket.

## [0.4.1] - 2024-05-08

### Fixed

- Fix worker nodes priority queue k-buckets initialization.

## [0.4.0] - 2024-05-07

### Changed

- Support per task function(s) priority and worker choice strategy definition
  via a task function object:
  `{ taskFunction: (data?: Data) => Response | Promise<Response>, priority?: number, strategy?: WorkerChoiceStrategy }`.
- Add priority queue based tasks queueing. One priority queue is divided into
  prioritized buckets to avoid queued tasks starvation under load.
- BREAKING CHANGE: `listTaskFunctionNames()` to `listTaskFunctionsProperties()`
  in pool and worker API returning registered task functions properties.
- BREAKING CHANGE: `strategy` field in pool information renamed to
  `defaultStrategy`.

### Fixed

- Ensure dynamic worker node are initialized with sensible worker node usage
  default values to avoid worker choice strategies biased decisions.

## [0.3.17] - 2024-04-30

### Fixed

- Ensure worker choice strategy options changes at runtime are propagated to
  poolifier workers.
- Do not reset worker node usage statistics at worker choice strategy runtime
  change.

## [0.3.16] - 2024-04-04

### Fixed

- Fix bundling.

## [0.3.15] - 2024-04-04

### Fixed

- Fix possible race condition at worker node recreation on worker node `error`
  and `exit` events.

### Changed

- Optimize different JavaScript runtime handling code with a branching less
  design pattern.
- Disable release publishing on https://deno.land/x/poolifier in favor of JSR:
  https://jsr.io/@poolifier/poolifier-web-worker.

## [0.3.14] - 2024-04-01

### Changed

- Add `errorEventHandler` handler support to pool options listening for error
  event on each worker.

## [0.3.13] - 2024-04-01

### Fixed

- Ensure the minimum number of workers on a started pool is guaranteed.

## [0.3.12] - 2024-03-30

### Changed

- Add tatami-ng and Bun support to internal benchmark.

## [0.3.11] - 2024-03-27

### Fixed

- Fix conditional imports promise resolution.

## [0.3.10] - 2024-03-27

### Fixed

- Fix browser compatibility: ensure `node:...` imports are conditionals.

## [0.3.9] - 2024-03-27

### Fixed

- Fix worker initialization with Bun.

## [0.3.8] - 2024-03-26

### Fixed

- Fix publishing on JSR.

## [0.3.7] - 2024-03-26

### Fixed

- Publish only the needed files on JSR.

## [0.3.6] - 2024-03-26

### Changed

- Refine package usage documentation.

## [0.3.5] - 2024-03-26

### Changed

- Publish on JSR.

## [0.3.4] - 2024-03-20

### Fixed

- Fix browser web worker default type.

## [0.3.3] - 2024-03-20

### Fixed

- Fix browser bundle format.

## [0.3.2] - 2024-03-18

### Changed

- Add TypeScript type declarations to npm package.

## [0.3.1] - 2024-03-16

### Fixed

- Fix performance regression: compute estimated cpu speed only if strictly
  needed.

## [0.3.0] - 2024-03-16

### Changed:

- Breaking change: remove node APIs usage in favor of Javascript web APIs. Pool
  event emitter `emitter` property is renamed to `eventTarget` and is using the
  `EventTarget` web API.

## [0.2.3] - 2024-02-25

### Fixed

- Fix examples in documentation.

## [0.2.2] - 2024-02-24

### Fixed

- Fix npm package publication GitHub action.

### Changed

- Add GitHub action to publish `poolifier-web-worker` package to npm packages
  registry.

## [0.2.2-beta3] - 2024-02-24

### Fixed

- Fix npm package publication GitHub action, take 2.

### Changed

- Add GitHub action to publish `poolifier-web-worker` package to npm packages
  registry.

## [0.2.2-beta2] - 2024-02-24

### Fixed

- Fix npm package publication GitHub action.

### Changed

- Add GitHub action to publish `poolifier-web-worker` package to npm packages
  registry.

## [0.2.2-beta1] - 2024-02-24

### Changed

- Add GitHub action to publish `poolifier-web-worker` package to npm packages
  registry.

## [0.2.1] - 2024-02-23

### Fixed

- Fix null exception regression:
  [#1496](https://github.com/poolifier/poolifier/issues/1496).

## [0.2.0] - 2024-01-28

### Changed

- Drop support for Deno version < 1.40.0: make `IWorker` interface compatible
  with Deno 1.40.x web worker type definition.

## [0.1.17] - 2024-01-16

### Fixed

- Fix possible null exception at task finishing handling.

### Changed

- Optimize Deque implementation to improve tasks queueing performance.

## [0.1.16] - 2024-01-06

### Fixed

- Fix dynamic pool with minimum number of workers set to zero:
  [#1748](https://github.com/poolifier/poolifier/issues/1748).

## [0.1.15] - 2024-01-05

### Changed

- Improve performance by clean up unneeded condition checks on hot code paths.

## [0.1.14] - 2024-01-03

### Changed

- Removed wrongly exposed pool public method.

## [0.1.13] - 2024-01-01

### Fixed

- Properly handle dynamic pool with zero minimum size.

## [0.1.12] - 2023-12-30

### Changed

- Reduce branching in several hot code paths.
- Use faster object cloning implementation.

## [0.1.11] - 2023-12-25

### Fixed

- Fix tasks redistribution triggers at pool destroying.
- Fix code coverage related deno tasks.

## [0.1.10] - 2023-12-24

### Fixed

- Avoid worker node cross tasks stealing.
- Ensure only half the pool worker nodes can steal tasks.

## [0.1.9] - 2023-12-22

### Changed

- Readd ThreadPoolOptions TS type alias to PoolOptions.
- Avoid useless branching on pool type.

## [0.1.8] - 2023-12-21

### Fixed

- Fix default worker weight computation.

## [0.1.7] - 2023-12-21

### Fixed

- Ensure worker choice strategies implementation wait for worker node readiness.

## [0.1.6] - 2023-12-18

### Fixed

- Fix pool destroying with tasks queuing enabled.

## [0.1.5] - 2023-12-18

### Added

- Add queued tasks end timeout support to worker node termination.

## [0.1.4] - 2023-12-18

### Fixed

- Make more robust the fix for possible null exception at handling task
  execution response.

## [0.1.3] - 2023-12-17

### Fixed

- Fix possible null exception at handling task execution response.

## [0.1.2] - 2023-12-17

### Fixed

- Wait for queued tasks to end at worker node termination.

## [0.1.1] - 2023-12-16

### Changed

- Cleanup default module exports.

## [0.1.0] - 2023-12-16

### Fixed

- Ensure worker node is removed on worker error.

### Changed

- TypeScript breaking change: merge ThreadPoolOptions type into PoolOptions
  type.

## [0.0.15] - 2023-12-13

### Fixed

- Ensure worker choice strategy wait for worker nodes readiness.

## [0.0.14] - 2023-12-08

### Changed

- Add a fastpath when tasks stealing or redistribution is impossible.

## [0.0.13] - 2023-11-27

### Fixed

- Remove all pool events listener at pool destroying.

## [0.0.12] - 2023-11-25

### Fixed

- Fix task function usage statistics handling for sequentially stolen tasks.

## [0.0.11] - 2023-11-25

### Changed

- Make continuous tasks stealing start at worker node idling.

## [0.0.10] - 2023-11-24

### Fixed

- Ensure pool statuses are checked at initialization, `start()` or `destroy()`.
- Ensure pool `ready` event can be emitted after several `start()/destroy()`
  cycles.

## [0.0.9] - 2023-10-29

### Changed

- Export via `mod.ts` instead of `index.ts`.

## [0.0.8] - 2023-10-27

### Changed

- Improve documentation.

## [0.0.7] - 2023-10-25

### Fixed

- Ensure pool cannot be initialized from a worker.
- Ensure worker initialization is done once.

## [0.0.6] - 2023-10-20

### Added

- Add Bencher benchmark:
  [https://bencher.dev/perf/poolifier-web-worker](https://bencher.dev/perf/poolifier-web-worker).

## [0.0.5] - 2023-10-20

### Changed

- Use builtin retry mechanism in worker choice strategies instead of custom one.

## [0.0.4] - 2023-10-19

### Fixed

- Avoid null exception at sending message to worker.
- Avoid null exception at checking worker node readiness.

## [0.0.3] - 2023-10-17

### Fixed

- Fix race condition at dynamic worker node task assignment and scheduled
  removal. See issue [#1468](https://github.com/poolifier/poolifier/issues/1468)
  and [#1496](https://github.com/poolifier/poolifier/issues/1496).
