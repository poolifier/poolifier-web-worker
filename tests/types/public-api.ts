import {
  AbstractPool,
  AbstractWorker,
  CircularBuffer,
  FixedThreadPool,
  PriorityQueue,
  ThreadWorker,
  WorkerChoiceStrategiesContext,
} from '../../dist/esm/mod.js'

export type InternalTypes = {
  pool: AbstractPool<never, unknown, unknown>
  worker: AbstractWorker<EventTarget>
  buffer: CircularBuffer
  queue: PriorityQueue<unknown>
  strategies: WorkerChoiceStrategiesContext<never, unknown, unknown>
}

const pool = new FixedThreadPool<{ value: number }, { value: number }>(
  1,
  new URL('./worker.js', import.meta.url),
)
const response: Promise<{ value: number }> = pool.execute(
  { value: 1 },
  undefined,
  new AbortController().signal,
)
const worker = new ThreadWorker<{ value: number }, { value: number }>(
  (data) => Promise.resolve({ value: data?.value ?? 0 }),
  { killHandler: () => Promise.resolve() },
)
void [response, worker]

// @ts-expect-error Type-only export.
void AbstractPool
// @ts-expect-error Type-only export.
void AbstractWorker
// @ts-expect-error Type-only export.
void CircularBuffer
// @ts-expect-error Type-only export.
void PriorityQueue
// @ts-expect-error Type-only export.
void WorkerChoiceStrategiesContext
