import * as THREE from 'three'

// Puñado de pasto que salta en el golpe.
export class GrassBurst {
  readonly points: THREE.Points
  private vel: Float32Array
  private life = 0
  private readonly count = 18

  constructor() {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.count * 3), 3))
    this.vel = new Float32Array(this.count * 3)
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0x3f8f2c, size: 0.045, transparent: true, opacity: 1 }),
    )
    this.points.visible = false
    this.points.frustumCulled = false
  }

  emit(at: THREE.Vector3, forward: THREE.Vector3, strength: number): void {
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.count; i++) {
      pos.setXYZ(i, at.x + (Math.random() - 0.5) * 0.15, 0.02, at.z + (Math.random() - 0.5) * 0.15)
      const s = (0.6 + Math.random()) * strength
      this.vel[i * 3] = forward.x * s * 1.2 + (Math.random() - 0.5) * 1.5
      this.vel[i * 3 + 1] = (1 + Math.random() * 2) * s
      this.vel[i * 3 + 2] = forward.z * s * 1.2 + (Math.random() - 0.5) * 1.5
    }
    pos.needsUpdate = true
    this.life = 0.6
    this.points.visible = true
  }

  update(dt: number): void {
    if (!this.points.visible) return
    this.life -= dt
    if (this.life <= 0) {
      this.points.visible = false
      return
    }
    const pos = this.points.geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < this.count; i++) {
      this.vel[i * 3 + 1] -= 9.81 * dt
      const y = Math.max(0.01, pos.getY(i) + this.vel[i * 3 + 1] * dt)
      pos.setXYZ(i, pos.getX(i) + this.vel[i * 3] * dt, y, pos.getZ(i) + this.vel[i * 3 + 2] * dt)
    }
    pos.needsUpdate = true
    ;(this.points.material as THREE.PointsMaterial).opacity = Math.min(1, this.life / 0.3)
  }
}

// Trail de la trayectoria. Color por velocidad: amarillo rápido → rojo lento.
// El del tiro anterior queda tenue para comparar.
export class Trail {
  readonly group = new THREE.Group()
  private current: THREE.Line
  private previous: THREE.Line
  private n = 0
  private readonly max = 3000
  private lastSample = -1
  enabled = true

  constructor() {
    this.current = this.makeLine(1)
    this.previous = this.makeLine(0.3)
    this.group.add(this.current, this.previous)
  }

  private makeLine(opacity: number): THREE.Line {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(this.max * 3), 3))
    geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(this.max * 3), 3))
    geo.setDrawRange(0, 0)
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false }),
    )
    line.frustumCulled = false
    return line
  }

  start(): void {
    // el actual pasa a ser el anterior
    const tmp = this.previous
    this.previous = this.current
    this.current = tmp
    ;(this.previous.material as THREE.LineBasicMaterial).opacity = 0.3
    ;(this.current.material as THREE.LineBasicMaterial).opacity = 1
    this.n = 0
    this.lastSample = -1
    this.current.geometry.setDrawRange(0, 0)
  }

  add(p: THREE.Vector3, speed: number, time: number): void {
    if (this.n >= this.max || time - this.lastSample < 1 / 120) return
    this.lastSample = time
    const geo = this.current.geometry
    ;(geo.getAttribute('position') as THREE.BufferAttribute).setXYZ(this.n, p.x, p.y, p.z)
    const t = Math.min(1, speed / 30)
    ;(geo.getAttribute('color') as THREE.BufferAttribute).setXYZ(this.n, 1, 0.15 + 0.85 * t, 0.1)
    this.n++
    geo.setDrawRange(0, this.n)
    geo.getAttribute('position').needsUpdate = true
    geo.getAttribute('color').needsUpdate = true
  }

  setVisible(v: boolean): void {
    this.enabled = v
    this.group.visible = v
  }
}
