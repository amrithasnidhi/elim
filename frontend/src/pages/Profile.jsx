import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

const STYLE_META = {
  'analogy': { label: 'Analogy', icon: '🧩', color: 'bg-purple-500' },
  'step-by-step': { label: 'Step-by-Step', icon: '📋', color: 'bg-blue-500' },
  'code-based': { label: 'Code-First', icon: '💻', color: 'bg-green-500' },
}

const DIFFICULTY_LABELS = ['', 'Beginner', 'Basic', 'Intermediate', 'Advanced', 'Expert']

export default function Profile() {
  const qc = useQueryClient()
  const updateUser = useAuthStore((s) => s.updateUser)
  const user = useAuthStore((s) => s.user)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.get('/profile').then((r) => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['feedback-summary'],
    queryFn: () => api.get('/feedback/summary', { params: { days: 30 } }).then((r) => r.data),
  })

  const [style, setStyle] = useState(user?.preferred_style || 'auto')
  const [difficulty, setDifficulty] = useState(user?.difficulty_level || 2)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <p className="text-gray-500 mt-1">Your learning preferences and style evolution</p>
        </div>

        {/* User info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
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

        {/* Style weights */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-900 text-base mb-1">Learning Style Weights</h2>
          <p className="text-gray-400 text-sm mb-5">
            These evolve automatically as you rate explanations. The dominant style is auto-selected for your next session.
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
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="font-semibold text-gray-900 text-base mb-1">30-Day Feedback Summary</h2>
            <p className="text-gray-400 text-sm mb-5">How each style has performed based on your ratings.</p>
            <div className="grid grid-cols-3 gap-3">
              {Object.entries(summary.per_style).map(([style, data]) => {
                const meta = STYLE_META[style] || { label: style, icon: '📄' }
                return (
                  <div key={style} className={`rounded-xl p-3.5 border ${summary.best_style === style ? 'border-indigo-200 bg-indigo-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div className="text-lg mb-1">{meta.icon}</div>
                    <div className="text-xs font-semibold text-gray-700 mb-2">{meta.label}</div>
                    <div className="text-2xl font-bold text-gray-900">{Math.round(data.win_rate * 100)}%</div>
                    <div className="text-xs text-gray-400 mt-0.5">win rate · {data.count} rated</div>
                    {summary.best_style === style && (
                      <div className="text-xs font-medium text-indigo-600 mt-1.5">Best performing</div>
                    )}
                  </div>
                )
              })}
            </div>
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
