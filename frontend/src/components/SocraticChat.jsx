import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function SocraticChat({ openingQuestion, historyId, topic }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: openingQuestion },
  ])
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  const mutation = useMutation({
    mutationFn: (question) =>
      api.post('/explain/followup', { history_id: historyId, question }).then((r) => r.data),
    onSuccess: ({ reply }) => {
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Could not get a reply')
      setMessages((prev) => prev.slice(0, -1))
    },
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e) => {
    e.preventDefault()
    const q = input.trim()
    if (!q) return
    setMessages((prev) => [...prev, { role: 'user', content: q }])
    setInput('')
    mutation.mutate(q)
  }

  const turns = messages.filter((m) => m.role === 'user').length
  const atLimit = turns >= 10

  return (
    <div style={{
      background: 'rgba(7,5,2,0.9)',
      border: '1px solid rgba(245,166,35,0.25)',
      borderRadius: 2, overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Corner brackets */}
      <div style={{
        position: 'absolute', top: -1, left: -1,
        width: 12, height: 12,
        borderTop: '2px solid rgba(245,166,35,0.7)',
        borderLeft: '2px solid rgba(245,166,35,0.7)',
      }} />
      <div style={{
        position: 'absolute', bottom: -1, right: -1,
        width: 12, height: 12,
        borderBottom: '2px solid rgba(245,166,35,0.7)',
        borderRight: '2px solid rgba(245,166,35,0.7)',
      }} />

      {/* Header */}
      <div style={{
        padding: '0.6rem 1rem',
        borderBottom: '1px solid rgba(245,166,35,0.15)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(245,166,35,0.04)',
      }}>
        <svg width="13" height="13" fill="none" stroke="var(--amber)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.16em', color: 'var(--amber)',
        }}>
          SOCRATIC_MODE — {topic?.toUpperCase()}
        </span>
        <span style={{
          marginLeft: 'auto',
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9,
          color: atLimit ? '#ff4466' : 'rgba(245,166,35,0.5)',
        }}>
          {turns}/10
        </span>
      </div>

      {/* Messages */}
      <div style={{ maxHeight: 320, overflowY: 'auto', padding: '0.75rem 1rem' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-start',
            marginBottom: 10, gap: 6,
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(245,166,35,0.2)',
                border: '1px solid rgba(245,166,35,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, marginTop: 2,
                fontFamily: "'Orbitron',monospace",
                fontSize: 9, fontWeight: 700, color: 'var(--amber)',
              }}>
                S
              </div>
            )}
            <div style={{
              maxWidth: '80%',
              padding: '0.5rem 0.875rem',
              borderRadius: 2,
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "'Rajdhani',sans-serif",
              ...(msg.role === 'user' ? {
                background: 'rgba(0,229,255,0.1)',
                border: '1px solid rgba(0,229,255,0.25)',
                color: 'var(--cyan)',
              } : {
                background: 'rgba(245,166,35,0.05)',
                border: '1px solid rgba(245,166,35,0.15)',
                color: 'var(--text)',
              }),
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {mutation.isPending && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginBottom: 10 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(245,166,35,0.2)',
              border: '1px solid rgba(245,166,35,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              fontFamily: "'Orbitron',monospace",
              fontSize: 9, fontWeight: 700, color: 'var(--amber)',
            }}>
              S
            </div>
            <div style={{
              padding: '0.5rem 0.875rem',
              background: 'rgba(245,166,35,0.05)',
              border: '1px solid rgba(245,166,35,0.15)',
              borderRadius: 2,
              display: 'flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 150, 300].map((d) => (
                <span key={d} style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--amber)',
                  display: 'inline-block',
                  animation: `blink 1.2s ${d}ms ease-in-out infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: 8, padding: '0.5rem',
        borderTop: '1px solid rgba(245,166,35,0.1)',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={atLimit ? 'Session limit reached (10 turns)' : 'Type your answer or question…'}
          disabled={mutation.isPending || atLimit}
          style={{
            flex: 1,
            background: 'rgba(245,166,35,0.03)',
            border: '1px solid rgba(245,166,35,0.2)',
            borderRadius: 2,
            padding: '0.45rem 0.75rem',
            color: 'var(--text)',
            fontFamily: "'Rajdhani',sans-serif",
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || mutation.isPending || atLimit}
          style={{
            width: 32, height: 32, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(245,166,35,0.15)',
            border: '1px solid rgba(245,166,35,0.4)',
            borderRadius: 2, cursor: 'pointer',
            color: 'var(--amber)', transition: 'all 0.2s',
            opacity: (!input.trim() || mutation.isPending || atLimit) ? 0.4 : 1,
          }}
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
          </svg>
        </button>
      </form>
    </div>
  )
}
