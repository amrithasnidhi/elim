import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'
import DepGraph from '../components/DepGraph'
import DiffView from '../components/DiffView'
import TopicRecommendations from '../components/TopicRecommendations'
import FeynmanDashboard from '../components/FeynmanDashboard'
import ThinkingStyleCard from '../components/ThinkingStyleCard'
import Background from '../components/Background'

const STYLE_META = {
  'analogy':      { label: 'ANALOGY',      color: 'var(--purple)', bar: 'rgba(124,110,240,0.8)' },
  'step-by-step': { label: 'STEP-BY-STEP', color: 'var(--cyan)',   bar: 'rgba(0,229,255,0.8)' },
  'code-based':   { label: 'CODE-FIRST',   color: 'var(--green)',  bar: 'rgba(0,255,157,0.8)' },
}

const DIFFICULTY_LABELS = ['', 'BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

function SectionCard({ title, subtitle, children, style: extraStyle = {} }) {
  return (
    <div className="cyber-panel" style={{ ...extraStyle }}>
      <p style={{
        fontFamily: "'Orbitron',monospace",
        fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
        color: 'var(--cyan)', marginBottom: subtitle ? 2 : '1rem',
      }}>
        {title}
      </p>
      {subtitle && (
        <p style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 8, letterSpacing: '0.1em', color: 'var(--dim)', marginBottom: '1rem',
        }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  )
}

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
      toast.success('PREFERENCES SAVED')
    },
    onError: () => toast.error('FAILED TO SAVE'),
  })

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid rgba(0,229,255,0.1)',
          borderTop: '2px solid var(--cyan)',
          animation: 'spinCW 0.8s linear infinite',
        }} />
      </div>
    )
  }

  const weights = profile?.style_weights || {}
  const historyItems = historyData?.items || []
  const topicSet = [...new Set(historyItems.map((h) => h.topic))]

  const selectStyle = {
    width: '100%',
    background: 'rgba(0,229,255,0.03)',
    border: '1px solid rgba(0,229,255,0.15)',
    borderRadius: 2,
    padding: '0.45rem 0.75rem',
    color: 'var(--text)',
    fontFamily: "'Share Tech Mono',monospace",
    fontSize: 10,
    outline: 'none',
    cursor: 'pointer',
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Header */}
        <div>
          <h1 style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18, fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--cyan)',
            textShadow: '0 0 20px rgba(0,229,255,0.3)',
            marginBottom: 4,
          }}>
            OPERATOR_PROFILE
          </h1>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em' }}>
            LEARNING PREFERENCES AND STYLE EVOLUTION
          </p>
        </div>

        {/* User info */}
        <SectionCard title={null} subtitle={null} style={{ padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(0,229,255,0.1)',
              border: '1px solid rgba(0,229,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: "'Orbitron',monospace",
              fontSize: 18, fontWeight: 700, color: 'var(--cyan)',
              flexShrink: 0,
            }}>
              {profile?.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 13, fontWeight: 700, color: 'var(--text)',
                letterSpacing: '0.08em', marginBottom: 2,
              }}>
                {profile?.name?.toUpperCase()}
              </p>
              <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--sub)' }}>
                {profile?.email}
              </p>
              {profile?.last_active && (
                <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', marginTop: 2 }}>
                  LAST_ACTIVE: {new Date(profile.last_active).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Spaced Repetition */}
        {spacedRep && spacedRep.count > 0 && (
          <div style={{
            background: 'rgba(245,166,35,0.04)',
            border: '1px solid rgba(245,166,35,0.25)',
            borderRadius: 2, padding: '1.25rem 1.5rem',
            position: 'relative',
          }}>
            <div style={{ position: 'absolute', top: -1, left: -1, width: 12, height: 12, borderTop: '2px solid rgba(245,166,35,0.7)', borderLeft: '2px solid rgba(245,166,35,0.7)' }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 12, height: 12, borderBottom: '2px solid rgba(245,166,35,0.7)', borderRight: '2px solid rgba(245,166,35,0.7)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.75rem' }}>
              <svg width="14" height="14" fill="none" stroke="var(--amber)" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{
                fontFamily: "'Orbitron',monospace",
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--amber)',
              }}>
                REVIEW_DUE — {spacedRep.count} TOPIC{spacedRep.count !== 1 ? 'S' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {spacedRep.items.slice(0, 5).map((item) => (
                <div key={item.topic} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <button
                    type="button"
                    onClick={() => navigate('/', { state: { prefillTopic: item.topic } })}
                    style={{
                      fontFamily: "'Rajdhani',sans-serif",
                      fontSize: 13, color: 'var(--amber)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      textDecoration: 'underline', textAlign: 'left',
                    }}
                  >
                    {item.topic}
                  </button>
                  <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'rgba(245,166,35,0.5)' }}>
                    {item.interval_days === 1 ? 'TODAY' : `+${item.interval_days}D`}
                  </span>
                </div>
              ))}
            </div>
            {spacedRep.count > 5 && (
              <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'rgba(245,166,35,0.4)', marginTop: 6 }}>
                …AND {spacedRep.count - 5} MORE
              </p>
            )}
          </div>
        )}

        {/* Topic Recommendations */}
        <TopicRecommendations />

        {/* Feynman Mastery + Gaps */}
        <FeynmanDashboard />

        {/* Style weights */}
        <SectionCard title="STYLE_WEIGHT_MATRIX" subtitle="EVOLVES AUTOMATICALLY AS YOU RATE EXPLANATIONS">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {Object.entries(STYLE_META).map(([key, meta]) => {
              const weight = weights[key] ?? 0
              const pct = Math.round(weight * 100)
              return (
                <div key={key}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{
                      fontFamily: "'Share Tech Mono',monospace",
                      fontSize: 9, letterSpacing: '0.12em', color: meta.color,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{
                      fontFamily: "'Share Tech Mono',monospace",
                      fontSize: 9, color: 'var(--sub)',
                    }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="weight-bar-track">
                    <div
                      className="weight-bar-fill"
                      style={{ width: `${pct}%`, background: meta.bar, boxShadow: `0 0 8px ${meta.bar}` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </SectionCard>

        {/* Metaphor Domain Fingerprint */}
        <ThinkingStyleCard />

        {/* Feedback summary */}
        {summary && Object.keys(summary.per_style).length > 0 && (
          <SectionCard title="30D_FEEDBACK_SUMMARY" subtitle="STYLE PERFORMANCE BASED ON YOUR RATINGS">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              {Object.entries(summary.per_style).map(([s, d]) => {
                const meta = STYLE_META[s] || { label: s.toUpperCase(), color: 'var(--sub)' }
                const isBest = summary.best_style === s
                return (
                  <div key={s} style={{
                    padding: '0.875rem',
                    background: isBest ? 'rgba(0,229,255,0.04)' : 'rgba(0,229,255,0.02)',
                    border: `1px solid ${isBest ? 'rgba(0,229,255,0.25)' : 'rgba(0,229,255,0.08)'}`,
                    borderRadius: 2,
                  }}>
                    <p style={{
                      fontFamily: "'Share Tech Mono',monospace",
                      fontSize: 8, letterSpacing: '0.1em', color: meta.color, marginBottom: 6,
                    }}>
                      {meta.label}
                    </p>
                    <p style={{
                      fontFamily: "'Orbitron',monospace",
                      fontSize: 22, fontWeight: 700, color: 'var(--text)',
                    }}>
                      {Math.round(d.win_rate * 100)}%
                    </p>
                    <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', marginTop: 2 }}>
                      {d.count} RATED
                    </p>
                    {isBest && (
                      <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--cyan)', marginTop: 4 }}>
                        ★ BEST
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* Dep graph */}
        <SectionCard title="CONCEPT_DEPENDENCY_GRAPH" subtitle="PREREQUISITES AND WHAT TO LEARN NEXT">
          <form
            onSubmit={(e) => { e.preventDefault(); setDepTopic(depInput.trim()) }}
            style={{ display: 'flex', gap: 8, marginBottom: '0.875rem' }}
          >
            <input
              type="text"
              value={depInput}
              onChange={(e) => setDepInput(e.target.value)}
              placeholder="enter topic (e.g. binary search)…"
              className="cyber-input"
              style={{ padding: '0.4rem 0.75rem', fontSize: 12 }}
            />
            <button type="submit" className="cyber-btn-ghost">SHOW</button>
          </form>
          {topicSet.length > 0 && !depTopic && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: '0.875rem' }}>
              {topicSet.slice(0, 8).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setDepInput(t); setDepTopic(t) }}
                  style={{
                    fontFamily: "'Share Tech Mono',monospace",
                    fontSize: 8, letterSpacing: '0.08em',
                    padding: '3px 8px', borderRadius: 2,
                    background: 'rgba(0,229,255,0.03)',
                    border: '1px solid rgba(0,229,255,0.12)',
                    color: 'var(--sub)', cursor: 'pointer', transition: 'all 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--cyan)'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--sub)'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.12)' }}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <DepGraph topic={depTopic} onTopicSelect={(t) => navigate('/', { state: { prefillTopic: t } })} />
        </SectionCard>

        {/* Diff */}
        {historyItems.length >= 2 && (
          <SectionCard title="COMPARE_EXPLANATIONS" subtitle="SEE HOW STYLE OR DIFFICULTY CHANGES THE OUTPUT">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '0.875rem' }}>
              {[{ label: 'VERSION_1', val: diffH1, set: setDiffH1 }, { label: 'VERSION_2', val: diffH2, set: setDiffH2 }].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="mono-label">{label}</label>
                  <select value={val} onChange={(e) => set(e.target.value)} style={selectStyle}>
                    <option value="">SELECT…</option>
                    {historyItems.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.topic} · {h.style_used} · {new Date(h.created_at).toLocaleDateString()}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <DiffView h1={diffH1} h2={diffH2} />
          </SectionCard>
        )}

        {/* Override preferences */}
        <SectionCard title="OVERRIDE_PREFERENCES" subtitle="FORCE A SPECIFIC STYLE INSTEAD OF AUTO-SELECTED">
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="mono-label">DEFAULT_STYLE</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {[
                { value: 'auto', label: 'AUTO', color: 'var(--cyan)' },
                { value: 'analogy', label: 'ANALOGY', color: 'var(--purple)' },
                { value: 'step-by-step', label: 'STEP', color: 'var(--cyan)' },
                { value: 'code-based', label: 'CODE', color: 'var(--green)' },
              ].map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  style={{
                    padding: '0.625rem',
                    border: style === s.value ? `1px solid ${s.color}` : '1px solid rgba(0,229,255,0.1)',
                    background: style === s.value ? `rgba(0,229,255,0.06)` : 'transparent',
                    borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
                    textAlign: 'center',
                  }}
                >
                  <p style={{
                    fontFamily: "'Share Tech Mono',monospace",
                    fontSize: 8, letterSpacing: '0.1em',
                    color: style === s.value ? s.color : 'var(--dim)',
                  }}>
                    {s.label}
                  </p>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="mono-label" style={{ marginBottom: 0 }}>DIFFICULTY</label>
              <span style={{
                fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
                color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.25)',
                padding: '2px 8px', borderRadius: 2,
              }}>
                {difficulty}/5 — {DIFFICULTY_LABELS[difficulty]}
              </span>
            </div>
            <input
              type="range" min={1} max={5} step={1} value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              style={{
                width: '100%', height: 3, borderRadius: 2, appearance: 'none',
                cursor: 'pointer', outline: 'none', accentColor: 'var(--cyan)',
                background: `linear-gradient(to right, var(--cyan) ${(difficulty - 1) * 25}%, rgba(0,229,255,0.1) ${(difficulty - 1) * 25}%)`,
              }}
            />
          </div>

          <button
            onClick={() => updateMutation.mutate({ preferred_style: style, difficulty_level: difficulty })}
            disabled={updateMutation.isPending}
            className="cyber-btn"
          >
            {updateMutation.isPending ? 'SAVING…' : 'SAVE_PREFERENCES'}
          </button>
        </SectionCard>
      </div>
    </div>
  )
}
