import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'

const SOURCE_META = {
  gdrive: {
    label: 'Google Drive',
    icon: (
      <svg viewBox="0 0 87.3 78" className="w-6 h-6" fill="none">
        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.45z" fill="#ea4335"/>
        <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.1.45-4.5 1.2z" fill="#00832d"/>
        <path d="M59.8 53H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.8c1.6 0 3.1-.45 4.5-1.2z" fill="#2684fc"/>
        <path d="M73.4 26.5L59.65 3.15c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
      </svg>
    ),
    description: 'Index your lecture notes, PDFs, slides, and textbook chapters.',
    color: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    oauth: true,
  },
  notion: {
    label: 'Notion',
    icon: (
      <svg viewBox="0 0 100 100" className="w-6 h-6" fill="currentColor">
        <path d="M6.085 10.512c1.614 1.315 2.22 1.215 5.25.808l67.237-8.11c.607 0 .102-.607-.1-.708L67.17.288C65.454-.12 63.536-.12 61.21.49L5.78 8.496c-2.22.405-2.626 1.313-2.22 2.016zm2.624 9.44v67.87c0 3.639 1.82 4.95 5.98 4.648l74.032-4.242c4.146-.304 4.656-2.93 4.656-6.062V14.08c0-3.13-1.214-4.85-3.94-4.548l-77.26 4.547c-3.031.203-3.468 1.824-3.468 5.872zm73.125 2.426c.406 1.824 0 3.64-1.824 3.843l-3.031.606v44.694c-2.626 1.32-5.048 2.016-7.064 2.016-3.234 0-4.046-1.016-6.47-4.043L42.25 47.71v26.715l6.267 1.318s0 3.64-5.048 3.64L32.1 79.99c-.404-1.32 0-3.537 1.42-3.944l3.74-.91V36.11l-5.048-.403c-.404-1.826.608-4.445 3.435-4.648l11.3-.71 23.9 36.59V32.27l-5.25-.606c-.405-2.23 1.215-3.844 3.234-4.044l12.005-.71z"/>
      </svg>
    ),
    description: 'Pull from your personal study notes, databases, and knowledge wikis.',
    color: 'border-gray-200 bg-gray-50',
    badge: 'bg-gray-100 text-gray-700',
    oauth: true,
  },
  github: {
    label: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    description: 'Index READMEs, code files, algorithm implementations, and wikis.',
    color: 'border-neutral-200 bg-neutral-50',
    badge: 'bg-neutral-100 text-neutral-700',
    oauth: true,
    pat: true,
  },
  slack: {
    label: 'Slack',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z"/>
      </svg>
    ),
    description: 'Surface study group discussions, Q&A threads, and pinned resources.',
    color: 'border-purple-200 bg-purple-50',
    badge: 'bg-purple-100 text-purple-700',
    oauth: true,
  },
  web: {
    label: 'Web Search',
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    description: 'Fallback web search via Wikipedia, MDN, ArXiv, GeeksForGeeks. Max 3 searches.',
    color: 'border-indigo-200 bg-indigo-50',
    badge: 'bg-indigo-100 text-indigo-700',
    oauth: false,
  },
}

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

function PatInput({ source, onConnected }) {
  const [pat, setPat] = useState('')
  const [show, setShow] = useState(false)

  const mutation = useMutation({
    mutationFn: (token) => api.post(`/mcp/connect/${source}`, { token }).then((r) => r.data),
    onSuccess: () => {
      toast.success('Connected via Personal Access Token')
      setPat('')
      setShow(false)
      onConnected()
    },
    onError: () => toast.error('Failed to connect — check your token'),
  })

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="text-xs text-gray-500 hover:text-indigo-600 underline"
      >
        Use Personal Access Token instead
      </button>
    )
  }

  return (
    <div className="mt-2 flex gap-2">
      <input
        type="password"
        value={pat}
        onChange={(e) => setPat(e.target.value)}
        placeholder="ghp_xxxxxxxxxxxx"
        className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100 outline-none"
      />
      <button
        type="button"
        disabled={!pat.trim() || mutation.isPending}
        onClick={() => mutation.mutate(pat.trim())}
        className="text-sm bg-gray-800 hover:bg-gray-900 disabled:bg-gray-300 text-white font-medium px-3 py-2 rounded-lg transition-all"
      >
        {mutation.isPending ? '...' : 'Connect'}
      </button>
      <button type="button" onClick={() => setShow(false)} className="text-gray-400 hover:text-gray-600 text-sm px-1">✕</button>
    </div>
  )
}

function IndexingPanel({ sourceKey, connected }) {
  const [jobId, setJobId] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const indexMutation = useMutation({
    mutationFn: () => api.post('/mcp/index', { source: sourceKey }).then((r) => r.data),
    onSuccess: ({ job_id }) => {
      setJobId(job_id)
      toast.success('Indexing started')
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'Celery worker not running'
      toast.error(msg)
    },
  })

  const { data: jobStatus } = useQuery({
    queryKey: ['index-status', jobId],
    queryFn: () => api.get('/mcp/index/status', { params: { job_id: jobId } }).then((r) => r.data),
    enabled: !!jobId,
    refetchInterval: (data) => {
      if (!data || data.status === 'done' || data.status === 'failed') return false
      return 1500
    },
    onSuccess: (data) => {
      if (data.status === 'done') {
        toast.success(`Indexed ${data.files_indexed} chunks`)
        qc.invalidateQueries({ queryKey: ['mcp-sources'] })
        qc.invalidateQueries({ queryKey: ['indexed-docs', sourceKey] })
        setJobId(null)
      }
      if (data.status === 'failed') {
        toast.error('Indexing failed')
        setJobId(null)
      }
    },
  })

  const { data: docsData } = useQuery({
    queryKey: ['indexed-docs', sourceKey],
    queryFn: () => api.get('/mcp/indexed-docs', { params: { source: sourceKey, page: 1, limit: 5 } }).then((r) => r.data),
    enabled: connected && expanded,
  })

  const isRunning = !!jobId && jobStatus && jobStatus.status === 'running'
  const pct = jobStatus?.progress_pct ?? 0

  if (!connected) return null

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={indexMutation.isPending || isRunning}
          onClick={() => indexMutation.mutate()}
          className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 disabled:bg-gray-50 disabled:text-gray-400 text-gray-700 font-medium px-3 py-1.5 rounded-lg transition-all"
        >
          <svg className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRunning ? 'Indexing…' : 'Re-index'}
        </button>
        {docsData?.total > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs text-indigo-500 hover:underline"
          >
            {expanded ? 'Hide' : `View ${docsData.total} chunks`}
          </button>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="space-y-1">
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{jobStatus?.status} — {pct}%</p>
        </div>
      )}

      {/* Chunk preview */}
      {expanded && docsData?.docs?.length > 0 && (
        <div className="space-y-1.5 mt-2">
          {docsData.docs.map((doc) => (
            <div key={doc.id} className="bg-white/70 border border-white rounded-lg px-3 py-2">
              {doc.doc_title && (
                <p className="text-xs font-semibold text-gray-500 mb-0.5">{doc.doc_title}</p>
              )}
              <p className="text-xs text-gray-600 line-clamp-2">{doc.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sources() {
  const qc = useQueryClient()
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const connected = searchParams.get('connected')
    const error = searchParams.get('error')
    if (connected) {
      const label = SOURCE_META[connected]?.label || connected
      toast.success(`${label} connected successfully!`)
      qc.invalidateQueries({ queryKey: ['mcp-sources'] })
    }
    if (error) {
      toast.error(`OAuth failed: ${error.replace(/_/g, ' ')}`)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['mcp-sources'],
    queryFn: () => api.get('/mcp/sources').then((r) => r.data),
  })

  const oauthStartMutation = useMutation({
    mutationFn: (source) => api.get(`/mcp/oauth/start/${source}`).then((r) => r.data),
    onSuccess: ({ auth_url }) => {
      window.location.href = auth_url
    },
    onError: (err) => {
      const msg = err.response?.data?.detail || 'OAuth not configured on this server'
      toast.error(msg)
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: (source) => api.delete(`/mcp/disconnect/${source}`).then((r) => r.data),
    onSuccess: (_, source) => {
      toast.success(`${SOURCE_META[source]?.label} disconnected`)
      qc.invalidateQueries({ queryKey: ['mcp-sources'] })
    },
    onError: () => toast.error('Failed to disconnect'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ source, enabled }) =>
      api.post('/mcp/sources/toggle', { source, enabled }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-sources'] }),
    onError: () => toast.error('Failed to update setting'),
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const sources = {}
  for (const s of data?.sources ?? []) {
    sources[s.key] = s
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Sources</h1>
          <p className="text-gray-500 mt-1">
            Connect your personal notes and docs — ELIM will cite them in every explanation.
          </p>
        </div>

        <div className="space-y-4">
          {Object.entries(SOURCE_META).map(([key, meta]) => {
            const status = sources[key] ?? {}
            const connected = status.connected ?? (key === 'web')
            const enabled = status.enabled ?? false
            const configured = status.configured ?? (key === 'web')

            return (
              <div
                key={key}
                className={`bg-white rounded-2xl border ${meta.color} p-5 shadow-sm`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="mt-0.5 flex-shrink-0">{meta.icon}</div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900">{meta.label}</span>
                        {connected && key !== 'web' ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.badge}`}>
                            Connected
                          </span>
                        ) : key === 'web' ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            Built-in
                          </span>
                        ) : (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            Not connected
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5">{meta.description}</p>

                      {/* Connect actions */}
                      {key !== 'web' && !connected && (
                        <div className="mt-3 flex flex-col gap-1.5">
                          {meta.oauth && (
                            <button
                              type="button"
                              disabled={!configured || oauthStartMutation.isPending}
                              onClick={() => oauthStartMutation.mutate(key)}
                              className="w-fit flex items-center gap-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-medium px-3.5 py-2 rounded-lg transition-all"
                            >
                              {oauthStartMutation.isPending ? (
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              )}
                              {configured ? `Connect ${meta.label}` : 'Not configured (see .env)'}
                            </button>
                          )}
                          {meta.pat && (
                            <PatInput source={key} onConnected={() => qc.invalidateQueries({ queryKey: ['mcp-sources'] })} />
                          )}
                        </div>
                      )}

                      {/* Disconnect + stats for connected sources */}
                      {key !== 'web' && connected && (
                        <>
                          <div className="mt-3 flex items-center gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() => disconnectMutation.mutate(key)}
                              disabled={disconnectMutation.isPending}
                              className="text-sm text-red-500 hover:text-red-700 font-medium"
                            >
                              Disconnect
                            </button>
                            {status.last_indexed && (
                              <span className="text-xs text-gray-400">
                                Last indexed: {new Date(status.last_indexed).toLocaleDateString()}
                              </span>
                            )}
                            {status.doc_count > 0 && (
                              <span className="text-xs text-gray-400">{status.doc_count} chunks</span>
                            )}
                          </div>
                          <IndexingPanel sourceKey={key} connected={connected} />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Enable/disable toggle */}
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    <Toggle
                      checked={enabled}
                      onChange={(val) => toggleMutation.mutate({ source: key, enabled: val })}
                    />
                    <span className="text-xs text-gray-400">{enabled ? 'Active' : 'Off'}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info box */}
        <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-800">
          <strong className="font-semibold">How it works:</strong> When you ask for an explanation,
          ELIM queries your enabled sources in parallel, deduplicates the results, and injects the
          most relevant content into the prompt. Your own notes take priority over web search results.
        </div>
      </div>
    </div>
  )
}
