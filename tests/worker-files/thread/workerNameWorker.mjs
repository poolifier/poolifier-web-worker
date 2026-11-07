import { ThreadWorker } from '../../../src/mod.ts'

export default new ThreadWorker(() => globalThis.name)
