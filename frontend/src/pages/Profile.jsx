import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'
import DepGraph from '../components/DepGraph'
import DiffView from '../components/DiffView'
import TopicRecommendations from '../components/TopicRecommendations'

const STYLE_META = {
  'analogy': { label: 'Analogy', icon: '🧩', color: 'bg-purple-500' },
  'step-by-step': { label: 'Step-by-Step', icon: '📋', color: 'bg-blue-500' },
  'code-based': { label: 'Code-First', icon: '💻', color: 'bg-green-500' },
}

const DIFFICULTY_LABELS = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']

export default function Profile() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const updateUser = useAuthStore((s) => s.updateUser)
  const user = useAuthStore((s) => s.user)

  const [style, setStyle] = useState(user?.preferred_style || 'auto')
  const [difficulty, setDifficulty] = useState(user?.difficulty_level || 2)
  const [depTopic, setDepTopic] = useState('')
  const [depInput, setDepInput] = useState('')
  const [diffH1, setDiffH1] = useState('')
  const [diffH2, setDiffH2] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['feedback-summary'],
    queryFn: () => api.get('/feedback/summary', { params: { days: 30 } }).then((r) => r.data),
  })

  const { data: spacedRep } = useQuery({
    queryKey: ['spaced-rep'],
    queryFn: () => api.get('/profile/spaced-rep').then((r) => r.data),
  })

  const { data: historyData } = useQuery({
    queryKey: ['history'],
    queryFn: () => api.get('/profile/history', { params: { limit: 50 } }).then((r) => r.data),
  })

  const updateMutation = useMutation({
    mutationFn: (data) => api.put('/profile/style', data).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(['profile'], data)
      updateUser(data)
      toast.success('Preferences saved')
    },
    onError: () => toast.error('Failed to save preferences'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const weights = profile?.style_weights || {}
  const historyItems = historyData?.items || []
  const topicSet = [...new Set(historyItems.map((h) => h.topic))]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">Your learning preferences and style evolution</p>
        </div>

        {/* User info */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xl">
              {profile?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-semibold text-gray-900 text-lg">{profile?.name}</div>
              <div className="text-gray-500 text-sm">{profile?.email}</div>
              {profile?.last_active && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Last active: {new Date(profile.last_active).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Spaced Repetition */}
        {spacedRep && spacedRep.count > 0 && (
          <div className="bg-orange-50 rounded-2xl border border-orange-100 p-6">
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="font-semibold text-orange-900 text-base">
                Review Due — {spacedRep.count} topic{spacedRep.count !== 1 ? 's' : ''}
              </h2>
            </div>
            <div className="space-y-2">
              {spacedRep.items.slice(0, 5).map((item) => (
                <div key={item.topic} className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => navigate('/', { state: { prefillTopic: item.topic } })}
                    className="text-sm font-medium text-orange-800 hover:text-orange-600 underline text-left"
                  >
                    {item.topic}
                  </button>
                  <span className="text-xs text-orange-500">
                    {item.interval_days === 1 ? 'Today' : `+${item.interval_days}d`}
                  </span>
                </div>
              ))}
            </div>
            {spacedRep.count > 5 && (
              <p className="text-xs text-orange-400 mt-2">…and {spacedRep.count - 5} more</p>
            )}
          </div>
        )}

        {/* Topic Recommendations */}
        <TopicRecommendations />

        {/* Style weights */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 text-base mb-1">Learning Style Weights</h2>
          <p className="text-gray-400 text-sm mb-5">
            These evolve automatically as you rate explanations.
          </p>
          <div className="space-y-4">
            {Object.entries(STYLE_META).map(([key, meta]) => {
              const weight = weights[key] ?? 0
              const pct = Math.round(weight * 100)
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                      <span>{meta.icon}</span> {meta.label}
                    </span>
                    <span className="text-sm font-semibold text-gray-500">{pct}%</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${meta.color}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Feedback summary */}
        {summary && Object.keys(summary.per_style).length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 text-base mb-1">30-Day Feedback Summary</h2>
            <p className="text-gray-400 text-sm mb-5">How each style has performed based on your ratings.</p>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(summary.per_style).map(([s, data]) => {
                const meta = STYLE_META[s] || { label: s, icon: '📄' }
                return (
                  <div key={s} className={`rounded-xl p-3.5 border ${summary.best_style === s ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="text-lg mb-1">{meta.icon}</div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">{meta.label}</div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(data.win_rate * 100)}%</div>
                    <div className="text-xs text-gray-400 mt-0.5">win rate · {data.count} rated</div>
                    {summary.best_style === s && (
                      <div className="text-xs font-medium text-indigo-600 mt-1.5">Best performing</div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Concept Dependency Graph */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 text-base mb-1">Concept Dependency Graph</h2>
          <p className="text-gray-400 text-sm mb-4">
            See what you need to know before a topic, and what to learn next.
          </p>
          <form
            onSubmit={(e) => { e.preventDefault(); setDepTopic(depInput.trim()) }}
            className="flex gap-2 mb-4"
          >
            <input
              type="text"
              value={depInput}
              onChange={(e) => setDepInput(e.target.value)}
              placeholder="Enter a topic (e.g. binary search)…"
              className="flex-1 text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Show
            </button>
          </form>
          {topicSet.length > 0 && !depTopic && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {topicSet.slice(0, 8).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setDepInput(t); setDepTopic(t) }}
                  className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <DepGraph
            topic={depTopic}
            onTopicSelect={(t) => navigate('/', { state: { prefillTopic: t } })}
          />
        </div>

        {/* Explanation Diff */}
        {historyItems.length >= 2 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 text-base mb-1">Compare Two Explanations</h2>
            <p className="text-gray-400 text-sm mb-4">
              See exactly how different style or difficulty choices change the wording.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Version 1</label>
                <select
                  value={diffH1}
                  onChange={(e) => setDiffH1(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none bg-white"
                >
                  <option value="">Select…</option>
                  {historyItems.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.topic} · {h.style_used} · {new Date(h.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Version 2</label>
                <select
                  value={diffH2}
                  onChange={(e) => setDiffH2(e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 focus:border-indigo-400 outline-none bg-white"
                >
                  <option value="">Select…</option>
                  {historyItems.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.topic} · {h.style_used} · {new Date(h.created_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DiffView h1={diffH1} h2={diffH2} />
          </div>
        )}

        {/* Manual override */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-semibold text-gray-900 text-base mb-1">Override Preferences</h2>
          <p className="text-gray-400 text-sm mb-5">
            Force a specific style instead of the auto-selected one.
          </p>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Default style</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'auto', label: 'Auto', icon: '✨' },
                ...Object.entries(STYLE_META).map(([v, m]) => ({ value: v, label: m.label, icon: m.icon })),
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                    style === s.value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-100 hover:border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="text-lg">{s.icon}</div>
                  <div className={`text-xs font-medium mt-0.5 ${style === s.value ? 'text-indigo-700' : 'text-gray-600'}`}>
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

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
            onClick={() => updateMutation.mutate({ preferred_style: style, difficulty_level: difficulty })}
            disabled={updateMutation.isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 rounded-xl transition-all"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save preferences'}
          </button>
        </div>
      </div>
    </div>
  )
}
