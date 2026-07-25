import { baseBuildDir } from './build/config.ts'

Deno.copyFileSync('LICENSE', `${baseBuildDir}/LICENSE`)
Deno.copyFileSync('README.md', `${baseBuildDir}/README.md`)

// Install build-only dependencies (bun-plugin-dts and its peers) with the
// TypeScript version pinned in ./build/package.json. This is required because
// dts-bundle-generator@9.5.1 declares typescript: ">=5.0.2" and, without a
// local package.json, Bun resolves that range to the TypeScript 7 native
// rewrite (which does not expose the legacy JS compiler API used by the
// plugin, in particular ts.sys), breaking the .d.ts bundle step.
console.time('Bun install time')
const bunInstall = new Deno.Command('bun', {
  args: ['install', '--cwd', './build', '--no-progress', '--no-summary'],
})
const bunInstallCommandOutput = bunInstall.outputSync()
if (bunInstallCommandOutput.success === false) {
  const errMsg = new TextDecoder().decode(bunInstallCommandOutput.stderr)
  console.error(errMsg)
  throw new Error(`Bun install failed: ${errMsg}`)
}
console.timeEnd('Bun install time')

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
