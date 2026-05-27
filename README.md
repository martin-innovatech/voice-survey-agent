# Voice Survey Agent

Browser-based PoC for running voice-led surveys with:
- Admin survey management
- Email-invite workflow (PoC status simulation)
- User voice interaction (TTS/STT via Web Speech API)
- Participation tracking
- Individual and overall short written summaries

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

## Run
```bash
npm install
npm run dev
```

## Validate
```bash
npm run lint
npm run build
```

## Project Docs
- Product/bootstrap spec: `bootstrap_docs.md`
- Agent metadata: `.agent`
