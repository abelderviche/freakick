// Toda variable calibrable vive acá. El panel (G) la modifica en vivo.

export const DEFAULT_CONFIG = {
  world: {
    gravity: 9.81,
    airDensity: 1.225,
  },
  drag: {
    cdSubcritical: 0.45, // pelota lenta
    cdSupercritical: 0.22, // pelota rápida
    criticalSpeedMps: 15,
    transitionWidthMps: 3,
  },
  magnus: {
    coefficient: 0.0026, // kg, ≈ ½·ρ·A·r
  },
  spin: {
    decayPerSec: 0.03,
  },
  strike: {
    offCenterLoss: 0.15,
    launchFromContactRad: 0.08,
    yawFromContactRad: 0.03,
    sideSpinFromContact: 26,
    sideSpinFromSwing: 11,
    backSpinFromContact: 35,
    referenceSpeedMps: 28,
  },
  ground: {
    restitution: 0.55,
    friction: 0.45,
    rollingResistance: 0.06,
    settleSpeedMps: 0.6, // por debajo, el pique no rebota
    spinFriction: 2.0, // freno del spin vertical sobre el césped
  },
  posts: {
    restitution: 0.7,
    friction: 0.15,
  },
  wall: {
    enabled: true,
    autoCount: true, // cantidad según distancia al arco
    count: 4,
    distance: 9.15,
    jump: true,
    jumpHeight: 0.35,
    jumpDelaySec: 0.05, // reacción desde que sale la pelota
    jumpDurationSec: 0.6,
    restitution: 0.3, // un cuerpo absorbe más que un poste
    friction: 0.3,
  },
  keeper: {
    enabled: true,
    body: 'MIXAMO', // MIXAMO = modelo con animaciones de Mixamo | BLOCKS = procedural de bloques
    mode: 'PREDICT', // PREDICT = lee el tiro y se tira | CROSS = cruza al palo contrario (sin decisión)
    side: 'AUTO', // AUTO = palo del lado desde donde se patea (centro → derecho) | LEFT | RIGHT
    reactionSec: 0.2, // desde que sale la pelota hasta que empieza a moverse
    readErrorM: 0.15, // error de lectura base (desvío estándar en metros)
    readErrorPerRps: 0.05, // + error por cada rev/s de spin: la curva engaña
    shuffleSpeedMps: 4.5, // desplazamiento lateral antes de tirarse
    diveTimeSec: 0.45, // del despegue a la estirada completa
    diveMaxShiftM: 1.6, // cuánto se desplaza la pelvis en la estirada
    maxJumpM: 0.5, // cuánto puede subir la pelvis
    blockReachM: 0.45, // si la pelota viene a esta distancia del cuerpo, ataja de frente
    blockTimeSec: 0.25,
    speedMps: 5, // sólo modo CROSS
    animFps: 15, // render de la animación a pocos cuadros (retro). 0 = suave
    restitution: 0.25, // manos y cuerpo absorben
    friction: 0.4,
  },
  net: {
    stiffness: 400,
    damping: 32,
    friction: 6,
  },
  power: {
    minSpeedMps: 12,
    speedRangeMps: 18,
    curveExp: 1.2,
    chargeTimeSec: 1.0,
    chargeEaseExp: 1.3,
    overchargeMax: 1.15,
  },
  aim: {
    // el pitch se compensa por gravedad para esta velocidad: con potencia mayor la pelota
    // pasa más alta que la retícula, con menor más baja
    referenceSpeedMps: 26,
    gravityCompensation: 1.0,
  },
  feel: {
    hitstopMinMs: 25,
    hitstopMaxMs: 65,
    swingMs: 90,
    shakeAmp: 0.035,
    shakeMs: 150,
    fovKickDeg: 3,
    squash: 0.22,
    grassParticles: true,
    autoReset: true,
    autoResetDelaySec: 1.2,
  },
  camera: {
    distance: 4.0,
    height: 1.5,
    lookAtY: 0.5,
    fov: 50,
    followLerp: 3.5,
    followWeight: 0.6,
    dolly: 1.5,
  },
}

export type PhysicsConfig = typeof DEFAULT_CONFIG

// subir la versión cuando cambian defaults de calibración: una config vieja guardada los pisaría
const STORAGE_KEY = 'freekick.config.v2'

export function cloneConfig(c: PhysicsConfig): PhysicsConfig {
  return JSON.parse(JSON.stringify(c))
}

// Copia sólo las claves conocidas para que un JSON viejo no rompa la forma de la config.
export function mergeInto(target: Record<string, any>, source: Record<string, any>): void {
  for (const key of Object.keys(target)) {
    if (!(key in source)) continue
    const t = target[key]
    const s = source[key]
    if (t && typeof t === 'object') {
      if (s && typeof s === 'object') mergeInto(t, s)
    } else if (typeof s === typeof t) {
      target[key] = s
    }
  }
}

export function loadConfig(): PhysicsConfig {
  const cfg = cloneConfig(DEFAULT_CONFIG)
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) mergeInto(cfg, JSON.parse(raw))
  } catch {
    // sin storage: defaults
  }
  return cfg
}

export function saveConfig(cfg: PhysicsConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    // ignorar
  }
}
