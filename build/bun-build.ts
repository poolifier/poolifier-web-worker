import { existsSync, rmSync } from 'node:fs'
import { build } from 'bun'
import dts from 'bun-plugin-dts'
import { entryPoints, esmBuildDir } from './config.ts'

if (existsSync(esmBuildDir)) {
  rmSync(esmBuildDir, { recursive: true })
}

await build({
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
