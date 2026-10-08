import { Vector3 } from 'three'
import { BALL, GOAL } from '../config/GameConfig'

export interface Capsule {
  kind: 'post' | 'bar' | 'wall' | 'keeper'
  a: Vector3
  b: Vector3
  radius: number
}

const px = GOAL.postX
const pz = GOAL.postZ
const barY = GOAL.barY

export const GOAL_CAPSULES: Capsule[] = [
  { kind: 'post', a: new Vector3(-px, 0, pz), b: new Vector3(-px, barY, pz), radius: GOAL.postRadius },
  { kind: 'post', a: new Vector3(px, 0, pz), b: new Vector3(px, barY, pz), radius: GOAL.postRadius },
  { kind: 'bar', a: new Vector3(-px, barY, pz), b: new Vector3(px, barY, pz), radius: GOAL.postRadius },
]

// Paño de red: rectángulo origin + u·uAxis + v·vAxis, normal n. Es blando y de dos caras.
export interface NetPlane {
  name: string
  origin: Vector3
  normal: Vector3
  uAxis: Vector3
  vAxis: Vector3
  uLen: number
  vLen: number
}

const d = GOAL.depth
const X = new Vector3(1, 0, 0)
const Y = new Vector3(0, 1, 0)
const Z = new Vector3(0, 0, 1)

export const NET_PLANES: NetPlane[] = [
  { name: 'back', origin: new Vector3(-px, 0, -d), normal: Z, uAxis: X, vAxis: Y, uLen: 2 * px, vLen: barY },
  { name: 'left', origin: new Vector3(-px, 0, -d), normal: X, uAxis: Z, vAxis: Y, uLen: d + pz, vLen: barY },
  { name: 'right', origin: new Vector3(px, 0, -d), normal: X, uAxis: Z, vAxis: Y, uLen: d + pz, vLen: barY },
  { name: 'top', origin: new Vector3(-px, barY, -d), normal: Y, uAxis: X, vAxis: Z, uLen: 2 * px, vLen: d + pz },
]

export interface NetContact {
  side: number // 0 = sin contacto; ±1 = lado de la normal desde donde vino la pelota
  penetration: number
  u: number
  v: number
}

const _ab = new Vector3()
const _ap = new Vector3()

export function closestPointOnSegment(p: Vector3, a: Vector3, b: Vector3, out: Vector3): Vector3 {
  _ab.subVectors(b, a)
  const lenSq = _ab.lengthSq()
  if (lenSq < 1e-12) return out.copy(a) // cápsula degenerada = esfera
  const t = Math.max(0, Math.min(1, _ap.subVectors(p, a).dot(_ab) / lenSq))
  return out.copy(a).addScaledVector(_ab, t)
}

export interface ContactBody {
  vel: Vector3
  ang: Vector3
}

const _r = new Vector3()
const _vc = new Vector3()
const _vt = new Vector3()
const _j = new Vector3()
const _tmp = new Vector3()

// Impulso contra una superficie estática con normal n (apuntando hacia la pelota).
// Normal con restitución + fricción de Coulomb en el punto de contacto, así el spin
// cambia el pique y el pique cambia el spin. Devuelve la velocidad de impacto.
export function resolveContact(body: ContactBody, n: Vector3, restitution: number, friction: number): number {
  const m = BALL.mass
  const r = BALL.radius
  const I = BALL.inertia
  _r.copy(n).multiplyScalar(-r)
  _vc.crossVectors(body.ang, _r).add(body.vel)
  const vn = _vc.dot(n)
  if (vn >= 0) return 0

  const jn = -(1 + restitution) * vn * m
  _vt.copy(_vc).addScaledVector(n, -vn)
  body.vel.addScaledVector(n, jn / m)

  const slip = _vt.length()
  if (slip > 1e-6) {
    // impulso que anula el deslizamiento, limitado por Coulomb
    const k = I / (m * r * r)
    const jt = Math.min((slip * m) / (1 + 1 / k), friction * jn)
    _j.copy(_vt).multiplyScalar(-jt / slip)
    body.vel.addScaledVector(_j, 1 / m)
    body.ang.add(_tmp.crossVectors(_r, _j).multiplyScalar(1 / I))
  }
  return -vn
}
