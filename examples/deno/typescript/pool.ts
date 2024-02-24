import {
  availableParallelism,
  DynamicThreadPool,
  FixedThreadPool,
} from 'https://deno.land/x/poolifier/src/mod.ts'
import type { MyData, MyResponse } from './worker.ts'

const workerFileURL = new URL(
  './worker.ts',
  import.meta.url,
)

export const fixedPool = new FixedThreadPool<MyData, MyResponse>(
  availableParallelism(),
  workerFileURL,
)

export const dynamicPool = new DynamicThreadPool<MyData, MyResponse>(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  workerFileURL,
)

setTimeout(async () => {
  await fixedPool.destroy()
  await dynamicPool.destroy()
}, 3000)
