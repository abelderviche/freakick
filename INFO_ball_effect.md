# Cómo se genera el efecto al pegarle a una pelota de fútbol

El efecto de la pelota depende principalmente de dos cosas:

1. **Dónde impactás la pelota**
2. **Cómo se mueve el pie durante el contacto**

Para un jugador **diestro**, tomando como referencia la pelota vista desde atrás:

- Si le pegás **a la derecha del centro de la pelota con la cara interna del pie**, el pie barre la pelota de derecha a izquierda. Eso genera rotación lateral y la pelota **se curva hacia la izquierda**.
- Si le pegás **a la izquierda del centro con la parte externa del pie**, generás la rotación opuesta y la pelota **se curva hacia la derecha**. Ese sería el típico efecto de **tres dedos**.
- Si impactás casi **en el centro**, con el empeine recto y atravesando la pelota, reducís el spin lateral y la pelota sale más recta.
- Si impactás **por debajo del centro**, generás **backspin**: la pelota gana sustentación, sube más y cae de forma más progresiva.
- Si impactás **por encima del centro**, generás **topspin**: la pelota tiende a bajar más rápido después de subir.
- Si pegás cerca del centro con un contacto muy seco, fuerte y con poca rotación, podés buscar un **knuckleball**: en vez de una curva estable, la pelota puede oscilar o desviarse de forma irregular.

---

## Referencia visual tipo reloj

Imaginando la pelota vista desde atrás como si fuera un reloj:

| Zona de impacto | Tipo de contacto | Resultado aproximado |
|---|---|---|
| 3 en punto | Interior del pie | Curva fuerte hacia la izquierda |
| 2–3 en punto | Interior + ligeramente abajo | Izquierda + elevación |
| 4–5 en punto | Interior + abajo | Izquierda + mucho backspin |
| 6 en punto | Empeine / debajo | Mucha elevación + backspin |
| Centro | Empeine | Tiro recto |
| 9 en punto | Exterior del pie | Curva hacia la derecha |
| 7–8 en punto | Exterior + abajo | Derecha + elevación |
| 12 en punto / arriba | Empeine | Topspin + caída rápida |

---

## Caso típico: efecto con cara interna

Ejemplo:

> Jugador diestro + cara interna + impacto en el lado derecho de la pelota.

Resultado:

- El pie roza tangencialmente la pelota.
- La pelota empieza a rotar.
- Se genera spin lateral.
- El efecto Magnus desvía la trayectoria.
- La pelota se curva hacia la izquierda.

En términos simples:

`Impacto a la derecha + interior del pie → spin lateral → curva hacia la izquierda`

---

## Tres dedos

Para un diestro:

> Exterior del pie + impacto sobre el lado izquierdo de la pelota.

Resultado:

`Impacto a la izquierda + exterior del pie → spin contrario → curva hacia la derecha`

Este efecto suele sentirse diferente al tiro con interior porque el movimiento del pie y el ángulo de contacto son distintos.

---

## Efecto vertical

### Backspin

Se consigue impactando por debajo del centro.

Efectos:

- Mayor sustentación
- Más tiempo en el aire
- Trayectoria más flotada
- Caída más progresiva

### Topspin

Se consigue impactando por encima del centro.

Efectos:

- Menor sustentación
- La pelota cae antes
- Puede permitir tiros que pasan por arriba de una barrera y bajan rápido

---

## Knuckleball

El knuckleball busca exactamente lo contrario a un tiro con efecto tradicional:

**muy poco spin**

Características:

- Contacto muy seco
- Impacto cerca del centro
- Mucha potencia
- Poco rozamiento lateral del pie sobre la pelota

Resultado:

La pelota no tiene una rotación estable y las fuerzas aerodinámicas pueden hacer que oscile o cambie levemente de dirección durante el vuelo.

---

# Cómo debería funcionar en un juego

Idealmente, el efecto no debería ser simplemente una propiedad como:

`curve = 0.8`

Debería surgir naturalmente de:

- Punto de impacto en la pelota
- Dirección del pie
- Velocidad del pie
- Ángulo de entrada
- Tipo de superficie del pie utilizada
- Potencia
- Spin resultante

Conceptualmente:

`impacto descentrado + velocidad tangencial del pie = rotación de la pelota`

Y luego:

`rotación + velocidad de la pelota + aire = efecto Magnus`

---

# Relación entre spin y trayectoria

- **Spin lateral** → curva horizontal
- **Backspin** → mayor sustentación
- **Topspin** → caída más agresiva
- **Poco spin** → posibilidad de knuckleball

---

# Principio clave para el gameplay

El jugador puede elegir la **intención del tiro**, pero el resultado debería depender de la ejecución.

Por ejemplo:

El jugador selecciona:

`Tiro con efecto`

Pero luego golpea demasiado cerca del centro.

Resultado:

`Poco spin → tiro casi recto`

O intenta tres dedos pero impacta demasiado abajo:

`Spin lateral + demasiado backspin → pelota se abre y se eleva demasiado`

Eso permitiría que el sistema tenga profundidad y que el jugador aprenda realmente a pegarle a la pelota, en lugar de simplemente seleccionar un tipo de tiro.
