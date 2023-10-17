import {
  availableParallelism,
  DynamicThreadPool,
  FixedThreadPool,
} from 'https://deno.land/x/poolifier@v0.0.2/src/index.ts'
import type { MyData, MyResponse } from './worker.ts'

const workerFileURL = new URL(
  './worker.ts',
  import.meta.url,
)

export const fixedPool = new FixedThreadPool<MyData, Promise<MyResponse>>(
  availableParallelism(),
  workerFileURL,
)

export const dynamicPool = new DynamicThreadPool<MyData, Promise<MyResponse>>(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  workerFileURL,
)
