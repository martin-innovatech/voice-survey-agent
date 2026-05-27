import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  SurveyAggregate,
  AddSurveyQuestionRequest,
  AddSurveyRecipientRequest,
  CreateSurveyRequest,
  FinalizeSurveyRequest,
  SendInvitationsRequest,
  SubmitResponseRequest
} from '@voice-survey-agent/shared/api'
import type {
  Question,
  Recipient,
  Response as SurveyResponse,
  Summary,
  Survey
} from '@voice-survey-agent/shared/domain'
import './App.css'

type VoiceWindow = Window & {
  SpeechRecognition?: new () => {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onerror: (() => void) | null
    onend: (() => void) | null
    start: () => void
  }
  webkitSpeechRecognition?: new () => {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
    onerror: (() => void) | null
    onend: (() => void) | null
    start: () => void
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function summarizeAnswers(answers: string[]): string {
  const cleaned = answers.map((item) => item.trim()).filter(Boolean)
  if (cleaned.length === 0) {
    return 'No submitted answers yet.'
  }
  return cleaned.slice(0, 3).join(' | ')
}

function toStatusClass(status: string): string {
  return status.replace(' ', '-').toLowerCase()
}

function App() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [aggregatesBySurveyId, setAggregatesBySurveyId] = useState<Record<string, SurveyAggregate>>({})

  const [activeTab, setActiveTab] = useState<'admin' | 'user' | 'reports'>('admin')
  const [selectedSurveyId, setSelectedSurveyId] = useState('')
  const [selectedRecipientId, setSelectedRecipientId] = useState('')

  const [newSurveyTitle, setNewSurveyTitle] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newRecipientEmail, setNewRecipientEmail] = useState('')

  const [questionIndex, setQuestionIndex] = useState(0)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [draftSource, setDraftSource] = useState<'voice' | 'text'>('text')
  const [isListening, setIsListening] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [isMutating, setIsMutating] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [log, setLog] = useState('Ready to start survey conversation.')

  async function apiRequest<TResponse>(path: string, init?: RequestInit): Promise<TResponse> {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers
      }
    })

    if (!response.ok) {
      let message = `Request failed (${response.status})`
      try {
        const payload = (await response.json()) as { error?: string }
        if (payload.error) {
          message = payload.error
        }
      } catch {
        // Keep default status-based message when body is not JSON.
      }
      throw new Error(message)
    }

    return (await response.json()) as TResponse
  }

  const reloadData = useCallback(async (preferredSurveyId?: string): Promise<void> => {
    setIsLoading(true)
    setErrorMessage('')

    try {
      const surveyList = await apiRequest<Survey[]>('/surveys')
      setSurveys(surveyList)

      if (surveyList.length === 0) {
        setAggregatesBySurveyId({})
        setSelectedSurveyId('')
        setSelectedRecipientId('')
        setIsLoading(false)
        return
      }

      const aggregateEntries = await Promise.all(
        surveyList.map(async (survey) => {
          const aggregate = await apiRequest<SurveyAggregate>(`/surveys/${survey.id}`)
          return [survey.id, aggregate] as const
        })
      )
      setAggregatesBySurveyId(Object.fromEntries(aggregateEntries))

      setSelectedSurveyId((currentSelectedId) => {
        const fallbackSelectedId = preferredSurveyId ?? currentSelectedId
        const hasFallback = surveyList.some((survey) => survey.id === fallbackSelectedId)
        return hasFallback ? fallbackSelectedId : surveyList[0].id
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load data.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reloadData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [reloadData])

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === selectedSurveyId),
    [surveys, selectedSurveyId]
  )

  const selectedAggregate = selectedSurveyId ? aggregatesBySurveyId[selectedSurveyId] : undefined

  const questions = useMemo(() => {
    const items = selectedAggregate?.questions ?? []
    return [...items].sort((left, right) => left.position - right.position)
  }, [selectedAggregate])

  const recipients = useMemo(() => selectedAggregate?.recipients ?? [], [selectedAggregate])
  const responses = useMemo(() => selectedAggregate?.responses ?? [], [selectedAggregate])
  const summaries = useMemo(() => selectedAggregate?.summaries ?? [], [selectedAggregate])

  const selectedRecipientIdValue = recipients.some(
    (recipient) => recipient.id === selectedRecipientId
  )
    ? selectedRecipientId
    : (recipients[0]?.id ?? '')

  const selectedRecipient = useMemo(
    () => recipients.find((recipient) => recipient.id === selectedRecipientIdValue),
    [recipients, selectedRecipientIdValue]
  )

  const safeQuestionIndex = questions.length > 0 ? Math.min(questionIndex, questions.length - 1) : 0
  const currentQuestion = questions[safeQuestionIndex]

  const responseByRecipientQuestion = useMemo(() => {
    const map = new Map<string, SurveyResponse>()
    const sorted = [...responses].sort((left, right) => {
      return new Date(left.submittedAt).getTime() - new Date(right.submittedAt).getTime()
    })
    for (const item of sorted) {
      map.set(`${item.recipientId}:${item.questionId}`, item)
    }
    return map
  }, [responses])

  const individualSummaryByRecipient = useMemo(() => {
    const map = new Map<string, Summary>()
    for (const summary of summaries) {
      if (summary.scope === 'individual' && summary.recipientId) {
        map.set(summary.recipientId, summary)
      }
    }
    return map
  }, [summaries])

  const overallSummary = useMemo(() => {
    const overall = summaries
      .filter((summary) => summary.scope === 'overall')
      .sort((left, right) => {
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      })
    return overall[0]
  }, [summaries])

  const totals = useMemo(() => {
    const surveyCount = surveys.length
    const finalizedCount = surveys.filter((survey) => survey.status === 'Finalized').length

    let invitedCount = 0
    let completedCount = 0

    for (const aggregate of Object.values(aggregatesBySurveyId)) {
      for (const recipient of aggregate.recipients) {
        if (recipient.status !== 'Draft') {
          invitedCount += 1
        }
        if (recipient.status === 'Completed') {
          completedCount += 1
        }
      }
    }

    return { surveyCount, finalizedCount, invitedCount, completedCount }
  }, [surveys, aggregatesBySurveyId])

  function answersForRecipient(recipient: Recipient): string[] {
    return questions.map((question) => {
      return responseByRecipientQuestion.get(`${recipient.id}:${question.id}`)?.answerText ?? ''
    })
  }

  function lastSubmittedAt(recipient: Recipient): string | undefined {
    const submittedAtValues = responses
      .filter((response) => response.recipientId === recipient.id)
      .map((response) => response.submittedAt)
      .sort((left, right) => new Date(right).getTime() - new Date(left).getTime())

    return submittedAtValues[0]
  }

  async function createSurvey(): Promise<void> {
    const title = newSurveyTitle.trim()
    if (!title) {
      return
    }

    const payload: CreateSurveyRequest = { title }
    setIsMutating(true)

    try {
      const survey = await apiRequest<Survey>('/surveys', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setNewSurveyTitle('')
      setLog('New survey created.')
      await reloadData(survey.id)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create survey.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsMutating(false)
    }
  }

  async function addQuestion(): Promise<void> {
    const prompt = newQuestion.trim()
    if (!prompt || !selectedSurveyId) {
      return
    }

    const payload: AddSurveyQuestionRequest = { prompt }
    setIsMutating(true)

    try {
      await apiRequest<Question>(`/surveys/${selectedSurveyId}/questions`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setNewQuestion('')
      setLog('Question added.')
      await reloadData(selectedSurveyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add question.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsMutating(false)
    }
  }

  async function addRecipient(): Promise<void> {
    const email = newRecipientEmail.trim().toLowerCase()
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValidEmail || !selectedSurveyId) {
      setLog('Provide a valid email address.')
      return
    }

    const payload: AddSurveyRecipientRequest = { email }
    setIsMutating(true)

    try {
      await apiRequest<Recipient>(`/surveys/${selectedSurveyId}/recipients`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setNewRecipientEmail('')
      setLog('Recipient added in draft state.')
      await reloadData(selectedSurveyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add recipient.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsMutating(false)
    }
  }

  async function sendInvitations(): Promise<void> {
    if (!selectedSurveyId) {
      return
    }

    const payload: SendInvitationsRequest = {}
    setIsMutating(true)

    try {
      const result = await apiRequest<{ queued: number }>(
        `/surveys/${selectedSurveyId}/invitations:send`,
        {
          method: 'POST',
          body: JSON.stringify(payload)
        }
      )

      setLog(`Invitations queued: ${result.queued}.`)
      await reloadData(selectedSurveyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to send invitations.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsMutating(false)
    }
  }

  async function finalizeSurvey(): Promise<void> {
    if (!selectedSurveyId) {
      return
    }

    const payload: FinalizeSurveyRequest = { includeIndividualSummaries: true }
    setIsMutating(true)

    try {
      await apiRequest<SurveyAggregate>(`/surveys/${selectedSurveyId}/finalize`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setLog('Survey finalized with individual and overall summaries.')
      await reloadData(selectedSurveyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to finalize survey.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsMutating(false)
    }
  }

  function askQuestionByVoice(): void {
    if (!currentQuestion) {
      setLog('No question available. Add at least one question.')
      return
    }
    if (!window.speechSynthesis) {
      setLog('Speech synthesis is not supported in this browser.')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(currentQuestion.prompt)
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
    setLog('Voice agent asked the question.')
  }

  function startSpeechToText(): void {
    const voiceWindow = window as VoiceWindow
    const SpeechRecognitionImpl =
      voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition

    if (!SpeechRecognitionImpl) {
      setLog('Speech recognition is not supported here. Type your answer instead.')
      return
    }

    const recognition = new SpeechRecognitionImpl()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'

    setIsListening(true)

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setDraftAnswer((previous) => `${previous} ${transcript}`.trim())
      setDraftSource('voice')
      setLog('Voice answer captured from microphone.')
    }

    recognition.onerror = () => {
      setLog('Speech recognition failed. Try again or type your answer.')
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  function pauseVoice(): void {
    window.speechSynthesis?.pause()
    setLog('Voice playback paused.')
  }

  async function submitAnswer(): Promise<void> {
    if (!selectedSurveyId || !selectedRecipient || !currentQuestion) {
      setLog('Pick a recipient and ensure a question exists before submitting.')
      return
    }

    const answer = draftAnswer.trim()
    if (!answer) {
      return
    }

    const payload: SubmitResponseRequest = {
      recipientId: selectedRecipient.id,
      questionId: currentQuestion.id,
      answerText: answer,
      source: draftSource
    }

    const isLastQuestion = safeQuestionIndex >= questions.length - 1
    setIsMutating(true)

    try {
      await apiRequest<SurveyResponse>(`/surveys/${selectedSurveyId}/responses`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      setDraftAnswer('')
      setDraftSource('text')

      if (isLastQuestion) {
        setLog('Survey finished and submitted for this participant.')
      } else {
        setQuestionIndex((current) => current + 1)
        setLog('Answer saved. Moving to next question.')
      }

      await reloadData(selectedSurveyId)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to submit answer.'
      setErrorMessage(message)
      setLog(message)
    } finally {
      setIsMutating(false)
    }
  }

  function onRecipientChange(recipientId: string): void {
    setSelectedRecipientId(recipientId)
    setQuestionIndex(0)
    setDraftAnswer('')
    setDraftSource('text')
    setLog('Conversation reset for selected participant.')
  }

  const isBusy = isLoading || isMutating

  return (
    <main className="page">
      <header className="hero">
        <h1>Voice Survey Agent</h1>
        <p>Browser PoC for TTS/STT interviews, email invitations, tracking, and written reporting.</p>
        <div className="kpi-row">
          <span>{totals.surveyCount} surveys</span>
          <span>{totals.invitedCount} invitations sent</span>
          <span>{totals.completedCount} completed responses</span>
          <span>{totals.finalizedCount} finalized reports</span>
        </div>
      </header>

      {errorMessage && (
        <section className="panel">
          <p className="log">Error: {errorMessage}</p>
        </section>
      )}

      <section className="panel">
        <div className="row wrap">
          <label htmlFor="surveyPicker">Survey</label>
          <select
            id="surveyPicker"
            value={selectedSurveyId}
            onChange={(event) => {
              setSelectedSurveyId(event.target.value)
              setSelectedRecipientId('')
              setQuestionIndex(0)
              setDraftAnswer('')
              setDraftSource('text')
            }}
            disabled={surveys.length === 0 || isBusy}
          >
            {surveys.map((survey) => (
              <option key={survey.id} value={survey.id}>
                {survey.title}
              </option>
            ))}
          </select>
          <input
            placeholder="New survey title"
            value={newSurveyTitle}
            onChange={(event) => setNewSurveyTitle(event.target.value)}
            disabled={isBusy}
          />
          <button type="button" onClick={() => void createSurvey()} disabled={isBusy}>
            Create survey
          </button>
          <button type="button" onClick={() => void reloadData(selectedSurveyId)} disabled={isBusy}>
            Refresh
          </button>
        </div>
      </section>

      <nav className="tabs" aria-label="Main views">
        <button
          type="button"
          className={activeTab === 'admin' ? 'active' : ''}
          onClick={() => setActiveTab('admin')}
        >
          Admin view
        </button>
        <button
          type="button"
          className={activeTab === 'user' ? 'active' : ''}
          onClick={() => setActiveTab('user')}
        >
          User view
        </button>
        <button
          type="button"
          className={activeTab === 'reports' ? 'active' : ''}
          onClick={() => setActiveTab('reports')}
        >
          Reports
        </button>
      </nav>

      {activeTab === 'admin' && selectedSurvey && (
        <section className="grid">
          <article className="panel">
            <h2>Survey setup</h2>
            <p className="muted">Add and manage predefined interview questions.</p>
            <div className="stack">
              {questions.map((question) => (
                <p key={question.id} className="box">
                  <strong>Q{question.position}:</strong> {question.prompt}
                </p>
              ))}
            </div>
            <div className="row">
              <input
                placeholder="Add a question"
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
                disabled={isBusy}
              />
              <button type="button" onClick={() => void addQuestion()} disabled={isBusy}>
                Add question
              </button>
            </div>
          </article>

          <article className="panel">
            <h2>Survey recipients</h2>
            <p className="muted">Invite participants by email and track participation.</p>
            <div className="stack">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="row between box">
                  <span>{recipient.email}</span>
                  <span className={`badge ${toStatusClass(recipient.status)}`}>
                    {recipient.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="row">
              <input
                placeholder="recipient@company.com"
                value={newRecipientEmail}
                onChange={(event) => setNewRecipientEmail(event.target.value)}
                disabled={isBusy}
              />
              <button type="button" onClick={() => void addRecipient()} disabled={isBusy}>
                Add recipient
              </button>
            </div>
            <div className="row wrap">
              <button type="button" onClick={() => void sendInvitations()} disabled={isBusy}>
                Send invitations
              </button>
              <button type="button" onClick={() => void finalizeSurvey()} disabled={isBusy}>
                Finalize survey
              </button>
            </div>
          </article>
        </section>
      )}

      {activeTab === 'user' && selectedSurvey && (
        <section className="panel">
          <h2>User conversation</h2>
          <p className="muted">Start, pause, and finish/submit answers in the browser.</p>

          <div className="row wrap">
            <label htmlFor="recipientPicker">Participant</label>
            <select
              id="recipientPicker"
              value={selectedRecipientIdValue}
              onChange={(event) => onRecipientChange(event.target.value)}
              disabled={recipients.length === 0 || isBusy}
            >
              {recipients.map((recipient) => (
                <option key={recipient.id} value={recipient.id}>
                  {recipient.email}
                </option>
              ))}
            </select>
          </div>

          <div className="box">
            <p className="muted">
              Question {questions.length === 0 ? 0 : safeQuestionIndex + 1} of {questions.length}
            </p>
            <p className="question">{currentQuestion?.prompt ?? 'Add survey questions in Admin view.'}</p>
          </div>

          <div className="row wrap">
            <button type="button" onClick={askQuestionByVoice} disabled={isBusy}>
              Start / Ask
            </button>
            <button type="button" onClick={startSpeechToText} disabled={isBusy}>
              {isListening ? 'Listening...' : 'Answer by voice'}
            </button>
            <button type="button" onClick={pauseVoice} disabled={isBusy}>
              Pause
            </button>
            <button type="button" onClick={() => void submitAnswer()} disabled={isBusy}>
              Finish / Submit answer
            </button>
          </div>

          <textarea
            rows={5}
            value={draftAnswer}
            onChange={(event) => {
              setDraftAnswer(event.target.value)
              setDraftSource('text')
            }}
            placeholder="Transcript or typed answer"
            disabled={isBusy}
          />

          <p className="log">{log}</p>
        </section>
      )}

      {activeTab === 'reports' && (
        <section className="stack">
          <article className="panel">
            <h2>Overall survey report</h2>
            <p>
              Total surveys sent: {totals.invitedCount}. Completed responses: {totals.completedCount}.
            </p>
            {selectedSurvey && (
              <p className="box">
                {selectedSurvey.status === 'Finalized'
                  ? (overallSummary?.text ?? 'No overall summary available.')
                  : 'Finalize selected survey to generate its short written summary.'}
              </p>
            )}
          </article>

          {recipients.map((recipient) => {
            const answers = answersForRecipient(recipient)
            const summary = individualSummaryByRecipient.get(recipient.id)?.text ?? summarizeAnswers(answers)
            const submittedAt = lastSubmittedAt(recipient)

            return (
              <article key={recipient.id} className="panel">
                <h3>{recipient.email}</h3>
                <p className="muted">
                  Status: {recipient.status}
                  {submittedAt ? ` | Submitted: ${new Date(submittedAt).toLocaleString()}` : ''}
                </p>
                <p className="box">{summary}</p>
                <div className="stack">
                  {answers.map((answer, index) => (
                    <p key={`${recipient.id}-${questions[index]?.id ?? index}`}>
                      <strong>Q{index + 1}:</strong> {answer || 'No answer submitted.'}
                    </p>
                  ))}
                </div>
              </article>
            )
          })}
        </section>
      )}
    </main>
  )
}

export default App
