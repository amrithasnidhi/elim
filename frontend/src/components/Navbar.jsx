import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import useAuthStore from '../store/useAuthStore'

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      const p = (x) => String(x).padStart(2,'0')
      setTime(`${p(n.getHours())}:${p(n.getMinutes())}:${p(n.getSeconds())}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const NAV_LINKS = [
  { to: '/',                label: 'INTERFACE' },
  { to: '/compare',         label: 'COMPARE',       auth: true },
  { to: '/history',         label: 'HISTORY',        auth: true },
  { to: '/settings/sources',label: 'SOURCES',        auth: true },
  { to: '/constellation',   label: 'CONSTELLATION',  auth: true },
  { to: '/peer',            label: 'PEER_NETWORK',   auth: true },
  { to: '/profile/learning',label: 'WHAT_ELIM_KNOWS',auth: true },
]

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const clock = useClock()
  const user = useAuthStore((s) => s.user)
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  const { data: profileData } = useQuery({
    queryKey: ['profile-navbar'],
    queryFn: () => api.get('/profile').then((r) => r.data),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const spacedRepDue = profileData?.spaced_rep_due ?? 0

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout', { refresh_token: refreshToken }),
    onSettled: () => {
      clearAuth()
      toast.success('SESSION TERMINATED')
      navigate('/auth/login')
    },
  })

  const isActive = (to) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <nav style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0 2rem', height:'52px',
      borderBottom:'1px solid rgba(0,229,255,0.1)',
      background:'rgba(1,2,8,0.9)',
      backdropFilter:'blur(20px)',
      position:'sticky', top:0, zIndex:100,
    }}>
      {/* Wordmark */}
      <Link to="/" style={{
        display:'flex', alignItems:'center', gap:8,
        fontFamily:"'Orbitron',monospace",
        fontSize:17, fontWeight:700,
        color:'var(--cyan)',
        textShadow:'0 0 20px rgba(0,229,255,0.5)',
        letterSpacing:'0.1em',
        textDecoration:'none',
      }}>
        <span style={{
          width:7, height:7, borderRadius:'50%',
          background:'var(--cyan)',
          boxShadow:'0 0 10px var(--cyan)',
          display:'inline-block',
          animation:'blink 2s ease-in-out infinite',
        }} />
        ELIM
      </Link>

      {/* Nav links */}
      <div style={{ display:'flex', alignItems:'center', gap:'1.75rem' }}>
        {NAV_LINKS.filter(l => !l.auth || user).map(({ to, label }) => (
          <Link key={to} to={to} style={{
            fontFamily:"'Share Tech Mono',monospace",
            fontSize:12, letterSpacing:'0.12em',
            color: isActive(to) ? 'var(--cyan)' : 'var(--sub)',
            textShadow: isActive(to) ? '0 0 10px rgba(0,229,255,0.5)' : 'none',
            textDecoration:'none',
            transition:'color 0.2s',
          }}>
            {label}
          </Link>
        ))}
      </div>

      {/* Right side */}
      <div style={{ display:'flex', alignItems:'center', gap:'1.25rem' }}>
        {/* Clock */}
        <span style={{
          fontFamily:"'Share Tech Mono',monospace",
          fontSize:11, color:'var(--green)', letterSpacing:'0.1em',
          display:'flex', alignItems:'center', gap:5,
        }}>
          <span style={{
            width:5, height:5, borderRadius:'50%',
            background:'var(--green)', boxShadow:'0 0 6px var(--green)',
            display:'inline-block', animation:'blink 1.5s ease-in-out infinite',
          }} />
          {clock}
        </span>

        {user ? (
          <>
            <Link to="/profile" style={{
              display:'flex', alignItems:'center', gap:6,
              textDecoration:'none', position:'relative',
            }}>
              <div style={{ position:'relative' }}>
                <div style={{
                  width:28, height:28, borderRadius:'50%',
                  border:'1px solid rgba(0,229,255,0.4)',
                  background:'rgba(0,229,255,0.1)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:"'Orbitron',monospace",
                  fontSize:11, fontWeight:700, color:'var(--cyan)',
                }}>
                  {user.name?.[0]?.toUpperCase()}
                </div>
                {spacedRepDue > 0 && (
                  <span style={{
                    position:'absolute', top:-3, right:-3,
                    width:14, height:14, borderRadius:'50%',
                    background:'var(--amber)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontFamily:"'Share Tech Mono',monospace",
                    fontSize:8, color:'#000', fontWeight:700,
                  }}>
                    {spacedRepDue > 9 ? '9+' : spacedRepDue}
                  </span>
                )}
              </div>
              <span style={{
                fontFamily:"'Share Tech Mono',monospace",
                fontSize:12, color:'var(--sub)', letterSpacing:'0.08em',
              }}>
                {user.name?.toUpperCase()}
              </span>
            </Link>

            <button
              onClick={() => logoutMutation.mutate()}
              style={{
                background:'transparent',
                border:'1px solid rgba(0,229,255,0.15)',
                borderRadius:2, padding:'3px 10px',
                fontFamily:"'Share Tech Mono',monospace",
                fontSize:11, color:'var(--dim)', letterSpacing:'0.1em',
                cursor:'pointer', transition:'all 0.2s',
                textTransform:'uppercase',
              }}
              onMouseEnter={e => { e.target.style.color='var(--cyan)'; e.target.style.borderColor='rgba(0,229,255,0.4)' }}
              onMouseLeave={e => { e.target.style.color='var(--dim)'; e.target.style.borderColor='rgba(0,229,255,0.15)' }}
            >
              EXIT
            </button>
          </>
        ) : (
          <>
            <Link to="/auth/login" style={{
              fontFamily:"'Share Tech Mono',monospace",
              fontSize:12, color:'var(--sub)', letterSpacing:'0.1em', textDecoration:'none',
            }}>SIGN_IN</Link>
            <Link to="/auth/register" style={{
              background:'rgba(0,229,255,0.08)',
              border:'1px solid rgba(0,229,255,0.4)',
              borderRadius:2, padding:'6px 16px',
              fontFamily:"'Orbitron',monospace",
              fontSize:10, fontWeight:700, color:'var(--cyan)',
              letterSpacing:'0.15em', textDecoration:'none',
              transition:'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow='0 0 20px rgba(0,229,255,0.2)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow='none'}
            >
              INITIALISE
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
