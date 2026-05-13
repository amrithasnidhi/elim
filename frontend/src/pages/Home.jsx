import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import ExplainCard from '../components/ExplainCard'
import StyleTabs from '../components/StyleTabs'
import SocraticChat from '../components/SocraticChat'
import FeynmanTest from '../components/FeynmanTest'
import LogoOrbit from '../components/LogoOrbit'
import Background from '../components/Background'
import useAuthStore from '../store/useAuthStore'

const STYLES = [
  { value: 'analogy',      label: 'ANALOGY',       desc: 'Real-world comparisons', color: 'var(--purple)', border: 'rgba(124,110,240,0.4)', bg: 'rgba(124,110,240,0.06)' },
  { value: 'step-by-step', label: 'STEP-BY-STEP',  desc: 'Numbered walkthrough',   color: 'var(--cyan)',   border: 'rgba(0,229,255,0.4)',   bg: 'rgba(0,229,255,0.06)' },
  { value: 'code-based',   label: 'CODE-FIRST',    desc: 'Working examples',       color: 'var(--green)',  border: 'rgba(0,255,157,0.4)',   bg: 'rgba(0,255,157,0.06)' },
]

const CODE_LANGUAGES = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C', 'C++', 'C#', 'Go',
  'Rust', 'Swift', 'Kotlin', 'Ruby', 'PHP', 'Scala', 'R', 'MATLAB',
  'Dart', 'Lua', 'Perl', 'Haskell', 'Elixir', 'Clojure', 'F#', 'Julia',
  'Groovy', 'Erlang', 'Bash', 'PowerShell', 'SQL', 'HTML/CSS',
  'Objective-C', 'Assembly', 'Nim', 'Zig', 'Crystal', 'Racket',
]

const DIFFICULTY_LABELS = ['', 'BEGINNER', 'BASIC', 'INTERMEDIATE', 'ADVANCED', 'EXPERT']
const MODE_SINGLE = 'single'
const MODE_MULTI  = 'multi'
const MODE_SOCRATIC = 'socratic'

export default function Home() {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  const [topic, setTopic] = useState(location.state?.prefillTopic || '')
  const [style, setStyle] = useState('analogy')
  const [difficulty, setDifficulty] = useState(2)
  const [mode, setMode] = useState(MODE_SINGLE)
  const [codeLang, setCodeLang] = useState('Python')
  const [displayTime, setDisplayTime] = useState(null)
  const [feynmanKey, setFeynmanKey] = useState(null)
  const [recording, setRecording] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])

  useEffect(() => {
    if (location.state?.prefillTopic) {
      setTopic(location.state.prefillTopic)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const singleMutation = useMutation({
    mutationFn: (data) => api.post('/explain/generate', data).then((r) => r.data),
    onSuccess: (data) => {
      setDisplayTime(new Date().toISOString())
      if (data.history_id) setFeynmanKey(data.history_id)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'GENERATION FAILED'),
  })

  const multiMutation = useMutation({
    mutationFn: (data) => api.post('/explain/multi-style', data).then((r) => r.data),
    onSuccess: () => setDisplayTime(new Date().toISOString()),
    onError: (err) => toast.error(err.response?.data?.detail || 'GENERATION FAILED'),
  })

  const socraticMutation = useMutation({
    mutationFn: (data) => api.post('/explain/socratic', data).then((r) => r.data),
    onError: (err) => toast.error(err.response?.data?.detail || 'GENERATION FAILED'),
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
          toast.error('TRANSCRIPTION_FAILED')
        }
      }
      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
    } catch {
      toast.error('MICROPHONE_ACCESS_DENIED')
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!topic.trim()) { toast.error('ENTER A TOPIC'); return }
    if (mode === MODE_MULTI) {
      multiMutation.mutate({ topic: topic.trim(), difficulty, code_language: codeLang })
    } else if (mode === MODE_SOCRATIC) {
      if (!user) { toast.error('SIGN IN TO USE SOCRATIC MODE'); return }
      socraticMutation.mutate({ topic: topic.trim(), difficulty })
    } else {
      singleMutation.mutate({ topic: topic.trim(), style, difficulty, code_language: style === 'code-based' ? codeLang : undefined })
    }
  }

  const isPending = singleMutation.isPending || multiMutation.isPending || socraticMutation.isPending

  const MODES = [
    { id: MODE_SINGLE,   label: 'SINGLE' },
    { id: MODE_MULTI,    label: 'COMPARE_ALL' },
    { id: MODE_SOCRATIC, label: 'SOCRATIC', tip: user ? '' : 'SIGN IN REQUIRED' },
  ]

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 720, margin: '0 auto', padding: '3rem 1.5rem 4rem' }}>

        {/* Hero */}
        <div className="fade-up" style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <LogoOrbit size={200} />
          <div style={{ marginTop: '1.75rem' }}>
            <h1 style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 32, fontWeight: 900,
              color: 'var(--cyan)',
              textShadow: '0 0 40px rgba(0,229,255,0.4)',
              letterSpacing: '0.12em',
              marginBottom: 8,
              animation: 'glitch 8s ease-in-out infinite',
            }}>
              EXPLAIN LIKE I'M ME
            </h1>
            <p style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 12, letterSpacing: '0.14em', color: 'var(--sub)',
              marginBottom: 12,
            }}>
              ADAPTIVE AI LEARNING — PERSONALISED TO YOUR STYLE
            </p>
            {user ? (
              <p style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 11, letterSpacing: '0.1em', color: 'var(--green)',
              }}>
                <span style={{ opacity: 0.6 }}>IDENTITY: </span>
                {user.name.toUpperCase()} — STYLE_WEIGHTS_ACTIVE
              </p>
            ) : (
              <p style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 11, letterSpacing: '0.1em', color: 'var(--dim)',
              }}>
                <Link to="/auth/register" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>INITIALISE PROFILE</Link>
                {' '}TO SAVE PROGRESS AND PERSONALISE EXPLANATIONS
              </p>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="cyber-panel fade-up-1" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem' }}>
            {MODES.map(({ id, label, tip }) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id)}
                title={tip}
                style={{
                  flex: 1, padding: '6px 8px',
                  fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 11, letterSpacing: '0.1em',
                  border: mode === id ? '1px solid rgba(0,229,255,0.4)' : '1px solid rgba(0,229,255,0.1)',
                  background: mode === id ? 'rgba(0,229,255,0.08)' : 'transparent',
                  color: mode === id ? 'var(--cyan)' : 'var(--dim)',
                  borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Topic input */}
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="mono-label">TOPIC_INPUT</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="binary search / transformer architecture / how vaccines work…"
                className="cyber-input"
                style={{ paddingRight: '2.5rem' }}
              />
              {typeof navigator !== 'undefined' && navigator.mediaDevices && (
                <button
                  type="button"
                  onClick={handleVoice}
                  title={recording ? 'Stop recording' : 'Speak your topic'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                    color: recording ? '#ff4466' : 'var(--dim)',
                    animation: recording ? 'blink 1s step-end infinite' : 'none',
                    transition: 'color 0.2s',
                  }}
                >
                  <svg width="14" height="14" fill={recording ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Style selector — single mode */}
          {mode === MODE_SINGLE && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="mono-label">EXPLANATION_STYLE</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {STYLES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setStyle(s.value)}
                    style={{
                      padding: '0.75rem',
                      border: style === s.value ? `1px solid ${s.border}` : '1px solid rgba(0,229,255,0.1)',
                      background: style === s.value ? s.bg : 'rgba(0,229,255,0.02)',
                      borderRadius: 2, cursor: 'pointer', transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    <p style={{
                      fontFamily: "'Share Tech Mono',monospace",
                      fontSize: 11, letterSpacing: '0.1em',
                      color: style === s.value ? s.color : 'var(--sub)',
                      marginBottom: 4,
                    }}>
                      {s.label}
                    </p>
                    <p style={{
                      fontFamily: "'Rajdhani',sans-serif",
                      fontSize: 13, color: 'var(--dim)',
                    }}>
                      {s.desc}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Language picker — shown when CODE-FIRST is active (single) or in COMPARE_ALL */}
          {((mode === MODE_SINGLE && style === 'code-based') || mode === MODE_MULTI) && (
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="mono-label">
                CODE_LANGUAGE
                <span style={{ color: 'var(--green)', marginLeft: 8 }}>{codeLang}</span>
              </label>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 5,
                maxHeight: 130, overflowY: 'auto',
                padding: '0.5rem',
                background: 'rgba(0,255,157,0.02)',
                border: '1px solid rgba(0,255,157,0.12)',
                borderRadius: 2,
              }}>
                {CODE_LANGUAGES.map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setCodeLang(lang)}
                    style={{
                      padding: '3px 9px',
                      fontFamily: "'Share Tech Mono',monospace",
                      fontSize: 10, letterSpacing: '0.08em',
                      border: codeLang === lang ? '1px solid rgba(0,255,157,0.6)' : '1px solid rgba(0,255,157,0.15)',
                      background: codeLang === lang ? 'rgba(0,255,157,0.12)' : 'transparent',
                      color: codeLang === lang ? 'var(--green)' : 'var(--dim)',
                      borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === MODE_MULTI && (
            <div style={{
              marginBottom: '1.25rem', padding: '0.75rem 1rem',
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid rgba(0,229,255,0.12)',
              borderRadius: 2,
            }}>
              <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: '0.1em', color: 'var(--sub)' }}>
                GENERATES ALL 3 STYLES IN PARALLEL — COMPARE AND RATE EACH. RATINGS CARRY EXTRA WEIGHT.
              </p>
            </div>
          )}

          {mode === MODE_SOCRATIC && (
            <div style={{
              marginBottom: '1.25rem', padding: '0.75rem 1rem',
              background: 'rgba(245,166,35,0.04)',
              border: '1px solid rgba(245,166,35,0.2)',
              borderRadius: 2,
            }}>
              <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: '0.1em', color: 'var(--amber)' }}>
                SOCRATIC_MODE — YOU WILL BE GUIDED THROUGH QUESTIONS TO DISCOVER THE CONCEPT YOURSELF.
                {!user && <span style={{ display: 'block', marginTop: 4, color: '#ff4466' }}>REQUIRES SIGN-IN.</span>}
              </p>
            </div>
          )}

          {/* Difficulty */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label className="mono-label" style={{ marginBottom: 0 }}>DIFFICULTY_LEVEL</label>
              <span style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 11, letterSpacing: '0.1em',
                color: 'var(--cyan)',
                border: '1px solid rgba(0,229,255,0.25)',
                padding: '2px 8px', borderRadius: 2,
              }}>
                {difficulty}/5 — {DIFFICULTY_LABELS[difficulty]}
              </span>
            </div>
            <input
              type="range" min={1} max={5} step={1}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              style={{
                width: '100%', height: 3,
                background: `linear-gradient(to right, var(--cyan) ${(difficulty - 1) * 25}%, rgba(0,229,255,0.1) ${(difficulty - 1) * 25}%)`,
                borderRadius: 2, appearance: 'none', cursor: 'pointer', outline: 'none',
                accentColor: 'var(--cyan)',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'var(--dim)' }}>BEGINNER</span>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'var(--dim)' }}>EXPERT</span>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={isPending} className="cyber-btn">
            {isPending ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg style={{ animation: 'spinCW 1s linear infinite' }} width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                {mode === MODE_MULTI ? 'GENERATING ALL 3…' : mode === MODE_SOCRATIC ? 'INITIALISING SESSION…' : 'GENERATING…'}
              </span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {mode === MODE_MULTI ? 'COMPARE ALL 3 STYLES' : mode === MODE_SOCRATIC ? 'START SOCRATIC SESSION' : 'EXPLAIN THIS TO ME'}
              </span>
            )}
          </button>
        </form>

        {/* Single result */}
        {mode === MODE_SINGLE && singleMutation.isSuccess && singleMutation.data && (
          <div className="animate-scan-in">
            <ExplainCard
              explanation={singleMutation.data.explanation}
              followup={singleMutation.data.followup}
              style={singleMutation.data.style}
              topic={singleMutation.data.topic}
              historyId={singleMutation.data.history_id}
              displayTimeUtc={displayTime}
              quality={singleMutation.data.quality}
            />
            {user && feynmanKey === singleMutation.data.history_id && (
              <FeynmanTest
                key={feynmanKey}
                historyId={feynmanKey}
                topic={singleMutation.data.topic}
                onComplete={() => setFeynmanKey(null)}
              />
            )}
          </div>
        )}

        {/* Multi-style result */}
        {mode === MODE_MULTI && multiMutation.isSuccess && multiMutation.data && (
          <div className="animate-scan-in">
            <StyleTabs data={multiMutation.data} displayTimeUtc={displayTime} topic={topic} />
          </div>
        )}

        {/* Socratic result */}
        {mode === MODE_SOCRATIC && socraticMutation.isSuccess && socraticMutation.data && (
          <div className="animate-scan-in">
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
