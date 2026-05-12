import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

export default function Register() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const mutation = useMutation({
    mutationFn: (data) => api.post('/auth/register', data).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user, data.access_token, data.refresh_token)
      toast.success(`WELCOME TO ELIM, ${data.user.name.toUpperCase()}`)
      navigate('/')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'REGISTRATION FAILED'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('PASSWORD MUST BE AT LEAST 8 CHARACTERS')
      return
    }
    mutation.mutate(form)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 28, fontWeight: 900,
            color: 'var(--cyan)',
            textShadow: '0 0 30px rgba(0,229,255,0.4)',
            letterSpacing: '0.15em',
            marginBottom: 8,
          }}>
            ELIM
          </h1>
          <p style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.18em', color: 'var(--sub)',
          }}>
            CREATE YOUR LEARNING PROFILE
          </p>
        </div>

        <form onSubmit={handleSubmit} className="cyber-panel" style={{ padding: '2rem' }}>
          <div style={{ marginBottom: '1.25rem' }}>
            <label className="mono-label">DISPLAY_NAME</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="cyber-input"
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label className="mono-label">EMAIL_ADDRESS</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="user@domain.com"
              className="cyber-input"
            />
          </div>

          <div style={{ marginBottom: '1.75rem' }}>
            <label className="mono-label">PASSWORD — MIN 8 CHARS</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="cyber-input"
            />
          </div>

          <button type="submit" disabled={mutation.isPending} className="cyber-btn">
            {mutation.isPending ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <svg style={{ animation: 'spinCW 1s linear infinite' }} width="14" height="14" fill="none" viewBox="0 0 24 24">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                INITIALISING…
              </span>
            ) : 'INITIALISE'}
          </button>

          <p style={{
            textAlign: 'center', marginTop: '1.25rem',
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.12em', color: 'var(--dim)',
          }}>
            ALREADY ONLINE?{' '}
            <Link to="/auth/login" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>
              SIGN_IN
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
