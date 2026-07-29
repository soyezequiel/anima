// ─── EL BOCADO — «tener comida no es la meta» ───────────────────────────────
//
//   pnpm --filter @anima/mind test
//
// EL DEFECTO QUE ESTE ARCHIVO PERSIGUE, medido antes de tocar una línea:
// **la criatura pescó 199 veces y se murió de hambre en el tick 6194 de 20.000**,
// con `bocados 0` y el pescado en la mano. La causa no era un `if` que faltara:
// las metas de la mente eran `holding(tag:…)` —TENER— y lo que apaga el hambre es
// TRAGAR. Peor: el `valor` con el que esas metas ganaban ya estaba preciado como
// si se comiera (`satisfaccion` mira `nutrition · digestibility`, que son
// calorías). La fórmula y la meta no eran de la misma frase.
//
// Y desde el ADR II-0013 hay una segunda mitad, que es la que vuelve la decisión
// interesante: **tragar cobra**. `stepWorld` acredita `calories` y cobra
// `toxicity · masa · 25` de `stamina`, por separado. O sea que «comé lo que
// tengas» dejó de ser una regla buena.
//
// Los seis grupos de abajo, y qué prueba cada uno:
//
//   (1) LA CUENTA. El neto y la tolerancia salen de las constantes del mundo, no
//       de una tabla. Con el pescado crudo de la corrida canónica el neto es
//       NEGATIVO y la mente no lo come — que es lo correcto y no alcanza para
//       vivir.
//   (2) LA DECISIÓN. La misma comida, dos criaturas: la llena la rechaza y la
//       flaca la come. Sin ningún umbral escrito.
//   (3) LA CADENA COMPLETA contra `stepWorld`: come, sube el aliento, y vive más.
//   (4) NO SE COME A SÍ MISMA, con los dos cerrojos medidos.
//   (5) LOS CERROJOS de bucle: el permiso, el tanque lleno y el bocado que falló.
//   (6) LO QUE QUEDA DEL OTRO LADO: `@anima/plan`. Con su `it.fails` y su
//       medición, para que el día que se cierre se ponga verde solo.

import { describe, expect, it } from 'vitest'

import { qualityOf, specOf } from '@anima/physics'
import { Contexto, Partida } from '@anima/perceive'
import { cumple, EXPANSIONES_POR_TICK, interpretar, plan } from '@anima/plan'
import type { WorldState } from '@anima/world'
import { COSTO_POR_TOXICIDAD_Y_KILO, STAMINA_POR_CALORIA } from '@anima/world'

import { Creencias } from '../src/creencias.js'
import { aterrizar, decidir, nuevoEstado, sinVocabulario } from '../src/escalera.js'
import { Mente, vivir } from '../src/mente.js'
import { necesidades } from '../src/necesidades.js'
import { metaComestibleDe, opportunities, venenoQueBanca } from '../src/oportunidades.js'
import type { Opportunity, VistaDeLaMente } from '../src/tipos.js'
import { actor, criatura, cuerpo, enElPiso, enLaMano, laOrilla, mundo } from './mundo.js'

// ─── El armado ──────────────────────────────────────────────────────────────

/** La escena del documento, la misma de `hito-5-el-criterio.test.ts`. */
function laEscenaDelDocumento(stamina = 310): WorldState {
  const o = laOrilla()
  const p = o.parada
  return mundo({
    dios: o.dios,
    bodies: [
      enElPiso(criatura('ana', stamina), p),
      enElPiso(cuerpo('vara', 'madera', 1, {}, 'vara'), { x: p.x + 3, y: p.y }),
      enElPiso(cuerpo('matorral', 'liana', 0.2, {}, 'hebra'), { x: p.x - 2, y: p.y + 1 }),
    ],
    actors: [actor('ana', { capacity: 3 })],
  })
}

/**
 * Un pescado COCIDO, con los números de la ley 5 medidos y no inventados.
 *
 * `digestibility 0,85` y `toxicity 0,0345` son lo que
 * `world/tests/el-veneno-se-cobra.test.ts` midió corriendo `stepWorld` de verdad
 * sobre una pieza de 2 kg en una parrilla sobre un leño encendido: 0,38 → 0,8526
 * y 0,25 → 0,0345. Se escriben en `Body.state` porque es exactamente donde la
 * ley 5 los escribe — la cocción no cambia la sustancia, cambia el cuerpo—, así
 * que este cuerpo es indistinguible de uno cocido de verdad para todo lo que la
 * mente sabe preguntar.
 *
 * Se arma a mano y no cocinando en vivo porque lo que este archivo prueba es la
 * MENTE, y hoy la mente no sabe llegar al fuego: eso es del planificador y está
 * medido abajo, en el grupo (6).
 */
function pescadoCocido(id: string, masa = 2): ReturnType<typeof cuerpo> {
  return cuerpo(id, 'pescado', masa, { digestibility: 0.85, toxicity: 0.0345 }, 'bloque')
}

function vistaDe(p: Partida, quien: string): VistaDeLaMente {
  return new Contexto(p.proyeccion, { actor: quien, rng: p.dado.tirar, lugares: p.lugares }).ctx
}

function aliento(p: Partida, quien: string): number {
  const b = p.state.bodies.get(`${quien}-cuerpo`)
  return b === undefined ? 0 : qualityOf(b.body, 'stamina', p.state.phys)
}

interface Corrida {
  readonly murioEn: number
  readonly bocados: number
  readonly pescas: number
  readonly nombres: readonly string[]
  readonly partida: Partida
  readonly mente: Mente
}

/** `n` ticks por el bucle de producción, contando qué despegó. */
function correr(w: WorldState, quien: string, n: number): Corrida {
  const p = new Partida(w)
  const m = new Mente({ actor: quien, memoria: new Creencias() })
  const mentes = new Map([[quien, m]])
  const nombres: string[] = []
  let murioEn = -1
  for (let t = 0; t < n; t++) {
    const antes = m.despegues
    vivir(p, mentes, 1)
    if (m.despegues > antes) nombres.push(m.ultimoDespegue ?? '?')
    if (murioEn < 0 && !p.state.actors.has(quien)) murioEn = t
  }
  return {
    murioEn,
    bocados: nombres.filter((x) => x.startsWith('tragar')).length,
    pescas: nombres.filter((x) => x === 'aplicar(extraccion)').length,
    nombres,
    partida: p,
    mente: m,
  }
}

/** El bocado que la mente elegiría AHORA, si elegiría alguno. */
function elBocado(v: VistaDeLaMente): Opportunity | undefined {
  const ops = opportunities(v, new Creencias(), necesidades(v))
  return ops.find((o) => o.bocado !== undefined)
}

const dos = (x: number): string => x.toFixed(4)

// ─── (1) La cuenta ──────────────────────────────────────────────────────────

describe('(1) el neto y la tolerancia salen del mundo, no de una tabla', () => {
  it('el pescado CRUDO de la corrida canónica da negativo, y por eso no hay bocado', () => {
    const r = correr(laEscenaDelDocumento(), 'ana', 400)
    const a = r.partida.state.actors.get('ana')
    const filas: string[] = []
    let elPescado: { masa: number; cal: number; tox: number; neto: number } | undefined
    for (const id of a?.holding ?? []) {
      const b = r.partida.state.bodies.get(id)
      if (b === undefined) continue
      const masa = qualityOf(b.body, 'mass', r.partida.state.phys)
      const cal = qualityOf(b.body, 'calories', r.partida.state.phys)
      const tox = qualityOf(b.body, 'toxicity', r.partida.state.phys)
      const neto = cal * STAMINA_POR_CALORIA - tox * masa * COSTO_POR_TOXICIDAD_Y_KILO
      filas.push(`  ${b.body.id}  masa ${dos(masa)}  cal ${dos(cal)}  tox ${dos(tox)}  →  neto ${dos(neto)}`)
      if (cal > 0) elPescado = { masa, cal, tox, neto }
    }
    console.log(`\n─── LO QUE TIENE EN LA MANO DESPUÉS DE PESCAR ───\n${filas.join('\n')}\n`)

    // Pescó, o sea que la cadena de la caña sigue andando.
    expect(r.pescas).toBeGreaterThan(0)
    expect(elPescado).toBeDefined()
    // Y lo que sacó ENVENENA: el neto es negativo, así que tragarlo la deja peor.
    expect(elPescado?.neto ?? 0).toBeLessThan(0)
    // Por lo tanto no hay bocado que ofrecer, y la mente no come. No es que no
    // sepa: es que la cuenta le dice que no.
    expect(elBocado(vistaDe(r.partida, 'ana'))).toBeUndefined()
    expect(r.bocados).toBe(0)
  })

  it('el pescado COCIDO sí es un bocado, con su neto y su tolerancia calculados', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enLaMano(pescadoCocido('cocido'), { x: 0, y: 0 }, 'ana'),
      ],
      actors: [actor('ana', { holding: ['cocido'] })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    const b = p.state.bodies.get('cocido')
    if (b === undefined) throw new Error('sin cocido')
    const masa = qualityOf(b.body, 'mass', p.state.phys)
    const cal = qualityOf(b.body, 'calories', p.state.phys)
    const tox = qualityOf(b.body, 'toxicity', p.state.phys)

    const o = elBocado(v)
    console.log(
      `\n─── EL BOCADO, PRECIADO ───\n` +
        `  cocido  masa ${dos(masa)}  cal ${dos(cal)}  tox ${dos(tox)}\n` +
        `  neto ${dos(o?.bocado?.neto ?? 0)}  ·  tolera hasta ${dos(o?.bocado?.toxicidadTolerada ?? 0)} de veneno\n` +
        `  «${o?.porque ?? ''}»\n`,
    )
    expect(o?.bocado?.id).toBe('cocido')
    // El neto es la cuenta del mundo copiada: acredita las calorías y cobra el
    // veneno sobre el bocado entero.
    expect(o?.bocado?.neto).toBeCloseTo(cal * STAMINA_POR_CALORIA - tox * masa * COSTO_POR_TOXICIDAD_Y_KILO, 12)
    // Y la tolerancia es el punto donde ese neto cruza el cero: `gana / (masa·K)`.
    expect(o?.bocado?.toxicidadTolerada).toBeCloseTo(
      (cal * STAMINA_POR_CALORIA) / (masa * COSTO_POR_TOXICIDAD_Y_KILO),
      12,
    )
    // Y NO es el 0,2 de fábrica. Acá da 0,2720 —o sea que el número fijo habría
    // sido de más—, y en el test de abajo, con el tanque casi lleno, da 0,0400
    // —o sea que habría sido de menos, y la criatura se habría envenenado
    // creyendo que se cuidaba—. El defecto del 0,2 no es su tamaño: es que no
    // depende de nada.
    expect(o?.bocado?.toxicidadTolerada ?? 0).toBeGreaterThan(tox)
    expect(o?.bocado?.toxicidadTolerada).toBeCloseTo(0.272, 12)
  })
})

// ─── (2) La decisión ────────────────────────────────────────────────────────

describe('(2) la misma comida, dos criaturas: la tolerancia sale de una cuenta', () => {
  it('la llena rechaza lo que la flaca come, y nadie escribió un umbral', () => {
    const TANQUE = specOf('stamina').range[1]
    // Un bocado chico y feo: poca comida y bastante veneno. Ni cocido ni crudo —
    // es el borde, que es donde una decisión se ve.
    const feo = (): ReturnType<typeof cuerpo> => cuerpo('feo', 'pescado', 0.5, { digestibility: 0.85, toxicity: 0.12 }, 'bloque')
    const con = (stamina: number): Opportunity | undefined => {
      const w = mundo({
        bodies: [enElPiso(criatura('ana', stamina), { x: 0, y: 0 }), enLaMano(feo(), { x: 0, y: 0 }, 'ana')],
        actors: [actor('ana', { holding: ['feo'] })],
      })
      return elBocado(vistaDe(new Partida(w), 'ana'))
    }
    const flaca = con(310)
    const llena = con(TANQUE - 1)

    console.log(
      `\n─── EL MISMO BOCADO, DOS TANQUES ───\n` +
        `  flaca (310/${String(TANQUE)}):  tolera ${dos(flaca?.bocado?.toxicidadTolerada ?? 0)}  ·  neto ${dos(flaca?.bocado?.neto ?? 0)}  →  ${flaca === undefined ? 'NO come' : 'come'}\n` +
        `  llena (${String(TANQUE - 1)}/${String(TANQUE)}):  ${llena === undefined ? 'NO come' : `tolera ${dos(llena.bocado?.toxicidadTolerada ?? 0)}`}\n`,
    )

    expect(flaca?.bocado).toBeDefined()
    // Y la llena NO. No porque sea prudente: porque las calorías se le derraman
    // —el tanque topa— y el veneno se le cobra entero igual. La misma desigualdad
    // da vuelta el resultado sola.
    expect(llena).toBeUndefined()
  })

  it('y la tolerancia crece cuando el tanque se vacía, monótona', () => {
    // 40 kg de pescado cocido son 272 calorías y 34,50 de veneno, así que el
    // tramo donde el TANQUE manda —y no las calorías del bocado— es el de un
    // margen entre esos dos números: `stamina` entre 728 y 965. Fuera de ahí la
    // tolerancia se satura contra las calorías del bocado, que es correcto y no
    // es lo que este test mira.
    const gordo = (): ReturnType<typeof cuerpo> => pescadoCocido('gordo', 40)
    const tolerancias: number[] = []
    for (const st of [960, 900, 850, 800, 750]) {
      const w = mundo({
        bodies: [enElPiso(criatura('ana', st), { x: 0, y: 0 }), enLaMano(gordo(), { x: 0, y: 0 }, 'ana')],
        actors: [actor('ana', { holding: ['gordo'] })],
      })
      tolerancias.push(elBocado(vistaDe(new Partida(w), 'ana'))?.bocado?.toxicidadTolerada ?? 0)
    }
    console.log(`\n─── TOLERANCIA CONTRA ALIENTO (960→750) ───\n  ${tolerancias.map(dos).join(' · ')}\n`)
    for (let i = 1; i < tolerancias.length; i++) {
      expect(tolerancias[i] ?? 0).toBeGreaterThan(tolerancias[i - 1] ?? 0)
    }
  })
})

// ─── (3) La cadena completa ─────────────────────────────────────────────────

describe('(3) contra `stepWorld`: come, sube el aliento, y vive más', () => {
  it('con comida al alcance la criatura traga sola, y se le nota en el tanque', () => {
    const cocidos = [0, 1, 2, 3].map((i) => pescadoCocido(`cocido${String(i)}`, 20))
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        ...cocidos.map((b, i) => enElPiso(b, { x: i + 1, y: 0 })),
      ],
      actors: [actor('ana', { capacity: 3 })],
    })
    const r = correr(w, 'ana', 600)
    const final = aliento(r.partida, 'ana')
    console.log(
      `\n─── LA MENTE CON COMIDA DELANTE ───\n` +
        `  bocados ${String(r.bocados)}  ·  murió en ${String(r.murioEn)}  ·  aliento final ${dos(final)}\n` +
        `  lo que voló: ${[...new Set(r.nombres)].join(' · ')}\n`,
    )
    // COME. Es el número que faltaba.
    expect(r.bocados).toBeGreaterThan(0)
    // Y el aliento subió por encima de los 310 con los que arrancó, o sea que lo
    // que tragó pagó de verdad: no es que dejó de gastar, es que ganó.
    expect(final).toBeGreaterThan(310)
    expect(r.murioEn).toBe(-1)
  })

  it('lo mismo, contra la misma escena sin comer: la diferencia es la vida', () => {
    // El control: los mismos cuerpos, la misma criatura, pero CRUDOS. Ni un
    // bocado, y se muere cuando se le acaba el tanque.
    const crudos = [0, 1, 2, 3].map((i) => cuerpo(`crudo${String(i)}`, 'pescado', 20, {}, 'bloque'))
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        ...crudos.map((b, i) => enElPiso(b, { x: i + 1, y: 0 })),
      ],
      actors: [actor('ana', { capacity: 3 })],
    })
    const r = correr(w, 'ana', 6400)
    console.log(
      `\n─── EL CONTROL: LA MISMA ESCENA, CRUDA ───\n` +
        `  bocados ${String(r.bocados)}  ·  murió en ${String(r.murioEn)}\n`,
    )
    expect(r.bocados).toBe(0)
    expect(r.murioEn).toBeGreaterThan(0)
  })
})

// ─── (4) No se come a sí misma ──────────────────────────────────────────────

describe('(4) no se come a sí misma, y son dos cerrojos', () => {
  it('ni siquiera cuando se levanta a sí misma con la mano', () => {
    // El adversario lo midió antes de que tragar tuviera consecuencia: D5 emite
    // `juntar({fuelEnergy > 0})` cuando lo que duele es el frío, la carne de la
    // criatura arde y pesa 2 kg, y nadie la tiene agarrada — así que `juntar` la
    // ve, camina cero celdas y la levanta. Con `cuerpo:ana-cuerpo#carnoso` a
    // 0,4324 contra 0,3815 del pescado del pozo, se ofrecía a sí misma como
    // comida Y GANABA. Ahora comer tiene consecuencia, así que hay que mirarlo.
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 310), { x: 0, y: 0 })],
      actors: [actor('ana', { holding: ['ana-cuerpo'] })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    // CERROJO 1: `lugares()` la excluye por id, en los DOS barridos —la mano y lo
    // que se ve—, así que su propio cuerpo no llega ni a preciarse.
    expect(v.self.holding.map((b) => b.id)).toContain('ana-cuerpo')
    expect(elBocado(v)).toBeUndefined()

    // CERROJO 2, y es el que aguanta si alguien borra el primero: la cuenta la
    // rechaza igual. Carne de 2 kg son 6,30 calorías y 0,30 de toxicidad, o sea
    // 15,00 de veneno: comerse a sí misma le costaría 8,70 de aliento.
    const b = p.state.bodies.get('ana-cuerpo')
    if (b === undefined) throw new Error('sin cuerpo')
    const masa = qualityOf(b.body, 'mass', p.state.phys)
    const cal = qualityOf(b.body, 'calories', p.state.phys)
    const tox = qualityOf(b.body, 'toxicity', p.state.phys)
    const neto = cal * STAMINA_POR_CALORIA - tox * masa * COSTO_POR_TOXICIDAD_Y_KILO
    console.log(`\n─── COMERSE A SÍ MISMA ───\n  masa ${dos(masa)}  cal ${dos(cal)}  tox ${dos(tox)}  →  neto ${dos(neto)}\n`)
    expect(neto).toBeLessThan(0)
  })

  it('y tampoco le come de la mano a otro, que es lo que `comer` tampoco hace', () => {
    const w = mundo({
      bodies: [
        enElPiso(criatura('ana', 310), { x: 0, y: 0 }),
        enElPiso(criatura('beto', 310), { x: 1, y: 0 }),
        enLaMano(pescadoCocido('suyo'), { x: 1, y: 0 }, 'beto'),
      ],
      actors: [actor('ana'), actor('beto', { holding: ['suyo'] })],
    })
    const v = vistaDe(new Partida(w), 'ana')
    expect(v.see([]).some((b) => b.id === 'suyo')).toBe(true)
    expect(elBocado(v)).toBeUndefined()
  })
})

// ─── (5) Los cerrojos de bucle ──────────────────────────────────────────────

describe('(5) los cerrojos: un bocado que no se puede tragar no tilda la escalera', () => {
  it('sin permiso irreversible no hay bocado: `comer` se rendiría sin gastar un tick', () => {
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 310), { x: 0, y: 0 }), enLaMano(pescadoCocido('c'), { x: 0, y: 0 }, 'ana')],
      actors: [actor('ana', { holding: ['c'], permits: 'reversible' })],
    })
    expect(elBocado(vistaDe(new Partida(w), 'ana'))).toBeUndefined()
  })

  it('un bocado que el mundo rechazó no se vuelve a ofrecer hasta que algo salga bien', () => {
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 310), { x: 0, y: 0 }), enLaMano(pescadoCocido('c'), { x: 0, y: 0 }, 'ana')],
      actors: [actor('ana', { holding: ['c'] })],
    })
    const p = new Partida(w)
    const v = vistaDe(p, 'ana')
    const e = nuevoEstado()
    const o = { actor: 'ana', memoria: new Creencias() }

    e.tick = 1
    const d1 = decidir(v, e, o)
    expect(d1.k).toBe('volar')
    expect(d1.k === 'volar' ? d1.paso.k : '').toBe('tragar')

    // El mundo lo rechaza: `aterrizar(false)` sobre un `tragar` anota el cuerpo.
    e.enVuelo = d1.k === 'volar' ? d1.paso : undefined
    e.deFondo = true
    // (se aterriza a mano porque acá no hay vuelo de verdad: lo que se prueba es
    // el cerrojo de la escalera, no el de la `Partida`.)
    aterrizar(e, false)
    expect(e.bocadoQueFallo).toBe('c')

    e.tick = 2
    const d2 = decidir(v, e, o)
    expect(d2.k === 'volar' && d2.paso.k === 'tragar').toBe(false)

    // Y vuelve a estar sobre la mesa apenas algo sale bien.
    aterrizar(e, true)
    expect(e.bocadoQueFallo).toBeUndefined()
  })

  it('D3 saltea la oportunidad que ya está cumplida en vez de gastar el tick en ella', () => {
    // Sin este portón, dos metas parecidas se tapan: la barata gana siempre, ya
    // está cumplida siempre, y la cara no se mira nunca. Se prueba con un
    // predicado de CUALIDAD por herencia —cuando esto se escribió era el único que
    // la vista sabía contestar, porque `holding(tag:…)` daba `false` siempre— y se
    // deja así a propósito: el portón tiene que andar para CUALQUIER predicado que
    // el intérprete entienda, y el de `sostiene` ya está medido en el grupo (6).
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 310), { x: 0, y: 0 }), enElPiso(cuerpo('roca', 'pedernal', 5), { x: 1, y: 0 })],
      actors: [actor('ana')],
    })
    const v = vistaDe(new Partida(w), 'ana')
    const cumplida = 'mass>=1'
    expect(interpretar(cumplida)).toBeDefined()

    const e = nuevoEstado()
    e.tick = 1
    decidir(v, e, {
      actor: 'ana',
      memoria: new Creencias(),
      oportunidades: () => [
        { meta: cumplida, valor: 99, id: 'a#x', porque: 'la que ya tengo' },
        { meta: 'temperature>=400', valor: 1, id: 'b#x', porque: 'la que falta' },
      ],
    })
    // No tomó la cumplida: tomó la otra, o se cayó a D5 — lo que NO puede pasar
    // es que la meta en curso sea la que ya estaba cumplida.
    expect(e.metaEnCurso).not.toBe(cumplida)
  })
})

// ─── (6) Lo que queda del otro lado ─────────────────────────────────────────

describe('(6) «algo comestible en la mano»: lo que la mente pide y lo que falta', () => {
  it('la mente pide la condición despejada de la cuenta, sin nombrar el fuego', () => {
    const meta = metaComestibleDe('carnoso')
    console.log(
      `\n─── LO QUE LA MENTE PIDE ───\n` +
        `  «${String(meta)}»\n` +
        `  el 0,0528 es el peor carnoso del catálogo (molusco, 1,32 cal/kg) sobre K=25\n` +
        `  ¿algún esquema del planificador lo puede establecer?  ${sinVocabulario(meta ?? '') ? 'NO' : 'sí'}\n`,
    )
    expect(meta).toBe('holding(tag:carnoso,toxicity<0.0528)')
    expect(venenoQueBanca('carnoso')).toBeCloseTo(0.0528, 12)
    // Y NO hay un solo literal de cocción en el paquete: la meta no dice fuego, ni
    // parrilla, ni leña. Dice cuánta toxicidad se banca, que es lo único que la
    // criatura sabe de verdad.
    expect(meta ?? '').not.toContain('temperature')
  })

  it('EN LA CORRIDA CANÓNICA: deja de querer «un pescado» y pasa a querer uno que no la envenene', () => {
    // ÉSTE es el cambio de conducta que el tramo tenía que producir, medido sobre
    // la escena del criterio y sin tocarla. Antes la mente se quedaba con
    // `holding(tag:carnoso)` para siempre; ahora la consigue, se da cuenta de que
    // la consiguió, y sube el pedido.
    //
    // ─── Y POR CUÁL DE LAS DOS PUERTAS SE DA CUENTA, QUE SE DIO VUELTA ─────
    //
    // `yaEstaCumplida` pregunta dos cosas: `loConseguido` —la memoria de que un
    // plan SUYO estableció la meta y lo que rindió sigue en la mano— y `cumple`
    // contra la vista. Cuando este test se escribió, la única que sabía contestar
    // por `sostiene` era la memoria, y por eso afirmaba
    // `conseguido?.meta === 'holding(tag:carnoso)'`.
    //
    // Hoy contesta `cumple`, y la memoria sale **`undefined`**: se llena cuando el
    // ÚLTIMO paso de un plan aterriza bien, y el vuelo que saca el pescado aterriza
    // con `ok:false` porque la propia mente lo interrumpe en el tick en que la meta
    // se cumple. O sea que el rodeo quedó sin usar en este camino: el cambio de
    // pedido lo produce el predicado, que es la puerta de la que este mismo
    // comentario decía «el día que esto conteste, el rodeo deja de ser necesario».
    const p = new Partida(laEscenaDelDocumento())
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    const mentes = new Map([['ana', m]])
    const comestible = metaComestibleDe('carnoso')
    let cambio = -1
    for (let t = 0; t < 400 && cambio < 0; t++) {
      vivir(p, mentes, 1)
      if (m.estado.metaEnCurso === comestible) cambio = t
    }
    const v = vistaDe(p, 'ana')
    const ops = opportunities(v, new Creencias(), necesidades(v))
    console.log(
      `\n─── LA MENTE SUBE EL PEDIDO ───\n` +
        `  cambió de meta en el tick ${String(cambio)}: «${String(comestible)}»\n` +
        `  y lo que se acuerda de haber conseguido: ${JSON.stringify(m.estado.conseguido)}\n` +
        `  la lista de D3 con el pescado ya en la mano:\n` +
        ops
          .slice(0, 6)
          .map((o) => `      ${o.valor.toFixed(4).padStart(9)}  ${o.id.padEnd(34)} ${o.meta}`)
          .join('\n') +
        `\n`,
    )
    expect(cambio).toBeGreaterThan(0)
    expect(m.estado.conseguido).toBeUndefined()
    // Y la que sí contesta: el predicado, contra la vista, con el pescado agarrado.
    const barataCumplida = interpretar('holding(tag:carnoso)')
    if (barataCumplida === undefined) throw new Error('sin predicado')
    expect(v.self.holding.length).toBeGreaterThan(0)
    expect(cumple(barataCumplida, v)).toBe(true)
    // La meta cara vale MENOS que la barata —cuesta el fuego— y aun así gana,
    // porque la barata ya está cumplida y D3 la saltea. Si el orden alcanzara,
    // no haría falta ningún portón.
    const barata = ops.find((o) => o.meta === 'holding(tag:carnoso)')
    const cara = ops.find((o) => o.meta === comestible)
    expect(cara?.valor ?? 0).toBeLessThan(barata?.valor ?? 0)
    expect(sinVocabulario(cara?.meta ?? '')).toBe(false)
  })

  /**
   * HASTA DÓNDE LLEGA HOY LA CADENA, Y DÓNDE SE CORTA. No es de este paquete.
   *
   * Con el pescado en la mano y la meta comestible tomada, `plan()` ya no
   * contesta «ningún esquema establece eso»: **regresa hasta la ley de cocción y
   * se corta en el fuego**. Medido, con el `missing` textual de la corrida:
   *
   *     gap · missing «emitsPower<410&emitsPower>=253»
   *     why «ningún esquema conocido establece «emitsPower<410» (lo más cerca que
   *          llega el catálogo es «emitsPower>0»)…»
   *     nearest = [aplicar(extraccion)] — o sea «mientras tanto, seguí pescando»
   *
   * (El `nearest` era lo que explicaba las 199 pescas de la corrida canónica: la
   * mente pedía lo correcto y el planificador le contestaba con lo único que sabía
   * hacer mientras tanto, que era pescar otro. Ese número ya no existe —hoy son
   * DOS tiros de caña, medido en `hito-5-el-criterio.test.ts`— porque el pescado
   * en la mano ya cuenta. Lo que sigue igual es el corte: el `gap` de la ventana
   * de potencia.)
   *
   * Este test se pone verde el día que el planificador cierre la ventana de
   * potencia del fuego. No hay nada que tocar de este lado: la meta ya es la
   * correcta, el bocado ya sabe preciar lo cocido (grupo 1) y la mente ya sabe
   * tragarlo (grupo 3).
   */
  it.fails('LO QUE FALTA, Y ES DE `@anima/plan`: que la cadena hasta el fuego cierre', () => {
    const p = new Partida(laEscenaDelDocumento())
    const m = new Mente({ actor: 'ana', memoria: new Creencias() })
    vivir(p, new Map([['ana', m]]), 200)
    const v = vistaDe(p, 'ana')
    const meta = interpretar(metaComestibleDe('carnoso') ?? '')
    if (meta === undefined) throw new Error('sin predicado')
    const r = plan({ id: 'meta', goal: meta, after: [], porque: 'el test' }, v, EXPANSIONES_POR_TICK * 40)
    console.log(`\n─── HASTA DÓNDE LLEGA LA CADENA ───\n  ${r.k}${r.k === 'gap' ? `  missing «${r.missing}»` : ''}\n`)
    expect(r.k).toBe('plan')
  })

  /**
   * EL HUECO DE ABAJO, QUE SE TAPÓ, Y ESTE TEST ES EL QUE LO MIDE.
   *
   * Estaba escrito como `it.fails` y decía: «`cumpleCuerpo` de `@anima/plan`
   * contesta `false` para TODA forma `sostiene` —una `BodyView` no trae la
   * sustancia ni sus tags—, así que `holding(tag:carnoso)` no se da por cumplida
   * nunca, ni con el pescado en la mano. La mente lo esquiva acordándose de lo que
   * su propio plan consiguió, que es evidencia legítima y no una adivinanza, pero
   * es un rodeo, y sólo funciona para lo que ELLA misma consiguió: un pescado que
   * se encuentra tirado en el piso y se levanta con `juntar` no cuenta».
   *
   * Hoy contesta, y por eso el `.fails` se cayó. La escena es la que el rodeo NO
   * podía cubrir —un pescado puesto en la mano por el arnés, que ningún plan de la
   * criatura consiguió— y es exactamente la que separa las dos puertas: si la
   * respuesta viniera de `EstadoDeLaEscalera.conseguido`, acá seguiría dando
   * `false`, porque acá no hay ninguna escalera que se acuerde de nada.
   */
  it('el rodeo ya se puede borrar: `holding(tag:…)` se sabe cumplida desde la vista sola', () => {
    const w = mundo({
      bodies: [enElPiso(criatura('ana', 310), { x: 0, y: 0 }), enLaMano(pescadoCocido('c'), { x: 0, y: 0 }, 'ana')],
      actors: [actor('ana', { holding: ['c'] })],
    })
    const v = vistaDe(new Partida(w), 'ana')
    const p = interpretar('holding(tag:carnoso)')
    if (p === undefined) throw new Error('sin predicado')
    expect(cumple(p, v)).toBe(true)
    // Y la mano vacía sigue dando `false`, que es la otra mitad: si contestara
    // `true` siempre, este test verde no diría nada.
    const sinNada = mundo({
      bodies: [enElPiso(criatura('beto', 310), { x: 0, y: 0 })],
      actors: [actor('beto')],
    })
    expect(cumple(p, vistaDe(new Partida(sinNada), 'beto'))).toBe(false)
  })
})
