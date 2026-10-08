import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BALL } from '../config/GameConfig'

const Z = new THREE.Vector3(0, 0, 1)

// root (posición) > squash (orientado al golpe, escala no uniforme) > spin (rotación de la sim) > modelo
export class BallView {
  readonly root = new THREE.Group()
  private squashGroup = new THREE.Group()
  private spinGroup = new THREE.Group()
  private outline: THREE.Object3D | null = null
  private squashAmount = 0
  private squashHold = false
  private readonly squashQuat = new THREE.Quaternion()
  private readonly invSquash = new THREE.Quaternion()
  readonly shadow: THREE.Mesh

  constructor() {
    this.root.add(this.squashGroup)
    this.squashGroup.add(this.spinGroup)
    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(BALL.radius * 1.15, 24).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false, color: 0x000000 }),
    )
    this.shadow.renderOrder = 1
  }

  async load(loader: GLTFLoader, url: string): Promise<void> {
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene
    model.updateMatrixWorld(true)
    let ballMesh: THREE.Object3D | null = null
    model.traverse((o) => {
      if (o.name.includes('soccer_ball')) ballMesh = o
      if (o.name.includes('outline')) this.outline = o
    })
    // medir el radio real de la esfera (sin outline) y escalar a 0.11 m
    const box = new THREE.Box3().setFromObject(ballMesh ?? model)
    const size = box.getSize(new THREE.Vector3())
    const radius = (size.x + size.y + size.z) / 6
    const center = box.getCenter(new THREE.Vector3())
    const holder = new THREE.Group()
    holder.add(model)
    model.position.sub(center)
    holder.scale.setScalar(BALL.radius / radius)
    this.spinGroup.add(holder)
  }

  setOutlineThickness(scale: number): void {
    if (!this.outline) return
    // el hull viene ~5% más grande; escalarlo relativo al original
    this.outline.scale.setScalar(scale)
  }

  squash(direction: THREE.Vector3, amount: number): void {
    this.squashQuat.setFromUnitVectors(Z, direction.clone().normalize())
    this.squashAmount = amount
    this.squashHold = true
  }

  releaseSquash(): void {
    this.squashHold = false
  }

  resetSquash(): void {
    this.squashAmount = 0
    this.squashHold = false
  }

  update(position: THREE.Vector3, rotation: THREE.Quaternion, dt: number): void {
    this.root.position.copy(position)
    if (!this.squashHold) this.squashAmount *= Math.exp(-dt * 28)
    const s = this.squashAmount
    if (s > 1e-3) {
      this.squashGroup.quaternion.copy(this.squashQuat)
      this.squashGroup.scale.set(1 + s * 0.5, 1 + s * 0.5, 1 - s)
      this.invSquash.copy(this.squashQuat).invert()
      this.spinGroup.quaternion.copy(this.invSquash).multiply(rotation)
    } else {
      this.squashGroup.quaternion.identity()
      this.squashGroup.scale.set(1, 1, 1)
      this.spinGroup.quaternion.copy(rotation)
    }

    // sombra blob: más chica y tenue cuanto más alta está la pelota
    const h = Math.max(0, position.y - BALL.radius)
    this.shadow.position.set(position.x, 0.01, position.z)
    this.shadow.scale.setScalar(1 + h * 0.12)
    ;(this.shadow.material as THREE.MeshBasicMaterial).opacity = 0.6 / (1 + h * 0.35)
  }
}

function blobTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.7)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const t = new THREE.CanvasTexture(c)
  // la textura actúa como alpha: el color negro viene del material
  t.colorSpace = THREE.SRGBColorSpace
  return t
}
