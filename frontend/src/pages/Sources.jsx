import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '../lib/api'
import Background from '../components/Background'

const SOURCE_META = {
  gdrive: {
    label: 'GOOGLE_DRIVE',
    icon: (
      <svg viewBox="0 0 87.3 78" style={{ width: 22, height: 22 }} fill="none">
        <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
        <path d="M43.65 25L29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
        <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.45z" fill="#ea4335"/>
        <path d="M43.65 25L57.4 1.2C56.05.4 54.5 0 52.9 0H34.4c-1.6 0-3.1.45-4.5 1.2z" fill="#00832d"/>
        <path d="M59.8 53H27.5L13.75 76.8c1.4.8 2.95 1.2 4.5 1.2h50.8c1.6 0 3.1-.45 4.5-1.2z" fill="#2684fc"/>
        <path d="M73.4 26.5L59.65 3.15c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 59.8 53h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
      </svg>
    ),
    description: 'Index lecture notes, PDFs, slides, and textbook chapters.',
    color: 'rgba(0,102,218,0.3)',
    oauth: true,
  },
  notion: {
    label: 'NOTION',
    icon: (
      <svg viewBox="0 0 100 100" style={{ width: 22, height: 22 }} fill="var(--text)">
        <path d="M6.085 10.512c1.614 1.315 2.22 1.215 5.25.808l67.237-8.11c.607 0 .102-.607-.1-.708L67.17.288C65.454-.12 63.536-.12 61.21.49L5.78 8.496c-2.22.405-2.626 1.313-2.22 2.016zm2.624 9.44v67.87c0 3.639 1.82 4.95 5.98 4.648l74.032-4.242c4.146-.304 4.656-2.93 4.656-6.062V14.08c0-3.13-1.214-4.85-3.94-4.548l-77.26 4.547c-3.031.203-3.468 1.824-3.468 5.872zm73.125 2.426c.406 1.824 0 3.64-1.824 3.843l-3.031.606v44.694c-2.626 1.32-5.048 2.016-7.064 2.016-3.234 0-4.046-1.016-6.47-4.043L42.25 47.71v26.715l6.267 1.318s0 3.64-5.048 3.64L32.1 79.99c-.404-1.32 0-3.537 1.42-3.944l3.74-.91V36.11l-5.048-.403c-.404-1.826.608-4.445 3.435-4.648l11.3-.71 23.9 36.59V32.27l-5.25-.606c-.405-2.23 1.215-3.844 3.234-4.044l12.005-.71z"/>
      </svg>
    ),
    description: 'Pull from personal study notes, databases, and knowledge wikis.',
    color: 'rgba(90,143,170,0.3)',
    oauth: true,
  },
  github: {
    label: 'GITHUB',
    icon: (
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="var(--text)">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
      </svg>
    ),
    description: 'Index READMEs, code files, algorithm implementations, and wikis.',
    color: 'rgba(90,143,170,0.2)',
    oauth: true,
    pat: true,
  },
  slack: {
    label: 'SLACK',
    icon: (
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="currentColor">
        <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.165 0a2.528 2.528 0 012.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.165 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 01-2.52-2.523 2.526 2.526 0 012.52-2.52h6.313A2.527 2.527 0 0124 15.165a2.528 2.528 0 01-2.522 2.523h-6.313z" style={{ color: 'var(--purple)' }} />
      </svg>
    ),
    description: 'Surface study group discussions, Q&A threads, and pinned resources.',
    color: 'rgba(124,110,240,0.2)',
    oauth: true,
  },
  web: {
    label: 'WEB_SEARCH',
    icon: (
      <svg viewBox="0 0 24 24" style={{ width: 22, height: 22 }} fill="none" stroke="var(--cyan)">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    description: 'Wikipedia, MDN, ArXiv, GeeksForGeeks fallback. Max 3 searches.',
    color: 'rgba(0,229,255,0.2)',
    oauth: false,
  },
}

function CyberToggle({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        position: 'relative', display: 'inline-flex',
        width: 40, height: 22,
        borderRadius: 11,
        background: checked ? 'rgba(0,229,255,0.25)' : 'rgba(0,229,255,0.06)',
        border: checked ? '1px solid rgba(0,229,255,0.5)' : '1px solid rgba(0,229,255,0.15)',
        cursor: 'pointer', transition: 'all 0.2s',
        outline: 'none', flexShrink: 0,
      }}
    >
      <span style={{
        position: 'absolute', top: 2,
        left: checked ? 20 : 2,
        width: 16, height: 16,
        borderRadius: '50%',
        background: checked ? 'var(--cyan)' : 'var(--dim)',
        boxShadow: checked ? '0 0 8px rgba(0,229,255,0.6)' : 'none',
        transition: 'all 0.2s',
      }} />
    </button>
  )
}

function PatInput({ source, onConnected }) {
  const [pat, setPat] = useState('')
  const [show, setShow] = useState(false)

  const mutation = useMutation({
    mutationFn: (token) => api.post(`/mcp/connect/${source}`, { token }).then((r) => r.data),
    onSuccess: () => {
      toast.success('CONNECTED VIA PAT')
      setPat(''); setShow(false)
      onConnected()
    },
    onError: () => toast.error('CONNECTION_FAILED — check your token'),
  })

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        style={{
          fontFamily: "'Share Tech Mono',monospace",
          fontSize: 8, color: 'var(--sub)', background: 'none', border: 'none',
          cursor: 'pointer', textDecoration: 'underline',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--cyan)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--sub)'}
      >
        USE_PERSONAL_ACCESS_TOKEN
      </button>
    )
  }

  return (
    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
      <input
        type="password"
        value={pat}
        onChange={(e) => setPat(e.target.value)}
        placeholder="ghp_xxxxxxxxxxxx"
        className="cyber-input"
        style={{ padding: '0.35rem 0.75rem', fontSize: 11 }}
      />
      <button
        type="button"
        disabled={!pat.trim() || mutation.isPending}
        onClick={() => mutation.mutate(pat.trim())}
        className="cyber-btn-ghost"
      >
        {mutation.isPending ? '…' : 'CONNECT'}
      </button>
      <button type="button" onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--dim)', cursor: 'pointer', fontSize: 14 }}>✕</button>
    </div>
  )
}

function IndexingPanel({ sourceKey, connected }) {
  const [jobId, setJobId] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const qc = useQueryClient()

  const indexMutation = useMutation({
    mutationFn: () => api.post('/mcp/index', { source: sourceKey }).then((r) => r.data),
    onSuccess: ({ job_id }) => { setJobId(job_id); toast.success('INDEXING STARTED') },
    onError: (err) => toast.error(err.response?.data?.detail || 'WORKER_NOT_RUNNING'),
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
        toast.success(`INDEXED ${data.files_indexed} CHUNKS`)
        qc.invalidateQueries({ queryKey: ['mcp-sources'] })
        qc.invalidateQueries({ queryKey: ['indexed-docs', sourceKey] })
        setJobId(null)
      }
      if (data.status === 'failed') {
        toast.error('INDEXING_FAILED')
        setJobId(null)
      }
    },
  })

  const { data: docsData } = useQuery({
    queryKey: ['indexed-docs', sourceKey],
    queryFn: () => api.get('/mcp/indexed-docs', { params: { source: sourceKey, page: 1, limit: 5 } }).then((r) => r.data),
    enabled: connected && expanded,
  })

  const isRunning = !!jobId && jobStatus?.status === 'running'
  const pct = jobStatus?.progress_pct ?? 0

  if (!connected) return null

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="button"
          disabled={indexMutation.isPending || isRunning}
          onClick={() => indexMutation.mutate()}
          className="cyber-btn-ghost"
          style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: (indexMutation.isPending || isRunning) ? 0.5 : 1 }}
        >
          <svg style={{ animation: isRunning ? 'spinCW 1s linear infinite' : 'none' }} width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isRunning ? 'INDEXING…' : 'RE_INDEX'}
        </button>
        {docsData?.total > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 8, color: 'var(--cyan)', background: 'none',
              border: 'none', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            {expanded ? 'HIDE' : `VIEW_${docsData.total}_CHUNKS`}
          </button>
        )}
      </div>

      {isRunning && (
        <div>
          <div className="weight-bar-track">
            <div className="weight-bar-fill" style={{ width: `${pct}%`, background: 'var(--cyan)', transition: 'width 0.5s' }} />
          </div>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)', marginTop: 2 }}>
            {pct}%
          </p>
        </div>
      )}

      {expanded && docsData?.docs?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {docsData.docs.map((doc) => (
            <div key={doc.id} style={{
              background: 'rgba(0,229,255,0.02)',
              border: '1px solid rgba(0,229,255,0.08)',
              borderRadius: 2, padding: '0.4rem 0.625rem',
            }}>
              {doc.doc_title && (
                <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--sub)', marginBottom: 2 }}>
                  {doc.doc_title}
                </p>
              )}
              <p style={{
                fontFamily: "'Rajdhani',sans-serif",
                fontSize: 11, color: 'var(--dim)',
                overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              }}>
                {doc.text}
              </p>
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
      toast.success(`${label} CONNECTED`)
      qc.invalidateQueries({ queryKey: ['mcp-sources'] })
    }
    if (error) toast.error(`OAUTH_FAILED: ${error.replace(/_/g, ' ')}`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, isLoading } = useQuery({
    queryKey: ['mcp-sources'],
    queryFn: () => api.get('/mcp/sources').then((r) => r.data),
  })

  const oauthStartMutation = useMutation({
    mutationFn: (source) => api.get(`/mcp/oauth/start/${source}`).then((r) => r.data),
    onSuccess: ({ auth_url }) => { window.location.href = auth_url },
    onError: (err) => toast.error(err.response?.data?.detail || 'OAUTH_NOT_CONFIGURED'),
  })

  const disconnectMutation = useMutation({
    mutationFn: (source) => api.delete(`/mcp/disconnect/${source}`).then((r) => r.data),
    onSuccess: (_, source) => {
      toast.success(`${SOURCE_META[source]?.label} DISCONNECTED`)
      qc.invalidateQueries({ queryKey: ['mcp-sources'] })
    },
    onError: () => toast.error('DISCONNECT_FAILED'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ source, enabled }) =>
      api.post('/mcp/sources/toggle', { source, enabled }).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mcp-sources'] }),
    onError: () => toast.error('TOGGLE_FAILED'),
  })

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '2px solid rgba(0,229,255,0.1)',
          borderTop: '2px solid var(--cyan)',
          animation: 'spinCW 0.8s linear infinite',
        }} />
      </div>
    )
  }

  const sources = {}
  for (const s of data?.sources ?? []) sources[s.key] = s

  return (
    <div style={{ minHeight: '100vh', position: 'relative' }}>
      <Background />
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto', padding: '3rem 1.5rem' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{
            fontFamily: "'Orbitron',monospace",
            fontSize: 18, fontWeight: 700, letterSpacing: '0.12em',
            color: 'var(--cyan)', textShadow: '0 0 20px rgba(0,229,255,0.3)',
            marginBottom: 4,
          }}>
            KNOWLEDGE_SOURCES
          </h1>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', letterSpacing: '0.1em' }}>
            CONNECT YOUR NOTES AND DOCS — ELIM WILL CITE THEM IN EVERY EXPLANATION
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Object.entries(SOURCE_META).map(([key, meta]) => {
            const status = sources[key] ?? {}
            const connected = status.connected ?? (key === 'web')
            const enabled = status.enabled ?? false
            const configured = status.configured ?? (key === 'web')

            return (
              <div key={key} style={{
                background: 'rgba(7,13,26,0.9)',
                border: `1px solid ${connected ? meta.color : 'rgba(0,229,255,0.1)'}`,
                borderRadius: 2, padding: '1.25rem',
                transition: 'border-color 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, marginTop: 2 }}>{meta.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <span style={{
                          fontFamily: "'Share Tech Mono',monospace",
                          fontSize: 9, letterSpacing: '0.12em', color: 'var(--text)',
                        }}>
                          {meta.label}
                        </span>
                        {connected && key !== 'web' ? (
                          <span style={{
                            fontFamily: "'Share Tech Mono',monospace", fontSize: 7, letterSpacing: '0.1em',
                            color: 'var(--green)', border: '1px solid rgba(0,255,157,0.3)',
                            background: 'rgba(0,255,157,0.06)', padding: '1px 5px', borderRadius: 1,
                          }}>
                            CONNECTED
                          </span>
                        ) : key === 'web' ? (
                          <span style={{
                            fontFamily: "'Share Tech Mono',monospace", fontSize: 7,
                            color: 'var(--cyan)', border: '1px solid rgba(0,229,255,0.25)',
                            background: 'rgba(0,229,255,0.04)', padding: '1px 5px', borderRadius: 1,
                          }}>
                            BUILT_IN
                          </span>
                        ) : (
                          <span style={{
                            fontFamily: "'Share Tech Mono',monospace", fontSize: 7,
                            color: 'var(--dim)', border: '1px solid rgba(0,229,255,0.08)',
                            padding: '1px 5px', borderRadius: 1,
                          }}>
                            NOT_CONNECTED
                          </span>
                        )}
                      </div>
                      <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: 12, color: 'var(--sub)' }}>
                        {meta.description}
                      </p>

                      {key !== 'web' && !connected && (
                        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                          {meta.oauth && (
                            <button
                              type="button"
                              disabled={!configured || oauthStartMutation.isPending}
                              onClick={() => oauthStartMutation.mutate(key)}
                              className="cyber-btn-ghost"
                              style={{
                                width: 'fit-content',
                                display: 'flex', alignItems: 'center', gap: 5,
                                opacity: !configured ? 0.5 : 1,
                              }}
                            >
                              {oauthStartMutation.isPending ? (
                                <svg style={{ animation: 'spinCW 1s linear infinite' }} width="10" height="10" fill="none" viewBox="0 0 24 24">
                                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                              ) : (
                                <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                </svg>
                              )}
                              {configured ? `CONNECT_${meta.label}` : 'NOT_CONFIGURED (see .env)'}
                            </button>
                          )}
                          {meta.pat && (
                            <PatInput source={key} onConnected={() => qc.invalidateQueries({ queryKey: ['mcp-sources'] })} />
                          )}
                        </div>
                      )}

                      {key !== 'web' && connected && (
                        <>
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              onClick={() => disconnectMutation.mutate(key)}
                              disabled={disconnectMutation.isPending}
                              style={{
                                fontFamily: "'Share Tech Mono',monospace",
                                fontSize: 8, color: '#ff4466', background: 'none',
                                border: 'none', cursor: 'pointer', textDecoration: 'underline',
                              }}
                            >
                              DISCONNECT
                            </button>
                            {status.last_indexed && (
                              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>
                                INDEXED: {new Date(status.last_indexed).toLocaleDateString()}
                              </span>
                            )}
                            {status.doc_count > 0 && (
                              <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 8, color: 'var(--dim)' }}>
                                {status.doc_count} CHUNKS
                              </span>
                            )}
                          </div>
                          <IndexingPanel sourceKey={key} connected={connected} />
                        </>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <CyberToggle
                      checked={enabled}
                      onChange={(val) => toggleMutation.mutate({ source: key, enabled: val })}
                    />
                    <span style={{
                      fontFamily: "'Share Tech Mono',monospace",
                      fontSize: 7, letterSpacing: '0.1em',
                      color: enabled ? 'var(--cyan)' : 'var(--dim)',
                    }}>
                      {enabled ? 'ACTIVE' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Info box */}
        <div style={{
          marginTop: '1rem', padding: '0.875rem 1rem',
          background: 'rgba(245,166,35,0.04)',
          border: '1px solid rgba(245,166,35,0.15)',
          borderRadius: 2,
        }}>
          <p style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--amber)', letterSpacing: '0.08em', lineHeight: 1.6 }}>
            HOW_IT_WORKS: WHEN YOU ASK FOR AN EXPLANATION, ELIM QUERIES ENABLED SOURCES IN PARALLEL, DEDUPLICATES RESULTS, AND INJECTS THE MOST RELEVANT CONTENT INTO THE PROMPT. YOUR NOTES TAKE PRIORITY OVER WEB SEARCH.
          </p>
        </div>
      </div>
    </div>
  )
}
