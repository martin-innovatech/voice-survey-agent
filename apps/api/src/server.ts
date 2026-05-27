import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import cors from '@fastify/cors'
import { createPool, getDatabaseUrl } from '@voice-survey-agent/db'
import type {
  AddSurveyQuestionRequest,
  AddSurveyRecipientRequest,
  CreateSurveyRequest,
  FinalizeSurveyRequest,
  SendInvitationsRequest,
  SubmitResponseRequest
} from '@voice-survey-agent/shared/api'
import { InMemorySurveyStore } from './store.js'
import { PostgresSurveyStore } from './store.pg.js'
import type { SurveyStore } from './store.types.js'

type SurveyIdParams = { surveyId: string }

const app = Fastify({ logger: true })
let store: SurveyStore
let closeResources: (() => Promise<void>) | null = null
const corsOrigin = process.env.API_CORS_ORIGIN ?? 'http://localhost:5173'

void app.register(cors, {
  origin: corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS']
})

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseCreateSurveyRequest(body: unknown): CreateSurveyRequest {
  if (!isRecord(body) || typeof body.title !== 'string' || body.title.trim() === '') {
    throw new Error('title is required')
  }

  const request: CreateSurveyRequest = { title: body.title.trim() }
  if (typeof body.description === 'string' && body.description.trim() !== '') {
    request.description = body.description.trim()
  }
  return request
}

function parseAddQuestionRequest(body: unknown): AddSurveyQuestionRequest {
  if (!isRecord(body) || typeof body.prompt !== 'string' || body.prompt.trim() === '') {
    throw new Error('prompt is required')
  }

  const request: AddSurveyQuestionRequest = { prompt: body.prompt.trim() }

  if (typeof body.position === 'number') {
    request.position = body.position
  }
  if (typeof body.required === 'boolean') {
    request.required = body.required
  }
  return request
}

function parseAddRecipientRequest(body: unknown): AddSurveyRecipientRequest {
  if (!isRecord(body) || typeof body.email !== 'string' || body.email.trim() === '') {
    throw new Error('email is required')
  }
  return { email: body.email.trim() }
}

function parseSendInvitationsRequest(body: unknown): SendInvitationsRequest {
  if (body === undefined || body === null) {
    return {}
  }
  if (!isRecord(body)) {
    throw new Error('invalid request body')
  }
  if (body.recipientIds === undefined) {
    return {}
  }
  if (!Array.isArray(body.recipientIds) || body.recipientIds.some((id) => typeof id !== 'string')) {
    throw new Error('recipientIds must be an array of strings')
  }
  return { recipientIds: body.recipientIds }
}

function parseSubmitResponseRequest(body: unknown): SubmitResponseRequest {
  if (!isRecord(body)) {
    throw new Error('invalid request body')
  }
  if (typeof body.recipientId !== 'string' || body.recipientId.trim() === '') {
    throw new Error('recipientId is required')
  }
  if (typeof body.questionId !== 'string' || body.questionId.trim() === '') {
    throw new Error('questionId is required')
  }
  if (typeof body.answerText !== 'string' || body.answerText.trim() === '') {
    throw new Error('answerText is required')
  }
  if (body.source !== 'voice' && body.source !== 'text') {
    throw new Error('source must be voice or text')
  }

  return {
    recipientId: body.recipientId,
    questionId: body.questionId,
    answerText: body.answerText,
    source: body.source
  }
}

function parseFinalizeSurveyRequest(body: unknown): FinalizeSurveyRequest {
  if (!isRecord(body) || typeof body.includeIndividualSummaries !== 'boolean') {
    throw new Error('includeIndividualSummaries must be boolean')
  }
  return { includeIndividualSummaries: body.includeIndividualSummaries }
}

function sendHandledError(reply: FastifyReply, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error'
  if (message.includes('not found')) {
    void reply.status(404).send({ error: message })
    return
  }
  void reply.status(400).send({ error: message })
}

app.get('/health', async () => ({ status: 'ok' }))

app.post('/surveys', async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    const body = parseCreateSurveyRequest(request.body)
    const survey = await store.createSurvey(body)
    return reply.status(201).send(survey)
  } catch (error) {
    sendHandledError(reply, error)
  }
})

app.get('/surveys', async () => store.listSurveys())

app.post(
  '/surveys/:surveyId/questions',
  async (request: FastifyRequest<{ Params: SurveyIdParams }>, reply: FastifyReply) => {
    try {
      const body = parseAddQuestionRequest(request.body)
      const question = await store.addQuestion(request.params.surveyId, body)
      return reply.status(201).send(question)
    } catch (error) {
      sendHandledError(reply, error)
    }
  }
)

app.post(
  '/surveys/:surveyId/recipients',
  async (request: FastifyRequest<{ Params: SurveyIdParams }>, reply: FastifyReply) => {
    try {
      const body = parseAddRecipientRequest(request.body)
      const recipient = await store.addRecipient(request.params.surveyId, body)
      return reply.status(201).send(recipient)
    } catch (error) {
      sendHandledError(reply, error)
    }
  }
)

app.post(
  '/surveys/:surveyId/invitations:send',
  async (request: FastifyRequest<{ Params: SurveyIdParams }>, reply: FastifyReply) => {
    try {
      const body = parseSendInvitationsRequest(request.body)
      const result = await store.sendInvitations(request.params.surveyId, body)
      return reply.status(202).send(result)
    } catch (error) {
      sendHandledError(reply, error)
    }
  }
)

app.post(
  '/surveys/:surveyId/responses',
  async (request: FastifyRequest<{ Params: SurveyIdParams }>, reply: FastifyReply) => {
    try {
      const body = parseSubmitResponseRequest(request.body)
      const response = await store.submitResponse(request.params.surveyId, body)
      return reply.status(201).send(response)
    } catch (error) {
      sendHandledError(reply, error)
    }
  }
)

app.post(
  '/surveys/:surveyId/finalize',
  async (request: FastifyRequest<{ Params: SurveyIdParams }>, reply: FastifyReply) => {
    try {
      const body = parseFinalizeSurveyRequest(request.body)
      const aggregate = await store.finalizeSurvey(request.params.surveyId, body)
      return reply.status(200).send(aggregate)
    } catch (error) {
      sendHandledError(reply, error)
    }
  }
)

app.get(
  '/surveys/:surveyId',
  async (request: FastifyRequest<{ Params: SurveyIdParams }>, reply: FastifyReply) => {
    try {
      const aggregate = await store.getSurveyAggregate(request.params.surveyId)
      return reply.status(200).send(aggregate)
    } catch (error) {
      sendHandledError(reply, error)
    }
  }
)

async function bootstrapStore(): Promise<void> {
  if (process.env.USE_IN_MEMORY_STORE === 'true') {
    app.log.warn('Using in-memory store (USE_IN_MEMORY_STORE=true).')
    store = new InMemorySurveyStore()
    return
  }

  const pool = createPool(getDatabaseUrl())
  await pool.query('SELECT 1')
  store = new PostgresSurveyStore(pool)
  closeResources = async () => {
    await pool.end()
  }
  app.log.info('Using Postgres-backed store.')
}

const port = Number(process.env.PORT ?? 3000)
const host = process.env.HOST ?? '0.0.0.0'

bootstrapStore()
  .then(async () => {
    await app.listen({ port, host })
    app.log.info(`API listening on http://${host}:${port}`)
  })
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })

app.addHook('onClose', async () => {
  if (closeResources) {
    await closeResources()
  }
})
