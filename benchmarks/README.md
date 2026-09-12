# Poolifier benchmarks

Welcome to poolifier benchmarks.

## Table of contents

- [Folder Structure](#folder-structure)

<!-- - [Poolifier benchmark versus other worker pools](#poolifier-benchmark-versus-other-worker-pools) -->

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

- `deno task benchmark:tinybench` or
- `deno task benchmark:deno`

#### Bun

- `bun ./benchmarks/internal/bench.mjs -t tinybench`

### [Results](https://bencher.dev/perf/poolifier-web-worker)

With `CI=true`, the Tinybench command writes `benchmark-report.json` in Bencher
Metric Format after both pool suites complete. Latency is in nanoseconds and
throughput is in operations per second; bounds represent mean ± one standard
deviation. Failed or incomplete benchmarks fail the command instead of producing
partial results.

The internal benchmark workflow runs on the dedicated self-hosted runner with
Deno `latest`. Benchmark execution and publication are separate steps: an
execution failure prevents publication and retains the original error. Renovate
waits one day before selecting npm releases in Deno manifests, matching Deno’s
default minimum dependency age without disabling that protection.

Only runs on `master` publish results. Manual workflow dispatches on other refs
validate the report with Bencher’s `--dry-run`, without changing stored results.

The workflow retains the `self-hosted` testbed. Its historical latency values
were milliseconds labeled as nanoseconds. Corrected reports use nanoseconds;
without a historical data migration, latency comparisons mix units and can
produce artificial regression alerts. This workflow does not migrate or delete
historical data. Throughput units remain unchanged.

Bencher applies a one-sided Student’s t-test to at most 64 historical samples:
the upper 0.99 boundary detects latency increases, and the lower 0.99 boundary
detects throughput decreases. Alerts still fail the publication step. These
correlated measures are not independent evidence, and no multiple-testing
correction is applied across benchmark scenarios. An alert identifies a
departure from the baseline, not which code or environment change caused it.
