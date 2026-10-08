import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Pie flotante: un péndulo desde una "cadera" invisible detrás de la pelota.
// θ = 0 → pierna vertical, botín justo detrás de la pelota. θ < 0 atrás (carga), θ > 0 adelante.
export const BOOT_TUNING = {
  legLength: 0.85,
  behind: 0.13, // distancia del centro del botín al centro de la pelota en θ = 0
  sideOffset: 0.0,
  heightOffset: 0.12, // altura del centro del botín en θ = 0
  contactShift: 0.09, // cuánto se corre el botín hacia el punto de contacto elegido
  scale: 0.65, // el modelo mide ~0.46 m de punta a talón
  // empeine: cordones hacia la pelota, suela hacia atrás, punta abajo hacia la pelota
  rotX: -40,
  rotY: 180,
  rotZ: 0,
  restAngleDeg: -18,
  backswingDeg: -80,
  followDeg: 75,
}

export class Boot {
  readonly root = new THREE.Group() // marco del tiro: -Z = adelante
  private leg = new THREE.Group() // rota alrededor de la cadera
  private holder = new THREE.Group() // orientación base del modelo
  private model: THREE.Object3D | null = null
  angleDeg = BOOT_TUNING.restAngleDeg

  constructor() {
    this.root.add(this.leg)
    this.leg.add(this.holder)
    this.root.visible = false
  }

  async load(loader: GLTFLoader, url: string): Promise<void> {
    const gltf = await loader.loadAsync(url)
    const model = gltf.scene
    const box = new THREE.Box3().setFromObject(model)
    const center = box.getCenter(new THREE.Vector3())
    model.position.sub(center)
    this.model = model
    this.holder.add(model)
    this.applyTuning()
  }

  applyTuning(): void {
    const t = BOOT_TUNING
    this.holder.rotation.set(
      THREE.MathUtils.degToRad(t.rotX),
      THREE.MathUtils.degToRad(t.rotY),
      THREE.MathUtils.degToRad(t.rotZ),
    )
    this.holder.scale.setScalar(t.scale)
    this.holder.position.set(0, -t.legLength, 0)
  }

  // Coloca la cadera según la posición de la pelota, la dirección del tiro y el punto de
  // contacto (x: derecha, y: arriba, en -1..1).
  place(ball: THREE.Vector3, yaw: number, contact = { x: 0, y: 0 }): void {
    const t = BOOT_TUNING
    this.root.position.set(ball.x, t.legLength + t.heightOffset + contact.y * t.contactShift, ball.z)
    this.root.rotation.set(0, -yaw, 0)
    this.leg.position.set(t.sideOffset + contact.x * t.contactShift, 0, t.behind)
    this.setAngle(this.angleDeg)
  }

  setAngle(deg: number): void {
    this.angleDeg = deg
    this.leg.rotation.x = THREE.MathUtils.degToRad(deg)
  }

  get loaded(): boolean {
    return this.model !== null
  }
}
