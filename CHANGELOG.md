# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.2](https://github.com/poolifier/poolifier-web-worker/compare/v0.6.1...v0.6.2) (2026-02-23)

### 🐞 Bug Fixes

- add missing loadExponent: 0 validation test
  ([f8500ee](https://github.com/poolifier/poolifier-web-worker/commit/f8500eece48bd35c1b46b536c93be699a2e1d7f3))
- **deps:** update dependency poolifier-web-worker to ^0.6.1
  ([#130](https://github.com/poolifier/poolifier-web-worker/issues/130))
  ([ca51b78](https://github.com/poolifier/poolifier-web-worker/commit/ca51b78dd950028e35993a9a69126c10f69b952e))
- remove incorrectly added test code during commit port
  ([5b84f16](https://github.com/poolifier/poolifier-web-worker/commit/5b84f16607b3ddb5d93cbf1b2549b4bad19271bb))
- **test:** ignore flaky workerNodeKeys affinity test on Deno v1.x macOS
  ([68b8451](https://github.com/poolifier/poolifier-web-worker/commit/68b8451680e32c1d7ff0297f0ad1c390790c81ac))
- **test:** restore anonymous function tests in isAsyncFunction()
  ([08ae153](https://github.com/poolifier/poolifier-web-worker/commit/08ae153c34ad2f7a0b21e6fc1b49a75b07353f87))
- **test:** use FakeTime for sleep() test to avoid flakiness
  ([30d9f25](https://github.com/poolifier/poolifier-web-worker/commit/30d9f25d9c8e75af577ac6f48405e94d2f736423))
- **test:** use try/finally instead of 'using' for Deno v1.x compatibility
  ([c0bd174](https://github.com/poolifier/poolifier-web-worker/commit/c0bd1743ec4a09efa02a7ab26cc713d6e059f81b))

### 🧪 Tests

- fix async kill handler test to properly await and verify completion
  ([b13a9c8](https://github.com/poolifier/poolifier-web-worker/commit/b13a9c818d92f46e853ec484a4bbeb322da64915))
- harmonize comments with upstream poolifier style
  ([7cf03cc](https://github.com/poolifier/poolifier-web-worker/commit/7cf03cce4f9fd78dc20d353f2bfb0561e0274346))
- port 22 abstract-worker tests from poolifier/poolifier
  ([fbbe842](https://github.com/poolifier/poolifier-web-worker/commit/fbbe8427987939a8db057334aa73577ee4ea46ca))

### 📚 Documentation

- add Git hooks installation instructions
  ([b97f368](https://github.com/poolifier/poolifier-web-worker/commit/b97f36875888f228a071af6c85c5df84d84ce294))
- consolidate multiple task functions features in README
  ([370f1c2](https://github.com/poolifier/poolifier-web-worker/commit/370f1c217d329247a2c369d2290b9d5e296baf58))

### 🤖 Automation

- add pre-commit hooks for formatting and linting
  ([846b88d](https://github.com/poolifier/poolifier-web-worker/commit/846b88d42440c5418ce5d9f22b3a7fbf0a682000))

## [0.6.1](https://github.com/poolifier/poolifier-web-worker/compare/v0.6.0...v0.6.1) (2026-02-20)

### 🚀 Features

- add agingFactor and loadExponent tunables for priority queue anti-starvation
  ([7d7d84b](https://github.com/poolifier/poolifier-web-worker/commit/7d7d84b5acbf34b1436cbec23b36f661aff96354))

### 🐞 Bug Fixes

- **deps:** update dependency poolifier-web-worker to ^0.6.0
  ([#127](https://github.com/poolifier/poolifier-web-worker/issues/127))
  ([2230ff5](https://github.com/poolifier/poolifier-web-worker/commit/2230ff5dcfe23ae4912a37ae2934d38dfbad1d78))

### 🧪 Tests

- ignore flaky workerNodeKeys affinity test on Linux
  ([225b084](https://github.com/poolifier/poolifier-web-worker/commit/225b08489f15acff10a74585ba742324cd829e00))

## [0.6.0](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.15...v0.6.0) (2026-02-16)

### 🚀 Features

- add task function worker node affinity
  ([#126](https://github.com/poolifier/poolifier-web-worker/issues/126))
  ([af54b3b](https://github.com/poolifier/poolifier-web-worker/commit/af54b3b7cbdc597098e3e87221a82a01f04e569e))

### 🐞 Bug Fixes

- **deps:** update dependency poolifier-web-worker to ^0.5.15
  ([#114](https://github.com/poolifier/poolifier-web-worker/issues/114))
  ([ad27378](https://github.com/poolifier/poolifier-web-worker/commit/ad27378b8136a64af56e104fc1ca8c1c651035ee))

### 🧪 Tests

- refine ignore conditions
  ([a1fe073](https://github.com/poolifier/poolifier-web-worker/commit/a1fe0735050419f2cff2ffe323b1b10ae05d9dc5))

### 🧹 Chores

- release trigger
  ([246f942](https://github.com/poolifier/poolifier-web-worker/commit/246f9422737e554a308303995221a20169ff018f))

## [0.5.15](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.14...v0.5.15) (2025-11-16)

### 🐞 Bug Fixes

- potention race on circular buffer size
  ([6a9fcd0](https://github.com/poolifier/poolifier-web-worker/commit/6a9fcd0e7fb6348f2cec8341070347f124a42d9f))
- safe access to tasks queue size
  ([0771f47](https://github.com/poolifier/poolifier-web-worker/commit/0771f474c70eed6ec122cf6769bb353cff48b555))

### ⚡ Performance

- switch default worker choice strategy to LEAST_USED
  ([7e160a5](https://github.com/poolifier/poolifier-web-worker/commit/7e160a52849c4097f7615cc31c5e4fcdf3805d94))

### ✨ Polish

- cleanup main deno.json
  ([7bf4372](https://github.com/poolifier/poolifier-web-worker/commit/7bf4372742f5ab43198b9d988e4f6894bec4cc83))
- cleanup type casting
  ([6abbc70](https://github.com/poolifier/poolifier-web-worker/commit/6abbc70058e293f98fabde6ad11bf1a21dff35fb))
- switch benchmarks to tinybench
  ([6ffb0c7](https://github.com/poolifier/poolifier-web-worker/commit/6ffb0c7f1626a2adeccc2fb67a275d21939b4672))

### 🧪 Tests

- also tests properly for round robin strategy
  ([c620e5f](https://github.com/poolifier/poolifier-web-worker/commit/c620e5fea22b631c3879a1d833d951112548bf8f))
- ignore flaky on linux and deno version &gt;= 2
  ([e4eec99](https://github.com/poolifier/poolifier-web-worker/commit/e4eec994350df4486f552dd4902cdcd22c41746f))
- ignore flaky tests on linux and deno version &gt;= 2
  ([abf3127](https://github.com/poolifier/poolifier-web-worker/commit/abf312759180f5d0481db5055346d1eeb88b81d3))

### 🤖 Automation

- **deps:** Bump actions/setup-node from 4 to 5
  ([#105](https://github.com/poolifier/poolifier-web-worker/issues/105))
  ([cb4aab3](https://github.com/poolifier/poolifier-web-worker/commit/cb4aab38abce29ea5bab1b2433b82c88b116277f))
- **deps:** Bump actions/setup-node from 5 to 6
  ([#109](https://github.com/poolifier/poolifier-web-worker/issues/109))
  ([27b1db2](https://github.com/poolifier/poolifier-web-worker/commit/27b1db2bd28410ff5b975bf99f1e26a5a4f23ef3))
- **deps:** Bump github/codeql-action from 3 to 4
  ([#108](https://github.com/poolifier/poolifier-web-worker/issues/108))
  ([54b815e](https://github.com/poolifier/poolifier-web-worker/commit/54b815ec96f090651264c55d3778d26b24ff580e))
- **deps:** Bump sonarsource/sonarqube-scan-action from 5.3.0 to 5.3.1
  ([#104](https://github.com/poolifier/poolifier-web-worker/issues/104))
  ([f6a52c4](https://github.com/poolifier/poolifier-web-worker/commit/f6a52c4ee0049be84e00ef78985f9bff06e7219d))
- **deps:** Bump sonarsource/sonarqube-scan-action from 5.3.1 to 6.0.0
  ([#106](https://github.com/poolifier/poolifier-web-worker/issues/106))
  ([257c4e8](https://github.com/poolifier/poolifier-web-worker/commit/257c4e80529095ac7aaa1cdb1f50735a1223ca0f))

## [0.5.14](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.13...v0.5.14) (2025-08-26)

### 🐞 Bug Fixes

- use strict object equality in tasks stealing code
  ([f2fd2ff](https://github.com/poolifier/poolifier-web-worker/commit/f2fd2ff6d2a663272f854ae6f0dee2e2801c60d0))

### ✨ Polish

- cleanup nested conditions
  ([a7fef39](https://github.com/poolifier/poolifier-web-worker/commit/a7fef39f4fff11bb5ee47af47d7f45527342bfb1))

## [0.5.13](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.12...v0.5.13) (2025-08-23)

### ⚡ Performance

- add adaptive aging factor to priority queue
  ([c4ec62b](https://github.com/poolifier/poolifier-web-worker/commit/c4ec62b45dc86186ab652d00e75de180b918d579))

### ✨ Polish

- refine circular buffer API
  ([e31104e](https://github.com/poolifier/poolifier-web-worker/commit/e31104e6fdb87b6731a750ecddc667aeb4100c22))

### 📚 Documentation

- amend priority queue constructor comment
  ([54af2cd](https://github.com/poolifier/poolifier-web-worker/commit/54af2cd7a03b466955ec5d8f4c67902376ff341d))

## [0.5.12](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.11...v0.5.12) (2025-08-22)

### 🐞 Bug Fixes

- ensure destroy event has up2date pool info
  ([6ae415c](https://github.com/poolifier/poolifier-web-worker/commit/6ae415c8c8c01be3086ee881aa5daad3f132cd34))

### ✨ Polish

- make pool destroy() more robust
  ([74899b5](https://github.com/poolifier/poolifier-web-worker/commit/74899b5ffbbac0b382d071a64b53b0328a15e19e))

### 📚 Documentation

- refine some code comments
  ([c306ee8](https://github.com/poolifier/poolifier-web-worker/commit/c306ee83a69552e0b4ebbde8664c0965cde0f09d))

## [0.5.11](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.10...v0.5.11) (2025-08-21)

### 🐞 Bug Fixes

- properly account strategy retries on a per strategy basis
  ([98b3742](https://github.com/poolifier/poolifier-web-worker/commit/98b37420072677775c275538daa06e702a10ae89))

### ⚡ Performance

- reduce pool info property internal usage
  ([3c7ad6e](https://github.com/poolifier/poolifier-web-worker/commit/3c7ad6eea40e41eaacb9981b73b62453730d3f38))

## [0.5.10](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.9...v0.5.10) (2025-08-20)

### 🐞 Bug Fixes

- avoid starvation with task priority
  ([aaad1df](https://github.com/poolifier/poolifier-web-worker/commit/aaad1df37b45b03abb7b7761caeb0f5e101c8b6e))

### ✨ Polish

- add guard to priority queue delete()
  ([d681bdd](https://github.com/poolifier/poolifier-web-worker/commit/d681bddbe39995a7b85a6e6614c886a2634e0af1))
- flag fixed queue internal storage data structure readonly
  ([204465c](https://github.com/poolifier/poolifier-web-worker/commit/204465cb6a6e4b73d872c9cdb87f2e3bfee586b6))

### 📚 Documentation

- refine queueing code comment
  ([14a1b3a](https://github.com/poolifier/poolifier-web-worker/commit/14a1b3a88342f7aeb4509d8d81df718aef2f2e28))

## [0.5.9](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.8...v0.5.9) (2025-08-19)

### 🐞 Bug Fixes

- worker index identification at tasks stealing under back pressure
  ([bd5f61e](https://github.com/poolifier/poolifier-web-worker/commit/bd5f61e10dbce86afe37b9b6d62ca7a8e634ad03))

### ✨ Polish

- cleanup queuing code
  ([7433448](https://github.com/poolifier/poolifier-web-worker/commit/743344863f0353d636d68cfb408b6fee83f8d74e))
- cleanup worker selection strategies code
  ([2c17456](https://github.com/poolifier/poolifier-web-worker/commit/2c1745687f0ce499d3c455b81fbe195fa52ce326))

### 🤖 Automation

- **deps:** Bump actions/checkout from 4 to 5
  ([#96](https://github.com/poolifier/poolifier-web-worker/issues/96))
  ([eb494ea](https://github.com/poolifier/poolifier-web-worker/commit/eb494eafdda107d135cd0c963540c10d2a0bb693))

## [0.5.8](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.7...v0.5.8) (2025-07-28)

### 🐞 Bug Fixes

- worker specifier can be a string or an URL instance
  ([#95](https://github.com/poolifier/poolifier-web-worker/issues/95))
  ([e604297](https://github.com/poolifier/poolifier-web-worker/commit/e604297b55c80efcfac9e152296fe4b3c75e7762))

### ✨ Polish

- avoid delete usage
  ([f186842](https://github.com/poolifier/poolifier-web-worker/commit/f186842ec30dcaea961a3e817b2513ee3b470fff))

### 🤖 Automation

- **deps:** Bump sonarsource/sonarqube-scan-action from 5.2.0 to 5.3.0
  ([#93](https://github.com/poolifier/poolifier-web-worker/issues/93))
  ([78e6f7d](https://github.com/poolifier/poolifier-web-worker/commit/78e6f7db56110db463bdb580bd1da9653b730935))

## [0.5.7](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.6...v0.5.7) (2025-07-15)

### ✨ Polish

- add task entry to run tests in parallel
  ([fefb0fe](https://github.com/poolifier/poolifier-web-worker/commit/fefb0feb81b526c26e7fe4f904881e5503e150e7))
- **queue:** cleanup variables namespace
  ([654ed90](https://github.com/poolifier/poolifier-web-worker/commit/654ed906bef352a91bbc55c63aa59f1fdd65b99c))

### 🧪 Tests

- enlarge worker node events waiting timeout
  ([601bd13](https://github.com/poolifier/poolifier-web-worker/commit/601bd13874aa383cb843ff86cd964e0e6ade2f1d))
- ignore tests on linux generally
  ([08bcec6](https://github.com/poolifier/poolifier-web-worker/commit/08bcec6bf2d9158f2245b16d7e289bc095f084c7))
- refine task finished timeout
  ([17e0945](https://github.com/poolifier/poolifier-web-worker/commit/17e0945e1d501350389128ecf583501d91c7363d))

## [0.5.6](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.5...v0.5.6) (2025-07-10)

### ⚡ Performance

- avoid recursion in task queueing iterator
  ([4f2eb8f](https://github.com/poolifier/poolifier-web-worker/commit/4f2eb8f63d9779ccbda774425cdeb1654b6376d7))

### 🧪 Tests

- enlarge pool events timeout waiting
  ([462f362](https://github.com/poolifier/poolifier-web-worker/commit/462f362b367171d35b9eaa61dd476d1104cac65d))

## [0.5.5](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.4...v0.5.5) (2025-07-10)

### 🐞 Bug Fixes

- worker node destroy race condition at pool destroy
  ([d7947f2](https://github.com/poolifier/poolifier-web-worker/commit/d7947f2a16c010a9d148aa3b571b3e2e945a58f0))

### 🧪 Tests

- refine expectations
  ([85900ef](https://github.com/poolifier/poolifier-web-worker/commit/85900ef63b8b457e34a6e6986686e67611162c2a))
- refine pool destroy time expectation
  ([e576519](https://github.com/poolifier/poolifier-web-worker/commit/e5765196360b4961901c86db34b732c1be788486))

### 📚 Documentation

- comment spell fix
  ([e606020](https://github.com/poolifier/poolifier-web-worker/commit/e60602016af8b8022e6333209625ab43ceb30a8a))

## [0.5.4](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.3...v0.5.4) (2025-07-09)

### 🐞 Bug Fixes

- ensure dynamic worker can't be created at pool destroy
  ([bec7b83](https://github.com/poolifier/poolifier-web-worker/commit/bec7b83a4f09a24f77d2fded262d25adfa3df1a0))
- ensure worker kill message response is not handled by the generic listener
  ([5214130](https://github.com/poolifier/poolifier-web-worker/commit/5214130b550628c131da778d8afe62cf83d9426c))

### ✨ Polish

- add worker strategy name to help UTs debug
  ([e445aa7](https://github.com/poolifier/poolifier-web-worker/commit/e445aa7352f00a1ff195d531a07103a2c3887db5))
- cleanup task function ops method
  ([dcdb30a](https://github.com/poolifier/poolifier-web-worker/commit/dcdb30aad38938d792300b7300fd23ba39a935bf))
- improve messaging worker id check error message
  ([e1fbde5](https://github.com/poolifier/poolifier-web-worker/commit/e1fbde51b64d3b7de5c266ceb72b770331864404))
- refine waitWorkerNodeEvents() API
  ([41acf6b](https://github.com/poolifier/poolifier-web-worker/commit/41acf6bf39f1308f8609b3651b10a5f9b73091ed))

### 🧪 Tests

- add explainatory comment
  ([0776b29](https://github.com/poolifier/poolifier-web-worker/commit/0776b29e288d9286d0eee1f36d11ffad0eda9799))
- skip flaky test only the targeted OS
  ([5bd7a88](https://github.com/poolifier/poolifier-web-worker/commit/5bd7a88111681516f08e0071d512668957217aee))
- skip flaky tests on GH CI
  ([cbb7ee2](https://github.com/poolifier/poolifier-web-worker/commit/cbb7ee2745ae25c020d8af2dd46ac72be52d76b5))

## [0.5.3](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.2...v0.5.3) (2025-07-07)

### 🐞 Bug Fixes

- close potential event listeners leak
  ([28b194f](https://github.com/poolifier/poolifier-web-worker/commit/28b194f9b1032aa800d8fbecc49c3a12b8fb5b97))
- fix potential ressource leaks
  ([2551b77](https://github.com/poolifier/poolifier-web-worker/commit/2551b7752a3aa3f0180c8ae309031855df46a9b5))
- plug more ressource leaks
  ([57a26a3](https://github.com/poolifier/poolifier-web-worker/commit/57a26a3f9f636cdd6896cc0216931b9a09bf22a1))

### ✨ Polish

- cleanup priority queue code
  ([77b9118](https://github.com/poolifier/poolifier-web-worker/commit/77b9118b183da0e6223384ea6c5bab053cafa1e2))

## [0.5.2](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.1...v0.5.2) (2025-07-06)

### 🐞 Bug Fixes

- fix worker usage statistics computation
  ([aa63d3d](https://github.com/poolifier/poolifier-web-worker/commit/aa63d3d562e7097e4ce4c3c48390ce753e024f87))

### ✨ Polish

- align property deletion implementation
  ([2aed691](https://github.com/poolifier/poolifier-web-worker/commit/2aed691aba92fae847dbc3d1f8f1b8ddcdaaf6a5))

## [0.5.1](https://github.com/poolifier/poolifier-web-worker/compare/v0.5.0...v0.5.1) (2025-07-06)

### 🐞 Bug Fixes

- tasks queuing fixes
  ([#83](https://github.com/poolifier/poolifier-web-worker/issues/83))
  ([8c46b36](https://github.com/poolifier/poolifier-web-worker/commit/8c46b36b4c8ede097ee85b86a2a5555a5e0b1fcf))

### 🧪 Tests

- unignore GNU/Linux
  ([956a156](https://github.com/poolifier/poolifier-web-worker/commit/956a15674423586369e4a8b3aedc3c0a0e460770))

### 📚 Documentation

- tasks distribution refinements
  ([cc299fb](https://github.com/poolifier/poolifier-web-worker/commit/cc299fbf534f3f5fdc85bda992b38a754bbb53d0))
- **worker-choice-strategies.md:** formatting
  ([6fc2246](https://github.com/poolifier/poolifier-web-worker/commit/6fc2246dc167ae0e6ebef8fa5ca6bfacfdd30e59))

## [0.5.0](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.31...v0.5.0) (2025-07-02)

### ⚠ BREAKING CHANGES

- add abortable task support
  ([#81](https://github.com/poolifier/poolifier-web-worker/issues/81))

### 🚀 Features

- add abortable task support
  ([#81](https://github.com/poolifier/poolifier-web-worker/issues/81))
  ([7ff05c6](https://github.com/poolifier/poolifier-web-worker/commit/7ff05c60f4f350191f70e1de8fd596e136ab9872))

### ✨ Polish

- cleanup JS runtime detection code
  ([b366f0e](https://github.com/poolifier/poolifier-web-worker/commit/b366f0ecdc5e34a5942c73dd04ea8c9b1619e2a6))
- factor out worker info initialization
  ([4d9c6a4](https://github.com/poolifier/poolifier-web-worker/commit/4d9c6a486313883a80f1694ac280eaa55379bf6a))
- flag some object literals as read only
  ([5d006d9](https://github.com/poolifier/poolifier-web-worker/commit/5d006d91350be07e369bd526d8732bfa5baf742b))
- flag strategy policy property as read only
  ([5eeb19e](https://github.com/poolifier/poolifier-web-worker/commit/5eeb19ec2f269f466ad03db7e27e08e1e0165ac9))
- migrate to @std/expect
  ([#73](https://github.com/poolifier/poolifier-web-worker/issues/73))
  ([459c2f9](https://github.com/poolifier/poolifier-web-worker/commit/459c2f9307928971520a63d99ac17f7ca1b59647))
- refine browser JS runtime detection
  ([a545ddd](https://github.com/poolifier/poolifier-web-worker/commit/a545ddd26bfd577ea28dd4dd4b4c0236138b5a60))

### 🧪 Tests

- remove unneeded Linux ignore
  ([4fd41ee](https://github.com/poolifier/poolifier-web-worker/commit/4fd41ee03fe16c848990c37c754be9aa69f7d2c1))

### 🤖 Automation

- **deps:** Bump autofix-ci/action
  ([#75](https://github.com/poolifier/poolifier-web-worker/issues/75))
  ([037bdf4](https://github.com/poolifier/poolifier-web-worker/commit/037bdf42f865009caa433f11a478828a0ffdadc8))
- **deps:** Bump autofix-ci/action
  ([#79](https://github.com/poolifier/poolifier-web-worker/issues/79))
  ([f1f8bac](https://github.com/poolifier/poolifier-web-worker/commit/f1f8bac189c68074316a06e261c05a35e21ac2bd))
- **deps:** Bump sonarsource/sonarqube-scan-action from 4.1.0 to 4.2.1
  ([#77](https://github.com/poolifier/poolifier-web-worker/issues/77))
  ([00216f4](https://github.com/poolifier/poolifier-web-worker/commit/00216f46c37c05a28c0a2299774e030270aead74))
- **deps:** Bump sonarsource/sonarqube-scan-action from 4.2.1 to 5.2.0
  ([#80](https://github.com/poolifier/poolifier-web-worker/issues/80))
  ([5f0ca95](https://github.com/poolifier/poolifier-web-worker/commit/5f0ca95d3407d6b548aaee52992c0d6aee0417de))

## [0.4.31](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.30...v0.4.31) (2024-10-26)

### ⚡ Performance

- use micro tasks in tasks handling code paths
  ([8abd0c2](https://github.com/poolifier/poolifier-web-worker/commit/8abd0c2e33accfc1572901c0c20cbbde4e85f531))

### 🧪 Tests

- refine worker error handling expectation
  ([dbc6f71](https://github.com/poolifier/poolifier-web-worker/commit/dbc6f711610aa73edd14b85a041d7d2c3fd4ede0))

## [0.4.30](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.29...v0.4.30) (2024-10-24)

### 🐞 Bug Fixes

- ensure error on the worker side is propagated unchanged to main
  ([22804e0](https://github.com/poolifier/poolifier-web-worker/commit/22804e0626aee9ead4282b711326883e56b9d796))

### ⚡ Performance

- speed up isAsyncFunction() helper
  ([8d451ae](https://github.com/poolifier/poolifier-web-worker/commit/8d451ae2199634b0aaff0ee0f9952730d01e7ce3))

### ✨ Polish

- silence tsc error
  ([2b678f8](https://github.com/poolifier/poolifier-web-worker/commit/2b678f804f067387231909fd481569d86f74d2c2))

### 🤖 Automation

- **ci:** fix deno.json formatting
  ([83a3f4c](https://github.com/poolifier/poolifier-web-worker/commit/83a3f4ccce7c8fdaff9e1b5defa6f7bbc93a6b66))
- **ci:** handle various release type on npm registry
  ([9ab41fe](https://github.com/poolifier/poolifier-web-worker/commit/9ab41feae0119d107c9528fabaacbce5ac9b3281))

## [0.4.29](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.28...v0.4.29) (2024-10-14)

### ⚡ Performance

- pre-create worker if needed at the end of task execution
  ([cd7406c](https://github.com/poolifier/poolifier-web-worker/commit/cd7406cafa5367f6157ef373b7f9539f0ba1e8d4))

### 📚 Documentation

- **README.md:** revert reformatting
  ([5561f4e](https://github.com/poolifier/poolifier-web-worker/commit/5561f4ee5be32274368df4f510f7cfed19fc3411))

### 🤖 Automation

- **deps:** Bump github/combine-prs from 5.1.0 to 5.2.0
  ([3412820](https://github.com/poolifier/poolifier-web-worker/commit/341282043d9352054fcf0ad9c43b34745d4da164))

## [0.4.28](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.27...v0.4.28) (2024-10-09)

### 🚀 Features

- add deno 2.x.x support
  ([47dfca2](https://github.com/poolifier/poolifier-web-worker/commit/47dfca2a5f2db11cac95fb51298e6731e6cfb60e))
- **benchmarks:** add bencher threshold checks
  ([a0010ee](https://github.com/poolifier/poolifier-web-worker/commit/a0010ee454572f1487e270da8ff3a569b1d2a5ab))

### 🐞 Bug Fixes

- **benchmarks:** add upper/lower values to BMF throughput
  ([d5ccee0](https://github.com/poolifier/poolifier-web-worker/commit/d5ccee0843c552153761f402d040908c4b8e1295))
- **benchmarks:** fix BMF report upper/lower values
  ([c352783](https://github.com/poolifier/poolifier-web-worker/commit/c352783ecff743dc86649f02030be25fbef9e20c))
- fix benchmarks report conversion to BMF format
  ([9d39cfe](https://github.com/poolifier/poolifier-web-worker/commit/9d39cfee5c200e176bcc5ce65fa79dd21ba3844f))

### ✨ Polish

- **benchmarks:** cleanup JS runtime detection code
  ([8bd7fa6](https://github.com/poolifier/poolifier-web-worker/commit/8bd7fa6277633047de2b10628c9cab2d2450179e))
- cleanup multiple JS runtime support implementation
  ([ca64e63](https://github.com/poolifier/poolifier-web-worker/commit/ca64e63d6768eb55d234a375fc8c2a88337a5f8f))
- cleanup task function ops validation
  ([766352d](https://github.com/poolifier/poolifier-web-worker/commit/766352d6396c7da5ade57f07514d5c57126febe8))

### 🤖 Automation

- **ci:** add deno 2.x.x RC
  ([a4c218d](https://github.com/poolifier/poolifier-web-worker/commit/a4c218dded5d1b8aaf409cbe8d9b4060ef1a5f7d))
- **ci:** revert deno 2.x.x integration
  ([d0bf8a9](https://github.com/poolifier/poolifier-web-worker/commit/d0bf8a92a40cd8883e133f5d289a1b14eca4660a))
- **ci:** switch to deno v2.x.x
  ([17e3705](https://github.com/poolifier/poolifier-web-worker/commit/17e3705be88b6996427a3cef7a1201c3dfd9c7f3))
- **deps:** Bump sonarsource/sonarcloud-github-action
  ([#68](https://github.com/poolifier/poolifier-web-worker/issues/68))
  ([29df0a7](https://github.com/poolifier/poolifier-web-worker/commit/29df0a7a94e85ba2b4d724189701d83701e64e08))

## [0.4.27](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.26...v0.4.27) (2024-09-08)

### ⚡ Performance

- track dynamic pool `empty` event lifecycle
  ([1c82a75](https://github.com/poolifier/poolifier-web-worker/commit/1c82a75057c8ec28327bffb5a88e71bb601381b5))

### ✨ Polish

- add dynamic worker nodes count to pool info
  ([27f1bca](https://github.com/poolifier/poolifier-web-worker/commit/27f1bcac4df2d3c2fc4100b43f2e0b3c96d70c76))

### 🧪 Tests

- refine dynamic pool shutdown test expectations
  ([4562a61](https://github.com/poolifier/poolifier-web-worker/commit/4562a61f8f50a2d0af0dc28c1a81fccb4e8e5617))

### 🤖 Automation

- **sonar:** refine sonar-project.properties
  ([e43d3d8](https://github.com/poolifier/poolifier-web-worker/commit/e43d3d833eb2e069d2c0b08b265a934c8f07486f))
- **sonar:** refine sonar-project.properties
  ([893e2a0](https://github.com/poolifier/poolifier-web-worker/commit/893e2a0738f14ecac932712038982f24eb137210))

## [0.4.26](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.25...v0.4.26) (2024-09-06)

### ⚡ Performance

- optimize backpressure task(s) stealing conditions
  ([75ddbb8](https://github.com/poolifier/poolifier-web-worker/commit/75ddbb89038ca0df1a05a4879ebde041dcaee97f))

### ✨ Polish

- add `isWorkerNodeStealing()` helper
  ([508b201](https://github.com/poolifier/poolifier-web-worker/commit/508b2015bba43e2019b0d2aadca1eaa468609295))
- factor out stealing ratio conditions check into an helper
  ([17369b6](https://github.com/poolifier/poolifier-web-worker/commit/17369b636797daff75a1a14e4a3a8d8451b5fabd))

### 🧪 Tests

- cleanup error handling expectations
  ([ecf101e](https://github.com/poolifier/poolifier-web-worker/commit/ecf101edc4ffecb34e316c4a74b5e36bc85d27e6))

## [0.4.25](https://github.com/poolifier/poolifier-web-worker/compare/v0.4.24...v0.4.25) (2024-08-30)

### 🐞 Bug Fixes

- handle properly small or zero `tasksStealingRatio`
  ([ab6e570](https://github.com/poolifier/poolifier-web-worker/commit/ab6e5700b536a70bdef6accd66fce91f5e45cd69))

### ✨ Polish

- move dynamic pool only getters to its own class
  ([74970f2](https://github.com/poolifier/poolifier-web-worker/commit/74970f25d771c43eac26feb891305da0d73ba1b6))

### 🧪 Tests

- fix variable casing
  ([a2727d7](https://github.com/poolifier/poolifier-web-worker/commit/a2727d7cea305b374232aa221698383c49d6d2b0))
- refine pool event tests expectation
  ([5bdf99a](https://github.com/poolifier/poolifier-web-worker/commit/5bdf99a7019550759e1ee369846eda83f049c4ef))

### 📚 Documentation

- cleanup code examples
  ([28b119c](https://github.com/poolifier/poolifier-web-worker/commit/28b119c8bd08596863f44de4c4712963c5a6a8fc))
- refine pool ready event emission condition
  ([e7d0673](https://github.com/poolifier/poolifier-web-worker/commit/e7d0673f97e9302844aed9e7d7f1e6c5273ecbc3))
- switch examples to top level await usage (ESM)
  ([30781c3](https://github.com/poolifier/poolifier-web-worker/commit/30781c30f374e0e7585c5957ef9956e2c4851106))

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
