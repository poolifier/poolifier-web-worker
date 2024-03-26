import { baseBuildDir } from './build/config.ts'

Deno.copyFileSync('LICENSE', `${baseBuildDir}/LICENSE`)
Deno.copyFileSync('README.md', `${baseBuildDir}/README.md`)

console.time('Build time')
const browserBuild = new Deno.Command('bun', {
  args: ['run', './build/browser-build.ts'],
})
const browserBuildCommandOutput = browserBuild.outputSync()
if (browserBuildCommandOutput.success === false) {
  console.error(new TextDecoder().decode(browserBuildCommandOutput.stderr))
}
const bunBuild = new Deno.Command('bun', {
  args: ['run', './build/bun-build.ts'],
})
const bunBuildCommandOutput = bunBuild.outputSync()
if (bunBuildCommandOutput.success === false) {
  console.error(new TextDecoder().decode(bunBuildCommandOutput.stderr))
}
console.timeEnd('Build time')
