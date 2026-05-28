import type {
  AddSurveyQuestionRequest,
  AddSurveyRecipientRequest,
  CreateSurveyRequest,
  EditSurveyQuestionRequest,
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
  editQuestion(surveyId: Id, questionId: Id, input: EditSurveyQuestionRequest): Promise<Question>
  deleteQuestion(surveyId: Id, questionId: Id): Promise<Question>
  addRecipient(surveyId: Id, input: AddSurveyRecipientRequest): Promise<Recipient>
  sendInvitations(surveyId: Id, input?: SendInvitationsRequest): Promise<{ queued: number }>
  submitResponse(surveyId: Id, input: SubmitResponseRequest): Promise<Response>
  finalizeSurvey(surveyId: Id, input: FinalizeSurveyRequest): Promise<SurveyAggregate>
  getSurveyAggregate(surveyId: Id): Promise<SurveyAggregate>
}
