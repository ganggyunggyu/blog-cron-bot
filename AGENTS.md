# Repository Guidelines

## Project Structure & Module Organization
- `src/` TypeScript sources:
  - `index.ts` entrypoint; orchestrates crawl → parse → match → persist → export.
  - `crawler.ts` HTTP fetch and HTML load (Cheerio).
  - `parser.ts` DOM selectors and extraction logic.
  - `matcher.ts` blog ID detection and smart‑blog handling.
  - `csv-writer.ts` CSV export to `output/`.
  - `database.ts` MongoDB connection and models.
  - `constants.ts` headers, timeouts, and `BLOG_IDS`.
  - `selector-analyzer.ts` helper for selector tuning.
- `output/` generated CSVs. `dist/` compiled JS. `debug/` ad‑hoc logs.

## Build, Test, and Development Commands
- Install: `pnpm install`
- Dev run (ts-node): `pnpm dev` — runs `src/index.ts` without build.
- Build: `pnpm build` — compiles TypeScript to `dist/` via `tsc`.
- Start: `pnpm start` — executes `dist/index.js`.
- Smoke test: `pnpm test` — runs `src/test.ts` (quick checks).
- Env: set `MONGODB_URI` in `.env`. Example: `mongodb://localhost:27017/naver-exposure-bot`.

## Coding Style & Naming Conventions
- Language: TypeScript (strict). Module: CommonJS. Indent: 2 spaces.
- Filenames: kebab-case (`csv-writer.ts`). Export named functions where possible.
- Variables/funcs: `camelCase`; Types/Interfaces: `PascalCase`; constants: `UPPER_SNAKE_CASE`.
- HTTP parsing via Cheerio; keep selectors centralized in `parser.ts`. Avoid inline magic strings.
- Prefer small, pure functions; log actionable info only (see recent refactors reducing verbosity).

## Testing Guidelines
- Use `src/test.ts` for end-to-end smoke. Add focused checks near modules as `*.spec.ts` if needed (executed with `ts-node`).
- Keep test data deterministic; mock network where feasible; avoid hitting production endpoints in CI.

## Commit & Pull Request Guidelines
- Conventional Commits required: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:` (see history).
  - Examples: `feat(crawler): handle smart blog ranking`, `refactor(logging): reduce noisy output`.
- PRs must include: concise description, rationale, before/after notes, and any selector updates.
- Link related issues; attach sample command and snippet of resulting CSV when behavior changes.

## Security & Configuration Tips
- Never commit `.env` or credentials. Validate `MONGODB_URI` at startup.
- Respect rate limits and add delays between queries; keep `User-Agent` set.
- When selectors break, document diffs in `selector-analyzer.ts` and update `parser.ts` accordingly.

