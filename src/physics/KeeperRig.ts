import { Object3D, Vector3 } from 'three'
import { KEEPER } from '../config/GameConfig'
import type { Capsule } from './Collisions'

// Esqueleto mínimo del arquero. Lo usan la física (colliders) y el render (meshes colgados
// de las mismas articulaciones), así lo que se ve es exactamente lo que ataja.
//
// root   (x sobre la línea, z = lineOffset; sin rotación)
//  └ pelvis   (altura + roll: inclinación lateral para la estirada)
//     └ facing   (yaw: el pecho mira a la pelota; rota alrededor del eje del cuerpo)
//        ├ neck, head
//        ├ shoulderL/R → handL/R
//        └ hipL/R → footL/R
export const RIG = {
  neckY: 0.62,
  headY: 0.82,
  shoulder: { x: 0.24, y: 0.5 },
  armLength: 0.62,
  hip: { x: 0.12, y: -0.02 },
  legLength: 0.9,
  standingPelvisY: 0.93,
  torsoRadius: 0.2,
  headRadius: 0.13,
  armRadius: 0.08,
  handRadius: 0.11,
  legRadius: 0.1,
}

// brazos sobre la cabeza levemente cruzados hacia adentro: las manos quedan juntas
export const DIVE_ARM_Z = Math.PI + Math.asin(RIG.shoulder.x / RIG.armLength)
// distancia pelvis → centro de las manos en esa pose
export const DIVE_REACH = RIG.shoulder.y + RIG.armLength * Math.cos(DIVE_ARM_Z - Math.PI)

export interface ArmPose {
  x: number // hacia adelante (negativo = brazo al frente)
  z: number // abrir al costado / subir (signo según el lado)
}

export interface KeeperPose {
  x: number // posición lateral de la pelvis sobre la línea
  pelvisY: number
  roll: number // inclinación lateral (negativo = cae hacia +x)
  armL: ArmPose
  armR: ArmPose
  legL: number
  legR: number
}

export function readyPose(x: number): KeeperPose {
  return {
    x,
    pelvisY: RIG.standingPelvisY,
    roll: 0,
    armL: { x: -0.35, z: -0.45 },
    armR: { x: -0.35, z: 0.45 },
    legL: -0.12,
    legR: 0.12,
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export function lerpPose(a: KeeperPose, b: KeeperPose, t: number): KeeperPose {
  return {
    x: lerp(a.x, b.x, t),
    pelvisY: lerp(a.pelvisY, b.pelvisY, t),
    roll: lerp(a.roll, b.roll, t),
    armL: { x: lerp(a.armL.x, b.armL.x, t), z: lerp(a.armL.z, b.armL.z, t) },
    armR: { x: lerp(a.armR.x, b.armR.x, t), z: lerp(a.armR.z, b.armR.z, t) },
    legL: lerp(a.legL, b.legL, t),
    legR: lerp(a.legR, b.legR, t),
  }
}

export class KeeperRig {
  readonly root = new Object3D()
  readonly pelvis = new Object3D()
  readonly facing = new Object3D()
  readonly neck = new Object3D()
  readonly head = new Object3D()
  readonly shoulderL = new Object3D()
  readonly shoulderR = new Object3D()
  readonly handL = new Object3D()
  readonly handR = new Object3D()
  readonly hipL = new Object3D()
  readonly hipR = new Object3D()
  readonly footL = new Object3D()
  readonly footR = new Object3D()

  constructor() {
    this.root.position.z = KEEPER.lineOffset
    this.root.add(this.pelvis)
    this.pelvis.add(this.facing)
    this.facing.add(this.neck, this.head, this.shoulderL, this.shoulderR, this.hipL, this.hipR)
    this.neck.position.y = RIG.neckY
    this.head.position.y = RIG.headY
    this.shoulderL.position.set(-RIG.shoulder.x, RIG.shoulder.y, 0)
    this.shoulderR.position.set(RIG.shoulder.x, RIG.shoulder.y, 0)
    this.shoulderL.add(this.handL)
    this.shoulderR.add(this.handR)
    this.handL.position.y = -RIG.armLength
    this.handR.position.y = -RIG.armLength
    this.hipL.position.set(-RIG.hip.x, RIG.hip.y, 0)
    this.hipR.position.set(RIG.hip.x, RIG.hip.y, 0)
    this.hipL.add(this.footL)
    this.hipR.add(this.footR)
    this.footL.position.y = -RIG.legLength
    this.footR.position.y = -RIG.legLength
  }

  apply(pose: KeeperPose, yaw: number): void {
    this.root.position.x = pose.x
    this.pelvis.position.y = pose.pelvisY
    this.pelvis.rotation.z = pose.roll
    this.facing.rotation.y = yaw
    this.shoulderL.rotation.set(pose.armL.x, 0, pose.armL.z)
    this.shoulderR.rotation.set(pose.armR.x, 0, pose.armR.z)
    this.hipL.rotation.z = pose.legL
    this.hipR.rotation.z = pose.legR
    this.root.updateMatrixWorld(true)
  }
}

const SEGMENTS: [keyof KeeperRig, keyof KeeperRig, number][] = [
  ['pelvis', 'neck', RIG.torsoRadius],
  ['head', 'head', RIG.headRadius],
  ['shoulderL', 'handL', RIG.armRadius],
  ['shoulderR', 'handR', RIG.armRadius],
  ['handL', 'handL', RIG.handRadius],
  ['handR', 'handR', RIG.handRadius],
  ['hipL', 'footL', RIG.legRadius],
  ['hipR', 'footR', RIG.legRadius],
]

// Colliders del arquero: cápsulas entre articulaciones del rig.
export class KeeperColliders {
  readonly capsules: Capsule[] = []
  private rig = new KeeperRig()

  setEnabled(enabled: boolean): void {
    this.capsules.length = 0
    if (!enabled) return
    for (const [, , radius] of SEGMENTS) {
      this.capsules.push({ kind: 'keeper', a: new Vector3(), b: new Vector3(), radius })
    }
  }

  setPose(pose: KeeperPose, yaw: number): void {
    if (this.capsules.length === 0) return
    this.rig.apply(pose, yaw)
    SEGMENTS.forEach(([from, to], i) => {
      ;(this.rig[from] as Object3D).getWorldPosition(this.capsules[i].a)
      ;(this.rig[to] as Object3D).getWorldPosition(this.capsules[i].b)
    })
  }
}
