import * as THREE from 'three'
import { RIG, KeeperRig, type KeeperPose } from '../physics/KeeperRig'
import { blobShadow, box, head } from './LowPoly'

const SHIRT = 0x9be22d // verde flúo noventoso
const SHIRT_DARK = 0x3d7a12
const SHORTS = 0x161616
const SOCKS = 0x9be22d
const BOOTS = 0x1a1a1a
const GLOVES = 0xf4f4f4
const SKIN = 0xd9a47e
const HAIR = 0x2a1a10

// Arquero low-poly colgado del mismo rig que usan sus colliders.
export class KeeperView {
  readonly group = new THREE.Group()
  private rig = new KeeperRig()
  private shadow = blobShadow(0.38, 0.35)

  constructor() {
    const r = this.rig
    // el rig es Object3D puro: se le cuelgan meshes como a cualquier grupo
    r.facing.add(box(0.42, 0.24, 0.24, SHORTS, 0, 0))
    r.facing.add(box(0.5, 0.5, 0.27, SHIRT, 0, 0.37))
    r.facing.add(box(0.5, 0.07, 0.28, SHIRT_DARK, 0, 0.22))
    r.neck.add(box(0.13, 0.12, 0.13, SKIN, 0, 0.05))
    r.head.add(head(0.115, SKIN, 0))
    r.head.add(box(0.21, 0.06, 0.21, HAIR, 0, 0.09, -0.01))
    for (const [shoulder, hand] of [
      [r.shoulderL, r.handL],
      [r.shoulderR, r.handR],
    ]) {
      shoulder.add(box(0.11, RIG.armLength, 0.11, SHIRT, 0, -RIG.armLength / 2))
      hand.add(box(0.15, 0.17, 0.09, GLOVES, 0, 0))
    }
    for (const [hip, foot] of [
      [r.hipL, r.footL],
      [r.hipR, r.footR],
    ]) {
      hip.add(box(0.14, 0.4, 0.16, SKIN, 0, -0.2))
      hip.add(box(0.13, 0.46, 0.15, SOCKS, 0, -0.65))
      foot.add(box(0.14, 0.08, 0.26, BOOTS, 0, 0.04, 0.03))
    }
    this.group.add(r.root, this.shadow)
  }

  set visible(v: boolean) {
    this.group.visible = v
  }

  setPose(pose: KeeperPose, yaw: number): void {
    this.rig.apply(pose, yaw)
    const p = this.rig.pelvis.getWorldPosition(new THREE.Vector3())
    this.shadow.position.set(p.x, 0.012, p.z)
    const h = Math.max(0, p.y - RIG.standingPelvisY)
    this.shadow.scale.setScalar(1 / (1 + h))
  }
}
