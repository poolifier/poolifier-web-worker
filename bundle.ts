import { baseBuildDir } from './build/config.ts'

Deno.copyFileSync('LICENSE', `${baseBuildDir}/LICENSE`)
Deno.copyFileSync('README.md', `${baseBuildDir}/README.md`)

console.time('Browser build time')
const browserBuild = new Deno.Command('bun', {
  args: ['run', './build/browser-build.ts'],
})
const browserBuildCommandOutput = browserBuild.outputSync()
if (browserBuildCommandOutput.success === false) {
  const errMsg = new TextDecoder().decode(browserBuildCommandOutput.stderr)
  console.error(errMsg)
  throw new Error(`Browser build failed: ${errMsg}`)
}
console.timeEnd('Browser build time')

console.time('Bun build time')
const bunBuild = new Deno.Command('bun', {
  args: ['run', './build/bun-build.ts'],
})
const bunBuildCommandOutput = bunBuild.outputSync()
if (bunBuildCommandOutput.success === false) {
  const errMsg = new TextDecoder().decode(bunBuildCommandOutput.stderr)
  console.error(errMsg)
  throw new Error(`Bun build failed: ${errMsg}`)
}
console.timeEnd('Bun build time')
