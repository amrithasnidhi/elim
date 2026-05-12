import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import ExplainCard from '../components/ExplainCard'
import StyleTabs from '../components/StyleTabs'
import SocraticChat from '../components/SocraticChat'
import useAuthStore from '../store/useAuthStore'

const STYLES = [
  { value: 'analogy', label: 'Analogy', description: 'Real-world comparisons', icon: '🧩' },
  { value: 'step-by-step', label: 'Step-by-Step', description: 'Numbered walkthrough', icon: '📋' },
  { value: 'code-based', label: 'Code-First', description: 'Working examples', icon: '💻' },
]

const DIFFICULTY_LABELS = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']

const MODE_SINGLE = 'single'
const MODE_MULTI = 'multi'
const MODE_SOCRATIC = 'socratic'

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [topic, setTopic] = useState(location.state?.prefillTopic || '')
  const [style, setStyle] = useState('analogy')
  const [difficulty, setDifficulty] = useState(2)
  const [mode, setMode] = useState(MODE_SINGLE)
  const [displayTime, setDisplayTime] = useState(null)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  // Prefill topic from recommendation navigation
  useEffect(() => {
    if (location.state?.prefillTopic) {
      setTopic(location.state.prefillTopic)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const singleMutation = useMutation({
    mutationFn: (data) => api.post('/explain/generate', data).then((r) => r.data),
    onSuccess: () => setDisplayTime(new Date().toISOString()),
    onError: (err) => toast.error(err.response?.data?.detail || 'Something went wrong. Please try again.'),
  })

  const multiMutation = useMutation({
    mutationFn: (data) => api.post('/explain/multi-style', data).then((r) => r.data),
    onSuccess: () => setDisplayTime(new Date().toISOString()),
    onError: (err) => toast.error(err.response?.data?.detail || 'Something went wrong. Please try again.'),
  })

  const socraticMutation = useMutation({
    mutationFn: (data) => api.post('/explain/socratic', data).then((r) => r.data),
    onError: (err) => toast.error(err.response?.data?.detail || 'Something went wrong. Please try again.'),
  })

  const handleVoice = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'recording.webm')
        try {
          const { data } = await api.post('/voice/transcribe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data.transcribed_text) setTopic(data.transcribed_text)
        } catch {
          toast.error('Transcription failed — check OPENAI_API_KEY')
        }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!topic.trim()) {
      toast.error('Please enter a topic')
      return
    }
    if (mode === MODE_MULTI) {
      multiMutation.mutate({ topic: topic.trim(), difficulty })
    } else if (mode === MODE_SOCRATIC) {
      if (!user) {
        toast.error('Sign in to use Socratic mode')
        return
      }
      socraticMutation.mutate({ topic: topic.trim(), difficulty })
    } else {
      singleMutation.mutate({ topic: topic.trim(), style, difficulty })
    }
  }

  const isPending = singleMutation.isPending || multiMutation.isPending || socraticMutation.isPending

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
            Adaptive AI Learning
          </div>
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight mb-3">
            Explain Like I'm <span className="text-indigo-600">Me</span>
          </h1>
          <p className="text-gray-500 text-lg">
            AI explanations personalised to your learning style and knowledge level
          </p>
          {user ? (
            <p className="text-sm text-indigo-600 mt-2 font-medium">
              Signed in as <strong>{user.name}</strong> — your style preferences are auto-applied
            </p>
          ) : (
            <p className="text-sm text-gray-400 mt-2">
              <Link to="/auth/register" className="text-indigo-500 hover:underline font-medium">Create an account</Link>
              {' '}to save your learning style and track progress
            </p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 mb-6 p-1 bg-gray-100 rounded-xl w-fit">
            {[
              { id: MODE_SINGLE, label: 'Single style' },
              { id: MODE_MULTI, label: 'Compare all 3' },
              { id: MODE_SOCRATIC, label: '🔦 Socratic', tip: user ? '' : 'Sign in to use' },
            ].map(({ id, label, tip }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                title={tip}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  mode === id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Topic input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              What do you want to understand?
            </label>
            <div className="relative">
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. binary search, how vaccines work, transformer architecture..."
                className="w-full pl-4 pr-12 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900 placeholder-gray-400 transition-all text-base"
              />
              {typeof navigator !== 'undefined' && navigator.mediaDevices && (
                <button
                  type="button"
                  onClick={handleVoice}
                  title={recording ? 'Stop recording' : 'Speak your topic'}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    recording
                      ? 'text-red-500 bg-red-50 animate-pulse'
                      : 'text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  <svg className="w-4 h-4" fill={recording ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Style selector — single mode only */}
          {mode === MODE_SINGLE && (
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Explanation style
              </label>
              <div className="grid grid-cols-3 gap-3">
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyle(s.value)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      style === s.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="text-xl mb-1">{s.icon}</div>
                    <div className={`text-sm font-semibold ${style === s.value ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {s.label}
                    </div>
                    <div className="text-xs text-gray-400">{s.description}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === MODE_MULTI && (
            <div className="mb-6 p-3.5 bg-indigo-50 border border-indigo-100 rounded-xl text-sm text-indigo-700">
              Generates all 3 styles simultaneously so you can compare and rate each one.
              Your ratings carry extra weight since you saw all options.
            </div>
          )}

          {mode === MODE_SOCRATIC && (
            <div className="mb-6 p-3.5 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
              <strong>Socratic mode</strong> — instead of receiving an explanation, you'll be guided
              through a series of questions to discover the concept yourself.
              {!user && <span className="block mt-1 text-amber-600 font-medium">Requires sign-in.</span>}
            </div>
          )}

          {/* Difficulty slider */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">Difficulty level</label>
              <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                {difficulty}/5 — {DIFFICULTY_LABELS[difficulty]}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Beginner</span>
              <span>Expert</span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3.5 rounded-xl transition-all text-base flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {mode === MODE_MULTI ? 'Generating all 3 styles...' : mode === MODE_SOCRATIC ? 'Starting session...' : 'Generating explanation...'}
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {mode === MODE_MULTI ? 'Compare all 3 styles' : mode === MODE_SOCRATIC ? 'Start Socratic session' : 'Explain this to me'}
              </>
            )}
          </button>
        </form>

        {/* Single result */}
        {mode === MODE_SINGLE && singleMutation.isSuccess && singleMutation.data && (
          <div className="animate-fade-in">
            <ExplainCard
              explanation={singleMutation.data.explanation}
              followup={singleMutation.data.followup}
              style={singleMutation.data.style}
              topic={singleMutation.data.topic}
              historyId={singleMutation.data.history_id}
              displayTimeUtc={displayTime}
              quality={singleMutation.data.quality}
            />
          </div>
        )}

        {/* Multi-style result */}
        {mode === MODE_MULTI && multiMutation.isSuccess && multiMutation.data && (
          <div className="animate-fade-in">
            <StyleTabs
              data={multiMutation.data}
              displayTimeUtc={displayTime}
              topic={topic}
            />
          </div>
        )}

        {/* Socratic result */}
        {mode === MODE_SOCRATIC && socraticMutation.isSuccess && socraticMutation.data && (
          <div className="animate-fade-in">
            <SocraticChat
              openingQuestion={socraticMutation.data.opening_question}
              historyId={socraticMutation.data.history_id}
              topic={socraticMutation.data.topic}
            />
          </div>
        )}
      </div>
    </div>
  )
}
