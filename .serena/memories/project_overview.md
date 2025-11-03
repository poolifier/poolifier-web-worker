# Poolifier Web Worker Project Overview

## Purpose

Poolifier Web Worker is a TypeScript/JavaScript library that provides worker
pool implementations for Deno, Bun, and browser environments using the Web
Worker API. It enables CPU and/or I/O intensive task execution without blocking
the main event loop.

## Key Features

- Fixed and dynamic pool size management
- Worker choice strategies for task distribution
- Lockless task queueing and rescheduling
- Support for sync/async task functions
- Multiple task functions with priority queuing
- Error handling and performance monitoring
- Zero runtime dependencies

## Tech Stack

- **Runtime**: Deno, Bun, Browser
- **Language**: TypeScript with ESM modules
- **Testing**: Deno test framework with @std/expect
- **Benchmarking**: Tinybench and built-in Deno bench
- **Formatting**: Deno fmt (2-space, single quotes, no semicolons)
- **Linting**: Deno lint

## Target Platforms

- Deno >= 1.40.x
- Bun >= 1.x
- Modern browsers with Web Worker support
