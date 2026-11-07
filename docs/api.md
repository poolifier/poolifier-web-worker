# [API](https://jsr.io/@poolifier/poolifier-web-worker/doc)

## Table of contents

- [Pool](#pool)
  - [`pool = new FixedThreadPool(numberOfThreads, specifier, opts)`](#pool--new-fixedthreadpoolnumberofthreads-specifier-opts)
  - [`pool = new DynamicThreadPool(min, max, specifier, opts)`](#pool--new-dynamicthreadpoolmin-max-specifier-opts)
  - [`pool.execute(data, name, abortSignal, transferList)`](#poolexecutedata-name-abortsignal-transferlist)
  - [`pool.mapExecute(data, name, abortSignals, transferList)`](#poolmapexecutedata-name-abortsignals-transferlist)
  - [`pool.start()`](#poolstart)
  - [`pool.destroy()`](#pooldestroy)
  - [`pool.hasTaskFunction(name)`](#poolhastaskfunctionname)
  - [`pool.addTaskFunction(name, fn)`](#pooladdtaskfunctionname-fn)
  - [`pool.removeTaskFunction(name)`](#poolremovetaskfunctionname)
  - [`pool.listTaskFunctionsProperties()`](#poollisttaskfunctionsproperties)
  - [`pool.setDefaultTaskFunction(name)`](#poolsetdefaulttaskfunctionname)
  - [Pool options](#pool-options)
- [Worker](#worker)
  - [`class YourWorker extends ThreadWorker`](#class-yourworker-extends-threadworker)
    - [`YourWorker.hasTaskFunction(name)`](#yourworkerhastaskfunctionname)
    - [`YourWorker.addTaskFunction(name, fn)`](#yourworkeraddtaskfunctionname-fn)
    - [`YourWorker.removeTaskFunction(name)`](#yourworkerremovetaskfunctionname)
    - [`YourWorker.listTaskFunctionsProperties()`](#yourworkerlisttaskfunctionsproperties)
    - [`YourWorker.setDefaultTaskFunction(name)`](#yourworkersetdefaulttaskfunctionname)

## Pool

### `pool = new FixedThreadPool(numberOfThreads, specifier, opts)`

`numberOfThreads` (mandatory) Number of workers for this pool.\
`specifier` (mandatory) Specifier to a file with a worker implementation.\
`opts` (optional) An object with the pool options properties described below.

### `pool = new DynamicThreadPool(min, max, specifier, opts)`

`min` (mandatory) Same as _FixedThreadPool_ numberOfThreads, this number of
workers will be always active.\
`max` (mandatory) Max number of workers that this pool can contain, the newly
created workers will die after a threshold (default is 1 minute, you can
override it in your worker implementation).\
`specifier` (mandatory) Specifier to a file with a worker implementation.\
`opts` (optional) An object with the pool options properties described below.

### `pool.execute(data, name, abortSignal, transferList)`

`data` (optional) An object that you want to pass to your worker task function
implementation.\
`name` (optional) A string with the task function name that you want to execute
on the worker. Default: `'default'`\
`abortSignal` (optional) An abort signal to abort the task function execution.\
`transferList` (optional) An array of transferable objects that you want to
transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworker)
implementation. The array is copied when this method is called; later changes do
not affect submission. An empty array is treated as no transfer list.

This method is available on both pool implementations and returns a promise with
the task function execution response.

#### Task failures

- If sending a task throws, its promise rejects with the original error, without
  failing other tasks.
- On a native worker error or an unexpected worker close notification,
  unfinished dispatched tasks reject with an `Error` and are not retried.
  Responses already received by the pool retain their result or task error.
- Queued tasks are redistributed to ready workers respecting worker node
  affinity, including while other workers initialize. Affinity uses current
  worker node indices after removal and any replacement attempt. Tasks without
  an eligible destination reject.
- Eligible handoffs complete before `backPressureEnd` is emitted, including when
  worker-removal event listeners disable task queues. Disabling queues from such
  a listener dispatches eligible detached tasks directly instead of discarding
  them.
- Aborted tasks reject with the original abort reason if it is an `Error`, a new
  `Error` with that message if it is a string, or a task-specific abort `Error`
  otherwise. This applies before dispatch, while queued and while executing.
- An already-aborted signal rejects before worker selection, queuing or transfer
  of input data.
- Native worker failures without an `Error` payload are wrapped in an `Error`
  using the native error message and the original payload as `cause`. The pool's
  `error` event exposes that `Error`.
- Failure to construct a replacement worker does not prevent task settlement;
  the construction error still propagates.
- Without transfers, task errors retain cloneable worker-side input data in the
  `taskError` event, including worker mutations.
- With a nonempty transfer list, `taskError.data` is the original input object.
  This does not transfer ownership back; its transferred objects remain owned by
  the worker. Raw worker error messages omit transferred input data.
- A task error that cannot be reported causes an unexpected worker failure.
  Unfinished tasks then follow the failure rules above.

Intentional pool or worker termination alone does not guarantee rejection of
unfinished tasks. Worker errors during termination still follow the failure
rules. Bun provides a native worker close notification. The standard Web Worker
API used by Deno and browsers has no exit notification: a worker that silently
closes without an error cannot be detected. Deno and Bun preserve buffered task
responses and task-function operation results sent before an observed unexpected
exit, using their native synchronous port receiver. Exit consumers run before
the private channel closes. Browsers have no standard synchronous port receiver:
only responses already delivered to the pool retain their result. No browser
queue-drain guarantee applies.

### `pool.mapExecute(data, name, abortSignals, transferList)`

`data` An iterable of objects that you want to pass to your worker task function
implementation.\
`name` (optional) A string with the task function name that you want to execute
on the worker. Default: `'default'`\
`abortSignals` (optional) An iterable of AbortSignal to abort the matching
object task function execution.\
`transferList` (optional) An array of transferable objects that you want to
transfer to your [`ThreadWorker`](#class-yourworker-extends-threadworker))
worker implementation.

This method is available on both pool implementations and returns a promise with
the task function execution responses array.

Task failures follow the same rules as [`pool.execute()`](#task-failures).

Signal iterables are consumed once and validated before dispatch. They must
contain one `AbortSignal` per input item.

The transfer list uses one array snapshot for the batch. Later caller mutations
do not change queued tasks or transfer ownership before dispatch.

### `pool.start()`

This method is available on both pool implementations and will start the minimum
number of workers.

### `pool.destroy()`

This method is available on both pool implementations and returns a promise for
pool destruction. Workers already removed after failure do not block
destruction.

The pool waits up to 1000 milliseconds for each worker to confirm cleanup before
terminating it. Cleanup failure or timeout does not prevent termination;
unfinished cleanup can be interrupted. Reported cleanup failures emit the pool's
`error` event when events are enabled. This timeout does not bound total pool
destruction time.

### `pool.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean.

### `pool.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.\
`fn` (mandatory) The task function
`(data?: Data) => Response | PromiseLike<Response>` or task function object
`{ taskFunction: (data?: Data) => Response | PromiseLike<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }`.
Priority range is the same as Unix nice levels. `workerNodeKeys` is an array of
worker node keys to restrict task execution to specific workers (worker node
affinity).

#### Worker Node Affinity Notes

- Worker node keys are validated at registration time against the pool's maximum
  size (`maximumNumberOfWorkers ?? minimumNumberOfWorkers`).
- The number of worker node keys cannot exceed the pool's maximum size
  (`maximumNumberOfWorkers ?? minimumNumberOfWorkers`).
- In dynamic pools, you can reference worker node keys up to the maximum pool
  size. Workers that don't exist yet are automatically created when a task
  targeting them is executed.
- At execution time, submissions wait for eligible workers restoring runtime
  task functions. Initialization failures on ineligible workers do not reject
  waiting tasks. Otherwise selection retries until a worker becomes available or
  retries are exhausted.
- Task stealing ignores worker node affinity, both on idle and under back
  pressure. For strict placement, disable both `taskStealing` and
  `tasksStealingOnBackPressure`. Initial worker selection and failure
  redistribution still respect affinity.

This method is available on both pool implementations and returns a boolean
promise.

The function definition and its options, including the affinity array, are
captured when this method is called. Later changes to the supplied definition do
not alter pending registrations or their replay on replacement workers.

Functions registered through this method are installed on newly created workers,
including replacements for fixed and minimum workers.

Pool-wide calls to `addTaskFunction()`, `removeTaskFunction()` and
`setDefaultTaskFunction()` run in call order. A rejected call does not prevent
later calls or undo changes already applied to workers.

Workers contacted by a change must respond or exit before the call settles,
including when a later send fails. Send failures preserve the original error;
otherwise, at least one accepted response is required and any other failed
response rejects the change. Without a send failure, an unanswered target's exit
does not reject a change with a successful peer, including synchronous exits
from protected dispatch hooks. All targets exiting unanswered rejects the
change. Deno and Bun preserve buffered operation results before an observed
unexpected exit; browsers preserve only already-delivered results.

New and replacement workers wait for ongoing task function changes. They accept
tasks only after restoring successfully registered task functions, the selected
default and scheduling options. Workers being terminated remain unavailable.
Replay remains bound to its original worker when protected listener-registration
hooks synchronously retire or reindex worker nodes.

Successful calls resolve only after a restoration attempt completes for workers
whose initialization failed. If restoration fails again, the change still
succeeds, the worker remains unavailable, and the pool emits `error` when events
are enabled.

Custom worker subclasses that defer task function operations must echo the
request's `taskFunctionOperationId` in their acknowledgement, or retain the
original `taskFunctionProperties` object when using the standard transport.
Preserve result metadata when forwarding acknowledgements. An acknowledgement
without a recoverable UUID rejects the operation. Pool-wide changes still wait
for all contacted workers to respond or exit. Status-only overrides that discard
this correlation must be updated. Deno and Bun preserve incoming asynchronous
context; browsers preserve only synchronous context. Deferred browser handlers
must retain the UUID or original properties object.

### `pool.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean
promise.

For workers whose initialization failed, confirmed absence of the requested
function also counts as successful removal. Other removal errors still reject
the call.

### `pool.listTaskFunctionsProperties()`

This method is available on both pool implementations and returns an array of
the task function properties.

### `pool.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both pool implementations and returns a boolean
promise.

The last successfully acknowledged explicit default survives replacement and
pool restart. With no workers, this method resolves to `true` without changing
the default selection. A successful removal of that runtime function clears the
selection; a failed removal does not.

### Pool options

An object with these properties:

- `messageEventHandler` (optional) - A function that will listen for message
  event on each worker.\
  Default: `() => {}`
- `messageEventErrorHandler` (optional) - A function that will listen for
  message event processing error on each worker.\
  Default: `() => {}`
- `errorEventHandler?` (optional) - A function that will listen for error event
  on each worker.\
  Default: `() => {}`

- `workerChoiceStrategy` (optional) - The default worker choice strategy to use
  in this pool:
  - `WorkerChoiceStrategies.ROUND_ROBIN`: Submit tasks to worker in a round
    robin fashion
  - `WorkerChoiceStrategies.LEAST_USED`: Submit tasks to the worker with the
    minimum number of executing and queued tasks
  - `WorkerChoiceStrategies.LEAST_BUSY`: Submit tasks to the worker with the
    minimum tasks execution time
  <!-- - `WorkerChoiceStrategies.LEAST_ELU`: Submit tasks to the worker with the
    minimum event loop utilization (ELU) -->
  - `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`: Submit tasks to worker by
    using a
    [weighted round robin scheduling algorithm](./worker-choice-strategies.md#weighted-round-robin)
    based on tasks execution time
  - `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN`: Submit tasks to
    worker by using an
    [interleaved weighted round robin scheduling algorithm](./worker-choice-strategies.md#interleaved-weighted-round-robin-experimental)
    based on tasks execution time (experimental)
  - `WorkerChoiceStrategies.FAIR_SHARE`: Submit tasks to worker by using a
    [fair share scheduling algorithm](./worker-choice-strategies.md#fair-share)
    based on tasks execution time (the default) <!-- or ELU active time  -->

  `WorkerChoiceStrategies.WEIGHTED_ROUND_ROBIN`,
  `WorkerChoiceStrategies.INTERLEAVED_WEIGHTED_ROUND_ROBIN` and
  `WorkerChoiceStrategies.FAIR_SHARE` strategies are targeted to heavy and long
  tasks.\
  Default: `WorkerChoiceStrategies.LEAST_USED`

- `workerChoiceStrategyOptions` (optional) - The worker choice strategy options
  object to use in this pool.\
  Properties:
  - `measurement` (optional) - The measurement to use in worker choice
    strategies: `runTime`, `waitTime` <!-- or `elu`. -->
  - `runTime` (optional) - Use the tasks
    [simple moving median](./worker-choice-strategies.md#simple-moving-median)
    runtime instead of the tasks simple moving average runtime in worker choice
    strategies.
  - `waitTime` (optional) - Use the tasks
    [simple moving median](./worker-choice-strategies.md#simple-moving-median)
    wait time instead of the tasks simple moving average wait time in worker
    choice strategies.
  <!-- - `elu` (optional) - Use the tasks
    [simple moving median](./worker-choice-strategies.md#simple-moving-median)
    ELU instead of the tasks simple moving average ELU in worker choice
    strategies. -->
  - `weights` (optional) - The worker weights to use in weighted round robin
    worker choice strategies: `Record<number, number>`.

  Default: `{ runTime: { median: false }, waitTime: { median: false } }`
  <!-- `{ runTime: { median: false }, waitTime: { median: false }, elu: { median: false } }` -->

  Importing the public API in Deno does not require environment or system
  permissions. Computing default weights requires `--allow-sys=cpus`; supplying
  explicit weights avoids reading CPU information.

- `startWorkers` (optional) - Start the minimum number of workers at pool
  initialization.\
  Default: `true`
- `restartWorkerOnError` (optional) - Restart worker on uncaught error in this
  pool.\
  Default: `true`
- `enableEvents` (optional) - Pool events emission enablement.\
  Default: `true`
- `enableTasksQueue` (optional) - Tasks queue per worker enablement in this
  pool.\
  Default: `false`

- `tasksQueueOptions` (optional) - The worker tasks queue options object to use
  in this pool.\
  Properties:
  - `size` (optional) - The maximum number of tasks that can be queued on a
    worker before flagging it as back pressured. It must be a positive integer.
  - `concurrency` (optional) - The maximum number of tasks that can be executed
    concurrently on a worker. It must be a positive integer.
  - `taskStealing` (optional) - Task stealing enablement on idle, including
    workers that have not executed a task. Queued work and worker readiness
    activate stealing after a short delay. Delayed stealing retries follow the
    original worker when worker node indices shift and stop when stealing is
    disabled, that worker leaves the pool or the pool is destroyed.
  - `tasksStealingOnBackPressure` (optional) - Tasks stealing enablement under
    back pressure.
  - `tasksStealingRatio` (optional) - The ratio of worker nodes that can steal
    tasks from another worker node. It must be a number between 0 and 1.
  - `tasksFinishedTimeout` (optional) - Queued tasks finished timeout in
    milliseconds at worker termination.
  - `agingFactor` (optional) - Aging factor for priority queue anti-starvation
    mechanism. It must be a positive number.
  - `loadExponent` (optional) - Load exponent for priority queue anti-starvation
    mechanism. It must be a positive number.

  Default:
  `{ size: (pool maximum size)^2, concurrency: 1, taskStealing: true, tasksStealingOnBackPressure: true, tasksStealingRatio: 0.6, tasksFinishedTimeout: 2000, agingFactor: 0.001, loadExponent: 0.667 }`

- `workerOptions` (optional) - An object with the worker options to pass to
  worker. See
  [web worker](https://developer.mozilla.org/en-US/docs/Web/API/Worker/Worker#options)
  for more details.\
  Default:
  - Deno: `{ type: 'module' }`
  - Bun: `{ type: 'module', smol: true }`
  - Browser: `{ type: 'module' }`

## Worker

### `class YourWorker extends ThreadWorker`

`taskFunctions` (mandatory) The task function or task functions object
`Record<string, (data?: Data) => Response | PromiseLike<Response> | { taskFunction: (data?: Data) => Response | PromiseLike<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }>`
that you want to execute on the worker. Priority range is the same as Unix nice
levels. `workerNodeKeys` is an array of worker node keys to restrict task
execution to specific workers (worker node affinity). See
[Worker Node Affinity Notes](#worker-node-affinity-notes) above for validation
behavior. Task functions can return native promises, foreign promises, or custom
promise-like results. Their settlement is awaited with or without an abort
signal, even when the function is not declared `async`. Callable `then` getters
are read once and invoked with the original result as receiver. Custom thenables
remain supported when their proxies reject prototype or own-property inspection.
In browsers, local promise candidates pass through `Promise.resolve()` for safe
brand validation. A native promise with an exotic modified `constructor` can
therefore invoke that constructor getter or require assimilation; Deno and Bun
use native promise branding without this browser-specific step.\
`opts` (optional) An object with these properties:

- `killBehavior` (optional) - Dictates if your worker will be deleted in case a
  task is active on it.\
  **KillBehaviors.SOFT**: If `currentTime - lastActiveTime` is greater than
  `maxInactiveTime` but the worker is stealing tasks or a task is executing or
  queued, then the worker **won't** be deleted.\
  **KillBehaviors.HARD**: If `currentTime - lastActiveTime` is greater than
  `maxInactiveTime` but the worker is stealing tasks or a task is executing or
  queued, then the worker will be deleted.\
  This option only apply to the newly created workers.\
  Default: `KillBehaviors.SOFT`

- `maxInactiveTime` (optional) - Maximum waiting time in milliseconds for tasks
  on newly created workers. After this time newly created workers will die. It
  must be a positive integer greater or equal than 5.\
  The last active time of your worker will be updated when it terminates a
  task.\
  If `killBehavior` is set to `KillBehaviors.HARD` this value represents also
  the timeout for the tasks that you submit to the pool, when this timeout
  expires your tasks is interrupted before completion and removed. The worker is
  killed if is not part of the minimum size of the pool.\
  If `killBehavior` is set to `KillBehaviors.SOFT` your tasks have no timeout
  and your workers will not be terminated until your task is completed.\
  Default: `60000`

- `killHandler` (optional) - A function that will be called when a worker is
  killed. It can return a promise-like result, which settles before
  acknowledgment. See [`pool.destroy()`](#pooldestroy) for timeout and failure
  handling.\
  Default: `() => {}`

#### `YourWorker.hasTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns
`{ status: boolean, error?: Error }`.

#### `YourWorker.addTaskFunction(name, fn)`

`name` (mandatory) The task function name.\
`fn` (mandatory) The task function
`(data?: Data) => Response | PromiseLike<Response>` or task function object
`{ taskFunction: (data?: Data) => Response | PromiseLike<Response>, priority?: number, strategy?: WorkerChoiceStrategy, workerNodeKeys?: number[] }`.
Priority range is the same as Unix nice levels. `workerNodeKeys` is an array of
worker node keys to restrict task execution to specific workers (worker node
affinity). See [Worker Node Affinity Notes](#worker-node-affinity-notes) above
for validation behavior.

This method is available on both worker implementations and returns
`{ status: boolean, error?: Error }`.

#### `YourWorker.removeTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns
`{ status: boolean, error?: Error }`.

#### `YourWorker.listTaskFunctionsProperties()`

This method is available on both worker implementations and returns an array of
the task function properties.

#### `YourWorker.setDefaultTaskFunction(name)`

`name` (mandatory) The task function name.

This method is available on both worker implementations and returns
`{ status: boolean, error?: Error }`.
