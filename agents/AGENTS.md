# Agents Guide (Takao)

- Tests: `npm test --workspace=Takao`
- Build: `npm run build --workspace=Takao`
- Lint: `npm run lint --workspace=Takao`
- Entry: `src/index.ts`; engine core in `src/core`, AI in `src/ai`, utilities in `src/utils`.
- Coverage uses `@vitest/coverage-v8`; keep test helpers in sync with engine APIs.
