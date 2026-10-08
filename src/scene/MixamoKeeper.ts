import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import type { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { KEEPER } from '../config/GameConfig'
import type { Capsule } from '../physics/Collisions'
import type { ClipMeta, ClipMetaTable, ClipName, KeeperAnimState } from '../physics/KeeperAnim'
import { blobShadow } from './LowPoly'

const BASE = '/models/keeper/'
const KEEPER_HEIGHT = 1.88

// Archivos de Mixamo. El lado (Pos/Neg) NO se toma del nombre: se mide al cargar.
const FILES = {
  idle: 'idle',
  steps: ['sidestep_to_left', 'sidestep_to_right'],
  diveMid: ['diving_save_to_left', 'diving_save_to_right'], // estirada a media altura
  diveLow: ['body_block_to_left', 'body_block_to_right'], // bloqueo rasante
  catchLow: 'catch_low',
  catchMid: 'catch_middle',
  catchHigh: 'catch_high',
}

const HIPS = 'mixamorigHips'

// Colliders: segmentos entre huesos (metros a escala del arquero).
const COLLIDER_BONES: [string, string, number][] = [
  ['Hips', 'Spine2', 0.16],
  ['Spine2', 'Neck', 0.17],
  ['Head', 'HeadTop_End', 0.11],
  ['LeftArm', 'LeftForeArm', 0.06],
  ['LeftForeArm', 'LeftHand', 0.06],
  ['LeftHand', 'LeftHand', 0.1],
  ['RightArm', 'RightForeArm', 0.06],
  ['RightForeArm', 'RightHand', 0.06],
  ['RightHand', 'RightHand', 0.1],
  ['LeftUpLeg', 'LeftLeg', 0.09],
  ['LeftLeg', 'LeftFoot', 0.07],
  ['LeftFoot', 'LeftToeBase', 0.06],
  ['RightUpLeg', 'RightLeg', 0.09],
  ['RightLeg', 'RightFoot', 0.07],
  ['RightFoot', 'RightToeBase', 0.06],
]

// Una copia del arquero con su propio mixer: se usa una para dibujar y otra para la física.
export class KeeperInstance {
  readonly root = new THREE.Group()
  readonly model: THREE.Object3D
  private mixer: THREE.AnimationMixer
  private actions = new Map<ClipName, THREE.AnimationAction>()

  constructor(source: THREE.Object3D, scale: number, clips: Map<ClipName, THREE.AnimationClip>) {
    this.model = cloneSkinned(source)
    this.root.add(this.model)
    this.root.scale.setScalar(scale)
    this.mixer = new THREE.AnimationMixer(this.model)
    for (const [name, clip] of clips) {
      const action = this.mixer.clipAction(clip)
      action.setLoop(THREE.LoopRepeat, Infinity)
      action.play()
      action.setEffectiveWeight(0)
      this.actions.set(name, action)
    }
  }

  bone(name: string): THREE.Object3D {
    return this.model.getObjectByName(`mixamorig${name}`)!
  }

  apply(state: KeeperAnimState, yaw: number): void {
    this.root.position.set(state.x, state.lift, KEEPER.lineOffset)
    this.root.rotation.set(0, yaw, 0)
    const total = state.layers.reduce((s, l) => s + l.weight, 0) || 1
    for (const action of this.actions.values()) action.setEffectiveWeight(0)
    for (const layer of state.layers) {
      const action = this.actions.get(layer.clip)!
      action.setEffectiveWeight(layer.weight / total)
      // LoopRepeat envolvería un tiempo == duración al 0: se deja apenas antes
      action.time = Math.min(layer.time, action.getClip().duration - 1e-4)
    }
    this.mixer.update(0)
    this.root.updateMatrixWorld(true)
  }
}

export class MixamoKeeper {
  readonly meta = {} as ClipMetaTable
  private clips = new Map<ClipName, THREE.AnimationClip>()
  private source!: THREE.Object3D
  private scale = 1

  static async load(gltfLoader: GLTFLoader): Promise<MixamoKeeper> {
    const k = new MixamoKeeper()
    await k.init(gltfLoader)
    return k
  }

  createInstance(): KeeperInstance {
    return new KeeperInstance(this.source, this.scale, this.clips)
  }

  private async init(gltfLoader: GLTFLoader): Promise<void> {
    const gltf = await gltfLoader.loadAsync(`${BASE}keeper.glb`)
    this.source = gltf.scene
    // Sketchfab agrega sufijos a los huesos (mixamorig:Hips_00); se normalizan para que
    // coincidan con las pistas de Mixamo (mixamorigHips)
    this.source.traverse((o) => {
      o.name = o.name.replace(/_\d+$/, '')
      if ((o as THREE.Mesh).isMesh) o.frustumCulled = false // skinned: bbox de reposo
    })
    this.source.updateMatrixWorld(true)
    const head = this.source.getObjectByName('mixamorigHeadTop_End')!
    this.scale = KEEPER_HEIGHT / head.getWorldPosition(new THREE.Vector3()).y
    const restHips = this.source.getObjectByName(HIPS)!.position.clone()

    const fbx = new FBXLoader()
    const loadClip = async (file: string) => {
      const obj = await fbx.loadAsync(`${BASE}anims/${file}.fbx`)
      const fbxHipsY = obj.getObjectByName(HIPS)?.position.y ?? restHips.y
      const clip = obj.animations[0]
      const own = clip.tracks.filter((t) => this.source.getObjectByName(t.name.split('.')[0]))
      const raw = new THREE.AnimationClip(clip.name, clip.duration, own)
      return { raw, prepared: this.prepare(raw, restHips, fbxHipsY) }
    }

    const probe = this.createProbe()
    const add = async (name: ClipName, file: string, mode: 'idle' | 'step' | 'dive' | 'catchLow' | 'catchHigh') => {
      const { raw, prepared } = await loadClip(file)
      this.clips.set(name, prepared)
      this.meta[name] = probe.measure(prepared, raw, mode)
    }

    await add('idle', FILES.idle, 'idle')
    await add('catchLow', FILES.catchLow, 'catchLow')
    await add('catchMid', FILES.catchMid, 'catchHigh')
    await add('catchHigh', FILES.catchHigh, 'catchHigh')

    // pares con lado: se asignan Pos/Neg según hacia dónde se mueven de verdad
    const pair = async (files: string[], pos: ClipName, neg: ClipName, mode: 'step' | 'dive') => {
      const loaded = await Promise.all(files.map(loadClip))
      const measured = loaded.map(({ raw, prepared }) => ({ prepared, meta: probe.measure(prepared, raw, mode) }))
      const sideOf = (m: ClipMeta) => (mode === 'step' ? Math.sign(m.stepDistance) : Math.sign(m.hand.x))
      for (const { prepared, meta } of measured) {
        const name = sideOf(meta) > 0 ? pos : neg
        this.clips.set(name, prepared)
        this.meta[name] = { ...meta, stepDistance: Math.abs(meta.stepDistance) }
      }
    }
    await pair(FILES.steps, 'stepPos', 'stepNeg', 'step')
    await pair(FILES.diveMid, 'diveMidPos', 'diveMidNeg', 'dive')
    await pair(FILES.diveLow, 'diveLowPos', 'diveLowNeg', 'dive')
  }

  // Fija la cadera en XZ: el desplazamiento lo controla el cerebro del arquero. La altura de
  // cadera se reescala porque las piernas de X Bot (donde se grabó el clip) miden distinto.
  // (Las pistas de huesos que el modelo no tiene, como los dedos, ya vienen filtradas.)
  private prepare(clip: THREE.AnimationClip, restHips: THREE.Vector3, fbxHipsY: number): THREE.AnimationClip {
    const tracks = clip.tracks.map((t) => {
        if (t.name !== `${HIPS}.position`) return t
        const v = t.values.slice()
        for (let i = 0; i < v.length; i += 3) {
          v[i] = restHips.x
          v[i + 1] *= restHips.y / fbxHipsY
          v[i + 2] = restHips.z
        }
        return new THREE.VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(v))
    })
    return new THREE.AnimationClip(clip.name, clip.duration, tracks)
  }

  private createProbe() {
    const scale = this.scale
    const source = this.source
    return {
      measure(clip: THREE.AnimationClip, raw: THREE.AnimationClip, mode: string): ClipMeta {
        const model = cloneSkinned(source)
        const root = new THREE.Group()
        root.add(model)
        root.scale.setScalar(scale)
        const mixer = new THREE.AnimationMixer(model)
        const lh = model.getObjectByName('mixamorigLeftHand')!
        const rh = model.getObjectByName('mixamorigRightHand')!
        const hips = model.getObjectByName(HIPS)!
        const a = new THREE.Vector3()
        const b = new THREE.Vector3()

        // desplazamiento por ciclo (clip sin fijar) para los pasos
        let stepDistance = 0
        if (mode === 'step') {
          const action = mixer.clipAction(raw)
          action.play()
          const hipsAt = (t: number) => {
            mixer.setTime(t)
            root.updateMatrixWorld(true)
            return hips.getWorldPosition(new THREE.Vector3()).x
          }
          stepDistance = hipsAt(raw.duration - 1e-4) - hipsAt(0)
          action.stop()
          mixer.uncacheClip(raw)
        }

        const action = mixer.clipAction(clip)
        action.play()
        let best = { t: 0, x: 0, y: 0, score: -Infinity }
        const N = 120
        for (let i = 0; i <= N; i++) {
          const t = (clip.duration * i) / N
          mixer.setTime(t)
          root.updateMatrixWorld(true)
          lh.getWorldPosition(a)
          rh.getWorldPosition(b)
          const x = (a.x + b.x) / 2
          const y = (a.y + b.y) / 2
          let score = -Infinity
          if (mode === 'dive') score = Math.abs(x)
          else if (mode === 'catchHigh') score = y
          else if (mode === 'catchLow' && i < N * 0.6) score = -y
          else if (mode === 'idle' || mode === 'step') score = i === 0 ? 0 : -Infinity
          if (score > best.score) best = { t, x, y, score }
        }
        return { duration: clip.duration, reachTime: best.t, hand: { x: best.x, y: best.y }, stepDistance }
      },
    }
  }
}

// Colliders del arquero animado: cápsulas entre huesos de una instancia (la de física).
export class AnimatedKeeperColliders {
  readonly capsules: Capsule[] = COLLIDER_BONES.map(([, , radius]) => ({
    kind: 'keeper',
    a: new THREE.Vector3(),
    b: new THREE.Vector3(),
    radius,
  }))
  private bones: [THREE.Object3D, THREE.Object3D][]

  constructor(instance: KeeperInstance) {
    this.bones = COLLIDER_BONES.map(([from, to]) => [instance.bone(from), instance.bone(to)])
  }

  update(): void {
    this.bones.forEach(([from, to], i) => {
      from.getWorldPosition(this.capsules[i].a)
      to.getWorldPosition(this.capsules[i].b)
    })
  }
}

export class MixamoKeeperView {
  readonly group = new THREE.Group()
  private shadow = blobShadow(0.4, 0.35)
  private hips: THREE.Object3D

  constructor(readonly instance: KeeperInstance) {
    this.group.add(instance.root, this.shadow)
    this.hips = instance.bone('Hips')
  }

  set visible(v: boolean) {
    this.group.visible = v
  }

  apply(state: KeeperAnimState, yaw: number): void {
    this.instance.apply(state, yaw)
    const p = this.hips.getWorldPosition(new THREE.Vector3())
    this.shadow.position.set(p.x, 0.012, p.z)
    this.shadow.scale.setScalar(1 / (1 + Math.max(0, p.y - 1)))
  }
}
