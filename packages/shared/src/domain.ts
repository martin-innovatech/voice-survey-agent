export type Id = string
export type ISODateTime = string

export type SurveyStatus = 'Draft' | 'Active' | 'Finalized'
export type RecipientStatus = 'Draft' | 'Invited' | 'In Progress' | 'Completed'
export type InvitationStatus =
  | 'Draft'
  | 'Queued'
  | 'Sent'
  | 'Delivered'
  | 'Opened'
  | 'Bounced'
  | 'Failed'
export type QuestionType = 'free_text'
export type ResponseSource = 'voice' | 'text'
export type SummaryScope = 'individual' | 'overall'

export interface Survey {
  id: Id
  title: string
  description?: string
  status: SurveyStatus
  createdAt: ISODateTime
  updatedAt: ISODateTime
  finalizedAt?: ISODateTime
}

export interface Question {
  id: Id
  surveyId: Id
  position: number
  prompt: string
  type: QuestionType
  required: boolean
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Recipient {
  id: Id
  surveyId: Id
  email: string
  status: RecipientStatus
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Response {
  id: Id
  surveyId: Id
  questionId: Id
  recipientId: Id
  answerText: string
  source: ResponseSource
  submittedAt: ISODateTime
}

export interface Invitation {
  id: Id
  surveyId: Id
  recipientId: Id
  email: string
  status: InvitationStatus
  provider?: string
  providerMessageId?: string
  queuedAt?: ISODateTime
  sentAt?: ISODateTime
  deliveredAt?: ISODateTime
  openedAt?: ISODateTime
  bouncedAt?: ISODateTime
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Summary {
  id: Id
  surveyId: Id
  recipientId?: Id
  scope: SummaryScope
  text: string
  model?: string
  version: number
  createdAt: ISODateTime
}
