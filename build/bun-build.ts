import { existsSync, rmSync } from 'node:fs'
import { build } from 'bun'
import ts from 'typescript'
import { entryPoints, esmBuildDir } from './config.ts'

if (existsSync(esmBuildDir)) {
  rmSync(esmBuildDir, { recursive: true })
}

const bundle = await build({
  entrypoints: entryPoints,
  outdir: esmBuildDir,
  target: 'bun',
  minify: true,
  sourcemap: 'external',
})
if (!bundle.success) {
  throw new AggregateError(bundle.logs, 'Bun build failed')
}

const checkDiagnostics = (diagnostics: readonly ts.Diagnostic[]): void => {
  if (diagnostics.length > 0) {
    throw new Error(ts.formatDiagnostics(diagnostics, {
      getCanonicalFileName: (fileName) => fileName,
      getCurrentDirectory: ts.sys.getCurrentDirectory,
      getNewLine: () => ts.sys.newLine,
    }))
  }
}

const config = ts.readConfigFile('./build/tsconfig.json', ts.sys.readFile)
if (config.error != null) {
  checkDiagnostics([config.error])
}
const { options, errors } = ts.convertCompilerOptionsFromJson(
  config.config.compilerOptions,
  './build',
)
checkDiagnostics(errors)
const program = ts.createProgram(entryPoints, {
  ...options,
  outDir: esmBuildDir,
})
checkDiagnostics(ts.getPreEmitDiagnostics(program))
checkDiagnostics(program.emit().diagnostics)

for (const lib of ['lib.dom.d.ts', 'lib.webworker.d.ts']) {
  const consumer = ts.createProgram(['./tests/types/public-api.ts'], {
    ...options,
    lib: ['lib.esnext.d.ts', lib],
    emitDeclarationOnly: false,
    noEmit: true,
  })
  checkDiagnostics(ts.getPreEmitDiagnostics(consumer))
}
