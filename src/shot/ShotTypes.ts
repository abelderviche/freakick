import type { Vector3 } from 'three'

// AUTO: la superficie del pie se deduce del punto de contacto (hasta que haya selector)
export type Technique = 'AUTO' | 'INSTEP' | 'CURVE' | 'TRIVELA' | 'KNUCKLE'
export type Foot = 'LEFT' | 'RIGHT'

export interface ShotRequest {
  aim: { yaw: number; pitch: number } // radianes, intención
  contactPoint: { x: number; y: number } // -1..1
  technique: Technique
  foot: Foot
  power: number // 0..overchargeMax
  seed: number
}

export interface ShotInitialState {
  linearVelocity: Vector3
  angularVelocity: Vector3
  launchAngleDeg: number
  efficiency: number
}

export type ShotOutcome = 'GOAL' | 'SAVED' | 'POST' | 'BAR' | 'WALL' | 'WIDE' | 'OVER' | 'SHORT'

export interface ShotResult {
  outcome: ShotOutcome
  offWoodwork: boolean
  lineSpeedMps: number | null
  lineTime: number | null
  linePoint: Vector3 | null
  maxHeight: number
}
