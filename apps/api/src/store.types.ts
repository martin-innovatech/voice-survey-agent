import type {
  AddSurveyQuestionRequest,
  AddSurveyRecipientRequest,
  CreateSurveyRequest,
  FinalizeSurveyRequest,
  SendInvitationsRequest,
  SubmitResponseRequest,
  SurveyAggregate
} from '@voice-survey-agent/shared/api'
import type { Id, Question, Recipient, Response, Survey } from '@voice-survey-agent/shared/domain'

export interface SurveyStore {
  listSurveys(): Promise<Survey[]>
  createSurvey(input: CreateSurveyRequest): Promise<Survey>
  addQuestion(surveyId: Id, input: AddSurveyQuestionRequest): Promise<Question>
  addRecipient(surveyId: Id, input: AddSurveyRecipientRequest): Promise<Recipient>
  sendInvitations(surveyId: Id, input?: SendInvitationsRequest): Promise<{ queued: number }>
  submitResponse(surveyId: Id, input: SubmitResponseRequest): Promise<Response>
  finalizeSurvey(surveyId: Id, input: FinalizeSurveyRequest): Promise<SurveyAggregate>
  getSurveyAggregate(surveyId: Id): Promise<SurveyAggregate>
}
