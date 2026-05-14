import {
  useEffect, useRef, useState, useCallback, useMemo,
} from 'react'
import * as d3 from 'd3'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'

const DOMAIN_LABELS = {
  computer_science: 'Computer Science',
  mathematics:      'Mathematics',
  biology:          'Biology',
  chemistry:        'Chemistry',
  physics:          'Physics',
  history:          'History',
  language:         'Language',
  economics:        'Economics',
  philosophy:       'Philosophy',
  psychology:       'Psychology',
  general:          'General',
}

// ── CSS injected once ─────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('elim-const-css')) return
  const el = document.createElement('style')
  el.id = 'elim-const-css'
  el.textContent = `
    @keyframes scanBar {
      0%   { left:-40%; width:40% }
      100% { left:100%; width:40% }
    }
    @keyframes blinkDot {
      0%,100% { opacity:1 }
      50%      { opacity:0.2 }
    }
    @keyframes constFadeIn {
      from { opacity:0; transform:translateY(12px) }
      to   { opacity:1; transform:translateY(0) }
    }
  `
  document.head.appendChild(el)
}

// ── Loading bar ───────────────────────────────────────────────────────────────
function LoadingBar({ message }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#010208', zIndex: 50,
    }}>
      <div style={{
        fontFamily: "'Orbitron',monospace",
        fontSize: 26, fontWeight: 900,
        color: '#00E5FF', textShadow: '0 0 30px rgba(0,229,255,0.4)',
        letterSpacing: '0.1em', marginBottom: '1.5rem',
      }}>ELIM</div>
      <div style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 10, letterSpacing: '0.2em',
        color: '#5A8FAA', textTransform: 'uppercase', marginBottom: '1.5rem',
      }}>
        {message}
      </div>
      <div style={{
        width: 240, height: 2,
        background: 'rgba(0,229,255,0.08)',
        borderRadius: 0, overflow: 'hidden', position: 'relative',
      }}>
        <div style={{
          position: 'absolute', height: '100%',
          background: 'linear-gradient(90deg,transparent,#00E5FF,transparent)',
          animation: 'scanBar 1.4s ease-in-out infinite',
        }} />
      </div>
    </div>
  )
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#00E5FF', sub }) {
  return (
    <div style={{
      background: 'rgba(7,13,26,0.85)',
      border: '1px solid rgba(0,229,255,0.1)',
      borderRadius: 4, padding: '0.7rem 1rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: 1, background: color, opacity: 0.4,
      }} />
      <div style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, letterSpacing: '0.15em',
        color: '#2A4560', textTransform: 'uppercase', marginBottom: 4,
      }}>{label}</div>
      <div style={{
        fontFamily: "'Orbitron',monospace",
        fontSize: 20, fontWeight: 700, color,
        textShadow: `0 0 12px ${color}66`,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, color: '#5A8FAA', marginTop: 2,
        }}>{sub}</div>
      )}
    </div>
  )
}

// ── Domain legend ─────────────────────────────────────────────────────────────
function DomainLegend({ domains, activeFilter, onFilter }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 6,
      padding: '0.75rem 1.25rem',
      borderTop: '1px solid rgba(0,229,255,0.08)',
    }}>
      <div
        onClick={() => onFilter(null)}
        style={{
          padding: '3px 10px',
          background: !activeFilter ? 'rgba(0,229,255,0.1)' : 'transparent',
          border: `1px solid ${!activeFilter ? 'rgba(0,229,255,0.4)' : 'rgba(0,229,255,0.12)'}`,
          borderRadius: 2, cursor: 'pointer',
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.1em',
          color: !activeFilter ? '#00E5FF' : '#5A8FAA',
        }}
      >ALL</div>
      {Object.entries(domains).map(([domain, color]) => (
        <div
          key={domain}
          onClick={() => onFilter(activeFilter === domain ? null : domain)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '3px 10px',
            background: activeFilter === domain ? `${color}18` : 'transparent',
            border: `1px solid ${activeFilter === domain ? `${color}66` : 'rgba(0,229,255,0.08)'}`,
            borderRadius: 2, cursor: 'pointer',
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, letterSpacing: '0.08em',
            color: activeFilter === domain ? color : '#5A8FAA',
          }}
        >
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: color, boxShadow: `0 0 5px ${color}`,
            display: 'inline-block',
          }} />
          {DOMAIN_LABELS[domain] || domain}
        </div>
      ))}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
function Tooltip({ node, x, y, containerW, containerH }) {
  if (!node) return null
  const isRight = x < containerW / 2
  const style = {
    position: 'absolute',
    left:  isRight ? x + 16 : undefined,
    right: isRight ? undefined : containerW - x + 16,
    top:   Math.min(y - 10, containerH - 220),
    pointerEvents: 'none',
    background: 'rgba(7,13,26,0.97)',
    border: '1px solid rgba(0,229,255,0.3)',
    borderRadius: 4, padding: '0.85rem 1rem',
    minWidth: 200, maxWidth: 280, zIndex: 100,
    animation: 'constFadeIn 0.2s ease-out',
  }

  return (
    <div style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.6rem' }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: node.is_ghost ? 'rgba(255,255,255,0.2)' : node.color,
          boxShadow: node.is_ghost ? 'none' : `0 0 10px ${node.color}`,
          display: 'inline-block', flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "'Orbitron',monospace",
          fontSize: 12, fontWeight: 700,
          color: node.is_ghost ? '#5A8FAA' : '#E8F4FF',
          textTransform: 'capitalize',
        }}>{node.topic}</span>
        {node.is_supernova && (
          <span style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, padding: '2px 6px',
            background: 'rgba(255,215,0,0.15)',
            border: '1px solid rgba(255,215,0,0.4)',
            borderRadius: 2, color: '#FFD700',
          }}>★ SUPERNOVA</span>
        )}
      </div>

      {node.is_ghost ? (
        <>
          <div style={{
            fontFamily: "'Share Tech Mono',monospace",
            fontSize: 9, color: '#F5A623', textTransform: 'uppercase', marginBottom: '0.4rem',
          }}>
            UNEXPLORED — {Math.round(node.ghost_sim * 100)}% proximity
          </div>
          <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 13, color: '#5A8FAA', lineHeight: 1.5 }}>
            Near your understanding of {node.ghost_closest}. Click to explore.
          </div>
        </>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            ['MASTERY',      `${node.score}/100`],
            ['SESSIONS',     node.sessions],
            ['DOMAIN',       DOMAIN_LABELS[node.domain] || node.domain],
            ['LAST STUDIED', node.days_ago === 0 ? 'Today' : node.days_ago === 1 ? 'Yesterday' : `${node.days_ago}d ago`],
          ].map(([k, v]) => (
            <div key={k}>
              <div style={{
                fontFamily: "'Share Tech Mono',monospace",
                fontSize: 8, letterSpacing: '0.1em', color: '#2A4560', marginBottom: 2,
              }}>{k}</div>
              <div style={{
                fontFamily: "'Rajdhani',monospace",
                fontSize: 13, fontWeight: 500,
                color: k === 'MASTERY' ? node.color : '#E8F4FF',
                textTransform: k === 'DOMAIN' ? 'capitalize' : 'none',
              }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── D3 Canvas ─────────────────────────────────────────────────────────────────
function ConstellationCanvas({ nodes, edges, width, height, activeFilter, onNodeClick, onNodeHover }) {
  const canvasRef = useRef(null)
  const simRef    = useRef(null)
  const nodesRef  = useRef([])
  const edgesRef  = useRef([])
  const frameRef  = useRef(null)
  const tickRef   = useRef(0)

  const visibleIds = useMemo(() => {
    if (!activeFilter) return new Set(nodes.map(n => n.id))
    return new Set(nodes.filter(n => n.domain === activeFilter || n.is_ghost).map(n => n.id))
  }, [nodes, activeFilter])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Static star field
    ctx.fillStyle = 'rgba(255,255,255,0.1)'
    for (let i = 0; i < 180; i++) {
      const sx = (i * 137.5 + 23) % W
      const sy = (i * 73.1  + 47) % H
      ctx.beginPath()
      ctx.arc(sx, sy, i % 3 === 0 ? 0.7 : 0.35, 0, Math.PI * 2)
      ctx.fill()
    }

    // Edges
    edgesRef.current.forEach(e => {
      const src = nodesRef.current.find(n => n.id === e.source)
      const tgt = nodesRef.current.find(n => n.id === e.target)
      if (!src || !tgt || !visibleIds.has(src.id) || !visibleIds.has(tgt.id)) return
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      ctx.strokeStyle = `rgba(0,229,255,${e.strength * 0.18 + 0.04})`
      ctx.lineWidth   = e.strength * 1.2 + 0.3
      ctx.stroke()
    })

    const t = tickRef.current
    nodesRef.current.forEach(n => {
      if (!visibleIds.has(n.id)) return
      const x = n.x || W / 2
      const y = n.y || H / 2
      const r = n.is_ghost ? 4 : n.size / 2

      if (n.is_ghost) {
        ctx.beginPath()
        ctx.setLineDash([3, 4])
        ctx.arc(x, y, r + 1, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 0.8
        ctx.stroke()
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255,255,255,0.1)'
        ctx.fill()
      } else {
        if (n.is_supernova) {
          const pulse = r + 3 + Math.sin(t * 0.05) * 3
          ctx.beginPath()
          ctx.arc(x, y, pulse, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(255,215,0,${0.25 + Math.sin(t * 0.05) * 0.1})`
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 2.5)
        grad.addColorStop(0, `${n.color}${Math.round(n.brightness * 40).toString(16).padStart(2, '0')}`)
        grad.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(x, y, r * 2.5, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fillStyle = `${n.color}${Math.round(n.brightness * 255).toString(16).padStart(2, '0')}`
        ctx.fill()

        ctx.beginPath()
        ctx.arc(x, y, r * 0.4, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${n.brightness * 0.8})`
        ctx.fill()

        if (r > 7) {
          ctx.font = `${Math.round(9 + r * 0.3)}px 'Share Tech Mono', monospace`
          ctx.fillStyle = `rgba(200,196,232,${n.brightness * 0.8})`
          ctx.textAlign = 'center'
          ctx.fillText(n.topic.slice(0, 22), x, y + r + 13)
        }
      }
    })

    tickRef.current += 1
  }, [visibleIds])

  useEffect(() => {
    const loop = () => { draw(); frameRef.current = requestAnimationFrame(loop) }
    frameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frameRef.current)
  }, [draw])

  useEffect(() => {
    if (!nodes.length) return
    const simNodes = nodes.map(n => ({ ...n }))
    const simEdges = edges.map(e => ({ ...e }))
    nodesRef.current = simNodes
    edgesRef.current = simEdges

    simRef.current?.stop()
    simRef.current = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simEdges)
        .id(d => d.id)
        .distance(d => 80 + (1 - d.strength) * 80)
        .strength(d => d.strength * 0.3))
      .force('charge', d3.forceManyBody().strength(d => d.is_ghost ? -20 : -60 - d.size * 2))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => d.is_ghost ? 6 : d.size / 2 + 12))
      .alpha(1).alphaDecay(0.015).velocityDecay(0.4)

    return () => simRef.current?.stop()
  }, [nodes, edges, width, height])

  const findNode = useCallback((mx, my) => {
    for (const n of nodesRef.current) {
      const dx = (n.x || 0) - mx, dy = (n.y || 0) - my
      const r  = n.is_ghost ? 8 : n.size / 2 + 6
      if (dx * dx + dy * dy <= r * r) return n
    }
    return null
  }, [])

  const onMouseMove = useCallback(e => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    onNodeHover(findNode(e.clientX - rect.left, e.clientY - rect.top), e.clientX - rect.left, e.clientY - rect.top)
  }, [findNode, onNodeHover])

  const onClick = useCallback(e => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const n = findNode(e.clientX - rect.left, e.clientY - rect.top)
    if (n) onNodeClick(n)
  }, [findNode, onNodeClick])

  return (
    <canvas
      ref={canvasRef}
      width={width} height={height}
      onMouseMove={onMouseMove}
      onMouseLeave={() => onNodeHover(null, 0, 0)}
      onClick={onClick}
      style={{ display: 'block', cursor: 'crosshair' }}
    />
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ConstellationPage() {
  injectCSS()
  const navigate     = useNavigate()
  const containerRef = useRef(null)

  const [data,         setData]         = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [loadMsg,      setLoadMsg]      = useState('MAPPING YOUR KNOWLEDGE UNIVERSE...')
  const [error,        setError]        = useState(null)
  const [hoveredNode,  setHoveredNode]  = useState(null)
  const [tooltipPos,   setTooltipPos]   = useState({ x: 0, y: 0 })
  const [activeFilter, setFilter]       = useState(null)
  const [dimensions,   setDimensions]   = useState({ w: 800, h: 500 })

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const r = containerRef.current.getBoundingClientRect()
        setDimensions({ w: Math.floor(r.width), h: Math.max(420, Math.floor(window.innerHeight - 200)) })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  useEffect(() => {
    const msgs = [
      'SCANNING TOPIC HISTORY...',
      'COMPUTING SEMANTIC DISTANCES...',
      'IDENTIFYING UNEXPLORED SPACE...',
      'CALCULATING STAR POSITIONS...',
      'RENDERING KNOWLEDGE UNIVERSE...',
    ]
    let i = 0
    const interval = setInterval(() => { i = (i + 1) % msgs.length; setLoadMsg(msgs[i]) }, 1800)

    api.get('/constellation')
      .then(res => { clearInterval(interval); setData(res.data); setLoading(false) })
      .catch(err => {
        clearInterval(interval)
        setError(err.response?.data?.detail || 'Failed to load constellation')
        setLoading(false)
      })

    return () => clearInterval(interval)
  }, [])

  const domainColors = useMemo(() => {
    if (!data) return {}
    const map = {}
    data.nodes.filter(n => !n.is_ghost).forEach(n => { if (!map[n.domain]) map[n.domain] = n.color })
    return map
  }, [data])

  const handleNodeHover  = useCallback((node, x, y) => { setHoveredNode(node); setTooltipPos({ x, y }) }, [])
  const handleNodeClick  = useCallback(node => navigate(`/?topic=${encodeURIComponent(node.topic)}`), [navigate])
  const handleForceRebuild = useCallback(() => {
    setLoading(true); setLoadMsg('REBUILDING UNIVERSE...')
    api.get('/constellation?force_rebuild=true')
      .then(res => { setData(res.data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#010208', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 12, color: '#D85A30', letterSpacing: '0.12em' }}>
          ERROR: {error}
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#010208', display: 'flex', flexDirection: 'column', color: '#E8F4FF', position: 'relative' }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `linear-gradient(rgba(0,229,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,255,0.03) 1px,transparent 1px)`,
        backgroundSize: '60px 60px', pointerEvents: 'none',
      }} />

      {/* Sub-nav */}
      <div style={{
        position: 'relative', zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.6rem 1.5rem',
        borderBottom: '1px solid rgba(0,229,255,0.08)',
        background: 'rgba(1,2,8,0.8)', backdropFilter: 'blur(20px)',
      }}>
        <div style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 10, letterSpacing: '0.2em',
          color: '#00E5FF', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#00E5FF', boxShadow: '0 0 8px #00E5FF',
            display: 'inline-block', animation: 'blinkDot 2s ease-in-out infinite',
          }} />
          CONCEPT_CONSTELLATION
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: '↺ REBUILD', onClick: handleForceRebuild, hoverColor: '#00E5FF' },
            { label: '⬇ EXPORT PNG', onClick: () => { const c = document.querySelector('canvas'); if (c) { const a = document.createElement('a'); a.download = 'elim-constellation.png'; a.href = c.toDataURL('image/png'); a.click() } }, hoverColor: '#00FF9D' },
          ].map(({ label, onClick, hoverColor }) => (
            <button key={label} onClick={onClick} style={{
              background: 'transparent',
              border: '1px solid rgba(0,229,255,0.2)',
              borderRadius: 2, padding: '4px 12px',
              color: '#5A8FAA', fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, letterSpacing: '0.1em',
              cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s',
            }}
              onMouseEnter={e => { e.currentTarget.style.color = hoverColor; e.currentTarget.style.borderColor = `${hoverColor}80` }}
              onMouseLeave={e => { e.currentTarget.style.color = '#5A8FAA'; e.currentTarget.style.borderColor = 'rgba(0,229,255,0.2)' }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Stats */}
      {data && !loading && (
        <div style={{
          position: 'relative', zIndex: 10,
          display: 'grid', gridTemplateColumns: 'repeat(5,1fr)',
          gap: 8, padding: '0.75rem 1.5rem',
          background: 'rgba(1,2,8,0.7)',
          borderBottom: '1px solid rgba(0,229,255,0.06)',
        }}>
          <StatCard label="// TOPICS"      value={data.stats.total_topics}           sub="STUDIED"           color="#00E5FF"  />
          <StatCard label="// MASTERED"    value={data.stats.mastered}               sub="SCORE ≥ 90"        color="#00FF9D"  />
          <StatCard label="// AVG MASTERY" value={`${data.stats.avg_score}%`}        sub="FEYNMAN AVG"       color="#7C6EF0"  />
          <StatCard label="// UNEXPLORED"  value={data.stats.ghost_topics}           sub="GHOST STARS"       color="#F5A623"  />
          <StatCard label="// SUPERNOVAS"  value={data.stats.supernovas?.length || 0} sub="RECENTLY MASTERED" color="#FFD700" />
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} style={{ position: 'relative', flex: 1, zIndex: 5, overflow: 'hidden' }}>
        {loading && <LoadingBar message={loadMsg} />}

        {data && !loading && (
          <>
            <ConstellationCanvas
              nodes={data.nodes} edges={data.edges}
              width={dimensions.w} height={dimensions.h}
              activeFilter={activeFilter}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
            />
            {hoveredNode && (
              <Tooltip
                node={hoveredNode} x={tooltipPos.x} y={tooltipPos.y}
                containerW={dimensions.w} containerH={dimensions.h}
              />
            )}
            <div style={{
              position: 'absolute', bottom: 16, left: 16,
              display: 'flex', alignItems: 'center', gap: 8,
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, color: '#2A4560', letterSpacing: '0.1em',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1px dashed rgba(255,255,255,0.3)', display: 'inline-block' }} />
              GHOST STARS = UNEXPLORED TERRITORY
              <span style={{ margin: '0 6px' }}>·</span>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 8px rgba(255,215,0,0.5)', display: 'inline-block' }} />
              SUPERNOVA = RECENTLY MASTERED
            </div>
          </>
        )}

        {data && !loading && data.nodes.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '1rem',
          }}>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 20, fontWeight: 700, color: '#2A4560', letterSpacing: '0.08em' }}>
              UNIVERSE EMPTY
            </div>
            <div style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 11, color: '#2A4560', letterSpacing: '0.1em', textAlign: 'center', maxWidth: 300 }}>
              Generate your first explanation and rate it to start building your knowledge constellation.
            </div>
          </div>
        )}
      </div>

      {/* Domain filter */}
      {data && !loading && (
        <div style={{ position: 'relative', zIndex: 10, background: 'rgba(1,2,8,0.85)', backdropFilter: 'blur(12px)' }}>
          <DomainLegend domains={domainColors} activeFilter={activeFilter} onFilter={setFilter} />
        </div>
      )}
    </div>
  )
}
