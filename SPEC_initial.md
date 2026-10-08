# FREE KICK PHYSICS PROTOTYPE

## 1. Product Vision

Construir un prototipo jugable centrado exclusivamente en la sensación de patear tiros libres.

El objetivo NO es construir inicialmente un juego completo de fútbol.

El objetivo es responder una sola pregunta:

> **¿Puede ser divertido patear la misma pelota al mismo arco durante 10-20 minutos solamente por cómo se siente la física?**

El corazón del producto debe ser:

- Física convincente de pelota.
- Control preciso sobre el golpe.
- Trayectorias emergentes.
- Diferentes técnicas de tiro.
- Feedback visual inmediato.
- Estética arcade retro inspirada en juegos de fútbol de los 90 y principios de los 2000.

El jugador debe poder experimentar libremente con:

- dirección;
- altura;
- potencia;
- punto de contacto;
- técnica de golpeo;
- distancia;
- ángulo respecto del arco.

La trayectoria de la pelota NO debe ser una animación prefabricada.

Debe surgir de la simulación física.

---

# 2. Core Design Principle

La regla fundamental del sistema es:

```text
INPUT DEL JUGADOR
        ↓
CONTACTO PIE / PELOTA
        ↓
VELOCIDAD LINEAL
+
VELOCIDAD ANGULAR
+
EJE DE ROTACIÓN
        ↓
SIMULACIÓN FÍSICA
        ↓
TRAYECTORIA
```

Nunca:

```text
"CURVE SHOT"
        ↓
ANIMACIÓN DE TIRO CURVO
```

Los diferentes tipos de tiro solamente modifican la manera en la que la fuerza del golpe se transmite a la pelota.

La trayectoria final siempre debe ser calculada dinámicamente.

---

# 3. Prototype Scope

## Included

El prototipo inicial contiene únicamente:

- cancha;
- arco;
- pelota;
- cámara;
- sistema de apuntado;
- selección del punto de impacto sobre la pelota;
- selección de técnica;
- selección de potencia;
- simulación física;
- rebotes;
- detección de gol;
- selección de posición inicial;
- telemetría;
- modo debug;
- replay simple;
- reset rápido.

---

# 4. Explicitly Out of Scope

No implementar todavía:

- arquero;
- barrera;
- jugadores;
- animaciones humanas;
- equipos;
- partidos;
- faltas;
- offside;
- stamina;
- multiplayer;
- matchmaking;
- progresión;
- monedas;
- tienda;
- cosméticos;
- carrera;
- IA;
- networking;
- backend;
- usuarios;
- login.

Toda feature debe responder:

> ¿Esto ayuda a evaluar si patear la pelota es divertido?

Si la respuesta es no:

**no entra en el prototipo.**

---

# 5. Technology Stack

## Recommended stack

```text
TypeScript
Vite
Three.js
Rapier 3D
```

Opcionalmente:

```text
Tweakpane / lil-gui
```

para modificar variables físicas en tiempo real.

No utilizar React en la primera versión salvo que exista una razón concreta.

Mantener el prototipo simple.

---

# 6. Rendering Architecture

Three.js debe encargarse exclusivamente de:

- render;
- cámaras;
- iluminación;
- shaders;
- modelos;
- UI 3D;
- efectos;
- debug visualization.

Rapier debe encargarse de:

- rigid bodies;
- collisions;
- gravity;
- contact resolution;
- bouncing;
- CCD.

La aerodinámica de fútbol debe implementarse por encima de Rapier.

Rapier NO representa automáticamente:

- Magnus effect;
- aerodynamic drag realista;
- knuckleball;
- pérdida de spin;
- interacción compleja aire/rotación.

---

# 7. World Units

Toda la simulación utiliza SI units.

```text
distance = meters
mass = kilograms
time = seconds
velocity = meters / second
angularVelocity = radians / second
force = newtons
```

Nunca utilizar unidades arbitrarias.

---

# 8. Physical Dimensions

## Ball

Valores iniciales aproximados:

```ts
BALL_RADIUS = 0.11 // meters

BALL_DIAMETER = 0.22

BALL_MASS = 0.43 // kilograms
```

## Goal

```ts
GOAL_WIDTH = 7.32
GOAL_HEIGHT = 2.44
```

## Penalty area references

Utilizar dimensiones reales de fútbol para mantener escala visual consistente.

---

# 9. Ball State

La pelota debe contener como mínimo:

```ts
interface BallState {
  position: Vector3
  velocity: Vector3

  rotation: Quaternion
  angularVelocity: Vector3

  speed: number
  spinRate: number

  timeInFlight: number
  previousPosition: Vector3
}
```

---

# 10. Ball Physics

Cada physics tick debe calcular aproximadamente:

```text
Ftotal =

gravity
+
drag
+
Magnus
+
knuckle
+
otras fuerzas opcionales
```

Luego:

```text
Rapier.addForce(Ftotal)
```

---

# 11. Physics Timestep

La simulación física debe utilizar timestep fijo.

Idealmente:

```text
120 Hz
```

o como mínimo:

```text
60 Hz
```

Preferencia:

```ts
FIXED_DT = 1 / 120
```

El render puede funcionar independientemente.

```text
physics: fixed timestep
render: requestAnimationFrame
```

La física nunca debe depender directamente del framerate.

---

# 12. Gravity

Utilizar:

```ts
GRAVITY = 9.81
```

dirección:

```text
0, -9.81, 0
```

---

# 13. Aerodynamic Drag

El drag debe aumentar aproximadamente con el cuadrado de la velocidad.

Modelo:

```text
Fd = 1/2 * airDensity * Cd * A * velocity²
```

Dirección:

```text
opuesta a velocity
```

Pseudo:

```ts
function calculateDrag(ball: BallState): Vector3 {
  const speed = ball.velocity.length()

  if (speed === 0) {
    return ZERO
  }

  const direction = ball.velocity.normalized().multiplyScalar(-1)

  const magnitude =
    0.5 *
    AIR_DENSITY *
    DRAG_COEFFICIENT *
    BALL_AREA *
    speed *
    speed

  return direction.multiplyScalar(magnitude)
}
```

Variables ajustables:

```ts
AIR_DENSITY
DRAG_COEFFICIENT
BALL_AREA
```

No intentar conseguir valores académicamente perfectos en primera instancia.

La prioridad es:

> comportamiento visual creíble.

---

# 14. Magnus Effect

El efecto Magnus genera la curva de la pelota.

Conceptualmente:

```text
Fm ∝ ω × v
```

donde:

```text
ω = angular velocity
v = linear velocity
```

Implementación simplificada:

```ts
const magnusDirection =
  angularVelocity.cross(velocity).normalize()

const magnusMagnitude =
  MAGNUS_COEFFICIENT *
  speed *
  speed *
  spinRate

magnusForce =
  magnusDirection * magnusMagnitude
```

La magnitud final debe ser calibrada experimentalmente.

---

# 15. Spin

El spin tiene que tener:

```text
axis
direction
magnitude
```

No utilizar solamente:

```text
spin = 0..100
```

Representarlo físicamente.

Ejemplo:

```ts
angularVelocity = new Vector3(
  spinX,
  spinY,
  spinZ
)
```

Esto permite combinar:

- sidespin;
- topspin;
- backspin.

---

# 16. Contact Point System

Antes del tiro el usuario elige dónde impactar la pelota.

Mostrar una representación frontal de la pelota.

```text
            TOP

             ●


LEFT   ●     ○     ●   RIGHT


             ●

           BOTTOM
```

Internamente representar el punto como:

```ts
interface BallContactPoint {
  x: number // -1..1
  y: number // -1..1
}
```

Ejemplos:

```text
center:
0, 0

bottom:
0, -0.8

left:
-0.7, 0

bottom-left:
-0.6, -0.6
```

---

# 17. Effect of Contact Point

El punto de contacto debe modificar:

- spin axis;
- spin magnitude;
- launch angle;
- horizontal deviation;
- energy transfer.

Ejemplo conceptual:

```text
hit left side
→ rotation around vertical axis
→ curve right

hit right side
→ opposite rotation

hit below center
→ backspin
→ increased lift

hit above center
→ topspin
→ faster dip
```

Los resultados exactos deben calibrarse.

---

# 18. Kick Techniques

Inicialmente implementar cuatro técnicas.

```text
INSTEP
CURVE
TRIVELA
KNUCKLE
```

---

# 19. Instep

Representa un golpe fuerte con empeine.

Características:

```text
high power
low-medium spin
medium control
direct trajectory
```

Multiplicadores sugeridos:

```ts
powerMultiplier = 1.15
spinMultiplier = 0.60
accuracyMultiplier = 0.9
```

---

# 20. Curve Shot

Golpe con interior.

Características:

```text
medium-high spin
good control
moderate power
large Magnus potential
```

Ejemplo:

```ts
powerMultiplier = 0.90
spinMultiplier = 1.35
accuracyMultiplier = 1.1
```

Debe ser la técnica más fácil para generar curvas marcadas.

---

# 21. Trivela

Golpe con exterior / tres dedos.

Características:

```text
high sidespin
different spin direction
medium-high power
less forgiving
```

Ejemplo:

```ts
powerMultiplier = 1.00
spinMultiplier = 1.25
accuracyMultiplier = 0.85
```

Puede agregar una pequeña componente lateral inicial a la velocidad.

---

# 22. Knuckleball

Características:

```text
high speed
extremely low spin
unstable aerodynamic trajectory
```

Ejemplo:

```ts
powerMultiplier = 1.10
spinMultiplier = 0.10
```

El knuckle debe ocurrir físicamente solamente cuando:

```text
spinRate < threshold
AND
speed > threshold
```

No debe existir:

```ts
if (shotType === KNUCKLE) {
  playKnuckleAnimation()
}
```

La técnica simplemente facilita alcanzar condiciones de knuckle.

---

# 23. Knuckle Physics

Cuando existe:

```text
low spin
+
high velocity
```

aplicar pequeñas fuerzas aerodinámicas variables.

Ejemplo conceptual:

```ts
if (
  spinRate < KNUCKLE_SPIN_THRESHOLD &&
  speed > KNUCKLE_SPEED_THRESHOLD
) {
  knuckleForce = calculateKnuckle(...)
}
```

Puede utilizarse:

```text
Perlin Noise
Simplex Noise
smooth pseudo-random noise
```

NO utilizar random independiente por frame.

Eso produciría vibración artificial.

Debe existir continuidad temporal.

Ejemplo:

```ts
const nx = noise(time * frequency)
const ny = noise(time * frequency + 100)

force.x = nx * strength
force.y = ny * strength
```

La intensidad puede depender de velocidad.

---

# 24. Spin Decay

La rotación debe disminuir ligeramente durante el vuelo.

Ejemplo:

```ts
angularVelocity *= exp(-SPIN_DECAY * dt)
```

El valor debe ser pequeño.

---

# 25. Shot Pipeline

Toda ejecución debe seguir este pipeline:

```text
PLAYER INPUT

↓

aim direction

↓

contact point

↓

technique

↓

power

↓

calculate strike

↓

initial velocity

↓

initial angular velocity

↓

physics simulation

↓

ball trajectory
```

---

# 26. Shot Input Phase

El jugador configura cuatro variables.

## Step 1 — Aim

Elegir dirección.

Representar:

```ts
yaw
pitch
```

Puede existir una retícula sobre el arco.

La retícula representa intención.

NO representa el resultado real.

---

# 27. Aim Controls

Mouse:

```text
mouse X → yaw
mouse Y → pitch
```

Controller:

```text
left stick → aim
```

Keyboard fallback:

```text
WASD / arrows
```

---

# 28. Contact Phase

Mostrar pelota grande en HUD.

El jugador desplaza un cursor sobre su superficie.

Mouse:

```text
move cursor
click confirm
```

Controller:

```text
right stick
```

---

# 29. Technique Phase

Selector:

```text
[ INSTEP ]
[ CURVE ]
[ TRIVELA ]
[ KNUCKLE ]
```

Keyboard ejemplo:

```text
1
2
3
4
```

---

# 30. Power Phase

Barra:

```text
POWER

████████████░░░░
```

Escala interna:

```text
0..1
```

Pero el valor no debe mapear linealmente necesariamente.

Ejemplo:

```ts
shotSpeed =
  minSpeed +
  powerCurve(powerInput) *
  speedRange
```

Puede utilizar:

```ts
Math.pow(power, 1.2)
```

u otra curva calibrada.

---

# 31. Approximate Shot Speeds

Configurable:

```text
soft shot:
50-70 km/h

normal free kick:
70-100 km/h

strong free kick:
100-120 km/h

extreme:
120+ km/h
```

Mostrar internamente metros/segundo.

Conversión:

```text
km/h = m/s * 3.6
```

---

# 32. Footedness

Aunque no exista jugador visible, preparar:

```ts
type Foot = "LEFT" | "RIGHT"
```

La pierna debe afectar:

- curva natural;
- trivela;
- orientación del spin;
- presets.

Default:

```text
RIGHT
```

---

# 33. Starting Position

El jugador debe poder mover el punto del tiro.

Implementar modo:

```text
POSITION MODE
```

Vista elevada/top-down.

El usuario hace click sobre una zona válida.

La pelota se mueve a esa posición.

---

# 34. Preset Positions

Además del modo libre:

```text
18m CENTER
20m CENTER
22m LEFT
22m RIGHT
25m CENTER
28m CENTER
30m CENTER
```

---

# 35. Camera

Cámara principal detrás de la pelota.

Características:

```text
third person
low angle
goal visible
ball foreground
```

La cámara debe recordar juegos de fútbol arcade.

No utilizar inicialmente cámara ultra cinematográfica.

Prioridad:

**leer trayectoria.**

---

# 36. Ball Follow Camera

Después del golpe:

Opción inicial recomendada:

la cámara permanece relativamente cerca del punto inicial y sigue visualmente la pelota.

Más adelante:

```text
TRACKING CAMERA
BALL CAMERA
REPLAY CAMERA
```

---

# 37. Replay

Después de cada tiro:

```text
SPACE / R
→ replay
```

Guardar durante la simulación:

```ts
interface BallFrame {
  time: number
  position: Vector3
  rotation: Quaternion
}
```

Replay:

interpolar frames.

No volver a ejecutar física.

---

# 38. Instant Reset

Debe ser extremadamente rápido.

```text
ENTER → shoot
R → reset
SPACE → replay
```

El loop ideal:

```text
configure
shoot
watch
reset
shoot
watch
reset
```

Máximo unos pocos segundos entre intentos.

---

# 39. Goal Detection

Crear trigger invisible dentro del arco.

Considerar gol cuando el centro de la pelota cruza completamente el plano de gol.

Registrar:

```ts
goal = true
goalPosition
goalVelocity
goalTime
```

---

# 40. Goal Visualization

Cuando hay gol:

```text
GOAL
```

con estética retro.

No agregar celebración.

El feedback debe durar poco.

---

# 41. Ball Trail

Durante el desarrollo agregar trail opcional.

Ejemplo:

```text
●
 ●
  ●
   ●
```

Debe permitir entender:

- curva;
- dip;
- wobble;
- altura.

Toggle:

```text
T → trajectory trail
```

---

# 42. Telemetry

Mostrar panel debug:

```text
SHOT DATA

Technique      CURVE
Power          81%

Speed          103 km/h
Spin           7.4 rev/s
Spin Axis      32°
Launch Angle   18.4°

Distance       24.3 m
Max Height      3.7 m

Goal           YES
```

---

# 43. Physics Debug Visualization

Toggle:

```text
F1
```

Mostrar vectores:

```text
VELOCITY
SPIN
DRAG
MAGNUS
KNUCKLE
```

Ejemplo conceptual:

```text
            ↑ MAGNUS

⚽ ----------→ VELOCITY

       ↻ SPIN
```

Escalarlos visualmente para ser legibles.

---

# 44. Physics Playground

Crear un panel interno para modificar parámetros en vivo.

Variables:

```text
gravity
drag coefficient
Magnus coefficient
spin multiplier
spin decay
knuckle strength
knuckle frequency
bounce restitution
ball friction
air density
max shot velocity
```

Nunca recompilar para calibrar física.

---

# 45. Presets

Permitir guardar presets de física:

```text
REALISTIC
ARCADE
HEAVY BALL
LIGHT BALL
CRAZY MAGNUS
```

Pero comenzar solamente con:

```text
DEFAULT
```

---

# 46. Visual Direction

Inspiraciones:

```text
International Superstar Soccer Deluxe
Virtua Striker
early Winning Eleven / PES
late 90s arcade football
PS1 / Sega-era sports games
```

Pero NO copiar assets.

La estética debe evocar esa época.

---

# 47. Rendering Style

Principios:

```text
3D geometry
+
low-resolution rendering
+
retro textures
+
pixelated UI
```

No necesariamente utilizar pixel-art 2D.

---

# 48. Internal Resolution

Renderizar opcionalmente a resolución interna baja.

Ejemplo:

```text
640x360
```

o:

```text
480x270
```

Luego escalar mediante nearest-neighbor.

Debe existir toggle:

```text
RETRO_RENDER = ON/OFF
```

Esto permite trabajar cómodo durante desarrollo.

---

# 49. Texture Style

Utilizar:

```text
low resolution grass
simple goal texture
simple sky
simple stadium
```

Filtrado:

```text
NearestFilter
```

cuando corresponda.

Evitar texturas hiperrealistas.

---

# 50. Lighting

Inicio:

```text
1 directional light
1 ambient / hemisphere light
```

No gastar tiempo inicialmente en iluminación sofisticada.

La pelota debe leerse perfectamente.

---

# 51. Stadium

Prototype V1:

```text
grass
goal
sky
simple distant stands
```

Incluso se puede arrancar sin estadio.

La física tiene prioridad absoluta.

---

# 52. Sound

Primera versión:

```text
kick sound
post sound
crossbar sound
net sound
grass bounce
```

La sensación del golpe depende muchísimo del audio.

El impacto inicial debe comunicar potencia.

---

# 53. Kick Feedback

Cuando ocurre el tiro:

- sonido;
- mínimo camera shake;
- posible micro freeze-frame;
- vibración de controller;
- pequeño FOV impulse.

Todo debe ser extremadamente sutil.

No convertirlo en arcade exagerado todavía.

---

# 54. Goal Net

En primera versión:

puede utilizarse una red visual simplificada.

No hace falta simular físicamente miles de nodos.

Alternativas:

```text
animated shader
simple deformation
bones
fake net reaction
```

La física de red NO forma parte del core experiment.

---

# 55. Architecture

Propuesta:

```text
src/

  app/
    Game.ts
    GameLoop.ts

  scene/
    Scene.ts
    Lighting.ts
    Environment.ts
    Field.ts
    Goal.ts

  ball/
    Ball.ts
    BallState.ts

  physics/
    PhysicsWorld.ts
    Aerodynamics.ts
    Drag.ts
    Magnus.ts
    Knuckle.ts
    SpinDecay.ts

  shot/
    Shot.ts
    ShotInput.ts
    ShotCalculator.ts
    ShotTechnique.ts
    ContactPoint.ts

  camera/
    AimCamera.ts
    ShotCamera.ts
    ReplayCamera.ts

  ui/
    AimUI.ts
    ContactUI.ts
    TechniqueUI.ts
    PowerUI.ts
    TelemetryUI.ts

  replay/
    ReplayRecorder.ts
    ReplayPlayer.ts

  debug/
    PhysicsDebug.ts
    DebugPanel.ts

  config/
    PhysicsConfig.ts
    GameConfig.ts

  utils/
```

---

# 56. Shot Model

```ts
interface ShotRequest {
  aim: {
    yaw: number
    pitch: number
  }

  contactPoint: {
    x: number
    y: number
  }

  technique:
    | "INSTEP"
    | "CURVE"
    | "TRIVELA"
    | "KNUCKLE"

  power: number

  foot: "LEFT" | "RIGHT"
}
```

Resultado:

```ts
interface ShotInitialState {
  linearVelocity: Vector3
  angularVelocity: Vector3
}
```

---

# 57. ShotCalculator

Debe existir una función central:

```ts
calculateShot(
  request: ShotRequest
): ShotInitialState
```

Esta función debe ser deterministic.

Mismo input:

```text
→ mismo initial state
```

Excepto posibles variaciones deliberadas configurables.

---

# 58. Separating Strike from Flight

Es fundamental separar:

```text
STRIKE MODEL
```

de:

```text
FLIGHT MODEL
```

Strike Model determina:

```text
velocity
spin
launch angle
```

Flight Model determina qué sucede después.

Esto permite calibrarlos independientemente.

---

# 59. Deterministic Mode

Agregar:

```text
DETERMINISTIC_MODE
```

Knuckle noise debe utilizar seed.

Así podemos reproducir exactamente un tiro para debugging.

---

# 60. Shot History

Guardar últimos 20 tiros.

```ts
interface ShotRecord {
  request: ShotRequest
  initialState: ShotInitialState
  result: ShotResult
}
```

UI debug:

```text
SHOT #12
SHOT #13
SHOT #14
```

Permitir repetir tiro.

---

# 61. Repeat Shot

Feature muy importante:

```text
REPEAT EXACT SHOT
```

Esto permite distinguir:

```text
cambio físico real
vs
cambio de input
```

Atajo:

```text
P
```

---

# 62. Ball Trajectory Graph

Opcional pero útil.

Panel pequeño:

```text
height vs distance
```

Y vista aérea:

```text
lateral displacement
```

No imprescindible para V0.

---

# 63. First Development Milestone

## M0 — Ball In Space

Objetivo:

```text
ball
gravity
ground collision
reset
```

Success:

la pelota cae, rebota y se estabiliza correctamente.

---

# 64. M1 — Straight Shot

Agregar:

```text
goal
shot velocity
power
aim
```

Sin spin.

Success:

puedo patear recto al arco con distintas potencias.

---

# 65. M2 — Drag

Agregar resistencia aerodinámica.

Success:

un tiro fuerte desacelera visualmente de forma convincente.

---

# 66. M3 — Spin

Agregar:

```text
angular velocity
Magnus
```

Success:

puedo hacer que la pelota curve voluntariamente.

---

# 67. M4 — Contact Point

Agregar UI de punto de impacto.

Success:

cambiar el contacto cambia claramente la trayectoria.

---

# 68. M5 — Techniques

Agregar:

```text
INSTEP
CURVE
TRIVELA
```

Success:

cada técnica produce una familia de tiros diferente.

---

# 69. M6 — Knuckleball

Agregar comportamiento aerodinámico irregular.

Success:

algunos tiros de bajo spin y alta velocidad presentan movimientos laterales impredecibles pero suaves.

---

# 70. M7 — Sandbox

Agregar:

```text
select shot location
```

Success:

puedo patear desde cualquier posición razonable.

---

# 71. M8 — Telemetry

Agregar:

```text
speed
spin
trajectory
forces
```

Success:

puedo explicar por qué ocurrió cada trayectoria.

---

# 72. M9 — Retro Presentation

Agregar:

```text
retro UI
low resolution rendering
pixel font
low-res textures
audio
```

Success:

el juego empieza a tener identidad.

---

# 73. Physics Calibration Strategy

No intentar calibrar todo simultáneamente.

Orden:

```text
1 gravity
2 basic shot speed
3 drag
4 Magnus
5 spin
6 contact point
7 techniques
8 knuckle
9 bounce
```

---

# 74. Reference Shots

Crear escenarios reproducibles.

## Shot A

```text
25 meters
center
instep
80% power
center contact
```

Esperado:

trayectoria directa.

---

## Shot B

```text
22 meters
left side
curve
75%
bottom-left contact
```

Esperado:

sube, curva y cae.

---

## Shot C

```text
26 meters
center
trivela
85%
bottom-right
```

Esperado:

curva exterior clara.

---

## Shot D

```text
28 meters
center
knuckle
95%
center
```

Esperado:

trayectoria rápida con poca rotación y leve movimiento irregular.

---

# 75. Gameplay Test

El prototipo puede considerarse exitoso si una persona voluntariamente:

```text
patea
resetea
cambia algo
patea
resetea
patea
patea
patea
```

durante mínimo:

```text
10 minutos
```

sin:

- arquero;
- puntos;
- campaña;
- recompensas.

---

# 76. Emotional Target

El jugador debería pensar:

> “A ver qué pasa si le pego un poquito más abajo.”

Después:

> “Uh, mirá cómo bajó.”

Después:

> “Pará, ahora quiero meter una trivela al segundo palo.”

Después:

> “UNA MÁS.”

Ese:

```text
"una más"
```

es el verdadero KPI del prototipo.

---

# 77. Important Design Constraint

Evitar hacer los tiros demasiado perfectos.

La física debe permitir:

- tiros malos;
- tiros altos;
- tiros que se abren demasiado;
- tiros que pican;
- tiros espectaculares;
- tiros inesperados.

Si cada configuración produce automáticamente algo hermoso:

el sistema pierde profundidad.

---

# 78. Future Skill System

No implementar todavía.

Pero dejar abierta la arquitectura para parámetros futuros:

```text
accuracy
power
curve
technique
consistency
```

Esto permitiría eventualmente diferentes jugadores.

---

# 79. Future Goalkeeper

No implementar ahora.

Arquitectura futura podría permitir:

```text
reaction time
positioning
dive prediction
reach
animations
```

Pero el arquero jamás debe compensar una mala física de pelota.

---

# 80. Future Game Modes

Una vez validado el core:

```text
Free Kick Challenge
Targets
Crossbar Challenge
Career
Online Duels
Daily Shot
Historic Free Kicks
Trick Shots
Training
```

---

# 81. Potential Main Game Loop

Futuro:

```text
choose position
↓
read goal / wall / goalkeeper
↓
configure shot
↓
execute
↓
watch trajectory
↓
result
↓
try again
```

---

# 82. Prototype Controls

Keyboard + Mouse:

```text
Mouse        Aim
Click        Confirm

1            Instep
2            Curve
3            Trivela
4            Knuckle

Space        Shoot
R            Reset
P            Repeat previous shot

T            Toggle trajectory
F1           Physics debug

Tab          Shot position mode
```

---

# 83. Controller

Futuro cercano:

```text
Left Stick    Aim
Right Stick   Contact point
D-pad         Technique

RT / R2       Power / shot
Y / Triangle  Reset
X / Square    Replay
```

---

# 84. Performance

Target:

```text
60 FPS render
120 Hz physics
desktop browser
```

El prototipo debe funcionar fluidamente en hardware moderno estándar.

---

# 85. CCD

La pelota debe utilizar:

```text
Continuous Collision Detection
```

para evitar atravesar:

- poste;
- travesaño;
- suelo.

Especialmente con velocidades:

```text
30+ m/s
```

---

# 86. Ground Interaction

Configurar:

```text
friction
restitution
rolling resistance
```

Cuando la pelota toca césped:

- rebota;
- pierde velocidad;
- pierde spin;
- comienza a rodar.

No debe comportarse como una pelota de goma.

---

# 87. Goal Posts

Postes deben utilizar geometría física cilíndrica.

Cuando impacta:

- sonido metálico;
- cambio brusco de trayectoria;
- cámara shake mínimo.

Los palos deben ser divertidos.

---

# 88. Physics Philosophy

No se busca:

```text
academic simulation
```

Se busca:

```text
physically plausible
+
predictable enough to learn
+
rich enough to master
```

La sensación manda.

Puede modificarse un coeficiente físico real si mejora gameplay.

---

# 89. Rule of Thumb

Siempre preferir:

```text
emergent behavior
```

sobre:

```text
special-case animations
```

Ejemplo bueno:

```text
low spin + high speed
→ knuckle physics
```

Ejemplo malo:

```text
technique === KNUCKLE
→ move ball left/right
```

---

# 90. Debug Philosophy

Todo lo importante debe poder visualizarse.

Si la pelota hizo algo raro debemos poder responder:

```text
qué velocidad tenía
qué spin tenía
qué fuerzas actuaban
qué eje de rotación tenía
qué técnica se utilizó
qué contacto recibió
```

Nunca calibrar a ciegas.

---

# 91. Configuration

Toda variable física debe vivir en configuración.

Ejemplo:

```ts
export const PHYSICS = {
  gravity: 9.81,

  ball: {
    radius: 0.11,
    mass: 0.43,
  },

  air: {
    density: 1.225,
    dragCoefficient: 0.25,
  },

  magnus: {
    coefficient: 0.001,
  },

  spin: {
    decay: 0.02,
  },

  knuckle: {
    enabled: true,
    speedThreshold: 22,
    spinThreshold: 5,
    strength: 1,
    frequency: 2,
  },
}
```

Valores ilustrativos.

Deben ser calibrados.

---

# 92. Initial Prototype Scene

Primera escena:

```text
clear sky

simple stadium / horizon

        GOAL


        |        |
        |        |
        |________|



            ⚽


          CAMERA
```

Nada más.

---

# 93. UI Direction

Inspirada en interfaces deportivas noventeras.

Características:

```text
large bitmap typography
simple borders
strong shadows
bright colors
minimal gradients
compact HUD
arcade sports aesthetic
```

Evitar:

```text
modern glassmorphism
minimal SaaS UI
Apple-like cards
```

Tiene que parecer un videojuego.

---

# 94. Boot Screen

Opcional más adelante:

```text
FREE KICK
PHYSICS LAB
```

con estética de juego deportivo antiguo.

Subtítulo:

```text
PRESS START
```

---

# 95. Working Title

Nombre interno:

```text
FREE KICK LAB
```

alternativas:

```text
FREEKICK 99
FK99
GOLAZO
TIRO LIBRE
SET PIECE
ROBERTO
CURVA
```

No tomar decisión de branding todavía.

---

# 96. Prototype Definition of Done

El prototipo V1 está terminado cuando:

- existe cancha;
- existe arco;
- existe pelota;
- puedo elegir posición;
- puedo apuntar;
- puedo elegir contacto;
- puedo elegir potencia;
- puedo elegir técnica;
- existen cuatro tipos de tiro;
- Magnus funciona;
- drag funciona;
- knuckle funciona;
- rebotes funcionan;
- postes funcionan;
- puedo resetear rápido;
- puedo repetir un tiro;
- existe replay;
- existe telemetría;
- existen herramientas debug.

Y principalmente:

> **patear la pelota se siente bien.**

---

# 97. Final Product Principle

Nunca convertir este proyecto en:

> un juego de fútbol que también tiene tiros libres.

Debe ser:

> **un juego sobre el arte de patear tiros libres.**

La pelota es el personaje principal.

La trayectoria es el gameplay.

El golpe es la mecánica.

La física es el juego.
