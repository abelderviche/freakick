import * as THREE from 'three'
import { GOAL } from '../config/GameConfig'
import { NET_PLANES } from '../physics/Collisions'
import { NetPanel } from './Net'

// Arco generado con las mismas constantes que los colliders: lo que se ve es lo que choca.
export function createGoal(): { group: THREE.Group; nets: NetPanel[]; frame: THREE.Group } {
  const group = new THREE.Group()
  const frame = new THREE.Group()
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff })
  const r = GOAL.postRadius
  const px = GOAL.postX
  const barY = GOAL.barY
  const pz = GOAL.postZ
  const top = barY + r

  for (const x of [-px, px]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(r, r, top, 16), white)
    post.position.set(x, top / 2, pz)
    frame.add(post)
  }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 2 * (px + r), 16), white)
  bar.rotation.z = Math.PI / 2
  bar.position.set(0, barY, pz)
  frame.add(bar)
  group.add(frame)

  // estructura de soporte de la red
  const rodMat = new THREE.MeshLambertMaterial({ color: 0xb8b8b8 })
  const rod = (a: THREE.Vector3, b: THREE.Vector3) => {
    const len = a.distanceTo(b)
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 6), rodMat)
    m.position.copy(a).add(b).multiplyScalar(0.5)
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize())
    group.add(m)
  }
  const d = -GOAL.depth
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  rod(V(-px, barY, pz), V(-px, barY, d))
  rod(V(px, barY, pz), V(px, barY, d))
  rod(V(-px, barY, d), V(px, barY, d))
  rod(V(-px, 0, d), V(-px, barY, d))
  rod(V(px, 0, d), V(px, barY, d))
  rod(V(-px, 0.02, pz), V(-px, 0.02, d))
  rod(V(px, 0.02, pz), V(px, 0.02, d))
  rod(V(-px, 0.02, d), V(px, 0.02, d))

  const nets = NET_PLANES.map((plane) => new NetPanel(plane))
  for (const net of nets) group.add(net.mesh)

  return { group, nets, frame }
}
