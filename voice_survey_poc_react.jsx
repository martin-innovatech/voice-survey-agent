import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mic, Pause, Send, Square, Plus, Mail, BarChart3, Volume2 } from "lucide-react";

const initialSurvey = {
  id: "survey-1",
  title: "Customer Discovery Interview",
  questions: [
    "What problem are you trying to solve today?",
    "How do you currently handle this process?",
    "What would make this solution valuable to you?"
  ],
  recipients: [
    { email: "alex@example.com", status: "Invited", answers: [] },
    { email: "maria@example.com", status: "Completed", answers: [
      "We spend too much time collecting feedback manually.",
      "Currently we run video calls and write notes afterward.",
      "Automatic summaries and follow-up actions would be valuable."
    ] }
  ]
};

function getRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) return null;
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";
  return recognition;
}

function summarizeAnswers(answers) {
  if (!answers?.length) return "No submitted answers yet.";
  const themes = answers.join(" ").split(/[.!?]/).filter(Boolean).slice(0, 3);
  return `Summary: ${themes.map((t) => t.trim()).join(". ")}.`;
}

export default function VoiceSurveyPoC() {
  const [survey, setSurvey] = useState(initialSurvey);
  const [newQuestion, setNewQuestion] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [activeRecipient, setActiveRecipient] = useState(initialSurvey.recipients[0].email);
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [log, setLog] = useState("Ready to start voice survey.");

  const recipient = survey.recipients.find((r) => r.email === activeRecipient) || survey.recipients[0];
  const currentQuestion = survey.questions[activeQuestion];

  const completion = useMemo(() => {
    const total = survey.recipients.length;
    const completed = survey.recipients.filter((r) => r.status === "Completed").length;
    return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
  }, [survey.recipients]);

  const overallSummary = useMemo(() => {
    const allAnswers = survey.recipients.flatMap((r) => r.answers || []);
    return summarizeAnswers(allAnswers);
  }, [survey.recipients]);

  function speak(text) {
    if (!window.speechSynthesis) {
      setLog("Speech synthesis is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
    setLog("Voice agent asked the question.");
  }

  function startListening() {
    const recognition = getRecognition();
    if (!recognition) {
      setLog("Speech recognition is not supported in this browser. Type the answer instead.");
      return;
    }
    setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setDraftAnswer((prev) => `${prev} ${transcript}`.trim());
      setLog("Answer captured from microphone.");
    };
    recognition.onerror = () => setLog("Speech recognition failed. Try again or type the answer.");
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }

  function saveAnswer() {
    if (!draftAnswer.trim()) return;
    setSurvey((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r) => {
        if (r.email !== activeRecipient) return r;
        const answers = [...(r.answers || [])];
        answers[activeQuestion] = draftAnswer.trim();
        return { ...r, answers, status: activeQuestion === prev.questions.length - 1 ? "Completed" : "In progress" };
      })
    }));
    setDraftAnswer("");
    if (activeQuestion < survey.questions.length - 1) {
      setActiveQuestion(activeQuestion + 1);
      setTimeout(() => speak(survey.questions[activeQuestion + 1]), 250);
    } else {
      setLog("Survey submitted. Summary is available in admin view.");
    }
  }

  function addQuestion() {
    if (!newQuestion.trim()) return;
    setSurvey((prev) => ({ ...prev, questions: [...prev.questions, newQuestion.trim()] }));
    setNewQuestion("");
  }

  function addRecipient() {
    if (!newEmail.trim()) return;
    setSurvey((prev) => ({
      ...prev,
      recipients: [...prev.recipients, { email: newEmail.trim(), status: "Draft", answers: [] }]
    }));
    setNewEmail("");
  }

  function sendInvitations() {
    setSurvey((prev) => ({
      ...prev,
      recipients: prev.recipients.map((r) => r.status === "Draft" ? { ...r, status: "Invited" } : r)
    }));
    setLog("PoC: invitations marked as sent. Production would call an email API.");
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-3 rounded-2xl bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Voice Survey Agent PoC</h1>
            <p className="text-slate-600">Create voice-led surveys, invite recipients, capture answers, and generate summaries.</p>
          </div>
          <Badge className="w-fit text-sm">{completion.completed}/{completion.total} completed · {completion.percent}%</Badge>
        </header>

        <Tabs defaultValue="admin" className="space-y-4">
          <TabsList>
            <TabsTrigger value="admin">Admin view</TabsTrigger>
            <TabsTrigger value="user">User view</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          <TabsContent value="admin" className="grid gap-4 lg:grid-cols-2">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-xl font-semibold">Survey setup</h2>
                <Input value={survey.title} onChange={(e) => setSurvey({ ...survey, title: e.target.value })} />
                <div className="space-y-2">
                  {survey.questions.map((q, i) => (
                    <div key={q} className="rounded-xl bg-slate-100 p-3 text-sm"><b>Q{i + 1}:</b> {q}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add a survey question" value={newQuestion} onChange={(e) => setNewQuestion(e.target.value)} />
                  <Button onClick={addQuestion}><Plus className="mr-2 h-4 w-4" />Add</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-4 p-5">
                <h2 className="text-xl font-semibold">Recipients</h2>
                <div className="space-y-2">
                  {survey.recipients.map((r) => (
                    <div key={r.email} className="flex items-center justify-between rounded-xl bg-slate-100 p-3 text-sm">
                      <span>{r.email}</span><Badge variant="secondary">{r.status}</Badge>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="recipient@company.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                  <Button onClick={addRecipient}><Plus className="mr-2 h-4 w-4" />Add</Button>
                </div>
                <Button className="w-full" onClick={sendInvitations}><Mail className="mr-2 h-4 w-4" />Send invitations</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="user">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-5 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{survey.title}</h2>
                    <p className="text-sm text-slate-600">Participant: {recipient.email}</p>
                  </div>
                  <select className="rounded-xl border p-2" value={activeRecipient} onChange={(e) => { setActiveRecipient(e.target.value); setActiveQuestion(0); }}>
                    {survey.recipients.map((r) => <option key={r.email}>{r.email}</option>)}
                  </select>
                </div>

                <div className="rounded-2xl bg-slate-100 p-5">
                  <p className="text-sm text-slate-500">Question {activeQuestion + 1} of {survey.questions.length}</p>
                  <p className="mt-2 text-2xl font-semibold">{currentQuestion}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => speak(currentQuestion)}><Volume2 className="mr-2 h-4 w-4" />Start / ask</Button>
                  <Button onClick={startListening} variant="secondary"><Mic className="mr-2 h-4 w-4" />{isListening ? "Listening..." : "Answer by voice"}</Button>
                  <Button onClick={() => window.speechSynthesis?.pause()} variant="outline"><Pause className="mr-2 h-4 w-4" />Pause</Button>
                  <Button onClick={() => window.speechSynthesis?.cancel()} variant="outline"><Square className="mr-2 h-4 w-4" />Stop</Button>
                </div>

                <Textarea rows={6} placeholder="Transcript / typed answer" value={draftAnswer} onChange={(e) => setDraftAnswer(e.target.value)} />
                <Button onClick={saveAnswer} className="w-full"><Send className="mr-2 h-4 w-4" />Save answer / submit</Button>
                <p className="rounded-xl bg-white p-3 text-sm text-slate-600">{log}</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="space-y-3 p-5">
                <h2 className="flex items-center text-xl font-semibold"><BarChart3 className="mr-2 h-5 w-5" />Overall report</h2>
                <p className="text-slate-700">Participation: {completion.completed} of {completion.total} completed ({completion.percent}%).</p>
                <p className="rounded-xl bg-slate-100 p-4">{overallSummary}</p>
              </CardContent>
            </Card>

            {survey.recipients.map((r) => (
              <Card key={r.email} className="rounded-2xl shadow-sm">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between"><h3 className="font-semibold">{r.email}</h3><Badge>{r.status}</Badge></div>
                  <p className="rounded-xl bg-slate-100 p-4">{summarizeAnswers(r.answers)}</p>
                  {(r.answers || []).map((a, i) => <p key={i} className="text-sm"><b>Q{i + 1}:</b> {a}</p>)}
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
