# Code Style and Conventions

## TypeScript/JavaScript Conventions

- **Imports**: Use `.ts` extensions for TypeScript imports, relative paths from
  `src/`
- **Naming**:
  - camelCase for variables and functions
  - PascalCase for classes, types, enums, interfaces
- **Types**: Explicit types over `any`, use type guards, avoid non-null
  assertions (`!`)
- **Async**: Prefer async/await over raw Promises, handle rejections with
  try/catch
- **Error Handling**: Use typed errors with structured properties

## Formatting (Deno fmt)

- 2-space indentation
- Single quotes for strings
- No semicolons
- Trailing commas (ES5 style)

## JSDoc Comments

- All functions should have proper JSDoc comments
- Include meaningful descriptions for the function purpose
- Document all parameters with `@param {type} name - description`
- Document return values with `@returns {type} description`
- Empty comments like `/**  */` should be filled with proper documentation

## Worker Patterns

- Use MessageChannel/MessagePort for worker communication
- Use postMessage/onmessage for worker messaging
- Store Promise resolvers in Maps for async operations

## Testing

- Use `@std/expect` and `@std/testing/bdd`
- Test files should have `.mjs` extension
- Test files should be in `tests/` directory

## Architecture Principles

- Follow DRY principle (Don't Repeat Yourself)
- Maintain single source of truth for configuration
- Use design patterns (factory/strategy) where appropriate
- Optimize for minimal time/space complexity
- English-only code and documentation
- Tests-first mindset
