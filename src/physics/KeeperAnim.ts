import type { Vector3 } from 'three'
import type { PhysicsConfig } from '../config/PhysicsConfig'
import { keeperPostX, keeperSide } from './Keeper'
import type { KeeperPlan } from './KeeperBrain'
import { clamp, smoothstep } from './math'

// Clips por función, no por nombre de Mixamo. "pos" = el arquero se mueve hacia +x del
// mundo (derecha del pateador), "neg" hacia -x. El lado se mide en los clips al cargar.
export type ClipName =
  | 'idle'
  | 'stepPos'
  | 'stepNeg'
  | 'diveMidPos'
  | 'diveMidNeg'
  | 'diveLowPos'
  | 'diveLowNeg'
  | 'catchLow'
  | 'catchMid'
  | 'catchHigh'

// Medidas de cada clip (con la cadera fija en XZ), en metros, arquero mirando a +z.
export interface ClipMeta {
  duration: number
  reachTime: number // cuándo las manos llegan a su punto clave (máxima estirada / atajada)
  hand: { x: number; y: number } // centro de las manos en reachTime, relativo a la raíz
  stepDistance: number // sólo pasos laterales: desplazamiento por ciclo
}

export type ClipMetaTable = Record<ClipName, ClipMeta>

export interface AnimLayer {
  clip: ClipName
  time: number
  weight: number
}

export interface KeeperAnimState {
  x: number // raíz sobre la línea
  lift: number // elevación extra de todo el cuerpo (estiradas/saltos más altos que el clip)
  layers: AnimLayer[]
}

// ventana del clip que se reproduce antes del punto clave: se saltea la preparación lenta
const ACTION_WINDOW_SEC = 0.45
const BLEND_SEC = 0.1

const ramp = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1)
const moveToward = (from: number, to: number, maxDelta: number) => from + clamp(to - from, -maxDelta, maxDelta)
const mod = (a: number, n: number) => ((a % n) + n) % n

export function actionClip(plan: KeeperPlan): ClipName | null {
  const y = plan.perceived?.y ?? 1
  if (plan.action === 'DIVE') {
    if (y < 0.75) return plan.side > 0 ? 'diveLowPos' : 'diveLowNeg'
    return plan.side > 0 ? 'diveMidPos' : 'diveMidNeg'
  }
  if (plan.action === 'BLOCK') return y < 0.75 ? 'catchLow' : y < 1.9 ? 'catchMid' : 'catchHigh'
  return null
}

// Estado de animación en el instante t (s desde que salió la pelota). Puro: la física
// (colliders) y el render lo evalúan igual. idleTime: fase del idle (sólo cosmético).
export function keeperAnimState(
  plan: KeeperPlan | null,
  t: number,
  from: Vector3,
  cfg: PhysicsConfig,
  meta: ClipMetaTable,
  idleTime: number,
): KeeperAnimState {
  const k = cfg.keeper
  const idle = (w: number): AnimLayer => ({ clip: 'idle', time: mod(idleTime, meta.idle.duration), weight: w })
  if (!plan) return { x: keeperPostX(keeperSide(from, cfg)), lift: 0, layers: [idle(1)] }

  const react = k.reactionSec

  // desplazamiento lateral previo (mismo camino que el cerebro)
  let x: number
  let moveTo: number
  let moveEnd: number
  if (plan.action === 'CROSS') {
    const dur = Math.abs(2 * plan.startX) / Math.max(k.speedMps, 0.1)
    x = plan.startX * (1 - 2 * smoothstep(0, 1, (t - react) / dur))
    moveTo = -plan.startX
    moveEnd = react + dur
  } else {
    const moveTime = clamp(t - react, 0, plan.actionStart - react)
    x = moveToward(plan.startX, plan.moveTargetX, k.shuffleSpeedMps * moveTime)
    moveTo = plan.moveTargetX
    moveEnd = Math.min(plan.actionStart, react + Math.abs(plan.moveTargetX - plan.startX) / k.shuffleSpeedMps)
  }

  // pasos laterales mientras se mueve
  const dir = Math.sign(moveTo - plan.startX)
  const stepClip: ClipName = dir > 0 ? 'stepPos' : 'stepNeg'
  const stepMeta = meta[stepClip]
  const naturalSpeed = stepMeta.stepDistance / stepMeta.duration
  const speed = plan.action === 'CROSS' ? k.speedMps : k.shuffleSpeedMps
  const stepRate = clamp(speed / Math.max(naturalSpeed, 0.1), 0.5, 3)
  const stepW = dir === 0 || moveEnd <= react ? 0 : ramp(t, react, react + BLEND_SEC) * (1 - ramp(t, moveEnd, moveEnd + BLEND_SEC))
  const baseLayers: AnimLayer[] = [
    idle(1 - stepW),
    { clip: stepClip, time: mod((t - react) * stepRate, stepMeta.duration), weight: stepW },
  ]

  const clip = actionClip(plan)
  if (!clip || !plan.perceived) return { x, lift: 0, layers: baseLayers }

  // acción: la ventana final del clip se estira/comprime para llegar justo con la pelota
  const m = meta[clip]
  const window = Math.min(m.reachTime, ACTION_WINDOW_SEC)
  const available = Math.max(plan.perceived.t - plan.actionStart, 0.05)
  const rate = clamp(window / available, 0.6, 2.2)
  const tReach = plan.actionStart + window / rate
  const clipTime =
    t <= tReach ? m.reachTime - window + Math.max(0, t - plan.actionStart) * rate : m.reachTime + (t - tReach)
  const actionW = ramp(t, plan.actionStart - BLEND_SEC / 2, plan.actionStart + BLEND_SEC / 2)

  // la raíz va para que las manos queden sobre el objetivo, dentro del alcance permitido
  const xStart = moveToward(plan.startX, plan.moveTargetX, k.shuffleSpeedMps * Math.max(0, plan.actionStart - react))
  const maxShift = plan.action === 'DIVE' ? k.diveMaxShiftM : k.blockReachM
  const handX = m.hand.x * Math.cos(plan.yaw) // el arquero mira a la pelota
  const xGoal = xStart + clamp(plan.perceived.x - handX - xStart, -maxShift, maxShift)
  const reachU = ramp(t, plan.actionStart, tReach)
  const ease = 1 - (1 - reachU) * (1 - reachU)
  const xAction = xStart + (xGoal - xStart) * ease

  // si la pelota va más alta que lo que llega el clip, se eleva el cuerpo (con límite)
  const maxLift = k.maxJumpM + (plan.action === 'DIVE' ? 0.4 : 0)
  const liftGoal = clamp(plan.perceived.y - m.hand.y, 0, maxLift)
  const fall = ramp(t, tReach, tReach + 0.35)
  const lift = liftGoal * ease * (1 - fall * fall)

  const layers = [
    ...baseLayers.map((l) => ({ ...l, weight: l.weight * (1 - actionW) })),
    { clip, time: clamp(clipTime, 0, m.duration), weight: actionW },
  ]
  return { x: x + (xAction - x) * actionW, lift, layers }
}
