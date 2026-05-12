import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

export default function ChatThread({ historyId, topic }) {
  const [messages, setMessages] = useState([])
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

  const turns = Math.ceil(messages.length / 2)
  const atLimit = turns >= 5

  return (
    <div style={{
      background: 'rgba(3,6,15,0.8)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 2, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.5rem 1rem',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(0,229,255,0.02)',
      }}>
        <svg width="12" height="12" fill="none" stroke="var(--cyan)" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.16em', color: 'var(--sub)',
        }}>
          FOLLOW_UP_THREAD
        </span>
        {messages.length > 0 && (
          <span style={{
            marginLeft: 'auto',
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, color: 'var(--dim)',
          }}>
            {turns}/5
          </span>
        )}
      </div>

      {/* Messages */}
      {messages.length > 0 && (
        <div style={{ maxHeight: 280, overflowY: 'auto', padding: '0.75rem 1rem' }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 8,
            }}>
              <div style={{
                maxWidth: '80%',
                padding: '0.5rem 0.875rem',
                borderRadius: 2,
                fontSize: 13,
                lineHeight: 1.6,
                fontFamily: "'Rajdhani',sans-serif",
                ...(msg.role === 'user' ? {
                  background: 'rgba(0,229,255,0.12)',
                  border: '1px solid rgba(0,229,255,0.3)',
                  color: 'var(--cyan)',
                } : {
                  background: 'rgba(7,13,26,0.9)',
                  border: '1px solid rgba(0,229,255,0.1)',
                  color: 'var(--text)',
                }),
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {mutation.isPending && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
              <div style={{
                padding: '0.5rem 0.875rem',
                background: 'rgba(7,13,26,0.9)',
                border: '1px solid rgba(0,229,255,0.1)',
                borderRadius: 2,
                display: 'flex', gap: 4, alignItems: 'center',
              }}>
                {[0, 150, 300].map((d) => (
                  <span key={d} style={{
                    width: 5, height: 5, borderRadius: '50%',
                    background: 'var(--cyan)',
                    display: 'inline-block',
                    animation: `blink 1.2s ${d}ms ease-in-out infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} style={{
        display: 'flex', gap: 8, padding: '0.5rem',
        borderTop: messages.length > 0 ? '1px solid rgba(0,229,255,0.08)' : 'none',
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={atLimit ? 'Conversation limit reached' : `Ask about ${topic}…`}
          disabled={mutation.isPending || atLimit}
          className="cyber-input"
          style={{ padding: '0.45rem 0.75rem', fontSize: 13 }}
        />
        <button
          type="submit"
          disabled={!input.trim() || mutation.isPending || atLimit}
          style={{
            width: 32, height: 32, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.3)',
            borderRadius: 2, cursor: 'pointer',
            color: 'var(--cyan)', transition: 'all 0.2s',
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
