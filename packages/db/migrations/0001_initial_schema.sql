CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Active', 'Finalized')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('free_text')),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_questions_survey_position UNIQUE (survey_id, position)
);

CREATE TABLE IF NOT EXISTS recipients (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Invited', 'In Progress', 'Completed')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT uq_recipients_survey_email UNIQUE (survey_id, email)
);

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Draft', 'Queued', 'Sent', 'Delivered', 'Opened', 'Bounced', 'Failed')),
  provider TEXT,
  provider_message_id TEXT,
  queued_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS responses (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('voice', 'text')),
  submitted_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY,
  survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES recipients(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('individual', 'overall')),
  text TEXT NOT NULL,
  model TEXT,
  version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_questions_survey_id ON questions (survey_id);
CREATE INDEX IF NOT EXISTS idx_recipients_survey_id ON recipients (survey_id);
CREATE INDEX IF NOT EXISTS idx_invitations_survey_id ON invitations (survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_survey_id ON responses (survey_id);
CREATE INDEX IF NOT EXISTS idx_responses_recipient_id ON responses (recipient_id);
CREATE INDEX IF NOT EXISTS idx_summaries_survey_id ON summaries (survey_id);
