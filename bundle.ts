import { build, stop } from '$esbuild/mod.js'

console.time('Build time')
await build({
  entryPoints: ['./src/mod.ts'],
  bundle: true,
  platform: 'browser',
  minify: true,
  sourcemap: true,
  outdir: './dist/browser',
})
await build({
  entryPoints: ['./src/mod.ts'],
  bundle: true,
  platform: 'neutral',
  treeShaking: true,
  minify: true,
  sourcemap: true,
  outdir: './dist/esm',
})
console.timeEnd('Build time')
await stop()
