import { build, stop } from '$esbuild/mod.js'

console.time('Build time')
await build({
  entryPoints: ['./src/mod.ts'],
  bundle: true,
  platform: 'browser',
  // format: 'esm',
  // minify: true,
  sourcemap: true,
  outdir: './dist/browser',
})
await stop()
console.timeEnd('Build time')
