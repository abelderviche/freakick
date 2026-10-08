import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BALL, FIXED_DT } from '../src/config/GameConfig'
import { cloneConfig, DEFAULT_CONFIG } from '../src/config/PhysicsConfig'
import { BallSim } from '../src/physics/BallSim'
import { aimFromTarget } from '../src/shot/Aim'
import { calculateShot } from '../src/shot/ShotCalculator'
import type { ShotRequest } from '../src/shot/ShotTypes'

const cfg = cloneConfig(DEFAULT_CONFIG)

function shoot(req: ShotRequest, from = new Vector3(0, BALL.radius, 25), maxTime = 6) {
  const sim = new BallSim(cfg)
  sim.reset(from)
  const s = calculateShot(req, cfg)
  sim.launch(s.linearVelocity, s.angularVelocity)
  const events: string[] = []
  const path: Vector3[] = []
  while (sim.time < maxTime && !sim.sleeping) {
    sim.step(FIXED_DT)
    for (const e of sim.events) events.push(e.type)
    sim.events.length = 0
    path.push(sim.pos.clone())
  }
  return { sim, events, path }
}

function request(partial: Partial<ShotRequest> = {}): ShotRequest {
  const aim = aimFromTarget(new Vector3(0, BALL.radius, 25), new Vector3(0, 1.4, 0), cfg)
  return { aim, contactPoint: { x: 0, y: 0 }, technique: 'INSTEP', foot: 'RIGHT', power: 0.7, seed: 1, ...partial }
}

describe('ball physics', () => {
  it('a dropped ball bounces, loses energy and comes to rest', () => {
    const sim = new BallSim(cfg)
    sim.reset(new Vector3(0, 0, 10))
    sim.pos.y = 3
    sim.sleeping = false
    let bounces = 0
    for (let i = 0; i < 240 * 10 && !sim.sleeping; i++) {
      sim.step(FIXED_DT)
      bounces += sim.events.filter((e) => e.type === 'ground').length
      sim.events.length = 0
    }
    expect(bounces).toBeGreaterThan(1)
    expect(sim.sleeping).toBe(true)
    expect(sim.pos.y).toBeCloseTo(BALL.radius, 3)
  })

  it('a straight shot at the goal center scores', () => {
    const { events } = shoot(request())
    expect(events).toContain('goal')
  })

  it('more power goes higher at the goal line', () => {
    const heightAtLine = (power: number) => {
      const { path } = shoot(request({ power }))
      const p = path.find((q) => q.z < 0)
      return p ? p.y : -1
    }
    expect(heightAtLine(0.9)).toBeGreaterThan(heightAtLine(0.6))
  })

  it('drag crisis: a fast shot loses more speed than without drag', () => {
    const { sim } = shoot(request({ power: 1 }), undefined, 0.8)
    const launch = calculateShot(request({ power: 1 }), cfg).linearVelocity.length()
    expect(sim.vel.length()).toBeLessThan(launch * 0.85)
  })

  it('is deterministic', () => {
    const a = shoot(request({ contactPoint: { x: 0.4, y: -0.5 }, technique: 'CURVE' }))
    const b = shoot(request({ contactPoint: { x: 0.4, y: -0.5 }, technique: 'CURVE' }))
    expect(a.sim.pos.toArray()).toEqual(b.sim.pos.toArray())
  })

  it('hitting the right side of the ball curves it left', () => {
    const { path } = shoot(request({ contactPoint: { x: 0.6, y: 0 }, technique: 'CURVE' }))
    const atLine = path.find((q) => q.z < 1)!
    expect(atLine.x).toBeLessThan(-0.5)
  })

  it('AUTO: inside of the foot (right side) curves left, outside (left side) curves right', () => {
    const lineX = (x: number) => shoot(request({ contactPoint: { x, y: 0 }, technique: 'AUTO', power: 0.85 })).path.find((q) => q.z < 1)!.x
    expect(lineX(0.6)).toBeLessThan(-2)
    expect(lineX(-0.6)).toBeGreaterThan(2)
    expect(Math.abs(lineX(0))).toBeLessThan(0.01)
  })

  it('backspin rises, topspin dips', () => {
    const maxH = (y: number) => Math.max(...shoot(request({ contactPoint: { x: 0, y }, technique: 'AUTO' })).path.map((q) => q.y))
    expect(maxH(-0.6)).toBeGreaterThan(maxH(0))
    expect(maxH(0.6)).toBeLessThan(maxH(0))
  })

  it('a shot into the post bounces off and never tunnels', () => {
    const from = new Vector3(0, BALL.radius, 20)
    const aim = aimFromTarget(from, new Vector3(3.72, 1.2, 0.06), cfg)
    const { events } = shoot(request({ aim, power: 1.15 }), from)
    expect(events).toContain('post')
  })

  it('the net stops a goal', () => {
    const from = new Vector3(0, BALL.radius, 25)
    const aim = aimFromTarget(from, new Vector3(0, 1.0, 0), cfg)
    const { sim, events } = shoot(request({ aim, power: 0.85 }), from, 4)
    expect(events).toContain('goal')
    expect(sim.pos.z).toBeGreaterThan(-2.7)
    expect(sim.vel.length()).toBeLessThan(3)
  })
})
