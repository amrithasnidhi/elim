import { useState, useEffect, useRef, useId } from 'react'
import { useMutation } from '@tanstack/react-query'
import mermaid from 'mermaid'
import toast from 'react-hot-toast'
import api from '../lib/api'

mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' })

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

  if (error) return <p className="text-red-500 text-sm py-4 text-center">{error}</p>
  if (!svg) return <div className="h-24 flex items-center justify-center text-gray-400 text-sm">Rendering…</div>

  return (
    <div
      className="overflow-auto flex items-center justify-center p-4"
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
    a.href = url
    a.download = 'diagram.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!diagramCode) {
    return (
      <button
        type="button"
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-700 font-medium px-3 py-2 rounded-xl hover:bg-indigo-50 transition-all disabled:opacity-50"
      >
        {mutation.isPending ? (
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/>
          </svg>
        )}
        {mutation.isPending ? 'Generating diagram…' : 'Diagram'}
      </button>
    )
  }

  return (
    <div className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Concept Diagram</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDiagramCode('')}
            className="text-xs text-gray-400 hover:text-gray-700"
          >
            Regenerate
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
          >
            Export SVG
          </button>
        </div>
      </div>
      <div ref={containerRef}>
        <MermaidRenderer code={diagramCode} />
      </div>
    </div>
  )
}
