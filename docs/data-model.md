# Data Model (Frozen for Phase 1.5)

This document freezes the core entities before backend implementation.

## Entities
- `Survey`
- `Question`
- `Recipient`
- `Response`
- `Invitation`
- `Summary`

Canonical TypeScript definitions live in `packages/shared/src/domain.ts`.

## Relationship Rules
- One `Survey` has many `Question` records.
- One `Survey` has many `Recipient` records.
- One `Recipient` can have many `Invitation` records (retries/resends).
- One `Recipient` can have many `Response` records (one per question in standard flow).
- One `Survey` has many `Summary` records:
  - zero or more `individual` summaries (per recipient)
  - zero or one `overall` summary

## Status Model
- `SurveyStatus`: `Draft`, `Active`, `Finalized`
- `RecipientStatus`: `Draft`, `Invited`, `In Progress`, `Completed`
- `InvitationStatus`: `Draft`, `Queued`, `Sent`, `Delivered`, `Opened`, `Bounced`, `Failed`

## Invariants
- `Question.position` is unique per `surveyId`.
- `Recipient.email` is unique per `surveyId`.
- `Response` references an existing `surveyId`, `questionId`, `recipientId`.
- `Summary.scope = overall` implies `recipientId` is omitted.
- `Summary.scope = individual` implies `recipientId` is present.
- `Survey.finalizedAt` is set only when `SurveyStatus = Finalized`.

## API DTOs
Request/response DTOs for the first backend endpoints are defined in `packages/shared/src/api.ts`.
