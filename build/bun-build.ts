import { entryPoints, esmBuildDir } from './config.ts'
import { existsSync, rmSync } from 'node:fs'

if (existsSync(esmBuildDir)) {
  rmSync(esmBuildDir, { recursive: true })
}

Bun.build({
  entrypoints: entryPoints,
  outdir: esmBuildDir,
  target: 'bun',
  minify: true,
  sourcemap: 'external',
})
