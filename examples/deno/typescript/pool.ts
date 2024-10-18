import {
  availableParallelism,
  DynamicThreadPool,
  FixedThreadPool,
} from 'jsr:@poolifier/poolifier-web-worker@^0.4.30' // x-release-please-version
import type { MyData, MyResponse } from './worker.ts'

const workerFileURL = new URL('./worker.ts', import.meta.url)

const fixedPool = new FixedThreadPool<MyData, MyResponse>(
  availableParallelism(),
  workerFileURL,
  {
    errorEventHandler: (e: ErrorEvent) => {
      console.error(e)
    },
  },
)

await fixedPool.execute()

const dynamicPool = new DynamicThreadPool<MyData, MyResponse>(
  Math.floor(availableParallelism() / 2),
  availableParallelism(),
  workerFileURL,
  {
    errorEventHandler: (e: ErrorEvent) => {
      console.error(e)
    },
  },
)

await dynamicPool.execute()

setTimeout(async () => {
  await fixedPool.destroy()
  await dynamicPool.destroy()
}, 3000)
