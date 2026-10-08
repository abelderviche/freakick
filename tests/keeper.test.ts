import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BALL, FIXED_DT, GOAL } from '../src/config/GameConfig'
import { cloneConfig, DEFAULT_CONFIG, type PhysicsConfig } from '../src/config/PhysicsConfig'
import { BallSim } from '../src/physics/BallSim'
import { keeperFacingYaw, keeperPostX } from '../src/physics/Keeper'
import { keeperPoseAt, planKeeper, predictCrossing } from '../src/physics/KeeperBrain'
import { KeeperColliders } from '../src/physics/KeeperRig'
import { aimFromTarget } from '../src/shot/Aim'
import { calculateShot } from '../src/shot/ShotCalculator'

function setup(overrides: Partial<PhysicsConfig['keeper']> = {}) {
  const cfg = cloneConfig(DEFAULT_CONFIG)
  Object.assign(cfg.keeper, { readErrorM: 0, readErrorPerRps: 0 }, overrides)
  return cfg
}

function shoot(cfg: PhysicsConfig, from: Vector3, target: Vector3, power = 0.85, contact = { x: 0, y: 0 }, seed = 7) {
  const aim = aimFromTarget(from, target, cfg)
  const s = calculateShot({ aim, contactPoint: contact, technique: 'AUTO', foot: 'RIGHT', power, seed }, cfg)
  const plan = planKeeper(from, s.linearVelocity, s.angularVelocity, seed, cfg)
  const keeper = new KeeperColliders()
  keeper.setEnabled(true)
  const sim = new BallSim(cfg)
  sim.obstacles = keeper.capsules
  sim.updateObstacles = (t) => keeper.setPose(keeperPoseAt(plan, t, from, cfg), plan.yaw)
  sim.reset(from)
  sim.launch(s.linearVelocity, s.angularVelocity)
  const events: string[] = []
  while (sim.time < 5 && !sim.sleeping) {
    sim.step(FIXED_DT)
    events.push(...sim.events.map((e) => e.type))
    sim.events.length = 0
  }
  return { events, plan }
}

describe('keeper', () => {
  it('waits at the post on the side of the kick', () => {
    const cfg = setup()
    expect(keeperPoseAt(null, 0, new Vector3(8, BALL.radius, 20), cfg).x).toBeCloseTo(keeperPostX(1))
    expect(keeperPoseAt(null, 0, new Vector3(-8, BALL.radius, 20), cfg).x).toBeCloseTo(keeperPostX(-1))
  })

  it('predicts where the ball crosses his line', () => {
    const cfg = setup()
    const from = new Vector3(0, BALL.radius, 22)
    const aim = aimFromTarget(from, new Vector3(-2, 1.2, 0), cfg)
    const s = calculateShot({ aim, contactPoint: { x: 0, y: 0 }, technique: 'AUTO', foot: 'RIGHT', power: 0.85, seed: 1 }, cfg)
    const c = predictCrossing(from, s.linearVelocity, s.angularVelocity, cfg)!
    expect(c.x).toBeLessThan(-1.5)
    expect(c.t).toBeGreaterThan(0.5)
  })

  it('saves a central shot', () => {
    const { events, plan } = shoot(setup(), new Vector3(0, BALL.radius, 22), new Vector3(0.5, 1.2, 0))
    expect(['BLOCK', 'DIVE']).toContain(plan.action)
    expect(events).toContain('keeper')
    expect(events).not.toContain('goal')
  })

  it('dives to save a shot within reach', () => {
    // espera en el palo derecho; tiro a media altura cerca del centro-izquierda
    const { events, plan } = shoot(setup(), new Vector3(0, BALL.radius, 25), new Vector3(-0.8, 1.0, 0), 0.8)
    expect(plan.action).toBe('DIVE')
    expect(events).toContain('keeper')
  })

  it('a hard shot to the far top corner beats him', () => {
    const { events, plan } = shoot(setup(), new Vector3(0, BALL.radius, 20), new Vector3(-(GOAL.width / 2 - 0.35), 1.5, 0), 0.92)
    expect(plan.action).toBe('DIVE')
    expect(events).not.toContain('keeper')
    expect(events).toContain('goal')
  })

  it('lets a wide shot go', () => {
    const { plan } = shoot(setup(), new Vector3(0, BALL.radius, 25), new Vector3(7, 1, 0))
    expect(plan.action).toBe('WATCH')
  })

  it('the same shot and seed produce the same decision (read error included)', () => {
    const cfg = setup({ readErrorM: 0.3, readErrorPerRps: 0.1 })
    const from = new Vector3(0, BALL.radius, 25)
    const a = shoot(cfg, from, new Vector3(-1, 1.5, 0), 0.85, { x: 0.5, y: -0.2 }, 42)
    const b = shoot(cfg, from, new Vector3(-1, 1.5, 0), 0.85, { x: 0.5, y: -0.2 }, 42)
    expect(a.plan).toEqual(b.plan)
    expect(a.events).toEqual(b.events)
  })

  it('CROSS mode keeps the old behaviour: post to post', () => {
    const cfg = setup({ mode: 'CROSS' })
    const from = new Vector3(8, BALL.radius, 20)
    const { plan } = shoot(cfg, from, new Vector3(0, 1, 0))
    expect(keeperPoseAt(plan, 0, from, cfg).x).toBeCloseTo(keeperPostX(1))
    expect(keeperPoseAt(plan, 5, from, cfg).x).toBeCloseTo(keeperPostX(-1))
  })

  it('colliders follow the drawn pose: hands reach the target at full stretch', () => {
    const cfg = setup()
    const from = new Vector3(0, BALL.radius, 25)
    const { plan } = shoot(cfg, from, new Vector3(-1.2, 1.4, 0), 0.75)
    expect(plan.action).toBe('DIVE')
    const keeper = new KeeperColliders()
    keeper.setEnabled(true)
    keeper.setPose(plan.endPose, keeperFacingYaw(plan.startX, from))
    const hands = keeper.capsules.filter((c) => c.radius === 0.11).map((c) => c.a)
    const mid = hands[0].clone().add(hands[1]).multiplyScalar(0.5)
    expect(Math.hypot(mid.x - plan.perceived!.x, mid.y - plan.perceived!.y)).toBeLessThan(0.35)
  })
})
