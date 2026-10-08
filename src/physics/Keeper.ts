import type { Vector3 } from 'three'
import { GOAL, KEEPER } from '../config/GameConfig'
import type { PhysicsConfig } from '../config/PhysicsConfig'

// Palo donde espera el arquero: +1 derecho, -1 izquierdo (vista del pateador).
export function keeperSide(ball: Vector3, cfg: PhysicsConfig): number {
  const side = cfg.keeper.side
  if (side === 'LEFT') return -1
  if (side === 'RIGHT') return 1
  return ball.x < -0.5 ? -1 : 1
}

export function keeperPostX(side: number): number {
  return side * (GOAL.width / 2 - KEEPER.postInset)
}

// Mira hacia la pelota desde su posición sobre la línea.
export function keeperFacingYaw(x: number, ball: Vector3): number {
  return Math.atan2(ball.x - x, ball.z - KEEPER.lineOffset)
}
