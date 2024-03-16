import { build, stop } from '$esbuild/mod.js'
import { existsSync } from '$std/fs/exists.ts'

const entryPoint = './src/mod.ts'
const entryPoints = [entryPoint]

const baseBuildDir = './dist'
const browserBuildDir = `${baseBuildDir}/browser`
const esmBuildDir = `${baseBuildDir}/esm`

if (existsSync(browserBuildDir)) {
  Deno.removeSync(browserBuildDir, { recursive: true })
}
if (existsSync(esmBuildDir)) {
  Deno.removeSync(esmBuildDir, { recursive: true })
}
Deno.copyFileSync('LICENSE', `${baseBuildDir}/LICENSE`)
Deno.copyFileSync('README.md', `${baseBuildDir}/README.md`)

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
      'build',
      entryPoint,
      '--outdir',
      esmBuildDir,
      '--target',
      'bun',
      '--minify',
      '--sourcemap=external',
    ],
  },
)
bunBuild.outputSync()
console.timeEnd('Build time')
