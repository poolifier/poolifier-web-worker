import { build, stop } from '$esbuild/mod.js'

const entryPoints = ['./src/mod.ts']

const baseBuildDir = './dist'
const browserBuildDir = `${baseBuildDir}/browser`
const esmBuildDir = `${baseBuildDir}/esm`

Deno.removeSync(browserBuildDir, { recursive: true })
Deno.removeSync(esmBuildDir, { recursive: true })
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
await build({
  entryPoints,
  bundle: true,
  platform: 'neutral',
  treeShaking: true,
  minify: true,
  sourcemap: true,
  outdir: esmBuildDir,
})
console.timeEnd('Build time')
await stop()
