import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'

const SEGMENTS = 24
const START = new THREE.Color(0xffd60a)
const END = new THREE.Color(0xff7a00)

// Línea recta pelota → objetivo. Es intención, no trayectoria: no tiene gravedad ni efecto.
export class AimLine {
  readonly line: Line2
  private readonly geometry = new LineGeometry()
  private readonly material: LineMaterial
  private readonly positions = new Float32Array((SEGMENTS + 1) * 3)

  constructor() {
    const colors: number[] = []
    const c = new THREE.Color()
    for (let i = 0; i <= SEGMENTS; i++) {
      c.copy(START).lerp(END, i / SEGMENTS)
      colors.push(c.r, c.g, c.b)
    }
    this.geometry.setPositions(this.positions)
    this.geometry.setColors(colors)
    this.material = new LineMaterial({
      vertexColors: true,
      linewidth: 4, // px
      dashed: true,
      dashSize: 0.9,
      gapSize: 0.45,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      depthTest: false, // se ve por encima de la barrera
    })
    this.line = new Line2(this.geometry, this.material)
    this.line.frustumCulled = false
    this.line.renderOrder = 2
  }

  setResolution(width: number, height: number): void {
    this.material.resolution.set(width, height)
  }

  update(from: THREE.Vector3, to: THREE.Vector3): void {
    const p = new THREE.Vector3()
    for (let i = 0; i <= SEGMENTS; i++) {
      // arranca un poco adelante de la pelota para no taparla
      const t = 0.015 + (i / SEGMENTS) * 0.985
      p.lerpVectors(from, to, t)
      this.positions.set([p.x, p.y, p.z], i * 3)
    }
    this.geometry.setPositions(this.positions)
    this.line.computeLineDistances()
  }

  set visible(v: boolean) {
    this.line.visible = v
  }
}
