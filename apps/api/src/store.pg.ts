import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type {
  AddSurveyQuestionRequest,
  AddSurveyRecipientRequest,
  CreateSurveyRequest,
  FinalizeSurveyRequest,
  SendInvitationsRequest,
  SubmitResponseRequest,
  SurveyAggregate
} from '@voice-survey-agent/shared/api'
import type {
  Id,
  Invitation,
  Question,
  Recipient,
  Response,
  Summary,
  Survey
} from '@voice-survey-agent/shared/domain'
import type { SurveyStore } from './store.types.js'

interface SurveyRow {
  id: string
  title: string
  description: string | null
  status: Survey['status']
  created_at: string
  updated_at: string
  finalized_at: string | null
}

interface QuestionRow {
  id: string
  survey_id: string
  position: number
  prompt: string
  type: Question['type']
  required: boolean
  created_at: string
  updated_at: string
}

interface RecipientRow {
  id: string
  survey_id: string
  email: string
  status: Recipient['status']
  created_at: string
  updated_at: string
}

interface ResponseRow {
  id: string
  survey_id: string
  question_id: string
  recipient_id: string
  answer_text: string
  source: Response['source']
  submitted_at: string
}

interface InvitationRow {
  id: string
  survey_id: string
  recipient_id: string
  email: string
  status: Invitation['status']
  provider: string | null
  provider_message_id: string | null
  queued_at: string | null
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  bounced_at: string | null
  created_at: string
  updated_at: string
}

interface SummaryRow {
  id: string
  survey_id: string
  recipient_id: string | null
  scope: Summary['scope']
  text: string
  model: string | null
  version: number
  created_at: string
}

function nowIso(): string {
  return new Date().toISOString()
}

function summarizeLines(lines: string[]): string {
  const cleaned = lines.map((line) => line.trim()).filter(Boolean)
  if (cleaned.length === 0) {
    return 'No submitted answers yet.'
  }
  return cleaned.slice(0, 3).join(' | ')
}

function mapSurvey(row: SurveyRow): Survey {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finalizedAt: row.finalized_at ?? undefined
  }
}

function mapQuestion(row: QuestionRow): Question {
  return {
    id: row.id,
    surveyId: row.survey_id,
    position: row.position,
    prompt: row.prompt,
    type: row.type,
    required: row.required,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapRecipient(row: RecipientRow): Recipient {
  return {
    id: row.id,
    surveyId: row.survey_id,
    email: row.email,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapResponse(row: ResponseRow): Response {
  return {
    id: row.id,
    surveyId: row.survey_id,
    questionId: row.question_id,
    recipientId: row.recipient_id,
    answerText: row.answer_text,
    source: row.source,
    submittedAt: row.submitted_at
  }
}

function mapInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    surveyId: row.survey_id,
    recipientId: row.recipient_id,
    email: row.email,
    status: row.status,
    provider: row.provider ?? undefined,
    providerMessageId: row.provider_message_id ?? undefined,
    queuedAt: row.queued_at ?? undefined,
    sentAt: row.sent_at ?? undefined,
    deliveredAt: row.delivered_at ?? undefined,
    openedAt: row.opened_at ?? undefined,
    bouncedAt: row.bounced_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function mapSummary(row: SummaryRow): Summary {
  return {
    id: row.id,
    surveyId: row.survey_id,
    recipientId: row.recipient_id ?? undefined,
    scope: row.scope,
    text: row.text,
    model: row.model ?? undefined,
    version: row.version,
    createdAt: row.created_at
  }
}

export class PostgresSurveyStore implements SurveyStore {
  constructor(private readonly pool: Pool) {}

  async listSurveys(): Promise<Survey[]> {
    const result = await this.pool.query<SurveyRow>(
      'SELECT * FROM surveys ORDER BY created_at DESC'
    )
    return result.rows.map(mapSurvey)
  }

  async createSurvey(input: CreateSurveyRequest): Promise<Survey> {
    const timestamp = nowIso()
    const id = randomUUID()
    const result = await this.pool.query<SurveyRow>(
      `INSERT INTO surveys (id, title, description, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'Draft', $4, $4)
       RETURNING *`,
      [id, input.title, input.description ?? null, timestamp]
    )
    return mapSurvey(result.rows[0])
  }

  async addQuestion(surveyId: Id, input: AddSurveyQuestionRequest): Promise<Question> {
    await this.requireSurvey(surveyId)
    const position = input.position ?? ((await this.getQuestionCount(surveyId)) + 1)
    const id = randomUUID()
    const timestamp = nowIso()

    try {
      const result = await this.pool.query<QuestionRow>(
        `INSERT INTO questions (id, survey_id, position, prompt, type, required, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'free_text', $5, $6, $6)
         RETURNING *`,
        [id, surveyId, position, input.prompt, input.required ?? true, timestamp]
      )
      await this.touchSurvey(surveyId)
      return mapQuestion(result.rows[0])
    } catch (error) {
      this.normalizeUniqueError(error, `Question position ${position} already exists for survey ${surveyId}`)
      throw error
    }
  }

  async addRecipient(surveyId: Id, input: AddSurveyRecipientRequest): Promise<Recipient> {
    await this.requireSurvey(surveyId)
    const id = randomUUID()
    const timestamp = nowIso()
    const email = input.email.trim().toLowerCase()

    try {
      const result = await this.pool.query<RecipientRow>(
        `INSERT INTO recipients (id, survey_id, email, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'Draft', $4, $4)
         RETURNING *`,
        [id, surveyId, email, timestamp]
      )
      await this.touchSurvey(surveyId)
      return mapRecipient(result.rows[0])
    } catch (error) {
      this.normalizeUniqueError(error, `Recipient with email ${email} already exists for survey ${surveyId}`)
      throw error
    }
  }

  async sendInvitations(surveyId: Id, input: SendInvitationsRequest = {}): Promise<{ queued: number }> {
    await this.requireSurvey(surveyId)

    const recipientsResult = await this.pool.query<RecipientRow>(
      input.recipientIds?.length
        ? 'SELECT * FROM recipients WHERE survey_id = $1 AND id = ANY($2::uuid[])'
        : 'SELECT * FROM recipients WHERE survey_id = $1',
      input.recipientIds?.length ? [surveyId, input.recipientIds] : [surveyId]
    )

    const recipients = recipientsResult.rows
    const timestamp = nowIso()

    for (const recipient of recipients) {
      await this.pool.query(
        `INSERT INTO invitations (
          id, survey_id, recipient_id, email, status, queued_at, sent_at, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'Sent', $5, $5, $5, $5)`,
        [randomUUID(), surveyId, recipient.id, recipient.email, timestamp]
      )

      if (recipient.status === 'Draft') {
        await this.pool.query(
          `UPDATE recipients SET status = 'Invited', updated_at = $2 WHERE id = $1`,
          [recipient.id, timestamp]
        )
      }
    }

    await this.touchSurvey(surveyId)
    return { queued: recipients.length }
  }

  async submitResponse(surveyId: Id, input: SubmitResponseRequest): Promise<Response> {
    await this.requireSurvey(surveyId)

    const questionResult = await this.pool.query<QuestionRow>(
      'SELECT * FROM questions WHERE id = $1 AND survey_id = $2',
      [input.questionId, surveyId]
    )
    if (questionResult.rowCount === 0) {
      throw new Error(`Question ${input.questionId} not found for survey ${surveyId}`)
    }

    const recipientResult = await this.pool.query<RecipientRow>(
      'SELECT * FROM recipients WHERE id = $1 AND survey_id = $2',
      [input.recipientId, surveyId]
    )
    if (recipientResult.rowCount === 0) {
      throw new Error(`Recipient ${input.recipientId} not found for survey ${surveyId}`)
    }

    const id = randomUUID()
    const timestamp = nowIso()
    const responseResult = await this.pool.query<ResponseRow>(
      `INSERT INTO responses (id, survey_id, question_id, recipient_id, answer_text, source, submitted_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, surveyId, input.questionId, input.recipientId, input.answerText, input.source, timestamp]
    )

    const countsResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM questions WHERE survey_id = $1`,
      [surveyId]
    )
    const answeredResult = await this.pool.query<{ total: string }>(
      `SELECT COUNT(DISTINCT question_id) AS total FROM responses WHERE survey_id = $1 AND recipient_id = $2`,
      [surveyId, input.recipientId]
    )

    const totalQuestions = Number(countsResult.rows[0]?.total ?? '0')
    const answeredQuestions = Number(answeredResult.rows[0]?.total ?? '0')

    const recipientStatus =
      totalQuestions > 0 && answeredQuestions >= totalQuestions
        ? 'Completed'
        : 'In Progress'

    await this.pool.query(
      `UPDATE recipients SET status = $2, updated_at = $3 WHERE id = $1`,
      [input.recipientId, recipientStatus, timestamp]
    )

    await this.touchSurvey(surveyId)
    return mapResponse(responseResult.rows[0])
  }

  async finalizeSurvey(surveyId: Id, input: FinalizeSurveyRequest): Promise<SurveyAggregate> {
    await this.requireSurvey(surveyId)
    const timestamp = nowIso()

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      await client.query('DELETE FROM summaries WHERE survey_id = $1', [surveyId])

      if (input.includeIndividualSummaries) {
        const recipients = await client.query<RecipientRow>(
          'SELECT * FROM recipients WHERE survey_id = $1',
          [surveyId]
        )

        for (const recipient of recipients.rows) {
          const responses = await client.query<ResponseRow>(
            `SELECT * FROM responses WHERE survey_id = $1 AND recipient_id = $2 ORDER BY submitted_at ASC`,
            [surveyId, recipient.id]
          )

          const text = summarizeLines(responses.rows.map((row) => row.answer_text))
          await client.query(
            `INSERT INTO summaries (id, survey_id, recipient_id, scope, text, version, created_at)
             VALUES ($1, $2, $3, 'individual', $4, 1, $5)`,
            [randomUUID(), surveyId, recipient.id, text, timestamp]
          )
        }
      }

      const overallResponses = await client.query<ResponseRow>(
        `SELECT * FROM responses WHERE survey_id = $1 ORDER BY submitted_at ASC`,
        [surveyId]
      )

      await client.query(
        `INSERT INTO summaries (id, survey_id, recipient_id, scope, text, version, created_at)
         VALUES ($1, $2, NULL, 'overall', $3, 1, $4)`,
        [
          randomUUID(),
          surveyId,
          summarizeLines(overallResponses.rows.map((row) => row.answer_text)),
          timestamp
        ]
      )

      await client.query(
        `UPDATE surveys
         SET status = 'Finalized', finalized_at = $2, updated_at = $2
         WHERE id = $1`,
        [surveyId, timestamp]
      )

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }

    return this.getSurveyAggregate(surveyId)
  }

  async getSurveyAggregate(surveyId: Id): Promise<SurveyAggregate> {
    const survey = await this.requireSurvey(surveyId)

    const [questionsResult, recipientsResult, invitationsResult, responsesResult, summariesResult] =
      await Promise.all([
        this.pool.query<QuestionRow>(
          'SELECT * FROM questions WHERE survey_id = $1 ORDER BY position ASC',
          [surveyId]
        ),
        this.pool.query<RecipientRow>(
          'SELECT * FROM recipients WHERE survey_id = $1 ORDER BY created_at ASC',
          [surveyId]
        ),
        this.pool.query<InvitationRow>(
          'SELECT * FROM invitations WHERE survey_id = $1 ORDER BY created_at ASC',
          [surveyId]
        ),
        this.pool.query<ResponseRow>(
          'SELECT * FROM responses WHERE survey_id = $1 ORDER BY submitted_at ASC',
          [surveyId]
        ),
        this.pool.query<SummaryRow>(
          'SELECT * FROM summaries WHERE survey_id = $1 ORDER BY created_at ASC',
          [surveyId]
        )
      ])

    return {
      survey,
      questions: questionsResult.rows.map(mapQuestion),
      recipients: recipientsResult.rows.map(mapRecipient),
      invitations: invitationsResult.rows.map(mapInvitation),
      responses: responsesResult.rows.map(mapResponse),
      summaries: summariesResult.rows.map(mapSummary)
    }
  }

  private async requireSurvey(surveyId: Id): Promise<Survey> {
    const result = await this.pool.query<SurveyRow>(
      'SELECT * FROM surveys WHERE id = $1',
      [surveyId]
    )
    if (result.rowCount === 0) {
      throw new Error(`Survey ${surveyId} not found`)
    }
    return mapSurvey(result.rows[0])
  }

  private async getQuestionCount(surveyId: Id): Promise<number> {
    const result = await this.pool.query<{ total: string }>(
      'SELECT COUNT(*) AS total FROM questions WHERE survey_id = $1',
      [surveyId]
    )
    return Number(result.rows[0]?.total ?? '0')
  }

  private async touchSurvey(surveyId: Id): Promise<void> {
    await this.pool.query(
      `UPDATE surveys
       SET status = CASE WHEN status = 'Draft' THEN 'Active' ELSE status END,
           updated_at = $2
       WHERE id = $1`,
      [surveyId, nowIso()]
    )
  }

  private normalizeUniqueError(error: unknown, message: string): void {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === '23505'
    ) {
      throw new Error(message)
    }
  }
}
