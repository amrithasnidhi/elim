const RINGS = [
  { size:220, color:'rgba(0,229,255,0.4)',   border:'1px solid', duration:'12s',  dir:'normal' },
  { size:245, color:'rgba(124,110,240,0.25)', border:'1px solid', duration:'20s',  dir:'reverse' },
  { size:268, color:'rgba(180,79,232,0.15)',  border:'1px solid', duration:'30s',  dir:'normal' },
  { size:290, color:'rgba(0,229,255,0.08)',   border:'1px dashed', duration:'45s', dir:'reverse' },
]

export default function LogoOrbit({ size = 220 }) {
  return (
    <div style={{ position:'relative', width:size, height:size, margin:'0 auto', flexShrink:0 }}>
      {RINGS.map((r, i) => (
        <div key={i} style={{
          position:'absolute',
          top:'50%', left:'50%',
          width:r.size, height:r.size,
          borderRadius:'50%',
          border:r.border,
          borderColor:r.color,
          animation:`${r.dir === 'normal' ? 'spinCW' : 'spinCCW'} ${r.duration} linear infinite`,
          pointerEvents:'none',
          boxShadow: i === 0 ? '0 0 20px rgba(0,229,255,0.1), inset 0 0 20px rgba(0,229,255,0.04)' : 'none',
        }} />
      ))}

      <img
        src="/elim-logo.png"
        alt="ELIM"
        style={{
          position:'absolute',
          top:'50%', left:'50%',
          transform:'translate(-50%,-50%)',
          width:size * 0.82, height:size * 0.82,
          borderRadius:'50%',
          objectFit:'cover',
          filter:'drop-shadow(0 0 30px rgba(0,229,255,0.35)) drop-shadow(0 0 60px rgba(124,110,240,0.25))',
          zIndex:2,
        }}
      />
    </div>
  )
}
