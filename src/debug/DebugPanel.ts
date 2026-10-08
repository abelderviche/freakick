import GUI from 'lil-gui'
import { DEFAULT_PRESET, POSITION_PRESETS } from '../config/GameConfig'
import { cloneConfig, DEFAULT_CONFIG, mergeInto, saveConfig, type PhysicsConfig } from '../config/PhysicsConfig'
import { BOOT_TUNING } from '../scene/Boot'

export interface PanelActions {
  onPosition(name: string): void
  onRepeat(): void
  onBootChanged(): void
  onCameraChanged(): void
  onOutline(scale: number): void
  onObstaclesChanged(): void
}

export function createDebugPanel(cfg: PhysicsConfig, actions: PanelActions): GUI {
  const gui = new GUI({ title: 'PHYSICS LAB  [G]' })
  let saveTimer = 0
  const save = () => {
    clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => saveConfig(cfg), 250)
  }
  gui.onChange(save)

  const shot = { position: DEFAULT_PRESET, repeat: () => actions.onRepeat() }
  const fShot = gui.addFolder('Shot')
  fShot
    .add(shot, 'position', POSITION_PRESETS.map((p) => p.name))
    .name('ball position')
    .onChange((v: string) => actions.onPosition(v))
  fShot.add(shot, 'repeat').name('repeat last shot [P]')

  const wall = gui.addFolder('Wall [B]')
  const onWall = () => actions.onObstaclesChanged()
  wall.add(cfg.wall, 'enabled').onChange(onWall)
  wall.add(cfg.wall, 'autoCount').name('auto count').onChange(onWall)
  wall.add(cfg.wall, 'count', 1, 7, 1).onChange(onWall)
  wall.add(cfg.wall, 'distance', 5, 15, 0.05).name('distance m').onChange(onWall)
  wall.add(cfg.wall, 'jump')
  wall.add(cfg.wall, 'jumpHeight', 0, 1, 0.01).name('jump height m')
  wall.add(cfg.wall, 'jumpDelaySec', 0, 0.5, 0.01).name('jump delay s')
  wall.add(cfg.wall, 'jumpDurationSec', 0.2, 1.5, 0.01).name('jump duration s')
  wall.add(cfg.wall, 'restitution', 0, 1, 0.01)
  wall.add(cfg.wall, 'friction', 0, 1, 0.01)
  wall.close()

  const keeper = gui.addFolder('Keeper [K]')
  keeper.add(cfg.keeper, 'enabled').onChange(onWall)
  keeper.add(cfg.keeper, 'body', ['MIXAMO', 'BLOCKS']).onChange(onWall)
  keeper.add(cfg.keeper, 'mode', ['PREDICT', 'CROSS'])
  keeper.add(cfg.keeper, 'side', ['AUTO', 'LEFT', 'RIGHT']).name('start post').onChange(onWall)
  keeper.add(cfg.keeper, 'reactionSec', 0, 1, 0.01).name('reaction s')
  keeper.add(cfg.keeper, 'readErrorM', 0, 2, 0.01).name('read error m')
  keeper.add(cfg.keeper, 'readErrorPerRps', 0, 0.5, 0.005).name('error per rev/s')
  keeper.add(cfg.keeper, 'shuffleSpeedMps', 0, 10, 0.1).name('shuffle m/s')
  keeper.add(cfg.keeper, 'diveTimeSec', 0.15, 1.2, 0.01).name('dive time s')
  keeper.add(cfg.keeper, 'diveMaxShiftM', 0, 3, 0.05).name('dive reach m')
  keeper.add(cfg.keeper, 'maxJumpM', 0, 1.2, 0.01).name('max jump m')
  keeper.add(cfg.keeper, 'blockReachM', 0, 1.5, 0.01).name('block reach m')
  keeper.add(cfg.keeper, 'speedMps', 0.5, 12, 0.1).name('cross speed m/s')
  keeper.add(cfg.keeper, 'animFps', 0, 60, 1).name('anim fps (0=smooth)')
  keeper.add(cfg.keeper, 'restitution', 0, 1, 0.01)
  keeper.add(cfg.keeper, 'friction', 0, 1, 0.01)
  keeper.close()

  const world = gui.addFolder('World')
  world.add(cfg.world, 'gravity', 0, 20, 0.01)
  world.add(cfg.world, 'airDensity', 0, 3, 0.005)

  const drag = gui.addFolder('Drag (crisis)')
  drag.add(cfg.drag, 'cdSubcritical', 0, 1, 0.005).name('Cd slow')
  drag.add(cfg.drag, 'cdSupercritical', 0, 1, 0.005).name('Cd fast')
  drag.add(cfg.drag, 'criticalSpeedMps', 0, 40, 0.1).name('critical m/s')
  drag.add(cfg.drag, 'transitionWidthMps', 0.1, 15, 0.1).name('transition m/s')

  const magnus = gui.addFolder('Magnus / Spin')
  magnus.add(cfg.magnus, 'coefficient', 0, 0.01, 0.0001)
  magnus.add(cfg.spin, 'decayPerSec', 0, 1, 0.005).name('spin decay /s')
  magnus.close()

  const power = gui.addFolder('Power')
  power.add(cfg.power, 'minSpeedMps', 0, 30, 0.1).name('min m/s')
  power.add(cfg.power, 'speedRangeMps', 0, 40, 0.1).name('range m/s')
  power.add(cfg.power, 'curveExp', 0.3, 3, 0.01).name('curve exp')
  power.add(cfg.power, 'chargeTimeSec', 0.2, 3, 0.05).name('charge time s')
  power.add(cfg.power, 'chargeEaseExp', 0.5, 3, 0.05).name('charge ease')
  power.add(cfg.power, 'overchargeMax', 1, 1.5, 0.01).name('overcharge max')

  const aim = gui.addFolder('Aim')
  aim.add(cfg.aim, 'referenceSpeedMps', 5, 40, 0.1).name('reference m/s')
  aim.add(cfg.aim, 'gravityCompensation', 0, 1, 0.01).name('gravity comp')
  aim.close()

  const ground = gui.addFolder('Ground')
  ground.add(cfg.ground, 'restitution', 0, 1, 0.01)
  ground.add(cfg.ground, 'friction', 0, 1.5, 0.01)
  ground.add(cfg.ground, 'rollingResistance', 0, 0.5, 0.005).name('rolling resist')
  ground.add(cfg.ground, 'settleSpeedMps', 0, 3, 0.05).name('settle m/s')
  ground.add(cfg.ground, 'spinFriction', 0, 10, 0.1).name('spin friction')
  ground.close()

  const posts = gui.addFolder('Posts / Net')
  posts.add(cfg.posts, 'restitution', 0, 1, 0.01).name('post restitution')
  posts.add(cfg.posts, 'friction', 0, 1, 0.01).name('post friction')
  posts.add(cfg.net, 'stiffness', 0, 2000, 1).name('net stiffness')
  posts.add(cfg.net, 'damping', 0, 100, 0.5).name('net damping')
  posts.add(cfg.net, 'friction', 0, 30, 0.5).name('net friction')
  posts.close()

  const feel = gui.addFolder('Feel')
  feel.add(cfg.feel, 'hitstopMinMs', 0, 200, 1).name('hitstop min ms')
  feel.add(cfg.feel, 'hitstopMaxMs', 0, 200, 1).name('hitstop max ms')
  feel.add(cfg.feel, 'swingMs', 20, 400, 1).name('swing ms')
  feel.add(cfg.feel, 'shakeAmp', 0, 0.2, 0.001).name('shake amp')
  feel.add(cfg.feel, 'shakeMs', 0, 600, 5).name('shake ms')
  feel.add(cfg.feel, 'fovKickDeg', 0, 15, 0.1).name('fov kick °')
  feel.add(cfg.feel, 'squash', 0, 0.6, 0.01)
  feel.add(cfg.feel, 'grassParticles').name('grass particles')
  feel.add(cfg.feel, 'autoReset').name('auto reset')
  feel.add(cfg.feel, 'autoResetDelaySec', 0, 5, 0.1).name('auto reset delay')
  feel.close()

  const cam = gui.addFolder('Camera')
  for (const [key, min, max, step] of [
    ['distance', 1, 15, 0.1],
    ['height', 0.3, 8, 0.05],
    ['lookAtY', -2, 4, 0.05],
    ['fov', 20, 90, 1],
    ['followLerp', 0, 20, 0.1],
    ['followWeight', 0, 1, 0.01],
    ['dolly', 0, 10, 0.1],
  ] as const) {
    cam.add(cfg.camera, key, min, max, step).onChange(() => actions.onCameraChanged())
  }
  cam.close()

  const render = { outline: 1 }
  const fRender = gui.addFolder('Render')
  fRender.add(render, 'outline', 0.9, 1.1, 0.001).name('ball outline').onChange((v: number) => actions.onOutline(v))
  fRender.close()

  const boot = gui.addFolder('Boot (debug)')
  for (const key of Object.keys(BOOT_TUNING) as (keyof typeof BOOT_TUNING)[]) {
    const isAngle = key.startsWith('rot') || key.endsWith('Deg')
    boot
      .add(BOOT_TUNING, key, isAngle ? -180 : -1, isAngle ? 180 : 2, isAngle ? 1 : 0.005)
      .onChange(() => actions.onBootChanged())
  }
  boot.close()

  const io = {
    export: () => {
      const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = 'freekick-config.json'
      a.click()
      URL.revokeObjectURL(a.href)
    },
    import: () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        try {
          mergeInto(cfg, JSON.parse(await file.text()))
          gui.controllersRecursive().forEach((c) => c.updateDisplay())
          saveConfig(cfg)
        } catch (err) {
          console.error('config inválida', err)
        }
      }
      input.click()
    },
    reset: () => {
      mergeInto(cfg, cloneConfig(DEFAULT_CONFIG))
      gui.controllersRecursive().forEach((c) => c.updateDisplay())
      saveConfig(cfg)
      actions.onCameraChanged()
    },
  }
  const fIo = gui.addFolder('Config')
  fIo.add(io, 'export').name('export JSON')
  fIo.add(io, 'import').name('import JSON')
  fIo.add(io, 'reset').name('reset to default')

  gui.hide()
  return gui
}
