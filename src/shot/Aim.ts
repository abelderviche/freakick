import type { Vector3 } from 'three'
import type { PhysicsConfig } from '../config/PhysicsConfig'

// La retícula es intención: el yaw apunta exacto, el pitch se compensa por gravedad para
// la velocidad de referencia. Más potencia → la pelota pasa más alta; menos → más baja.
export function aimFromTarget(ball: Vector3, target: Vector3, cfg: PhysicsConfig): { yaw: number; pitch: number } {
  const dx = target.x - ball.x
  const dz = target.z - ball.z
  const h = target.y - ball.y
  const D = Math.hypot(dx, dz)
  const yaw = Math.atan2(dx, -dz)

  const straight = Math.atan2(h, D)
  const v = cfg.aim.referenceSpeedMps
  const g = cfg.world.gravity
  const disc = v ** 4 - g * (g * D * D + 2 * h * v * v)
  const ballistic = disc >= 0 ? Math.atan((v * v - Math.sqrt(disc)) / (g * D)) : Math.PI / 4
  const pitch = straight + (ballistic - straight) * cfg.aim.gravityCompensation

  return { yaw, pitch }
}
