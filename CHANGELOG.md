# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- Avoid null exception at sending message to worker.

## [0.0.3] - 2023-10-17

### Fixed

- Fix race condition at dynamic worker node task assignment and scheduled
  removal. See issue [#1468](https://github.com/poolifier/poolifier/issues/1468)
  and [#1496](https://github.com/poolifier/poolifier/issues/1496).
