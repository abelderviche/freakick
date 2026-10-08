# Free Kick Lab

Prototipo sobre la sensación de patear tiros libres. Spec: [SPEC.md](SPEC.md).

Estado: **M0 + M1 + contacto + barrera** (pelota, patada, efecto según dónde le pegás, barrera que salta y arquero que lee el tiro y se tira). Sin sonido.

## Correr

Requiere Node 20+ (`.nvmrc` → 22).

```bash
nvm use
npm install
npm run dev
```

```bash
npm test          # física: piques, gol, postes, red, determinismo
npm run build
```

## Controles

Tres pasos por tiro:

1. **Apuntar** — el mouse mueve la línea (intención: más potencia → más alto). Click confirma.
2. **Contacto** — primer plano de la pelota; el mouse elige dónde le pegás (flechas para ajuste fino). Derecha → interior, curva a la izquierda; izquierda → exterior, curva a la derecha; abajo → backspin; arriba → topspin. Click confirma.
3. **Potencia** — mantener click / Space, soltar = patear (pasado 100% hay sobrecarga).

| | |
|---|---|
| Esc / click derecho | volver un paso |
| R | reset (conserva la mira) |
| P | repetir exactamente el último tiro |
| T | trail on/off |
| B | barrera on/off |
| K | arquero on/off |
| I | telemetría on/off |
| G | panel de física en vivo (se guarda en localStorage, export/import JSON) |

## Créditos (CC-BY 4.0, Sketchfab)

- "Soccer Ball" by keatura — https://sketchfab.com/3d-models/soccer-ball-787bab2bbef345f29c8bf4b08907cf5e
- "Tribune" by liftybones — https://sketchfab.com/3d-models/tribune-7eea9c16440d43588ee3dab63096491e
- "Character_Male_GreenJacket (Rigged)" by Wardster — https://sketchfab.com/3d-models/character-male-greenjacket-rigged-a6fa6763af6d4b90bc885e956c90d8ae (arquero)
- Animaciones de arquero: Mixamo (Adobe), aplicadas desde X Bot
- "Adidas Predator Precision 25 Year David Beckham" by neurodriguez — https://sketchfab.com/3d-models/adidas-predator-precision-25-year-david-beckham-38852558463540ccb58f04ef21602ea1 (placeholder de uso interno: producto con marca real)
