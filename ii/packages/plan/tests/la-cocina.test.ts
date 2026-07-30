// ─── LA CADENA DE COCINAR, PEDIDA A `plan()` ─────────────────────────────────
//
//   pnpm --filter @anima/plan test
//
// EL CRITERIO DEL TRAMO, ESCRITO ANTES DE IMPLEMENTAR: `plan()` sobre una meta
// como «tener en la mano algo carnoso con `toxicity <= 0,2`» tiene que devolver
// una cadena que incluya conseguir fuego, poner la comida a tiro y esperar.
//
// Y el punto de partida era que NO SE PODÍA PEDIR, por dos motivos encadenados y
// los dos de tipos, no de física:
//
//   1. `Predicado.sostiene` sólo sabía de TAGS, así que «algo carnoso» se podía
//      escribir y «algo carnoso que no envenene» no. Desde el ADR II-0013 el mundo
//      cobra `toxicity × masa` de `stamina` al tragar, o sea que la diferencia
//      entre las dos metas es la diferencia entre comer y adelgazar comiendo.
//   2. `ConstructionSchema.via` era un `ProcessId`, y COCINAR NO ES UN PROCESO:
//      lo hace la ley 5 sobre todo cuerpo orgánico que esté en su ventana. Es el
//      ADR II-0001 —«encender no es una acción, es una consecuencia»— dicho por
//      tercera vez, y vale igual para secar, pudrir y carbonizar.
//
// ─── CÓMO SE LEE ────────────────────────────────────────────────────────────
//
//   · `it(...)`             → la cadena sale, con los pasos clavados.
//   · `it.fails(...)`       → HUECO ABIERTO, con su «POR QUÉ SIGUE ABIERTO» y su
//                             medición al lado. Acá decía «hay uno y es `esperar`»:
//                             ese se cerró, y este archivo ya no tiene ninguno.
//
// ─── EL VEREDICTO, MEDIDO ───────────────────────────────────────────────────
//
// LA CADENA SALE ENTERA, EL TIEMPO INCLUIDO. Con un río y una fogata a la vista, doce
// pasos y nadie escribió ninguno de los dos verbos:
//
//     ir(vara) · sostener(vara) · ir(matorral) · sostener(matorral) ·
//     unir(matorral+vara) · ir(pozo) · aplicar(extraccion) ·
//     ir(fogata) · poner(piedra sobre fogata) · poner(lo-que-hice sobre piedra) ·
//     esperar(15s) · sostener(lo-que-hice)
//
// La mitad de abajo es la pesca del Hito 5 y no la pidió nadie: sale de que una
// ley mueve CUALIDADES y nada más, así que lo que la fila promete y no es una
// cualidad —el tag— lo tenía que traer el sujeto. La mitad de arriba es la pila.
//
// ACÁ DECÍA «lo que no sale es la espera», con los tres errores de `tsc` que costaba
// agregarla a `Step` transcritos. Se agregó y los tres eran los tres. Y después la
// espera aprendió a saber QUÉ está esperando: `Step.esperar.mirando` lleva el `Ref`
// del sujeto y los `QualityTest` del `establishes` de la fila, despejados con
// `interpretar`, y la innata corta cuando la comida está lista en vez de gastar la
// cota entera. Medido contra `stepWorld`: 100 ticks de espera y no 300.
//
// ─── Y SIN FUEGO A LA VISTA, AHORA TAMBIÉN SALE ─────────────────────────────
//
// Acá decía que no salía, y el `gap` lo explicaba así: «la criatura sabe encender,
// y lo que sabe encender —0,53 kg de madera, 159 de potencia— es chico contra los
// 253 que la ley 5 pide». La cuenta era correcta y la conclusión estaba mal, porque
// esos 253 no son los que la ley 5 pide: son los que pide **la parrilla**, que era
// la única geometría que la tabla tenía escrita. La ley 1 tiene tres variables
// libres —potencia, montaje y distancia— y la tabla resolvía siempre por la única
// que no se puede elegir cada vez: la potencia se elige UNA vez, al encender.
//
// Con una fila por montaje, esos mismos 159 caen adentro de la ventana del CONTACTO
// ([105,42 ; 170,83)) y la cadena cierra sin fuego a la vista: se deshilacha, se
// ata, se pesca, se frota una rama del tamaño justo y se apoya el pescado
// DIRECTAMENTE SOBRE LA BRASA. Medido en el bloque 3.

import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import {
  ESQUEMAS,
  FIRMA_DE_LO_COCIDO,
  GEOMETRIAS_DE_LA_COCCION,
  SEGUNDOS_DE_COCCION,
  YESCAS_DE_COCINA,
} from '../src/esquemas.js'
import { interpretar, textoDe } from '../src/predicado.js'
import { plan } from '../src/regresion.js'
import { PROFUNDIDAD_MAXIMA } from '../src/tipos.js'
import type { EsquemaDeLey, GoalNode, PlanResult, Predicado, Step, VistaDelPlan } from '../src/tipos.js'

// ─── El mundito de mentira ──────────────────────────────────────────────────
//
// Copiado de `la-regresion.test.ts` y no importado: los `tests/` no se exportan, y
// un archivo de test que depende del de al lado se rompe cuando el de al lado se
// reordena. Lo que se copia es el ARNÉS, ni una regla del mundo.

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: string, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  // `tags` es lo que la superficie publica de la MATERIA (`tagsDe(body, phys)`),
  // y acá no hay materia: un cuerpo de mentira no está hecho de nada, así que por
  // omisión no tiene ninguna clase. Los tests que prueban `holding(tag:…)` la pasan.
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

/** `portable` la contesta EL MOTOR con la expresión del catálogo, no el fixture. */
function portableDe(mass: number): number {
  const d = specOf('portable').derived
  if (d === undefined) throw new Error('`portable` dejó de ser derivada: el arnés se quedó viejo')
  const noHace = (): never => {
    throw new RangeError('`portable` sólo depende de `own(mass)`')
  }
  return evalQuality(d, {
    own: (q) => (q === 'mass' ? mass : 0),
    geom: noHace,
    sumParts: noHace,
    maxParts: noHace,
    substance: noHace,
  })
}

function criatura(o?: { holding?: readonly BodyView[]; stamina?: number }): SelfView {
  return {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    // En este mundito nada tiene sustancia, asi que nada tiene clase de materia:
    // `[]` es la respuesta honesta y es la misma que da `cuerpo()` por omision. En
    // la partida la vista lo saca de `tagsDe(body, phys)`.
    tags: [],
    madeByMe: false,
    joints: [],
    holding: o?.holding ?? [],
    capacity: 3,
    stamina: o?.stamina ?? 1000,
    permits: 'irreversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

function vista(m: {
  self?: SelfView
  cuerpos?: readonly BodyView[]
  qs?: ReadonlyMap<BodyId, Cualidades>
  mojadas?: readonly Cell[]
}): VistaDelPlan {
  const self = m.self ?? criatura()
  const cuerpos = m.cuerpos ?? []
  const mojadas = m.mojadas ?? []
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = m.qs?.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  return {
    see(w: Where): readonly BodyView[] {
      const out: BodyView[] = []
      for (const b of cuerpos) {
        let ok = true
        for (const t of w) {
          const v = qde(b, t.q)
          const pasa = t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
          if (!pasa) ok = false
        }
        if (ok) out.push(b)
      }
      return out
    },
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number =>
      q === 'wet' && mojadas.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'la cocina' }
}

const SIN_CORTE = 500

/**
 * LA META DEL TRAMO: «tener en la mano algo carnoso con `toxicity <= 0,2`».
 *
 * El 0,2 no es un número elegido: es la `toxicidadTolerada` por omisión de la
 * innata `comer`, o sea el umbral a partir del cual la criatura se niega a tragar.
 * Desde el ADR II-0013 esa negativa defiende de algo real.
 */
const COMIDA_SANA: Predicado = {
  k: 'sostiene',
  tag: 'carnoso',
  tests: [{ q: 'toxicity', op: '<=', v: 0.2 }],
}

/** La misma meta sin condiciones: lo que la mente sabía pedir antes de este tramo. */
const COMIDA_CRUDA: Predicado = { k: 'sostiene', tag: 'carnoso' }

function pasosDe(r: PlanResult): readonly Step[] {
  if (r.k !== 'plan') throw new Error(`se esperaba un plan y salió ${r.k}`)
  return r.steps
}

function corto(s: Step): string {
  const ref = (r: { k: string; id?: string; de?: string } | undefined): string =>
    r === undefined ? '-' : r.k === 'id' ? (r.id ?? '?') : r.k === 'rinde' ? 'lo-que-hice' : r.k
  switch (s.k) {
    case 'ir':
      return `ir(${ref(s.a)})`
    case 'poner':
      return `poner(${ref(s.que)} sobre ${ref(s.sobre)})`
    case 'sostener':
      return `sostener(${ref(s.que)})`
    case 'unir':
      return `unir(${ref(s.binder)}+${ref(s.a)})`
    case 'deshilachar':
      return `deshilachar(${ref(s.fuente)})`
    case 'frotar':
      return `frotar(${ref(s.a)}×${ref(s.b)})`
    case 'aplicar':
      return `aplicar(${s.proceso})`
    case 'comer':
      return 'comer'
    case 'juntar':
      return 'juntar'
    case 'explorar':
      return 'explorar'
    // El paso que este archivo pedía con un `it.fails` y ahora existe. Lleva los
    // segundos adentro porque son lo único que dice: son el `mientras` de la fila.
    case 'esperar':
      return `esperar(${String(s.segundos)}s)`
  }
}

const resumir = (pasos: readonly Step[]): readonly string[] => pasos.map(corto)

// ─── Los dos escenarios ─────────────────────────────────────────────────────

/**
 * «Tengo hambre, veo un río, y al lado hay una fogata y una piedra.»
 *
 * Es el río de `la-regresion.test.ts` —matorral, vara y pozo, con los números de
 * las sustancias semilla— más dos cuerpos: una fogata de leña ardiendo con
 * `emitsPower` 300 (la del Hito 0) y una piedra con `ignitionPoint` 900, que es el
 * techo de lo que no arde.
 *
 * ─── Y EL PESCADO NO ESTÁ, A PROPÓSITO ──────────────────────────────────────
 *
 * La tentación era poner uno crudo EN LA MANO y medir sólo la mitad de arriba de
 * la cadena. No se puede, y el motivo es un hueco medido: `cumpleCuerpo` no puede
 * contestar la forma `sostiene` porque una `BodyView` no trae la sustancia y los
 * tags son de la sustancia (está pinado con dos `it.fails` en
 * `los-esquemas-contra-el-mundo.test.ts`). O sea que un pescado en la mano no liga
 * el rol `comida` ni cierra la meta, y la rama sale igual a fabricarlo.
 *
 * Que salga a fabricarlo es lo que hace que este escenario mida la cadena ENTERA:
 * deshilachar el matorral, atarle la hebra a la vara, pescar con eso, y recién ahí
 * armar el fuego. Cuatro marcos de pila, que es justo `PROFUNDIDAD_MAXIMA`.
 */
function laFogata(): VistaDelPlan {
  return vista({
    self: criatura(),
    cuerpos: [
      cuerpo('matorral', 2, 0),
      cuerpo('vara', 5, 0),
      cuerpo('pozo', 8, 0),
      cuerpo('fogata', 2, 1),
      cuerpo('piedra', 1, 0),
    ],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
      ['fogata', { mass: 1, emitsPower: 300, temperature: 400, ignitionPoint: 300, fuelEnergy: 18 }],
      ['piedra', { mass: 0.5, ignitionPoint: 900, rigidity: 0.9 }],
    ]),
    mojadas: [{ x: 8, y: 0 }],
  })
}

/** El mismo río de `la-regresion.test.ts`: matorral, vara y pozo, y NINGÚN fuego. */
function elRio(): VistaDelPlan {
  return vista({
    self: criatura(),
    cuerpos: [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0), cuerpo('piedra', 1, 0)],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
      ['piedra', { mass: 0.5, ignitionPoint: 900, rigidity: 0.9 }],
    ]),
    mojadas: [{ x: 8, y: 0 }],
  })
}

/**
 * LA YESCA DE COCINA, con la masa leída de la tabla y no elegida.
 *
 * `YESCAS_DE_COCINA` es lo que `esquemas.ts` despeja: qué combustible da un fuego de
 * la ventana que cocina. El escenario de abajo pone EXACTAMENTE eso —el punto medio
 * de la banda de masa, con el poder calorífico de la madera— así que si mañana la
 * banda se mueve, el escenario se mueve con ella en vez de quedar viejo en silencio.
 */
const YESCA = (() => {
  const y = YESCAS_DE_COCINA[0]
  if (y === undefined) throw new Error('la tabla no genera ninguna yesca de cocina: el escenario no tiene sentido')
  return y
})()

/**
 * EL MISMO RÍO, MÁS UNA RAMA DEL TAMAÑO JUSTO. Es el escenario del tramo.
 *
 * La diferencia con `elRio()` es UN cuerpo: una rama de madera que se puede frotar
 * (`rigidity` 0,7), que arde (`fuelEnergy` 18, `ignitionPoint` 300, seca), que entra
 * en el tanque de aliento (`heatCapacity` por debajo de 0,9) y que pesa lo que la
 * tabla pide para que, ardiendo, emita una potencia adentro de la ventana del
 * CONTACTO. Ni una condición más: no hay ningún cuerpo «fogata» prendido.
 *
 * Es el escenario que el `gap` del `emitsPower` decía que no se podía resolver.
 */
function elRioConLena(): VistaDelPlan {
  const masa = (YESCA.masaMin + YESCA.masaMax) / 2
  return vista({
    self: criatura(),
    cuerpos: [
      cuerpo('matorral', 2, 0),
      cuerpo('vara', 5, 0),
      cuerpo('pozo', 8, 0),
      cuerpo('piedra', 1, 0),
      cuerpo('rama', 3, 0),
    ],
    qs: new Map<BodyId, Cualidades>([
      ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
      ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
      ['pozo', { mass: 50 }],
      ['piedra', { mass: 0.5, ignitionPoint: 900, rigidity: 0.9 }],
      [
        'rama',
        {
          mass: masa,
          // `heatCapacity = mass × specificHeat`, y el de la madera es 1,7. Se escribe
          // el producto porque este mundito no tiene sustancias: lo que se copia es la
          // aritmética del catálogo, no un número inventado.
          heatCapacity: masa * 1.7,
          fuelEnergy: 18,
          ignitionPoint: 300,
          moisture: 0.25,
          rigidity: 0.7,
        },
      ],
    ]),
    mojadas: [{ x: 8, y: 0 }],
  })
}

// ════════════════════════════════════════════════════════════════════════════
// 1 · LA META SE PUEDE ESCRIBIR
// ════════════════════════════════════════════════════════════════════════════

describe('1 · «algo carnoso que no envenene» es un predicado, y antes no lo era', () => {
  it('la firma va y vuelve, con las condiciones ordenadas y sin blancos', () => {
    const f = textoDe(COMIDA_SANA)
    expect(f).toBe('holding(tag:carnoso,toxicity<=0.2)')
    expect(interpretar(f)).toEqual(COMIDA_SANA)
    // El separador de adentro es la COMA y no el `&`, y no es cosmética: `firmaDe`
    // parte por `&` ANTES de interpretar, así que con `&` esto llegaría partido en
    // dos trozos ilegibles. Se mide sobre la firma que la tabla usa de verdad.
    expect(FIRMA_DE_LO_COCIDO).not.toContain('&')
    expect(interpretar(FIRMA_DE_LO_COCIDO)?.k).toBe('sostiene')
  })

  it('y la meta con condiciones NO se da por cumplida con lo que la vieja sí', () => {
    // La distinción entera: `holding(tag:carnoso)` no garantiza
    // `holding(tag:carnoso,toxicity<=0.2)`, así que un pescado crudo en la mano no
    // cierra la meta nueva. Antes de este tramo las dos eran la misma firma.
    const cruda = interpretar(textoDe(COMIDA_CRUDA))
    const sana = interpretar(textoDe(COMIDA_SANA))
    if (cruda === undefined || sana === undefined) throw new Error('las metas dejaron de interpretarse')
    expect(cruda).not.toEqual(sana)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 2 · LA CADENA, CON FUEGO A LA VISTA
// ════════════════════════════════════════════════════════════════════════════

describe('2 · con una fogata y una piedra, la cadena de cocinar sale', () => {
  it('EL CRITERIO: poner la parrilla, poner la comida, y levantarla cocida', () => {
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE)
    expect(r.k).toBe('plan')
    const pasos = resumir(pasosDe(r))
    console.log(`\n── LA CADENA DE COCINAR ${'─'.repeat(44)}\n  ${pasos.join('\n  ')}\n`)
    expect(pasos).toEqual([
      // ── LA MITAD DE ABAJO: hay que tener qué cocinar ────────────────────
      //
      // No la pidió nadie. Sale de que la ley 5 mueve CUALIDADES y nada más, así
      // que de todo lo que la fila promete —«en la mano, carnoso, digerible y sin
      // veneno»— lo que no es una cualidad lo tenía que traer el sujeto. Eso
      // despeja `holding(tag:carnoso)`, y eso el catálogo ya sabe hacerlo.
      'ir(vara)',
      'sostener(vara)',
      'ir(matorral)',
      'sostener(matorral)',
      'unir(matorral+vara)',
      'ir(pozo)',
      'aplicar(extraccion)',
      // ── LA MITAD DE ARRIBA: la situación en la que la ley corre ─────────
      //
      // A un fuego no se lo levanta: se va hasta él. `poner` exige Chebyshev ≤ 1.
      'ir(fogata)',
      // La piedra sobre el fuego: eso la deja en CONTACTO, que es la exposición más
      // brava de las tres, y por eso la fila le pide `ignitionPoint > 425`.
      'poner(piedra sobre fogata)',
      // Y el pescado sobre la piedra: eso lo deja en montaje `parrilla`, el único de
      // los tres que cae adentro de la ventana de cocción. Nadie escribió «parrilla»
      // —es lo único que sobrevive a la resta— y nadie escribió «cocinar».
      //
      // `lo-que-hice` es la ligadura diferida del ADR 0082: el pescado NO EXISTE
      // cuando el plan se arma, así que el paso lo nombra por lo que rindió el
      // `extraccion` de arriba y no por un id que todavía no hay.
      'poner(lo-que-hice sobre piedra)',
      // ── Y EL TIEMPO, QUE ES EL PASO QUE FALTABA ─────────────────────────
      //
      // Acá abajo había un `it.fails` que decía «falta `esperar`, y por eso la
      // comida se levanta en el mismo tick». Está cerrado, y lo que se midió
      // cuando se cerró es la diferencia entre cocinar y no: con el `poner` y el
      // `sostener` pegados, la ley 5 corría dos ticks y la `digestibility` del
      // pescado no se movía de 0,3800 en veinte mil. Con la espera puesta, el
      // mismo pescado sobre la misma leña llega a 0,8555 en cien ticks.
      //
      // Los 15 s no los elige este test: son el `mientras` de la fila.
      `esperar(${String(SEGUNDOS_DE_COCCION)}s)`,
      // La ley deja la comida donde estaba: si lo que se prometió es sobre la MANO,
      // hay que volver a levantarla. El paso sale de la FORMA del predicado.
      'sostener(lo-que-hice)',
    ])
  })

  it('y son CUATRO marcos de pila, que es exactamente `PROFUNDIDAD_MAXIMA`', () => {
    // La cadena de la pesca son tres —extraccion ← union ← deshilachar— y la ley le
    // pone uno encima. O sea que cocinar lo que hay que pescar está justo en el
    // borde del corte, y una fila más de profundidad no entraría. Se dice acá para
    // que el día que alguien agregue un eslabón sepa que `PROFUNDIDAD_MAXIMA` es lo
    // primero que hay que mirar.
    expect(PROFUNDIDAD_MAXIMA).toBe(4)
    const pasos = pasosDe(plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE))
    expect(pasos.filter((s) => s.k === 'unir' || s.k === 'aplicar').length).toBe(2)
  })

  it('los tres roles se ligaron a los tres cuerpos que corresponden, y no por cercanía', () => {
    // La piedra está a UNA celda y la fogata a DOS, así que un planificador que
    // eligiera por distancia habría puesto la fogata arriba de la piedra. Lo que
    // decide es el `roleHint`: `emitsPower` en la ventana para el fuego,
    // `ignitionPoint` alto para la parrilla.
    const pasos = pasosDe(plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE))
    const puestas = pasos.filter((s): s is Extract<Step, { k: 'poner' }> => s.k === 'poner')
    expect(puestas.length).toBe(2)
    expect(puestas[0]?.que).toEqual({ k: 'id', id: 'piedra' })
    expect(puestas[0]?.sobre).toEqual({ k: 'id', id: 'fogata' })
    // Lo que va arriba es un RENDIMIENTO y no un id: el pescado todavía no existe.
    expect(puestas[1]?.que.k).toBe('rinde')
    expect(puestas[1]?.sobre).toEqual({ k: 'id', id: 'piedra' })
    // `en` y `sobre` son el mismo cuerpo, y no es redundancia: `en` es la celda —la
    // mente la resuelve como «la celda de eso»— y `sobre` es el apoyo (ley 8). Si
    // fuera `tapando` (ley 12) la parrilla ahogaría el fuego.
    for (const p of puestas) {
      expect(p.en).toEqual(p.sobre)
      expect(p.tapando).toBeUndefined()
    }
  })

  it('EL HUECO QUE SE CERRÓ: entre poner la comida y levantarla hay `esperar`, y dura lo que la fila dice', () => {
    // ─── LO QUE ACÁ DECÍA, Y CÓMO SE CERRÓ ─────────────────────────────────
    //
    // Esto era un `it.fails` titulado «falta `esperar`, y por eso la comida se
    // levanta en el mismo tick». `Step` tenía diez variantes y ninguna era
    // esperar; `tipos.ts` lo justificaba con que esperar «es conducta y no plan»,
    // que era cierto mientras nada del plan necesitara que pasara el tiempo. Con
    // las leyes dejó de serlo: **el tiempo ES el paso**, y la fila lo dice con
    // todas las letras en su campo `mientras`.
    //
    // El precio estaba medido acá y era exacto: tres errores de `tsc` —uno en
    // `firmaDePaso` de este paquete y dos `switch` de `@anima/mind`, el de
    // `refsDe` y el de `aHabilidad`—. Los tres eran los tres. La innata `esperar`
    // ya existía y ya tomaba segundos: no faltaba física ni superficie, faltaba
    // la costura, y era esto.
    //
    // ─── Y LO QUE SE MIDIÓ AL CERRARLO, QUE ES LA VARA DE LA MEJORA ────────
    //
    // Con el `poner` y el `sostener` pegados, la corrida de veinte mil ticks de
    // `@anima/mind` mostraba a la criatura apoyando el pescado sobre la fogata en
    // el tick 151 y levantándolo en el 153. La ley 5 corría DOS ticks y la
    // `digestibility` del pescado no se movía de 0,3800 en toda la corrida. Con
    // la espera puesta, el mismo pescado sobre la misma leña de 0,40 kg llega a
    // `digestibility` 0,8555 y `toxicity` 0,0323 a los cien ticks, y a
    // 0,9432 / 0,0016 a los trescientos que la fila declara. La criatura comió
    // por primera vez en el tick 457.
    //
    // Lo que este test afirma es el MECANISMO y no el número: que entre poner la
    // comida y levantarla hay un paso, que ese paso es una espera, y que dura
    // exactamente lo que la fila pide. Los grados los mide `@anima/world`.
    const pasos = pasosDe(plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE))
    const ultimoPoner = pasos.findIndex((s) => s.k === 'poner' && s.que.k === 'rinde')
    const recoge = pasos.findIndex((s) => s.k === 'sostener' && s.que.k === 'rinde')
    expect(ultimoPoner).toBeGreaterThanOrEqual(0)
    expect(recoge).toBeGreaterThan(ultimoPoner)
    // Y en el medio hay exactamente un paso, que es la espera.
    expect(recoge - ultimoPoner).toBe(2)
    const enElMedio = pasos[ultimoPoner + 1]
    expect(enElMedio?.k).toBe('esperar')
    // Los segundos NO son de este test: salen del `mientras` de la fila.
    const fila = ESQUEMAS.find((e): e is EsquemaDeLey => e.k === 'ley' && e.establishes === FIRMA_DE_LO_COCIDO)
    if (fila === undefined) throw new Error('no está la fila de la cocción')
    expect(fila.mientras).toBeGreaterThan(0)
    if (enElMedio?.k !== 'esperar') throw new Error('imposible')
    expect(enElMedio.segundos).toBe(fila.mientras)
  })

  it('el plan NO menciona la ley por su nombre: lo que emite son posiciones', () => {
    // Es la mitad que hace que esto no sea un caso especial disfrazado. La mente que
    // ejecute esta cadena no sabe que existe una ley 5: pone una piedra sobre un
    // fuego y una comida sobre la piedra, y el mundo hace el resto. El mismo emisor
    // sirve para secar (ley 11) o carbonizar (ley 4) el día que haya una fila.
    const pasos = pasosDe(plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE))
    // Los CINCO últimos son los del marco de la ley: cuatro posiciones y el tiempo.
    // Los de antes son los de la pesca, que sí van por procesos del catálogo.
    //
    // Eran cuatro hasta que `esperar` entró, y que el tiempo esté en esta lista es
    // parte de lo que el test dice: la mente que ejecute esta cadena tampoco sabe
    // que la cocción tarda. Le dicen «quedate hasta quince segundos, y andá mirando
    // que esto suba a 0,85 y baje a 0,05» —el `mirando` del paso, que sale del
    // `establishes` de la fila y no de un nombre de ley— y se queda. Sigue sin haber
    // en ningún lado la palabra «cocinar».
    const delMarcoDeLaLey = pasos.slice(-5).map((s) => s.k)
    expect(delMarcoDeLaLey).toEqual(['ir', 'poner', 'poner', 'esperar', 'sostener'])
    // Y ningún `aplicar` nombra la ley: `desnaturalizacion` no es un `ProcessId`, y
    // si apareciera en un paso sería porque alguien la coló como proceso.
    const procesos = pasos.filter((s): s is Extract<Step, { k: 'aplicar' }> => s.k === 'aplicar')
    expect(procesos.map((s) => s.proceso)).toEqual(['extraccion'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3 · SIN FUEGO A LA VISTA: EL GAP DICE QUÉ FALTA, Y ES UN NÚMERO
// ════════════════════════════════════════════════════════════════════════════

describe('3 · sin fuego: con una rama del tamaño justo la cadena CIERRA, y sin ella el `gap` dice otra cosa', () => {
  it('EL CRITERIO DEL TRAMO: sin fuego a la vista, el plan lo enciende y pone la comida en CONTACTO', () => {
    // ─── LO QUE ESTE TEST MIDE, Y POR QUÉ ES EL TRAMO ENTERO ───────────────
    //
    // Antes de este tramo la tabla tenía UNA fila de cocción, con el montaje clavado
    // en la parrilla, y su ventana de potencia —[253 ; 410)— no la llenaba ningún
    // fuego que la criatura sepa encender: el techo de la yesca son 0,53 kg de
    // madera, que ardiendo emiten 159. El `gap` decía «ningún esquema conocido
    // establece emitsPower<410» y la lectura obvia —«hay que encender más fuerte»—
    // era la equivocada. La potencia se elige UNA vez, al encender; el LUGAR se
    // elige cada vez.
    //
    // Con una fila por montaje, esos 159 caen adentro de la ventana del CONTACTO
    // ([105,42 ; 170,83)), y la cadena cierra sin inventar física: se deshilacha,
    // se ata, se pesca, se frota la rama contra la vara y se apoya el pescado
    // DIRECTAMENTE SOBRE LA BRASA — que es una pila de dos y no de tres.
    const r = plan(meta(COMIDA_SANA), elRioConLena(), SIN_CORTE)
    const pasos = resumir(pasosDe(r))
    console.log(`\n── LA CADENA SIN FUEGO A LA VISTA ${'─'.repeat(38)}\n  ${pasos.join('\n  ')}\n`)
    expect(r.k).toBe('plan')
    // Enciende: hay un `frotar`, y lo que frota es la rama del tamaño justo.
    const frota = pasosDe(r).filter((s): s is Extract<Step, { k: 'frotar' }> => s.k === 'frotar')
    expect(frota.length).toBe(1)
    expect(frota[0]?.a).toEqual({ k: 'id', id: 'rama' })
    // Y pone la comida EN EL MONTAJE QUE CORRESPONDE: un solo `poner`, del pescado
    // directamente sobre la rama encendida. Dos `poner` serían la parrilla, que con
    // este fuego no cocina; ninguno sería no cocinar.
    const puestas = pasosDe(r).filter((s): s is Extract<Step, { k: 'poner' }> => s.k === 'poner')
    expect(puestas.length).toBe(1)
    expect(puestas[0]?.que.k).toBe('rinde')
    expect(puestas[0]?.sobre).toEqual({ k: 'id', id: 'rama' })
    // `sobre` y no sólo `en`: apoyado SOBRE el fuego es `contacto`; en la celda y sin
    // apoyo sería `piso`, que con este fuego no llega ni al `denaturesAt`.
    expect(puestas[0]?.en).toEqual(puestas[0]?.sobre)
    expect(puestas[0]?.tapando).toBeUndefined()
    // Y la mitad de abajo sigue estando: para asar un pescado primero hay que
    // pescarlo, y eso lo pone la regresión sola.
    expect(pasos).toContain('aplicar(extraccion)')
  })

  it('y SIN la rama del tamaño justo, el `gap` ya no habla de los 253: habla de lo que falta encender', () => {
    // El río pelado no tiene con qué: su única vara tiene `fuelEnergy` 0 y su
    // matorral tampoco arde. La cadena no cierra —está bien que no cierre— y lo que
    // cambió es lo que el `gap` dice. Antes nombraba la ventana de la parrilla, que
    // es la que NINGUNA criatura puede encender; ahora las tres ventanas están en la
    // tabla y la que queda huérfana es otra.
    const r = plan(meta(COMIDA_SANA), elRio(), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    console.log(
      `\n── EL GAP DE LA COCINA SIN NADA QUE ARDA ${'─'.repeat(27)}\n` +
        `  falta: ${r.missing}\n  porque: ${r.why}\n` +
        `  nearest: ${resumir(r.nearest).join(' · ') || '(vacío)'}\n`,
    )
    // Sigue nombrando una magnitud con un número, que es lo único con lo que se
    // puede ir a pedirle un proceso a la fragua del Hito 8.
    expect(r.why).toContain('emitsPower')
    // Y ya NO es la ventana de la parrilla la que se reporta huérfana: la ventana que
    // el `gap` nombra ahora es una de las que la tabla tiene, y la de la parrilla
    // tiene esquema de encender... no. Se afirma lo que se midió: la firma que falta
    // es la de ALGUNA de las tres geometrías, y no una inventada.
    const ventanas = GEOMETRIAS_DE_LA_COCCION.map((g) => `emitsPower<${String(g.maxima)}&emitsPower>=${String(g.minima)}`)
    expect(ventanas).toContain(r.missing)
    // Lo que sí no cambió: dice lo más cerca que llega el catálogo, o sea que la
    // criatura SABE hacer fuego. Sin esa mitad, el mensaje mandaría a inventar lo que
    // ya está inventado.
    expect(r.why).toContain('emitsPower>0')
  })

  it('y la meta SIN condiciones sigue saliendo por la pesca, que es diez veces más barata', () => {
    // La fila de la cocción también establece algo que implica `holding(tag:carnoso)`
    // —tener el pescado asado en la mano es tenerlo en la mano— así que la meta vieja
    // abre ramas de más. Las de la ley cuestan 15 s contra 1,5 y nunca salen de la
    // cola: el plan que sale es el de siempre.
    const pasos = resumir(pasosDe(plan(meta(COMIDA_CRUDA), elRioConLena(), SIN_CORTE)))
    expect(pasos[pasos.length - 1]).toBe('aplicar(extraccion)')
    expect(pasos.some((p) => p.startsWith('poner'))).toBe(false)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 4 · EL CONTROL NEGATIVO: UNA FILA DE LEY MAL ESCRITA TIENE QUE SALIR ROJA
// ════════════════════════════════════════════════════════════════════════════
//
// Las dos guardas que `armarMarco` le hace a una ley son las mismas dos que ya le
// hacía a un proceso, traducidas: que no falte ningún rol de los que la situación
// necesita, y que no sobre ninguno. Y no son hipótesis de laboratorio:
// `opciones.esquemas` es entrada pública y es lo que va a escribir la fragua del
// Hito 8, así que una fila mal escrita tiene que contestar `gap` con el nombre del
// rol adentro — nunca lanzar en el medio de la búsqueda, que es lo que voltearía el
// tick de las 5000 criaturas.

describe('4 · las tres guardas de una fila de ley, con la fila mutilada', () => {
  /** La fila de la PARRILLA, que es la única con tres cuerpos en la pila. */
  const laFila = (): EsquemaDeLey => {
    const e = ESQUEMAS.find((x): x is EsquemaDeLey => x.k === 'ley' && x.pila.includes('parrilla'))
    if (e === undefined) throw new Error('no está la fila de la parrilla')
    return e
  }

  /**
   * LA TABLA REAL CON **UNA SOLA** FILA DE LEY, Y ES LA MUTANTE.
   *
   * Se saca a las tres y se pone la mutante, en vez de reemplazar la que le
   * corresponde, y las dos mitades hacen falta desde que hay una fila por geometría:
   *
   *   · sacar a las otras dos, porque si no la búsqueda encuentra plan por una fila
   *     sana y la mutante no se mide nunca;
   *   · no reemplazar por clave, porque la clave de una ley LLEVA SU PILA: una
   *     mutante que le cambia la pila cambia de clave, cae encima de OTRA fila real
   *     y las dos se aplican juntas. Medido: la mutante de la pila de dos aterrizaba
   *     sobre la fila del contacto y `esquemasQueAportan` sumaba los dos `roleHints`,
   *     pidiendo un fuego que cumpliera las DOS ventanas a la vez —«emitsPower<170,83
   *     ∧ emitsPower<410 ∧ emitsPower>=105,42 ∧ emitsPower>=253»— que no cumple nadie.
   */
  const soloEsta = (mutante: EsquemaDeLey): readonly (typeof ESQUEMAS)[number][] => [
    ...ESQUEMAS.filter((e) => e.k !== 'ley'),
    mutante,
  ]

  it('si le falta un rol de su propia pila, contesta `gap` y lo nombra', () => {
    const real = laFila()
    const { parrilla: _, ...sinParrilla } = real.roleHints
    const mutante: EsquemaDeLey = { ...real, roleHints: sinParrilla }
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, { esquemas: soloEsta(mutante) })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('no nombra «parrilla»')
    expect(r.why).toContain('necesita sí o sí')
  })

  it('si le pide algo a un rol que no está en la pila ni es el sujeto, también', () => {
    // Un `roleHint` sobre un nombre que la pila no menciona es una condición que
    // nadie va a cumplir: la regresión saldría a buscar un cuerpo para un rol que
    // después no se usa en ningún paso. Sin la guarda salía plan igual.
    const real = laFila()
    const mutante: EsquemaDeLey = {
      ...real,
      roleHints: { ...real.roleHints, sal: [{ q: 'mass', op: '>', v: 0 }] },
    }
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, { esquemas: soloEsta(mutante) })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('«sal»')
    expect(r.why).toContain('nadie lo va a llenar')
  })

  it('LA GUARDA NUEVA: una fila con `distancia` que ningún `Ref` sabe armar se rechaza y lo dice', () => {
    // ─── POR QUÉ ESTA GUARDA NO ES DE LABORATORIO ──────────────────────────
    //
    // `opciones.esquemas` es entrada pública y es lo que va a escribir la fragua del
    // Hito 8. Una fila que declare `distancia: 2` calculó su ventana de potencia con
    // `formFactor` dividiendo por `1 + d²`, o sea que pide un fuego CINCO VECES más
    // grande que la misma fila pegada. Si el emisor la armara igual —poniendo la
    // comida encima, que es lo único que `poner` sabe hacer— la temperatura sería
    // cinco veces la que la fila calculó: un plan verde que quema la comida.
    //
    // Se rechaza, y el motivo nombra lo que falta: un `Ref` que sepa decir «la celda
    // que está a dos de ese cuerpo». Es lo mismo que la tabla ya hace sola —esas
    // filas están en `GEOMETRIAS_DESCARTADAS` y no se generan— dicho del lado del
    // emisor, que es el que tiene que sobrevivir a una tabla escrita por otro.
    const real = laFila()
    const mutante: EsquemaDeLey = { ...real, distancia: 2 }
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, { esquemas: soloEsta(mutante) })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('a 2 celdas del fuego')
    expect(r.why).toContain('ningún `Ref` sabe')
  })

  it('y una fila con la pila de DOS sigue saliendo: el planificador propone, el mundo dispone', () => {
    // ─── EL LÍMITE DE LO QUE UN ESQUEMA PUEDE PROMETER, DICHO ──────────────
    //
    // Con la parrilla sacada de la pila —la comida directamente sobre el fuego— pero
    // dejándole la VENTANA DE POTENCIA de la parrilla, el plan SALE y el mundo la va
    // a quemar: en contacto ese mismo fuego se va a 375 °C contra los 260 en que el
    // pescado se piroliza, medido en `los-esquemas-contra-el-mundo.test.ts`.
    //
    // Y ahí está exactamente lo que el tramo arregló: la fila REAL de la pila de dos
    // existe, y pide un fuego diez veces más chico. La mutante no es «la fila de
    // contacto»: es la de la parrilla con la pila cambiada y la ventana vieja, o sea
    // una fila cuya geometría y cuyo número no se hablan. El planificador no lo puede
    // saber —`ConstructionSchema` no tiene aritmética sobre montajes— y lo que hace
    // segura a la tabla no es un chequeo acá: es que CADA FILA está verificada contra
    // una partida, y esta mutante no lo está.
    const real = laFila()
    const { parrilla: _, ...sinParrilla } = real.roleHints
    const mutante: EsquemaDeLey = { ...real, pila: ['fuego', 'comida'], roleHints: sinParrilla }
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, { esquemas: soloEsta(mutante) })
    expect(r.k).toBe('plan')
    const pasos = resumir(pasosDe(r))
    expect(pasos.filter((p) => p.startsWith('poner')).length).toBe(1)
    expect(pasos).toContain('poner(lo-que-hice sobre fogata)')
  })

  it('LA OTRA GUARDA NUEVA: una fila cuyo sujeto queda AFUERA de la pila se rechaza y lo dice', () => {
    // ─── EL TERCER MONTAJE, Y POR QUÉ NO ESTÁ EN LA TABLA ──────────────────
    //
    // `piso` es el «todo lo demás» de `montajeDe`: en la celda del fuego y apoyado
    // en NADA. Con una pila —que es una lista de apoyos— eso sólo se escribiría
    // sacando al sujeto de la pila, y `poner` no sabe hacer otra cosa que apoyar.
    // Armarla igual daría `contacto`, que tiene DIEZ VECES la exposición con la que
    // esa fila calculó su ventana: la comida se carbonizaría con un plan verde.
    //
    // La tabla no genera esas filas —quedan en `GEOMETRIAS_DESCARTADAS` con su
    // ventana y su motivo— y el emisor las rechaza igual, porque `opciones.esquemas`
    // es entrada pública.
    const real = laFila()
    const mutante: EsquemaDeLey = { ...real, pila: ['fuego', 'parrilla'] }
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, { esquemas: soloEsta(mutante) })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('afuera de la pila')
    expect(r.why).toContain('sólo sabe apoyar')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 5 · LOS CUATRO PASOS QUE EL PLANIFICADOR NO EMITÍA
// ════════════════════════════════════════════════════════════════════════════

describe('5 · qué variantes de `Step` sabe emitir el planificador, contadas', () => {
  it('`poner` entró con la ley; `juntar`, `comer` y `explorar` siguen sin emisor', () => {
    // El adversario del tramo F dejó anotado que `plan()` emitía 6 de las 10
    // variantes y nunca `juntar`, `comer`, `poner` ni `explorar`. Este tramo agrega
    // una: `poner`, y no por una regla que diga «emitir poner» sino porque una ley
    // se arma con posiciones. Las otras tres siguen sin emisor y cada una por su
    // motivo, que conviene decir para que nadie las cuente juntas:
    //
    //   juntar    junta N cuerpos que cumplan un `Where`. Ningún esquema pide una
    //             CANTIDAD: `deshilachar` emite `cuantas: 1` porque el esquema dice
    //             «hace falta UN cuerpo que cumpla algo». Entra el día que una fila
    //             pida masa acumulada —«leña para que el fuego dure»— y eso es una
    //             condición sobre un CONJUNTO, que `ConstructionSchema` no tiene.
    //   comer     es lo que se hace CON el plan, no un paso del plan: ningún
    //             `establishes` habla de la `stamina` de la criatura. Lo emite la
    //             escalera de decisión cuando la meta ya está cumplida.
    //   explorar  pide `maxTicks`, que son TICKS, y `VistaDelPlan` no tiene `hz` con
    //             qué convertir los segundos del reloj. Está anotado en
    //             `pasosPosibles`: inventar el número sería un dato que nadie puede
    //             discutir después.
    const metas: readonly Predicado[] = [
      COMIDA_SANA,
      COMIDA_CRUDA,
      { k: 'cualidad', test: { q: 'temperature', op: '>=', v: 400 } },
      { k: 'cualidad', test: { q: 'emitsPower', op: '>', v: 0 } },
      { k: 'cualidad', test: { q: 'catch', op: '>', v: 0 } },
      { k: 'geometria', f: 'freeStrandEnds', op: '>=', v: 1 },
    ]
    const emitidos = new Set<Step['k']>()
    for (const m of metas) {
      for (const v of [laFogata(), elRio()]) {
        const r = plan(meta(m), v, SIN_CORTE)
        const pasos = r.k === 'plan' ? r.steps : r.k === 'gap' ? r.nearest : []
        for (const s of pasos) emitidos.add(s.k)
      }
    }
    console.log(`\n── LAS VARIANTES DE \`Step\` QUE SALEN ───\n  ${[...emitidos].sort().join(' · ')}\n`)
    expect(emitidos.has('poner')).toBe(true)
    expect(emitidos.has('juntar')).toBe(false)
    expect(emitidos.has('comer')).toBe(false)
    expect(emitidos.has('explorar')).toBe(false)
  })
})
