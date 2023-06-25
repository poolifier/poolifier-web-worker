#!/usr/bin/env bash

hyperfine --export-markdown BENCH-100000.md --min-runs 20 --prepare 'sleep 2' --warmup 2 --show-output \
  'node dynamic-poolifier.mjs' \
  'node fixed-poolifier.mjs' \
  'node dynamic-piscina.mjs' \
  'node fixed-piscina.mjs' \
  'node fixed-tinypool.mjs' \
  'node dynamic-tinypool.mjs' \
  'node dynamic-workerpool.mjs' \
  'node fixed-workerpool.mjs' \
  'node --experimental-import-meta-resolve dynamic-worker-nodes.mjs' \
  'node --experimental-import-meta-resolve fixed-worker-nodes.mjs' \
  'node threadjs.mjs' \
  'node fixed-threadwork.mjs' \
  'node fixed-microjob.mjs'
