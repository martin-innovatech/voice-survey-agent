import { useMemo, useState } from 'react'
import './App.css'

type RecipientStatus = 'Draft' | 'Invited' | 'In Progress' | 'Completed'

type Recipient = {
  email: string
  status: RecipientStatus
  answers: string[]
  submittedAt?: string
  summary?: string
}

type Survey = {
  id: string
  title: string
  questions: string[]
  recipients: Recipient[]
  finalized: boolean
  overallSummary: string
}

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

const seedSurvey: Survey = {
  id: 'survey-1',
  title: 'Customer Discovery Interview',
  questions: [
    'What problem are you trying to solve today?',
    'How do you currently handle this process?',
    'What outcome would make this solution valuable to you?'
  ],
  recipients: [
    { email: 'alex@example.com', status: 'Invited', answers: [] },
    {
      email: 'maria@example.com',
      status: 'Completed',
      answers: [
        'We spend too much time gathering notes manually.',
        'We do interviews and summarize by hand in documents.',
        'Automatic summaries and follow-up actions would help us a lot.'
      ],
      summary: 'Manual note-taking and summarization is slow; automation is requested.'
    }
  ],
  finalized: false,
  overallSummary: ''
}

function summarizeAnswers(answers: string[]): string {
  const cleaned = answers.map((item) => item.trim()).filter(Boolean)
  if (cleaned.length === 0) {
    return 'No submitted answers yet.'
  }
  const first = cleaned[0]
  const second = cleaned[1]
  if (!second) {
    return `Participant reported: ${first}`
  }
  return `Participant reported: ${first} Key follow-up: ${second}`
}

function buildOverallSummary(survey: Survey): string {
  const completed = survey.recipients.filter((recipient) => recipient.status === 'Completed')
  const allAnswers = completed.flatMap((recipient) => recipient.answers)
  const themes = allAnswers
    .join(' ')
    .split(/[.!?]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)

  if (themes.length === 0) {
    return 'No completed interviews yet. Invite participants and collect answers to generate trends.'
  }

  return `Top themes: ${themes.join(' | ')}`
}

function App() {
  const [surveys, setSurveys] = useState<Survey[]>([seedSurvey])
  const [activeTab, setActiveTab] = useState<'admin' | 'user' | 'reports'>('admin')
  const [selectedSurveyId, setSelectedSurveyId] = useState(seedSurvey.id)

  const [newSurveyTitle, setNewSurveyTitle] = useState('')
  const [newQuestion, setNewQuestion] = useState('')
  const [newRecipientEmail, setNewRecipientEmail] = useState('')

  const [selectedRecipientEmail, setSelectedRecipientEmail] = useState('')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [draftAnswer, setDraftAnswer] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [log, setLog] = useState('Ready to start survey conversation.')

  const selectedSurvey = useMemo(
    () => surveys.find((survey) => survey.id === selectedSurveyId) ?? surveys[0],
    [surveys, selectedSurveyId]
  )

  const selectedRecipient =
    selectedSurvey?.recipients.find(
      (recipient) => recipient.email === selectedRecipientEmail
    ) ?? selectedSurvey?.recipients[0]

  const selectedRecipientValue = selectedRecipient?.email ?? ''

  const safeQuestionIndex = selectedSurvey
    ? Math.min(questionIndex, Math.max(selectedSurvey.questions.length - 1, 0))
    : 0

  const currentQuestion = selectedSurvey?.questions[safeQuestionIndex] ?? ''

  const totals = useMemo(() => {
    const surveyCount = surveys.length
    const finalizedCount = surveys.filter((survey) => survey.finalized).length
    const invitedCount = surveys.reduce(
      (sum, survey) =>
        sum + survey.recipients.filter((recipient) => recipient.status !== 'Draft').length,
      0
    )
    const completedCount = surveys.reduce(
      (sum, survey) =>
        sum + survey.recipients.filter((recipient) => recipient.status === 'Completed').length,
      0
    )
    return { surveyCount, finalizedCount, invitedCount, completedCount }
  }, [surveys])

  function updateSelectedSurvey(mutator: (survey: Survey) => Survey) {
    setSurveys((previous) =>
      previous.map((survey) =>
        survey.id === selectedSurveyId ? mutator(survey) : survey
      )
    )
  }

  function createSurvey() {
    const title = newSurveyTitle.trim()
    if (!title) {
      return
    }
    const id = `survey-${Date.now()}`
    const createdSurvey: Survey = {
      id,
      title,
      questions: ['What challenge are you trying to solve?'],
      recipients: [],
      finalized: false,
      overallSummary: ''
    }
    setSurveys((previous) => [...previous, createdSurvey])
    setSelectedSurveyId(id)
    setNewSurveyTitle('')
    setLog('New survey created.')
  }

  function addQuestion() {
    const question = newQuestion.trim()
    if (!question) {
      return
    }
    updateSelectedSurvey((survey) => ({
      ...survey,
      questions: [...survey.questions, question],
      finalized: false,
      overallSummary: ''
    }))
    setNewQuestion('')
  }

  function addRecipient() {
    const email = newRecipientEmail.trim().toLowerCase()
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValidEmail || !selectedSurvey) {
      return
    }

    const alreadyExists = selectedSurvey.recipients.some(
      (recipient) => recipient.email === email
    )
    if (alreadyExists) {
      setLog('Recipient already exists in this survey.')
      return
    }

    updateSelectedSurvey((survey) => ({
      ...survey,
      recipients: [...survey.recipients, { email, status: 'Draft', answers: [] }],
      finalized: false,
      overallSummary: ''
    }))

    setNewRecipientEmail('')
    setLog('Recipient added in draft state.')
  }

  function sendInvitations() {
    updateSelectedSurvey((survey) => ({
      ...survey,
      recipients: survey.recipients.map((recipient) =>
        recipient.status === 'Draft'
          ? { ...recipient, status: 'Invited' }
          : recipient
      )
    }))
    setLog('PoC: invitations marked as sent. Production should call an email API.')
  }

  function finalizeSurvey() {
    updateSelectedSurvey((survey) => {
      const recipients = survey.recipients.map((recipient) => ({
        ...recipient,
        summary: summarizeAnswers(recipient.answers)
      }))
      const nextSurvey = {
        ...survey,
        recipients,
        finalized: true
      }
      return {
        ...nextSurvey,
        overallSummary: buildOverallSummary(nextSurvey)
      }
    })
    setLog('Survey finalized with individual and overall summaries.')
  }

  function askQuestionByVoice() {
    if (!currentQuestion) {
      setLog('No question available. Add at least one question.')
      return
    }
    if (!window.speechSynthesis) {
      setLog('Speech synthesis is not supported in this browser.')
      return
    }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(currentQuestion)
    utterance.rate = 1
    window.speechSynthesis.speak(utterance)
    setLog('Voice agent asked the question.')
  }

  function startSpeechToText() {
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

  function pauseVoice() {
    window.speechSynthesis?.pause()
    setLog('Voice playback paused.')
  }

  function submitAnswer() {
    if (!selectedSurvey || !selectedRecipient) {
      setLog('Pick a recipient before submitting answers.')
      return
    }

    const answer = draftAnswer.trim()
    if (!answer) {
      return
    }

    const isLastQuestion = safeQuestionIndex >= selectedSurvey.questions.length - 1

    updateSelectedSurvey((survey) => ({
      ...survey,
      finalized: false,
      overallSummary: '',
      recipients: survey.recipients.map((recipient) => {
        if (recipient.email !== selectedRecipient.email) {
          return recipient
        }
        const nextAnswers = [...recipient.answers]
        nextAnswers[safeQuestionIndex] = answer
        return {
          ...recipient,
          answers: nextAnswers,
          status: isLastQuestion ? 'Completed' : 'In Progress',
          submittedAt: isLastQuestion
            ? new Date().toLocaleString()
            : recipient.submittedAt
        }
      })
    }))

    setDraftAnswer('')

    if (isLastQuestion) {
      setLog('Survey finished and submitted for this participant.')
      return
    }

    const nextIndex = safeQuestionIndex + 1
    setQuestionIndex(nextIndex)
    setLog('Answer saved. Moving to next question.')
  }

  function onRecipientChange(email: string) {
    setSelectedRecipientEmail(email)
    setQuestionIndex(0)
    setDraftAnswer('')
    setLog('Conversation reset for selected participant.')
  }

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

      <section className="panel">
        <div className="row wrap">
          <label htmlFor="surveyPicker">Survey</label>
          <select
            id="surveyPicker"
            value={selectedSurveyId}
            onChange={(event) => setSelectedSurveyId(event.target.value)}
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
          />
          <button type="button" onClick={createSurvey}>Create survey</button>
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
              {selectedSurvey.questions.map((question, index) => (
                <p key={`${question}-${index}`} className="box">
                  <strong>Q{index + 1}:</strong> {question}
                </p>
              ))}
            </div>
            <div className="row">
              <input
                placeholder="Add a question"
                value={newQuestion}
                onChange={(event) => setNewQuestion(event.target.value)}
              />
              <button type="button" onClick={addQuestion}>Add question</button>
            </div>
          </article>

          <article className="panel">
            <h2>Survey recipients</h2>
            <p className="muted">Invite participants by email and track participation.</p>
            <div className="stack">
              {selectedSurvey.recipients.map((recipient) => (
                <div key={recipient.email} className="row between box">
                  <span>{recipient.email}</span>
                  <span className={`badge ${recipient.status.replace(' ', '-').toLowerCase()}`}>
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
              />
              <button type="button" onClick={addRecipient}>Add recipient</button>
            </div>
            <div className="row wrap">
              <button type="button" onClick={sendInvitations}>Send invitations</button>
              <button type="button" onClick={finalizeSurvey}>Finalize survey</button>
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
              value={selectedRecipientValue}
              onChange={(event) => onRecipientChange(event.target.value)}
            >
              {selectedSurvey.recipients.map((recipient) => (
                <option key={recipient.email} value={recipient.email}>
                  {recipient.email}
                </option>
              ))}
            </select>
          </div>

          <div className="box">
            <p className="muted">
              Question {Math.min(safeQuestionIndex + 1, selectedSurvey.questions.length)} of {selectedSurvey.questions.length}
            </p>
            <p className="question">{currentQuestion || 'Add survey questions in Admin view.'}</p>
          </div>

          <div className="row wrap">
            <button type="button" onClick={askQuestionByVoice}>Start / Ask</button>
            <button type="button" onClick={startSpeechToText}>
              {isListening ? 'Listening...' : 'Answer by voice'}
            </button>
            <button type="button" onClick={pauseVoice}>Pause</button>
            <button type="button" onClick={submitAnswer}>Finish / Submit answer</button>
          </div>

          <textarea
            rows={5}
            value={draftAnswer}
            onChange={(event) => setDraftAnswer(event.target.value)}
            placeholder="Transcript or typed answer"
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
                {selectedSurvey.finalized
                  ? selectedSurvey.overallSummary
                  : 'Finalize selected survey to generate its short written summary.'}
              </p>
            )}
          </article>

          {selectedSurvey?.recipients.map((recipient) => (
            <article key={recipient.email} className="panel">
              <h3>{recipient.email}</h3>
              <p className="muted">
                Status: {recipient.status}
                {recipient.submittedAt ? ` | Submitted: ${recipient.submittedAt}` : ''}
              </p>
              <p className="box">{recipient.summary ?? summarizeAnswers(recipient.answers)}</p>
              <div className="stack">
                {recipient.answers.map((answer, index) => (
                  <p key={`${recipient.email}-${index}`}>
                    <strong>Q{index + 1}:</strong> {answer}
                  </p>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}

export default App
