import { useState, useEffect, useRef } from 'react'

const SPEEDS = [0.75, 1, 1.5, 2]

export default function AudioPlayer({ text }) {
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [done, setDone] = useState(false)
  const [speed, setSpeed] = useState(1)
  const speedRef = useRef(1)

  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    return () => window.speechSynthesis.cancel()
  }, [])

  const supported = 'speechSynthesis' in window

  const speak = (rate) => {
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.rate = rate ?? speedRef.current
    utt.onstart  = () => { setSpeaking(true); setPaused(false); setDone(false) }
    utt.onend    = () => { setSpeaking(false); setPaused(false); setDone(true) }
    utt.onerror  = () => { setSpeaking(false); setPaused(false) }
    window.speechSynthesis.speak(utt)
  }

  const handlePlayPause = () => {
    if (!supported) return
    if (speaking) {
      window.speechSynthesis.pause()
      setSpeaking(false)
      setPaused(true)
    } else if (paused) {
      window.speechSynthesis.resume()
      setSpeaking(true)
      setPaused(false)
    } else {
      speak()
    }
  }

  const handleStop = () => {
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setPaused(false)
    setDone(false)
  }

  const handleSpeed = (s) => {
    setSpeed(s)
    speedRef.current = s
    if (speaking || paused) speak(s)
  }

  if (!supported) return (
    <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 10, color: 'var(--dim)' }}>
      TTS_NOT_SUPPORTED
    </span>
  )

  return (
    <div style={{
      background: 'rgba(3,6,15,0.8)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 2, padding: '0.625rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          style={{
            width: 28, height: 28, flexShrink: 0, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,229,255,0.15)',
            border: '1px solid rgba(0,229,255,0.4)',
            cursor: 'pointer', color: 'var(--cyan)',
          }}
        >
          {speaking ? (
            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          ) : (
            <svg width="10" height="10" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: 1 }}>
              <path d="M8 5v14l11-7z"/>
            </svg>
          )}
        </button>

        {/* Status */}
        <div style={{ flex: 1 }}>
          {speaking ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {[0.6, 1, 0.7, 1, 0.5].map((h, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 1,
                  background: 'var(--cyan)',
                  height: `${h * 12}px`,
                  animation: `blink ${0.7 + i * 0.15}s ease-in-out infinite`,
                }} />
              ))}
              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--cyan)', marginLeft: 4, letterSpacing: '0.1em' }}>
                SPEAKING…
              </span>
            </div>
          ) : paused ? (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--amber)', letterSpacing: '0.1em' }}>PAUSED</span>
          ) : done ? (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--green)', letterSpacing: '0.1em' }}>DONE — PRESS PLAY TO REPLAY</span>
          ) : (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', letterSpacing: '0.1em' }}>PRESS PLAY TO LISTEN</span>
          )}
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', gap: 2 }}>
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleSpeed(s)}
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

        {/* Stop */}
        {(speaking || paused) && (
          <button
            type="button"
            onClick={handleStop}
            title="Stop"
            style={{
              width: 20, height: 20, flexShrink: 0, borderRadius: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent',
              border: '1px solid rgba(255,68,102,0.3)',
              cursor: 'pointer', color: '#ff4466',
            }}
          >
            <svg width="8" height="8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  )
}
