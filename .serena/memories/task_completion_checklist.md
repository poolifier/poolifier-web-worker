# Task Completion Checklist

## When a Task is Completed

### 1. Code Quality Checks

- Run `deno task lint` to check for linting issues
- Run `deno task lint:fix` to auto-fix linting issues
- Run `deno task format` to format code consistently

### 2. Testing

- Run `deno task test` to execute all tests
- For specific changes, run individual test files:
  `deno test -A tests/path/to/specific.test.mjs`
- If making significant changes, run `deno task test:coverage` to ensure
  coverage

### 3. Documentation

- Ensure all new functions have proper JSDoc comments
- Update documentation if public API changes
- Generate code documentation with `deno task documentation` if needed

### 4. Final Validation

- Verify code builds: `deno task bundle`
- Check format compliance: `deno task format:check`
- Ensure no linting errors: `deno task lint`

### 5. Quality Gates

All of the following must pass before considering a task complete:

- ✅ Linting passes
- ✅ Formatting is correct
- ✅ All tests pass
- ✅ Code coverage is maintained
- ✅ Documentation is updated

### 6. Git Workflow

- Stage relevant changes: `git add <files>`
- Commit with meaningful message: `git commit -m "description"`
- Push changes: `git push`
