import * as THREE from 'three'

// Bloques de colores planos para armar personajes low-poly procedurales.
const materials = new Map<number, THREE.MeshLambertMaterial>()

export function flatMaterial(color: number): THREE.MeshLambertMaterial {
  if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color, flatShading: true }))
  return materials.get(color)!
}

export function box(w: number, h: number, d: number, color: number, x: number, y: number, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), flatMaterial(color))
  mesh.position.set(x, y, z)
  return mesh
}

// Segmento tipo "hueso" entre dos puntos (brazos en pose).
export function limb(a: THREE.Vector3, b: THREE.Vector3, thickness: number, color: number): THREE.Mesh {
  const len = a.distanceTo(b)
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, len, thickness), flatMaterial(color))
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
  return mesh
}

export function head(radius: number, color: number, y: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 0), flatMaterial(color))
  mesh.position.set(0, y, 0)
  return mesh
}

export function blobShadow(radius: number, opacity = 0.3): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity, depthWrite: false }),
  )
  mesh.position.y = 0.012
  return mesh
}
