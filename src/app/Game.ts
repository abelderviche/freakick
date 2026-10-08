import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type GUI from 'lil-gui'
import { BALL, DEFAULT_PRESET, FIXED_DT, GOAL, POSITION_PRESETS } from '../config/GameConfig'
import { loadConfig, type PhysicsConfig } from '../config/PhysicsConfig'
import { ShotCamera } from '../camera/ShotCamera'
import { createDebugPanel } from '../debug/DebugPanel'
import { clamp, lerp } from '../physics/math'
import { BallSim } from '../physics/BallSim'
import { keeperAnimState } from '../physics/KeeperAnim'
import { keeperPoseAt, planKeeper, type KeeperPlan } from '../physics/KeeperBrain'
import { KeeperColliders } from '../physics/KeeperRig'
import { keeperFacingYaw, keeperPostX, keeperSide } from '../physics/Keeper'
import { computeWallLayout, WallColliders, wallJumpHeight } from '../physics/WallLayout'
import { AimLine } from '../scene/AimLine'
import { BallView } from '../scene/BallView'
import { Boot, BOOT_TUNING } from '../scene/Boot'
import { GrassBurst, Trail } from '../scene/Effects'
import { addLighting, createSky, createStands } from '../scene/Environment'
import { createField } from '../scene/Field'
import { createGoal } from '../scene/Goal'
import type { NetPanel } from '../scene/Net'
import { KeeperView } from '../scene/Keeper'
import { AnimatedKeeperColliders, MixamoKeeper, MixamoKeeperView, type KeeperInstance } from '../scene/MixamoKeeper'
import { WallView } from '../scene/Wall'
import { aimFromTarget } from '../shot/Aim'
import { PowerMeter } from '../shot/PowerMeter'
import { calculateShot } from '../shot/ShotCalculator'
import type { ShotInitialState, ShotOutcome, ShotRequest } from '../shot/ShotTypes'
import { describeContact, techniqueLabel } from '../shot/Techniques'
import { Hud, type ShotPhase, type TelemetryData } from '../ui/Hud'

// AIM → CONTACT → POWER son las tres fases de preparación del tiro.
type State = ShotPhase | 'SWING' | 'HITSTOP' | 'FLIGHT' | 'RESULT'

interface ShotRecord {
  request: ShotRequest
  spot: THREE.Vector3
}

const MODELS = {
  ball: '/models/soccer_ball.glb',
  boot: '/models/boot.glb',
  tribune: '/models/tribune.glb',
}

const TARGET_LIMITS = { x: 11, yMin: 0.1, yMax: 7 }
const CONTACT_MAX = 0.9 // no se puede pegar en el borde exacto de la pelota
const CONTACT_NUDGE = 0.05
const FOLLOW_THROUGH_SEC = 0.22
const BOOT_HIDE_SEC = 0.5

export class Game {
  readonly cfg: PhysicsConfig = loadConfig()
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly camera: THREE.PerspectiveCamera
  private shotCam: ShotCamera
  private sim = new BallSim(this.cfg)
  private ballView = new BallView()
  readonly boot = new Boot()
  private nets: NetPanel[] = []
  private trail = new Trail()
  private burst = new GrassBurst()
  private aimLine = new AimLine()
  private wallColliders = new WallColliders()
  private wallView = new WallView()
  private keeperColliders = new KeeperColliders()
  private keeperView = new KeeperView()
  private keeperPlan: KeeperPlan | null = null
  // arquero animado con clips de Mixamo (si cargó); si no, el de bloques procedural
  private mixamo: MixamoKeeper | null = null
  private mixView: MixamoKeeperView | null = null
  private mixPhysics: KeeperInstance | null = null
  private mixColliders: AnimatedKeeperColliders | null = null
  private idleAtKick = 0
  private hud: Hud
  private gui: GUI | null = null
  private power = new PowerMeter(this.cfg)

  private state: State = 'AIM'
  private spot = new THREE.Vector3()
  private target = new THREE.Vector3(0, 1.2, 0)
  private contact = { x: 0, y: 0 }
  private ballScreen = { x: 0, y: 0, r: 1 }

  private request: ShotRequest | null = null
  private initial: ShotInitialState | null = null
  private swingFrom = 0
  private swingT = 0
  private swingDur = 0.1
  private hitstopLeft = 0
  private followT = 0
  private acc = 0
  private shotNo = 0
  private last: ShotRecord | null = null

  private outcome: ShotOutcome | null = null
  private woodwork: 'post' | 'bar' | null = null
  private woodworkTime = 0
  private wallHit = false
  private wallTime = 0
  private keeperHit = false
  private keeperTime = 0
  private resultTimer = 0
  private telemetry: TelemetryData | null = null
  private launchRight = new THREE.Vector3()

  private raycaster = new THREE.Raycaster()
  private aimPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
  private renderPos = new THREE.Vector3()
  private renderQuat = new THREE.Quaternion()
  private lastFrame = 0

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(this.cfg.camera.fov, window.innerWidth / window.innerHeight, 0.05, 2000)
    this.shotCam = new ShotCamera(this.camera, this.cfg)
    this.hud = new Hud(container)
    this.aimLine.setResolution(window.innerWidth, window.innerHeight)

    this.scene.fog = new THREE.Fog(0xbfe3ff, 150, 700)
    addLighting(this.scene)
    this.scene.add(createSky())
    this.scene.add(createField(this.renderer.capabilities.getMaxAnisotropy()))
    const goal = createGoal()
    this.nets = goal.nets
    this.scene.add(goal.group)
    this.scene.add(
      this.ballView.root,
      this.ballView.shadow,
      this.boot.root,
      this.trail.group,
      this.burst.points,
      this.aimLine.line,
      this.wallView.group,
      this.keeperView.group,
    )
    this.sim.updateObstacles = (t) => {
      this.wallColliders.setJump(wallJumpHeight(t, this.cfg))
      if (this.cfg.keeper.enabled) this.poseKeeperPhysics(t)
    }

    const preset = POSITION_PRESETS.find((p) => p.name === DEFAULT_PRESET)!
    this.spot.set(preset.x, BALL.radius, preset.z)
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader()
    const [, , stands, mixamo] = await Promise.all([
      this.ballView.load(loader, MODELS.ball),
      this.boot.load(loader, MODELS.boot),
      createStands(loader, MODELS.tribune),
      MixamoKeeper.load(loader).catch((err) => {
        console.warn('arquero animado no disponible, se usa el de bloques', err)
        return null
      }),
    ])
    this.scene.add(stands)
    if (mixamo) {
      this.mixamo = mixamo
      this.mixView = new MixamoKeeperView(mixamo.createInstance())
      this.scene.add(this.mixView.group)
      // segunda copia, invisible, que la física posa en cada step para leer los huesos
      this.mixPhysics = mixamo.createInstance()
      this.mixColliders = new AnimatedKeeperColliders(this.mixPhysics)
    }
  }

  start(): void {
    this.gui = createDebugPanel(this.cfg, {
      onPosition: (name) => this.setPosition(name),
      onRepeat: () => this.repeat(),
      onBootChanged: () => {
        this.boot.applyTuning()
        this.boot.place(this.spot, this.aimYaw())
        if (this.state === 'AIM') this.boot.setAngle(BOOT_TUNING.restAngleDeg)
      },
      onCameraChanged: () => {
        if (this.state === 'AIM') this.shotCam.setupAim(this.spot)
      },
      onOutline: (s) => this.ballView.setOutlineThickness(s),
      onObstaclesChanged: () => {
        if (this.state === 'AIM' || this.state === 'CONTACT' || this.state === 'POWER') this.layoutObstacles()
      },
    })
    this.bindInput()
    this.updateContactInfo()
    this.reset()
    this.lastFrame = performance.now()
    this.renderer.setAnimationLoop(() => this.frame())
  }

  // ───────────────────────── input

  private bindInput(): void {
    const canvas = this.renderer.domElement
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(window.innerWidth, window.innerHeight)
      this.aimLine.setResolution(window.innerWidth, window.innerHeight)
    })
    window.addEventListener('pointermove', (e) => {
      if (this.state === 'AIM') this.aimAt(e.clientX, e.clientY)
      else if (this.state === 'CONTACT') this.contactAt(e.clientX, e.clientY)
    })
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) this.press()
      else if (e.button === 2) this.back()
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) this.release()
    })
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).closest?.('.lil-gui')) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!e.repeat) this.press()
        return
      }
      if (this.state === 'CONTACT' && e.code.startsWith('Arrow')) {
        e.preventDefault()
        const dx = e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0
        const dy = e.code === 'ArrowUp' ? 1 : e.code === 'ArrowDown' ? -1 : 0
        this.setContact(this.contact.x + dx * CONTACT_NUDGE, this.contact.y + dy * CONTACT_NUDGE)
        return
      }
      if (e.repeat) return
      switch (e.code) {
        case 'Escape':
          this.back()
          break
        case 'Enter':
          this.press()
          break
        case 'KeyR':
          this.reset()
          break
        case 'KeyP':
          this.repeat()
          break
        case 'KeyT':
          this.trail.setVisible(!this.trail.enabled)
          break
        case 'KeyB':
          this.cfg.wall.enabled = !this.cfg.wall.enabled
          this.gui?.controllersRecursive().forEach((c) => c.updateDisplay())
          this.reset()
          break
        case 'KeyK':
          this.cfg.keeper.enabled = !this.cfg.keeper.enabled
          this.gui?.controllersRecursive().forEach((c) => c.updateDisplay())
          this.reset()
          break
        case 'KeyG':
          if (this.gui?._hidden) this.gui.show().open()
          else this.gui?.hide()
          break
        case 'KeyI':
          this.hud.toggleTelemetry()
          break
      }
    })
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') this.release()
    })
  }

  private aimAt(clientX: number, clientY: number): void {
    const ndc = new THREE.Vector2((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.aimPlane, hit)) return
    this.target.set(
      clamp(hit.x, -TARGET_LIMITS.x, TARGET_LIMITS.x),
      clamp(hit.y, TARGET_LIMITS.yMin, TARGET_LIMITS.yMax),
      0,
    )
  }

  private contactAt(clientX: number, clientY: number): void {
    const { x, y, r } = this.ballScreen
    this.setContact((clientX - x) / r, -(clientY - y) / r)
  }

  private setContact(x: number, y: number): void {
    const len = Math.hypot(x, y)
    const k = len > CONTACT_MAX ? CONTACT_MAX / len : 1
    this.contact.x = x * k
    this.contact.y = y * k
    this.updateContactInfo()
  }

  private updateContactInfo(): void {
    this.hud.setContactInfo(this.contact, describeContact(this.contact, 'RIGHT'))
  }

  private press(): void {
    switch (this.state) {
      case 'AIM':
        this.enterPhase('CONTACT')
        break
      case 'CONTACT':
        this.enterPhase('POWER')
        break
      case 'POWER':
        if (!this.power.charging) this.power.start()
        break
      case 'FLIGHT':
      case 'RESULT':
        this.reset()
        break
    }
  }

  private release(): void {
    if (this.state !== 'POWER' || !this.power.charging) return
    this.kick(this.power.stop())
  }

  private back(): void {
    if (this.state === 'CONTACT') this.enterPhase('AIM')
    else if (this.state === 'POWER' && !this.power.charging) this.enterPhase('CONTACT')
  }

  private enterPhase(phase: ShotPhase): void {
    this.state = phase
    this.power.reset()
    this.hud.setPower(0, this.cfg.power.overchargeMax)
    this.hud.setPhase(phase)
    if (phase === 'CONTACT') this.shotCam.setContactView(this.spot, this.aimYaw())
    this.shotCam.setContactMode(phase === 'CONTACT')
    this.aimLine.visible = phase !== 'CONTACT'
  }

  // ───────────────────────── shot flow

  private aimYaw(): number {
    return aimFromTarget(this.spot, this.target, this.cfg).yaw
  }

  private kick(power: number): void {
    const request: ShotRequest = {
      aim: aimFromTarget(this.spot, this.target, this.cfg),
      contactPoint: { ...this.contact },
      technique: 'AUTO',
      foot: 'RIGHT',
      power,
      seed: (Math.random() * 2 ** 31) | 0,
    }
    this.startSwing(request)
  }

  private repeat(): void {
    if (!this.last) return
    this.spot.copy(this.last.spot)
    this.reset()
    const p = clamp(this.last.request.power, 0, 1)
    this.boot.setAngle(lerp(BOOT_TUNING.restAngleDeg, BOOT_TUNING.backswingDeg, p))
    this.startSwing(this.last.request)
  }

  private startSwing(request: ShotRequest): void {
    this.request = request
    this.initial = calculateShot(request, this.cfg)
    this.boot.root.visible = this.boot.loaded
    this.boot.place(this.spot, request.aim.yaw, request.contactPoint)
    this.swingFrom = this.boot.angleDeg
    this.swingT = 0
    this.swingDur = (this.cfg.feel.swingMs / 1000) * lerp(1.3, 0.75, clamp(request.power, 0, 1))
    this.state = 'SWING'
    this.hud.setPhase(null)
    this.shotCam.setContactMode(false)
  }

  private strike(): void {
    const req = this.request!
    const init = this.initial!
    const p = clamp(req.power, 0, 1)
    const f = this.cfg.feel
    this.hitstopLeft = lerp(f.hitstopMinMs, f.hitstopMaxMs, p) / 1000
    const dir = init.linearVelocity.clone().normalize()
    this.ballView.squash(dir, f.squash * (0.4 + 0.6 * p))
    this.shotCam.shake(f.shakeAmp * (0.4 + 0.6 * p), f.shakeMs)
    this.shotCam.kickFov(f.fovKickDeg * p)
    if (f.grassParticles) {
      this.burst.emit(this.spot, dir.clone().setY(0).normalize(), 0.6 + 1.2 * p)
    }
    this.aimLine.visible = false
    this.state = 'HITSTOP'
  }

  private launch(): void {
    const req = this.request!
    const init = this.initial!
    this.ballView.releaseSquash()
    this.idleAtKick = performance.now() / 1000
    this.keeperPlan = this.cfg.keeper.enabled
      ? planKeeper(this.spot, init.linearVelocity, init.angularVelocity, req.seed, this.cfg)
      : null
    this.sim.launch(init.linearVelocity, init.angularVelocity)
    this.state = 'FLIGHT'
    this.acc = 0
    this.followT = 0
    this.shotNo++
    this.last = { request: req, spot: this.spot.clone() }
    this.outcome = null
    this.woodwork = null
    this.wallHit = false
    this.keeperHit = false
    this.trail.start()
    this.trail.add(this.sim.pos, init.linearVelocity.length(), 0)
    const flat = init.linearVelocity.clone().setY(0).normalize()
    this.launchRight.set(-flat.z, 0, flat.x)
    this.telemetry = {
      shot: this.shotNo,
      technique: techniqueLabel(req),
      foot: req.foot === 'RIGHT' ? 'R' : 'L',
      power: req.power,
      contact: req.contactPoint,
      launchKmh: init.linearVelocity.length() * 3.6,
      launchAngleDeg: init.launchAngleDeg,
      spinRps: init.angularVelocity.length() / (2 * Math.PI),
      lineKmh: null,
      flightTime: null,
      distance: Math.hypot(this.spot.x, this.spot.z),
      maxHeight: 0,
      curve: 0,
      liveKmh: init.linearVelocity.length() * 3.6,
      keeper: this.keeperPlan?.label ?? '—',
      result: '…',
    }
  }

  private finish(outcome: ShotOutcome): void {
    if (this.outcome) return
    this.outcome = outcome
    this.state = 'RESULT'
    const f = this.cfg.feel
    this.resultTimer = f.autoResetDelaySec + (outcome === 'GOAL' ? 0.6 : 0)
    const t = this.telemetry!
    let sub = t.lineKmh !== null ? `${Math.round(t.lineKmh)} KM/H` : ''
    if (outcome === 'GOAL' && this.woodwork) sub = this.woodwork === 'post' ? 'OFF THE POST!' : 'OFF THE BAR!'
    else if (outcome === 'GOAL' && this.keeperHit) sub = 'OFF THE KEEPER!'
    else if (outcome === 'GOAL' && this.wallHit) sub = 'DEFLECTED!'
    this.hud.showResult(outcome, sub)
    const via = this.woodwork ?? (this.keeperHit ? 'keeper' : this.wallHit ? 'wall' : null)
    t.result = outcome + (outcome === 'GOAL' && via ? ` (off ${via})` : '')
    if (outcome === 'GOAL') this.shotCam.shake(f.shakeAmp * 0.5, 200)
  }

  private processEvents(): void {
    const t = this.telemetry!
    for (const e of this.sim.events) {
      switch (e.type) {
        case 'post':
        case 'bar':
          if (!this.woodwork) {
            this.woodwork = e.type
            this.woodworkTime = this.sim.time
          }
          this.shotCam.shake(this.cfg.feel.shakeAmp * 0.6, 160)
          break
        case 'keeper':
          if (!this.keeperHit) {
            this.keeperHit = true
            this.keeperTime = this.sim.time
          }
          this.shotCam.shake(this.cfg.feel.shakeAmp * 0.5, 140)
          break
        case 'wall':
          if (!this.wallHit) {
            this.wallHit = true
            this.wallTime = this.sim.time
          }
          this.shotCam.shake(this.cfg.feel.shakeAmp * 0.4, 120)
          break
        case 'goal':
          t.lineKmh = e.speed * 3.6
          t.flightTime = e.time
          this.finish('GOAL')
          break
        case 'out': {
          t.lineKmh = e.speed * 3.6
          t.flightTime = e.time
          this.finish(this.missOutcome() ?? (Math.abs(e.point.x) >= GOAL.width / 2 ? 'WIDE' : 'OVER'))
          break
        }
      }
    }
    this.sim.events.length = 0

    // curva: desvío lateral máximo respecto de la dirección de salida, hasta la línea
    if (!this.sim.crossedLine) {
      const lateral = new THREE.Vector3().subVectors(this.sim.pos, this.spot).dot(this.launchRight)
      if (Math.abs(lateral) > Math.abs(t.curve)) t.curve = lateral
    }

    if (this.state !== 'FLIGHT') return
    const time = this.sim.time
    const settled =
      (this.woodwork && time - this.woodworkTime > 1.2) ||
      (this.wallHit && time - this.wallTime > 1.5) ||
      (this.keeperHit && time - this.keeperTime > 1.2) ||
      this.sim.sleeping ||
      time > 7
    if (settled) this.finish(this.missOutcome() ?? 'SHORT')
  }

  // si no fue gol: lo que se interpuso, por importancia (arquero > palo > barrera)
  private missOutcome(): ShotOutcome | null {
    if (this.keeperHit) return 'SAVED'
    if (this.woodwork) return this.woodwork === 'post' ? 'POST' : 'BAR'
    return this.wallHit ? 'WALL' : null
  }

  // barrera y arquero según la posición del tiro (cada uno se puede apagar)
  private layoutObstacles(): void {
    const layout = this.cfg.wall.enabled ? computeWallLayout(this.spot, this.cfg) : null
    this.wallColliders.setLayout(layout)
    this.wallView.setLayout(layout)
    this.wallColliders.setJump(0)
    this.wallView.setJump(0)

    const keeperOn = this.cfg.keeper.enabled
    const animated = this.useAnimatedKeeper()
    this.keeperPlan = null
    this.keeperColliders.setEnabled(keeperOn && !animated)
    this.keeperView.visible = keeperOn && !animated
    if (this.mixView) this.mixView.visible = keeperOn && animated
    const keeperCapsules = !keeperOn ? [] : animated ? this.mixColliders!.capsules : this.keeperColliders.capsules
    if (keeperOn) {
      this.poseKeeperPhysics(0)
      this.poseKeeperView(0, performance.now() / 1000)
    }

    this.sim.obstacles = [...this.wallColliders.capsules, ...keeperCapsules]
  }

  private useAnimatedKeeper(): boolean {
    return this.cfg.keeper.body === 'MIXAMO' && this.mixamo !== null
  }

  // pose del arquero para la física en el instante t del vuelo
  private poseKeeperPhysics(t: number): void {
    if (this.useAnimatedKeeper()) {
      const state = keeperAnimState(this.keeperPlan, t, this.spot, this.cfg, this.mixamo!.meta, this.idleAtKick + t)
      this.mixPhysics!.apply(state, this.keeperYaw())
      this.mixColliders!.update()
    } else {
      this.keeperColliders.setPose(keeperPoseAt(this.keeperPlan, t, this.spot, this.cfg), this.keeperYaw())
    }
  }

  private poseKeeperView(t: number, idleTime: number): void {
    if (this.useAnimatedKeeper()) {
      const state = keeperAnimState(this.keeperPlan, t, this.spot, this.cfg, this.mixamo!.meta, idleTime)
      this.mixView!.apply(state, this.keeperYaw())
    } else {
      this.keeperView.setPose(keeperPoseAt(this.keeperPlan, t, this.spot, this.cfg), this.keeperYaw())
    }
  }

  private keeperYaw(): number {
    return this.keeperPlan?.yaw ?? keeperFacingYaw(keeperPostX(keeperSide(this.spot, this.cfg)), this.spot)
  }

  private setPosition(name: string): void {
    const p = POSITION_PRESETS.find((q) => q.name === name)
    if (!p) return
    this.spot.set(p.x, BALL.radius, p.z)
    this.reset()
  }

  // Vuelve a apuntar desde la misma posición. Conserva mira y punto de contacto.
  private reset(): void {
    this.outcome = null
    this.woodwork = null
    this.wallHit = false
    this.keeperHit = false
    this.sim.reset(this.spot)
    this.layoutObstacles()
    this.ballView.resetSquash()
    for (const n of this.nets) n.reset()
    this.boot.root.visible = this.boot.loaded
    this.boot.place(this.spot, this.aimYaw())
    this.boot.setAngle(BOOT_TUNING.restAngleDeg)
    this.shotCam.setupAim(this.spot)
    this.hud.clearResult()
    this.acc = 0
    this.enterPhase('AIM')
  }

  // ───────────────────────── loop

  private frame(): void {
    const now = performance.now()
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000)
    this.lastFrame = now

    this.hud.update(dt)
    this.burst.update(dt)

    switch (this.state) {
      case 'AIM':
      case 'CONTACT':
      case 'POWER': {
        if (this.power.charging && this.power.update()) {
          this.kick(this.power.stop())
          break
        }
        const p = clamp(this.power.value, 0, 1)
        this.boot.root.visible = this.boot.loaded && this.state !== 'CONTACT'
        this.boot.place(this.spot, this.aimYaw(), this.contact)
        this.boot.setAngle(lerp(BOOT_TUNING.restAngleDeg, BOOT_TUNING.backswingDeg, p))
        this.hud.setPower(this.power.value, this.cfg.power.overchargeMax)
        this.shotCam.updateAim(dt)
        break
      }
      case 'SWING': {
        this.swingT += dt
        const u = Math.min(1, this.swingT / this.swingDur)
        this.boot.setAngle(lerp(this.swingFrom, 0, u * u))
        if (u >= 1) this.strike()
        this.shotCam.updateAim(dt)
        break
      }
      case 'HITSTOP': {
        this.hitstopLeft -= dt
        if (this.hitstopLeft <= 0) this.launch()
        this.shotCam.updateAim(dt)
        break
      }
      case 'FLIGHT':
      case 'RESULT':
        this.stepFlight(dt)
        break
    }

    this.renderFrame(dt)
  }

  private stepFlight(dt: number): void {
    this.acc += dt
    let steps = 0
    while (this.acc >= FIXED_DT && steps < 40) {
      this.sim.step(FIXED_DT)
      this.acc -= FIXED_DT
      steps++
      if (this.telemetry) this.processEvents()
    }

    const alpha = this.acc / FIXED_DT
    this.renderPos.lerpVectors(this.sim.prevPos, this.sim.pos, alpha)
    this.renderQuat.slerpQuaternions(this.sim.prevQuat, this.sim.quat, alpha)

    if (this.trail.enabled) this.trail.add(this.sim.pos, this.sim.vel.length(), this.sim.time)

    // follow-through del botín y desaparece
    this.followT += dt
    const u = Math.min(1, this.followT / FOLLOW_THROUGH_SEC)
    this.boot.setAngle(lerp(0, BOOT_TUNING.followDeg, 1 - (1 - u) * (1 - u)))
    if (this.followT > BOOT_HIDE_SEC) this.boot.root.visible = false

    if (this.telemetry) {
      this.telemetry.liveKmh = this.sim.vel.length() * 3.6
      this.telemetry.maxHeight = this.sim.maxHeight
    }

    this.shotCam.updateFlight(this.renderPos, dt)

    if (this.state === 'RESULT' && this.cfg.feel.autoReset) {
      this.resultTimer -= dt
      if (this.resultTimer <= 0) this.reset()
    }
  }

  private renderFrame(dt: number): void {
    const flying = this.state === 'FLIGHT' || this.state === 'RESULT'
    if (flying) this.ballView.update(this.renderPos, this.renderQuat, dt)
    else this.ballView.update(this.sim.pos, this.sim.quat, dt)
    this.wallView.setJump(flying ? wallJumpHeight(this.sim.time, this.cfg) : 0)
    if (this.cfg.keeper.enabled) {
      // la animación se muestra a pocos cuadros (retro); la física usa el tiempo continuo
      const fps = this.cfg.keeper.animFps
      const t = flying ? this.sim.time : 0
      const shown = fps > 0 ? Math.floor(t * fps) / fps : t
      const wallIdle = fps > 0 ? Math.floor((performance.now() / 1000) * fps) / fps : performance.now() / 1000
      this.poseKeeperView(shown, flying ? this.idleAtKick + shown : wallIdle)
    }

    for (let i = 0; i < this.nets.length; i++) this.nets[i].update(this.sim.netContacts[i], dt)

    if (this.aimLine.line.visible) this.aimLine.update(this.spot, this.target)

    if (this.state === 'CONTACT') {
      this.camera.updateMatrixWorld()
      const w = window.innerWidth
      const h = window.innerHeight
      const center = this.spot.clone().project(this.camera)
      const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0)
      const edge = this.spot.clone().addScaledVector(right, BALL.radius).project(this.camera)
      const sx = ((center.x + 1) / 2) * w
      const sy = ((1 - center.y) / 2) * h
      const r = Math.max(1, Math.abs(((edge.x - center.x) / 2) * w))
      this.ballScreen = { x: sx, y: sy, r }
      this.hud.setContactGuide(sx, sy, r)
      this.hud.setContactReticle(sx + this.contact.x * r, sy - this.contact.y * r)
    }

    this.hud.setTelemetry(this.telemetry)
    this.renderer.render(this.scene, this.camera)
  }
}
