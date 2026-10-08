import * as THREE from 'three'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FIELD } from '../config/GameConfig'

export function addLighting(scene: THREE.Scene): void {
  scene.add(new THREE.HemisphereLight(0xdfefff, 0x3a5a2a, 1.4))
  const sun = new THREE.DirectionalLight(0xfff4e0, 1.8)
  sun.position.set(30, 60, 40)
  scene.add(sun)
}

export function createSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 24, 12)
  const colors: number[] = []
  const pos = geo.getAttribute('position')
  const top = new THREE.Color(0x3d7fd6)
  const horizon = new THREE.Color(0xbfe3ff)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, pos.getY(i) / 900)
    c.copy(horizon).lerp(top, Math.pow(t, 0.6))
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }))
}

// La tribuna viene sin texturas: colores planos por material, estilo 90s.
const STAND_COLORS = [0x8a8f99, 0x6f747d, 0x9aa0aa, 0x5a6070, 0x2f5fb0, 0xd8d8d8, 0x4a4f5a, 0x3a3f4a]

// El modelo mira hacia +X, es largo en Z y sus escalones son ~1.7x reales: 0.6 lo deja
// en ~57 m de largo y ~26 m de alto.
export const STAND_TUNING = {
  scale: 0.6,
}

// Repite el mismo modelo alrededor de la cancha. Cada entrada: posición del centro de la
// tribuna y hacia dónde mira (ángulo en Y).
export async function createStands(loader: GLTFLoader, url: string): Promise<THREE.Group> {
  const gltf = await loader.loadAsync(url)
  const source = gltf.scene
  const materials = new Map<string, THREE.Material>()
  source.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const old = mesh.material as THREE.Material
    if (!materials.has(old.name)) {
      const color = STAND_COLORS[materials.size % STAND_COLORS.length]
      materials.set(old.name, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }))
    }
    mesh.material = materials.get(old.name)!
  })

  // normalizar: centrar en XZ y apoyar en el piso
  const box = new THREE.Box3().setFromObject(source)
  const center = box.getCenter(new THREE.Vector3())
  source.position.set(-center.x, -box.min.y, -center.z)
  const unit = new THREE.Group()
  unit.add(source)
  unit.userData.size = box.getSize(new THREE.Vector3())

  const group = new THREE.Group()
  const size = (unit.userData.size as THREE.Vector3).clone().multiplyScalar(STAND_TUNING.scale)
  const placements = standPlacements(size)
  for (const p of placements) {
    const copy = unit.clone()
    copy.position.set(p.x, 0, p.z)
    copy.rotation.y = p.rotY
    copy.scale.setScalar(STAND_TUNING.scale)
    group.add(copy)
  }
  return group
}

// rotY: 0 mira a +X, π mira a -X, -π/2 mira a +Z (hacia la cancha desde atrás del arco)
function standPlacements(size: THREE.Vector3): { x: number; z: number; rotY: number }[] {
  const depth = size.x
  const length = size.z
  const behindGoal = -8 - depth / 2
  const side = FIELD.width / 2 + 6 + depth / 2
  const placements = [-1, 0, 1].map((i) => ({ x: i * length, z: behindGoal, rotY: -Math.PI / 2 }))
  for (const z of [length / 2, length * 1.5]) {
    placements.push({ x: -side, z, rotY: 0 }, { x: side, z, rotY: Math.PI })
  }
  return placements
}
