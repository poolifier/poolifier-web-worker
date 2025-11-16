# Codebase Structure

## Root Directory Structure

```
/
├── src/                    # Main source code
│   ├── pools/             # Pool implementations and strategies
│   ├── queues/            # Queue implementations
│   ├── worker/            # Worker abstractions and implementations
│   └── mod.ts             # Main module exports
├── tests/                 # Test files (.mjs extension)
├── examples/              # Usage examples for different runtimes
│   ├── deno/             # Deno-specific examples
│   └── bun/              # Bun-specific examples
├── benchmarks/           # Performance benchmarks
├── docs/                 # Documentation files
├── dist/                 # Built/bundled files
├── .github/              # GitHub workflows and configs
└── deno.json             # Deno configuration

## Key Source Files
- `src/mod.ts` - Main entry point with exports
- `src/pools/abstract-pool.ts` - Base pool implementation
- `src/pools/thread/fixed.ts` - Fixed thread pool
- `src/pools/thread/dynamic.ts` - Dynamic thread pool
- `src/worker/abstract-worker.ts` - Base worker class
- `src/worker/thread-worker.ts` - Thread worker implementation

## Architecture Patterns
- Factory pattern for pool creation
- Strategy pattern for worker selection
- Observer pattern for pool events
- Template method pattern for abstract classes

## Module Organization
- Each module has clear separation of concerns
- Types are defined in separate files or alongside implementations
- Utilities are separated from core logic
- Test files mirror source structure in tests/ directory
```
