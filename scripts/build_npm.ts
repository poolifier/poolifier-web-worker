import { build, emptyDir } from '$dnt/mod.ts'
import { version } from '../src/pools/version.ts'

await emptyDir('./npm')

await build({
  entryPoints: ['./src/mod.ts'],
  outDir: './npm',
  typeCheck: false,
  test: false,
  declaration: false,
  importMap: './deno.json',
  shims: {
    deno: 'dev',
    crypto: true,
  },
  package: {
    name: 'poolifier-web-worker',
    version,
    description: 'poolifier-web-worker',
    license: 'MIT',
    repository: {
      type: 'git',
      url: 'git+https://github.com/poolifier/poolifier-web-worker.git',
    },
    bugs: {
      url: 'https://github.com/poolifier/poolifier-web-worker/issues',
    },
  },
  postBuild() {
    Deno.copyFileSync('LICENSE', './npm/LICENSE')
    Deno.copyFileSync('README.md', './npm/README.md')
  },
})
