import { entryPoints, esmBuildDir } from './config.ts'
import { existsSync, rmSync } from 'node:fs'
import { build } from 'bun'
import dts from 'bun-plugin-dts'

if (existsSync(esmBuildDir)) {
  rmSync(esmBuildDir, { recursive: true })
}

build({
  entrypoints: entryPoints,
  outdir: esmBuildDir,
  target: 'bun',
  minify: true,
  sourcemap: 'external',
  plugins: [
    dts({
      compilationOptions: { preferredConfigPath: './build/tsconfig.json' },
    }),
  ],
})
