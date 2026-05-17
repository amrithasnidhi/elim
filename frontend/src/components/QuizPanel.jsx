import { useEffect, useState } from 'react'
import api from '../lib/api'

export default function QuizPanel({ historyId }) {
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(null)
  const [questions, setQuestions] = useState([])
  const [picked,  setPicked]    = useState({})    // qIndex -> optIndex
  const [revealed, setRevealed] = useState({})    // qIndex -> bool

  useEffect(() => {
    setLoading(true); setError(null); setQuestions([]); setPicked({}); setRevealed({})
    api.post('/explain/quiz', { history_id: historyId, n: 3 })
      .then(r => { setQuestions(r.data.questions || []); setLoading(false) })
      .catch(e => { setError(e.response?.data?.detail || 'Quiz failed'); setLoading(false) })
  }, [historyId])

  const choose = (qi, oi) => {
    if (revealed[qi]) return
    setPicked(p => ({ ...p, [qi]: oi }))
    setRevealed(r => ({ ...r, [qi]: true }))
  }

  const score = Object.entries(picked).reduce((acc, [qi, oi]) =>
    acc + (questions[qi]?.correct_index === oi ? 1 : 0), 0)
  const total = Object.keys(revealed).length

  if (loading) return (
    <div style={{
      padding: '0.85rem 1rem',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 10, letterSpacing: '0.14em', color: 'var(--sub)',
    }}>GENERATING QUIZ...</div>
  )
  if (error) return (
    <div style={{
      padding: '0.85rem 1rem',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 10, letterSpacing: '0.1em', color: '#D85A30',
    }}>ERROR — {error}</div>
  )

  return (
    <div style={{
      background: 'rgba(0,255,157,0.04)',
      border: '1px solid rgba(0,255,157,0.2)',
      borderLeft: '3px solid var(--green)',
      borderRadius: '0 4px 4px 0',
      padding: '0.85rem 1rem',
    }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
      }}>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.16em', color: 'var(--green)',
        }}>// QUIZ_ME · {questions.length} QUESTIONS</span>
        {total > 0 && (
          <span style={{
            fontFamily: "'Orbitron',monospace", fontSize: 11, fontWeight: 700,
            color: score === total ? 'var(--green)' : score > 0 ? 'var(--amber)' : '#D85A30',
          }}>
            SCORE {score}/{total}
          </span>
        )}
      </div>

      {questions.map((q, qi) => {
        const rev = !!revealed[qi]
        return (
          <div key={qi} style={{
            marginBottom: qi < questions.length - 1 ? 14 : 0,
            paddingBottom: qi < questions.length - 1 ? 12 : 0,
            borderBottom: qi < questions.length - 1 ? '1px solid rgba(0,255,157,0.1)' : 'none',
          }}>
            <p style={{
              fontFamily: "'Rajdhani',sans-serif", fontSize: 15, color: 'var(--text)',
              lineHeight: 1.5, marginBottom: 8,
            }}>
              <span style={{ color: 'var(--green)', marginRight: 6 }}>Q{qi + 1}.</span>
              {q.question}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {q.options.map((opt, oi) => {
                const isPicked  = picked[qi] === oi
                const isCorrect = q.correct_index === oi
                let color = 'var(--sub)'
                let border = 'rgba(0,229,255,0.15)'
                let bg = 'transparent'
                if (rev && isCorrect) { color = 'var(--green)'; border = 'rgba(0,255,157,0.5)'; bg = 'rgba(0,255,157,0.08)' }
                else if (rev && isPicked && !isCorrect) { color = '#D85A30'; border = 'rgba(216,90,48,0.5)'; bg = 'rgba(216,90,48,0.08)' }
                else if (isPicked) { color = 'var(--cyan)'; border = 'rgba(0,229,255,0.4)'; bg = 'rgba(0,229,255,0.06)' }
                return (
                  <button
                    key={oi}
                    onClick={() => choose(qi, oi)}
                    disabled={rev}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                      padding: '6px 10px', border: `1px solid ${border}`, background: bg, color,
                      borderRadius: 2, cursor: rev ? 'default' : 'pointer',
                      fontFamily: "'Rajdhani',sans-serif", fontSize: 14, transition: 'all 0.15s',
                    }}
                  >
                    <span style={{
                      fontFamily: "'Share Tech Mono',monospace", fontSize: 9,
                      letterSpacing: '0.1em', minWidth: 14, color,
                    }}>{String.fromCharCode(65 + oi)}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {rev && isCorrect && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--green)' }}>✓</span>}
                    {rev && isPicked && !isCorrect && <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: '#D85A30' }}>✗</span>}
                  </button>
                )
              })}
            </div>
            {rev && q.explanation && (
              <p style={{
                marginTop: 6, padding: '6px 10px',
                background: 'rgba(124,110,240,0.06)', border: '1px solid rgba(124,110,240,0.2)',
                borderRadius: 2, fontFamily: "'Rajdhani',sans-serif", fontSize: 13,
                color: 'rgba(232,244,255,0.75)', lineHeight: 1.55,
              }}>
                <span style={{
                  fontFamily: "'Share Tech Mono',monospace", fontSize: 8,
                  letterSpacing: '0.14em', color: 'var(--purple)', marginRight: 5,
                }}>WHY</span>
                {q.explanation}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
