import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'

function TopicPill({ topic, explored, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(topic)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, letterSpacing: '0.1em',
        padding: '5px 8px', borderRadius: 2,
        cursor: 'pointer', transition: 'all 0.2s',
        marginBottom: 4,
        ...(explored ? {
          background: 'rgba(0,255,157,0.06)',
          border: '1px solid rgba(0,255,157,0.3)',
          color: 'var(--green)',
        } : {
          background: 'rgba(0,229,255,0.02)',
          border: '1px solid rgba(0,229,255,0.1)',
          color: 'var(--sub)',
        }),
      }}
      onMouseEnter={e => {
        if (!explored) {
          e.currentTarget.style.borderColor = 'rgba(0,229,255,0.3)'
          e.currentTarget.style.color = 'var(--cyan)'
        }
      }}
      onMouseLeave={e => {
        if (!explored) {
          e.currentTarget.style.borderColor = 'rgba(0,229,255,0.1)'
          e.currentTarget.style.color = 'var(--sub)'
        }
      }}
    >
      {explored && '✓ '}
      {topic}
    </button>
  )
}

export default function DepGraph({ topic, onTopicSelect }) {
  // Truncate long topics - dependency graph is for short concept names
  const shortTopic = topic?.length > 100 ? topic.slice(0, 100).split(' ').slice(0, -1).join(' ') : topic

  const { data, isLoading, error } = useQuery({
    queryKey: ['dependencies', shortTopic],
    queryFn: () => api.get('/profile/dependencies', { params: { topic: shortTopic } }).then((r) => r.data),
    enabled: !!shortTopic && shortTopic.length < 200,
  })

  if (!topic || topic.length > 500) return null

  if (isLoading) {
    return (
      <div style={{
        height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, letterSpacing: '0.1em', color: 'var(--dim)',
      }}>
        LOADING DEPENDENCY GRAPH…
      </div>
    )
  }

  if (error || !data) {
    return (
      <p style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, color: '#ff4466', textAlign: 'center', padding: '1rem 0',
      }}>
        GRAPH_LOAD_ERROR
      </p>
    )
  }

  const hasAny = data.prerequisites.length > 0 || data.next_topics.length > 0 || data.related.length > 0

  if (!hasAny) {
    return (
      <p style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 9, color: 'var(--dim)', textAlign: 'center', padding: '1rem 0',
      }}>
        NO_GRAPH_DATA for "{topic}"
      </p>
    )
  }

  const colLabel = (text, align = 'left') => (
    <p style={{
      fontFamily: "'Share Tech Mono',monospace",
      fontSize: 9, letterSpacing: '0.14em', color: 'var(--dim)',
      textTransform: 'uppercase', marginBottom: 8,
      textAlign: align,
    }}>
      {text}
    </p>
  )

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'start' }}>
        {/* Prerequisites */}
        <div>
          {colLabel('◀ PREREQUISITES')}
          {data.prerequisites.length === 0 ? (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--dim)', fontStyle: 'italic' }}>none</span>
          ) : (
            data.prerequisites.map((item) => (
              <TopicPill key={item.topic} topic={item.topic} explored={item.explored} onClick={onTopicSelect} />
            ))
          )}
        </div>

        {/* Current */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <div style={{
            width: '100%',
            background: 'rgba(0,229,255,0.06)',
            border: '2px solid rgba(0,229,255,0.4)',
            borderRadius: 2, padding: '0.625rem',
            textAlign: 'center',
          }}>
            <p style={{
              fontFamily: "'Share Tech Mono',monospace",
              fontSize: 8, letterSpacing: '0.14em', color: 'var(--sub)', marginBottom: 3,
            }}>
              CURRENT
            </p>
            <p style={{
              fontFamily: "'Orbitron',monospace",
              fontSize: 11, fontWeight: 700, color: 'var(--cyan)',
              lineHeight: 1.2,
            }}>
              {shortTopic?.toUpperCase()}
            </p>
          </div>
          {data.related.length > 0 && (
            <div style={{ width: '100%' }}>
              {colLabel('RELATED', 'center')}
              {data.related.map((item) => (
                <TopicPill key={item.topic} topic={item.topic} explored={item.explored} onClick={onTopicSelect} />
              ))}
            </div>
          )}
        </div>

        {/* Next */}
        <div>
          {colLabel('UP NEXT ▶', 'right')}
          {data.next_topics.length === 0 ? (
            <span style={{ fontFamily: "'Share Tech Mono',monospace", fontSize: 9, color: 'var(--green)', display: 'block', textAlign: 'right' }}>
              FRONTIER REACHED
            </span>
          ) : (
            data.next_topics.map((item) => (
              <TopicPill key={item.topic} topic={item.topic} explored={item.explored} onClick={onTopicSelect} />
            ))
          )}
        </div>
      </div>

      <p style={{
        fontFamily: "'Share Tech Mono',monospace",
        fontSize: 8, letterSpacing: '0.1em', color: 'var(--dim)',
        textAlign: 'center', marginTop: 10,
      }}>
        GREEN = EXPLORED · CLICK ANY TOPIC TO LEARN IT NEXT
      </p>
    </div>
  )
}
