import type {
  Id,
  Invitation,
  Question,
  QuestionType,
  Recipient,
  Response,
  Summary,
  Survey
} from './domain.js'

export interface CreateSurveyRequest {
  title: string
  description?: string
}

export interface AddSurveyQuestionRequest {
  prompt: string
  type?: QuestionType
  position?: number
  required?: boolean
}

export interface EditSurveyQuestionRequest {
  prompt?: string
  type?: QuestionType
  required?: boolean
}

export interface AddSurveyRecipientRequest {
  email: string
}

export interface SendInvitationsRequest {
  recipientIds?: Id[]
}

export interface SubmitResponseRequest {
  recipientId: Id
  questionId: Id
  answerText: string
  source: 'voice' | 'text'
}

export interface FinalizeSurveyRequest {
  includeIndividualSummaries: boolean
}

export interface SurveyAggregate {
  survey: Survey
  questions: Question[]
  recipients: Recipient[]
  invitations: Invitation[]
  responses: Response[]
  summaries: Summary[]
}
