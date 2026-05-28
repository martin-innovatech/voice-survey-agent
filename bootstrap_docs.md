# Voice Survey Agent - Bootstrap Docs

## Functional Description
This project is a browser-based text-to-speech and speech-to-text survey platform.

The platform supports:
- Creating one or more surveys
- Defining predefined interview/survey questions
- Sending survey invitations via email workflow (PoC mocked as status updates)
- Running voice-based interviews in the browser
- Capturing participant answers via speech-to-text or typing
- Tracking survey participation
- Finalizing surveys with short written summaries:
  - Individual participant summaries
  - Overall survey summary

## Views

### Admin View
The admin experience includes:
- Create survey
- Add questions to survey
- Add recipients by email address
- Send invitations
- Track recipient participation status (Draft, Invited, In Progress, Completed)
- Finalize survey
- Generate individual and aggregate summary report

### User View
The participant/user experience includes:
- Start survey conversation
- Listen to asked questions via text-to-speech
- Answer via speech input or typed text
- Pause voice playback
- Finish and submit answers

## Delivery Scope

### High-Level Design
- Frontend: React + Vite (browser app)
- Backend: Fastify API
- Voice PoC: Web Speech API (Speech Synthesis + Speech Recognition)
- Data: PostgreSQL with SQL migration baseline (in-memory fallback remains available for emergency local runs)
- Email: invitation status transitions implemented; production email provider integration is pending

### Main Workflows
1. Admin creates survey and questions.
2. Admin adds recipients by email.
3. Admin sends invitations.
4. Participant opens user view, starts survey, and submits answers.
5. Admin tracks completion.
6. Admin finalizes survey to generate short written individual and overall summaries.

### Platform / Tools
- React
- TypeScript
- Vite
- Browser Web Speech API
- pnpm workspaces
- Turborepo
- Fastify
- PostgreSQL
- Taskfile
- Docker Compose

## Current PoC Status
Implemented in browser UI:
- Multi-survey creation and selection
- Admin and User views
- Recipient invitation tracking
- Voice question playback (TTS)
- Voice answer capture (STT where supported)
- Answer submission and completion tracking
- Finalization with individual + overall summary output

Implemented in backend:
- Contract-aligned API endpoints in `apps/api`
- Postgres-backed repository and SQL migration workflow
- Local orchestration via `Taskfile.yml` and `docker-compose.yml`

Planned production upgrades:
- Persistent backend storage
- Real email provider integration
- Robust voice/AI services and summarization pipeline

## Phase 1.5 Foundations (Completed)
- Monorepo structure:
  - `apps/web`
  - `packages/shared`
- Frozen domain model:
  - `packages/shared/src/domain.ts`
  - `docs/data-model.md`
- API contract draft:
  - `docs/api/openapi.yaml`
- Shared API DTOs:
  - `packages/shared/src/api.ts`

## Phase 2 Kickoff (In Progress)
- `apps/api` backend scaffold added (Fastify + TypeScript)
- Postgres-backed repository implementing contract-aligned survey lifecycle endpoints
- Endpoints implemented for:
  - `/surveys` (create/list)
  - `/surveys/{surveyId}/questions`
  - `/surveys/{surveyId}/recipients`
  - `/surveys/{surveyId}/invitations:send`
  - `/surveys/{surveyId}/responses`
  - `/surveys/{surveyId}/finalize`
  - `/surveys/{surveyId}` aggregate read
- Persistence foundation added:
  - `packages/db` package
  - `packages/db/migrations/0001_initial_schema.sql`
  - migration runner (`pnpm --filter @voice-survey-agent/db migrate`)
- Local orchestration foundation added:
  - `docker-compose.yml` (Postgres)
  - `Taskfile.yml` (`task db:up`, `task db:migrate`, `task dev:api`)

## Survey Question Bank (Draft)

### Prod Readiness Smoke
1. Is the service deployable to production right now without manual fixes?
2. Is there a tested rollback procedure that can be executed in under 15 minutes?
3. Are health checks (`/health` or equivalent) implemented and monitored?
4. Are critical alerts configured (availability, error rate, latency, resource saturation)?
5. Can on-call identify the owner of this service immediately?
6. Are logs structured, searchable, and correlated with request IDs?
7. Are dashboards in place for the top 5 production KPIs?
8. Are secrets managed securely (not in code, rotated, access-controlled)?
9. Are database migrations backward-compatible and tested in staging?
10. Are backups enabled and has restore been tested recently?
11. Have load/performance smoke tests been run for expected peak traffic?
12. Are dependency vulnerabilities reviewed and high/critical issues addressed?
13. Is access control/RBAC validated for admin and user paths?
14. Is there a current runbook for incident triage and recovery?
15. Final readiness score (1-5) and top blocker to go-live?
