# Contributing

## Workflow

1. Branch from `main`: `git checkout -b feature/short-description`.
2. Make focused commits using [Conventional Commits](https://www.conventionalcommits.org/)
   (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
3. Before pushing run:
   ```bash
   npm run build --prefix server
   npm run build
   ```
4. Open a pull request describing **what** changed and **why**, with screenshots for UI work.

## Code style

- TypeScript everywhere; no `any` unless unavoidable.
- Backend: Express routes in `server/src/index.ts`, domain logic in dedicated modules
  (`workflow.ts`, `policy-access.ts`, `bpm-catalog.ts`, …).
- Frontend: product code lives in `src/`; use the shared `request()` helper in
  `src/lib/api.ts` for all HTTP calls.
- User-facing text is English.
- Use Sonner toasts for notifications instead of `alert()`.

## Never commit

- `.env` files, API keys, passwords, tokens, certificates
- Runtime policy data (`server/data/policies.json` and `*.backup*`)
- Logs (`*.log`)

If a secret is committed by mistake, rotate it immediately — removing it from history is
not enough.
