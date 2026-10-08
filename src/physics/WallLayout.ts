import { Vector3 } from 'three'
import { autoWallCount, WALL_PLAYER } from '../config/GameConfig'
import type { PhysicsConfig } from '../config/PhysicsConfig'
import { clamp } from './math'
import type { Capsule } from './Collisions'

export interface WallLayout {
  players: Vector3[] // posición de cada jugador en el piso
  facingYaw: number // rotación Y para que miren a la pelota
}

// La barrera se para a `distance` de la pelota, sobre la línea pelota → arco, corrida hacia
// el palo más cercano (como la arma un arquero que cubre ese palo con la barrera).
export function computeWallLayout(ball: Vector3, cfg: PhysicsConfig): WallLayout {
  const w = cfg.wall
  const aimX = clamp(ball.x * 0.35, -1.8, 1.8)
  const dir = new Vector3(aimX - ball.x, 0, -ball.z).normalize()
  const perp = new Vector3(-dir.z, 0, dir.x)
  const center = new Vector3(ball.x, 0, ball.z).addScaledVector(dir, w.distance)
  const count = w.autoCount ? autoWallCount(Math.hypot(ball.x, ball.z)) : Math.round(clamp(w.count, 1, 7))

  const players: Vector3[] = []
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * WALL_PLAYER.spacing
    players.push(center.clone().addScaledVector(perp, offset))
  }
  return { players, facingYaw: Math.atan2(-dir.x, -dir.z) }
}

// Altura del salto en función del tiempo de vuelo de la pelota (t = 0 al salir del pie).
export function wallJumpHeight(t: number, cfg: PhysicsConfig): number {
  const w = cfg.wall
  if (!w.jump || t < w.jumpDelaySec) return 0
  const u = (t - w.jumpDelaySec) / w.jumpDurationSec
  return u >= 1 ? 0 : w.jumpHeight * Math.sin(Math.PI * u)
}

// Colliders de la barrera: una cápsula vertical por jugador, de los pies a la cabeza.
export class WallColliders {
  readonly capsules: Capsule[] = []
  private base: Vector3[] = []

  setLayout(layout: WallLayout | null): void {
    this.capsules.length = 0
    this.base = layout ? layout.players.map((p) => p.clone()) : []
    const r = WALL_PLAYER.radius
    for (const p of this.base) {
      this.capsules.push({
        kind: 'wall',
        a: new Vector3(p.x, r, p.z),
        b: new Vector3(p.x, WALL_PLAYER.height - r, p.z),
        radius: r,
      })
    }
  }

  setJump(height: number): void {
    const r = WALL_PLAYER.radius
    this.capsules.forEach((c, i) => {
      c.a.y = r + height
      c.b.y = WALL_PLAYER.height - r + height
      c.a.x = c.b.x = this.base[i].x
      c.a.z = c.b.z = this.base[i].z
    })
  }
}
