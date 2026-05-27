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
- Voice PoC: Web Speech API (Speech Synthesis + Speech Recognition)
- Data: In-memory state for PoC
- Email: PoC invitation status transitions; production should call an email API/provider

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

## Current PoC Status
Implemented in browser UI:
- Multi-survey creation and selection
- Admin and User views
- Recipient invitation tracking
- Voice question playback (TTS)
- Voice answer capture (STT where supported)
- Answer submission and completion tracking
- Finalization with individual + overall summary output

Planned production upgrades:
- Persistent backend storage
- Real email provider integration
- Robust voice/AI services and summarization pipeline
