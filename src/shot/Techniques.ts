import { lerp, smoothstep } from '../physics/math'
import type { Foot, ShotRequest, Technique } from './ShotTypes'

export type FixedTechnique = Exclude<Technique, 'AUTO'>

export interface TechniqueParams {
  powerMultiplier: number
  spinMultiplier: number
  accuracyMultiplier: number
  swing: number // +1 la pasada curva a la izquierda con pie derecho, -1 a la derecha
  launchBiasRad: number
}

export const TECHNIQUES: Record<FixedTechnique, TechniqueParams> = {
  INSTEP: { powerMultiplier: 1.15, spinMultiplier: 0.6, accuracyMultiplier: 0.9, swing: 0, launchBiasRad: 0 },
  CURVE: { powerMultiplier: 0.97, spinMultiplier: 1.35, accuracyMultiplier: 1.1, swing: 1, launchBiasRad: 0.03 },
  TRIVELA: { powerMultiplier: 1.03, spinMultiplier: 1.25, accuracyMultiplier: 0.85, swing: -1, launchBiasRad: 0 },
  KNUCKLE: { powerMultiplier: 1.1, spinMultiplier: 0.1, accuracyMultiplier: 0.8, swing: 0, launchBiasRad: -0.02 },
}

// Sin técnica elegida (AUTO), la superficie del pie se deduce del punto de contacto, como
// lo haría un jugador: centro → empeine, lado del pie hábil → interior, lado contrario →
// exterior (tres dedos). La mezcla es continua para que no haya saltos de velocidad o spin.
const AUTO_BLEND_FROM = 0.15
const AUTO_BLEND_TO = 0.6

function autoWeight(req: Pick<ShotRequest, 'contactPoint' | 'foot'>): { w: number; inside: boolean } {
  const footSign = req.foot === 'RIGHT' ? 1 : -1
  const x = req.contactPoint.x
  return { w: smoothstep(AUTO_BLEND_FROM, AUTO_BLEND_TO, Math.abs(x)), inside: x * footSign > 0 }
}

export function resolveTechnique(req: Pick<ShotRequest, 'technique' | 'contactPoint' | 'foot'>): TechniqueParams {
  if (req.technique !== 'AUTO') return TECHNIQUES[req.technique]
  const { w, inside } = autoWeight(req)
  const a = TECHNIQUES.INSTEP
  const b = inside ? TECHNIQUES.CURVE : TECHNIQUES.TRIVELA
  return {
    powerMultiplier: lerp(a.powerMultiplier, b.powerMultiplier, w),
    spinMultiplier: lerp(a.spinMultiplier, b.spinMultiplier, w),
    accuracyMultiplier: lerp(a.accuracyMultiplier, b.accuracyMultiplier, w),
    swing: lerp(a.swing, b.swing, w),
    launchBiasRad: lerp(a.launchBiasRad, b.launchBiasRad, w),
  }
}

const SURFACE_LABEL: Record<FixedTechnique, string> = {
  INSTEP: 'EMPEINE',
  CURVE: 'INTERIOR',
  TRIVELA: 'EXTERIOR',
  KNUCKLE: 'KNUCKLE',
}

export function techniqueLabel(req: Pick<ShotRequest, 'technique' | 'contactPoint' | 'foot'>): string {
  if (req.technique !== 'AUTO') return SURFACE_LABEL[req.technique]
  const { w, inside } = autoWeight(req)
  if (w < 0.5) return SURFACE_LABEL.INSTEP
  return inside ? SURFACE_LABEL.CURVE : SURFACE_LABEL.TRIVELA
}

// Descripción corta del efecto esperado, para la UI de contacto.
export function describeContact(c: { x: number; y: number }, foot: Foot): string[] {
  const lines: string[] = []
  if (Math.abs(c.x) < 0.12) lines.push('RECTO')
  else lines.push(c.x > 0 ? 'CURVA ←' : 'CURVA →')
  if (c.y < -0.2) lines.push('BACKSPIN · SUBE')
  else if (c.y > 0.2) lines.push('TOPSPIN · CAE')
  const strength = Math.hypot(c.x, c.y)
  if (strength > 0.55) lines.push('MUCHO EFECTO')
  else if (strength > 0.25) lines.push('EFECTO MEDIO')
  lines.unshift(techniqueLabel({ technique: 'AUTO', contactPoint: c, foot }))
  return lines
}
