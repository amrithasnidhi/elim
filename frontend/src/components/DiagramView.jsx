import { useState, useEffect, useRef, useId } from 'react'
import { useMutation } from '@tanstack/react-query'
import mermaid from 'mermaid'
import toast from 'react-hot-toast'
import api from '../lib/api'

mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })

function MermaidRenderer({ code }) {
  const id = useId().replace(/:/g, '')
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) return
    setError('')
    mermaid.render(`mermaid-${id}`, code)
      .then(({ svg }) => setSvg(svg))
      .catch(() => setError('Could not render diagram'))
  }, [code, id])

  if (error) return (
    <div style={{ padding: '1rem' }}>
      <p style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 10, color: '#ff4466', textAlign: 'center', marginBottom: '0.5rem',
      }}>
        RENDER_ERROR
      </p>
      <pre style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, color: 'var(--dim)', background: 'rgba(0,0,0,0.3)',
        padding: '0.5rem', borderRadius: 2, overflowX: 'auto', whiteSpace: 'pre-wrap',
      }}>{code}</pre>
    </div>
  )
  if (!svg) return (
    <div style={{
      height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em',
    }}>
      RENDERING…
    </div>
  )

  return (
    <div
      style={{ overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default function DiagramView({ historyId }) {
  const [diagramCode, setDiagramCode] = useState('')
  const containerRef = useRef(null)

  const mutation = useMutation({
    mutationFn: () => api.post('/explain/diagram', { history_id: historyId }).then((r) => r.data),
    onSuccess: ({ diagram_code }) => setDiagramCode(diagram_code),
    onError: (err) => toast.error(err.response?.data?.detail || 'Diagram generation failed'),
  })

  const handleExport = () => {
    const svgEl = containerRef.current?.querySelector('svg')
    if (!svgEl) return
    const blob = new Blob([svgEl.outerHTML], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'diagram.svg'; a.click()
    URL.revokeObjectURL(url)
  }

  if (!diagramCode) {
    return (
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="cyber-btn-ghost"
        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
      >
        {mutation.isPending ? (
          <svg style={{ animation: 'spinCW 1s linear infinite' }} width="12" height="12" fill="none" viewBox="0 0 24 24">
            <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
          </svg>
        )}
        {mutation.isPending ? 'GENERATING…' : 'GENERATE_DIAGRAM'}
      </button>
    )
  }

  return (
    <div style={{
      background: 'rgba(3,6,15,0.8)',
      border: '1px solid rgba(0,229,255,0.15)',
      borderRadius: 2, overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.4rem 0.875rem',
        borderBottom: '1px solid rgba(0,229,255,0.1)',
      }}>
        <span style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 9, letterSpacing: '0.14em', color: 'var(--sub)',
        }}>
          CONCEPT_DIAGRAM
        </span>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={() => setDiagramCode('')}
            style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, color: 'var(--dim)', background: 'none', border: 'none', cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--sub)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--dim)'}
          >
            REGEN
          </button>
          <button
            type="button"
            onClick={handleExport}
            style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 9, color: 'var(--cyan)', background: 'none', border: 'none', cursor: 'pointer',
            }}
          >
            EXPORT_SVG
          </button>
        </div>
      </div>
      <div ref={containerRef}>
        <MermaidRenderer code={diagramCode} />
      </div>
    </div>
  )
}
