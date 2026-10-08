import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { BALL, FIXED_DT, GOAL } from '../src/config/GameConfig'
import { cloneConfig, DEFAULT_CONFIG } from '../src/config/PhysicsConfig'
import { BallSim } from '../src/physics/BallSim'
import { computeWallLayout, WallColliders, wallJumpHeight } from '../src/physics/WallLayout'
import { aimFromTarget } from '../src/shot/Aim'
import { calculateShot } from '../src/shot/ShotCalculator'

const cfg = cloneConfig(DEFAULT_CONFIG)
const FROM = new Vector3(0, BALL.radius, 25)

function shootAtWall(target: Vector3, contact = { x: 0, y: 0 }, power = 0.85) {
  const sim = new BallSim(cfg)
  const wall = new WallColliders()
  wall.setLayout(computeWallLayout(FROM, cfg))
  sim.obstacles = wall.capsules
  sim.updateObstacles = (t) => wall.setJump(wallJumpHeight(t, cfg))
  sim.reset(FROM)
  const aim = aimFromTarget(FROM, target, cfg)
  const s = calculateShot({ aim, contactPoint: contact, technique: 'AUTO', foot: 'RIGHT', power, seed: 1 }, cfg)
  sim.launch(s.linearVelocity, s.angularVelocity)
  const events: string[] = []
  while (sim.time < 5 && !sim.sleeping) {
    sim.step(FIXED_DT)
    events.push(...sim.events.map((e) => e.type))
    sim.events.length = 0
  }
  return events
}

describe('wall', () => {
  it('stands 9.15 m from the ball, with 4 players at 25 m', () => {
    const layout = computeWallLayout(FROM, cfg)
    expect(layout.players).toHaveLength(4)
    const center = layout.players.reduce((a, p) => a.add(p), new Vector3()).multiplyScalar(1 / 4)
    expect(center.distanceTo(new Vector3(FROM.x, 0, FROM.z))).toBeCloseTo(9.15, 2)
  })

  it('jumps and lands', () => {
    expect(wallJumpHeight(0, cfg)).toBe(0)
    expect(wallJumpHeight(cfg.wall.jumpDelaySec + cfg.wall.jumpDurationSec / 2, cfg)).toBeCloseTo(cfg.wall.jumpHeight)
    expect(wallJumpHeight(2, cfg)).toBe(0)
  })

  it('blocks a low straight shot', () => {
    const events = shootAtWall(new Vector3(0, 0.8, 0))
    expect(events).toContain('wall')
    expect(events).not.toContain('goal')
  })

  it('a curled shot from inside of the foot goes around it', () => {
    // apuntar afuera del palo derecho y dejar que el interior la meta
    const events = shootAtWall(new Vector3(GOAL.width / 2 + 2.2, 1.6, 0), { x: 0.6, y: -0.2 }, 0.9)
    expect(events).not.toContain('wall')
    expect(events).toContain('goal')
  })
})
