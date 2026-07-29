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
//                             medición al lado. Hay uno y es `esperar`.
//
// ─── EL VEREDICTO, MEDIDO ───────────────────────────────────────────────────
//
// LA CADENA SALE ENTERA salvo el tiempo. Con un río y una fogata a la vista, once
// pasos y nadie escribió ninguno de los dos verbos:
//
//     ir(vara) · sostener(vara) · ir(matorral) · sostener(matorral) ·
//     unir(matorral+vara) · ir(pozo) · aplicar(extraccion) ·
//     ir(fogata) · poner(piedra sobre fogata) · poner(lo-que-hice sobre piedra) ·
//     sostener(lo-que-hice)
//
// La mitad de abajo es la pesca del Hito 5 y no la pidió nadie: sale de que una
// ley mueve CUALIDADES y nada más, así que lo que la fila promete y no es una
// cualidad —el tag— lo tenía que traer el sujeto. La mitad de arriba es la pila.
//
// LO QUE NO SALE ES LA ESPERA, y el motivo está medido: `Step` no tiene la
// variante y agregarla rompe el typecheck de `@anima/mind` en dos líneas. Va con
// `it.fails` y con los tres errores de `tsc` transcritos.
//
// Y SIN FUEGO A LA VISTA NO SALE, y el `gap` dice exactamente por qué: la criatura
// SABE encender —el puente de `emitsPower>0` está en la tabla desde este tramo— y
// lo que sabe encender es demasiado chico para cocinar. La cuenta cierra sola:
// frotar sólo paga hasta `heatCapacity` 0,9 y eso, en madera, son 0,53 kg que
// arden a 159 de potencia contra los 253 que la ley 5 pide. El eslabón que falta
// no es hacer fuego: es pasarle la llama a un leño, que es la ley 3.

import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import { ESQUEMAS, FIRMA_DE_LO_COCIDO, POTENCIA_QUE_COCINA_LO_CARNOSO } from '../src/esquemas.js'
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

  it.fails('EL HUECO — falta `esperar`, y por eso la comida se levanta en el mismo tick', () => {
    // ─── POR QUÉ SIGUE ABIERTO ─────────────────────────────────────────────
    //
    // `Step` tiene diez variantes y ninguna es esperar. `tipos.ts` lo justificaba
    // con que esperar «es conducta y no plan», que era cierto mientras nada del plan
    // necesitara que pasara el tiempo. Con las leyes deja de serlo: **el tiempo ES
    // el paso**, y la fila lo dice con todas las letras en su campo `mientras`.
    //
    // QUÉ HARÍA FALTA, medido y no supuesto. Agregar
    // `{ k: 'esperar'; segundos; porQue }` a `Step` y correr
    // `pnpm --filter @anima/mind typecheck` da exactamente tres errores:
    //
    //     mind/src/escalera.ts(609,32)   TS2366  Function lacks ending return statement
    //     mind/src/mente.ts(185,77)      TS7030  Not all code paths return a value
    //     plan/src/regresion.ts(1445,32) TS2366  ← éste es de este paquete
    //
    // O sea: una línea en `tipos.ts`, un caso en `firmaDePaso` —los dos de acá— y
    // DOS CASOS DE `switch` en `@anima/mind`, que es el paquete que traduce pasos a
    // innatas. La innata `esperar` ya existe (`skills/src/innatas/esperar.ts`) y ya
    // toma segundos: no falta física ni superficie, falta la costura.
    //
    // LA CONSECUENCIA, y es la que este `it.fails` mide: entre el `poner` y el
    // `sostener` no hay nada, así que la criatura apoya el pescado y lo levanta en
    // el tick siguiente. La ley 5 corre UN tick. No es que cocine mal: no cocina.
    const pasos = pasosDe(plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE))
    const ultimoPoner = pasos.findIndex((s) => s.k === 'poner' && s.que.k === 'rinde')
    const recoge = pasos.findIndex((s) => s.k === 'sostener' && s.que.k === 'rinde')
    expect(ultimoPoner).toBeGreaterThanOrEqual(0)
    expect(recoge).toBeGreaterThan(ultimoPoner)
    // Lo que DEBERÍA haber en el medio: la espera que la fila declara.
    const fila = ESQUEMAS.find((e): e is EsquemaDeLey => e.k === 'ley' && e.establishes === FIRMA_DE_LO_COCIDO)
    if (fila === undefined) throw new Error('no está la fila de la cocción')
    expect(fila.mientras).toBeGreaterThan(0)
    expect(recoge - ultimoPoner).toBeGreaterThan(1)
  })

  it('el plan NO menciona la ley por su nombre: lo que emite son posiciones', () => {
    // Es la mitad que hace que esto no sea un caso especial disfrazado. La mente que
    // ejecute esta cadena no sabe que existe una ley 5: pone una piedra sobre un
    // fuego y una comida sobre la piedra, y el mundo hace el resto. El mismo emisor
    // sirve para secar (ley 11) o carbonizar (ley 4) el día que haya una fila.
    const pasos = pasosDe(plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE))
    // Los cuatro últimos son los del marco de la ley, y son todos POSICIONES. Los de
    // antes son los de la pesca, que sí van por procesos del catálogo.
    const delMarcoDeLaLey = pasos.slice(-4).map((s) => s.k)
    expect(delMarcoDeLaLey).toEqual(['ir', 'poner', 'poner', 'sostener'])
    // Y ningún `aplicar` nombra la ley: `desnaturalizacion` no es un `ProcessId`, y
    // si apareciera en un paso sería porque alguien la coló como proceso.
    const procesos = pasos.filter((s): s is Extract<Step, { k: 'aplicar' }> => s.k === 'aplicar')
    expect(procesos.map((s) => s.proceso)).toEqual(['extraccion'])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// 3 · SIN FUEGO A LA VISTA: EL GAP DICE QUÉ FALTA, Y ES UN NÚMERO
// ════════════════════════════════════════════════════════════════════════════

describe('3 · sin fuego, el `gap` nombra la potencia que falta', () => {
  it('«conseguir fuego» no cierra la cadena: lo que se enciende frotando es chico', () => {
    // ─── EL DATO INCÓMODO DEL TRAMO, MEDIDO Y NO ESCONDIDO ─────────────────
    //
    // El río tiene con qué encender —una vara de madera para deshilachar y frotar—
    // y la tabla tiene desde este tramo el puente de `emitsPower>0`. Y aun así la
    // cadena de cocinar no cierra, porque las dos filas de `friccion` se tocan y la
    // cuenta da que NO ALCANZA: frotar sólo paga hasta `heatCapacity` 0,9, que en
    // madera son 0,53 kg, que ardiendo emiten 159 contra los 253 que la ley 5 pide.
    //
    // O sea que el eslabón que falta no es «saber hacer fuego»: es **pasarle la
    // llama a un leño más grande**, que es la ley 3 y que todavía no tiene fila.
    // El `gap` lo dice con las dos firmas al lado, que es lo que el Hito 8 le lleva
    // a la fragua.
    const r = plan(meta(COMIDA_SANA), elRio(), SIN_CORTE)
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') throw new Error('imposible')
    console.log(
      `\n── EL GAP DE LA COCINA SIN FUEGO ${'─'.repeat(35)}\n` +
        `  falta: ${r.missing}\n  porque: ${r.why}\n` +
        `  nearest: ${resumir(r.nearest).join(' · ') || '(vacío)'}\n`,
    )
    // Nombra la potencia y no «el fuego»: es una magnitud con un número, que es lo
    // único con lo que se puede ir a pedir un proceso nuevo.
    expect(r.why).toContain('emitsPower')
    expect(r.why).toContain(String(POTENCIA_QUE_COCINA_LO_CARNOSO.minima))
    // Y dice lo más cerca que llega el catálogo, que es el puente de encender: la
    // criatura SABE hacer fuego, y el que sabe hacer no alcanza. Sin esta mitad, el
    // mensaje mandaría a inventar lo que ya está inventado.
    expect(r.why).toContain('emitsPower>0')
  })

  it('y la meta SIN condiciones sigue saliendo por la pesca, que es diez veces más barata', () => {
    // La fila de la cocción también establece algo que implica `holding(tag:carnoso)`
    // —tener el pescado asado en la mano es tenerlo en la mano— así que la meta vieja
    // abre DOS ramas. La de la ley cuesta 15 s contra 1,5 y nunca sale de la cola:
    // el plan que sale es el de siempre.
    const pasos = resumir(pasosDe(plan(meta(COMIDA_CRUDA), elRio(), SIN_CORTE)))
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

describe('4 · las dos guardas de una fila de ley, con la fila mutilada', () => {
  const laFila = (): EsquemaDeLey => {
    const e = ESQUEMAS.find((x): x is EsquemaDeLey => x.k === 'ley' && x.establishes === FIRMA_DE_LO_COCIDO)
    if (e === undefined) throw new Error('no está la fila de la cocción')
    return e
  }

  /** La tabla real con la fila de la cocción reemplazada por una mutante. */
  const con = (mutante: EsquemaDeLey): readonly (typeof ESQUEMAS)[number][] =>
    ESQUEMAS.map((e) => (e.k === 'ley' && e.establishes === FIRMA_DE_LO_COCIDO ? mutante : e))

  it('si le falta un rol de su propia pila, contesta `gap` y lo nombra', () => {
    const real = laFila()
    const { parrilla: _, ...sinParrilla } = real.roleHints
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, {
      esquemas: con({ ...real, roleHints: sinParrilla }),
    })
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
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, {
      esquemas: con({
        ...real,
        roleHints: { ...real.roleHints, sal: [{ q: 'mass', op: '>', v: 0 }] },
      }),
    })
    expect(r.k).toBe('gap')
    if (r.k !== 'gap') return
    expect(r.why).toContain('«sal»')
    expect(r.why).toContain('nadie lo va a llenar')
  })

  it('y una fila con la pila de DOS sigue saliendo: el planificador propone, el mundo dispone', () => {
    // ─── EL LÍMITE DE LO QUE UN ESQUEMA PUEDE PROMETER, DICHO ──────────────
    //
    // Con la parrilla sacada de la pila —la comida directamente sobre el fuego— el
    // plan SALE, y el mundo la va a quemar: en contacto el equilibrio se va a
    // 375 °C contra los 260 en que el pescado se piroliza, medido en
    // `los-esquemas-contra-el-mundo.test.ts`. El planificador no lo puede saber
    // porque `ConstructionSchema` no tiene aritmética sobre montajes: lo que la fila
    // declara es una pila, y una pila de dos es una pila.
    //
    // Es la decisión del encabezado de `regresion.ts` —«el planificador propone
    // barato y el mundo dispone»— y el precio de que la tabla sea humana. Lo que la
    // hace segura no es un chequeo acá: es que CADA FILA está verificada contra una
    // partida, y esta mutante no lo está.
    const real = laFila()
    const { parrilla: _, ...sinParrilla } = real.roleHints
    const r = plan(meta(COMIDA_SANA), laFogata(), SIN_CORTE, undefined, {
      esquemas: con({ ...real, pila: ['fuego', 'comida'], roleHints: sinParrilla }),
    })
    expect(r.k).toBe('plan')
    const pasos = resumir(pasosDe(r))
    expect(pasos.filter((p) => p.startsWith('poner')).length).toBe(1)
    expect(pasos).toContain('poner(lo-que-hice sobre fogata)')
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
