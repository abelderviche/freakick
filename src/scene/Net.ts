import * as THREE from 'three'
import type { NetContact, NetPlane } from '../physics/Collisions'

const SEG_PER_M = 8
const MESH_SIZE = 0.14 // tamaño de la malla en metros
const BULGE_SIGMA = 0.55
const SPRING_K = 160
const SPRING_C = 9

let gridTexture: THREE.Texture | null = null

function netTexture(): THREE.Texture {
  if (gridTexture) return gridTexture
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  ctx.strokeStyle = 'rgba(255,255,255,1)'
  ctx.lineWidth = 3
  ctx.strokeRect(0, 0, 32, 32)
  gridTexture = new THREE.CanvasTexture(c)
  gridTexture.wrapS = gridTexture.wrapT = THREE.RepeatWrapping
  gridTexture.colorSpace = THREE.SRGBColorSpace
  return gridTexture
}

// Paño visual. No hay física de red: la deformación sigue a la pelota mientras la empuja y
// después vuelve con un resorte amortiguado.
export class NetPanel {
  readonly mesh: THREE.Mesh
  private base: Float32Array
  private uv: Float32Array // coordenadas (u, v) en metros por vértice
  private amp = 0
  private ampVel = 0
  private cu = 0
  private cv = 0
  private dir = 1

  constructor(private plane: NetPlane) {
    const nu = Math.max(2, Math.round(plane.uLen * SEG_PER_M))
    const nv = Math.max(2, Math.round(plane.vLen * SEG_PER_M))
    const positions: number[] = []
    const uvs: number[] = []
    const uvm: number[] = []
    const p = new THREE.Vector3()
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const u = (i / nu) * plane.uLen
        const v = (j / nv) * plane.vLen
        p.copy(plane.origin).addScaledVector(plane.uAxis, u).addScaledVector(plane.vAxis, v)
        positions.push(p.x, p.y, p.z)
        uvs.push(u / MESH_SIZE, v / MESH_SIZE)
        uvm.push(u, v)
      }
    }
    const index: number[] = []
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const a = j * (nu + 1) + i
        index.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1)
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geo.setIndex(index)
    this.base = new Float32Array(positions)
    this.uv = new Float32Array(uvm)

    this.mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        map: netTexture(),
        color: 0xf4f4f4,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    this.mesh.frustumCulled = false
  }

  update(contact: NetContact, dt: number): void {
    if (contact.side !== 0 && contact.penetration > 0) {
      const target = contact.penetration
      this.ampVel = (target - this.amp) / Math.max(dt, 1e-4)
      this.amp = target
      this.cu = contact.u
      this.cv = contact.v
      this.dir = -contact.side
    } else {
      const acc = -SPRING_K * this.amp - SPRING_C * this.ampVel
      this.ampVel += acc * dt
      this.amp += this.ampVel * dt
      if (Math.abs(this.amp) < 1e-4 && Math.abs(this.ampVel) < 1e-3) {
        this.amp = 0
        this.ampVel = 0
      }
    }
    this.deform()
  }

  reset(): void {
    this.amp = 0
    this.ampVel = 0
    this.deform()
  }

  private deform(): void {
    const attr = this.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
    const arr = attr.array as Float32Array
    const n = this.plane.normal
    const { uLen, vLen } = this.plane
    const s2 = 2 * BULGE_SIGMA * BULGE_SIGMA
    for (let k = 0, i = 0; i < arr.length; i += 3, k += 2) {
      let off = 0
      if (this.amp !== 0) {
        const u = this.uv[k]
        const v = this.uv[k + 1]
        const du = u - this.cu
        const dv = v - this.cv
        // los bordes del paño quedan fijos al marco
        const edge = Math.min(1, Math.min(u, uLen - u, v, vLen - v) / 0.4)
        off = this.amp * Math.exp(-(du * du + dv * dv) / s2) * edge * this.dir
      }
      arr[i] = this.base[i] + n.x * off
      arr[i + 1] = this.base[i + 1] + n.y * off
      arr[i + 2] = this.base[i + 2] + n.z * off
    }
    attr.needsUpdate = true
  }
}
