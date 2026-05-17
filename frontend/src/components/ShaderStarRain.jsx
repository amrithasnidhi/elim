/**
 * ShaderStarRain.jsx
 *
 * Linear meteor-streaks WebGL background, tinted to ELIM's palette
 * (cyan / purple / green / antique gold).
 *
 * - Strictly linear motion (no aurora curves)
 * - ~36 stars at any time, each with bright head + tapered tail
 * - Renders into a fixed canvas at z-index 0, behind everything else
 * - Pauses when the tab is hidden, throttles when offscreen via IntersectionObserver
 */

import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export default function ShaderStarRain({
  intensity = 1.0,          // overall brightness multiplier
  density   = 36,           // number of star slots
  speed     = 0.45,         // global speed scale
  angleDeg  = 215,          // travel direction in degrees (215 = down-left)
}) {
  const wrapRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha:     true,
      powerPreference: 'low-power',
    })

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    renderer.setPixelRatio(dpr)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setClearColor(0x000000, 0)
    wrap.appendChild(renderer.domElement)

    const ang = (angleDeg * Math.PI) / 180
    const dir = new THREE.Vector2(Math.cos(ang), Math.sin(ang))

    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        iTime:       { value: 0 },
        iResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
        uIntensity:  { value: intensity },
        uDensity:    { value: Math.max(8, Math.min(80, density)) },
        uSpeed:      { value: speed },
        uDir:        { value: dir },
      },
      vertexShader: /* glsl */ `
        void main() { gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;

        uniform float iTime;
        uniform vec2  iResolution;
        uniform float uIntensity;
        uniform float uDensity;
        uniform float uSpeed;
        uniform vec2  uDir;

        // deterministic per-star hash
        float hash11(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
        float hash12(vec2 p) {
          return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
        }

        // ELIM palette — cyan / purple / green / gold
        vec3 paletteColor(float t) {
          // Bands: 0-0.40 cyan, 0.40-0.70 purple, 0.70-0.92 green, 0.92-1.0 gold
          if (t < 0.40) return vec3(0.00, 0.90, 1.00);   // cyan
          if (t < 0.70) return vec3(0.49, 0.43, 0.94);   // purple
          if (t < 0.92) return vec3(0.00, 1.00, 0.62);   // green
          return vec3(0.79, 0.66, 0.42);                 // antique gold
        }

        // Sample one star slot's contribution to this fragment.
        // dir: travel direction (unit). uv: aspect-corrected fragment position.
        vec3 sampleStar(vec2 uv, float idx, vec2 dir) {
          float seed = idx * 1.731 + 0.137;

          // Per-star randomized parameters
          float lane    = hash11(seed) * 2.2 - 1.1;           // lateral lane offset
          float spdRand = 0.55 + hash11(seed + 1.0) * 0.85;   // speed jitter
          float life    = 3.5 + hash11(seed + 2.0) * 4.0;     // seconds per cycle
          float phase   = hash11(seed + 3.0) * life;          // start offset
          float trailLen= 0.18 + hash11(seed + 4.0) * 0.18;   // 0.18..0.36
          float headSize= 0.0028 + hash11(seed + 5.0) * 0.0024;
          float thick   = 0.0010 + hash11(seed + 6.0) * 0.0009;

          float t = mod(iTime * uSpeed * spdRand + phase, life) / life; // 0..1 lifecycle

          // Lateral basis perpendicular to direction
          vec2 perp = vec2(-dir.y, dir.x);

          // Star path: start off-screen "above" along -dir, travel +dir across screen.
          // Lane is the perpendicular offset; lane*1.6 spreads stars across the field.
          vec2 origin = -dir * 1.4 + perp * lane * 1.6;
          vec2 pos    = origin + dir * t * 3.0;

          // Project fragment into (along, across) star-local coords
          vec2 d  = uv - pos;
          float along  = dot(d, -dir);   // positive = behind the head
          float across = dot(d,  perp);  // perpendicular distance

          // Lifecycle fade — in fast, out slow, both ends invisible
          float lifeFade = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.88, t);

          // Head: tight bright disk
          float headDist = length(d);
          float head = exp(-headDist / headSize) * 1.4;

          // Tail: behind the head only, perpendicular falloff is linear (clean streak)
          float tail = 0.0;
          if (along > 0.0 && along < trailLen) {
            float taper  = 1.0 - along / trailLen;
            // sharper at the head, softer toward the end
            float thickT = thick * (1.0 + along * 2.5);
            tail = exp(-abs(across) / thickT) * taper * taper * 0.85;
          }

          // Color from per-star slot
          vec3 col = paletteColor(hash11(seed + 9.0));

          return col * (head + tail) * lifeFade;
        }

        void main() {
          // Aspect-correct UVs in [-aspect, aspect] x [-1, 1]
          vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
          vec2 dir = normalize(uDir);

          vec3 color = vec3(0.0);
          float N = uDensity;
          for (float i = 0.0; i < 80.0; i++) {     // upper bound (GLSL needs constant loops)
            if (i >= N) break;
            color += sampleStar(uv, i, dir);
          }

          // Soft vignette so edges don't feel as bright as the center
          float vig = smoothstep(1.4, 0.2, length(uv));
          color *= (0.55 + 0.45 * vig);

          // Tonemap-ish soft clamp
          color = color / (1.0 + color);
          gl_FragColor = vec4(color * uIntensity, 1.0);
        }
      `,
    })

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material)
    scene.add(mesh)

    let frameId
    let lastT = performance.now() / 1000
    let running = true
    let inView  = true

    const tick = () => {
      const now = performance.now() / 1000
      const dt  = Math.min(0.05, now - lastT)   // clamp dt for sane catch-up after tab refocus
      lastT = now
      material.uniforms.iTime.value += dt
      renderer.render(scene, camera)
      if (running && inView) {
        frameId = requestAnimationFrame(tick)
      }
    }
    frameId = requestAnimationFrame(tick)

    const resume = () => {
      if (!running || !inView) return
      lastT = performance.now() / 1000
      cancelAnimationFrame(frameId)
      frameId = requestAnimationFrame(tick)
    }

    // Resize handler
    const onResize = () => {
      const w = window.innerWidth, h = window.innerHeight
      renderer.setSize(w, h)
      material.uniforms.iResolution.value.set(w, h)
    }
    window.addEventListener('resize', onResize)

    // Pause when tab hidden
    const onVis = () => {
      running = !document.hidden
      if (running) resume()
    }
    document.addEventListener('visibilitychange', onVis)

    // Pause when component scrolled out of view
    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      if (inView) resume()
    })
    io.observe(wrap)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', onVis)
      io.disconnect()
      mesh.geometry.dispose()
      material.dispose()
      renderer.dispose()
      if (wrap.contains(renderer.domElement)) {
        wrap.removeChild(renderer.domElement)
      }
    }
  }, [intensity, density, speed, angleDeg])

  return (
    <div
      ref={wrapRef}
      aria-hidden
      style={{
        position: 'fixed', inset: 0, zIndex: 0,
        pointerEvents: 'none', overflow: 'hidden',
      }}
    />
  )
}
