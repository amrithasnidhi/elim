export default function CyberPanel({ children, className = '', style = {} }) {
  return (
    <div className={`cyber-panel ${className}`} style={{ padding:'1.5rem', ...style }}>
      {children}
    </div>
  )
}
