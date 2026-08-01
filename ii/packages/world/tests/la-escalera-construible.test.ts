// ─── LA ESCALERA, PERO CON LAS PIEZAS QUE EL DIOS DE VERDAD PONE ─────────────
//
// `la-escalera-de-la-yesca.test.ts` mide la escalera con cuerpos armados a mano y
// cierra con que existe: una vara frotada prende yesca y la yesca prende un leño
// que frotarlo habría costado dieciséis veces más. Sus bloques 6 y 7 miden después
// que ese kilo de yesca **no se puede construir**: las piezas vienen de 77 g,
// `union` aplana y `MAX_PARTS` vale 6, así que las seis más grandes suman 0,45 kg.
//
// De ahí el traspaso concluyó que «todavía no hay una escalera construible con el
// inventario decretado». Este archivo mide esa conclusión, y la conclusión estaba
// mal por haber buscado UNA sustancia:
//
//   · lo que un cuerpo encendido entrega no depende de la sustancia sino de
//     `fuelEnergy · masa` sumado sobre las partes (`emitsPower` es extensiva);
//   · lo que hace falta para PRENDERLO es su `ignitionPoint`, que en un cuerpo de
//     varias partes sale promediado por masa;
//   · así que un fardo MIXTO —yesca para bajar el punto de ignición, corteza para
//     subir la masa— compra las dos cosas a la vez, y entra en seis partes.
//
// Tres bloques, en el orden en que se contestan:
//
//   1. EL PISO DEL PRIMER FUEGO. Cuánta madera hay que frotar para prender lo más
//      fácil de prender que hay, y qué cuesta eso contra los dos tanques del
//      criterio. Es el escalón cero y no depende de ninguna escalera.
//   2. EL FARDO QUE SÍ ENTRA. Búsqueda sobre las piezas decretadas, con `unir` de
//      verdad y `stepWorld` corriendo.
//   3. LO QUE ESE FARDO CUESTA EN ATADORES, que es la cota que queda abierta.
//
// El método del archivo es el de la casa: el catálogo BUSCA y el mundo AFIRMA.
// Enumerar mil fardos contra `stepWorld` tarda once minutos y rompe el worker de
// vitest —ya pasó, con `Timeout calling "onTaskUpdate"`—, así que la búsqueda se
// hace con `qualityOf` y sólo el ganador se prende de verdad.

import { describe, expect, it } from 'vitest'
import {
  buildSeedPhysics,
  MAX_PARTS,
  qualityOf,
  temperaturaDeEquilibrio,
  unir,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
} from '@anima/physics'
import type { Body, Physics } from '@anima/physics'

import { crearDios, PREFIJO_SUELTA } from '../src/index.js'
import { stepWorld } from '../src/step.js'
import type { WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

/** Las mismas veinte semillas del banco de la emergencia, y el mismo arranque. */
const SEMILLA_BASE = 20260728n
const SEMILLAS = 20

/** Los dos tanques del criterio: el de la corrida canónica y el techo. */
const TANQUE_CANONICO = 310
const TANQUE_LLENO = 1000

/** Cuántas piezas de cada sustancia entran en la búsqueda del fardo. */
const CANDIDATAS_POR_SUSTANCIA = MAX_PARTS

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

// ─── Lo que se lee del catálogo, y no se copia ───────────────────────────────

function phys(): Physics {
  return buildSeedPhysics()
}

/** El `poweredBy.efficiency` de `friccion`, leído del proceso y no clavado. */
function eficienciaDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) throw new Error('friccion cambió de forma')
  return e.poweredBy.efficiency
}

/** El `toward` del `drive` de `friccion`: la temperatura que frotar consigue. */
function techoDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive') throw new Error('friccion cambió de forma')
  return e.toward
}

const TECHO_DE_FROTAR = techoDeFrotar()

/** El `rigidity` que `friccion` le pide a los dos palos. */
function rigidezQuePideFrotar(): number {
  const w = mundo()
  const r = w.phys.processes
    .get('friccion')
    ?.roles.find((x) => x.name === 'a')
    ?.where.find((c) => c.q === 'rigidity')
  if (r === undefined) throw new Error('friccion cambió de forma')
  return r.v
}

/**
 * Lo que cuesta llevar un cuerpo desde el ambiente hasta su ignición.
 *
 * Es la misma cuenta de `la-escalera-de-la-yesca.test.ts`, y da 1384,2 por kilo de
 * madera. `emergencia/tests/ataque-al-detector.test.ts` mide 1398,857 por kilo CORRIENDO
 * el mundo con una criatura frotando: la diferencia son los 14,7 de vivir los 2,4 s
 * que tarda el frotar. Los dos números están bien y miden cosas distintas; acá se
 * usa el térmico porque lo que se compara es el precio de la MATERIA.
 */
function costoDeEncender(b: Body, p: Physics): number {
  const cap = qualityOf(b, 'heatCapacity', p)
  const ign = qualityOf(b, 'ignitionPoint', p)
  return (cap * (ign - T_AMBIENTE)) / eficienciaDeFrotar()
}

/** Lo que un cuerpo ARDIENDO entrega a lo que tiene pegado encima. */
function loQueEntrega(b: Body, p: Physics): number {
  const encendido = { ...b, state: { ...b.state, temperature: qualityOf(b, 'ignitionPoint', p) + 50 } }
  return temperaturaDeEquilibrio(qualityOf(encendido, 'emitsPower', p), 0, 'contacto')
}

/**
 * La vara de madera más liviana que, ardiendo, EQUILIBRARÍA por encima de
 * `objetivo` °C. Es una ESTIMACIÓN de catálogo y sirve para ordenar candidatos,
 * no para publicar un precio, por dos razones que la primera versión de este
 * archivo se comió enteras y que dejaron los dos bloques rojos:
 *
 *   · el equilibrio se alcanza asintóticamente. Una fuente que equilibra en
 *     180,1 °C nunca cruza los 180 en tiempo finito;
 *   · y mientras tanto la fuente SE APAGA. `emitsPower` sale de `fuelEnergy`, que
 *     la ley 3 va gastando, así que la meseta a la que el objetivo corre **baja**
 *     mientras el objetivo sube. Una vara de 0,4620 kg equilibra en 181,6 y no
 *     prende la hoja ni en 3000 ticks.
 *
 * Lo que se publica sale de `varaQueDeVerdadPrende`, que corre el mundo.
 */
function varaEstimada(objetivo: number, p: Physics): number {
  let bajo = 0
  let alto = 8
  for (let i = 0; i < 60; i += 1) {
    const medio = (bajo + alto) / 2
    if (loQueEntrega(cuerpo('v', 'madera', medio), p) > objetivo) alto = medio
    else bajo = medio
  }
  return alto
}

/**
 * La vara de madera más liviana que PRENDE `objetivo` corriendo `stepWorld`.
 * Bisección sobre el mundo, con el arranque en el `toward` de `friccion`: es lo
 * que la criatura consigue frotando, no lo que se le regala.
 */
function varaQueDeVerdadPrende(objetivo: Body, alto = 4): number {
  let bajo = 0
  let arriba = alto
  if (prende(cuerpo('f', 'madera', arriba, { temperature: TECHO_DE_FROTAR }), objetivo) < 0) {
    return Number.POSITIVE_INFINITY
  }
  for (let i = 0; i < 14; i += 1) {
    const medio = (bajo + arriba) / 2
    if (prende(cuerpo('f', 'madera', medio, { temperature: TECHO_DE_FROTAR }), objetivo) > 0) arriba = medio
    else bajo = medio
  }
  return arriba
}

// ─── El inventario decretado ─────────────────────────────────────────────────

interface Pieza {
  readonly cuerpo: Body
  readonly sustancia: string
  readonly masa: number
}

/** Las sueltas de los nueve chunks del arranque, ya materializadas. */
function sueltasDe(semilla: bigint): { readonly p: Physics; readonly piezas: readonly Pieza[] } {
  const base = mundo({
    bodies: [enElPiso(criatura('medidor'), EN(0, 0))],
    actors: [actor('medidor')],
  })
  const w = stepWorld({ ...base, dios: crearDios(semilla) }, []).state
  const piezas: Pieza[] = []
  for (const c of w.bodies.values()) {
    if (!c.body.id.startsWith(PREFIJO_SUELTA)) continue
    if (!(qualityOf(c.body, 'fuelEnergy', w.phys) > 0)) continue
    const sub = c.body.parts[0]?.substance
    if (sub === undefined) continue
    piezas.push({ cuerpo: c.body, sustancia: sub, masa: qualityOf(c.body, 'mass', w.phys) })
  }
  return { p: w.phys, piezas }
}

/** El atador de `unir`: es su rol, no una lista de sustancias. */
function esAtador(b: Body, p: Physics): boolean {
  return qualityOf(b, 'flexibility', p) >= 0.8 && qualityOf(b, 'tensile', p) >= 0.3
}

// ─── La búsqueda del fardo, hecha con el catálogo ────────────────────────────

interface Fardo {
  readonly piezas: readonly Pieza[]
  readonly masa: number
  /** Lo que hace falta para prenderlo: su `ignitionPoint` promediado por masa. */
  readonly ignicion: number
  /** Lo que entrega una vez prendido, en contacto. */
  readonly entrega: number
  /** La vara de madera más liviana que lo prende, y lo que cuesta frotarla. */
  readonly vara: number
  readonly costo: number
}

/**
 * El mejor fardo legal de estas piezas para prender `objetivo` °C, entendiendo por
 * mejor **el más barato de encender**: lo único que la criatura paga es frotar la
 * vara, así que la escalera se elige por su escalón cero.
 *
 * La enumeración es por COMPOSICIÓN —cuántas piezas de cada sustancia— sobre las
 * `CANDIDATAS_POR_SUSTANCIA` más pesadas de cada una. Dentro de una sustancia las
 * más pesadas dominan a las livianas para las dos mitades de la cuenta (más masa
 * es más potencia, y el punto de ignición promediado no cambia), así que no hace
 * falta mirar las otras.
 */
function mejorFardo(piezas: readonly Pieza[], objetivo: number, p: Physics): Fardo | undefined {
  const porSustancia = new Map<string, Pieza[]>()
  for (const pieza of piezas) {
    const xs = porSustancia.get(pieza.sustancia) ?? []
    xs.push(pieza)
    porSustancia.set(pieza.sustancia, xs)
  }
  const grupos = [...porSustancia.values()].map((xs) =>
    [...xs].sort((a, b) => b.masa - a.masa).slice(0, CANDIDATAS_POR_SUSTANCIA),
  )

  let mejor: Fardo | undefined
  const cuantas: number[] = []
  const visita = (i: number, usadas: number): void => {
    if (i === grupos.length) {
      if (usadas === 0) return
      const elegidas: Pieza[] = []
      for (let g = 0; g < grupos.length; g += 1) elegidas.push(...grupos[g]!.slice(0, cuantas[g]))
      const fardo = evaluar(elegidas, p)
      if (fardo === undefined || fardo.entrega <= objetivo) return
      if (mejor === undefined || fardo.costo < mejor.costo) mejor = fardo
      return
    }
    for (let n = 0; n <= Math.min(grupos[i]!.length, MAX_PARTS - usadas); n += 1) {
      cuantas[i] = n
      visita(i + 1, usadas + n)
    }
  }
  visita(0, 0)
  return mejor
}

/** Las cuentas de un fardo, todas de `qualityOf` sobre el cuerpo que `unir` daría. */
function evaluar(elegidas: readonly Pieza[], p: Physics): Fardo | undefined {
  if (elegidas.length === 0 || elegidas.length > MAX_PARTS) return undefined
  const masa = elegidas.reduce((t, x) => t + x.masa, 0)
  const ignicion =
    elegidas.reduce((t, x) => t + qualityOf(x.cuerpo, 'ignitionPoint', p) * x.masa, 0) / masa
  const potencia = elegidas.reduce(
    (t, x) => t + qualityOf(x.cuerpo, 'fuelEnergy', p) * x.masa,
    0,
  )
  // `emitsPower` es `fuelEnergy · masa · EMISSION_PER_FUEL`, y el factor se lee
  // del catálogo armando una pieza patrón en vez de copiarlo.
  const porUnidad = qualityOf(
    cuerpo('patron', 'madera', 1, { temperature: 1000 }),
    'emitsPower',
    p,
  ) / qualityOf(cuerpo('patron', 'madera', 1), 'fuelEnergy', p)
  const entrega = temperaturaDeEquilibrio(potencia * porUnidad, 0, 'contacto')
  const vara = varaEstimada(ignicion, p)
  return {
    piezas: elegidas,
    masa,
    ignicion,
    entrega,
    vara,
    costo: costoDeEncender(cuerpo('vara', 'madera', vara), p),
  }
}

// ─── Lo que el mundo AFIRMA ──────────────────────────────────────────────────

/** `fuente` ardiendo con `objetivo` pegado encima: en qué tick empieza a emitir. */
function prende(fuente: Body, objetivo: Body, techo = 3_000): number {
  let w: WorldState = mundo({
    bodies: [
      enElPiso({ ...fuente, id: 'fuente' }, EN(0, 0)),
      {
        ...enElPiso({ ...objetivo, id: 'objetivo', state: { ...objetivo.state, temperature: T_AMBIENTE } }, EN(0, 0)),
        supportedBy: 'fuente',
      },
    ],
  })
  for (let tick = 1; tick <= techo; tick += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('objetivo')
    if (c === undefined) return -1
    if (qualityOf(c.body, 'emitsPower', w.phys) > 0) return tick
  }
  return -1
}

/** El fardo armado con `unir` de verdad, atador por atador. */
function armar(elegidas: readonly Pieza[], atadores: readonly Pieza[], p: Physics): Body | undefined {
  if (elegidas.length === 0) return undefined
  if (atadores.length < elegidas.length - 1) return undefined
  let out = elegidas[0]!.cuerpo
  for (let i = 1; i < elegidas.length; i += 1) {
    const siguiente = unir(out, elegidas[i]!.cuerpo, atadores[i - 1]!.cuerpo, p, `fardo-${String(i)}`)
    if (siguiente === undefined) return undefined
    out = siguiente
  }
  return out
}

describe('la escalera construible', () => {
  it('1 · EL PISO DEL PRIMER FUEGO: lo más barato que se puede encender, contra los dos tanques', () => {
    // El escalón cero no tiene nada que ver con la escalera: es cuánta madera hay
    // que frotar para que lo que arda alcance a prender LO MÁS FÁCIL DE PRENDER
    // que existe. Debajo de eso no hay fuego posible, ni con escalera ni sin ella.
    const p = phys()
    const RIG = rigidezQuePideFrotar()
    const filas: string[] = [
      '─── EL ESCALÓN CERO ───',
      `  frotar pide rigidity ≥ ${RIG.toFixed(2)}, así que la vara es de madera y el precio va con su masa`,
      '',
      '  qué se quiere prender │ ignición │ vara estimada │ vara MEDIDA │ costo │ ¿lo paga 310? │ ¿lo paga 1000?',
      '  ──────────────────────┼──────────┼───────────────┼─────────────┼───────┼───────────────┼───────────────',
    ]

    // Las sustancias que el dios decreta y que arden, ordenadas por lo fácil que
    // es prenderlas. La primera fila es el piso de todo el Hito 5.
    const { piezas } = sueltasDe(SEMILLA_BASE)
    const sustancias = [...new Set(piezas.map((x) => x.sustancia))]
      .map((s) => ({ s, ign: qualityOf(cuerpo('x', s, 1), 'ignitionPoint', p) }))
      .sort((a, b) => a.ign - b.ign)

    let piso = Number.POSITIVE_INFINITY
    let laFacil: { s: string; vara: number } | undefined
    for (const { s, ign } of sustancias) {
      const estimada = varaEstimada(ign, p)
      const medida = varaQueDeVerdadPrende(cuerpo('o', s, 0.3))
      const costo = Number.isFinite(medida) ? costoDeEncender(cuerpo('vara', 'madera', medida), p) : Number.POSITIVE_INFINITY
      if (costo < piso) {
        piso = costo
        laFacil = { s, vara: medida }
      }
      filas.push(
        `  ${s.padEnd(21)} │ ${ign.toFixed(0).padStart(8)} │ ${estimada.toFixed(4).padStart(13)} │ ` +
          `${(Number.isFinite(medida) ? medida.toFixed(4) : '—').padStart(11)} │ ` +
          `${(Number.isFinite(costo) ? costo.toFixed(0) : '—').padStart(5)} │ ` +
          `${(costo <= TANQUE_CANONICO ? 'sí' : 'NO').padStart(13)} │ ` +
          `${(costo <= TANQUE_LLENO ? 'sí' : 'NO').padStart(14)}`,
      )
    }

    // Las dos mitades del piso, para que no sea un umbral elegido: la vara medida
    // prende y una un pelo más chica no.
    const facil = laFacil
    if (facil === undefined) throw new Error('no hay nada que se pueda prender')
    const arriba = prende(cuerpo('f', 'madera', facil.vara, { temperature: TECHO_DE_FROTAR }), cuerpo('o', facil.s, 0.3))
    const abajo = prende(
      cuerpo('f', 'madera', facil.vara * 0.97, { temperature: TECHO_DE_FROTAR }),
      cuerpo('o', facil.s, 0.3),
    )

    // Y LO QUE HACE QUE ESTO SEA UN PISO DEL MUNDO Y NO DE UNA SEMILLA: lo que
    // gobierna el precio es el `ignitionPoint` del objetivo, así que el fuego más
    // barato posible es el de la sustancia ARDIBLE más fácil de prender que existe
    // en el catálogo. Si mañana el dios sembrara otra cosa, el piso no bajaría
    // salvo que esa cosa prenda por debajo de esto.
    const masFacilDelCatalogo = SUSTANCIAS_SEMILLA.filter(
      (s) => qualityOf(cuerpo('x', s.id, 1), 'fuelEnergy', p) > 0,
    )
      .map((s) => ({ s: s.id, ign: qualityOf(cuerpo('x', s.id, 1), 'ignitionPoint', p) }))
      .sort((a, b) => a.ign - b.ign)[0]
    if (masFacilDelCatalogo === undefined) throw new Error('no arde nada')

    filas.push(
      '',
      `  y en el CATÁLOGO entero, lo más fácil de prender que arde es ${masFacilDelCatalogo.s} a ` +
        `${masFacilDelCatalogo.ign.toFixed(0)} °C: el piso no es de esta semilla, es del mundo.`,
      '',
      `  la «estimada» equilibraría justo en el punto de ignición y NO alcanza: el equilibrio se`,
      `  toca en el infinito y la fuente se apaga mientras el objetivo sube. La medida es la que vale.`,
      '',
      `  lo más barato de prender es ${facil.s}, con una vara de ${facil.vara.toFixed(4)} kg = ${piso.toFixed(1)} de stamina.`,
      `  verificado en el mundo: con ${facil.vara.toFixed(4)} kg prende en el tick ${String(arriba)}; ` +
        `con ${(facil.vara * 0.97).toFixed(4)} kg ${abajo < 0 ? 'NO prende' : `prende en el tick ${String(abajo)}`}.`,
      '',
      `  EL PISO ES ${piso.toFixed(1)} Y EL TANQUE CANÓNICO ES ${String(TANQUE_CANONICO)}: ` +
        `${piso > TANQUE_CANONICO ? 'la criatura del criterio no puede encender NADA' : 'lo paga'}.`,
      `  Con el tanque lleno ${piso <= TANQUE_LLENO ? `sí lo paga, y le quedan ${(TANQUE_LLENO - piso).toFixed(1)}` : 'tampoco'}.`,
    )
    log(filas)

    // ─── LA AFIRMACIÓN DEL BLOQUE SE DIO VUELTA, Y ÉSE ERA EL PUNTO ────────
    //
    // Decía `piso > TANQUE_CANONICO` y su comentario decía: «el escalón cero cuesta
    // más que el tanque entero de la corrida canónica. Ningún trabajo sobre el
    // planificador puede darlo vuelta». Era cierto: 645,50 contra 310.
    //
    // Y no lo dio vuelta el planificador, lo dio vuelta el mundo. La eficiencia de
    // `friccion` pasó de 0,35 a 0,85 (tramo N) porque esta misma medición mostró que
    // con 0,35 el criterio (5) era aritméticamente imposible; el porqué del número
    // está en el encabezado de `FRICCION` y la ventana entera en
    // `la-cuenta-de-los-veinte-mil.test.ts`, bloque 6.
    //
    // Hoy el escalón cero sale **265,80** y el tanque canónico LO PAGA, con 44,20 de
    // margen. Sigue siendo el mismo guardián y aprieta el mismo par: si el fuego se
    // vuelve a encarecer por encima del tanque, esto se pone rojo y lo que hay que
    // releer es el bloque 3 de la cuenta.
    expect(arriba).toBeGreaterThan(0)
    expect(abajo).toBe(-1)
    expect(piso).toBeLessThan(TANQUE_CANONICO)
    expect(piso).toBeLessThan(TANQUE_LLENO)
    // Nada del catálogo prende más fácil que lo que esta semilla ya ofrece, así que
    // 645,5 es el piso del MUNDO. Sin esto, la tabla mediría una parada.
    expect(masFacilDelCatalogo.ign).toBeGreaterThanOrEqual(sustancias[0]!.ign)
  })

  it('2 · EL FARDO MIXTO QUE SÍ ENTRA EN `MAX_PARTS`, prendido en el mundo', () => {
    // La conclusión que este bloque mide: «no hay escalera construible». Se busca,
    // para cada semilla, el fardo legal MÁS BARATO DE ENCENDER que alcance a
    // prender el leño más grande que esa semilla decreta.
    const p = phys()
    const objetivoLeño = qualityOf(cuerpo('x', 'madera', 1), 'ignitionPoint', p)
    const filas: string[] = [
      '─── EL FARDO QUE SE PUEDE ARMAR CON LO QUE HAY ───',
      `  la meta: un cuerpo legal (≤ ${String(MAX_PARTS)} partes) que prenda el leño más grande decretado ` +
        `(${objetivoLeño.toFixed(0)} °C)`,
      '  «vara» y «costo» son la ESTIMACIÓN de catálogo, que sirve para ordenar candidatos y sale',
      '  ~3% barata; el precio que vale es el MEDIDO, y se corre abajo sobre el ganador.',
      '',
      '  semilla   │ el fardo                        │ masa │ ignición │ entrega │ vara~ │ costo~│ atadores',
      '  ──────────┼─────────────────────────────────┼──────┼──────────┼─────────┼───────┼───────┼─────────',
    ]

    let conFardo = 0
    let conFardoYAtadores = 0
    let ejemplo: { fardo: Fardo; atadores: Pieza[]; piezas: readonly Pieza[]; leño: Pieza; p: Physics } | undefined
    for (let k = 0; k < SEMILLAS; k += 1) {
      const semilla = SEMILLA_BASE + BigInt(k)
      const { p: pd, piezas } = sueltasDe(semilla)
      const fardo = mejorFardo(piezas, objetivoLeño, pd)
      const atadores = piezas.filter((x) => esAtador(x.cuerpo, pd))
      const leño = [...piezas]
        .filter((x) => x.sustancia === 'madera')
        .sort((a, b) => b.masa - a.masa)[0]
      if (fardo === undefined || leño === undefined) {
        filas.push(`  ${String(semilla)} │ ${'— no hay fardo que alcance —'.padEnd(31)} │`)
        continue
      }
      conFardo += 1
      const alcanzan = atadores.length >= fardo.piezas.length - 1
      if (alcanzan) conFardoYAtadores += 1
      if (ejemplo === undefined && alcanzan) ejemplo = { fardo, atadores, piezas, leño, p: pd }
      const receta = resumir(fardo.piezas)
      filas.push(
        `  ${String(semilla)} │ ${receta.padEnd(31)} │ ${fardo.masa.toFixed(2).padStart(4)} │ ` +
          `${fardo.ignicion.toFixed(1).padStart(8)} │ ${fardo.entrega.toFixed(0).padStart(7)} │ ` +
          `${fardo.vara.toFixed(3).padStart(5)} │ ${fardo.costo.toFixed(0).padStart(5)} │ ` +
          `${String(fardo.piezas.length - 1)} pide / ${String(atadores.length)} hay`,
      )
    }

    filas.push('')
    if (ejemplo === undefined) {
      filas.push('  NINGUNA semilla tiene a la vez el fardo y los atadores para armarlo.')
    } else {
      // Y acá el mundo afirma lo que el catálogo buscó: se arma con `unir`, se
      // prende con la vara y el fardo prende el leño. Tres corridas y no mil.
      const { fardo, atadores, leño, p: pd } = ejemplo
      const armado = armar(fardo.piezas, atadores, pd)
      // El precio que se publica sale del mundo: se bisecta la vara contra el
      // fardo YA ARMADO, no contra su punto de ignición despejado.
      const varaReal = armado === undefined ? Number.POSITIVE_INFINITY : varaQueDeVerdadPrende(armado)
      const costoReal = Number.isFinite(varaReal)
        ? costoDeEncender(cuerpo('vara', 'madera', varaReal), pd)
        : Number.POSITIVE_INFINITY
      const vara = cuerpo('vara', 'madera', varaReal, { temperature: TECHO_DE_FROTAR })
      const tickFardo = armado === undefined || !Number.isFinite(varaReal) ? -1 : prende(vara, armado)
      const encendido =
        armado === undefined
          ? undefined
          : { ...armado, state: { ...armado.state, temperature: qualityOf(armado, 'ignitionPoint', pd) + 50 } }
      const tickLeño = encendido === undefined ? -1 : prende(encendido, leño.cuerpo)
      filas.push(
        '  LA ESCALERA CONSTRUIBLE, corrida en el mundo:',
        `    el fardo se arma con \`unir\`: ${armado === undefined ? 'NO' : `sí, ${String(armado.parts.length)} partes, ` +
          `${qualityOf(armado, 'mass', pd).toFixed(3)} kg`}`,
        `    la vara MEDIDA de ${varaReal.toFixed(4)} kg lo prende en el tick ${String(tickFardo)} ` +
          `(la estimada era ${fardo.vara.toFixed(4)})`,
        `    el fardo prende el leño de ${leño.masa.toFixed(3)} kg en el tick ${String(tickLeño)}`,
        `    frotar ese leño habría costado ${costoDeEncender(leño.cuerpo, pd).toFixed(1)} contra ` +
          `${costoReal.toFixed(1)} que se pagaron: ${(costoDeEncender(leño.cuerpo, pd) / costoReal).toFixed(2)}× más barato`,
        `    y contra el tanque: ${costoReal.toFixed(1)} sale ${(costoReal / TANQUE_CANONICO).toFixed(2)}× el canónico ` +
          `y ${(costoReal / TANQUE_LLENO).toFixed(2)}× el lleno`,
      )
      expect(armado).toBeDefined()
      expect(tickFardo).toBeGreaterThan(0)
      expect(tickLeño).toBeGreaterThan(0)

      // Y EL SUPUESTO DE LA BÚSQUEDA, atado al cuerpo que `unir` devuelve de
      // verdad: `evaluar` promedia el punto de ignición por masa y suma la
      // potencia. Si `unir` cambiara cómo agrega, la búsqueda seguiría dando un
      // ganador —uno equivocado— sin que nada se pusiera rojo.
      if (armado !== undefined) {
        expect(qualityOf(armado, 'ignitionPoint', pd)).toBeCloseTo(fardo.ignicion, 9)
        expect(qualityOf(armado, 'mass', pd)).toBeCloseTo(fardo.masa, 9)
        expect(
          temperaturaDeEquilibrio(
            qualityOf(
              { ...armado, state: { ...armado.state, temperature: 2000 } },
              'emitsPower',
              pd,
            ),
            0,
            'contacto',
          ),
        ).toBeCloseTo(fardo.entrega, 6)
      }
    }
    filas.push(
      '',
      `  semillas con un fardo legal que alcanza: ${String(conFardo)} de ${String(SEMILLAS)}`,
      `  y con atadores suficientes para armarlo: ${String(conFardoYAtadores)} de ${String(SEMILLAS)}`,
    )
    log(filas)

    // LO QUE ESTE BLOQUE DA VUELTA: la escalera construible EXISTE. Lo que la
    // frena no es `MAX_PARTS` sino el atador, que es otra cota y se cuenta aparte.
    expect(conFardo).toBeGreaterThan(0)
  })

  it('3 · EL ATADOR ES LA COTA QUE QUEDA, y es de dónde siembra el dios', () => {
    // `unir` gasta un atador por unión, así que un fardo de n partes gasta n−1.
    // Este bloque cuenta la oferta contra la demanda, sin buscar ningún fardo:
    // es el inventario que decide si el bloque 2 se puede ejecutar.
    const p = phys()
    const filas: string[] = [
      '─── ATADORES: LA OFERTA ───',
      '  atador := flexibility ≥ 0,80 && tensile ≥ 0,30, que es el rol `binder` de `unir`',
      '',
      '  semilla   │ atadores │ sustancias',
      '  ──────────┼──────────┼───────────',
    ]

    let conAtador = 0
    const porSustancia = new Map<string, number>()
    for (let k = 0; k < SEMILLAS; k += 1) {
      const semilla = SEMILLA_BASE + BigInt(k)
      const { p: pd, piezas } = sueltasDe(semilla)
      const atadores = piezas.filter((x) => esAtador(x.cuerpo, pd))
      if (atadores.length > 0) conAtador += 1
      for (const a of atadores) porSustancia.set(a.sustancia, (porSustancia.get(a.sustancia) ?? 0) + 1)
      filas.push(
        `  ${String(semilla)} │ ${String(atadores.length).padStart(8)} │ ` +
          `${[...new Set(atadores.map((a) => a.sustancia))].sort().join(' ')}`,
      )
    }

    // Y la oferta que NO está: qué sustancias del catálogo servirían de atador,
    // para que se vea que el problema es dónde siembra el dios y no la ley.
    const delCatalogo = ['junco', 'corteza', 'raiz', 'liana', 'hoja-seca', 'madera']
      .filter((s) => esAtador(cuerpo('x', s, 1), p))
    filas.push(
      '',
      `  semillas con al menos un atador suelto: ${String(conAtador)} de ${String(SEMILLAS)}`,
      `  sustancias que aparecen de atador: ${[...porSustancia].map(([s, n]) => `${s}×${String(n)}`).join(' ') || 'ninguna'}`,
      `  y las del catálogo que servirían: ${delCatalogo.join(' ')}`,
      '',
      '  Un fardo de 6 partes gasta 5 atadores. Ésa es la cota que queda abierta, y no',
      '  es una constante del mundo: es cuánto junco decreta el dios en los 9 chunks.',
    )
    log(filas)

    expect(delCatalogo.length).toBeGreaterThan(0)
  })
})

function resumir(piezas: readonly Pieza[]): string {
  const cuenta = new Map<string, number>()
  for (const x of piezas) cuenta.set(x.sustancia, (cuenta.get(x.sustancia) ?? 0) + 1)
  return [...cuenta].map(([s, n]) => `${String(n)}×${s}`).join(' + ')
}
