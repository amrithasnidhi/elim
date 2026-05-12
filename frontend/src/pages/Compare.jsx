import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import ThumbsRating from '../components/ThumbsRating'
import Background from '../components/Background'
import useAuthStore from '../store/useAuthStore'

const STYLES = [
  { value: 'analogy',      label: 'ANALOGY',      color: 'var(--purple)', border: 'rgba(124,110,240,0.4)', bg: 'rgba(124,110,240,0.06)' },
  { value: 'step-by-step', label: 'STEP-BY-STEP', color: 'var(--cyan)',   border: 'rgba(0,229,255,0.4)',   bg: 'rgba(0,229,255,0.06)' },
  { value: 'code-based',   label: 'CODE-FIRST',   color: 'var(--green)',  border: 'rgba(0,255,157,0.4)',   bg: 'rgba(0,255,157,0.06)' },
]

const DIFFICULTY_LABELS = ['', 'BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']

function StylePicker({ value, onChange, excludeValue, label }) {
  return (
    <div>
      <label style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, letterSpacing: '0.14em', color: 'var(--dim)',
        display: 'block', marginBottom: 6,
      }}>
        {label}
      </label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {STYLES.filter((s) => s.value !== excludeValue).map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange(s.value)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0.5rem 0.75rem',
              border: value === s.value ? `1px solid ${s.border}` : '1px solid rgba(0,229,255,0.1)',
              background: value === s.value ? s.bg : 'transparent',
              borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
              textAlign: 'left',
            }}
          >
            <span style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, letterSpacing: '0.1em',
              color: value === s.value ? s.color : 'var(--sub)',
            }}>
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
    <div style={{
      background: 'rgba(7,13,26,0.9)',
      border: `1px solid ${styleMeta.border}`,
      borderRadius: 2, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{
        padding: '0.6rem 1rem',
        borderBottom: `1px solid ${styleMeta.border}`,
        background: styleMeta.bg,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.12em', color: styleMeta.color,
        }}>
          {styleMeta.label}
        </span>
      </div>

      <div style={{ padding: '1rem', flex: 1 }}>
        {result.error ? (
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#ff4466' }}>
            GENERATION_FAILED
          </p>
        ) : (
          <p style={{
            color: 'var(--text)', lineHeight: 1.7, fontSize: 14,
            whiteSpace: 'pre-wrap', fontFamily: "'Rajdhani',sans-serif",
          }}>
            {result.explanation}
          </p>
        )}
      </div>

      {result.followup && !result.error && (
        <div style={{
          margin: '0 1rem 0.875rem',
          padding: '0.75rem',
          background: 'rgba(124,110,240,0.04)',
          border: '1px solid rgba(124,110,240,0.15)',
          borderRadius: 2,
        }}>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 8, letterSpacing: '0.12em', color: 'var(--purple)', marginBottom: 4,
          }}>
            CHECK_YOUR_UNDERSTANDING
          </p>
          <p style={{ color: 'rgba(232,244,255,0.8)', fontSize: 12, lineHeight: 1.6, fontFamily: "'Rajdhani',sans-serif" }}>
            {result.followup}
          </p>
        </div>
      )}

      <div style={{
        padding: '0.75rem 1rem',
        borderTop: '1px solid rgba(0,229,255,0.06)',
      }}>
        <ThumbsRating historyId={result.history_id} displayTimeUtc={displayTimeUtc} />
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
    onError: () => toast.error('GENERATION FAILED'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!topic.trim()) { toast.error('ENTER A TOPIC'); return }
    if (leftStyle === rightStyle) { toast.error('SELECT TWO DIFFERENT STYLES'); return }
    mutation.mutate({ topic: topic.trim(), difficulty, leftStyle, rightStyle })
  }

  const [leftResult, rightResult] = mutation.data ?? [null, null]
  const leftMeta  = STYLES.find((s) => s.value === leftStyle)
  const rightMeta = STYLES.find((s) => s.value === rightStyle)

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 900, margin: '0 auto', padding: '3rem 1.5rem' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18, fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--cyan)', textShadow: '0 0 20px rgba(0,229,255,0.3)',
            marginBottom: 4,
          }}>
            STYLE_COMPARISON
          </h1>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em' }}>
            SAME TOPIC — TWO APPROACHES — SIDE BY SIDE
          </p>
        </div>

        {/* Form */}
        <div className="cyber-panel" style={{ marginBottom: '1.5rem' }}>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="mono-label">TOPIC</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="recursion / photosynthesis / gradient descent…"
                className="cyber-input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.25rem' }}>
              <StylePicker label="LEFT_STYLE"  value={leftStyle}  onChange={setLeftStyle}  excludeValue={rightStyle} />
              <StylePicker label="RIGHT_STYLE" value={rightStyle} onChange={setRightStyle} excludeValue={leftStyle} />
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

            <button type="submit" disabled={mutation.isPending} className="cyber-btn">
              {mutation.isPending ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg style={{ animation: 'spinCW 1s linear infinite' }} width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  GENERATING BOTH…
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  COMPARE_STYLES
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Results */}
        {mutation.isSuccess && leftResult && rightResult && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <ResultCard result={leftResult}  styleMeta={leftMeta}  displayTimeUtc={displayTime} />
            <ResultCard result={rightResult} styleMeta={rightMeta} displayTimeUtc={displayTime} />
          </div>
        )}

        {!user && (
          <p style={{
            textAlign: 'center', marginTop: '1.5rem',
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em',
          }}>
            RATINGS_SAVED_ONLY_WHEN{' '}
            <a href="/auth/login" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>SIGNED_IN</a>
          </p>
        )}
      </div>
    </div>
  )
}
