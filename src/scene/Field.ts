import * as THREE from 'three'
import { FIELD } from '../config/GameConfig'

// Cancha procedural con dimensiones FIFA. El canvas cubre x ∈ [-40, 40], z ∈ [-10, 115].
const X0 = -40
const X1 = 40
const Z0 = -10
const Z1 = FIELD.length + 10
const PPM = 16 // píxeles por metro

export function createField(maxAnisotropy: number): THREE.Group {
  const group = new THREE.Group()

  const outer = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x2f6a2a }),
  )
  outer.position.set(0, -0.02, FIELD.length / 2)
  group.add(outer)

  const texture = new THREE.CanvasTexture(drawPitch())
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = maxAnisotropy
  const pitch = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0, Z1 - Z0).rotateX(-Math.PI / 2),
    new THREE.MeshLambertMaterial({ map: texture }),
  )
  pitch.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2)
  group.add(pitch)

  return group
}

function drawPitch(): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = (X1 - X0) * PPM
  canvas.height = (Z1 - Z0) * PPM
  const ctx = canvas.getContext('2d')!
  const px = (x: number) => (x - X0) * PPM
  const pz = (z: number) => (z - Z0) * PPM
  const hw = FIELD.width / 2
  const L = FIELD.length

  ctx.fillStyle = '#3a8030'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // franjas perpendiculares a la dirección del tiro: ayudan a leer la distancia
  const stripes = 18
  const sw = L / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#4a9a38' : '#3f8a30'
    ctx.fillRect(px(-hw - 3), pz(i * sw), (FIELD.width + 6) * PPM, sw * PPM + 1)
  }

  // ruido de pasto
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let seed = 1234567
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * 14
    img.data[i] += n * 0.6
    img.data[i + 1] += n
    img.data[i + 2] += n * 0.4
  }
  ctx.putImageData(img, 0, 0)

  ctx.strokeStyle = '#f2f2ea'
  ctx.fillStyle = '#f2f2ea'
  ctx.lineWidth = FIELD.lineWidth * PPM

  const rect = (x0: number, z0: number, x1: number, z1: number) =>
    ctx.strokeRect(px(x0), pz(z0), (x1 - x0) * PPM, (z1 - z0) * PPM)
  const arc = (x: number, z: number, r: number, a0: number, a1: number) => {
    ctx.beginPath()
    ctx.arc(px(x), pz(z), r * PPM, a0, a1)
    ctx.stroke()
  }
  const spot = (x: number, z: number) => {
    ctx.beginPath()
    ctx.arc(px(x), pz(z), 0.15 * PPM, 0, Math.PI * 2)
    ctx.fill()
  }

  const lw = FIELD.lineWidth / 2
  rect(-hw, lw, hw, L - lw) // la línea de gol ocupa z ∈ [0, 0.12]
  ctx.beginPath()
  ctx.moveTo(px(-hw), pz(L / 2))
  ctx.lineTo(px(hw), pz(L / 2))
  ctx.stroke()
  arc(0, L / 2, FIELD.arcRadius, 0, Math.PI * 2)
  spot(0, L / 2)

  const pa = FIELD.penaltyAreaWidth / 2
  const ga = FIELD.goalAreaWidth / 2
  for (const end of [0, L]) {
    const dir = end === 0 ? 1 : -1
    const z = (d: number) => end + dir * d
    rect(-pa, Math.min(z(lw), z(FIELD.penaltyAreaDepth)), pa, Math.max(z(lw), z(FIELD.penaltyAreaDepth)))
    rect(-ga, Math.min(z(lw), z(FIELD.goalAreaDepth)), ga, Math.max(z(lw), z(FIELD.goalAreaDepth)))
    spot(0, z(FIELD.penaltySpot))
    // medialuna: sólo la parte fuera del área
    const half = Math.acos((FIELD.penaltyAreaDepth - FIELD.penaltySpot) / FIELD.arcRadius)
    const center = dir > 0 ? Math.PI / 2 : -Math.PI / 2
    arc(0, z(FIELD.penaltySpot), FIELD.arcRadius, center - half, center + half)
  }

  // córners
  arc(-hw, lw, 1, 0, Math.PI / 2)
  arc(hw, lw, 1, Math.PI / 2, Math.PI)
  arc(-hw, L - lw, 1, -Math.PI / 2, 0)
  arc(hw, L - lw, 1, Math.PI, Math.PI * 1.5)

  return canvas
}
