// ─── EL VENENO SE COBRA AL TRAGAR (ADR II-0013) ──────────────────────────────
//
// `grep toxicity world/src` devolvía CERO. La cualidad existía en el catálogo, la
// ley 6 la subía, la ley 5 la bajaba, `ctx.eat` documentaba «cuánto enferma
// (`toxicity`)» — y el mundo no la cobraba, así que **comer veneno era exactamente
// igual de bueno que comer pescado fresco de las mismas calorías**. Con eso, el
// gradiente de comida del catálogo y la ley 5 entera eran decorativos.
//
// Este archivo hace cuatro cosas, en este orden, y ninguna se puede saltear:
//
//   (a) LEE EL CATÁLOGO y muestra que la respuesta ya estaba escrita: el umbral de
//       corte de cada comida —el `K` con el que comerla cruda da exactamente cero—
//       es `nutrition · digestibility / toxicity`, y nadie lo escribió.
//   (b) BARRE `K` y elige el valor con más holgura en el umbral más ajustado,
//       medido de las dos maneras. No se elige un número: se despeja.
//   (c) CORRE LA LEY 5 DE VERDAD contra un mundo con fuego, porque a qué toxicidad
//       llega el pescado cocido **no se estima**: se mide con `stepWorld`.
//   (d) DISPARA EL COBRO EN LOS DOS SENTIDOS. Una criatura que come veneno
//       adelgaza y una que come lo mismo cocido no. Un cobro que nadie pudo hacer
//       disparar es un cero que no significa nada.
//
// Y una advertencia que este repo se ganó: el ADR II-0009 escribió «comer crudo
// negativo y cocinar positivo» mientras calibraba una constante, y esa promesa
// resultó un CONJUNTO VACÍO. Acá los dos bordes de la ventana se miden ANTES de
// elegir el número y se imprimen los dos, para que se pueda verificar que la
// ventana no está vacía en vez de creerlo.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, dtDeFrecuencia, qualityOf } from '@anima/physics'
import type { Body, Physics, QualityId } from '@anima/physics'

import { COSTO_POR_TOXICIDAD_Y_KILO, stepWorld } from '../src/step.js'
import type { WorldBody, WorldState } from '../src/step.js'
import { apply, eat } from '../src/intent.js'
import { revisarInvariantes } from '../src/invariants.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const PHYS: Physics = buildSeedPhysics()
const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

/** Un kilo de una sustancia, en la forma más neutra que hay. `calories` sale de
 *  tres cualidades `own` y no toca la geometría, así que la forma da lo mismo. */
function kilo(substance: string, q: Record<string, number> = {}): Body {
  return { id: 'k', form: 'bloque', parts: [{ substance, mass: 1, q: {} }], joints: [], state: q }
}

function q(b: Body, id: QualityId): number {
  return qualityOf(b, id, PHYS)
}

/**
 * Las doce comidas del catálogo, en el orden de la tabla del ADR II-0013 (de más
 * a menos `K` de corte). No es «las que tienen calorías»: es la lista escrita, para
 * que si mañana alguien agrega una sustancia comestible este archivo NO la incluya
 * en silencio y el `it` de más abajo —el que compara contra el catálogo entero— lo
 * diga.
 */
const LAS_DOCE = [
  'grasa',
  'medula',
  'huevo',
  'pescado',
  'carne',
  'savia',
  'grano',
  'tuberculo',
  'molusco',
  'hoja',
  'hongo',
  'raiz-dura',
] as const

/** El `K` con el que comer un kilo de esto crudo da exactamente cero. */
function kDeCorte(substance: string): number {
  const b = kilo(substance)
  const tox = q(b, 'toxicity')
  return tox > 0 ? q(b, 'calories') / tox : Number.POSITIVE_INFINITY
}

/** Lo que un kilo de esto deja en el cuerpo, con este `K`: calorías menos veneno. */
function netoCrudo(substance: string, k: number): number {
  const b = kilo(substance)
  return q(b, 'calories') - k * q(b, 'toxicity') * q(b, 'mass')
}

// ═══ (a) EL CATÁLOGO YA SABÍA LA RESPUESTA ═══════════════════════════════════

describe('(a) el umbral de corte de cada comida ya estaba escrito, y nadie lo escribió', () => {
  it('la tabla entera, con los tres grupos separándose solos', () => {
    const filas: string[] = []
    for (const s of LAS_DOCE) {
      const b = kilo(s)
      filas.push(
        `  ${s.padEnd(11)} nutrition ${q(b, 'nutrition').toFixed(1).padStart(5)} · digest. ${q(b, 'digestibility').toFixed(2)} · ` +
          `toxicity ${q(b, 'toxicity').toFixed(2)} · cal/kg ${q(b, 'calories').toFixed(2).padStart(6)} · K de corte ${kDeCorte(s).toFixed(2).padStart(7)}`,
      )
    }
    log([
      '══ (a) EL CATÁLOGO, CON SU UMBRAL DE CORTE ═══════════════════════════',
      '  K de corte = nutrition × digestibility / toxicity: el precio del veneno',
      '  con el que comer un kilo de esto CRUDO da exactamente cero.',
      '',
      ...filas,
      '',
      '  los tres grupos se separan solos y nadie los agrupó:',
      '    grasa, médula y huevo ...... crudas con cualquier K razonable',
      '    pescado, carne, savia, grano piden fuego a partir de K ≈ 12',
      '    todo lo demás .............. es veneno crudo ya con K ≈ 4',
    ])

    // Los tres grupos, afirmados y no narrados. El orden de la tabla ES el orden
    // de los cortes: si mañana alguien recalibra una sustancia y se cruza con la
    // de al lado, esto se pone rojo antes que ninguna economía.
    for (let i = 1; i < LAS_DOCE.length; i++) {
      const a = LAS_DOCE[i - 1] as string
      const b = LAS_DOCE[i] as string
      expect([a, b, kDeCorte(a) > kDeCorte(b)]).toEqual([a, b, true])
    }
    // Y que las tres seguras crudas sean EXACTAMENTE lo que un recolector sin
    // fuego comería —grasa, médula, huevos— es la clase de resultado que este
    // proyecto busca: sale del cruce de números calibrados para otra cosa.
    expect(Number(kDeCorte('grasa').toFixed(2))).toBe(308)
    expect(Number(kDeCorte('medula').toFixed(2))).toBe(198)
    expect(Number(kDeCorte('huevo').toFixed(2))).toBe(55)
    expect(Number(kDeCorte('pescado').toFixed(2))).toBe(12.16)
    expect(Number(kDeCorte('carne').toFixed(2))).toBe(10.5)
  })

  it('y no hay una decimotercera comida escondida en el catálogo', () => {
    // La lista de arriba está escrita a mano. Este `it` es el que impide que eso
    // se vuelva una mentira: si alguien agrega una sustancia con calorías, tiene
    // que aparecer acá y decidir de qué lado del corte cae.
    const conCalorias: string[] = []
    for (const s of PHYS.substances.keys()) if (q(kilo(s), 'calories') > 0) conCalorias.push(s)
    // Las tres de más son las del despiece que casi no alimentan —cuero, tendón y
    // piel—, y las tres caen del lado del veneno con cualquier K de la ventana:
    // sus cortes son 2,40, 2,00 y 1,33.
    expect(conCalorias.filter((s) => !(LAS_DOCE as readonly string[]).includes(s)).sort()).toEqual([
      'cuero',
      'piel',
      'tendon',
    ])
    for (const s of ['cuero', 'piel', 'tendon']) expect(kDeCorte(s)).toBeLessThan(4)
  })
})

// ═══ (c) LA LEY 5, CORRIDA DE VERDAD ═════════════════════════════════════════
//
// Va antes que el barrido porque el barrido la necesita: a qué `toxicity` llega el
// pescado cocido NO se estima. Se mide corriendo `leyDesnaturalizacion` adentro de
// `stepWorld`, contra un mundo con fuego de verdad.

/** Los tres roles de `friccion`, que es como se enciende. */
const ROLES_DE_FROTAR = [
  { name: 'a', body: 'va' },
  { name: 'b', body: 'vb' },
  { name: 'actor', body: 'dina-cuerpo' },
]

/**
 * El campamento: la criatura frotando dos varas, la yesca tapando una, el leño
 * sobre la yesca, la parrilla sobre el leño y la comida sobre la parrilla.
 *
 * La geometría es la de `tests/el-fuego.test.ts` y no es comodidad: `friccion`
 * pide `arrangement: held`, y `montajeDe` sólo da `contacto` a lo que APOYA o TAPA
 * a la fuente. Una celda admite UNA sola pila, así que la yesca cuelga de la
 * criatura y tapa la vara. Es la única geometría legal.
 *
 * La comida va sobre la PIEDRA y no sobre el leño para que su montaje sea
 * `parrilla` (exposición 0,25) y no `contacto` (0,6): en contacto directo el
 * equilibrio da 375 °C y el pescado se piroliza a los 260.
 */
function elCampamento(comidas: readonly (readonly [string, string])[]): WorldState {
  const bodies: WorldBody[] = [
    enElPiso(criatura('dina', 1000), EN(0, 0)),
    { body: cuerpo('va', 'madera', 0.5, { temperature: 15 }), at: EN(0, 0), heldBy: 'dina' },
    { body: cuerpo('vb', 'madera', 0.5, { temperature: 15 }), at: EN(0, 0), heldBy: 'dina' },
    { body: cuerpo('yesca', 'hoja-seca', 1), at: EN(0, 0), supportedBy: 'dina-cuerpo', covering: 'va' },
    { body: cuerpo('leno', 'madera', 1), at: EN(0, 0), supportedBy: 'yesca' },
    { body: cuerpo('parrilla', 'piedra', 0.5), at: EN(0, 0), supportedBy: 'leno' },
  ]
  for (const [id, substance] of comidas) {
    bodies.push({
      body: { ...cuerpo(id, substance, 2), form: 'filete' },
      at: EN(0, 0),
      supportedBy: 'parrilla',
    })
  }
  return mundo({ hz: 20, bodies, actors: [actor('dina', { holding: ['va', 'vb'], capacity: 3 })] })
}

/** Lo que la ley 5 le dejó a un bocado en el instante en que el mundo lo llama
 *  cocido. Las cuatro cualidades juntas: son las cuatro que entran en la cuenta. */
interface Cocido {
  readonly segundos: number
  readonly digestibility: number
  readonly toxicity: number
  readonly mass: number
  readonly calories: number
}

/**
 * EL UMBRAL DE «COCIDO», y es el del proyecto entero y no uno de este archivo:
 * `digestibility ≥ 0,85` es el que usan `world/tests/el-fuego.test.ts` y
 * `perceive/tests/ataque-a-la-costura.test.ts` para decir que una pieza salió
 * cocida y no cruda ni carbonizada.
 */
const COCIDO = 0.85

/** Corre el campamento hasta que cada comida cruza el umbral, y devuelve el
 *  instante exacto de cada una. Sesenta segundos: el leño de 1 kg da 50 s de
 *  fuego (50 s por kilo, ADR II-0011) y después la ley 6 vuelve a subir la
 *  toxicidad, así que lo que se mide es el instante y no el final. */
function cocinar(comidas: readonly (readonly [string, string])[]): Map<string, Cocido> {
  let w = elCampamento(comidas)
  const dt = dtDeFrecuencia(20)
  const out = new Map<string, Cocido>()
  for (let n = 1; n <= Math.round(60 / dt); n++) {
    const i = apply({ by: 'dina', seq: n }, w.phys, 'friccion', ROLES_DE_FROTAR)
    w = stepWorld(w, i === undefined ? [] : [i]).state
    for (const [id] of comidas) {
      if (out.has(id)) continue
      const c = w.bodies.get(id)
      if (c === undefined) continue
      const d = qualityOf(c.body, 'digestibility', w.phys)
      if (d < COCIDO) continue
      out.set(id, {
        segundos: n / 20,
        digestibility: d,
        toxicity: qualityOf(c.body, 'toxicity', w.phys),
        mass: qualityOf(c.body, 'mass', w.phys),
        calories: qualityOf(c.body, 'calories', w.phys),
      })
    }
  }
  return out
}

/** Las doce sobre la misma parrilla, cocinadas de una: la ley 5 calcula la
 *  exposición por cuerpo contra la fuente que más lo calienta y nada la reparte,
 *  así que un fuego cocina todo lo que se le apile encima al mismo precio. */
const COCIDAS = cocinar(LAS_DOCE.map((s, i) => [`c${String(i)}`, s] as const))

/** La misma tabla, indexada por sustancia. */
const POR_SUSTANCIA = ((): ReadonlyMap<string, Cocido> => {
  const m = new Map<string, Cocido>()
  LAS_DOCE.forEach((s, i) => {
    const c = COCIDAS.get(`c${String(i)}`)
    if (c !== undefined) m.set(s, c)
  })
  return m
})()

describe('(c) la ley 5, corrida de verdad contra un mundo con fuego', () => {
  it('lo que la cocción le hace a cada comida, medido y no estimado', () => {
    const filas: string[] = []
    for (const s of LAS_DOCE) {
      const c = POR_SUSTANCIA.get(s)
      const crudo = kilo(s)
      if (c === undefined) {
        filas.push(`  ${s.padEnd(11)} NO LLEGA a cocido en 60 s de fuego`)
        continue
      }
      filas.push(
        `  ${s.padEnd(11)} cocido a los ${c.segundos.toFixed(2).padStart(5)} s · digest. ${q(crudo, 'digestibility').toFixed(2)} → ${c.digestibility.toFixed(4)} · ` +
          `toxicity ${q(crudo, 'toxicity').toFixed(2)} → ${c.toxicity.toFixed(4)} (−${((1 - c.toxicity / q(crudo, 'toxicity')) * 100).toFixed(1)}%) · ` +
          `masa 2,00 → ${c.mass.toFixed(4)}`,
      )
    }
    log([
      '══ (c) LA LEY 5, MEDIDA CON `stepWorld` ══════════════════════════════',
      '  piezas de 2 kg sobre una parrilla, sobre un leño encendido frotando.',
      '  «cocido» es `digestibility ≥ 0,85`, el mismo umbral de `el-fuego.test.ts`.',
      '',
      ...filas,
      '',
      '  EL HALLAZGO: la ley 5 se lleva el veneno MUCHO más rápido de lo que',
      '  ablanda. El pescado pierde el 86% de su toxicidad ANTES de terminar de',
      '  cocinarse, y nadie escribió esa asimetría: sale de que la destoxificación',
      '  es multiplicativa y la digestibilidad se acerca a un techo.',
    ])

    // EL NÚMERO QUE COPIAN OTROS DOS ARCHIVOS, clavado acá. `metabolismo.test.ts`
    // y `oracle/tests/presupuesto.test.ts` no pueden correr esta cocción —el
    // segundo ni siquiera puede importar `@anima/world`— así que lo llevan copiado
    // con su ruta, y esto es lo que impide que la copia se quede vieja.
    const pez = POR_SUSTANCIA.get('pescado') as Cocido
    expect(Number(pez.toxicity.toFixed(4))).toBe(0.0345)
    expect(Number(pez.digestibility.toFixed(4))).toBe(0.8526)
    expect(pez.segundos).toBe(6.55)
    const bife = POR_SUSTANCIA.get('carne') as Cocido
    expect(Number(bife.toxicity.toFixed(4))).toBe(0.0205)
    expect(bife.segundos).toBe(8.1)

    // Y la asimetría, afirmada: cocinar se lleva más del 80% del veneno mientras
    // la digestibilidad todavía no llegó ni al 90% de su techo.
    for (const s of ['pescado', 'carne']) {
      const c = POR_SUSTANCIA.get(s) as Cocido
      expect([s, c.toxicity / q(kilo(s), 'toxicity') < 0.2]).toEqual([s, true])
    }
  })
})

// ═══ (b) EL BARRIDO DE `K` ═══════════════════════════════════════════════════

/** Lo que un bocado COCIDO deja, con este `K`. Sale de lo medido en (c) y no de
 *  una estimación: `calories` ya trae la masa perdida adentro, y el veneno se
 *  cobra sobre la masa que QUEDÓ. */
function netoCocido(substance: string, k: number): number {
  const c = POR_SUSTANCIA.get(substance)
  if (c === undefined) return Number.NaN
  return c.calories - k * c.toxicity * c.mass
}

describe('(b) el barrido de `K`: el número se despeja, no se elige', () => {
  it('los tres criterios del ADR II-0013 y la ventana que dejan, con sus dos bordes', () => {
    // ─── LOS TRES CRITERIOS, TRADUCIDOS A COTAS SOBRE `K` ──────────────────
    //
    //   1. grasa, médula y huevo dan NETO POSITIVO crudos  → K < min(308; 198; 55)
    //   2. pescado y carne dan NETO NEGATIVO crudos        → K > max(12,16; 10,50)
    //   3. pescado y carne COCIDOS dan neto positivo       → K < los dos cortes
    //      del cocido, que se despejan de lo medido en (c).
    const techoCrudo = Math.min(...['grasa', 'medula', 'huevo'].map(kDeCorte))
    const pisoCrudo = Math.max(...['pescado', 'carne'].map(kDeCorte))
    const corteCocido = (s: string): number => {
      const c = POR_SUSTANCIA.get(s) as Cocido
      return c.calories / (c.toxicity * c.mass)
    }
    const techoCocido = Math.min(...['pescado', 'carne'].map(corteCocido))

    const barrido: string[] = []
    for (const k of [5, 10, 12.16, 15, 20, 25, 30, 40, 55, 70]) {
      const marca = (s: string, quiere: '+' | '-'): string => {
        const v = netoCrudo(s, k)
        const ok = quiere === '+' ? v > 0 : v < 0
        return `${v.toFixed(2).padStart(8)}${ok ? ' ' : '✗'}`
      }
      barrido.push(
        `  K=${k.toFixed(2).padStart(6)} │ grasa${marca('grasa', '+')} médula${marca('medula', '+')} huevo${marca('huevo', '+')} │ ` +
          `pescado${marca('pescado', '-')} carne${marca('carne', '-')} │ pescado coc.${netoCocido('pescado', k).toFixed(2).padStart(8)} carne coc.${netoCocido('carne', k).toFixed(2).padStart(8)}`,
      )
    }

    log([
      '══ (b) EL BARRIDO DE `K` ════════════════════════════════════════════',
      '  neto de UN KILO crudo (los cinco primeros) y de UNA PIEZA DE 2 kg cocida',
      '  (los dos últimos, con la masa que la ley 5 le dejó). ✗ marca el criterio roto.',
      '',
      ...barrido,
      '',
      `  BORDE DE ABAJO ... K > ${pisoCrudo.toFixed(2)}  (el pescado crudo, criterio 2)`,
      `  BORDE DE ARRIBA .. K < ${techoCrudo.toFixed(2)}  (el huevo crudo, criterio 1)`,
      `  el criterio 3 no ata: los cocidos aguantan hasta K = ${techoCocido.toFixed(0)}, ${(techoCocido / techoCrudo).toFixed(1)}× más arriba`,
      `  LA VENTANA ....... (${pisoCrudo.toFixed(2)} ; ${techoCrudo.toFixed(2)}), o sea ${(techoCrudo / pisoCrudo).toFixed(2)}× de ancho — y NO está vacía`,
    ])

    // LA VENTANA EXISTE, y se afirma con sus dos bordes y no de palabra. El ADR
    // II-0009 se equivocó justo acá: prometió un intervalo que resultó un conjunto
    // vacío. Esto es lo que impide que vuelva a pasar sin que nadie se entere.
    expect(pisoCrudo).toBeLessThan(techoCrudo)
    expect(Number(pisoCrudo.toFixed(2))).toBe(12.16)
    expect(Number(techoCrudo.toFixed(2))).toBe(55)
    // Y el criterio 3 no es el que ata: si lo fuera, la ventana sería otra.
    expect(techoCocido).toBeGreaterThan(techoCrudo)
  })

  it('POR QUÉ 25: el valor con más holgura en el umbral más ajustado, de las dos maneras', () => {
    // «Más holgura» se puede leer de dos maneras y las dos se miden, porque elegir
    // una sola sería elegir el número por la definición y no por el mundo:
    //
    //   · POR RAZÓN — a cuántas veces de distancia queda `K` del corte que lo ata.
    //     El óptimo es la media geométrica de los dos bordes.
    //   · EN STAMINA POR KILO — cuánto sobra, en la unidad en la que el criterio
    //     está escrito («da neto positivo», «da neto negativo»). El óptimo iguala
    //     `5,5 − 0,1·K` con `0,25·K − 3,04`.
    const razon = (k: number): number => Math.min(55 / k, k / 12.16)
    const stamina = (k: number): number => Math.min(netoCrudo('huevo', k), -netoCrudo('pescado', k))

    // Los dos óptimos, barridos y no despejados a mano: se recorre la ventana en
    // pasos de una centésima y se toma el mejor. Un óptimo despejado a mano es una
    // cuenta que nadie verificó.
    let mejorRazon = 0
    let mejorStamina = 0
    let kRazon = 0
    let kStamina = 0
    for (let k = 1216; k <= 5500; k++) {
      const x = k / 100
      if (razon(x) > mejorRazon) {
        mejorRazon = razon(x)
        kRazon = x
      }
      if (stamina(x) > mejorStamina) {
        mejorStamina = stamina(x)
        kStamina = x
      }
    }

    const elegido = COSTO_POR_TOXICIDAD_Y_KILO
    log([
      '══ (b·2) POR QUÉ K = 25 ═════════════════════════════════════════════',
      `  óptimo POR RAZÓN ............ K = ${kRazon.toFixed(2)} → ${mejorRazon.toFixed(3)}× de piso`,
      `  óptimo EN STAMINA POR KILO .. K = ${kStamina.toFixed(2)} → ${mejorStamina.toFixed(3)} de piso`,
      `  ELEGIDO ..................... K = ${elegido.toFixed(2)} → ${razon(elegido).toFixed(3)}× (${((razon(elegido) / mejorRazon) * 100).toFixed(1)}% del mejor) ` +
        `y ${stamina(elegido).toFixed(3)} de stamina (${((stamina(elegido) / mejorStamina) * 100).toFixed(1)}% del mejor)`,
      '',
      '  Los dos óptimos NO coinciden (24,40 contra 25,86) y el 25 cae entre los dos,',
      '  a menos del 4% del mejor por los dos lados, y es redondo. Que no coincidan es',
      '  información: la holgura relativa y la absoluta no ordenan igual.',
      '',
      `  el huevo crudo deja ${netoCrudo('huevo', elegido).toFixed(2)} de stamina por kilo`,
      `  el pescado crudo se lleva ${(-netoCrudo('pescado', elegido)).toFixed(2)} por kilo`,
      `  el pescado COCIDO deja ${netoCocido('pescado', elegido).toFixed(2)} por pieza de 2 kg`,
    ])

    // El elegido está adentro de la ventana y cumple los tres criterios. Éstas son
    // las cinco afirmaciones del ADR, una por una y sin narración.
    for (const s of ['grasa', 'medula', 'huevo']) {
      expect([s, netoCrudo(s, elegido) > 0]).toEqual([s, true])
    }
    for (const s of ['pescado', 'carne']) {
      expect([s, netoCrudo(s, elegido) < 0]).toEqual([s, true])
      expect([s, netoCocido(s, elegido) > 0]).toEqual([s, true])
    }
    // Y a menos del 4% del óptimo por los dos lados: es la afirmación de «con más
    // holgura», y es la que se pone roja si alguien mueve el 25 sin mirar.
    expect(razon(elegido) / mejorRazon).toBeGreaterThan(0.96)
    expect(stamina(elegido) / mejorStamina).toBeGreaterThan(0.96)
  })

  it('EL MARGEN QUE PAGA EL FUEGO, que es el criterio 3 entero', () => {
    // El criterio 3 no pide sólo que el cocido dé positivo: pide que dé positivo
    // «por un margen que pague el precio de encender el fuego». Los dos precios
    // medidos, de `perceive/tests/ataque-a-la-costura.test.ts` y
    // `oracle/tests/presupuesto.test.ts` bloque 5:
    //
    //   282,17 → vara de 0,20 kg. ENCIENDE y NO COCINA (el pescado se queda en
    //            `digestibility` 0,3800). Es el número que el ADR II-0013 cita.
    //   659,86 → vara de 0,47 kg. La más barata que COCINA de verdad.
    //
    // Y cocinar NO ES RIVAL: un fuego cocina todo lo que se le apile encima al
    // mismo precio —200 pescados de 2 kg medidos en `perceive`—, así que lo que
    // hay que comparar contra el fuego es el margen ACUMULADO y no el de un bocado.
    const margen = netoCocido('pescado', COSTO_POR_TOXICIDAD_Y_KILO) - 2 * netoCrudo('pescado', COSTO_POR_TOXICIDAD_Y_KILO)
    const piezas = (precio: number): number => Math.ceil(precio / margen)
    log([
      '══ (b·3) EL MARGEN QUE PAGA EL FUEGO ════════════════════════════════',
      `  una pieza de 2 kg: cruda deja ${(2 * netoCrudo('pescado', COSTO_POR_TOXICIDAD_Y_KILO)).toFixed(2)}, cocida deja ${netoCocido('pescado', COSTO_POR_TOXICIDAD_Y_KILO).toFixed(2)}`,
      `  o sea que cocinarla vale ${margen.toFixed(2)} de stamina`,
      `  el fuego que enciende y NO cocina (282,17) se paga con ${String(piezas(282.17))} piezas`,
      `  el fuego que COCINA (659,86) se paga con ${String(piezas(659.86))} piezas`,
      '',
      '  antes del ADR II-0013 el margen era 9,12 y hacían falta 73 piezas para el',
      `  fuego que cocina; ahora son ${String(piezas(659.86))}, porque el veneno del crudo entra en el margen.`,
    ])
    // El margen tiene que ser POSITIVO y grande: si cocinar no pagara el fuego, la
    // ley 5 seguiría siendo decorativa por el otro lado.
    expect(margen).toBeGreaterThan(0)
    // Y que se pague con menos piezas que antes es la afirmación fuerte: el cobro
    // del veneno hace que cocinar valga MÁS, no menos.
    expect(piezas(659.86)).toBeLessThan(73)
  })
})

// ═══ (d) EL COBRO SE MUEVE, EN LOS DOS SENTIDOS ══════════════════════════════

/** Una criatura sola con un bocado al lado, y lo que le queda después de comerlo.
 *  Devuelve el DELTA de stamina, con los 0,05 de vivir el tick adentro. */
function comer(substance: string, estado: Record<string, number> = {}, stamina = 500): {
  readonly delta: number
  readonly cobrado: number
  readonly acreditado: number
  readonly violaciones: readonly string[]
} {
  const s = mundo({
    bodies: [
      enElPiso(criatura('ana', stamina), EN(0, 0)),
      { body: { ...cuerpo('bocado', substance, 2), state: estado }, at: EN(0, 1) },
    ],
    actors: [actor('ana')],
  })
  const antes = qualityOf((s.bodies.get('ana-cuerpo') as WorldBody).body, 'stamina', s.phys)
  const r = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'bocado')])
  const despues = qualityOf((r.state.bodies.get('ana-cuerpo') as WorldBody).body, 'stamina', r.state.phys)
  const ven = r.events.find((e) => e.k === 'enveneno')
  const conv = r.events.find((e) => e.k === 'convierte')
  return {
    delta: despues - antes,
    cobrado: ven?.k === 'enveneno' ? ven.cobrado : 0,
    acreditado: conv?.k === 'convierte' ? conv.acreditado : 0,
    violaciones: revisarInvariantes(s, r.state, r.events).map((v) => v.k),
  }
}

describe('(d) el cobro se puede hacer disparar, y en los dos sentidos', () => {
  it('la que come veneno ADELGAZA y la que come lo mismo cocido NO', () => {
    // LOS DOS SENTIDOS, con la MISMA sustancia y la MISMA masa: lo único distinto
    // es lo que la ley 5 le hizo. Un test que comparara pescado contra grasa
    // estaría midiendo el catálogo; éste mide la cocción.
    const cocido = POR_SUSTANCIA.get('pescado') as Cocido
    const crudo = comer('pescado')
    // El cocido se arma con las TRES cualidades que la ley 5 movió y no con una:
    // subir la digestibilidad sin bajar la toxicidad sería cocinar a medias, y el
    // número saldría mal en la dirección que le conviene al test.
    const alFuego = comer('pescado', {
      digestibility: cocido.digestibility,
      toxicity: cocido.toxicity,
    })

    log([
      '══ (d) EL COBRO, DISPARADO EN LOS DOS SENTIDOS ══════════════════════',
      `  pescado CRUDO de 2 kg ... acredita ${crudo.acreditado.toFixed(2)} · el veneno se lleva ${crudo.cobrado.toFixed(2)} · NETO ${crudo.delta.toFixed(2)}`,
      `  el mismo COCIDO ......... acredita ${alFuego.acreditado.toFixed(2)} · el veneno se lleva ${alFuego.cobrado.toFixed(2)} · NETO ${alFuego.delta.toFixed(2)}`,
      '',
      `  la misma materia, las dos economías: cocinar la mueve en ${(alFuego.delta - crudo.delta).toFixed(2)} de stamina`,
    ])

    expect(crudo.delta).toBeLessThan(0)
    expect(alFuego.delta).toBeGreaterThan(0)
    // Y el arnés no se queja de ninguno de los dos: el cobro pasa por `anotarGasto`
    // y por lo tanto por el `gasto` del tick, que es lo que el piso del invariante
    // de conservación lee.
    expect(crudo.violaciones).toEqual([])
    expect(alFuego.violaciones).toEqual([])
  })

  it('el cobro es proporcional a `toxicity` Y a la masa: las dos, y por separado', () => {
    // `toxicity` es INTENSIVA, así que lo que se traga es `toxicity · masa`. Si el
    // cobro dependiera sólo del intensivo, medio pescado envenenaría lo mismo que
    // uno entero — que es el bug que este `it` existe para que no vuelva.
    const uno = comer('pescado').cobrado
    const doble = comer('pescado', { toxicity: 0.5 }).cobrado
    expect(Number(uno.toFixed(6))).toBe(2 * 0.25 * COSTO_POR_TOXICIDAD_Y_KILO)
    expect(Number(doble.toFixed(6))).toBe(2 * uno)
    // Y la mitad de la masa, la mitad del veneno. Se arma a mano porque `comer`
    // fija 2 kg: el punto es que la masa entre en la cuenta.
    const s = mundo({
      bodies: [enElPiso(criatura('ana', 500), EN(0, 0)), enElPiso(cuerpo('bocado', 'pescado', 1), EN(0, 1))],
      actors: [actor('ana')],
    })
    const e = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'bocado')]).events.find((x) => x.k === 'enveneno')
    expect(e?.k === 'enveneno' ? e.cobrado : 0).toBe(uno / 2)
  })

  it('lo que no se puede pagar no se cobra, y lo que se anota es lo cobrado', () => {
    // La misma regla que `sistemaMetabolismo` y que `cobrarStamina`: `conCualidad`
    // topa la `stamina` en cero, así que a quien le quedaban 3 el mundo le sacó 3.
    // Anotar el PRECIO DE LISTA dejaría el piso del invariante por debajo de la
    // realidad, todos los tickets, y esa deuda se acumula hasta perdonar una
    // evaporación entera.
    //
    // La criatura llega con 1 de stamina, se come un pescado crudo de 2 kg (acredita
    // 6,08, veneno 12,50) y termina en cero: 1 + 6,08 = 7,08, y de ahí sale todo.
    const r = comer('pescado', {}, 1)
    expect(Number(r.cobrado.toFixed(4))).toBe(7.08)
    expect(r.violaciones).toEqual([])
    // Y ese cero MATA en el mismo tick, porque `sistemaMetabolismo` corre después
    // de las intenciones: envenenarse es una forma de morirse, y no hacía falta
    // escribir ninguna ley de intoxicación para que lo fuera (el ADR II-0013
    // descartó la ley 13 justamente por eso).
    const s = mundo({
      bodies: [enElPiso(criatura('ana', 1), EN(0, 0)), enElPiso(cuerpo('bocado', 'pescado', 2), EN(0, 1))],
      actors: [actor('ana')],
    })
    const paso = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'bocado')])
    expect(paso.events.some((e) => e.k === 'murio' && e.por === 'hambre')).toBe(true)
    expect(paso.state.actors.has('ana')).toBe(false)
  })

  it('la que come estando LLENA paga el veneno igual, y el arnés no se queja', () => {
    // El caso del techo: `conCualidad` topa la `stamina` en 1000, así que el
    // crédito de quien está lleno se pierde y el cobro NO. Es la razón por la que
    // el cobro relee el cuerpo en vez de hacer la cuenta con `stamina + acreditado`:
    // cobrar sobre una suma que el clamp nunca guardó dejaría al guardián de
    // conservación con un piso más alto que la realidad.
    const llena = comer('pescado', {}, 1000)
    expect(Number(llena.cobrado.toFixed(4))).toBe(12.5)
    expect(llena.violaciones).toEqual([])
    // Termina por debajo de donde arrancó aunque estuviera al tope: el crédito se
    // topó y el veneno no.
    expect(llena.delta).toBeLessThan(-12)
  })

  it('lo que no tiene veneno no emite el evento: un cero de más sería ruido', () => {
    // `grasa` sí tiene (0,05) y emite. Lo que no emite es lo que tiene `toxicity`
    // cero — y hoy en el catálogo no hay ninguna comida así, o sea que este `it`
    // afirma la regla y no un caso: se fabrica con `state`.
    expect(comer('grasa').cobrado).toBeGreaterThan(0)
    const s = mundo({
      bodies: [
        enElPiso(criatura('ana', 500), EN(0, 0)),
        { body: { ...cuerpo('bocado', 'grasa', 2), state: { toxicity: 0 } }, at: EN(0, 1) },
      ],
      actors: [actor('ana')],
    })
    const r = stepWorld(s, [eat({ by: 'ana', seq: 0 }, 'bocado')])
    expect(r.events.some((e) => e.k === 'enveneno')).toBe(false)
    expect(r.events.some((e) => e.k === 'comio')).toBe(true)
  })
})

// ─── Lo que este archivo NO mide, dicho con todas las letras ─────────────────
//
// LA MENTE NO SABE COCINAR. Sus metas son `holding(tag:X)` y ninguna habla de la
// cualidad de lo que tiene en la mano, así que hoy no hay forma de que la criatura
// elija poner el pescado al fuego antes de comérselo. Está escrito en el ADR
// II-0013 («lo que esto arrastra, dicho entero») y es el tramo que sigue: es lo que
// vuelve CARGA ÚTIL a la cadena del fuego que ya está medida y anda.
//
// Y LA TOLERANCIA DE `comer` (`toxicidadTolerada`, 0,2 por omisión) dejó de ser
// prudencia sin respaldo. Vive en `@anima/skills` y no en este paquete; lo que este
// archivo aporta es que ahora defiende de algo real.
