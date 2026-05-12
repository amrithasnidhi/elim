import { useState, useRef, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

const SPEEDS = [0.75, 1, 1.5, 2]

export default function AudioPlayer({ historyId }) {
  const [jobId, setJobId] = useState(null)
  const [audioUrl, setAudioUrl] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef(null)

  const requestMutation = useMutation({
    mutationFn: () => api.post('/explain/audio', { history_id: historyId }).then((r) => r.data),
    onSuccess: (data) => {
      if (data.audio_url) setAudioUrl(data.audio_url)
      else if (data.job_id) setJobId(data.job_id)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Audio generation failed'),
  })

  useQuery({
    queryKey: ['audio-status', jobId],
    queryFn: () => api.get(`/explain/audio/${jobId}`).then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data || data.status === 'done' || data.status === 'failed') return false
      return 2000
    },
    onSuccess: (data) => {
      if (data.status === 'done' && data.audio_url) {
        setAudioUrl(data.audio_url)
        setJobId(null)
        toast.success('AUDIO READY')
      }
      if (data.status === 'failed') {
        toast.error(data.error || 'Audio generation failed')
        setJobId(null)
      }
    },
  })

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed])

  const togglePlay = () => {
    if (!audioRef.current) return
    playing ? audioRef.current.pause() : audioRef.current.play()
    setPlaying(!playing)
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0)
  }

  const handleScrub = (e) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * duration
    setProgress(pct * 100)
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  const isLoading = requestMutation.isPending || !!jobId

  if (!audioUrl) {
    return (
      <button
        type="button"
        onClick={() => requestMutation.mutate()}
        disabled={isLoading}
        className="cyber-btn-ghost"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {isLoading ? (
          <svg style={{ animation: 'spinCW 1s linear infinite' }} width="12" height="12" fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
          </svg>
        )}
        {isLoading ? 'GENERATING…' : 'GENERATE_AUDIO'}
      </button>
    )
  }

  return (
    <div style={{
      background: 'rgba(3,6,15,0.8)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 2, padding: '0.625rem',
    }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Play/pause */}
        <button
          type="button"
          onClick={togglePlay}
          style={{
            width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,229,255,0.15)',
            border: '1px solid rgba(0,229,255,0.4)',
            cursor: 'pointer', color: 'var(--cyan)',
          }}
        >
          {playing ? (
            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 1 }}>
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Progress bar */}
        <div style={{ flex: 1 }}>
          <div
            className="weight-bar-track"
            style={{ cursor: 'pointer', borderRadius: 2 }}
            onClick={handleScrub}
          >
            <div
              className="weight-bar-fill"
              style={{
                width: `${progress}%`,
                background: 'var(--cyan)',
                boxShadow: '0 0 6px rgba(0,229,255,0.4)',
              }}
            />
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 8, color: 'var(--dim)', marginTop: 3,
          }}>
            <span>{fmt(audioRef.current?.currentTime || 0)}</span>
            <span>{fmt(duration)}</span>
          </div>
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', gap: 2 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 8, padding: '2px 4px', borderRadius: 1,
                background: speed === s ? 'rgba(0,229,255,0.15)' : 'transparent',
                border: speed === s ? '1px solid rgba(0,229,255,0.4)' : '1px solid transparent',
                color: speed === s ? 'var(--cyan)' : 'var(--dim)',
                cursor: 'pointer',
              }}
            >
              {s}×
            </button>
          ))}
        </div>

        {/* Download */}
        <a
          href={audioUrl}
          download="elim-audio.mp3"
          style={{ color: 'var(--dim)', transition: 'color 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--dim)'}
          title="Download"
        >
          <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
        </a>
      </div>
    </div>
  )
}
