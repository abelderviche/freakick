import { Vector3 } from 'three'
import { BALL, FIXED_DT, GOAL, KEEPER } from '../config/GameConfig'
import type { PhysicsConfig } from '../config/PhysicsConfig'
import { BallSim } from './BallSim'
import { keeperFacingYaw, keeperPostX, keeperSide } from './Keeper'
import { DIVE_ARM_Z, DIVE_REACH, lerpPose, readyPose, RIG, type KeeperPose } from './KeeperRig'
import { clamp, smoothstep } from './math'
import { gaussian, mulberry32 } from './Random'

export type KeeperAction = 'READY' | 'CROSS' | 'WATCH' | 'BLOCK' | 'DIVE'

// Decisión tomada al patear. Todo lo que pasa después es función pura de (plan, t), así
// la física y el render evalúan exactamente la misma pose y "repetir tiro" es idéntico.
export interface KeeperPlan {
  action: KeeperAction
  label: string
  side: number // DIVE: +1 hacia +x (derecha del pateador), -1 hacia -x; 0 si no se tira
  startX: number
  yaw: number
  moveTargetX: number // hacia dónde se desplaza antes de actuar
  actionStart: number // s desde que sale la pelota
  actionDur: number
  endPose: KeeperPose
  perceived: { x: number; y: number; t: number } | null
}

export interface Crossing {
  x: number
  y: number
  t: number
}

// Predice dónde cruza la pelota el plano del arquero corriendo la sim sin obstáculos:
// el arquero "lee" el tiro limpio (no sabe si la barrera la va a desviar).
export function predictCrossing(from: Vector3, v: Vector3, w: Vector3, cfg: PhysicsConfig): Crossing | null {
  const sim = new BallSim(cfg)
  sim.reset(from)
  sim.launch(v, w)
  const plane = KEEPER.lineOffset
  for (let i = 0; i < 4 / FIXED_DT && !sim.sleeping; i++) {
    sim.step(FIXED_DT)
    sim.events.length = 0
    if (sim.pos.z <= plane) {
      const u = (sim.prevPos.z - plane) / (sim.prevPos.z - sim.pos.z)
      const p = new Vector3().lerpVectors(sim.prevPos, sim.pos, u)
      return { x: p.x, y: p.y, t: sim.time - FIXED_DT * (1 - u) }
    }
  }
  return null
}

const moveToward = (from: number, to: number, maxDelta: number) =>
  from + clamp(to - from, -maxDelta, maxDelta)

// Pose de estirada para que las manos lleguen a (x, y): el cuerpo apunta al objetivo,
// más vertical cuanto más alta va la pelota.
function divePose(x: number, y: number, side: number, takeoffX: number, cfg: PhysicsConfig): KeeperPose {
  const k = cfg.keeper
  const phi = 0.55 + (1.45 - 0.55) * (1 - smoothstep(0.35, 2.1, y)) // ángulo desde la vertical
  const maxPelvisY = RIG.standingPelvisY + k.maxJumpM
  let pelvisX = x - side * Math.sin(phi) * DIVE_REACH
  const pelvisY = clamp(y - Math.cos(phi) * DIVE_REACH, 0.25, maxPelvisY)
  // alcance limitado desde el punto de despegue
  pelvisX = takeoffX + clamp(pelvisX - takeoffX, -k.diveMaxShiftM, k.diveMaxShiftM)
  return {
    x: pelvisX,
    pelvisY,
    roll: -side * phi,
    // brazos sobre la cabeza con las manos juntas (si se abren, la pelota pasa entre los guantes)
    armL: { x: 0, z: -DIVE_ARM_Z },
    armR: { x: 0, z: DIVE_ARM_Z },
    legL: -0.25,
    legR: 0.25,
  }
}

// Atajada de frente: brazos al frente a la altura de la pelota; salta o se agacha.
function blockPose(x: number, y: number, cfg: PhysicsConfig): KeeperPose {
  const reachTop = RIG.standingPelvisY + RIG.shoulder.y + RIG.armLength
  const reachBottom = RIG.standingPelvisY + RIG.shoulder.y - RIG.armLength
  let pelvisY = RIG.standingPelvisY
  if (y > reachTop) pelvisY += Math.min(cfg.keeper.maxJumpM, y - reachTop)
  else if (y < reachBottom) pelvisY -= Math.min(0.45, reachBottom - y)
  const shoulderY = pelvisY + RIG.shoulder.y
  const a = -Math.acos(clamp((shoulderY - y) / RIG.armLength, -1, 1))
  return { x, pelvisY, roll: 0, armL: { x: a, z: -0.15 }, armR: { x: a, z: 0.15 }, legL: -0.2, legR: 0.2 }
}

export function planKeeper(
  from: Vector3,
  v: Vector3,
  w: Vector3,
  seed: number,
  cfg: PhysicsConfig,
): KeeperPlan {
  const k = cfg.keeper
  const startX = keeperPostX(keeperSide(from, cfg))
  const yaw = keeperFacingYaw(startX, from)
  const base = {
    side: 0,
    startX,
    yaw,
    moveTargetX: startX,
    actionStart: Infinity,
    actionDur: 0,
    endPose: readyPose(startX),
    perceived: null,
  }

  if (k.mode === 'CROSS') return { ...base, action: 'CROSS', label: 'CROSS' }

  const c = predictCrossing(from, v, w, cfg)
  if (!c) return { ...base, action: 'WATCH', label: 'SHORT' }

  // error de lectura: crece con el spin (la curva engaña)
  const rand = mulberry32(seed ^ 0x9e3779b9)
  const spinRps = w.length() / (2 * Math.PI)
  const sd = k.readErrorM + k.readErrorPerRps * spinRps
  const px = c.x + gaussian(rand) * sd
  const py = Math.max(BALL.radius, c.y + gaussian(rand) * sd * 0.5)
  const perceived = { x: px, y: py, t: c.t }
  const postX = GOAL.width / 2

  // va afuera: la deja pasar, se acomoda hacia ese palo
  if (Math.abs(px) > postX + 0.25 || py > GOAL.height + 0.3) {
    const tx = clamp(px, -postX + 0.4, postX - 0.4)
    return { ...base, action: 'WATCH', label: 'LEFT IT', moveTargetX: tx, perceived }
  }

  const react = k.reactionSec
  const shuffle = k.shuffleSpeedMps
  const d = px - startX

  if (Math.abs(d) <= k.blockReachM + shuffle * Math.max(0, c.t - react - k.blockTimeSec)) {
    // le llega caminando: se acomoda y la ataja de frente
    const actionStart = Math.max(react, c.t - k.blockTimeSec)
    const xAtAction = moveToward(startX, px, shuffle * Math.max(0, actionStart - react))
    const height = py > 2.0 ? 'HIGH' : py < 0.6 ? 'LOW' : 'MID'
    return {
      ...base,
      action: 'BLOCK',
      label: `BLOCK ${height}`,
      moveTargetX: px,
      actionStart,
      actionDur: Math.max(0.05, c.t - actionStart),
      endPose: blockPose(moveToward(xAtAction, px, k.blockReachM), py, cfg),
      perceived,
    }
  }

  // estirada: se desplaza hacia un punto de despegue y se tira para llegar justo
  const side = Math.sign(d)
  const actionStart = Math.max(react, c.t - k.diveTimeSec)
  const ideal = divePose(px, py, side, px, cfg)
  const takeoffTarget = ideal.x - side * k.diveMaxShiftM * 0.55
  const takeoffX = moveToward(startX, takeoffTarget, shuffle * Math.max(0, actionStart - react))
  const endPose = divePose(px, py, side, takeoffX, cfg)
  const late = c.t - actionStart < k.diveTimeSec * 0.8
  const short = Math.abs(endPose.x - ideal.x) > 0.05
  const height = py > 1.6 ? 'HIGH' : py < 0.6 ? 'LOW' : 'MID'
  return {
    ...base,
    side,
    action: 'DIVE',
    label: `DIVE ${side > 0 ? 'R' : 'L'} ${height}${short ? ' (short)' : late ? ' (late)' : ''}`,
    moveTargetX: takeoffTarget,
    actionStart,
    actionDur: k.diveTimeSec,
    endPose,
    perceived,
  }
}

// Pose en el instante t (segundos desde que salió la pelota). plan = null → en guardia.
export function keeperPoseAt(plan: KeeperPlan | null, t: number, from: Vector3, cfg: PhysicsConfig): KeeperPose {
  if (!plan) return readyPose(keeperPostX(keeperSide(from, cfg)))
  const k = cfg.keeper
  const react = k.reactionSec

  if (plan.action === 'CROSS') {
    // comportamiento original: cruza al palo contrario
    if (t <= react) return readyPose(plan.startX)
    const dur = Math.abs(2 * plan.startX) / Math.max(k.speedMps, 0.1)
    return readyPose(plan.startX * (1 - 2 * smoothstep(0, 1, (t - react) / dur)))
  }

  // desplazamiento lateral (con un pequeño rebote de pasos)
  const moveTime = clamp(t - react, 0, plan.actionStart - react)
  const x = moveToward(plan.startX, plan.moveTargetX, k.shuffleSpeedMps * moveTime)
  const moving = t > react && t < plan.actionStart && Math.abs(x - plan.moveTargetX) > 1e-3
  const shuffling = readyPose(x)
  if (moving) {
    const phase = (t - react) * 9
    shuffling.pelvisY -= 0.04 * Math.abs(Math.sin(phase))
    shuffling.legL = -0.12 - 0.18 * Math.max(0, Math.sin(phase))
    shuffling.legR = 0.12 + 0.18 * Math.max(0, -Math.sin(phase))
  }
  if (t < plan.actionStart) return shuffling

  const u = (t - plan.actionStart) / plan.actionDur
  if (u <= 1) {
    const e = 1 - (1 - u) * (1 - u) // arranca explosivo, frena al estirarse
    return lerpPose(readyPose(x), plan.endPose, e)
  }

  if (plan.action !== 'DIVE') return plan.endPose
  // después de la estirada cae al piso
  const fall = Math.min(1, (t - plan.actionStart - plan.actionDur) / 0.35)
  const roll = clamp(plan.endPose.roll + Math.sign(plan.endPose.roll) * 0.2, -Math.PI / 2, Math.PI / 2)
  const landed = { ...plan.endPose, pelvisY: 0.25, roll }
  return lerpPose(plan.endPose, landed, fall * fall)
}
