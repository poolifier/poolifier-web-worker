# Agent Guidelines for Poolifier Web Worker

## Build/Test Commands

- **Test**: `deno task test` (all tests), `deno task test:parallel` (all tests
  in parallel), `deno task test:coverage` (with coverage)
- **Single test**: `deno test -A tests/path/to/specific.test.mjs`
- **Lint**: `deno task lint` (check), `deno task lint:fix` (autofix)
- **Format**: `deno task format` (autoformat), `deno task format:check` (check
  only)
- **Bundle**: `deno task bundle`
- **Coverage**: `deno task coverage:report` (with coverage report)

## Code Style & Conventions

- **Runtime**: Deno with TypeScript, no Node.js dependencies
- **Imports**: Use `.ts` extensions, relative paths from `src/`, group imports
  (types, utils, modules)
- **Formatting**: 2-space indentation, single quotes, no semicolons (Deno fmt)
- **Naming**: camelCase (variables/functions), PascalCase
  (classes/types/enums/interfaces)
- **Types**: Explicit types over `any`, use type guards, avoid non-null
  assertions (`!`)
- **Async**: Prefer async/await, handle rejections with try/catch
- **Error handling**: Typed errors with structured properties
- **Worker patterns**: Broadcast channels for worker communication, store
  Promise resolvers in Maps
- **Testing**: Use `@std/expect` and `@std/testing/bdd`, `.mjs` extension for
  test files

## Architecture Principles

Follow `.github/copilot-instructions.md`: DRY principle, single source of truth,
design patterns (factory/strategy), algorithmic solutions, minimal time/space
complexity, English-only code/docs, tests-first mindset.
