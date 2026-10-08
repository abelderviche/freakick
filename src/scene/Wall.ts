import * as THREE from 'three'
import { WALL_PLAYER } from '../config/GameConfig'
import type { WallLayout } from '../physics/WallLayout'
import { blobShadow, box, head } from './LowPoly'

// Jugadores low-poly procedurales, colores planos. El collider (cápsula) vive en WallLayout;
// acá sólo se dibuja con las mismas medidas.
const SHIRT = 0xd8262f
const SHORTS = 0xf2f2f2
const SOCKS = 0xd8262f
const BOOTS = 0x1a1a1a
const HAIR = [0x2a1a10, 0x111111, 0x5a3a1a, 0xc8a050]
const SKIN = [0xe0b090, 0xc68c64, 0x8d5a3a, 0xf0c8a8]

function createPlayer(i: number): THREE.Group {
  const g = new THREE.Group()
  const skin = SKIN[i % SKIN.length]
  const H = WALL_PLAYER.height
  // de abajo hacia arriba; el frente del jugador es +Z
  for (const side of [-1, 1]) {
    g.add(box(0.13, 0.08, 0.24, BOOTS, side * 0.1, 0.04, 0.03))
    g.add(box(0.12, 0.4, 0.14, SOCKS, side * 0.1, 0.28))
    g.add(box(0.13, 0.36, 0.15, skin, side * 0.1, 0.66))
  }
  g.add(box(0.38, 0.22, 0.22, SHORTS, 0, 0.93))
  g.add(box(0.46, 0.56, 0.25, SHIRT, 0, 1.31))
  for (const side of [-1, 1]) {
    // brazos cubriéndose adelante, como en una barrera real
    const arm = box(0.1, 0.46, 0.11, SHIRT, side * 0.2, 1.26, 0.1)
    arm.rotation.z = side * 0.35
    g.add(arm)
    g.add(box(0.1, 0.1, 0.1, skin, side * 0.07, 1.0, 0.17))
  }
  g.add(box(0.12, 0.08, 0.12, skin, 0, 1.62))
  g.add(head(0.11, skin, H - 0.12))
  const hair = box(0.2, 0.06, 0.2, HAIR[(i * 3) % HAIR.length], 0, H - 0.04, -0.01)
  g.add(hair)
  return g
}

export class WallView {
  readonly group = new THREE.Group()
  private players: THREE.Group[] = []
  private shadows: THREE.Mesh[] = []

  setLayout(layout: WallLayout | null): void {
    for (const o of [...this.players, ...this.shadows]) this.group.remove(o)
    this.players = []
    this.shadows = []
    if (!layout) return
    layout.players.forEach((p, i) => {
      const player = createPlayer(i)
      player.position.copy(p)
      player.rotation.y = layout.facingYaw
      this.group.add(player)
      this.players.push(player)

      const shadow = blobShadow(0.28)
      shadow.position.set(p.x, 0.012, p.z)
      shadow.scale.set(1, 1, 0.7)
      shadow.rotation.y = layout.facingYaw
      this.group.add(shadow)
      this.shadows.push(shadow)
    })
  }

  setJump(height: number): void {
    for (const p of this.players) p.position.y = height
    const k = 1 - height * 0.8
    for (const s of this.shadows) s.scale.set(k, 1, 0.7 * k)
  }
}
