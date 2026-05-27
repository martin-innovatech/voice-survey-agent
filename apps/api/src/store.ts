import { randomUUID } from 'node:crypto'
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

export class InMemorySurveyStore {
  private surveys = new Map<Id, Survey>()
  private questions = new Map<Id, Question>()
  private recipients = new Map<Id, Recipient>()
  private responses = new Map<Id, Response>()
  private invitations = new Map<Id, Invitation>()
  private summaries = new Map<Id, Summary>()

  listSurveys(): Survey[] {
    return Array.from(this.surveys.values())
  }

  createSurvey(input: CreateSurveyRequest): Survey {
    const timestamp = nowIso()
    const survey: Survey = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: 'Draft',
      createdAt: timestamp,
      updatedAt: timestamp
    }
    this.surveys.set(survey.id, survey)
    return survey
  }

  addQuestion(surveyId: Id, input: AddSurveyQuestionRequest): Question {
    this.requireSurvey(surveyId)

    const surveyQuestions = this.getQuestionsForSurvey(surveyId)
    const nextPosition = surveyQuestions.length + 1
    const position = input.position ?? nextPosition
    if (surveyQuestions.some((question) => question.position === position)) {
      throw new Error(`Question position ${position} already exists for survey ${surveyId}`)
    }

    const timestamp = nowIso()
    const question: Question = {
      id: randomUUID(),
      surveyId,
      position,
      prompt: input.prompt,
      type: 'free_text',
      required: input.required ?? true,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    this.questions.set(question.id, question)
    this.touchSurvey(surveyId)
    return question
  }

  addRecipient(surveyId: Id, input: AddSurveyRecipientRequest): Recipient {
    this.requireSurvey(surveyId)
    const normalizedEmail = input.email.trim().toLowerCase()
    const existing = this.getRecipientsForSurvey(surveyId).some(
      (recipient) => recipient.email === normalizedEmail
    )
    if (existing) {
      throw new Error(`Recipient with email ${normalizedEmail} already exists for survey ${surveyId}`)
    }

    const timestamp = nowIso()
    const recipient: Recipient = {
      id: randomUUID(),
      surveyId,
      email: normalizedEmail,
      status: 'Draft',
      createdAt: timestamp,
      updatedAt: timestamp
    }

    this.recipients.set(recipient.id, recipient)
    this.touchSurvey(surveyId)
    return recipient
  }

  sendInvitations(surveyId: Id, input: SendInvitationsRequest = {}): { queued: number } {
    this.requireSurvey(surveyId)

    const allRecipients = this.getRecipientsForSurvey(surveyId)
    const targets = input.recipientIds?.length
      ? allRecipients.filter((recipient) => input.recipientIds?.includes(recipient.id))
      : allRecipients

    const timestamp = nowIso()
    for (const recipient of targets) {
      const invitation: Invitation = {
        id: randomUUID(),
        surveyId,
        recipientId: recipient.id,
        email: recipient.email,
        status: 'Sent',
        queuedAt: timestamp,
        sentAt: timestamp,
        createdAt: timestamp,
        updatedAt: timestamp
      }
      this.invitations.set(invitation.id, invitation)

      if (recipient.status === 'Draft') {
        this.recipients.set(recipient.id, {
          ...recipient,
          status: 'Invited',
          updatedAt: timestamp
        })
      }
    }

    this.touchSurvey(surveyId)
    return { queued: targets.length }
  }

  submitResponse(surveyId: Id, input: SubmitResponseRequest): Response {
    this.requireSurvey(surveyId)

    const question = this.questions.get(input.questionId)
    if (!question || question.surveyId !== surveyId) {
      throw new Error(`Question ${input.questionId} not found for survey ${surveyId}`)
    }

    const recipient = this.recipients.get(input.recipientId)
    if (!recipient || recipient.surveyId !== surveyId) {
      throw new Error(`Recipient ${input.recipientId} not found for survey ${surveyId}`)
    }

    const response: Response = {
      id: randomUUID(),
      surveyId,
      questionId: input.questionId,
      recipientId: input.recipientId,
      answerText: input.answerText,
      source: input.source,
      submittedAt: nowIso()
    }
    this.responses.set(response.id, response)

    const questionCount = this.getQuestionsForSurvey(surveyId).length
    const answeredQuestionIds = new Set(
      this.getResponsesForSurvey(surveyId)
        .filter((entry) => entry.recipientId === input.recipientId)
        .map((entry) => entry.questionId)
    )

    const status =
      questionCount > 0 && answeredQuestionIds.size >= questionCount
        ? 'Completed'
        : 'In Progress'

    this.recipients.set(recipient.id, {
      ...recipient,
      status,
      updatedAt: nowIso()
    })

    this.touchSurvey(surveyId)
    return response
  }

  finalizeSurvey(surveyId: Id, input: FinalizeSurveyRequest): SurveyAggregate {
    const survey = this.requireSurvey(surveyId)
    const timestamp = nowIso()

    this.removeSummariesForSurvey(surveyId)

    if (input.includeIndividualSummaries) {
      for (const recipient of this.getRecipientsForSurvey(surveyId)) {
        const recipientResponses = this.getResponsesForSurvey(surveyId).filter(
          (response) => response.recipientId === recipient.id
        )
        const lines = recipientResponses.map((response) => response.answerText)

        const summary: Summary = {
          id: randomUUID(),
          surveyId,
          recipientId: recipient.id,
          scope: 'individual',
          text: summarizeLines(lines),
          version: 1,
          createdAt: timestamp
        }
        this.summaries.set(summary.id, summary)
      }
    }

    const overallLines = this.getResponsesForSurvey(surveyId).map((response) => response.answerText)
    const overallSummary: Summary = {
      id: randomUUID(),
      surveyId,
      scope: 'overall',
      text: summarizeLines(overallLines),
      version: 1,
      createdAt: timestamp
    }
    this.summaries.set(overallSummary.id, overallSummary)

    this.surveys.set(surveyId, {
      ...survey,
      status: 'Finalized',
      finalizedAt: timestamp,
      updatedAt: timestamp
    })

    return this.getSurveyAggregate(surveyId)
  }

  getSurveyAggregate(surveyId: Id): SurveyAggregate {
    const survey = this.requireSurvey(surveyId)
    return {
      survey,
      questions: this.getQuestionsForSurvey(surveyId),
      recipients: this.getRecipientsForSurvey(surveyId),
      invitations: this.getInvitationsForSurvey(surveyId),
      responses: this.getResponsesForSurvey(surveyId),
      summaries: this.getSummariesForSurvey(surveyId)
    }
  }

  private requireSurvey(surveyId: Id): Survey {
    const survey = this.surveys.get(surveyId)
    if (!survey) {
      throw new Error(`Survey ${surveyId} not found`)
    }
    return survey
  }

  private touchSurvey(surveyId: Id): void {
    const survey = this.requireSurvey(surveyId)
    this.surveys.set(surveyId, {
      ...survey,
      status: survey.status === 'Draft' ? 'Active' : survey.status,
      updatedAt: nowIso()
    })
  }

  private getQuestionsForSurvey(surveyId: Id): Question[] {
    return Array.from(this.questions.values())
      .filter((question) => question.surveyId === surveyId)
      .sort((left, right) => left.position - right.position)
  }

  private getRecipientsForSurvey(surveyId: Id): Recipient[] {
    return Array.from(this.recipients.values()).filter(
      (recipient) => recipient.surveyId === surveyId
    )
  }

  private getInvitationsForSurvey(surveyId: Id): Invitation[] {
    return Array.from(this.invitations.values()).filter(
      (invitation) => invitation.surveyId === surveyId
    )
  }

  private getResponsesForSurvey(surveyId: Id): Response[] {
    return Array.from(this.responses.values()).filter(
      (response) => response.surveyId === surveyId
    )
  }

  private getSummariesForSurvey(surveyId: Id): Summary[] {
    return Array.from(this.summaries.values()).filter(
      (summary) => summary.surveyId === surveyId
    )
  }

  private removeSummariesForSurvey(surveyId: Id): void {
    for (const summary of this.getSummariesForSurvey(surveyId)) {
      this.summaries.delete(summary.id)
    }
  }
}
