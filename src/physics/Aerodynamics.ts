import { Vector3 } from 'three'
import { BALL } from '../config/GameConfig'
import type { PhysicsConfig } from '../config/PhysicsConfig'
import { lerp, smoothstep } from './math'

const _t = new Vector3()

// Crisis de arrastre: Cd bajo a alta velocidad, alto a baja. La transición hace que un
// tiro fuerte "se caiga" cuando pierde velocidad.
export function dragCoefficient(speed: number, cfg: PhysicsConfig): number {
  const { cdSubcritical, cdSupercritical, criticalSpeedMps, transitionWidthMps } = cfg.drag
  const t = smoothstep(criticalSpeedMps - transitionWidthMps, criticalSpeedMps + transitionWidthMps, speed)
  return lerp(cdSubcritical, cdSupercritical, t)
}

export function addDrag(vel: Vector3, cfg: PhysicsConfig, out: Vector3): Vector3 {
  const speed = vel.length()
  if (speed < 1e-6) return out
  const magnitude = 0.5 * cfg.world.airDensity * dragCoefficient(speed, cfg) * BALL.area * speed * speed
  return out.addScaledVector(vel, -magnitude / speed)
}

// Fm = Cm · (ω × v). Sin normalizar: con ω = 0 o ω ∥ v la fuerza es 0, nunca NaN.
export function addMagnus(ang: Vector3, vel: Vector3, cfg: PhysicsConfig, out: Vector3): Vector3 {
  _t.crossVectors(ang, vel)
  return out.addScaledVector(_t, cfg.magnus.coefficient)
}
