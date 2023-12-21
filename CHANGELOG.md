# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
  [https://bencher.dev/perf/poolifier-deno](https://bencher.dev/perf/poolifier-deno).

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
