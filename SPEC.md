# FREE KICK LAB — PROTOTYPE SPEC v2

> v2 reemplaza a `SPEC_initial.md`. Cambios principales: input centrado en el **momento del golpe**, fuente de error por timing, modelo de golpe basado en el pie, drag con crisis aerodinámica, Magnus corregido, física propia (sin Rapier), feedback de impacto desde el primer milestone y asset de pelota definido.

---

# 1. Product Vision

Prototipo jugable centrado exclusivamente en la sensación de patear tiros libres.

Una sola pregunta:

> **¿Puede ser divertido patear la misma pelota al mismo arco durante 10-20 minutos solamente por cómo se siente la física?**

El corazón del producto:

- física convincente de pelota;
- control preciso sobre el golpe;
- **un golpe que se siente**: tensión al cargar, impacto al soltar, premio al entrar;
- trayectorias emergentes;
- diferentes técnicas de tiro;
- feedback visual y sonoro inmediato;
- estética arcade retro (fútbol de los 90 / principios de los 2000).

La trayectoria **nunca** es una animación prefabricada. Surge de la simulación.

---

# 2. Core Design Principle

```text
INPUT DEL JUGADOR
        ↓
GOLPE (pie + punto de contacto + técnica + timing)
        ↓
VELOCIDAD LINEAL + VELOCIDAD ANGULAR
        ↓
SIMULACIÓN FÍSICA
        ↓
TRAYECTORIA
```

Nunca `"CURVE SHOT" → animación de tiro curvo`.

Las técnicas solamente cambian **cómo el pie le transmite la fuerza a la pelota**.

---

# 3. Feel First

Este es el principio que ordena todo lo demás. Patear tiene tres momentos y los tres tienen que estar trabajados desde el primer milestone jugable:

| Momento | Qué tiene que sentir el jugador | Cómo |
|---|---|---|
| **Carga** | tensión, riesgo | mantener presionado, barra que sube, pasarse tiene castigo |
| **Impacto** | potencia, contundencia | sonido escalado por potencia, hitstop, micro shake, FOV kick |
| **Resultado** | lectura clara + premio | sombra, gajos que giran, trail, red que se infla, sonido de red |

Si una feature no mejora alguno de estos tres momentos o la capacidad de calibrar la física, no entra.

---

# 4. Prototype Scope

## Included

- cancha, arco, pelota, cámara;
- apuntado;
- punto de impacto sobre la pelota;
- técnica y pie;
- potencia con carga y timing;
- simulación física propia (vuelo + rebotes + postes + red);
- detección de gol;
- selección de posición inicial;
- feedback de impacto (audio, hitstop, shake);
- telemetría y modo debug;
- panel de parámetros en vivo;
- repetir tiro exacto;
- replay simple;
- reset instantáneo.

## Explicitly Out of Scope

jugadores (salvo barrera y arquero simples, ver §20b/§20c), animaciones humanas, equipos, partidos, faltas, offside, stamina, multiplayer, matchmaking, progresión, monedas, tienda, cosméticos, carrera, IA, networking, backend, usuarios, login.

> ¿Esto ayuda a evaluar si patear la pelota es divertido? Si no: **no entra.**

---

# 5. Technology Stack

```text
TypeScript
Vite
Three.js
lil-gui
```

- **Sin Rapier.** La física es propia (ver §6).
- Sin React.
- Audio: Web Audio API.
- Assets en `public/`.

---

# 6. Physics Architecture — por qué física propia

El mundo físico es una esfera contra: un plano (césped), tres cápsulas (dos postes + travesaño) y un volumen blando (red). Eso es ~200-300 líneas de código propio.

Ventajas sobre un motor genérico:

- **control total del rebote con spin** (backspin frena, topspin acelera, el césped come spin) — justo lo que más hay que calibrar, y donde un motor genérico pelea con damping angular y fricción propios;
- **determinismo trivial**: mismo input + misma seed → mismo tiro, bit a bit;
- todas las fuerzas son visibles y debuggeables;
- sin WASM ni inicialización asíncrona.

Si más adelante entran barrera y arquero se reevalúa (Rapier sigue siendo una opción válida en ese momento).

Three.js se encarga de render, cámaras, luces, efectos, UI 3D y visualización de debug. **Nunca** de la física.

---

# 7. World Units & Coordinates

SI en todo:

```text
distance = m, mass = kg, time = s
velocity = m/s, angularVelocity = rad/s, force = N
```

- Internamente spin siempre en **rad/s**. En UI se muestra en **rev/s** (`rev/s = rad/s / 2π`).
- Velocidad interna en m/s. En UI en km/h (`km/h = m/s × 3.6`).
- Todo parámetro de config con unidad ambigua lleva sufijo: `spinThresholdRevPerSec`, `speedThresholdMps`.

Sistema de coordenadas:

```text
origen  = centro de la línea de gol, a nivel del césped
+X      = derecha (vista del pateador mirando al arco)
+Y      = arriba
+Z      = hacia el pateador (el arco está en z = 0, se patea hacia -Z)
```

---

# 8. Physical Dimensions

## Ball

```ts
BALL_RADIUS = 0.11   // m
BALL_MASS   = 0.43   // kg
BALL_AREA   = π r²   // ≈ 0.038 m²
BALL_INERTIA = (2/3) m r²   // cáscara esférica hueca
```

## Goal

```ts
GOAL_WIDTH  = 7.32   // entre caras internas de los postes
GOAL_HEIGHT = 2.44   // hasta cara inferior del travesaño
POST_RADIUS = 0.06   // postes de 12 cm
GOAL_DEPTH  = 2.0    // profundidad de la red (visual + volumen blando)
```

## Field references (reales, para escala visual)

```ts
PENALTY_AREA_DEPTH = 16.5
PENALTY_AREA_WIDTH = 40.32
GOAL_AREA_DEPTH    = 5.5
PENALTY_SPOT       = 11.0
ARC_RADIUS         = 9.15
```

---

# 9. Assets

## Ball model

```text
public/models/soccer_ball.glb
```

- "Soccer Ball" by **keatura** — https://sketchfab.com/3d-models/soccer-ball-787bab2bbef345f29c8bf4b08907cf5e
- Licencia **CC-BY-4.0** → **obligatorio** mostrar crédito (pantalla de créditos / README / overlay de debug).

Características del archivo:

| | |
|---|---|
| Geometría | icosfera low-poly, 2160 tris |
| Material | `KHR_materials_unlit`, textura paleta 128×128 con filtro nearest |
| Gajos | pentágonos oscuros + hexágonos blancos → el spin se lee |
| Outline | segundo mesh (inverted hull, normales invertidas), ~5% más grande |
| Radio en el archivo | ≈ 0.88 u |

Uso:

- escalar el modelo para que el radio visual sea **0.11 m** (factor ≈ `0.11 / 0.88 ≈ 0.125`, medirlo con el bounding box al cargar, no hardcodear);
- **el collider es analítico** (esfera r = 0.11), nunca el mesh;
- el outline es un aliado para la legibilidad a baja resolución (§46). Exponer su grosor en el panel (escalar sólo el mesh `outline`);
- es unlit: no recibe luz. Está bien para la estética. La lectura de altura la da la sombra (§35).

## Otros assets

- **Cancha**: procedural con dimensiones FIFA reales (franjas, líneas, áreas). Se evaluó "Professional Soccer Field" (chofervirtual132, CC-BY-4.0) y se descartó: no trae tribunas y sus proporciones no son reales (el arco queda ~13 m de ancho al escalar la cancha a 105×68), lo que rompe la lectura de distancias. Queda como referencia de paleta de colores.
- **Botín (placeholder)**: "Adidas Predator Precision 25 Year David Beckham" (neurodriguez, CC-BY-4.0). Sirve para el pie flotante del golpe (§30), pero:
  - es un producto real con marca y nombre de un jugador → **sólo uso interno**, reemplazar antes de mostrar públicamente;
  - pesa 6.8 MB / 85k tris / PBR. **Decisión: se usa tal cual por ahora** (el contraste estético es aceptado); se reemplaza más adelante;
  - orientación calibrada: `rotX = 90°`, escala 0.65 (punta abajo, cordones hacia la pelota).
- **Tribuna (placeholder)**: "Tribune" (liftybones, CC-BY-4.0), `public/models/tribune.glb`. Sin texturas → colores planos por material. Mira hacia +X, es larga en Z y sus escalones son ~1.7x reales: se usa a escala 0.6 (~57 × 34 × 26 m) y se repite 3 veces detrás del arco y 2 por lateral. Reemplazar por algo más acorde a la estética más adelante.
- **Arco**: procedural (cilindros/cápsulas con las dimensiones exactas del §8) para que lo visual coincida 1:1 con los colliders. La red: malla procedural con textura de rombos/cuadrícula + alpha.
- **Césped**: textura tileable low-res con franjas de corte, `NearestFilter`.
- **Audio**: ver §41. Mientras no haya samples, sintetizar con Web Audio.

---

# 10. Ball State

```ts
interface BallState {
  position: Vector3
  velocity: Vector3
  rotation: Quaternion
  angularVelocity: Vector3   // rad/s, en espacio mundo
  previousPosition: Vector3
  timeInFlight: number
  grounded: boolean
}
// derivados (no se guardan): speed = |velocity|, spinRate = |angularVelocity|
```

---

# 11. Simulation Loop

```text
physics: fixed timestep, acumulador
render:  requestAnimationFrame, interpola entre los dos últimos estados
```

```ts
FIXED_DT = 1 / 240
```

A 35 m/s la pelota avanza ~15 cm por step (< diámetro), suficiente para colisiones discretas contra el césped. Para postes y travesaño usar **test continuo** (distancia mínima entre el segmento de movimiento de la pelota y el segmento del poste) para que nunca se atraviesen. La física nunca depende del framerate.

Por step:

```text
F = gravity + drag(v) + magnus(ω, v) + knuckle(t, v, ω)
v += (F / m) · dt
x += v · dt
ω *= exp(-spinDecay · dt)
rotation integra ω
resolver colisiones (césped, postes, travesaño, red)
detectar gol / fin de jugada
```

---

# 12. Gravity

```ts
gravity = 9.81   // dirección (0, -1, 0)
```

---

# 13. Aerodynamic Drag — con crisis de arrastre

```text
Fd = ½ · ρ · Cd(v) · A · |v|²     dirección: -v̂
```

**Cd depende de la velocidad.** Una pelota real tiene Cd bajo a alta velocidad y Cd alto a baja velocidad, con una transición brusca (crisis de arrastre) cerca de los 15 m/s. Consecuencia jugable: un tiro fuerte vuela "liviano", pierde velocidad, cruza el umbral, el drag salta y **la pelota se cae de golpe** al final. Ese es el dip que se quiere ver.

```ts
function dragCoefficient(speed: number): number {
  const t = smoothstep(
    cfg.drag.criticalSpeedMps - cfg.drag.transitionWidthMps,
    cfg.drag.criticalSpeedMps + cfg.drag.transitionWidthMps,
    speed,
  )
  return lerp(cfg.drag.cdSubcritical, cfg.drag.cdSupercritical, t)
}
```

Valores iniciales:

```ts
airDensity         = 1.225
cdSubcritical      = 0.45   // lento
cdSupercritical    = 0.22   // rápido
criticalSpeedMps   = 15
transitionWidthMps = 3
```

Mostrar en el panel una mini curva Cd(v) para entender la calibración.

---

# 14. Magnus Effect

```text
Fm = Cm · (ω × v)
```

- **No normalizar** el producto cruz: si ω = 0 o ω ∥ v, la fuerza es simplemente 0 (normalizar da NaN).
- Ya es proporcional a |ω|·|v|, que es el comportamiento físico para spins moderados (C_L ≈ S = rω/v).
- Valor físico de partida: `Cm ≈ ½ · ρ · A · r ≈ 0.0026 kg`. Con ω = 60 rad/s y v = 28 m/s da ~4 N → ~3-4 m de curva en un tiro de 25 m. Plausible.

Opcional (detrás de un flag): saturación del coeficiente de sustentación para spins extremos:

```ts
S  = r · |ω| / |v|
CL = min(cfg.magnus.liftSlope * S, cfg.magnus.maxLift)   // ≈ 1.0 · S, tope ~0.35
Fm = ½ · ρ · A · CL · |v|² · normalize(ω × v)            // sólo si |ω × v| > ε
```

El spin paralelo a la velocidad (gyro spin) no produce Magnus. Es correcto y no hay que compensarlo.

---

# 15. Spin

Vector físico `angularVelocity` (rad/s), nunca un escalar 0..100. Combina libremente sidespin, topspin/backspin y gyro.

Convención de signos (pateando hacia -Z):

```text
ω = +Y (antihorario visto desde arriba) → curva a la IZQUIERDA
ω = -Y                                    → curva a la DERECHA
ω = +X (backspin)                          → sustentación, flota
ω = -X (topspin)                           → cae más rápido
```

Rangos de referencia reales:

```text
tiro con efecto   ≈ 8-10 rev/s (50-60 rad/s)
knuckle           < 1.5 rev/s
```

---

# 16. Spin Decay

```ts
angularVelocity *= Math.exp(-cfg.spin.decayPerSec * dt)   // ~0.02-0.05
```

En contacto con el césped el spin se modifica en la colisión (§33), no con este decay.

---

# 17. Strike Model

Se separa estrictamente:

```text
STRIKE MODEL  → velocidad inicial, spin inicial, ángulo de salida
FLIGHT MODEL  → todo lo que pasa después
```

Calibrables de forma independiente.

## 17.1 Inputs

```ts
interface ShotRequest {
  aim: { yaw: number; pitch: number }     // radianes, intención
  contactPoint: { x: number; y: number }  // -1..1, cara trasera de la pelota vista desde el pateador
  technique: "INSTEP" | "CURVE" | "TRIVELA" | "KNUCKLE"
  foot: "LEFT" | "RIGHT"
  power: number                           // 0..1 (puede pasarse de 1, ver §22)
  seed: number                            // para error y knuckle
}

interface ShotInitialState {
  linearVelocity: Vector3
  angularVelocity: Vector3
  // diagnóstico
  appliedContactPoint: { x: number; y: number }   // después del error
  launchAngleDeg: number
  efficiency: number
}
```

## 17.2 Qué define cada cosa

- **Punto de contacto** = *dónde* le pega el pie a la pelota. Es absoluto, no se espeja con el pie.
- **Técnica** = *cómo* se mueve el pie: superficie, rigidez del tobillo y **dirección de la pasada** a través de la pelota.
- **Pie** = espeja la pasada de la técnica.

Así el efecto de cada técnica sale de la combinación y no de un `if`. Ejemplo: con pie derecho, el exterior (trivela) sólo puede tocar la pelota por su lado izquierdo y barriendo hacia afuera → spin -Y → curva a la derecha. El interior (curve) toca el lado derecho barriendo hacia adentro → spin +Y → curva a la izquierda.

## 17.3 Cálculo (base, todo en config)

```ts
// base del pateador: forward = dirección de aim en el plano XZ, right, up = +Y
const c = applyError(request.contactPoint, request)        // §22
const tech = TECHNIQUES[request.technique]
const footSign = request.foot === "RIGHT" ? 1 : -1

// eficiencia: pegarle descentrado transfiere menos velocidad y más spin
const offCenter = Math.hypot(c.x, c.y)
const efficiency = 1 - cfg.strike.offCenterLoss * offCenter * offCenter

const speed = speedFromPower(request.power) * tech.powerMultiplier * efficiency

// ángulo de salida: abajo levanta, arriba baja
const pitch = aim.pitch + (-c.y) * cfg.strike.launchFromContactRad + tech.launchBiasRad
// desvío lateral: pegarle de costado empuja hacia el lado opuesto
const yaw = aim.yaw + (-c.x) * cfg.strike.yawFromContactRad

// spin proporcional a la velocidad del golpe
const k = speed / cfg.strike.referenceSpeedMps
const sideSpin = (c.x * cfg.strike.sideSpinFromContact + tech.swing * footSign * cfg.strike.sideSpinFromSwing)
const backSpin = (-c.y) * cfg.strike.backSpinFromContact

angularVelocity = (up * sideSpin + right * backSpin) * tech.spinMultiplier * k   // rad/s
linearVelocity  = directionFrom(yaw, pitch) * speed
```

`tech.swing`: +1 la pasada genera curva a la izquierda con pie derecho, -1 a la derecha, 0 neutro.

## 17.4 `calculateShot` es determinista

Mismo `ShotRequest` (incluida la seed) → mismo `ShotInitialState`. Es una función pura y testeable.

---

# 18. Kick Techniques

| | INSTEP | CURVE | TRIVELA | KNUCKLE |
|---|---|---|---|---|
| Superficie | empeine | interior | exterior | empeine, tobillo rígido |
| `powerMultiplier` | 1.15 | 0.90 | 1.00 | 1.10 |
| `spinMultiplier` | 0.60 | 1.35 | 1.25 | 0.10 |
| `accuracyMultiplier` | 0.90 | 1.10 | 0.85 | 0.80 |
| `swing` | 0 | +1 | -1 | 0 |
| `launchBiasRad` | 0 | +pequeño | 0 | -pequeño |
| Personalidad | directo y fuerte | la más fácil para curvas marcadas | curva al revés, menos perdonadora | rápido, sin spin, inestable |

`accuracyMultiplier` divide el error de §22: más alto = más preciso.

---

# 19. Knuckleball

Ocurre **sólo** por condiciones físicas, nunca por técnica:

```text
spin bajo  Y  velocidad alta
```

Activación **continua** (sin corte duro, para que no haya saltos):

```ts
const spinW  = 1 - smoothstep(0.5 * spinThr, spinThr, spinRevPerSec)
const speedW = smoothstep(speedThr - 3, speedThr + 3, speed)
const w = spinW * speedW
```

Fuerza perpendicular a la velocidad, magnitud proporcional a la presión dinámica:

```ts
const q = 0.5 * airDensity * BALL_AREA * speed * speed
const nx = noise1D(seed, t * cfg.knuckle.frequencyHz)
const ny = noise1D(seed + 1000, t * cfg.knuckle.frequencyHz)
F = (side * nx + upPerp * ny) * q * cfg.knuckle.liftCoeff * w
```

- Ruido **continuo y con seed** (value/simplex noise), nunca random por frame.
- La seed viene del `ShotRequest` → repetir un tiro reproduce el mismo bamboleo.

Config inicial:

```ts
knuckle: {
  enabled: true,
  speedThresholdMps: 22,
  spinThresholdRevPerSec: 1.5,
  liftCoeff: 0.06,
  frequencyHz: 1.5,
}
```

---

# 20. Shot Input — tres pasos

Decisión de diseño (reemplaza el "todo a la vez" de v2): cada tiro se arma en tres pasos claros, con un indicador de paso arriba. `Esc` / click derecho vuelve un paso.

1. **APUNTAR** — una línea recta punteada pelota → objetivo (sin retícula). Es **intención**: no muestra gravedad ni efecto. Click confirma.
2. **CONTACTO** — la cámara va a un primer plano de la pelota vista desde atrás en la dirección del tiro. Una diana sobre la pelota elige el punto de impacto (mouse; flechas para ajuste fino). Se muestra la superficie del pie deducida y el efecto esperado (`INTERIOR · CURVA ← · BACKSPIN`). Click confirma.
3. **POTENCIA** — mantener click / Space y soltar (§21). Un mini-indicador muestra el contacto elegido.
4. *(Próxima iteración)* **TÉCNICA** — selector explícito de tipo de tiro.

Mientras no hay selector de técnica, `technique = AUTO`: la superficie del pie se deduce del contacto (ver `INFO_ball_effect.md`). Centro → empeine; lado del pie hábil → interior; lado contrario → exterior. La mezcla de parámetros es continua (smoothstep de |x| entre 0.15 y 0.6) para que no haya saltos.

Calibración actual (25 m, 85%): contacto x = 0.6 → ~3 m de curva; x = 0.85 → ~4 m.

---

# 20b. Barrera (adelantada desde "futuro")

Sin barrera el tiro recto siempre es óptimo y el efecto no tiene propósito; la barrera es lo que convierte el efecto en una decisión. Por eso entra al prototipo, mínima:

- jugadores low-poly procedurales, estáticos, sin IA ni animación salvo un salto;
- a 9.15 m de la pelota, sobre la línea pelota → arco corrida hacia el palo cercano (`aimX = clamp(ball.x · 0.35, ±1.8)`);
- cantidad por distancia: < 21 m → 5, < 26 m → 4, < 31 m → 3, resto → 2 (o fija desde el panel);
- collider: una cápsula vertical por jugador (r 0.23, alto 1.83), restitución 0.3;
- salto determinista ligado al tiempo de vuelo de la pelota (35 cm, 0.6 s, 50 ms de reacción): la barrera es un obstáculo móvil dentro de la sim, así que repetir un tiro reproduce el mismo salto;
- resultados: `BLOCKED` si no entra después de tocar la barrera, `GOAL · DEFLECTED` si entra desviada;
- `B` la prende/apaga.

---

# 20c. Arquero (adelantado desde "futuro")

Sin IA general: un plan determinista que se decide al patear.

**Posición inicial**: espera en el palo del lado desde donde se patea (centro → derecho; configurable), 0.5 m delante de la línea y 0.55 m adentro del palo.

**Lectura** (`physics/KeeperBrain.ts`): al salir la pelota corre la sim hacia adelante **sin obstáculos** (no sabe si la barrera la va a desviar) y obtiene dónde y cuándo cruza su plano. A ese punto le suma un error de lectura con seed: `σ = readErrorM + readErrorPerRps · spin` → la curva lo engaña.

**Decisión** (después de `reactionSec`):
- `WATCH` — va afuera o por arriba: la deja pasar y se acomoda;
- `BLOCK` — le llega caminando: se desplaza y ataja de frente (brazos a la altura de la pelota, salta o se agacha);
- `DIVE` — se desplaza hacia un punto de despegue y se estira para llegar justo; el cuerpo apunta al objetivo (más vertical cuanto más alta). Límites: `diveTimeSec`, `diveMaxShiftM`, `maxJumpM`. Si no llega, se tira igual y queda corto (`short` / `late` en telemetría);
- modo `CROSS` conserva el comportamiento anterior (cruza al palo contrario).

**Animación procedural**: poses (guardia, desplazamiento con pasos, atajada, estirada, caída) interpoladas por código sobre un rig de articulaciones (`physics/KeeperRig.ts`). El render muestra la animación a `animFps` = 15 (retro); la física usa tiempo continuo.

**Colliders = rig**: 8 cápsulas entre articulaciones (torso, cabeza, brazos, manos, piernas) leídas del mismo rig que se dibuja. Pose = función pura de (plan, t) → `P` reproduce exactamente la misma atajada.

**Cuerpo animado (Mixamo)** — `keeper.body = MIXAMO` (default; `BLOCKS` = el procedural):
- modelo: "Character_Male_GreenJacket (Rigged)" (Wardster, CC-BY, 668 tris, esqueleto Mixamo) en `public/models/keeper/keeper.glb`, escalado a 1.88 m;
- clips (FBX de Mixamo, cargados con `FBXLoader`, sin conversión) en `public/models/keeper/anims/`: idle, sidestep ×2, diving save ×2 (**estirada media**, manos ~1.0–1.4 m), body block ×2 (**estirada rasante**, manos ~0.3 m), catch low / middle / high (salto en el lugar, manos ~2.45 m). "Catch jump high" (corre hacia adelante) quedó afuera;
- al cargar se miden: lado real de cada clip (por desplazamiento de cadera/manos, no por el nombre: "to Left" es la izquierda del arquero = derecha del pateador), instante y posición de las manos en el punto clave, distancia por ciclo de los pasos;
- la cadera se fija en XZ (el desplazamiento lo maneja el cerebro) y se reescala en Y por la diferencia de piernas con X Bot;
- `physics/KeeperAnim.ts` (puro) decide capas de clips, pesos y tiempos: se reproduce sólo la ventana final de 0.45 s antes del punto clave, comprimida/estirada para que las manos lleguen con la pelota; la raíz se desplaza para poner las manos sobre el objetivo (dentro del alcance) y se eleva si la pelota va más alta que el clip;
- colliders: 15 cápsulas entre huesos de una **segunda instancia invisible** que la física posa en cada step (0.05 ms/step).

**Resultados**: `SAVED` (prioridad sobre palo y barrera) o `GOAL · OFF THE KEEPER`; `K` lo prende/apaga.

---

# 21. Power — carga y descarga

- Mantener presionado: la barra sube con una curva ease-in (~1.0 s hasta 100%).
- Soltar: patea con la potencia actual.
- Si se mantiene **más allá del 100%** entra en zona de sobrecarga (100-115%): más velocidad pero el error se dispara. "Se fue a la tribuna" tiene que poder pasar.
- Pasado el máximo de sobrecarga, patea solo.

```ts
speedFromPower(p) = minSpeedMps + Math.pow(clamp(p, 0, 1.15), cfg.power.curveExp) * speedRangeMps
```

Velocidades de referencia (configurables):

```text
suave        50-70 km/h   (14-19 m/s)
normal       70-100 km/h  (19-28 m/s)
fuerte       100-120 km/h (28-33 m/s)
extremo      120+ km/h
```

---

# 22. Shot Error — la fuente de tiros malos

Sin error, un input perfecto encuentra el "tiro mágico" en 5 minutos y el juego se muere. El error es lo que vuelve el resultado incierto y hace aparecer el "una más".

```ts
errorScale =
  cfg.error.base
  * powerErrorCurve(power)        // casi 0 hasta ~70%, crece después, explota en sobrecarga
  / tech.accuracyMultiplier

appliedContact = contactPoint + seededGaussian2D(seed) * errorScale * cfg.error.contactSpread
appliedYaw     = yaw   + seededGaussian(seed+1) * errorScale * cfg.error.aimSpreadRad
appliedPitch   = pitch + seededGaussian(seed+2) * errorScale * cfg.error.aimSpreadRad
```

- Seed por tiro → `P` (repetir) reproduce exactamente el mismo error.
- **Lab mode** (toggle en el panel): error = 0, para calibrar.
- La telemetría muestra el contacto pedido y el contacto real (§37). El jugador tiene que poder entender *por qué* le salió mal.

---

# 23. Footedness

```ts
type Foot = "LEFT" | "RIGHT"   // default RIGHT
```

Espeja `swing` de la técnica (§17). El punto de contacto no se espeja.

---

# 24. Starting Position

`Tab` → POSITION MODE: vista cenital, click sobre zona válida (fuera del área, a más de ~16 m del arco y dentro de la cancha). La pelota se mueve ahí y la cámara vuelve a la vista de tiro apuntando al centro del arco.

Presets (teclas en position mode o menú):

```text
18m CENTER · 20m CENTER · 22m LEFT · 22m RIGHT · 25m CENTER · 28m CENTER · 30m CENTER
```

---

# 25. Reset y loop

El loop ideal:

```text
configurar → cargar → patear → mirar → reset → (cambiar algo) → cargar → ...
```

- `R` → reset instantáneo a la misma posición, **conservando** aim, contacto, técnica y pie. Cambiar una sola variable entre tiros tiene que ser trivial.
- **Auto-reset** (configurable, default ON): ~1.2 s después de gol, afuera o pelota quieta. Cualquier tecla lo saltea.
- Máximo ~2 segundos entre que termina un tiro y se puede cargar el siguiente.

---

# 26. Repeat Exact Shot

`P` → repite el último `ShotRequest` exacto (incluida la seed). Permite distinguir *cambio físico* de *cambio de input* después de tocar un parámetro en el panel.

---

# 27. Shot History

Últimos 20 tiros en memoria:

```ts
interface ShotRecord {
  request: ShotRequest
  initialState: ShotInitialState
  result: ShotResult   // gol/poste/travesaño/afuera, velocidad al cruzar, altura máx, etc.
}
```

Lista en el panel de debug, click en uno → lo repite.

---

# 28. Replay

`V` → replay del último tiro.

- Durante la simulación se graban frames `{ time, position, rotation }` a la frecuencia de física.
- El replay interpola frames. No re-ejecuta física (así sigue valiendo aunque se hayan tocado parámetros).
- Velocidad normal y cámara lenta (0.25x) con `Shift+V`.

---

# 29. Camera

## Aim camera

```text
third person, detrás de la pelota, baja (~1.6-1.8 m)
pelota en primer plano abajo al centro, arco visible completo
```

Prioridad: **leer la trayectoria**.

## Shot camera

Después del golpe: la cámara se queda cerca del punto de tiro, rota suavemente (lerp del lookAt) para seguir la pelota y hace un dolly hacia adelante muy leve. Sin cortes.

Futuro: tracking camera, ball camera, replay cameras.

---

# 30. Kick Feedback

En el instante del golpe, todo sutil y escalado por potencia:

| Efecto | Valor inicial |
|---|---|
| Hitstop (freeze del mundo) | 30-60 ms según potencia |
| Camera shake | amplitud mínima, ~120 ms, decae rápido |
| FOV kick | +2-3° y vuelve en ~200 ms |
| Sonido de golpe | 2-3 capas (thump grave + chasquido + aire), volumen y pitch según potencia y técnica |
| Partículas de pasto | puñado de píxeles verdes en el punto de apoyo |
| Squash de la pelota | 1-2 frames, escala no uniforme en el eje del golpe |
| Vibración de gamepad | si hay gamepad |

Todo configurable y con on/off en el panel. No convertirlo en arcade exagerado todavía.

---

# 31. Goal Detection

- Gol cuando la pelota **entera** cruza la línea: `position.z < -BALL_RADIUS` (la línea de gol tiene la cara trasera en z = 0) y con el centro dentro del marco (entre postes y debajo del travesaño, considerando el radio).
- Detección con el segmento entre `previousPosition` y `position` para no perder el cruce.

Registrar:

```ts
goal: boolean
goalPosition: Vector3
goalVelocity: Vector3
goalTime: number
```

---

# 32. Goal Feedback & Net

- Texto **GOAL** con estética retro, corto (~0.8 s), sin celebración.
- **La red es el premio** y entra desde el primer milestone:
  - volumen blando detrás de la línea: cuando la pelota entra, se frena con un damping fuerte y cae;
  - deformación visual: los vértices de la malla cerca del punto de impacto se desplazan en la dirección de la pelota y vuelven con un resorte amortiguado;
  - sonido de red ("swish") + rugido de público corto.
- No simular la red físicamente.

---

# 33. Ground, Bounce & Rolling

Colisión esfera-plano con impulso normal + fricción tangencial en el punto de contacto, para que el spin afecte el rebote:

```ts
// punto de contacto: p = -n * r
vContact = v + ω × (-n * r)
// impulso normal con restitución e
// impulso tangencial de Coulomb (μ), limitado para no invertir el deslizamiento
// el impulso tangencial actualiza v y ω (I = 2/3 m r²)
```

Resultado esperado:

- backspin → la pelota pica y frena (o hasta retrocede un poco);
- topspin → pica y sale disparada hacia adelante;
- sidespin → pica y patea hacia un costado;
- después de unos piques: rodado puro (v = ω × r) con resistencia de rodadura.

No debe comportarse como una pelota de goma.

```ts
ground: {
  restitution: 0.55,
  friction: 0.45,
  rollingResistance: 0.06,   // desaceleración proporcional a g
}
```

---

# 34. Goal Posts & Crossbar

- Colliders: cápsulas (radio 0.06) con las dimensiones exactas del §8. El arco visual se genera con las mismas constantes.
- Colisión esfera-cápsula con test continuo (§11), restitución alta (~0.7), fricción baja.
- Al impactar: sonido metálico (distinto para poste y travesaño), camera shake mínimo, vibración visual del arco.
- **Los palos tienen que ser divertidos**. Un "poste y adentro" es un momento.

---

# 35. Ball Readability

La pelota tiene que leerse perfecta en todo momento:

- **Sombra blob** (disco oscuro con alpha) proyectada sobre el césped, más chica y más tenue cuanto más alta está la pelota. Es la herramienta principal para leer altura y dip desde atrás.
- **Gajos visibles**: el modelo ya los tiene. El spin tiene que *verse* girar.
- **Outline** del modelo con grosor ajustable.
- **Trail** (`T`): línea de puntos de la trayectoria, coloreada por velocidad. Fade del trail del tiro anterior (útil para comparar).

---

# 36. Physics Debug Visualization

Toggle con `` ` `` (backquote). No usar F1 (abre la ayuda del navegador en algunos casos).

Vectores sobre la pelota, escalados para ser legibles, cada uno con su color:

```text
VELOCITY · SPIN AXIS · DRAG · MAGNUS · KNUCKLE · GRAVITY
```

---

# 37. Telemetry

Panel compacto, siempre disponible:

```text
SHOT #14                     CURVE · R FOOT
Power          81%
Contact        (-0.40, -0.55) → (-0.47, -0.51) real
Speed          103 km/h  →  71 km/h al arco
Spin           7.4 rev/s
Spin Axis      32°
Launch Angle   18.4°
Efficiency     0.91
Distance       24.3 m
Max Height     3.7 m
Curve          2.9 m lateral
Knuckle        0.00
Result         GOAL (top left)
```

Opcional (no imprescindible para V1): gráfico altura vs distancia y vista cenital del desplazamiento lateral.

---

# 38. Physics Playground

Panel lil-gui (`G`) para modificar todo en vivo. **Nunca recompilar para calibrar.**

Carpetas:

```text
World      gravity, airDensity
Drag       cdSubcritical, cdSupercritical, criticalSpeedMps, transitionWidthMps
Magnus     coefficient, saturation on/off, liftSlope, maxLift
Spin       decayPerSec
Knuckle    enabled, thresholds, liftCoeff, frequencyHz
Strike     offCenterLoss, launchFromContactRad, yawFromContactRad, spin factors
Power      minSpeedMps, speedRangeMps, curveExp, chargeTime
Error      lab mode, base, contactSpread, aimSpreadRad
Ground     restitution, friction, rollingResistance
Posts      restitution, friction
Feel       hitstop, shake, fov kick, squash, auto-reset delay
Render     retro on/off, internal resolution, outline thickness
```

- Botones: **Export JSON** / **Import JSON** / **Reset to default**.
- La config se guarda en `localStorage` (con fallback si falla).

---

# 39. Physics Presets

Arrancar sólo con `DEFAULT`. Más adelante, como JSON exportados del panel:

```text
REALISTIC · ARCADE · HEAVY BALL · LIGHT BALL · CRAZY MAGNUS
```

---

# 40. Deterministic Mode

- Toda aleatoriedad (error, knuckle) sale de un PRNG con seed (ej. mulberry32).
- La seed se genera por tiro y se guarda en el `ShotRequest`.
- `DETERMINISTIC_MODE`: seed fija para todos los tiros.
- Test: `simulate(request)` corrido dos veces da la misma trayectoria.

---

# 41. Sound

Primera versión (sintetizado con Web Audio hasta tener samples):

```text
kick (por capas, escala con potencia) · post · crossbar · net · grass bounce · crowd (corto, en gol)
```

> La sensación del golpe depende muchísimo del audio. El impacto inicial tiene que comunicar potencia.

Por eso el audio del golpe entra en M1, no al final.

---

# 42. Visual Direction

Inspiraciones: International Superstar Soccer Deluxe, Virtua Striker, primeros Winning Eleven / PES, fútbol arcade de fines de los 90, deportes de PS1 / Sega.

**No copiar assets.** Evocar la época.

Principios:

```text
geometría 3D + render a baja resolución + texturas retro + UI pixelada
```

---

# 43. Internal Resolution

- `RETRO_RENDER = ON/OFF` (toggle en el panel).
- Resolución interna: 640×360 (default) o 480×270, escalado con nearest-neighbor.
- **Ojo**: a 640×360 una pelota a 25 m mide ~3 px. Mitigaciones, en orden:
  1. outline del modelo (ya viene);
  2. sombra blob;
  3. si no alcanza, render de la pelota + trail en un pase a resolución nativa superpuesto.

---

# 44. Texture, Lighting, Stadium

- Texturas low-res con `NearestFilter`. Nada hiperrealista.
- Luz: 1 direccional + 1 hemisphere. La pelota es unlit, así que la luz sólo afecta cancha y arco.
- Escena V1:

```text
cielo simple
horizonte / tribunas lejanas muy simples (o nada)
cancha con franjas y líneas reales
arco
pelota
```

La física tiene prioridad absoluta.

---

# 45. UI Direction

Inspirada en interfaces deportivas noventeras: tipografía bitmap grande, bordes simples, sombras duras, colores fuertes, pocos degradés, HUD compacto.

Evitar: glassmorphism, UI SaaS minimalista, cards tipo Apple.

**Tiene que parecer un videojuego.**

---

# 46. Controls

## Keyboard + Mouse

```text
Mouse              Aim
WASD / Arrows      Contact point
1 2 3 4            Instep / Curve / Trivela / Knuckle
F                  Switch foot

Hold LMB / Space   Charge power
Release            Kick

R                  Reset
P                  Repeat exact last shot
V                  Replay  (Shift+V: slow motion)

T                  Toggle trail
Tab                Position mode  (preventDefault)
G                  Physics panel
`                  Debug vectors
Esc                Salir de modo / cerrar panel
```

Pointer lock opcional para apuntar (toggle).

## Controller (futuro cercano)

```text
Left Stick    Aim
Right Stick   Contact point
D-pad         Technique
LB / L1       Switch foot
RT / R2       Hold = charge, release = kick
Y / Triangle  Reset
X / Square    Replay
```

---

# 47. Architecture

```text
src/
  main.ts
  app/
    Game.ts              estados: AIM, CHARGING, FLIGHT, RESULT, POSITION, REPLAY
    GameLoop.ts          fixed timestep + interpolación
  config/
    PhysicsConfig.ts     defaults + load/save
    GameConfig.ts
  physics/
    BallSim.ts           integrador, estado, step
    Aerodynamics.ts      drag (Cd(v)), Magnus, knuckle
    Collisions.ts        césped, cápsulas, red
    Noise.ts, Random.ts  ruido continuo + PRNG con seed
  shot/
    ShotTypes.ts         ShotRequest, ShotInitialState, ShotResult
    Techniques.ts
    ShotCalculator.ts    calculateShot() — función pura
    ShotError.ts
    PowerMeter.ts
  scene/
    Scene.ts, Field.ts, Goal.ts, Net.ts, Environment.ts, Lighting.ts
    BallView.ts          carga del glb, escala, outline, sombra, squash
  camera/
    AimCamera.ts, ShotCamera.ts, CameraFx.ts (shake, fov kick)
  audio/
    Sfx.ts
  ui/
    Hud.ts, ContactWidget.ts, PowerBar.ts, Telemetry.ts, GoalBanner.ts
  replay/
    ReplayRecorder.ts, ReplayPlayer.ts, ShotHistory.ts
  debug/
    DebugVectors.ts, Trail.ts, DebugPanel.ts
  render/
    RetroRenderer.ts
public/
  models/soccer_ball.glb
```

`physics/` y `shot/` no importan nada de Three.js salvo tipos matemáticos (o usan su propio `Vec3`), para poder testearlos sin render.

---

# 48. Milestones

El orden cambia respecto de v1: **el feel entra temprano**, la presentación retro y el tooling avanzado van después.

## M0 — Ball in the world

pelota (glb) a escala · césped · arco procedural · gravedad · rebote con spin · sombra · reset · loop fijo

**Success:** la pelota cae, pica, rueda y se detiene de forma creíble.

## M1 — The kick

aim · carga y descarga de potencia · tiro sin spin · drag con crisis · postes · red con deformación · detección de gol · sonido de golpe/red/poste · hitstop + shake · auto-reset · panel lil-gui básico · telemetría básica

**Success:** patear derecho al arco con distintas potencias ya es satisfactorio. Ver un tiro fuerte "caerse" al final.

## M2 — Spin

punto de contacto (widget) · Magnus · spin decay · trail · vectores de debug

**Success:** puedo hacer que la pelota curve y baje a voluntad, y cambiar el contacto cambia claramente la trayectoria.

## M3 — Techniques, foot & error

INSTEP / CURVE / TRIVELA · pie · error por potencia y técnica · lab mode · repetir tiro

**Success:** cada técnica produce una familia de tiros distinta. Aparecen tiros malos que se entienden.

## M4 — Knuckleball

**Success:** algunos tiros de bajo spin y alta velocidad presentan movimientos irregulares, suaves y reproducibles con `P`.

## M5 — Sandbox & tooling

position mode + presets · historial · replay · export/import de config · telemetría completa

**Success:** puedo patear desde cualquier lugar razonable y explicar por qué pasó cada trayectoria.

## M6 — Retro presentation

render low-res · UI bitmap · texturas · tribunas simples · pantalla de título · créditos (incluye el CC-BY del modelo)

**Success:** el juego empieza a tener identidad.

---

# 49. Physics Calibration Strategy

Una cosa por vez, en este orden:

```text
1 gravedad
2 velocidad base del tiro
3 drag (Cd alto/bajo, velocidad crítica)
4 rebote y rodado
5 Magnus
6 spin (magnitudes del strike)
7 punto de contacto
8 técnicas
9 error
10 knuckle
```

---

# 50. Reference Shots

Escenarios reproducibles (seed fija, lab mode) cargables desde el panel. Todos con pie derecho.

**Shot A** — 25 m, centro, INSTEP, 80%, contacto centro → trayectoria directa, leve caída al final por la crisis de drag.

**Shot B** — 22 m, izquierda, CURVE, 75%, contacto abajo-derecha → sube, curva a la izquierda y cae. (Con el interior del pie derecho se le pega al lado derecho de la pelota.)

**Shot C** — 26 m, centro, TRIVELA, 85%, contacto abajo-izquierda → curva de exterior clara hacia la derecha. (Con el exterior del pie derecho se le pega al lado izquierdo; v1 decía abajo-derecha, lo que con este modelo curvaría al revés.)

**Shot D** — 28 m, centro, KNUCKLE, 95%, contacto centro → rápido, casi sin rotación, leve movimiento irregular.

**Shot E** — 20 m, centro, INSTEP, 70%, contacto arriba → topspin, baja fuerte, pica antes del arco y sale disparada.

Cada reference shot guarda su trayectoria esperada aproximada para detectar regresiones al tocar la config.

---

# 51. Gameplay Test

Éxito si una persona, voluntariamente y sin arquero, puntos, campaña ni recompensas:

```text
patea · resetea · cambia algo · patea · patea · patea ...
```

durante **10 minutos o más**.

---

# 52. Emotional Target

> "A ver qué pasa si le pego un poquito más abajo."
>
> "Uh, mirá cómo bajó."
>
> "Pará, ahora quiero meter una trivela al segundo palo."
>
> "UNA MÁS."

`"una más"` es el verdadero KPI.

---

# 53. Design Constraints

- **Evitar tiros demasiado perfectos.** Tienen que existir tiros malos, altos, que se abren de más, que pican, espectaculares e inesperados.
- **Predecible para aprender, rico para dominar.** El error (§22) agrega incertidumbre, pero el jugador siempre tiene que poder entender qué pasó.
- **Plausible, no académico.** Se puede modificar un coeficiente real si mejora el juego.
- **Emergencia sobre casos especiales.** Bueno: `bajo spin + alta velocidad → knuckle`. Malo: `technique === KNUCKLE → mover la pelota`.
- **Nunca calibrar a ciegas.** Si la pelota hace algo raro tenemos que poder ver velocidad, spin, eje, fuerzas, técnica, contacto pedido y contacto real.

---

# 54. Performance

```text
60 FPS render · 240 Hz física · navegador de escritorio
```

---

# 55. Future (no implementar)

- **Skill system**: accuracy, power, curve, technique, consistency por jugador → entra como multiplicadores en `calculateShot` y `ShotError`.
- **Arquero**: reacción, posicionamiento, predicción, alcance. Nunca debe compensar una mala física de pelota.
- **Barrera**.
- **Modos**: Free Kick Challenge, Targets, Crossbar Challenge, Daily Shot, Historic Free Kicks, Trick Shots, Training, Online Duels, Career.
- **Loop futuro**: elegir posición → leer arco/barrera/arquero → configurar → ejecutar → mirar → resultado → otra vez.

---

# 56. Working Title

Interno: **FREE KICK LAB**. Alternativas: FREEKICK 99, FK99, GOLAZO, TIRO LIBRE, SET PIECE, CURVA. Sin decisión de branding todavía.

Pantalla de título (M6): `FREE KICK / PHYSICS LAB / PRESS START`.

---

# 57. Prototype Definition of Done

- cancha, arco y pelota;
- elegir posición, apuntar, contacto, potencia con carga, técnica y pie;
- cuatro técnicas;
- drag con crisis, Magnus, knuckle y spin funcionando;
- rebotes con spin, postes y red;
- feedback de impacto (audio, hitstop, shake);
- reset rápido, repetir tiro, replay;
- telemetría, vectores de debug y panel en vivo;
- créditos del modelo.

Y principalmente:

> **patear la pelota se siente bien.**

---

# 58. Final Product Principle

Nunca convertir este proyecto en *un juego de fútbol que también tiene tiros libres*.

Es **un juego sobre el arte de patear tiros libres**.

La pelota es el personaje principal. La trayectoria es el gameplay. El golpe es la mecánica. La física es el juego.
