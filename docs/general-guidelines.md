# General guidelines

Performance is one of the main target of these worker pool implementations, poolifier team wants to have a strong focus on this.  
Poolifier already has a [benchmarks](./../benchmarks/) folder where you can find some comparisons.

## Table of contents

- [Fixed vs Dynamic pools](#fixed-vs-dynamic-pools)

## Fixed vs Dynamic pools

To choose your pool consider first that with a _FixedThreadPool_ or a _DynamicThreadPool_ your application memory footprint will increase.  
By doing so, your application will be ready to execute in parallel more tasks, but during idle time your application will consume more memory.  
One good choice from poolifier team point of view is to profile your application using a fixed or dynamic worker pool, and analyze your application metrics when you increase/decrease the number of workers.  
For example you could keep the memory footprint low by choosing a _DynamicThreadPool_ with a minimum of 5 workers, and allowing it to create new workers until a maximum of 50 workers if needed. This is the advantage of using a _DynamicThreadPool_.  
But in general, **always profile your application**.
