import { build, stop } from '$esbuild/mod.js'
import { existsSync } from '$std/fs/exists.ts'
import { baseBuildDir, browserBuildDir, entryPoints } from './build/config.ts'

Deno.copyFileSync('LICENSE', `${baseBuildDir}/LICENSE`)
Deno.copyFileSync('README.md', `${baseBuildDir}/README.md`)

if (existsSync(browserBuildDir)) {
  Deno.removeSync(browserBuildDir, { recursive: true })
}

console.time('Build time')
await build({
  entryPoints,
  bundle: true,
  platform: 'browser',
  minify: true,
  sourcemap: true,
  outdir: browserBuildDir,
})
await stop()
const bunBuild = new Deno.Command(
  'bun',
  {
    args: [
      'run',
      './build/bun-build.ts',
    ],
  },
)
bunBuild.outputSync()
console.timeEnd('Build time')
