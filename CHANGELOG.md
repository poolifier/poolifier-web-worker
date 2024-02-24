# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
