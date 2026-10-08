import type { ShotOutcome } from '../shot/ShotTypes'

const BANNER_TEXT: Record<ShotOutcome, string> = {
  GOAL: 'GOAL!',
  SAVED: 'SAVED!',
  POST: 'POST!',
  BAR: 'CROSSBAR!',
  WALL: 'BLOCKED!',
  WIDE: 'WIDE',
  OVER: 'OVER',
  SHORT: 'SHORT',
}

export type ShotPhase = 'AIM' | 'CONTACT' | 'POWER'

const STEPS: { phase: ShotPhase; label: string; hint: string }[] = [
  { phase: 'AIM', label: 'APUNTAR', hint: 'MOUSE: DIRECCIÓN · CLICK: CONFIRMAR' },
  { phase: 'CONTACT', label: 'CONTACTO', hint: 'MOUSE: DÓNDE LE PEGÁS · CLICK: CONFIRMAR · ESC: VOLVER' },
  { phase: 'POWER', label: 'POTENCIA', hint: 'MANTENÉ CLICK Y SOLTÁ · ESC: VOLVER' },
]

export interface TelemetryData {
  shot: number
  technique: string
  foot: string
  power: number
  contact: { x: number; y: number }
  launchKmh: number
  launchAngleDeg: number
  spinRps: number
  lineKmh: number | null
  flightTime: number | null
  distance: number
  maxHeight: number
  curve: number
  liveKmh: number
  keeper: string
  result: string
}

export class Hud {
  private root: HTMLElement
  private steps: HTMLElement
  private stepEls: HTMLElement[] = []
  private stepHint: HTMLElement
  private contactGuide: HTMLElement
  private contactReticle: HTMLElement
  private contactHint: HTMLElement
  private mini: HTMLElement
  private miniDot: HTMLElement
  private miniLabel: HTMLElement
  private power: HTMLElement
  private powerFill: HTMLElement
  private powerLabel: HTMLElement
  private telemetry: HTMLElement
  private banner: HTMLElement
  private bannerSub: HTMLElement
  private bannerTimer = 0

  constructor(parent: HTMLElement) {
    this.root = el('div', 'hud', parent)

    this.steps = el('div', 'steps', this.root)
    const row = el('div', 'steps-row', this.steps)
    STEPS.forEach((s, i) => {
      const e = el('div', 'step', row)
      e.innerHTML = `<span class="step-n">${i + 1}</span>${s.label}`
      this.stepEls.push(e)
    })
    this.stepHint = el('div', 'step-hint', this.steps)

    this.contactGuide = el('div', 'contact-guide', this.root)
    this.contactGuide.innerHTML =
      '<div class="cg-h"></div><div class="cg-v"></div><div class="cg-ring"></div>' +
      '<span class="cg-l">EXT</span><span class="cg-r">INT</span>' +
      '<span class="cg-t">TOP</span><span class="cg-b">BACK</span>'
    this.contactReticle = el('div', 'contact-reticle', this.root)
    this.contactHint = el('div', 'contact-hint', this.root)

    this.mini = el('div', 'contact-mini', this.root)
    const miniBall = el('div', 'mini-ball', this.mini)
    el('div', 'mini-cross', miniBall)
    this.miniDot = el('div', 'mini-dot', miniBall)
    this.miniLabel = el('div', 'mini-label', this.mini)

    this.power = el('div', 'power', this.root)
    el('div', 'power-title', this.power).textContent = 'POWER'
    const bar = el('div', 'power-bar', this.power)
    this.powerFill = el('div', 'power-fill', bar)
    el('div', 'power-mark', bar)
    this.powerLabel = el('div', 'power-label', this.power)

    this.telemetry = el('pre', 'telemetry', this.root)

    const bannerWrap = el('div', 'banner-wrap', this.root)
    this.banner = el('div', 'banner', bannerWrap)
    this.bannerSub = el('div', 'banner-sub', bannerWrap)

    const help = el('div', 'help', this.root)
    help.innerHTML = ['R RESET · P REPEAT', 'T TRAIL · I DATA', 'B WALL · K KEEPER', 'G PANEL'].join('<br>')

    const credits = el('div', 'credits', this.root)
    credits.innerHTML =
      'Models (CC-BY 4.0): "Soccer Ball" by keatura · "Tribune" by liftybones · ' +
      '"Adidas Predator Precision" by neurodriguez · "Character_Male_GreenJacket" by Wardster — Sketchfab · ' +
      'animations: Mixamo'
  }

  // null = no hay tiro en preparación (pelota en vuelo / resultado)
  setPhase(phase: ShotPhase | null): void {
    this.steps.style.visibility = phase ? 'visible' : 'hidden'
    STEPS.forEach((s, i) => this.stepEls[i].classList.toggle('active', s.phase === phase))
    this.stepHint.textContent = STEPS.find((s) => s.phase === phase)?.hint ?? ''
    this.power.style.visibility = phase === 'POWER' ? 'visible' : 'hidden'
    this.mini.style.visibility = phase && phase !== 'CONTACT' ? 'visible' : 'hidden'
    const showContact = phase === 'CONTACT'
    this.contactGuide.style.display = showContact ? 'block' : 'none'
    this.contactReticle.style.display = showContact ? 'block' : 'none'
    this.contactHint.style.display = showContact ? 'block' : 'none'
  }

  // guía sobre la pelota en pantalla: centro (x, y) y radio r en px
  setContactGuide(x: number, y: number, r: number): void {
    const g = this.contactGuide.style
    g.left = `${x - r}px`
    g.top = `${y - r}px`
    g.width = g.height = `${2 * r}px`
    const h = this.contactHint.style
    h.left = `${x}px`
    h.top = `${y + r + 44}px`
  }

  setContactReticle(x: number, y: number): void {
    this.contactReticle.style.transform = `translate(${x}px, ${y}px)`
  }

  setContactInfo(contact: { x: number; y: number }, lines: string[]): void {
    this.contactHint.innerHTML = lines.map((l, i) => `<div class="${i === 0 ? 'ch-title' : ''}">${l}</div>`).join('')
    this.miniDot.style.left = `${50 + contact.x * 50}%`
    this.miniDot.style.top = `${50 - contact.y * 50}%`
    this.miniLabel.textContent = lines.slice(0, 2).join(' · ')
  }

  setPower(value: number, max: number): void {
    const pct = Math.min(value, max) / max
    this.powerFill.style.width = `${pct * 100}%`
    this.powerFill.classList.toggle('over', value > 1)
    this.powerLabel.textContent = `${Math.round(value * 100)}%`
  }

  showResult(outcome: ShotOutcome, sub: string): void {
    this.banner.textContent = BANNER_TEXT[outcome]
    this.banner.className = `banner show ${outcome === 'GOAL' ? 'goal' : 'miss'}`
    this.bannerSub.textContent = sub
    this.bannerSub.className = 'banner-sub show'
    this.bannerTimer = outcome === 'GOAL' ? 1.1 : 0.9
  }

  clearResult(): void {
    this.bannerTimer = 0
    this.banner.className = 'banner'
    this.bannerSub.className = 'banner-sub'
  }

  update(dt: number): void {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt
      if (this.bannerTimer <= 0) this.clearResult()
    }
  }

  setTelemetry(t: TelemetryData | null): void {
    if (!t) {
      this.telemetry.textContent = ''
      return
    }
    const f = (v: number | null, digits: number, unit: string) => (v === null ? '—' : `${v.toFixed(digits)} ${unit}`)
    const curveDir = Math.abs(t.curve) < 0.05 ? '' : t.curve < 0 ? ' ←' : ' →'
    this.telemetry.textContent = [
      `SHOT #${t.shot}       ${t.technique} · ${t.foot}`,
      `Power        ${Math.round(t.power * 100)}%`,
      `Contact      ${t.contact.x.toFixed(2)}, ${t.contact.y.toFixed(2)}`,
      `Speed        ${f(t.launchKmh, 0, 'km/h')}`,
      `Spin         ${f(t.spinRps, 1, 'rev/s')}`,
      `Launch       ${f(t.launchAngleDeg, 1, '°')}`,
      `At line      ${f(t.lineKmh, 0, 'km/h')}`,
      `Now          ${f(t.liveKmh, 0, 'km/h')}`,
      `Distance     ${f(t.distance, 1, 'm')}`,
      `Max height   ${f(t.maxHeight, 2, 'm')}`,
      `Curve        ${f(Math.abs(t.curve), 2, 'm')}${curveDir}`,
      `Flight       ${f(t.flightTime, 2, 's')}`,
      `Keeper       ${t.keeper}`,
      `Result       ${t.result}`,
    ].join('\n')
  }

  toggleTelemetry(): void {
    this.telemetry.classList.toggle('hidden')
  }
}

function el(tag: string, cls: string, parent: HTMLElement): HTMLElement {
  const e = document.createElement(tag)
  e.className = cls
  parent.appendChild(e)
  return e
}
