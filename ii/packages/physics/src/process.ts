// ─── @anima/physics/process.ts ───────────────────────────────────────────────
//
// Las doce leyes NO son doce procesos. Solo CUATRO son aplicables por la
// criatura —`friccion`, `union`, `deshilachar`, `extraccion`—, y son las cuatro
// que traen `roles`, `arrangement` y `effects`. Las otras ocho corren solas: la
// criatura las PROVOCA colocando las cosas, no las invoca.
//
// Ver ADR II-0001: encender no es una acción, es una consecuencia. `combustion`
// no está acá y no va a estar. La criatura puede subir la temperatura (friccion,
// que le cuesta stamina); que el cuerpo PRENDA lo decide la ley 3.
//
// Este archivo es datos. La puerta que los admite —`admit()`, con conservación,
// «nada sube gratis», envolventes por tag y ciclos rentables— vive en el paquete
// de proceso, no acá: mezclar el catálogo con su juez hace que el juez no se
// pueda correr sobre catálogos que todavía no existen.

import type { Duracion } from './fixed.js'
import { seg } from './fixed.js'
import type { QualityId } from './quality.js'

// ─── Versión de la física ────────────────────────────────────────────────────
//
// Vive acá y no en `physics.ts` porque su único consumidor es el campo
// `physicsVersion` de `Process`, que es lo que invalida los sellos cuando se
// recalibra. Una segunda copia en otro archivo es exactamente el bug de
// `DSL_REFERENCE` de Ánima I: dos números mantenidos a mano que divergen.
export const PHYSICS_VERSION = 1

export type ProcessId = string
export type Commitment = 'reversible' | 'costly' | 'irreversible'

export interface QualityTest {
  q: QualityId
  op: '>=' | '<=' | '>' | '<'
  v: number
}

export interface Role {
  name: string
  where: readonly QualityTest[]
}

/**
 * Un efecto de proceso. `porSegundo` es una tasa POR SEGUNDO DE MUNDO, no por
 * tick (ADR II-0008).
 *
 * El tick no aparece en ningún lado de este archivo, y ésa es toda la decisión:
 * mientras las tasas fueran por tick, mover la frecuencia movía el ritmo del
 * juego —de 30 a 20 Hz, cocinar el cuero pasaba de 40 a 60 segundos de reloj— y
 * las dos perillas del ADR II-0007 eran una sola con dos nombres. Quien aplica el
 * efecto sabe su `dt` y hace la conversión en un solo lugar (`porPaso`).
 */
export type Effect =
  | { k: 'drain'; q: QualityId; on: string; porSegundo: number }
  | {
      k: 'drive'
      q: QualityId
      on: string
      toward: number
      porSegundo: number
      poweredBy?: { from: string; q: QualityId; efficiency: number }
    }
  | { k: 'transfer'; q: QualityId; from: string; to: string; porSegundo: number }
  | {
      k: 'couple'
      q: QualityId
      on: string
      follows: { q: QualityId; of: string; inverse?: boolean }
    }

export type Yield =
  | { k: 'transmute'; role: string }
  | { k: 'join'; a: string; b?: string; via: string }
  | { k: 'split'; role: string; at: 'joint' | 'grain' }
  | { k: 'drawFromStock'; of: string; into: 'hands' | 'ground-adjacent' }

export interface Process {
  id: ProcessId
  lexeme: { nombre: string }
  roles: readonly Role[]
  arrangement:
    | { k: 'contact' }
    | { k: 'within'; radius: number }
    | { k: 'held' }
    | { k: 'supported' }
    | { k: 'inside' }
  gate: readonly QualityTest[]
  effects: readonly Effect[]
  /**
   * `at` es una DURACIÓN EN SEGUNDOS de mundo, no un conteo de ticks
   * (ADR II-0008). Atar tarda un segundo a 20 Hz, a 25 Hz y a 100 Hz; lo único
   * que cambia con la frecuencia es en cuántas muestras se parte ese segundo.
   */
  completion?: { at: Duracion; yields: readonly Yield[] }
  establishes: readonly string[]
  commitment: Commitment
  trust: 'borrador' | 'provisional' | 'estable'
  physicsVersion: number
  provenance: { by: 'semilla' | 'modelo' }
}

// ─── Roles opcionales ────────────────────────────────────────────────────────
//
// `Role` no tiene campo `optional`, y no se lo agrego porque el contrato de
// tipos es compartido con otros dos paquetes. La opcionalidad se marca en el
// NOMBRE, con un sufijo `?`, y hay dos razones para que sea así y no una tabla
// aparte de «roles opcionales por proceso»:
//
//   - viaja con el dato: un `Process` que el modelo escriba mañana declara su
//     rol opcional sin que nadie tenga que actualizar una segunda lista;
//   - `Yield` ya distingue el caso (`join.b` es opcional), así que el nombre y
//     el rendimiento dicen lo mismo y se pueden cruzar.

const OPTIONAL_SUFFIX = '?'

/** `'b?'` es opcional; `'b'` no. */
export function isOptionalRole(name: string): boolean {
  return name.endsWith(OPTIONAL_SUFFIX)
}

/** `'b?'` → `'b'`. Para cualquier otro nombre, el nombre. */
export function baseRoleName(name: string): string {
  return isOptionalRole(name) ? name.slice(0, -OPTIONAL_SUFFIX.length) : name
}

/**
 * Los nombres de rol que efectos y rendimientos mencionan pero el proceso no
 * declara. Debe ser vacío: un efecto que apunta a un rol inexistente no falla,
 * simplemente no hace nada, y ésa es la clase de bug que se descubre porque la
 * criatura frota una hora y no se calienta.
 */
export function unknownRoleRefs(p: Process): readonly string[] {
  const declared = new Set<string>(p.roles.map((r) => r.name))
  const missing: string[] = []
  const check = (name: string | undefined): void => {
    if (name === undefined) return
    if (declared.has(name)) return
    if (missing.includes(name)) return
    missing.push(name)
  }
  for (const e of p.effects) {
    switch (e.k) {
      case 'drain':
        check(e.on)
        break
      case 'drive':
        check(e.on)
        check(e.poweredBy?.from)
        break
      case 'transfer':
        check(e.from)
        check(e.to)
        break
      case 'couple':
        check(e.on)
        check(e.follows.of)
        break
    }
  }
  for (const y of p.completion?.yields ?? []) {
    switch (y.k) {
      case 'transmute':
        check(y.role)
        break
      case 'join':
        check(y.a)
        check(y.b)
        check(y.via)
        break
      case 'split':
        check(y.role)
        break
      case 'drawFromStock':
        check(y.of)
        break
    }
  }
  return missing
}

// ─── Los cuatro procesos aplicables ──────────────────────────────────────────

/**
 * Ley 2 — la única fuente primordial de calor del mundo.
 *
 * Sin esto el primer fuego de la partida es imposible, porque un mundo decretado
 * por ruido no tiene nada caliente. Y cuesta: TRES SEGUNDOS llevan la madera de
 * 15 a 375 °C —120 grados por segundo—. Los tres segundos son tres segundos a
 * cualquier frecuencia; antes eran «60 ticks», que son 2 s a 30 Hz y 3 s a 20 Hz.
 *
 * ─── LO QUE CUESTA, Y ES POR MASA (ADR II-0010) ─────────────────────────────
 *
 * Este comentario decía «y se comen 48 de `stamina`», y ese número no es
 * reproducible: el precio es `heatCapacity × ΔT / 0,35` y `heatCapacity` es
 * EXTENSIVA, así que 48 alcanzan para 27,5 gramos de madera. Los tres segundos
 * cuestan **352,71** para una vara de 0,2 kg, **964,71** para una de 0,55 y
 * **1748,57** para una de 1 kg — y `stamina` topa en 1000, o sea que la de 1 kg
 * no se puede encender. Con hambre y poca energía, no puede: ésa es la distancia
 * entre querer y poder, hecha aritmética. Y de ahí sale, sin que nadie lo
 * escriba, que **se enciende con yesca y no con leños**. Medido en
 * `world/tests/el-fuego.test.ts`.
 *
 * Los tres segundos, además, no eran ciertos hasta el ADR II-0010: la ley 1
 * relajaba la temperatura en el mismo tick y las dos se estancaban en 29,4 °C
 * para esta misma vara. Mientras un `drive` está activo, ninguna ley que relaje
 * esa cualidad la mueve en contra.
 *
 * La eficiencia 0.35 es lo que hace que no sea una máquina de movimiento
 * perpetuo: sale menos calor del que entra en trabajo.
 */
export const FRICCION: Process = {
  id: 'friccion',
  lexeme: { nombre: 'frotar' },
  roles: [
    { name: 'a', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'b', where: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 1 }] },
  ],
  arrangement: { k: 'held' },
  gate: [],
  effects: [
    {
      k: 'drive',
      q: 'temperature',
      on: 'a',
      toward: 400,
      porSegundo: 120,
      poweredBy: { from: 'actor', q: 'stamina', efficiency: 0.35 },
    },
  ],
  establishes: ['temperature>=400'],
  commitment: 'reversible',
  trust: 'estable',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'semilla' },
}

/**
 * Ley 7 — la ley que hace la caña, sin que nadie escriba «caña».
 *
 * El rol `b?` es OPCIONAL, y no es un detalle de comodidad: es la caña entera.
 *
 *   - Con `b`: el atador se gasta en la atadura (queda como `Joint.via`) y salen
 *     dos cuerpos unidos y firmes. Eso es el trípode.
 *   - Sin `b`: el atador sobrevive como PARTE, atado de un solo lado, y le queda
 *     una punta suelta. Esa punta suelta es `freeStrandEnds`, y `freeStrandEnds`
 *     es lo único que da `catch`. O sea: sin rol opcional no hay punta libre,
 *     sin punta libre no hay `catch`, y sin `catch` la caña no califica para
 *     `extraccion`. Con `b` obligatorio, pescar es imposible.
 *
 * Califica cualquier cosa larga con una hebra flexible colgando: un palo con una
 * liana, un hueso con un tendón. Nadie escribió el objeto.
 */
export const UNION: Process = {
  id: 'union',
  lexeme: { nombre: 'atar' },
  roles: [
    {
      name: 'binder',
      where: [
        { q: 'flexibility', op: '>=', v: 0.8 },
        { q: 'tensile', op: '>=', v: 0.3 },
      ],
    },
    { name: 'a', where: [] },
    { name: 'b?', where: [] },
  ],
  arrangement: { k: 'held' },
  gate: [],
  effects: [],
  completion: { at: seg(1), yields: [{ k: 'join', a: 'a', b: 'b?', via: 'binder' }] },
  establishes: ['freeStrandEnds>=1', 'reach>=2'],
  commitment: 'reversible',
  trust: 'estable',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'semilla' },
}

/**
 * De dónde sale el hilo, que es lo que ninguna propuesta explicaba.
 *
 * El rol `source` pide `tensile >= 0.3` y no un tag `fibroso`, porque `Role.where`
 * solo sabe de cualidades. No es un parche: lo que hace deshilachable a algo es
 * que aguante tracción a lo largo del grano, y eso es `tensile`. Sirve el
 * matorral, la corteza, el tendón, la liana — y sirve lo que el oráculo invente
 * mañana, sin fila propia.
 */
export const DESHILACHAR: Process = {
  id: 'deshilachar',
  lexeme: { nombre: 'deshilachar' },
  roles: [
    { name: 'source', where: [{ q: 'tensile', op: '>=', v: 0.3 }] },
    { name: 'actor', where: [{ q: 'stamina', op: '>=', v: 3 }] },
  ],
  arrangement: { k: 'held' },
  gate: [],
  effects: [{ k: 'drain', q: 'stamina', on: 'actor', porSegundo: 2 }],
  completion: { at: seg(2), yields: [{ k: 'split', role: 'source', at: 'grain' }] },
  establishes: ['flexibility>=0.8', 'tensile>=0.3'],
  commitment: 'costly',
  trust: 'estable',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'semilla' },
}

/**
 * Ley 9 — pescar, y cualquier otra cosa que se saque de un stock del dios.
 *
 * A mano no califica: `reach` de una mano es 0 y el rol pide 2. Con caña sí. Con
 * lanza también (`reach` + `sharpness` suben `catch` por otro lado). Y el río se
 * agota: el stock baja y se repone a la tasa del bioma. La criatura no le puede
 * pedir comida infinita al mundo.
 */
export const EXTRACCION: Process = {
  id: 'extraccion',
  lexeme: { nombre: 'sacar' },
  roles: [
    {
      name: 'gear',
      where: [
        { q: 'reach', op: '>=', v: 2 },
        { q: 'catch', op: '>', v: 0 },
      ],
    },
    // `mass > 0` es el stock que queda. El documento escribe `stock > 0`, pero
    // `stock` no está en el catálogo de cualidades y `QualityTest.q` es un
    // `QualityId`: el catálogo es cerrado a propósito y no se abre por una
    // comodidad. Un banco de peces es un cuerpo con masa, y cuando se lo
    // vaciaron la masa es cero. Queda anotado como hueco del contrato.
    { name: 'source', where: [{ q: 'mass', op: '>', v: 0 }] },
  ],
  arrangement: { k: 'within', radius: 1 },
  gate: [],
  effects: [],
  completion: { at: seg(1.5), yields: [{ k: 'drawFromStock', of: 'source', into: 'hands' }] },
  establishes: ['holding(tag:carnoso)'],
  commitment: 'costly',
  trust: 'estable',
  physicsVersion: PHYSICS_VERSION,
  provenance: { by: 'semilla' },
}

/**
 * Los cuatro, en orden fijo. El orden importa: el mundo los recorre en este
 * orden para resolver empates, y un `Object.values` sobre un mapa daría un orden
 * que depende de cómo se construyó.
 */
export const SEED_PROCESSES: readonly Process[] = [FRICCION, UNION, DESHILACHAR, EXTRACCION]
