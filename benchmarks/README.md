# Poolifier benchmarks

Welcome to poolifier benchmarks.

## Table of contents

- [Folder Structure](#folder-structure)
- [Poolifier internal benchmark](#poolifier-internal-benchmark)
  - [Usage](#usage)
  - [Results](#results)

## Folder Structure

The [internal](./internal) folder contains poolifier internal benchmark code.

<!-- ## Poolifier benchmark versus other worker pools

See the dedicated repository
[README.md](https://github.com/poolifier/benchmark#readme). -->

## Poolifier internal benchmark

### Usage

To run the internal benchmark, you just need to navigate to the root of
poolifier cloned repository and run:

#### Deno

- `deno task benchmark:tatami-ng` or
- `deno task benchmark:deno`

#### Bun

- `bun run ./benchmarks/internal/bench.mjs -t tatami-ng`

### [Results](https://bencher.dev/perf/poolifier-web-worker)
