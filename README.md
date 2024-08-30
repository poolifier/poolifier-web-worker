<div align="center">
  <img src="https://raw.githubusercontent.com/poolifier/poolifier/master/images/logo.png" width="340px" height="266px"/>
</div>

<div align="center">

# Deno, Bun and browser Web Worker Pool

</div>

<div align="center">

[![GitHub commit activity (master)](https://img.shields.io/github/commit-activity/m/poolifier/poolifier-web-worker/master?color=brightgreen&logo=github)](https://github.com/poolifier/poolifier-web-worker/graphs/commit-activity)
[![CI Workflow](https://github.com/poolifier/poolifier-web-worker/actions/workflows/ci.yml/badge.svg)](https://github.com/poolifier/poolifier-web-worker/actions/workflows/ci.yml)
[![Code Coverage](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=coverage)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=alert_status)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
[![Npm Version](https://badgen.net/npm/v/poolifier-web-worker?icon=npm)](https://www.npmjs.com/package/poolifier-web-worker)
[![JSR Version](https://jsr.io/badges/@poolifier/poolifier-web-worker)](https://jsr.io/@poolifier/poolifier-web-worker)
[![neostandard Javascript Code Style](<https://badgen.net/static/code style/neostandard/green>)](https://github.com/neostandard/neostandard)
[![Discord](https://badgen.net/discord/online-members/vXxZhyb3b6?icon=discord&label=discord&color=green)](https://discord.gg/vXxZhyb3b6)
[![Open Collective](https://opencollective.com/poolifier/tiers/badge.svg)](https://opencollective.com/poolifier)
[![PRs Welcome](https://badgen.net/static/PRs/welcome/green)](https://makeapullrequest.com)
[![No Dependencies](<https://badgen.net/static/dependencies/no dependencies/green>)](https://badgen.net/static/dependencies/nodependencies/green)

</div>

## Why Poolifier?

Poolifier is used to perform CPU and/or I/O intensive tasks on Deno, Bun or
browser, it implements worker pools using
[web worker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
module.\
With poolifier you can improve your **performance** and resolve problems related
to the event loop.\
Moreover you can execute your tasks using an API designed to improve the
**developer experience**.\
Please consult our [general guidelines](#general-guidelines).

- Easy to use ✔
- Fixed and dynamic pool size ✔
- Easy switch from a pool type to another ✔
- Performance
  [benchmarks](https://github.com/poolifier/poolifier-web-worker/blob/master/benchmarks/README.md)
  ✔
- Zero cost abstraction for multiple JS runtime support ✔
- No runtime dependencies ✔
- Support for ESM and TypeScript ✔
- Support for
  [web worker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
  module ✔
- Tasks distribution strategies ✔
- Lockless tasks queueing ✔
- Queued tasks rescheduling:
  - Task stealing on idle ✔
  - Tasks stealing under back pressure ✔
  - Tasks redistribution on worker error ✔
- Support for sync and async task function ✔
- Support for multiple task functions with per task function queuing priority
  and tasks distribution strategy ✔
- Support for task functions
  [CRUD](https://en.wikipedia.org/wiki/Create,_read,_update_and_delete)
  operations at runtime ✔
- General guidelines on pool choice ✔
- Error handling out of the box ✔
- Widely tested ✔
- Active community ✔
- Code quality
  [![Bugs](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=bugs)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
  [![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=code_smells)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
  [![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=duplicated_lines_density)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
  [![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=sqale_rating)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
  [![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
  [![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=sqale_index)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
- Code security
  [![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=security_rating)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)
  [![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=poolifier_poolifier-web-worker&metric=vulnerabilities)](https://sonarcloud.io/dashboard?id=poolifier_poolifier-web-worker)

## Table of contents

- [Overview](#overview)
- [Usage](#usage)
  - [Deno](#deno)
  - [Bun](#bun)
  - [Browser](#browser)
  - [Example code](#example-code)
- [Deno and Bun versions](#deno-and-bun-versions)
- [API](#api)
- [General guidelines](#general-guidelines)
- [Worker choice strategies](#worker-choice-strategies)
- [Contribute](#contribute)
- [Team](#team)
- [License](#license)

## Overview

Poolifier contains
[web worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker)
pool implementation, you don't have to deal with
[web worker API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
complexity.\
The first implementation is a fixed worker pool, with a defined number of
workers that are started at creation time and will be reused.\
The second implementation is a dynamic worker pool, with a number of worker
started at creation time (these workers will be always active and reused) and
other workers created when the load will increase (with an upper limit, these
workers will be reused when active), the newly created workers will be stopped
after a configurable period of inactivity.\
You have to implement your worker by extending the _ThreadWorker_ class.

## Usage

### Deno

```shell
deno add @poolifier/poolifier-web-worker
```

**See
[Deno examples](https://github.com/poolifier/poolifier-web-worker/blob/master/examples/deno/)
for more details**:

- [Javascript](https://github.com/poolifier/poolifier-web-worker/blob/master/examples/deno/javascript/)
- [Typescript](https://github.com/poolifier/poolifier-web-worker/blob/master/examples/deno/typescript/)

### Bun

#### npmjs

```shell
bun add poolifier-web-worker
```

#### JSR

```shell
bunx jsr add @poolifier/poolifier-web-worker
```

**See
[Bun examples](https://github.com/poolifier/poolifier-web-worker/blob/master/examples/bun/)
for more details**:

- [Typescript](https://github.com/poolifier/poolifier-web-worker/blob/master/examples/bun/typescript/)

### Browser

<!-- x-release-please-start-version -->
<!-- deno-fmt-ignore -->

```js
<script type="module">import { ThreadWorker } from 'https://cdn.jsdelivr.net/npm/poolifier-web-worker@0.4.25/browser/mod.js'</script>
```

```js
<script type="module">
import {
  availableParallelism,
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
} from 'https://cdn.jsdelivr.net/npm/poolifier-web-worker@0.4.25/browser/mod.js'
</script>
```

<!-- x-release-please-end -->

### Example code

You can implement a poolifier
[web worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker) in
a simple way by extending the class _ThreadWorker_:

```js
// adapt import to the targeted JS runtime
import { ThreadWorker } from '@poolifier/poolifier-web-worker'

function yourFunction(data) {
  // this will be executed in the worker thread,
  // the data will be received by using the execute method
  return { ok: 1 }
}

export default new ThreadWorker(yourFunction, {
  maxInactiveTime: 60000,
})
```

Instantiate your pool based on your needs :

```js
// adapt import to the targeted JS runtime
import {
  availableParallelism,
  DynamicThreadPool,
  FixedThreadPool,
  PoolEvents,
} from '@poolifier/poolifier-web-worker'

// a fixed web worker pool
const pool = new FixedThreadPool(
  availableParallelism(),
  new URL('./yourWorker.js', import.meta.url),
  {
    errorEventHandler: (e) => {
      console.error(e)
    },
  },
)

pool.eventTarget?.addEventListener(
  PoolEvents.ready,
  () => console.info('Pool is ready'),
)
pool.eventTarget?.addEventListener(
  PoolEvents.busy,
  () => console.info('Pool is busy'),
)

// or a dynamic web worker pool
const pool = new DynamicThreadPool(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  new URL('./yourWorker.js', import.meta.url),
  {
    errorEventHandler: (e) => {
      console.error(e)
    },
  },
)

pool.eventTarget?.addEventListener(
  PoolEvents.full,
  () => console.info('Pool is full'),
)
pool.eventTarget?.addEventListener(
  PoolEvents.ready,
  () => console.info('Pool is ready'),
)
pool.eventTarget?.addEventListener(
  PoolEvents.busy,
  () => console.info('Pool is busy'),
)

// the execute method signature is the same for both implementations,
// so you can easily switch from one to another
try {
  const res = await pool.execute()
  console.info(res)
} catch (err) {
  console.error(err)
}
```

Remember that workers can only send and receive structured-cloneable data.

## Deno and Bun versions

- Deno versions >= 1.40.x are supported.
- Bun versions >= 1.x are supported.

## [API](https://github.com/poolifier/poolifier-web-worker/blob/master/docs/api.md)

## [General guidelines](https://github.com/poolifier/poolifier-web-worker/blob/master/docs/general-guidelines.md)

## [Worker choice strategies](https://github.com/poolifier/poolifier-web-worker/blob/master/docs/worker-choice-strategies.md)

## Contribute

Choose your task [here](https://github.com/orgs/poolifier/projects/1), propose
an idea, a fix, an improvement.

See
[CONTRIBUTING](https://github.com/poolifier/poolifier-web-worker/blob/master/CONTRIBUTING.md)
guidelines.

## Team

**Creator/Owner:**

- [**Alessandro Pio Ardizio**](https://github.com/pioardi)

**Maintainers:**

- [**Jérôme Benoit**](https://github.com/jerome-benoit)

**Contributors:**

- [**Shinigami92**](https://github.com/Shinigami92)

## License

[MIT](./LICENSE)
