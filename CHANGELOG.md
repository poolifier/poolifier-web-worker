# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.25](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.24...v0.4.25) (2024-08-30)


### 🐞 Bug Fixes

* handle properly small or zero `tasksStealingRatio` ([ab6e570](https://github.com/poolifier/poolifier-web-worker/commit/ab6e5700b536a70bdef6accd66fce91f5e45cd69))


### ✨ Polish

* move dynamic pool only getters to its own class ([74970f2](https://github.com/poolifier/poolifier-web-worker/commit/74970f25d771c43eac26feb891305da0d73ba1b6))


### 🧪 Tests

* fix variable casing ([a2727d7](https://github.com/poolifier/poolifier-web-worker/commit/a2727d7cea305b374232aa221698383c49d6d2b0))
* refine pool event tests expectation ([5bdf99a](https://github.com/poolifier/poolifier-web-worker/commit/5bdf99a7019550759e1ee369846eda83f049c4ef))


### 📚 Documentation

* cleanup code examples ([28b119c](https://github.com/poolifier/poolifier-web-worker/commit/28b119c8bd08596863f44de4c4712963c5a6a8fc))
* refine pool ready event emission condition ([e7d0673](https://github.com/poolifier/poolifier-web-worker/commit/e7d0673f97e9302844aed9e7d7f1e6c5273ecbc3))
* switch examples to top level await usage (ESM) ([30781c3](https://github.com/poolifier/poolifier-web-worker/commit/30781c30f374e0e7585c5957ef9956e2c4851106))

## [0.4.24](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.23...v0.4.24) (2024-08-28)

### ⚡ Performance

- reduce useless branching at pool info building
  ([1184246](https://github.com/poolifier/poolifier-web-worker/commit/1184246942bdc0c39a6ac9c0912b3a2e35fdebf5))
- track dynamic pool full lifecycle via events
  ([5415178](https://github.com/poolifier/poolifier-web-worker/commit/541517837cede8f2b5a06b64ef41eb7aca9bda83))

### ✨ Polish

- cleanup pool information ordering
  ([91eb092](https://github.com/poolifier/poolifier-web-worker/commit/91eb092f3c1c6cff5e6e3eb5a5772236d3a08ce6))
- merge dynamic pool events emission code
  ([2babd9d](https://github.com/poolifier/poolifier-web-worker/commit/2babd9db1e9fd48d660582b12f03e45249e4a71b))

## [0.4.23](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.22...v0.4.23) (2024-08-27)

### 🐞 Bug Fixes

- fix pool back pressure semantic on dynamic pool
  ([00e2a3f](https://github.com/poolifier/poolifier-web-worker/commit/00e2a3ffd712997e7faf01693ecd3773c2b08ec0))

### ⚡ Performance

- track pool busy and back pressure lifecycle via events
  ([a58ab3b](https://github.com/poolifier/poolifier-web-worker/commit/a58ab3b38b53c10a643593fd13f2edfb1fd76154))

### 📚 Documentation

- format README.md
  ([7c585a0](https://github.com/poolifier/poolifier-web-worker/commit/7c585a0948f1f029c0ecfe00bad77320b1806da9))

## [0.4.22](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.21...v0.4.22) (2024-08-26)

### 🐞 Bug Fixes

- ensure no deleted dynamic worker can be used to steal task(s)
  ([5c504d4](https://github.com/poolifier/poolifier-web-worker/commit/5c504d4960df7e8540bf60282d14c57c6ca07eb5))

### ✨ Polish

- cleanup worker node back pressure detection implementation
  ([1e0e4b5](https://github.com/poolifier/poolifier-web-worker/commit/1e0e4b5fe86713aacaa5348557bc58f2a7e7be3e))
- cleanup worker node state conditions check
  ([5d8036c](https://github.com/poolifier/poolifier-web-worker/commit/5d8036cbc745b0fb568673022190b47c0485e969))

## [0.4.21](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.20...v0.4.21) (2024-08-24)

### 🐞 Bug Fixes

- fix pool ready status with zero min size dynamic pool
  ([cebb8d8](https://github.com/poolifier/poolifier-web-worker/commit/cebb8d85701be4376b92ea97f71e6cabd39f9592))

### 🧪 Tests

- add pool empty event test
  ([e353778](https://github.com/poolifier/poolifier-web-worker/commit/e353778b3657122d216ea08bd5f9528d9bbcd6f4))
- optimize pool empty event test
  ([e49f64a](https://github.com/poolifier/poolifier-web-worker/commit/e49f64a279e58c4e74f083b572b2555b2111d05c))

### 📚 Documentation

- refine a code comment
  ([1dc8bf2](https://github.com/poolifier/poolifier-web-worker/commit/1dc8bf2a39f9876a96b43730d6722e64fc5b5613))

### 🤖 Automation

- **deps:** Bump sonarsource/sonarcloud-github-action
  ([#59](https://github.com/poolifier/poolifier-web-worker/issues/59))
  ([d35a85f](https://github.com/poolifier/poolifier-web-worker/commit/d35a85fb3108222f358aa516d24124f15a3430b9))

## [0.4.20](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.19...v0.4.20) (2024-08-19)

### 🐞 Bug Fixes

- account for all stealing worker nodes
  ([039ec77](https://github.com/poolifier/poolifier-web-worker/commit/039ec771bc9773cb2f2fff53f2fe1abff58e0a46))

### ✨ Polish

- define a variable only when needed
  ([145c656](https://github.com/poolifier/poolifier-web-worker/commit/145c65685a35f8bc3457f6f4965ea4e7db1aabfb))
- display back pressured worker nodes in pool info
  ([51a3b96](https://github.com/poolifier/poolifier-web-worker/commit/51a3b960d816356436a9dd8a5e9edd4cb169ed6c))
- format properly || condition
  ([da6bafa](https://github.com/poolifier/poolifier-web-worker/commit/da6bafa1b8fe43d229b8c53cf79852fee6f67cea))

## [0.4.19](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.18...v0.4.19) (2024-08-14)

### 🐞 Bug Fixes

- reduce race condition at task response handling during pool destroy
  ([7227fec](https://github.com/poolifier/poolifier-web-worker/commit/7227fec68ac43c55da4da5200baca2b388789627))

## [0.4.18](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.17...v0.4.18) (2024-08-14)

### 🐞 Bug Fixes

- ensure task stealing can't start twice on the same worker node
  ([6d81a8e](https://github.com/poolifier/poolifier-web-worker/commit/6d81a8ef8f87cb114d2f6a43cbdf4ba1f5dc3503))
- fix dynamic worker node killing condition
  ([6b3780e](https://github.com/poolifier/poolifier-web-worker/commit/6b3780eaed43d3eaf5403c746b6c90f6eaf91a84))
- trigger continuous tasks stealing under proper conditions
  ([ed3da2d](https://github.com/poolifier/poolifier-web-worker/commit/ed3da2d3cd34343ef212be566a8a30b5c36d3da6))

### 🧪 Tests

- silence leaks detection false positive on windows
  ([96a0e78](https://github.com/poolifier/poolifier-web-worker/commit/96a0e78c7ebcb57c8abac808d6348b3d46c05feb))

### 📚 Documentation

- refine code comment about task stealing conditions
  ([2459840](https://github.com/poolifier/poolifier-web-worker/commit/2459840281529cfd22d04ae765e0c606f9abe3ef))

## [0.4.17](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.16...v0.4.17) (2024-08-13)

### 🚀 Features

- reenable tasks stealing under back pressure by default
  ([a944273](https://github.com/poolifier/poolifier-web-worker/commit/a9442739a14027a2668e7d433bb8e3ca6db813b2))

### 🐞 Bug Fixes

- protect worker node tasks queue from concurrent tasks stealing
  ([dd85b2d](https://github.com/poolifier/poolifier-web-worker/commit/dd85b2d896674f5dc9572abca19fb6656f45442d))

### ⚡ Performance

- do mapExecute() args sanity checks once
  ([633afa3](https://github.com/poolifier/poolifier-web-worker/commit/633afa3d465f14b6e64f10ec49f9f77717c58f8d))

### 🧪 Tests

- **refactor:** switch to BDD style
  ([#55](https://github.com/poolifier/poolifier-web-worker/issues/55))
  ([749e33e](https://github.com/poolifier/poolifier-web-worker/commit/749e33e7d5a74ac7868ed1535d766fab48da2ae1))
- remove duplicate tests
  ([b119ad3](https://github.com/poolifier/poolifier-web-worker/commit/b119ad38c2e528a0ac4f6863adb8b6604f237580))

### 📚 Documentation

- add documentation on enablePrority priority queue getter/setter
  ([3ed4555](https://github.com/poolifier/poolifier-web-worker/commit/3ed4555072c09f6844d3d65fe22b8461231eb510))
- **api:** add missing tasksStealingRatio default value
  ([4814bef](https://github.com/poolifier/poolifier-web-worker/commit/4814bef1fb4367f4d5c1380e4d2b7cf9cbab50d1))

## [0.4.16](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.15...v0.4.16) (2024-07-18)

### 🚀 Features

- add ratio of worker nodes in a pool allowed to perform concurrent tasks
  stealing
  ([7b7defe](https://github.com/poolifier/poolifier-web-worker/commit/7b7defe886aad719ad1c6fe89d62617334355ee9))

### 🧪 Tests

- fix error type expectation
  ([218cb7e](https://github.com/poolifier/poolifier-web-worker/commit/218cb7ee22a4c672fa79f48ea321e21f264d8126))

### 📚 Documentation

- **api.md:** add missing ToC entry
  ([96badd7](https://github.com/poolifier/poolifier-web-worker/commit/96badd714cb0de978df30eb2ed710bddbd6b94c7))
- **api.md:** document tasksStealingRatio tasks queue option
  ([9ed8a69](https://github.com/poolifier/poolifier-web-worker/commit/9ed8a69dd758400c14d9b2e49f35377b005ef7a3))

### 🤖 Automation

- **deps:** Bump github/combine-prs from 5.0.0 to 5.1.0
  ([#51](https://github.com/poolifier/poolifier-web-worker/issues/51))
  ([81a44af](https://github.com/poolifier/poolifier-web-worker/commit/81a44af3c98b4aa672215fd0bf86a36c92bd9d83))

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
