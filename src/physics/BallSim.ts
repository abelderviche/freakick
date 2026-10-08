import { Quaternion, Vector3 } from 'three'
import { BALL, FIELD, GOAL } from '../config/GameConfig'
import type { PhysicsConfig } from '../config/PhysicsConfig'
import { addDrag, addMagnus } from './Aerodynamics'
import {
  closestPointOnSegment,
  GOAL_CAPSULES,
  NET_PLANES,
  resolveContact,
  type Capsule,
  type NetContact,
} from './Collisions'

export type SimEventType = 'ground' | 'post' | 'bar' | 'wall' | 'keeper' | 'goal' | 'out'

export interface SimEvent {
  type: SimEventType
  speed: number
  point: Vector3
  time: number
}

const UP = new Vector3(0, 1, 0)
const _f = new Vector3()
const _p = new Vector3()
const _c = new Vector3()
const _n = new Vector3()
const _q = new Quaternion()
const _rel = new Vector3()
const _vt = new Vector3()

export class BallSim {
  readonly pos = new Vector3()
  readonly vel = new Vector3()
  readonly ang = new Vector3() // rad/s, espacio mundo
  readonly quat = new Quaternion()
  readonly prevPos = new Vector3()
  readonly prevQuat = new Quaternion()

  time = 0
  sleeping = true
  grounded = true
  crossedLine = false
  maxHeight = 0
  readonly events: SimEvent[] = []
  readonly netContacts: NetContact[] = NET_PLANES.map(() => ({ side: 0, penetration: 0, u: 0, v: 0 }))

  // Obstáculos extra (barrera, arquero). Se pueden mover: updateObstacles(t) se llama antes de cada
  // step con el tiempo de vuelo, así el salto de la barrera es determinista.
  obstacles: Capsule[] = []
  updateObstacles: ((time: number) => void) | null = null

  constructor(public cfg: PhysicsConfig) {}

  reset(position: Vector3): void {
    this.pos.copy(position)
    this.pos.y = BALL.radius
    this.prevPos.copy(this.pos)
    this.vel.set(0, 0, 0)
    this.ang.set(0, 0, 0)
    this.quat.identity()
    this.prevQuat.identity()
    this.time = 0
    this.sleeping = true
    this.grounded = true
    this.crossedLine = false
    this.maxHeight = 0
    this.events.length = 0
    for (const c of this.netContacts) {
      c.side = 0
      c.penetration = 0
    }
  }

  launch(linearVelocity: Vector3, angularVelocity: Vector3): void {
    this.vel.copy(linearVelocity)
    this.ang.copy(angularVelocity)
    this.sleeping = false
    this.grounded = false
    this.time = 0
  }

  step(dt: number): void {
    this.prevPos.copy(this.pos)
    this.prevQuat.copy(this.quat)
    if (this.sleeping) return

    const cfg = this.cfg
    const m = BALL.mass

    const F = _f.set(0, -cfg.world.gravity * m, 0)
    addDrag(this.vel, cfg, F)
    addMagnus(this.ang, this.vel, cfg, F)
    this.addNetForces(F, dt)

    this.vel.addScaledVector(F, dt / m)
    this.pos.addScaledVector(this.vel, dt)
    this.ang.multiplyScalar(Math.exp(-cfg.spin.decayPerSec * dt))
    integrateQuaternion(this.quat, this.ang, dt)

    this.updateObstacles?.(this.time)
    for (const capsule of GOAL_CAPSULES) this.collideCapsule(capsule)
    for (const capsule of this.obstacles) this.collideCapsule(capsule)
    this.collideGround(dt)
    this.checkGoalLine()

    this.time += dt
    this.maxHeight = Math.max(this.maxHeight, this.pos.y - BALL.radius)

    if (this.grounded && this.vel.lengthSq() < 0.0025 && this.ang.lengthSq() < 0.25) {
      this.vel.set(0, 0, 0)
      this.ang.set(0, 0, 0)
      this.sleeping = true
    }
  }

  private emit(type: SimEventType, speed: number, point: Vector3): void {
    this.events.push({ type, speed, point: point.clone(), time: this.time })
  }

  private collideGround(dt: number): void {
    const r = BALL.radius
    const g = this.cfg.ground
    if (this.pos.y < r) {
      this.pos.y = r
      const impact = -this.vel.y
      const e = impact > g.settleSpeedMps ? g.restitution : 0
      resolveContact(this, UP, e, g.friction)
      if (impact > 1.0) this.emit('ground', impact, this.pos)
    }
    this.grounded = this.pos.y <= r + 1e-3 && Math.abs(this.vel.y) < 0.5
    if (!this.grounded) return

    // resistencia de rodadura + el césped come el spin vertical
    const vx = this.vel.x
    const vz = this.vel.z
    const hs = Math.hypot(vx, vz)
    if (hs > 1e-6) {
      const k = Math.max(0, hs - g.rollingResistance * this.cfg.world.gravity * dt) / hs
      this.vel.x = vx * k
      this.vel.z = vz * k
    }
    this.ang.y *= Math.exp(-g.spinFriction * dt)
  }

  // Test continuo: muestrea el segmento recorrido en este step para no atravesar postes.
  private collideCapsule(capsule: Capsule): void {
    const reach = capsule.radius + BALL.radius
    const distAt = (t: number) => {
      _p.lerpVectors(this.prevPos, this.pos, t)
      return _p.distanceTo(closestPointOnSegment(_p, capsule.a, capsule.b, _c))
    }

    let lo = 0
    let hi = -1
    const samples = 4
    for (let i = 1; i <= samples; i++) {
      const t = i / samples
      if (distAt(t) < reach) {
        hi = t
        lo = (i - 1) / samples
        break
      }
      lo = t
    }
    if (hi < 0) return

    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      if (distAt(mid) < reach) hi = mid
      else lo = mid
    }

    _p.lerpVectors(this.prevPos, this.pos, hi)
    closestPointOnSegment(_p, capsule.a, capsule.b, _c)
    _n.subVectors(_p, _c)
    if (_n.lengthSq() < 1e-12) _n.set(0, 0, 1)
    _n.normalize()
    this.pos.copy(_c).addScaledVector(_n, reach + 1e-4)

    const surface =
      capsule.kind === 'wall' ? this.cfg.wall : capsule.kind === 'keeper' ? this.cfg.keeper : this.cfg.posts
    const impact = resolveContact(this, _n, surface.restitution, surface.friction)
    if (impact > 0.5) this.emit(capsule.kind, impact, this.pos)
  }

  // La red es un resorte amortiguado: la pelota entra, se frena y cae.
  private addNetForces(F: Vector3, dt: number): void {
    const r = BALL.radius
    const net = this.cfg.net
    const m = BALL.mass
    let touching = false

    NET_PLANES.forEach((plane, i) => {
      const contact = this.netContacts[i]
      _rel.subVectors(this.pos, plane.origin)
      const dist = _rel.dot(plane.normal)
      const u = _rel.dot(plane.uAxis)
      const v = _rel.dot(plane.vAxis)
      const inside = u >= 0 && u <= plane.uLen && v >= 0 && v <= plane.vLen

      if (contact.side === 0) {
        if (!inside || Math.abs(dist) >= r) return
        const prevDist = _rel.subVectors(this.prevPos, plane.origin).dot(plane.normal)
        contact.side = Math.sign(prevDist || dist) || 1
      }

      const penetration = r - contact.side * dist
      if (penetration < -0.05 || !inside) {
        contact.side = 0
        contact.penetration = 0
        return
      }
      contact.u = u
      contact.v = v
      contact.penetration = Math.max(0, penetration)
      if (penetration <= 0) return

      touching = true
      _n.copy(plane.normal).multiplyScalar(contact.side)
      const vn = this.vel.dot(_n)
      F.addScaledVector(_n, (net.stiffness * penetration - net.damping * vn) * m)
      _vt.copy(this.vel).addScaledVector(_n, -vn)
      F.addScaledVector(_vt, -net.friction * m)
    })

    if (touching) this.ang.multiplyScalar(Math.exp(-3 * dt))
  }

  private checkGoalLine(): void {
    if (this.crossedLine) return
    const r = BALL.radius
    // gol = la pelota entera cruzó la línea (cara trasera en z = 0)
    if (this.prevPos.z >= -r && this.pos.z < -r) {
      const t = (this.prevPos.z + r) / (this.prevPos.z - this.pos.z)
      _p.lerpVectors(this.prevPos, this.pos, t)
      this.crossedLine = true
      const inFrame = Math.abs(_p.x) < GOAL.width / 2 && _p.y < GOAL.height
      this.emit(inFrame ? 'goal' : 'out', this.vel.length(), _p)
      return
    }
    if (Math.abs(this.pos.x) > FIELD.width / 2 + 2) {
      this.crossedLine = true
      this.emit('out', this.vel.length(), this.pos)
    }
  }
}

function integrateQuaternion(q: Quaternion, w: Vector3, dt: number): void {
  _q.set(w.x * dt * 0.5, w.y * dt * 0.5, w.z * dt * 0.5, 0).multiply(q)
  q.set(q.x + _q.x, q.y + _q.y, q.z + _q.z, q.w + _q.w).normalize()
}
