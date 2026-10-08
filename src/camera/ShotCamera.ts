import * as THREE from 'three'
import { BALL } from '../config/GameConfig'
import type { PhysicsConfig } from '../config/PhysicsConfig'

const GOAL_CENTER = new THREE.Vector3(0, 0, 0)
const BLEND_SEC = 0.28

// Primer plano para elegir el contacto: la pelota vista desde atrás en la dirección del tiro.
export const CONTACT_VIEW = {
  screenFraction: 0.42, // diámetro de la pelota respecto del lado corto de la pantalla
  height: 0.06, // sobre el centro de la pelota
  fov: 38,
}

// Cámara arcade: detrás y abajo de la pelota mirando al arco. Puede ir al primer plano de la
// pelota (fase de contacto). Después del golpe se queda cerca del punto de tiro y gira para
// seguir la pelota, con un dolly leve.
export class ShotCamera {
  private readonly aimPos = new THREE.Vector3()
  private readonly aimLook = new THREE.Vector3()
  private readonly contactPos = new THREE.Vector3()
  private readonly contactLook = new THREE.Vector3()
  private readonly look = new THREE.Vector3()
  private readonly forward = new THREE.Vector3()
  private readonly tmpPos = new THREE.Vector3()
  private readonly tmpLook = new THREE.Vector3()
  private dollyT = 0
  private blend = 0
  private blendTarget = 0

  // shake y fov kick
  private shakeT = 0
  private shakeDur = 0
  private shakeAmp = 0
  private fovKick = 0

  constructor(
    readonly camera: THREE.PerspectiveCamera,
    private cfg: PhysicsConfig,
  ) {}

  setupAim(ball: THREE.Vector3): void {
    const c = this.cfg.camera
    this.forward.subVectors(GOAL_CENTER, ball).setY(0).normalize()
    this.aimPos.copy(ball).addScaledVector(this.forward, -c.distance)
    this.aimPos.y = c.height
    this.aimLook.set(GOAL_CENTER.x, c.lookAtY, GOAL_CENTER.z)
    this.look.copy(this.aimLook)
    this.dollyT = 0
    this.blend = this.blendTarget = 0
    this.apply()
  }

  // el primer plano mira la pelota desde atrás en la dirección del tiro (yaw)
  setContactView(ball: THREE.Vector3, yaw: number): void {
    const dir = new THREE.Vector3(Math.sin(yaw), 0, -Math.cos(yaw))
    // distancia para que la pelota ocupe la misma fracción del lado corto en cualquier ventana
    const halfFov = THREE.MathUtils.degToRad(CONTACT_VIEW.fov / 2)
    const radiusNdc = CONTACT_VIEW.screenFraction * Math.min(this.camera.aspect, 1)
    const distance = BALL.radius / (Math.tan(halfFov) * radiusNdc)
    this.contactPos.copy(ball).addScaledVector(dir, -distance)
    this.contactPos.y = BALL.radius + CONTACT_VIEW.height
    this.contactLook.copy(ball)
  }

  setContactMode(on: boolean): void {
    this.blendTarget = on ? 1 : 0
  }

  get inContactView(): boolean {
    return this.blend > 0.98
  }

  shake(amp: number, ms: number): void {
    this.shakeAmp = Math.max(this.shakeAmp * (this.shakeT / Math.max(this.shakeDur, 1e-6)), amp)
    this.shakeDur = ms / 1000
    this.shakeT = this.shakeDur
  }

  kickFov(deg: number): void {
    this.fovKick = deg
  }

  updateAim(dt: number): void {
    // avanzar hacia el objetivo sin pasarse (si no, oscila entre dos poses y flickea)
    const step = dt / BLEND_SEC
    const delta = this.blendTarget - this.blend
    this.blend += Math.sign(delta) * Math.min(Math.abs(delta), step)
    this.decayFx(dt)
    this.apply()
  }

  updateFlight(ball: THREE.Vector3, dt: number): void {
    const c = this.cfg.camera
    const k = 1 - Math.exp(-c.followLerp * dt)
    const target = new THREE.Vector3().lerpVectors(this.aimLook, ball, c.followWeight)
    this.look.lerp(target, k)
    this.dollyT = Math.min(1, this.dollyT + dt * 0.8)
    this.blend = this.blendTarget = 0
    this.decayFx(dt)
    this.apply()
  }

  private decayFx(dt: number): void {
    this.shakeT = Math.max(0, this.shakeT - dt)
    this.fovKick *= Math.exp(-dt * 12)
  }

  private apply(): void {
    const c = this.cfg.camera
    const ease = 1 - Math.pow(1 - this.dollyT, 3)
    const b = this.blend * this.blend * (3 - 2 * this.blend)

    this.tmpPos.copy(this.aimPos).addScaledVector(this.forward, c.dolly * ease)
    this.tmpPos.lerp(this.contactPos, b)
    this.tmpLook.copy(this.look).lerp(this.contactLook, b)

    this.camera.position.copy(this.tmpPos)
    if (this.shakeT > 0) {
      const a = this.shakeAmp * (this.shakeT / this.shakeDur)
      this.camera.position.x += (Math.random() - 0.5) * 2 * a
      this.camera.position.y += (Math.random() - 0.5) * 2 * a
    }
    this.camera.lookAt(this.tmpLook)
    const fov = c.fov + (CONTACT_VIEW.fov - c.fov) * b + this.fovKick
    if (Math.abs(this.camera.fov - fov) > 1e-3) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }
}
