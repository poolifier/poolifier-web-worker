import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FixedClusterPool, availableParallelism } from 'poolifier'
import { type ClusterWorkerData, type ClusterWorkerResponse } from './types.js'

const webSocketServerWorkerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `websocket-server-worker${extname(fileURLToPath(import.meta.url))}`
)

const requestHandlerWorkerFile = join(
  dirname(fileURLToPath(import.meta.url)),
  `request-handler-worker${extname(fileURLToPath(import.meta.url))}`
)

const pool = new FixedClusterPool<ClusterWorkerData, ClusterWorkerResponse>(
  Math.round(availableParallelism() / 2),
  webSocketServerWorkerFile,
  {
    onlineHandler: () => {
      pool
        .execute({
          port: 8080,
          maxWorkers:
            Math.round(availableParallelism() / 4) < 1
              ? 1
              : Math.round(availableParallelism() / 4),
          workerFile: requestHandlerWorkerFile,
          enableTasksQueue: true,
          tasksQueueOptions: {
            concurrency: 8
          },
          errorHandler: (e: Error) => {
            console.error('Thread worker error:', e)
          }
        })
        .then(response => {
          if (response.status) {
            console.info(
              // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              `WebSocket server is listening in cluster worker on port ${response.port}`
            )
          }
          return null
        })
        .catch(error => {
          console.error(
            'WebSocket server failed to start in cluster worker:',
            error
          )
        })
    },
    errorHandler: (e: Error) => {
      console.error('Cluster worker error', e)
    }
  }
)
