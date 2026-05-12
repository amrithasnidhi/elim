import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import ThumbsRating from '../components/ThumbsRating'
import useAuthStore from '../store/useAuthStore'

const STYLES = [
  { value: 'analogy', label: 'Analogy', icon: '🧩', color: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' },
  { value: 'step-by-step', label: 'Step-by-Step', icon: '📋', color: 'text-blue-600', border: 'border-blue-200', bg: 'bg-blue-50' },
  { value: 'code-based', label: 'Code-First', icon: '💻', color: 'text-green-600', border: 'border-green-200', bg: 'bg-green-50' },
]

const DIFFICULTY_LABELS = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']

function StylePicker({ value, onChange, excludeValue, label }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</div>
      <div className="flex flex-col gap-2">
        {STYLES.filter((s) => s.value !== excludeValue).map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border-2 text-left transition-all ${
              value === s.value
                ? `border-indigo-500 bg-indigo-50`
                : 'border-gray-100 hover:border-gray-200 bg-gray-50'
            }`}
          >
            <span className="text-lg">{s.icon}</span>
            <span className={`text-sm font-medium ${value === s.value ? 'text-indigo-700' : 'text-gray-700'}`}>
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ResultCard({ result, styleMeta, displayTimeUtc }) {
  if (!result) return null

  return (
    <div className={`rounded-2xl border ${styleMeta.border} ${styleMeta.bg} overflow-hidden flex flex-col h-full`}>
      <div className={`px-5 py-3 border-b ${styleMeta.border} flex items-center gap-2`}>
        <span className="text-xl">{styleMeta.icon}</span>
        <span className={`font-semibold text-sm ${styleMeta.color}`}>{styleMeta.label}</span>
      </div>

      <div className="px-5 py-4 flex-1">
        {result.error ? (
          <p className="text-red-500 text-sm">Failed to generate this style.</p>
        ) : (
          <p className="text-gray-700 leading-relaxed text-sm whitespace-pre-wrap">{result.explanation}</p>
        )}
      </div>

      {result.followup && !result.error && (
        <div className="mx-5 mb-4 p-3.5 bg-white/70 border border-white rounded-xl">
          <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Check your understanding</p>
          <p className="text-gray-700 text-xs">{result.followup}</p>
        </div>
      )}

      <div className="px-5 pb-5 border-t border-white/60 pt-4">
        <ThumbsRating
          historyId={result.history_id}
          displayTimeUtc={displayTimeUtc}
        />
      </div>
    </div>
  )
}

export default function Compare() {
  const user = useAuthStore((s) => s.user)
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState(2)
  const [leftStyle, setLeftStyle] = useState('analogy')
  const [rightStyle, setRightStyle] = useState('step-by-step')
  const [displayTime, setDisplayTime] = useState(null)

  const mutation = useMutation({
    mutationFn: ({ topic, difficulty, leftStyle, rightStyle }) =>
      Promise.all([
        api.post('/explain/generate', { topic, style: leftStyle, difficulty }).then((r) => r.data),
        api.post('/explain/generate', { topic, style: rightStyle, difficulty }).then((r) => r.data),
      ]),
    onSuccess: () => setDisplayTime(new Date().toISOString()),
    onError: () => toast.error('Failed to generate one or more explanations'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!topic.trim()) { toast.error('Please enter a topic'); return }
    if (leftStyle === rightStyle) { toast.error('Pick two different styles to compare'); return }
    mutation.mutate({ topic: topic.trim(), difficulty, leftStyle, rightStyle })
  }

  const [leftResult, rightResult] = mutation.data ?? [null, null]
  const leftMeta = STYLES.find((s) => s.value === leftStyle)
  const rightMeta = STYLES.find((s) => s.value === rightStyle)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Style Comparison</h1>
          <p className="text-gray-500 mt-1">See the same topic explained two ways, side by side</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <form onSubmit={handleSubmit}>
            {/* Topic */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. recursion, photosynthesis, gradient descent..."
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none text-gray-900 placeholder-gray-400 transition-all"
              />
            </div>

            {/* Style pickers */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <StylePicker
                label="Left style"
                value={leftStyle}
                onChange={setLeftStyle}
                excludeValue={rightStyle}
              />
              <StylePicker
                label="Right style"
                value={rightStyle}
                onChange={setRightStyle}
                excludeValue={leftStyle}
              />
            </div>

            {/* Difficulty */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">Difficulty</label>
                <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                  {difficulty}/5 — {DIFFICULTY_LABELS[difficulty]}
                </span>
              </div>
              <input
                type="range" min={1} max={5} step={1} value={difficulty}
                onChange={(e) => setDifficulty(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <>
                  <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Generating both styles...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  Compare styles
                </>
              )}
            </button>
          </form>
        </div>

        {/* Results side by side */}
        {mutation.isSuccess && leftResult && rightResult && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResultCard result={leftResult} styleMeta={leftMeta} displayTimeUtc={displayTime} />
            <ResultCard result={rightResult} styleMeta={rightMeta} displayTimeUtc={displayTime} />
          </div>
        )}

        {!user && (
          <p className="text-center text-sm text-gray-400 mt-6">
            Ratings are only saved when you're{' '}
            <a href="/auth/login" className="text-indigo-500 hover:underline">signed in</a>
          </p>
        )}
      </div>
    </div>
  )
}
