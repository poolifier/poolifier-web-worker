## How to contribute

This repo use
[![neostandard Javascript Code Style](https://badgen.net/static/neo/standard/green)](https://github.com/neostandard/neostandard)
js style, please use it if you want to contribute.

Take tasks from todo list, develop a new feature or fix a bug and do a pull
request.\
Another thing that you can do to contribute is to build something on top of
poolifier and link poolifier to your project.

Please do your PR on **master** branch.

**How to run unit tests and coverage**

```bash
deno task test:coverage && deno task coverage
```

**How to check if your new code is standard JS style**

```bash
deno task lint
```

**How to format and lint to standard JS style your code**

```bash
deno task format && deno task lint
```

**How to install Git hooks for automatic formatting and linting**

```bash
deno task hooks:install
```

### Project pillars

Please consider our pillars before to start change the project

- Performance ✔
- Security ✔
- No runtime dependencies ✔ (until now we don't have any exception to that)
- Easy to use ✔
- Code quality ✔
