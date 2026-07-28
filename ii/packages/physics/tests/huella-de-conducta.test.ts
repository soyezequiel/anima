// ─── LA HUELLA DE CONDUCTA DE `paso()` ───────────────────────────────────────
//
// No mide tiempo: mide QUÉ HACE el motor, bit a bit, sobre un corpus ancho.
//
// ─── Para qué existe ────────────────────────────────────────────────────────
//
// `propiedades.test.ts` tiene una huella parecida, pero es del punto fijo: cruza
// máquinas y avisa si `fixed.ts` se movió. No dice NADA sobre las leyes — se
// puede reescribir `leyes.ts` entero sin moverle un bit.
//
// Ésta es la que faltaba. El tick se optimizó cinco veces (39,66 ms → 8,2 ms
// para 5000 cuerpos) tocando `qualityOf`, la lectura de las leyes y el candado de
// conservación, y la única forma honesta de saber que eso fue una OPTIMIZACIÓN y
// no una reescritura es tener un número que no se puede mover sin cambiar una
// conducta. Los 523 tests de corrección dicen que cada cosa que alguien pensó en
// preguntar sigue estando bien; esto dice que TODO LO DEMÁS también.
//
// Mezcla, para cada cuerpo del corpus y contra cada entorno, doce ticks de:
//   - el cuerpo resultante entero (partes, juntas, estado, con los bits del
//     double y no su forma decimal);
//   - QUÉ LEYES corrieron y en qué orden;
//   - las sustancias que la ley 4 dio de alta, con su `perUnitMass` completo;
//   - y al final las 29 cualidades leídas, derivadas incluidas.
//
// ─── Si este número cambia ──────────────────────────────────────────────────
//
// Cambió una conducta. Puede estar bien —una ley recalibrada, una constante que
// se movió con su porqué— pero entonces se actualiza A MANO y se dice en el
// commit cuál fue el cambio y por qué. Lo que no puede pasar es que se mueva
// solo, en una tarea que decía «no cambio ninguna conducta».

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  CELDA_TAPADA,
  conSustancia,
  paso,
  qualityOf,
  QUALITY_IDS,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
} from '../src/index.js'
import { HZ_DE_REFERENCIA, dtDeFrecuencia } from '../src/fixed.js'
import type { Body, Entorno, FormId, Montaje, Physics, QualityVector } from '../src/index.js'

/**
 * El paso de tiempo de los tests de este archivo: la frecuencia de referencia
 * del ADR II-0007. Las leyes son por segundo y `dt` dice con qué finura se las
 * muestrea; a otra frecuencia estos mismos tests miden otra trayectoria, y eso
 * es correcto (ADR II-0008).
 */
const DT = dtDeFrecuencia(HZ_DE_REFERENCIA)

const FORMAS: readonly FormId[] = ['vara', 'hebra', 'filete', 'malla', 'bloque', 'grano']
const MONTAJES_T: readonly Montaje[] = ['piso', 'parrilla', 'contacto']
const IDS = SUSTANCIAS_SEMILLA.map((s) => s.id)

function lcg(semilla: number): () => number {
  let s = semilla >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s >>> 0
  }
}

class Huella {
  valor = 2166136261
  byte(x: number): void {
    this.valor = Math.imul(this.valor ^ (x & 255), 16777619) >>> 0
  }
  s(x: string): void {
    for (let i = 0; i < x.length; i++) this.byte(x.charCodeAt(i))
    this.byte(0)
  }
  n(x: number): void {
    // Los BITS del double, no su forma decimal: dos números que difieren en el
    // último bit tienen que dar huellas distintas o esto no mide nada.
    const b = new DataView(new ArrayBuffer(8))
    b.setFloat64(0, x)
    for (let i = 0; i < 8; i++) this.byte(b.getUint8(i))
  }
  v(q: QualityVector): void {
    for (const k of Object.keys(q).sort()) {
      this.s(k)
      this.n(q[k as keyof QualityVector] ?? 0)
    }
  }
  cuerpo(b: Body): void {
    this.s(b.id)
    this.s(b.form)
    for (const p of b.parts) {
      this.s(p.substance)
      this.n(p.mass)
      this.v(p.q)
    }
    for (const j of b.joints) {
      this.n(j.a)
      this.n(j.b)
      this.s(j.via)
      this.n(j.strength)
    }
    this.v(b.state)
  }
}

/** Un corpus ancho y reproducible: una parte, dos partes, tres con juntas. */
function corpus(): Body[] {
  const r = lcg(20260727)
  const out: Body[] = []
  for (let i = 0; i < 240; i++) {
    const nPartes = 1 + (r() % 3)
    const parts = []
    for (let k = 0; k < nPartes; k++) {
      const sid = IDS[r() % IDS.length] as string
      const masa = 0.05 + (r() % 400) / 100
      const q: QualityVector = {}
      // A veces la parte pisa su propia cualidad, que es un camino distinto de
      // `partQuality` y hay que recorrerlo.
      if (r() % 4 === 0) q.moisture = (r() % 100) / 100
      if (r() % 5 === 0) q.mass = 0.01 + (r() % 300) / 100
      if (r() % 7 === 0) q.sharpness = (r() % 100) / 100
      parts.push({ substance: sid, mass: masa, q })
    }
    const joints = []
    for (let k = 1; k < parts.length; k++) {
      joints.push({ a: 0, b: k, via: IDS[r() % IDS.length] as string, strength: (r() % 100) / 100 })
    }
    const state: QualityVector = {}
    // Temperaturas a lo ancho de todo el rango útil: frío, ventana de cocción,
    // pirólisis, ignición y muy por encima.
    state.temperature = -20 + (r() % 900)
    if (r() % 3 === 0) state.moisture = (r() % 100) / 100
    if (r() % 4 === 0) state.charred = (r() % 100) / 100
    if (r() % 5 === 0) state.decay = (r() % 100) / 100
    if (r() % 6 === 0) state.digestibility = (r() % 100) / 100
    if (r() % 7 === 0) state.toxicity = (r() % 100) / 100
    // `state.mass` escrita a nivel cuerpo: el camino de `normalizarMasa`.
    if (r() % 8 === 0) state.mass = 0.1 + (r() % 500) / 100
    out.push({
      id: `x${String(i).padStart(4, '0')}`,
      form: FORMAS[r() % FORMAS.length] as FormId,
      parts,
      joints,
      state,
    })
  }
  return out
}

function entornos(): Entorno[] {
  const out: Entorno[] = []
  for (const celda of [
    { oxygen: 1, wet: 0, ambiente: T_AMBIENTE },
    CELDA_TAPADA,
    { oxygen: 0.4, wet: 0.9, ambiente: 30 },
    { oxygen: 0.02, wet: 0.2, ambiente: -5 },
  ]) {
    out.push({ celda })
    for (const montaje of MONTAJES_T) {
      out.push({ celda, fuente: { potencia: 300, distancia: 0.5, montaje } })
      out.push({ celda, fuente: { potencia: 900, distancia: 0, montaje } })
    }
  }
  return out
}

/**
 * La huella entera: cada cuerpo del corpus, contra cada entorno, doce ticks.
 * Se mezcla el cuerpo resultante, las leyes que corrieron y las sustancias que
 * la ley 4 dio de alta — o sea, todo lo observable de `paso()`.
 */
function huellaDeConducta(): { huella: number; pasos: number; leyes: number; nuevas: number } {
  const h = new Huella()
  const base = buildSeedPhysics()
  let pasos = 0
  let leyes = 0
  let nuevas = 0
  const es = entornos()
  const cs = corpus()
  for (let i = 0; i < cs.length; i++) {
    const e = es[i % es.length] as Entorno
    let b = cs[i] as Body
    let phys: Physics = base
    for (let t = 0; t < 12; t++) {
      const r = paso(b, e, phys, DT)
      pasos++
      h.cuerpo(r.body)
      for (const id of r.leyes) {
        h.s(id)
        leyes++
      }
      if (r.nueva !== undefined) {
        nuevas++
        h.s(r.nueva.id)
        h.s(r.nueva.lexeme.nombre)
        h.s(r.nueva.lexeme.genero)
        for (const t2 of r.nueva.tags) h.s(t2)
        h.v(r.nueva.perUnitMass)
        h.n(r.nueva.specificHeat)
        phys = conSustancia(phys, r.nueva)
      }
      b = r.body
    }
    // Y todas las cualidades leídas al final, derivadas incluidas: si `qualityOf`
    // cambiara de resultado, esto lo ve aunque las leyes no lo escriban.
    for (const q of QUALITY_IDS) h.n(qualityOf(b, q, phys))
  }
  return { huella: h.valor, pasos, leyes, nuevas }
}

describe('la huella de conducta de paso()', () => {
  it('el corpus toca las seis leyes, y la transmutación de verdad', () => {
    // Una huella sobre un corpus que no ejercita nada no protege nada. Esto es lo
    // que hace que el número de abajo signifique algo: si mañana alguien angosta
    // el corpus para «arreglar» la huella, esto se cae primero.
    const r = huellaDeConducta()
    expect(r.pasos).toBe(2880)
    expect(r.leyes).toBeGreaterThan(6000)
    expect(r.nuevas).toBeGreaterThan(0)
  }, 300_000)

  it('la huella no se movió', () => {
    // 3705094564 → 3792335722 con el ADR II-0011, y cambió TRES conductas a la
    // vez, todas queridas y todas medidas en sus propios tests:
    //
    //   · la ley 1 se integra en forma cerrada —cierra `1 − e^(−r·dt)` del hueco
    //     y no `r·dt`—, así que toda relajación térmica escribe otros bits;
    //   · la ley 3 escribe `temperature`: arder libera calor, que antes no;
    //   · y su tasa de carbonización pasó de 0,2 a 0,016 por segundo, así que en
    //     doce ticks el corpus carboniza mucho menos y la ley 4 transmuta menos.
    //
    // 2564253564 → 1196749445 con la reparación de las dos constantes que se
    // cancelaban, y cambió DOS conductas, las dos queridas y las dos medidas en
    // `la-masa-decide-lo-que-arde.test.ts`:
    //
    //   · `charred` avanza por la MÁS ADELANTADA de dos cuentas y no por un reloj
    //     único: el calor por segundo y POR KILO —`TASA_CARBONIZACION` es
    //     extensiva ahora, como `COMBUSTIBLE_POR_SEGUNDO` lo era desde el ADR
    //     II-0011— y la fracción de combustible que la llama ya se llevó. En doce
    //     ticks eso mueve `charred`, y con él `nutrition`, `digestibility` y
    //     cuándo transmuta la ley 4;
    //   · la ley 4 ya no tira el estado que la sustancia nueva no sabe contestar,
    //     así que el cuerpo transmutado sale con `stamina` —y con lo que el modelo
    //     invente mañana— en vez de con `{ temperature }` pelado.
    //
    // Se actualiza A MANO y con el porqué al lado, que es exactamente lo que este
    // archivo pide en su encabezado.
    expect(huellaDeConducta().huella).toBe(1196749445)
  }, 300_000)
})
