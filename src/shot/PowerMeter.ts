import type { PhysicsConfig } from '../config/PhysicsConfig'

// Mantener para cargar (ease-in), soltar para patear. Pasado el 100% entra en sobrecarga;
// al llegar al máximo de sobrecarga patea solo. Usa tiempo real (no el dt del frame) porque
// es un input de timing: un frame lento no puede cambiar la potencia.
export class PowerMeter {
  value = 0
  charging = false
  private startMs = 0

  constructor(private cfg: PhysicsConfig) {}

  start(): void {
    this.charging = true
    this.startMs = performance.now()
    this.value = 0
  }

  // devuelve true cuando se llegó al tope y hay que patear
  update(): boolean {
    if (!this.charging) return false
    const t = (performance.now() - this.startMs) / 1000
    const p = this.cfg.power
    this.value = Math.pow(t / p.chargeTimeSec, p.chargeEaseExp)
    if (this.value >= p.overchargeMax) {
      this.value = p.overchargeMax
      return true
    }
    return false
  }

  stop(): number {
    this.update()
    this.charging = false
    return this.value
  }

  reset(): void {
    this.charging = false
    this.value = 0
  }
}
