import { browserBuildDir, entryPoints } from './config.ts'
import { existsSync, rmSync } from 'node:fs'
import { build } from 'bun'

if (existsSync(browserBuildDir)) {
  rmSync(browserBuildDir, { recursive: true })
}

build({
  entrypoints: entryPoints,
  outdir: browserBuildDir,
  target: 'browser',
  minify: true,
  sourcemap: 'external',
})
