import { useEffect, useState } from 'react'
import api from '../lib/api'
import SocraticChat from './SocraticChat'

export default function SocraticLauncher({ topic, difficulty = 2 }) {
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [data,    setData]    = useState(null)

  useEffect(() => {
    setLoading(true); setError(null); setData(null)
    api.post('/explain/socratic', { topic, difficulty })
      .then(r => { setData(r.data); setLoading(false) })
      .catch(e => { setError(e.response?.data?.detail || 'Could not start Socratic session'); setLoading(false) })
  }, [topic, difficulty])

  if (loading) return (
    <div style={{
      padding: '0.85rem 1rem',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 10, letterSpacing: '0.14em', color: 'var(--amber)',
    }}>OPENING SOCRATIC SESSION...</div>
  )
  if (error) return (
    <div style={{
      padding: '0.85rem 1rem',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 10, color: '#D85A30',
    }}>ERROR — {error}</div>
  )
  if (!data) return null

  return (
    <SocraticChat
      openingQuestion={data.opening_question}
      historyId={data.history_id}
      topic={data.topic}
    />
  )
}
