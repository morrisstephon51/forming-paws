/**
 * The hero's 3D meadow — plain three.js, no React renderer.
 *
 * Deliberately not photoreal. The site's visual language is illustrated flat
 * shapes on warm paper, and a lit, shadowed, physically-based landscape would
 * read as a different product bolted onto this one. So: unlit flat colour,
 * crisp ridge silhouettes in the brand greens, and atmospheric fog doing the
 * depth work — the same picture the SVG planes drew, except the ridges now sit
 * at real Z depths and a perspective camera derives the parallax for free
 * rather than three hand-tuned scroll multipliers approximating it.
 *
 * Unlit matters for cost as well as for looks: MeshBasicMaterial needs no
 * lights, no normals and no shadow pass, which is most of what makes a WebGL
 * hero expensive.
 *
 * The sky is NOT drawn here. It stays a DOM <img> behind a transparent canvas,
 * because it is the page's LCP element and must paint without waiting for a
 * script. That also makes the fallback free: if WebGL never starts, the sky and
 * the original CSS planes are already on screen.
 */
import {
  Scene,
  PerspectiveCamera,
  WebGLRenderer,
  Shape,
  ShapeGeometry,
  Mesh,
  MeshBasicMaterial,
  Color,
  Fog,
  BufferGeometry,
  BufferAttribute,
  Points,
  PointsMaterial,
  CanvasTexture,
  AdditiveBlending,
  DoubleSide,
} from 'three'

export type MeadowHandle = {
  setScroll: (progress: number) => void
  setPointer: (x: number, y: number) => void
  resize: () => void
  render: () => void
  start: () => void
  stop: () => void
  dispose: () => void
}

/** Back to front: furthest ridge is palest, matching the surface ramp. */
/*
 * Placed from the projection rather than by eye. At camera (y 22, z 320) with a
 * 38-degree field, each depth plane has its own visible band, so the same y
 * value lands at a different height depending on z. Solving for it puts the
 * horizon at 53-60% down the frame and runs the foreground ridge off the bottom
 * edge at 108%, which is what stops the scene reading as shapes floating in the
 * middle of a box — the first two attempts both did.
 */
const RIDGES = [
  { z: -300, color: '#C4DCCF', amp: 15, freq: 1.2, y: -4, phase: 0.0 },
  { z: -200, color: '#96C2AD', amp: 20, freq: 1.6, y: -18, phase: 1.9 },
  { z: -120, color: '#5F9784', amp: 26, freq: 2.1, y: -34, phase: 3.4 },
  { z: -50, color: '#356F5D', amp: 32, freq: 2.7, y: -50, phase: 5.2 },
  { z: 30, color: '#1E483C', amp: 34, freq: 3.4, y: -60, phase: 0.9 },
]

/** Deterministic — a hero that reshuffles its hills between reloads reads as a bug. */
function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function ridgeShape(width: number, amp: number, freq: number, phase: number, depth: number) {
  const shape = new Shape()
  const half = width / 2
  const steps = 64
  shape.moveTo(-half, -depth)
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const x = -half + t * width
    const a = Math.sin(t * Math.PI * 2 * freq + phase) * amp
    const b = Math.sin(t * Math.PI * 2 * freq * 0.47 + phase * 1.7) * amp * 0.45
    shape.lineTo(x, a + b)
  }
  shape.lineTo(half, -depth)
  shape.closePath()
  return shape
}

export function createMeadow(canvas: HTMLCanvasElement, reduced: boolean): MeadowHandle {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false, // flat colour on soft silhouettes — AA buys nothing here
    powerPreference: 'low-power',
    failIfMajorPerformanceCaveat: false,
  })
  renderer.setClearAlpha(0)

  const scene = new Scene()
  // Fog tinted to the page, so ridges dissolve into the paper instead of ending.
  scene.fog = new Fog(new Color('#FBF7F0').getHex(), 420, 1150)

  const camera = new PerspectiveCamera(38, 1, 1, 1400)
  camera.position.set(0, 22, 320)

  const disposables: { dispose: () => void }[] = []
  const meshes: Mesh[] = []

  for (const r of RIDGES) {
    const geo = new ShapeGeometry(ridgeShape(1800, r.amp, r.freq, r.phase, 460))
    const mat = new MeshBasicMaterial({
      color: new Color(r.color),
      fog: true,
      side: DoubleSide,
    })
    const mesh = new Mesh(geo, mat)
    mesh.position.set(0, r.y, r.z)
    scene.add(mesh)
    meshes.push(mesh)
    disposables.push(geo, mat)
  }

  // Drifting motes. Points rather than sprites: one draw call for all of them.
  const COUNT = 260
  const rnd = rand(20260821)
  const pos = new Float32Array(COUNT * 3)
  const drift = new Float32Array(COUNT * 2)
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (rnd() - 0.5) * 1200
    pos[i * 3 + 1] = 10 + rnd() * 190
    pos[i * 3 + 2] = -180 + rnd() * 300
    drift[i * 2] = 0.12 + rnd() * 0.4
    drift[i * 2 + 1] = rnd() * Math.PI * 2
  }
  const pGeo = new BufferGeometry()
  /*
   * The attribute gets its OWN copy. BufferAttribute stores the array by
   * reference, so handing it `pos` directly made setY() write back into the
   * seed positions — each frame's offset landing on top of the last one
   * instead of replacing it. Measured at 702 units of drift per second
   * against a visible half-height of ~70-170: every mote left the frustum
   * inside a second, so the glow was never actually on screen.
   */
  pGeo.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3))
  /*
   * A soft round sprite, generated rather than shipped. PointsMaterial draws a
   * hard square by default, and 260 hard squares scattered over the sky read as
   * rendering artefacts rather than as motes in the air — visibly worse than
   * having none. Sixty-four pixels of radial gradient on a canvas fixes it for
   * no network cost and no asset to keep in sync.
   */
  function moteSprite() {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const g = c.getContext('2d')
    if (g) {
      const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
      grad.addColorStop(0, 'rgba(255,255,255,1)')
      grad.addColorStop(0.35, 'rgba(255,255,255,0.55)')
      grad.addColorStop(1, 'rgba(255,255,255,0)')
      g.fillStyle = grad
      g.fillRect(0, 0, 64, 64)
    }
    return new CanvasTexture(c)
  }

  const moteMap = moteSprite()

  const pMat = new PointsMaterial({
    map: moteMap,
    alphaMap: moteMap,
    color: new Color('#E8A97A'),
    size: 11,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: true,
  })
  const motes = new Points(pGeo, pMat)
  scene.add(motes)
  disposables.push(pGeo, pMat, moteMap)

  let scroll = 0
  let px = 0
  let py = 0
  let tx = 0
  let ty = 0
  let raf = 0
  let running = false
  let t0 = 0

  function resize() {
    const w = canvas.clientWidth || 1
    const h = canvas.clientHeight || 1
    // DPR is capped hard. A hero canvas at native DPR on a 3x phone is nine
    // times the fragments for an effect nobody is inspecting that closely.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 640 ? 1.25 : 1.75))
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // Keep the ridges filling the frame at any aspect: pull the camera back on
    // narrow viewports rather than letting the silhouettes crop.
    camera.position.z = 320 + Math.max(0, (900 - w) * 0.24)
    camera.updateProjectionMatrix()
  }

  function updateCamera() {
    camera.position.x = px * 26
    camera.position.y = 22 - scroll * 90 + py * 14
    camera.lookAt(px * 10, 6 - scroll * 42, 0)
  }

  function frame(now: number) {
    if (!t0) t0 = now
    const elapsed = (now - t0) / 1000

    // Eased pointer, so the scene leans rather than snaps.
    px += (tx - px) * 0.045
    py += (ty - py) * 0.045

    // The camera does the parallax. Moving one camera through real depth is
    // what the three CSS multipliers were imitating; here it is just true.
    updateCamera()

    if (!reduced) {
      const p = motes.geometry.getAttribute('position') as BufferAttribute
      for (let i = 0; i < COUNT; i++) {
        const sp = drift[i * 2]
        const ph = drift[i * 2 + 1]
        p.setY(i, pos[i * 3 + 1] + Math.sin(elapsed * sp + ph) * 16)
        p.setX(i, pos[i * 3] + Math.cos(elapsed * sp * 0.6 + ph) * 10)
      }
      p.needsUpdate = true
    }

    renderer.render(scene, camera)
    if (running) raf = requestAnimationFrame(frame)
  }

  return {
    setScroll(p) {
      scroll = p
    },
    setPointer(x, y) {
      if (reduced) return
      tx = x
      ty = y
    },
    resize,
    render() {
      // Poses the camera first. Without this the reduced-motion path — which
      // renders exactly once and never enters frame() — composed its single
      // frame with an unposed camera, so those visitors saw a different
      // picture from everyone else rather than the same one held still.
      updateCamera()
      renderer.render(scene, camera)
    },
    start() {
      if (running) return
      running = true
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      if (raf) cancelAnimationFrame(raf)
      raf = 0
    },
    dispose() {
      this.stop()
      for (const d of disposables) d.dispose()
      renderer.dispose()
    },
  }
}
