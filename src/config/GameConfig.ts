// Constantes del mundo. Todo en SI.
// Coordenadas: origen en el centro de la línea de gol, +X derecha (vista del pateador),
// +Y arriba, +Z hacia el pateador. Se patea hacia -Z.

export const FIXED_DT = 1 / 240

export const BALL = {
  radius: 0.11,
  mass: 0.43,
  get area() {
    return Math.PI * this.radius * this.radius
  },
  get inertia() {
    // cáscara esférica hueca
    return (2 / 3) * this.mass * this.radius * this.radius
  },
}

export const GOAL = {
  width: 7.32, // entre caras internas de los postes
  height: 2.44, // hasta cara inferior del travesaño
  postRadius: 0.06,
  depth: 2.0,
  get postX() {
    return this.width / 2 + this.postRadius
  },
  get barY() {
    return this.height + this.postRadius
  },
  get postZ() {
    // la cara trasera de la línea de gol está en z = 0
    return this.postRadius
  },
}

export const FIELD = {
  length: 105,
  width: 68,
  penaltyAreaDepth: 16.5,
  penaltyAreaWidth: 40.32,
  goalAreaDepth: 5.5,
  goalAreaWidth: 18.32,
  penaltySpot: 11,
  arcRadius: 9.15,
  lineWidth: 0.12,
}

// Jugador de barrera: el collider es una cápsula vertical que cubre de los pies a la cabeza.
export const WALL_PLAYER = {
  height: 1.83,
  radius: 0.23,
  spacing: 0.5, // hombro con hombro
}

// Arquero: se para un poco adelante de la línea, adentro del palo. Medidas del cuerpo en
// physics/KeeperRig.ts.
export const KEEPER = {
  lineOffset: 0.5, // metros delante de la línea de gol
  postInset: 0.55, // cuánto adentro del palo se para
}

export function autoWallCount(distanceToGoal: number): number {
  if (distanceToGoal < 21) return 5
  if (distanceToGoal < 26) return 4
  if (distanceToGoal < 31) return 3
  return 2
}

export type PositionPreset = { name: string; x: number; z: number }

function angled(name: string, distance: number, x: number): PositionPreset {
  return { name, x, z: Math.sqrt(distance * distance - x * x) }
}

export const POSITION_PRESETS: PositionPreset[] = [
  { name: '18m CENTER', x: 0, z: 18 },
  { name: '20m CENTER', x: 0, z: 20 },
  angled('22m LEFT', 22, -8),
  angled('22m RIGHT', 22, 8),
  { name: '25m CENTER', x: 0, z: 25 },
  { name: '28m CENTER', x: 0, z: 28 },
  { name: '30m CENTER', x: 0, z: 30 },
]

export const DEFAULT_PRESET = '25m CENTER'
