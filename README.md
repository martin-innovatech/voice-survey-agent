# Voice Survey Agent

Browser-based PoC for running voice-led surveys with:
- Admin survey management
- Email-invite workflow (PoC status simulation)
- User voice interaction (TTS/STT via Web Speech API)
- Participation tracking
- Individual and overall short written summaries

## Monorepo
This repository now uses `pnpm` workspaces + `turbo`.

```text
apps/
  web/                 # React frontend
  api/                 # Fastify backend (Phase 2 kickoff)
packages/
  shared/              # frozen domain model + API DTOs
  db/                  # Postgres client + SQL migrations
docs/
  data-model.md        # model constraints/invariants
  api/openapi.yaml     # API contract draft
```

## Current Scope
- Multi-survey creation and selection
- Admin view:
  - Add questions
  - Add recipients by email
  - Send invitations
  - Finalize survey
- User view:
  - Start/ask question
  - Answer by voice or text
  - Pause playback
  - Finish/submit answer
- Reports view:
  - Completion metrics
  - Individual summaries
  - Overall summary

## Tech Stack
- React
- TypeScript
- Vite
- Browser Web Speech API
- pnpm workspaces
- Turborepo
- Fastify
- PostgreSQL
- Taskfile

## Run (Monorepo)
```bash
pnpm install
pnpm dev
```

Run backend only:
```bash
pnpm dev:api
```

## Run with Taskfile
```bash
task setup
task db:up
task db:migrate
task dev:api
```

## Environment
Copy and customize as needed:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Key vars:
- `DATABASE_URL`: Postgres connection string (default expects local Docker on `5433`)
- `USE_IN_MEMORY_STORE`: `false` for normal development, `true` only for emergency fallback
- `VITE_API_BASE_URL`: web app target API URL
- `OPENAI_API_KEY`: optional, used when enabling AI summarization flows
- `OPENAI_MODEL`: default `gpt-4.1-mini`
- `OPENAI_SUMMARY_ENABLED`: feature flag for future AI summary path

## Validate
```bash
pnpm lint
pnpm build
```

## Project Docs
- Product/bootstrap spec: `bootstrap_docs.md`
- Agent metadata: `.agent`
- API contract: `docs/api/openapi.yaml`
- Data model: `docs/data-model.md`
