export default function Background() {
  return (
    <>
      {/* Grid */}
      <div style={{
        position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        backgroundImage:`
          linear-gradient(rgba(0,229,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,229,255,0.04) 1px, transparent 1px)
        `,
        backgroundSize:'60px 60px',
      }} />
      {/* Ambient orbs */}
      <div style={{
        position:'fixed', top:'-10%', left:'-5%',
        width:500, height:500, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(124,110,240,0.18), transparent 70%)',
        filter:'blur(80px)', pointerEvents:'none', zIndex:0,
        animation:'orbPulse 6s ease-in-out infinite alternate',
      }} />
      <div style={{
        position:'fixed', top:'20%', right:'-8%',
        width:400, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(0,229,255,0.12), transparent 70%)',
        filter:'blur(80px)', pointerEvents:'none', zIndex:0,
        animation:'orbPulse 6s 2s ease-in-out infinite alternate',
      }} />
      <div style={{
        position:'fixed', bottom:'-10%', left:'30%',
        width:600, height:400, borderRadius:'50%',
        background:'radial-gradient(circle, rgba(180,79,232,0.1), transparent 70%)',
        filter:'blur(80px)', pointerEvents:'none', zIndex:0,
        animation:'orbPulse 6s 4s ease-in-out infinite alternate',
      }} />
    </>
  )
}
