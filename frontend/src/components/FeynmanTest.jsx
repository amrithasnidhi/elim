import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../lib/api'

const GRADE_META = {
  MASTERED: { color: '#00FF9D', bg: 'rgba(0,255,157,0.07)',   border: 'rgba(0,255,157,0.25)',   icon: '◈' },
  SOLID:    { color: '#7C6EF0', bg: 'rgba(124,110,240,0.07)', border: 'rgba(124,110,240,0.25)', icon: '◆' },
  PARTIAL:  { color: '#F5A623', bg: 'rgba(245,166,35,0.07)',  border: 'rgba(245,166,35,0.25)',  icon: '◇' },
  FUZZY:    { color: '#D85A30', bg: 'rgba(216,90,48,0.07)',   border: 'rgba(216,90,48,0.25)',   icon: '○' },
  MISSING:  { color: '#E24B4A', bg: 'rgba(226,75,74,0.07)',   border: 'rgba(226,75,74,0.25)',   icon: '✕' },
}

const SEV_META = {
  critical:  { color: '#E24B4A', label: 'CRITICAL' },
  minor:     { color: '#F5A623', label: 'MINOR' },
  edge_case: { color: '#7C6EF0', label: 'EDGE CASE' },
}

const COUNTDOWN = 30
const MAX_CHARS = 5000

const LOADING_MSGS = [
  'PARSING YOUR EXPLANATION...',
  'COMPARING AGAINST ORIGINAL...',
  'IDENTIFYING KNOWLEDGE GAPS...',
  'GENERATING MINI-EXPLANATIONS...',
  'COMPUTING FEYNMAN SCORE...',
]

export default function FeynmanTest({ historyId, topic, onComplete }) {
  // phase: countdown | prompt | loading | result | dismissed
  const [phase, setPhase]       = useState('countdown')
  const [secs, setSecs]         = useState(COUNTDOWN)
  const [text, setText]         = useState('')
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [recording, setRec]     = useState(false)
  const [loadMsg, setLoadMsg]   = useState(LOADING_MSGS[0])

  const textareaRef = useRef(null)
  const timerRef    = useRef(null)
  const mediaRef    = useRef(null)
  const msgTimerRef = useRef(null)

  // countdown tick
  useEffect(() => {
    if (phase !== 'countdown') return
    timerRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) { clearInterval(timerRef.current); setPhase('prompt'); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase])

  // focus textarea when prompt appears
  useEffect(() => {
    if (phase === 'prompt') setTimeout(() => textareaRef.current?.focus(), 80)
  }, [phase])

  const startLoading = () => {
    let i = 0
    msgTimerRef.current = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length
      setLoadMsg(LOADING_MSGS[i])
    }, 1100)
  }

  const stopLoading = () => clearInterval(msgTimerRef.current)

  const handleSubmit = useCallback(async () => {
    if (text.trim().length < 10) return
    setPhase('loading')
    setError(null)
    startLoading()

    try {
      const { data } = await api.post('/feynman/submit', {
        history_id: historyId,
        user_explanation: text,
        input_method: 'text',
      })
      stopLoading()
      setResult(data)
      setPhase('result')
    } catch (err) {
      stopLoading()
      setError(err.response?.data?.detail || 'Grading failed — try again')
      setPhase('prompt')
    }
  }, [text, historyId])

  // Ctrl/Cmd+Enter submits
  const handleKey = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit()
  }, [handleSubmit])

  const toggleVoice = useCallback(async () => {
    if (recording) { mediaRef.current?.stop(); setRec(false); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'recording.webm')
        try {
          const { data } = await api.post('/voice/transcribe', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
          if (data.transcribed_text)
            setText((prev) => (prev ? prev + ' ' + data.transcribed_text : data.transcribed_text))
        } catch { /* voice fallback — user can still type */ }
        setRec(false)
      }
      mediaRef.current = rec
      rec.start()
      setRec(true)
    } catch { setRec(false) }
  }, [recording])

  if (phase === 'dismissed') return null

  // ── Countdown banner ──────────────────────────────────────────────────────
  if (phase === 'countdown') {
    return (
      <div style={{ marginTop: '0.75rem', animation: 'fadeUp 0.4s ease-out' }}>
        <div style={{
          background: 'rgba(7,13,26,0.9)',
          border: '1px solid rgba(0,229,255,0.15)',
          borderRadius: 2, backdropFilter: 'blur(10px)',
          padding: '0.8rem 1.1rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: secs <= 10 ? 'var(--cyan)' : '#2A4560',
              boxShadow: secs <= 10 ? '0 0 10px rgba(0,229,255,0.6)' : 'none',
              display: 'inline-block',
              animation: secs <= 10 ? 'blink 1s step-end infinite' : 'none',
            }} />
            <span style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 11, letterSpacing: '0.12em', color: 'rgba(0,229,255,0.6)',
            }}>
              FEYNMAN_TEST — can you explain it back?
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 13, fontWeight: 700, color: 'var(--cyan)',
              textShadow: '0 0 10px rgba(0,229,255,0.4)', minWidth: 28, textAlign: 'right',
            }}>
              {secs}s
            </span>
            <button
              onClick={() => { clearInterval(timerRef.current); setPhase('prompt') }}
              style={ghostBtn}
            >
              START NOW
            </button>
            <button onClick={() => { setPhase('dismissed'); onComplete?.() }} style={{ ...ghostBtn, color: 'rgba(0,229,255,0.3)', borderColor: 'transparent' }}>
              SKIP
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Result panel ──────────────────────────────────────────────────────────
  if (phase === 'result' && result) {
    const g = GRADE_META[result.grade] || GRADE_META.PARTIAL
    return (
      <div style={{ marginTop: '0.75rem', animation: 'fadeUp 0.4s ease-out' }}>
        <div style={panel}>
          <Bracket />
          {/* Header */}
          <div style={panelHeader}>
            <span style={panelTitle}><Dot />FEYNMAN_RESULT // {topic?.toUpperCase()}</span>
          </div>

          {/* Score row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1.1rem 1.25rem', borderBottom: '1px solid rgba(0,229,255,0.07)' }}>
            <div style={{
              width: 78, height: 78, borderRadius: '50%', flexShrink: 0,
              border: `2px solid ${g.border}`, background: g.bg,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 18px ${g.border}`,
              animation: 'scoreIn 0.5s cubic-bezier(0.34,1.56,0.64,1)',
            }}>
              <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 22, fontWeight: 900, color: g.color, lineHeight: 1 }}>
                {result.score}
              </span>
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: g.color, marginTop: 2 }}>
                {result.grade}
              </span>
            </div>
            <div style={{ flex: 1 }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 2,
                border: `1px solid ${g.border}`,
                fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: '0.1em',
                color: g.color, marginBottom: 7,
              }}>
                {g.icon} {result.grade}
              </span>
              <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15, color: 'var(--text)', lineHeight: 1.6, marginBottom: 4 }}>
                {result.summary}
              </p>
              <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: 'var(--dim)', fontStyle: 'italic' }}>
                {result.encouragement}
              </p>
              {result.confidence_mismatch && (
                <div style={{
                  marginTop: 8, padding: '5px 10px',
                  background: 'rgba(245,166,35,0.06)', border: '1px solid rgba(245,166,35,0.25)',
                  borderRadius: 2, fontFamily: "'Share Tech Mono',monospace",
                  fontSize: 10, color: '#F5A623', letterSpacing: '0.07em',
                }}>
                  ⚠ CONFIDENCE_MISMATCH — sounded certain but had gaps
                </div>
              )}
            </div>
          </div>

          {/* Gaps */}
          {result.gaps?.length > 0 && (
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(0,229,255,0.06)' }}>
              <div style={sectionLabel('#E24B4A')}>✕ KNOWLEDGE GAPS ({result.gaps.length})</div>
              {result.gaps.map((gap, i) => {
                const sev = SEV_META[gap.severity] || SEV_META.minor
                return (
                  <div key={i} style={{
                    borderLeft: `3px solid ${sev.color}`,
                    background: 'rgba(7,13,26,0.5)',
                    borderRadius: '0 2px 2px 0',
                    padding: '0.8rem 1rem', marginBottom: 8,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>
                        {gap.concept}
                      </span>
                      <span style={{
                        fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
                        color: sev.color, padding: '2px 7px',
                        border: `1px solid ${sev.color}44`, borderRadius: 1,
                      }}>
                        {sev.label}
                      </span>
                    </div>
                    <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 8 }}>
                      {gap.what_they_missed}
                    </p>
                    <div style={{
                      background: 'rgba(124,110,240,0.06)',
                      borderLeft: '2px solid rgba(124,110,240,0.4)',
                      borderRadius: '0 2px 2px 0',
                      padding: '0.55rem 0.75rem',
                    }}>
                      <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, letterSpacing: '0.1em', color: '#7C6EF0', marginBottom: 4 }}>
                        // TARGETED RE-EXPLANATION
                      </div>
                      <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>
                        {gap.mini_explanation}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Understood */}
          {result.understood?.length > 0 && (
            <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid rgba(0,229,255,0.06)' }}>
              <div style={sectionLabel('#00FF9D')}>◈ UNDERSTOOD ({result.understood.length})</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.understood.map((c, i) => (
                  <span key={i} style={{
                    padding: '3px 10px',
                    background: 'rgba(0,255,157,0.06)', border: '1px solid rgba(0,255,157,0.2)',
                    borderRadius: 2, fontFamily: "'Rajdhani',sans-serif",
                    fontSize: 13, color: '#00FF9D',
                  }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, padding: '0.85rem 1.25rem' }}>
            <button
              onClick={() => { setResult(null); setText(''); setPhase('prompt') }}
              style={ghostBtn}
            >
              ↺ TRY AGAIN
            </button>
            <button
              onClick={() => { setPhase('dismissed'); onComplete?.() }}
              style={{ ...ghostBtn, flex: 2, color: 'var(--cyan)', borderColor: 'rgba(0,229,255,0.35)', fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.14em' }}
            >
              COMPLETE ⟶
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Input panel (prompt + loading) ────────────────────────────────────────
  return (
    <div style={{ marginTop: '0.75rem', animation: 'fadeUp 0.4s ease-out' }}>
      <div style={panel}>
        <Bracket />
        <div style={panelHeader}>
          <span style={panelTitle}><Dot />FEYNMAN_TEST // EXPLAIN IT BACK</span>
          <span style={{
            fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: '0.1em',
            color: '#F5A623', padding: '3px 10px',
            border: '1px solid rgba(245,166,35,0.3)', borderRadius: 2,
          }}>
            {topic?.toUpperCase()}
          </span>
        </div>

        {phase === 'loading' ? (
          <div style={{ padding: '2rem 1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, letterSpacing: '0.15em', color: 'var(--sub)', animation: 'blink 1.2s ease-in-out infinite' }}>
              {loadMsg}
            </span>
            <div style={{ width: '100%', height: 2, background: 'rgba(0,229,255,0.1)', borderRadius: 0, overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', height: '100%', background: 'linear-gradient(90deg,transparent,var(--cyan),transparent)', animation: 'scanBar 1.4s ease-in-out infinite' }} />
            </div>
          </div>
        ) : (
          <div style={{ padding: '1.1rem 1.25rem' }}>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 15, color: 'var(--text)', lineHeight: 1.7, marginBottom: '1rem' }}>
              You just learned about <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{topic}</span>.
              Explain it back in your own words — as if teaching someone seeing it for the first time.{' '}
              <span style={{ color: 'var(--dim)', fontSize: 13 }}>Don't look back. Just write what you understood.</span>
            </p>

            {error && (
              <div style={{
                padding: '0.55rem 0.85rem', marginBottom: '0.75rem',
                background: 'rgba(226,75,74,0.08)', border: '1px solid rgba(226,75,74,0.3)',
                borderRadius: 2, fontFamily: "'Share Tech Mono',monospace",
                fontSize: 11, color: '#E24B4A', letterSpacing: '0.07em',
              }}>
                ⚠ {error}
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={handleKey}
              placeholder="Start typing… (Ctrl+Enter to submit)"
              style={{
                width: '100%', minHeight: 130,
                background: 'rgba(0,229,255,0.03)',
                border: '1px solid rgba(0,229,255,0.15)',
                borderRadius: 2, padding: '0.8rem 1rem',
                color: 'var(--text)', fontFamily: "'Rajdhani',sans-serif",
                fontSize: 15, lineHeight: 1.65, resize: 'vertical', outline: 'none',
                transition: 'border-color 0.25s, box-shadow 0.25s',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = 'rgba(0,229,255,0.45)'; e.target.style.boxShadow = '0 0 14px rgba(0,229,255,0.06)' }}
              onBlur={(e) => { e.target.style.borderColor = 'rgba(0,229,255,0.15)'; e.target.style.boxShadow = 'none' }}
            />
            <div style={{ textAlign: 'right', fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: text.length > MAX_CHARS * 0.85 ? '#E24B4A' : 'rgba(0,229,255,0.2)', marginTop: 4 }}>
              {text.length}/{MAX_CHARS}
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: '0.85rem' }}>
              <button onClick={toggleVoice} style={{
                background: recording ? 'rgba(226,75,74,0.1)' : 'transparent',
                border: `1px solid ${recording ? 'rgba(226,75,74,0.5)' : 'rgba(0,229,255,0.2)'}`,
                borderRadius: 2, padding: '0.6rem 1rem',
                color: recording ? '#E24B4A' : 'var(--dim)',
                fontFamily: "'Share Tech Mono',monospace", fontSize: 10, letterSpacing: '0.1em',
                cursor: 'pointer', transition: 'all 0.2s',
                animation: recording ? 'blink 1s ease-in-out infinite' : 'none',
              }}>
                {recording ? '● STOP' : '⬤ VOICE'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={text.trim().length < 10}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: `1px solid ${text.trim().length < 10 ? 'rgba(0,229,255,0.1)' : 'rgba(0,229,255,0.4)'}`,
                  borderRadius: 2, padding: '0.6rem',
                  color: text.trim().length < 10 ? 'rgba(0,229,255,0.2)' : 'var(--cyan)',
                  fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700, letterSpacing: '0.16em',
                  cursor: text.trim().length < 10 ? 'not-allowed' : 'pointer',
                  transition: 'all 0.25s',
                }}
              >
                ⟶ SUBMIT FOR GRADING
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Shared mini-components ────────────────────────────────────────────────────

const panel = {
  background: 'rgba(7,13,26,0.95)',
  border: '1px solid rgba(0,229,255,0.2)',
  borderRadius: 2, overflow: 'hidden', position: 'relative',
}
const panelHeader = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '0.7rem 1.25rem',
  borderBottom: '1px solid rgba(0,229,255,0.1)',
  background: 'rgba(0,229,255,0.03)',
}
const panelTitle = {
  fontFamily: "'Share Tech Mono',monospace",
  fontSize: 10, letterSpacing: '0.18em', color: 'var(--cyan)',
  display: 'flex', alignItems: 'center', gap: 8,
}
const ghostBtn = {
  background: 'transparent',
  border: '1px solid rgba(0,229,255,0.2)',
  borderRadius: 2, padding: '5px 14px',
  color: 'var(--sub)', fontFamily: "'Share Tech Mono',monospace",
  fontSize: 10, letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s',
}
const sectionLabel = (color) => ({
  fontFamily: "'Share Tech Mono',monospace",
  fontSize: 9, letterSpacing: '0.15em', color,
  marginBottom: '0.65rem', display: 'flex', alignItems: 'center', gap: 6,
})

function Dot() {
  return (
    <span style={{
      width: 6, height: 6, borderRadius: '50%',
      background: 'var(--cyan)', boxShadow: '0 0 8px rgba(0,229,255,0.7)',
      display: 'inline-block', animation: 'blink 1s step-end infinite',
    }} />
  )
}

function Bracket() {
  return (
    <>
      <div style={{ position: 'absolute', top: -1, left: -1, width: 13, height: 13, borderTop: '2px solid rgba(0,229,255,0.6)', borderLeft: '2px solid rgba(0,229,255,0.6)' }} />
      <div style={{ position: 'absolute', bottom: -1, right: -1, width: 13, height: 13, borderBottom: '2px solid rgba(0,229,255,0.6)', borderRight: '2px solid rgba(0,229,255,0.6)' }} />
    </>
  )
}
