import { Vector3 } from 'three'
import type { PhysicsConfig } from '../config/PhysicsConfig'
import { clamp } from '../physics/math'
import type { ShotInitialState, ShotRequest } from './ShotTypes'
import { resolveTechnique } from './Techniques'

export function speedFromPower(power: number, cfg: PhysicsConfig): number {
  const p = clamp(power, 0, cfg.power.overchargeMax)
  return cfg.power.minSpeedMps + Math.pow(p, cfg.power.curveExp) * cfg.power.speedRangeMps
}

// yaw = 0 mira hacia -Z (al arco), positivo hacia +X
export function directionFrom(yaw: number, pitch: number, out = new Vector3()): Vector3 {
  return out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
}

// Strike model. Función pura: mismo request → mismo estado inicial.
export function calculateShot(req: ShotRequest, cfg: PhysicsConfig): ShotInitialState {
  const tech = resolveTechnique(req)
  const s = cfg.strike
  const c = req.contactPoint
  const footSign = req.foot === 'RIGHT' ? 1 : -1

  // pegarle descentrado transfiere menos velocidad (y más spin)
  const offCenter = Math.hypot(c.x, c.y)
  const efficiency = 1 - s.offCenterLoss * offCenter * offCenter
  const speed = speedFromPower(req.power, cfg) * tech.powerMultiplier * efficiency

  // abajo levanta, arriba baja; de costado empuja al lado opuesto
  const pitch = req.aim.pitch + -c.y * s.launchFromContactRad + tech.launchBiasRad
  const yaw = req.aim.yaw + -c.x * s.yawFromContactRad

  const forward = new Vector3(Math.sin(req.aim.yaw), 0, -Math.cos(req.aim.yaw))
  const up = new Vector3(0, 1, 0)
  const right = new Vector3().crossVectors(forward, up)

  const k = speed / s.referenceSpeedMps
  const sideSpin = c.x * s.sideSpinFromContact + tech.swing * footSign * s.sideSpinFromSwing
  const backSpin = -c.y * s.backSpinFromContact

  const angularVelocity = new Vector3()
    .addScaledVector(up, sideSpin)
    .addScaledVector(right, backSpin)
    .multiplyScalar(tech.spinMultiplier * k)

  return {
    linearVelocity: directionFrom(yaw, pitch).multiplyScalar(speed),
    angularVelocity,
    launchAngleDeg: (pitch * 180) / Math.PI,
    efficiency,
  }
}
