import { useState, useEffect } from 'react'
import api from '../lib/api'

export default function ImageGrid({ topic }) {
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [imgErrors, setImgErrors] = useState({})

  useEffect(() => {
    if (!topic) return
    setLoading(true)
    setImages([])
    setExpanded(null)
    setImgErrors({})

    api.get('/images/search', { params: { topic, count: 4 } })
      .then((r) => setImages(r.data.images || []))
      .catch(() => setImages([]))
      .finally(() => setLoading(false))
  }, [topic])

  const handleImgError = (i) => setImgErrors((prev) => ({ ...prev, [i]: true }))

  const visibleImages = images.filter((_, i) => !imgErrors[i])

  if (!loading && visibleImages.length === 0) return null

  return (
    <div style={{
      background: 'rgba(7,13,26,0.8)',
      border: '1px solid rgba(0,229,255,0.12)',
      borderRadius: 2,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0.55rem 1rem',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
        background: 'rgba(0,229,255,0.03)',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: 'var(--cyan)',
          boxShadow: loading ? '0 0 8px var(--cyan)' : 'none',
          display: 'inline-block',
          animation: loading ? 'blink 0.8s step-end infinite' : 'none',
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.18em',
          color: 'var(--cyan)',
        }}>
          VISUAL_CONTEXT — {topic?.toUpperCase()}
        </span>
        {loading && (
          <span style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, color: 'rgba(0,229,255,0.4)',
            marginLeft: 'auto',
          }}>
            FETCHING...
          </span>
        )}
      </div>

      {/* Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 2,
        padding: 2,
      }}>
        {loading && [0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            aspectRatio: '16/10',
            background: 'rgba(0,229,255,0.04)',
            border: '1px solid rgba(0,229,255,0.08)',
            animation: 'blink 1.4s ease-in-out infinite',
            animationDelay: `${i * 150}ms`,
          }} />
        ))}

        {!loading && visibleImages.map((img, i) => (
          <ImageCell
            key={i}
            img={img}
            index={i}
            isExpanded={expanded === i}
            onToggle={() => setExpanded((p) => (p === i ? null : i))}
            onError={() => handleImgError(i)}
          />
        ))}
      </div>

      {/* Expanded detail strip */}
      {expanded !== null && visibleImages[expanded] && (
        <ExpandedStrip img={visibleImages[expanded]} />
      )}
    </div>
  )
}

function ImageCell({ img, isExpanded, onToggle, onError }) {
  const [hover, setHover] = useState(false)

  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        aspectRatio: '16/10',
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        border: `1px solid ${isExpanded || hover ? 'rgba(0,229,255,0.5)' : 'rgba(0,229,255,0.08)'}`,
        transition: 'border-color 0.2s',
        flexShrink: 0,
      }}
    >
      <img
        src={img.thumbnail}
        alt={img.title}
        onError={onError}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover',
          filter: hover ? 'saturate(1.1) brightness(1)' : 'saturate(0.8) brightness(0.85)',
          transform: hover ? 'scale(1.05)' : 'scale(1)',
          transition: 'filter 0.25s, transform 0.3s',
          display: 'block',
        }}
      />
      {/* Dark gradient at bottom */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, transparent 55%, rgba(1,2,8,0.65) 100%)',
        pointerEvents: 'none',
      }} />
      {/* Source badge */}
      {img.source && (
        <div style={{
          position: 'absolute', bottom: 4, left: 5,
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 7, color: 'rgba(0,229,255,0.55)',
          letterSpacing: '0.06em',
          maxWidth: 'calc(100% - 10px)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {img.source}
        </div>
      )}
    </div>
  )
}

function ExpandedStrip({ img }) {
  const [fullErr, setFullErr] = useState(false)

  return (
    <div style={{
      padding: '0.7rem 1rem',
      borderTop: '1px solid rgba(0,229,255,0.08)',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: 'rgba(0,229,255,0.02)',
    }}>
      {!fullErr && (
        <img
          src={img.url}
          alt={img.title}
          onError={() => setFullErr(true)}
          style={{
            width: 140, height: 88, objectFit: 'cover', flexShrink: 0,
            border: '1px solid rgba(0,229,255,0.2)',
            borderRadius: 1,
          }}
        />
      )}
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: "'Rajdhani',sans-serif",
          fontSize: 13, color: 'var(--text)', lineHeight: 1.4,
          marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {img.title}
        </div>
        {img.source_url && (
          <a
            href={img.source_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, color: 'var(--cyan)',
              textDecoration: 'none', letterSpacing: '0.1em',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {img.source || 'SOURCE'} ↗
          </a>
        )}
      </div>
    </div>
  )
}
