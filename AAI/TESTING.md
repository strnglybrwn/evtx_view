# Test Coverage Report

This document outlines the testing strategy for the AAI project.

## Test Suites

### Unit Tests

#### Agents
- **exampleAgent.test.js** — Tests the generic conversational agent
  - `supports()` — Verifies consistent 0.5 score
  - `run()` — Validates output format and content
  - `requirements` — Ensures empty array

- **duckduckgoAgent.test.js** — Tests the web search agent
  - `supports()` — Validates scoring heuristics
  - Query type classification (short queries, image queries, long queries)
  - `requirements` — Verifies internet-access requirement

#### Libraries
- **secretStore.test.js** — Tests the secret storage system
  - `set()` and `get()` — Basic key-value operations
  - `clear()` — Single and bulk clearing
  - Persistence validation

### Integration Tests

#### API Endpoints
- **api.test.js** — Tests core server endpoints
  - `/health` — Health check endpoint
  - `/api/solve` — Agent selection and execution
  - Request validation and error handling
  - Preview mode functionality

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-run on changes)
npm run test:watch

# Run with debugger
npm run test:debug

# Run specific test file
npm test __tests__/agents/exampleAgent.test.js

# Generate coverage report
npm test -- --coverage
```

## Coverage Goals

Target coverage metrics:
- **Statements:** 70%+
- **Branches:** 65%+
- **Functions:** 70%+
- **Lines:** 70%+

## Test Files Location

All tests are in the `__tests__/` directory, organized by component:

```
__tests__/
├── agents/
│   ├── exampleAgent.test.js
│   ├── duckduckgoAgent.test.js
│   └── openaiAgent.test.js (not yet implemented - requires API key)
├── lib/
│   └── secretStore.test.js
├── server/
│   └── api.test.js
└── setup.js
```

## Notes

- Tests for `openaiAgent.run()` are skipped (requires valid API key)
- Network-dependent tests (DuckDuckGo API calls) are marked for integration testing
- Use `npm run test:watch` during development for fast feedback

## Future Test Coverage

- Session management tests
- History context building tests
- Error handling and edge cases
- Performance benchmarks
- E2E tests with real agents
