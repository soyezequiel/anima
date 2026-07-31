// ─── DEL FÓSFORO AL FUEGO QUE COCINA ─────────────────────────────────────────
//
// El tramo N tiró abajo la pared aritmética del criterio (5): el fósforo más
// barato pasó de 645,50 a 244,65 y la criatura arranca con 310, así que **lo
// paga**. Y la corrida canónica no se movió un tick —sigue muriendo en el 18.150
// con cero bocados— porque el `plan()` contesta `gap` con
// `emitsPower<410&emitsPower>=253`: **lo que enciende no alcanza para cocinar**.
//
// Este archivo mide ese tramo, que es el punto 1 del traspaso. La pregunta ya no
// es «¿puede encender?» sino:
//
//     ¿puede LLEGAR, desde lo más grande que puede encender frotando, hasta un
//     fuego que entregue los 253 de la ventana de la cocción?
//
// ─── LA HIPÓTESIS CON LA QUE SE ESCRIBIÓ, Y QUE LA MEDICIÓN REFUTÓ ───────────
//
// El punto 1 publica que lo que frena la escalera es **el atador**: «un fardo de
// seis partes gasta cinco `unir` y sólo 2 de 20 semillas tienen tantos». Este
// archivo se escribió para mostrar que esa cota no muerde —que para que un fuego
// prenda otro alcanza con APOYAR uno sobre otro, y apoyar no gasta juncos— y midió
// exactamente lo contrario. El bloque 2 tiene el número.
//
// **La potencia NO se suma entre cuerpos.** Una fuente, dos y cuatro le entregan al
// de arriba el MISMO pico; un solo cuerpo con la masa de las cuatro lo prende en un
// tick. O sea que `unir` no es una comodidad para juntar leña: **es lo único que
// hace que la potencia sume**, y por eso el atador es obligatorio.
//
// ─── Y DESPUÉS EL BLOQUE 4 CORRIGIÓ AL TRASPASO, EN LA OTRA DIRECCIÓN ───────
//
// El atador es obligatorio y NO es la cota. Contra el cuerpo que de verdad hace
// falta, ninguna de las veinte semillas llega —ni las que tienen 36 atadores—.
// **Lo que frena es que las piezas son chicas y `MAX_PARTS` vale 6.**
//
// Cinco bloques:
//
//   1. EL TECHO DEL FÓSFORO. Lo más grande que un tanque de 310 enciende frotando,
//      y cuánto entrega contra los 253 que la cocción pide.
//   2. LA POTENCIA NO SE SUMA ENTRE CUERPOS. El experimento de una, dos y cuatro
//      fuentes, y el cuerpo único con la masa de las cuatro.
//   3. QUÉ HARÍA FALTA, EXACTO. Hasta qué punto de ignición llega el fósforo, qué
//      sustancia del catálogo entra abajo de eso, y cuánta masa de ella cocina.
//   4. ¿ENTRA EN `MAX_PARTS` Y LO SIEMBRA EL DIOS? La búsqueda mixta completa sobre
//      las veinte semillas, con los atadores contados.
//   5. QUÉ ABRIRÍA LA PUERTA. Las tres palancas, cada una con su número. Ninguna
//      se mueve acá: las tres son del mundo.
//
// El método es el de la casa: el catálogo BUSCA y el mundo AFIRMA. Toda masa que se
// publica sale de correr `stepWorld`.

import { describe, expect, it } from 'vitest'
import { buildSeedPhysics, MAX_PARTS, qualityOf, SUSTANCIAS_SEMILLA, T_AMBIENTE } from '@anima/physics'
import type { Body, Physics } from '@anima/physics'

import { crearDios, PREFIJO_SUELTA } from '../src/index.js'
import { stepWorld } from '../src/step.js'
import type { WorldState } from '../src/step.js'
import { actor, criatura, cuerpo, enElPiso, mundo } from './mundo-minimo.js'

const EN = (x: number, y: number): { x: number; y: number } => ({ x, y })

/** El tanque con el que arranca la criatura del criterio (5). */
const TANQUE_CANONICO = 310

/**
 * La ventana de potencia que la cocción de lo carnoso pide, en el montaje
 * `parrilla` y a distancia 0. El número vive en `@anima/plan`
 * (`POTENCIA_QUE_COCINA_LO_CARNOSO`) y este paquete no lo ve —`world` está debajo
 * de `plan`— así que se copia con su fuente escrita. Es el mismo 253 que el `gap`
 * del planificador nombra.
 */
const VENTANA_DE_LA_COCCION = { minima: 253, maxima: 410 } as const

/** Las mismas veinte semillas del banco de la emergencia. */
const SEMILLA_BASE = 20260728n
const SEMILLAS = 20

/** El atador de `unir`: es su rol, no una lista de sustancias. */
function esAtador(b: Body, p: Physics): boolean {
  return qualityOf(b, 'flexibility', p) >= 0.8 && qualityOf(b, 'tensile', p) >= 0.3
}

const log = (lineas: readonly string[]): void => {
  console.log(['', ...lineas, ''].join('\n'))
}

const dos = (x: number): string => x.toFixed(2)

function phys(): Physics {
  return buildSeedPhysics()
}

/** El `poweredBy.efficiency` de `friccion`, leído del proceso. */
function eficienciaDeFrotar(): number {
  const w = mundo()
  const e = w.phys.processes.get('friccion')?.effects[0]
  if (e === undefined || e.k !== 'drive' || e.poweredBy === undefined) {
    throw new Error('friccion cambió de forma')
  }
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

/** Lo que cuesta llevar un cuerpo desde el ambiente hasta su propia ignición. */
function costoDeEncender(b: Body, p: Physics): number {
  const cap = qualityOf(b, 'heatCapacity', p)
  const ign = qualityOf(b, 'ignitionPoint', p)
  return (cap * (ign - T_AMBIENTE)) / eficienciaDeFrotar()
}

/** Lo que un cuerpo entrega cuando arde, con la potencia que el catálogo le da. */
function potenciaDe(b: Body, p: Physics): number {
  const ign = qualityOf(b, 'ignitionPoint', p)
  return qualityOf({ ...b, state: { ...b.state, temperature: ign + 50 } }, 'emitsPower', p)
}

/** Las sustancias que ARDEN y que `friccion` acepta como palo (`rigidity >= 0,5`). */
function sustanciasQueSirvenDeFosforo(p: Physics): readonly string[] {
  return SUSTANCIAS_SEMILLA.filter((s) => {
    const uno = cuerpo('x', s.id, 1)
    return qualityOf(uno, 'rigidity', p) >= 0.5 && qualityOf(uno, 'fuelEnergy', p) > 0
  }).map((s) => s.id)
}

/**
 * La masa más GRANDE de `sustancia` que entra en `tanque` frotando.
 *
 * El precio es lineal en la masa —`heatCapacity` es extensiva— así que esto se
 * podría despejar; se biseca igual para que salga de `costoDeEncender` y no de una
 * división escrita a mano, que es donde el proyecto ya se equivocó tres veces.
 */
function loMasGrandeQueSePuedeFrotar(sustancia: string, tanque: number, p: Physics): number {
  let bajo = 0
  let alto = 20
  for (let i = 0; i < 40; i += 1) {
    const medio = (bajo + alto) / 2
    if (costoDeEncender(cuerpo('v', sustancia, medio), p) <= tanque) bajo = medio
    else alto = medio
  }
  return bajo
}

/**
 * EL MEJOR FÓSFORO: la sustancia y la masa que, con el tanque de la corrida,
 * entregan más potencia.
 *
 * Se comparte entre los bloques para que ninguno mida con un fósforo distinto. La
 * primera versión del bloque 4 usaba `madera` cuando el bloque 1 ya había medido
 * que `madera-dura` entrega más, y con eso se perdían las sustancias que quedan
 * entre los dos techos.
 */
function elMejorFosforo(p: Physics): { sustancia: string; masa: number; potencia: number } {
  let mejor = { sustancia: '', masa: 0, potencia: 0 }
  for (const s of sustanciasQueSirvenDeFosforo(p)) {
    const masa = loMasGrandeQueSePuedeFrotar(s, TANQUE_CANONICO, p)
    const potencia = potenciaDe(cuerpo('v', s, masa), p)
    if (potencia > mejor.potencia) mejor = { sustancia: s, masa, potencia }
  }
  return mejor
}

/**
 * Hasta qué temperatura calienta `fuente` a un cuerpo APOYADO encima, corriendo el
 * mundo hasta que la fuente se apaga. `supportedBy` es lo que `montajeDe` lee como
 * `contacto`, que es la exposición más alta que hay (0,6).
 *
 * Se mide con un objetivo de `piedra`, que no arde: así el número es lo que la
 * FUENTE entrega y no queda contaminado por el objetivo prendiéndose.
 */
function hastaDondeCalienta(fuente: Body, techo = 6_000): number {
  let w: WorldState = mundo({
    bodies: [
      enElPiso({ ...fuente, id: 'fuente' }, EN(0, 0)),
      {
        ...enElPiso(cuerpo('termometro', 'piedra', 0.05, { temperature: T_AMBIENTE }), EN(0, 0)),
        supportedBy: 'fuente',
      },
    ],
  })
  let pico = T_AMBIENTE
  for (let tick = 1; tick <= techo; tick += 1) {
    w = stepWorld(w, []).state
    const c = w.bodies.get('termometro')
    if (c === undefined) break
    const t = qualityOf(c.body, 'temperature', w.phys)
    if (t > pico) pico = t
    const f = w.bodies.get('fuente')
    if (f === undefined || !(qualityOf(f.body, 'emitsPower', w.phys) > 0)) break
  }
  return pico
}

interface Pieza {
  readonly sustancia: string
  readonly masa: number
  readonly ign: number
  readonly potencia: number
}

/**
 * EL MEJOR CUERPO LEGAL que se puede armar con estas piezas y que el fósforo
 * todavía pueda prender: el que más POTENCIA entrega entre los de a lo sumo
 * `MAX_PARTS` piezas cuyo punto de ignición PROMEDIADO POR MASA quede abajo de
 * `techo`.
 *
 * ─── POR QUÉ SE ENUMERA LA MEZCLA Y NO SE FILTRA POR SUSTANCIA ──────────────
 *
 * La primera versión de este bloque descartaba de entrada toda pieza con
 * `ign >= techo` y después juntaba las seis de más potencia. Eso deja afuera los
 * cuerpos MIXTOS, que son justamente el hallazgo de
 * `la-escalera-construible.test.ts`: `unir` promedia el punto de ignición POR MASA
 * y suma la potencia, así que una pieza de ignición alta puede entrar si viene
 * acompañada de suficiente masa de ignición baja. Publicar «0 de 20» con la
 * búsqueda recortada habría repetido el error que ese archivo ya corrigió una vez
 * —«la conclusión estaba mal por haber buscado UNA sustancia»— y encima en la
 * dirección cómoda.
 *
 * La enumeración es por COMPOSICIÓN sobre las `MAX_PARTS` piezas más pesadas de
 * cada sustancia: dentro de una sustancia las más pesadas dominan a las livianas
 * para las dos mitades de la cuenta.
 */
function elMejorCuerpo(
  piezas: readonly Pieza[],
  techo: number,
): { potencia: number; piezas: number; mezcla: string } | undefined {
  const porSustancia = new Map<string, Pieza[]>()
  for (const x of piezas) {
    const xs = porSustancia.get(x.sustancia) ?? []
    xs.push(x)
    porSustancia.set(x.sustancia, xs)
  }
  const grupos = [...porSustancia.values()].map((xs) =>
    [...xs].sort((a, b) => b.masa - a.masa).slice(0, MAX_PARTS),
  )

  let mejor: { potencia: number; piezas: number; mezcla: string } | undefined
  const cuantas: number[] = []
  const visita = (i: number, usadas: number): void => {
    if (i === grupos.length) {
      if (usadas === 0) return
      const elegidas: Pieza[] = []
      for (let g = 0; g < grupos.length; g += 1) elegidas.push(...(grupos[g] ?? []).slice(0, cuantas[g]))
      const masa = elegidas.reduce((t, x) => t + x.masa, 0)
      if (!(masa > 0)) return
      const ign = elegidas.reduce((t, x) => t + x.ign * x.masa, 0) / masa
      if (ign >= techo) return
      const potencia = elegidas.reduce((t, x) => t + x.potencia, 0)
      if (mejor !== undefined && potencia <= mejor.potencia) return
      const cuenta = new Map<string, number>()
      for (const x of elegidas) cuenta.set(x.sustancia, (cuenta.get(x.sustancia) ?? 0) + 1)
      mejor = {
        potencia,
        piezas: elegidas.length,
        mezcla: [...cuenta].map(([s, n]) => `${String(n)}x${s}`).join('+'),
      }
      return
    }
    const tope = Math.min(grupos[i]?.length ?? 0, MAX_PARTS - usadas)
    for (let n = 0; n <= tope; n += 1) {
      cuantas[i] = n
      visita(i + 1, usadas + n)
    }
  }
  visita(0, 0)
  return mejor
}

/** Las sueltas ardibles de una semilla, ya materializadas, más sus atadores. */
function loQueElDiosPone(semilla: bigint): { piezas: Pieza[]; atadores: number } {
  const base = mundo({
    bodies: [enElPiso(criatura('medidor'), EN(0, 0))],
    actors: [actor('medidor')],
  })
  const w = stepWorld({ ...base, dios: crearDios(semilla) }, []).state
  const piezas: Pieza[] = []
  let atadores = 0
  for (const c of w.bodies.values()) {
    if (!c.body.id.startsWith(PREFIJO_SUELTA)) continue
    if (esAtador(c.body, w.phys)) atadores += 1
    if (!(qualityOf(c.body, 'fuelEnergy', w.phys) > 0)) continue
    piezas.push({
      sustancia: c.body.parts[0]?.substance ?? '?',
      masa: qualityOf(c.body, 'mass', w.phys),
      ign: qualityOf(c.body, 'ignitionPoint', w.phys),
      potencia: potenciaDe(c.body, w.phys),
    })
  }
  return { piezas, atadores }
}

describe('del fósforo al fuego que cocina', () => {
  it('1 · EL TECHO DEL FÓSFORO: lo más grande que 310 enciende, y cuánto le falta para cocinar', () => {
    const p = phys()
    const filas: string[] = [
      '─── EL ESCALÓN CERO, CON EL TANQUE DE LA CORRIDA ───',
      `  \`friccion\` cobra heatCapacity x ΔT / ${eficienciaDeFrotar().toFixed(2)} y la criatura tiene ${String(TANQUE_CANONICO)}.`,
      '',
      '  sustancia   │ lo más grande que enciende │ lo que ENTREGA │ ¿cocina? (>= 253)',
      '  ────────────┼────────────────────────────┼────────────────┼──────────────────',
    ]
    for (const s of sustanciasQueSirvenDeFosforo(p)) {
      const masa = loMasGrandeQueSePuedeFrotar(s, TANQUE_CANONICO, p)
      const potencia = potenciaDe(cuerpo('v', s, masa), p)
      filas.push(
        `  ${s.padEnd(11)} │ ${`${masa.toFixed(4)} kg`.padStart(26)} │ ${dos(potencia).padStart(14)} │ ` +
          `${potencia >= VENTANA_DE_LA_COCCION.minima ? 'SÍ' : 'no'}`,
      )
    }
    const elMejor = elMejorFosforo(p)
    // Y cuánta masa haría falta para llegar a la ventana FROTANDO: es el número que
    // dice de qué tamaño es el salto que hay que dar de otra manera.
    const porKilo = potenciaDe(cuerpo('v', elMejor.sustancia, 1), p)
    const masaQueCocina = VENTANA_DE_LA_COCCION.minima / porKilo
    const loQueCostaria = costoDeEncender(cuerpo('v', elMejor.sustancia, masaQueCocina), p)
    filas.push(
      '',
      `  el mejor fósforo es ${elMejor.masa.toFixed(4)} kg de ${elMejor.sustancia} y entrega ${dos(elMejor.potencia)},`,
      `  contra los ${String(VENTANA_DE_LA_COCCION.minima)} que la cocción pide: le falta un ${((VENTANA_DE_LA_COCCION.minima / elMejor.potencia - 1) * 100).toFixed(0)}%.`,
      '',
      `  para entregar ${String(VENTANA_DE_LA_COCCION.minima)} haría falta ${masaQueCocina.toFixed(4)} kg de ${elMejor.sustancia}, y FROTAR eso sale ${dos(loQueCostaria)}:`,
      `  ${loQueCostaria > TANQUE_CANONICO ? `${(loQueCostaria / TANQUE_CANONICO).toFixed(2)}x el tanque, o sea que NO` : 'lo paga'}.`,
      '',
      `  EL SALTO EXISTE Y HAY QUE DARLO SIN FROTAR. Los bloques 2 y 3 miden con qué.`,
    )
    log(filas)

    // Lo que este bloque afirma, y es la razón de ser del archivo: la criatura del
    // criterio SÍ enciende algo —eso lo compró el tramo N— y lo que enciende NO
    // alcanza para cocinar.
    expect(elMejor.masa).toBeGreaterThan(0)
    expect(elMejor.potencia).toBeLessThan(VENTANA_DE_LA_COCCION.minima)
    expect(loQueCostaria).toBeGreaterThan(TANQUE_CANONICO)
  })

  it('2 · LA POTENCIA NO SE SUMA ENTRE CUERPOS: cuatro fuegos calientan lo mismo que uno', () => {
    // ─── EL EXPERIMENTO QUE REFUTÓ LA HIPÓTESIS DEL ARCHIVO ────────────────
    //
    // Si dos cuerpos ardiendo debajo del mismo objetivo sumaran su potencia, la
    // escalera subiría APILANDO y la cota del atador no la tocaría. No suman:
    // `montajeDe` calcula la exposición POR CUERPO contra la fuente que más lo
    // calienta, y ninguna ley reparte ni acumula entre fuentes.
    //
    // El control es lo que hace que esto sea una medición y no una lectura del
    // código: la MISMA masa total, puesta en UN cuerpo, calienta muchísimo más. O
    // sea que la masa sí manda; lo que no manda es en cuántos pedazos está.
    const p = phys()
    const unidad = elMejorFosforo(p).masa

    const conNFuentes = (n: number, masaCadaUna: number): number => {
      const bodies = []
      for (let i = 0; i < n; i += 1) {
        bodies.push(
          enElPiso(cuerpo(`f${String(i)}`, 'madera', masaCadaUna, { temperature: TECHO_DE_FROTAR }), EN(0, 0)),
        )
      }
      bodies.push({
        ...enElPiso(cuerpo('termometro', 'piedra', 0.05, { temperature: T_AMBIENTE }), EN(0, 0)),
        supportedBy: 'f0',
      })
      let w: WorldState = mundo({ bodies })
      let pico = T_AMBIENTE
      for (let t = 1; t <= 4_000; t += 1) {
        w = stepWorld(w, []).state
        const c = w.bodies.get('termometro')
        if (c === undefined) break
        const T = qualityOf(c.body, 'temperature', w.phys)
        if (T > pico) pico = T
        const f = w.bodies.get('f0')
        if (f === undefined || !(qualityOf(f.body, 'emitsPower', w.phys) > 0)) break
      }
      return pico
    }

    const una = conNFuentes(1, unidad)
    const dosFuentes = conNFuentes(2, unidad)
    const cuatro = conNFuentes(4, unidad)
    const juntas = conNFuentes(1, unidad * 4)

    log([
      '─── ¿SUMAN? ───',
      `  la unidad es ${unidad.toFixed(4)} kg, que es lo que el tanque de ${String(TANQUE_CANONICO)} enciende.`,
      '',
      `  UNA fuente debajo del termómetro ......... ${dos(una)} °C`,
      `  DOS fuentes, misma celda ................. ${dos(dosFuentes)} °C`,
      `  CUATRO fuentes, misma celda .............. ${dos(cuatro)} °C`,
      `  UN cuerpo con la masa de las cuatro ...... ${dos(juntas)} °C`,
      '',
      `  Las tres primeras son EL MISMO NÚMERO. Poner más leña al lado no calienta más:`,
      `  la exposición se calcula por cuerpo contra la fuente que más lo calienta, y nada`,
      `  acumula entre fuentes. La cuarta fila es la misma masa en UN cuerpo, y sube ${dos(juntas - una)} °C.`,
      '',
      `  DE ACÁ SALE, SIN QUE NADIE LO ESCRIBA, QUE \`unir\` ES OBLIGATORIO: no es una`,
      `  comodidad para juntar leña, es lo ÚNICO que hace que la potencia sume. Y como`,
      `  \`unir\` gasta un atador por unión, el atador es obligatorio y no se esquiva`,
      `  apilando. (Que sea obligatorio no quiere decir que sea la cota: ver el bloque 4.)`,
    ])

    // Las tres primeras coinciden, y eso es la afirmación.
    expect(dosFuentes).toBeCloseTo(una, 6)
    expect(cuatro).toBeCloseTo(una, 6)
    // Y el control: la misma masa junta SÍ calienta más. Sin esto, las tres de
    // arriba podrían estar midiendo un termómetro roto.
    expect(juntas).toBeGreaterThan(una + 100)
  }, 300_000)

  it('3 · QUÉ HARÍA FALTA, EXACTO: hasta dónde llega el fósforo y qué entra abajo de eso', () => {
    // El fósforo no puede prender cualquier cosa: puede prender lo que tenga el
    // punto de ignición por debajo de lo que él alcanza a calentar. Ese techo se
    // mide corriendo el mundo con un termómetro de piedra encima, y de ahí sale la
    // lista de sustancias que la criatura del criterio PUEDE prender.
    const p = phys()
    const fosforo = elMejorFosforo(p)
    const techo = hastaDondeCalienta(
      cuerpo('v', fosforo.sustancia, fosforo.masa, { temperature: TECHO_DE_FROTAR }),
    )

    const filas: string[] = [
      '─── LO QUE EL FÓSFORO PUEDE PRENDER ───',
      `  el fósforo: ${fosforo.masa.toFixed(4)} kg de ${fosforo.sustancia}, y calienta a lo que tenga encima hasta ${dos(techo)} °C`,
      '',
      '  sustancia    │ ignición │ ¿la prende? │ emitsPower por kilo │ kg para llegar a 253',
      '  ─────────────┼──────────┼─────────────┼─────────────────────┼─────────────────────',
    ]
    let laBuena = { s: '', porKilo: 0, kg: Number.POSITIVE_INFINITY }
    for (const s of SUSTANCIAS_SEMILLA) {
      const uno = cuerpo('x', s.id, 1)
      const porKilo = potenciaDe(uno, p)
      if (!(porKilo > 0)) continue
      const ign = qualityOf(uno, 'ignitionPoint', p)
      const prende = ign < techo
      const kg = VENTANA_DE_LA_COCCION.minima / porKilo
      if (prende && kg < laBuena.kg) laBuena = { s: s.id, porKilo, kg }
      filas.push(
        `  ${s.id.padEnd(12)} │ ${ign.toFixed(0).padStart(8)} │ ${(prende ? 'sí' : 'no').padStart(11)} │ ` +
          `${dos(porKilo).padStart(19)} │ ${(prende ? `${kg.toFixed(4)} kg` : '—').padStart(20)}`,
      )
    }
    filas.push(
      '',
      `  LA MEJOR ES ${laBuena.s.toUpperCase()}: prende con lo que el fósforo da y rinde ${dos(laBuena.porKilo)} por kilo,`,
      `  así que **${laBuena.kg.toFixed(4)} kg de ${laBuena.s} en UN SOLO CUERPO cocinan**.`,
      '',
      `  Y ése es el número accionable de todo este archivo: no hace falta una escalera de`,
      `  tres escalones ni un fardo mixto. Hace falta ${laBuena.kg.toFixed(4)} kg de ${laBuena.s} unidos.`,
    )
    log(filas)

    // El techo del fósforo tiene que estar por encima de ALGO: si no, no prende nada
    // y el bloque 1 mentiría.
    expect(techo).toBeGreaterThan(180)
    expect(laBuena.s).not.toBe('')
    // Y la pieza que haría falta tiene que ser MÁS GRANDE que el fósforo: si fuera
    // más chica, la criatura la prendería frotándola directamente y no habría
    // problema que resolver.
    expect(laBuena.kg).toBeGreaterThan(fosforo.masa)
  }, 300_000)

  it('4 · ¿ENTRA EN `MAX_PARTS` Y LO SIEMBRA EL DIOS? las piezas y los atadores, en las veinte', () => {
    // El bloque 3 da el número: tantos kilos de una sustancia, EN UN CUERPO. Este
    // bloque pregunta si ese cuerpo se puede armar con lo que el dios pone, y cuánto
    // sale en atadores.
    //
    // Las dos cotas que lo aprietan, y las dos son del mundo y no de la ley:
    //   · `MAX_PARTS` = 6, y `unir` aplana, así que un cuerpo armado sale de a lo
    //     sumo seis piezas;
    //   · `unir` gasta UN atador por unión, así que seis piezas cuestan cinco.
    const p = phys()
    const fosforo = elMejorFosforo(p)
    const techo = hastaDondeCalienta(
      cuerpo('v', fosforo.sustancia, fosforo.masa, { temperature: TECHO_DE_FROTAR }),
    )

    const filas: string[] = [
      '─── LO QUE EL DIOS PONE, CONTRA LO QUE LA COCCIÓN PIDE ───',
      `  se busca el mejor cuerpo de hasta ${String(MAX_PARTS)} piezas cuyo punto de ignición promediado`,
      `  por masa quede abajo de ${dos(techo)} °C —lo que el fósforo alcanza— y que entregue ${String(VENTANA_DE_LA_COCCION.minima)}.`,
      '',
      '  semilla │ ardibles │ el mejor cuerpo legal │ ¿cocina? │ atadores │ con qué está hecho',
      '  ────────┼──────────┼───────────────────────┼──────────┼──────────┼───────────────────',
    ]
    let cocinan = 0
    let conAtadores = 0
    let elTecho = 0
    /** La mejor de las que ADEMÁS tienen con qué atar: es la que de verdad importa. */
    let elTechoArmable = { potencia: 0, semilla: -1 }
    for (let k = 0; k < SEMILLAS; k += 1) {
      const { piezas, atadores } = loQueElDiosPone(SEMILLA_BASE + BigInt(k))
      const mejor = elMejorCuerpo(piezas, techo)
      const potencia = mejor?.potencia ?? 0
      const cocina = potencia >= VENTANA_DE_LA_COCCION.minima
      const hacenFalta = (mejor?.piezas ?? 0) > 1 ? (mejor?.piezas ?? 1) - 1 : 0
      const alcanzan = atadores >= hacenFalta
      if (potencia > elTecho) elTecho = potencia
      if (alcanzan && potencia > elTechoArmable.potencia) {
        elTechoArmable = { potencia, semilla: k }
      }
      if (cocina) cocinan += 1
      if (cocina && alcanzan) conAtadores += 1
      filas.push(
        `  ${String(k).padStart(7)} │ ${String(piezas.length).padStart(8)} │ ${dos(potencia).padStart(21)} │ ` +
          `${(cocina ? 'sí' : 'NO').padStart(8)} │ ${`${String(atadores)}/${String(hacenFalta)}`.padStart(8)} │ ` +
          `${mejor?.mezcla ?? '—'}`,
      )
    }
    filas.push(
      '',
      `  el cuerpo que cocina se puede ARMAR en ${String(cocinan)}/${String(SEMILLAS)} semillas` +
        ` · y hay atadores para armarlo en ${String(conAtadores)}/${String(SEMILLAS)}`,
      `  lo mejor que se pudo armar en cualquiera de las veinte: **${dos(elTecho)}** contra ${String(VENTANA_DE_LA_COCCION.minima)}`,
      '',
      `  Y ACÁ ESTÁ EL PUNTO 1 CORREGIDO, y la corrección tiene dos mitades.`,
      '',
      `  UNA: el traspaso publica que lo que frena la escalera es el ATADOR —«sólo 2 de 20`,
      `  semillas tienen tantos»—. No es LA cota. Las tres semillas de más potencia (16, 17`,
      `  y 19, entre 222 y 239) tienen CERO atadores, y las tres de más atadores (3, 8 y 18,`,
      `  con 36, 31 y 33) se quedan en 115–123 porque no tienen corteza. **Son dos escaseces`,
      `  distintas y caen en semillas distintas.**`,
      '',
      `  DOS: la que SÍ tiene las dos cosas es la semilla ${String(elTechoArmable.semilla)}, con ${dos(elTechoArmable.potencia)} y atadores de`,
      `  sobra. Le faltan **${dos(VENTANA_DE_LA_COCCION.minima - elTechoArmable.potencia)}** de potencia, o sea un ${(((VENTANA_DE_LA_COCCION.minima - elTechoArmable.potencia) / VENTANA_DE_LA_COCCION.minima) * 100).toFixed(0)}%. Ése es el hueco de verdad`,
      `  del punto 1, y es mucho más chico de lo que el traspaso hacía pensar.`,
      '',
      `  Y LA MEZCLA IMPORTA, que era el hallazgo de \`la-escalera-construible\` y acá se`,
      `  vuelve a ver: las mejores son \`5xhoja-seca+1xcorteza\`. La corteza sola no se puede`,
      `  prender —ignición 250 contra los ${dos(techo)} que el fósforo da— y adentro de la mezcla`,
      `  sí, porque \`unir\` promedia la ignición por masa y suma la potencia.`,
      '',
      `  LO QUE ESTA TABLA NO CUENTA, y juega a favor: las piezas están DESPARRAMADAS`,
      `  —caminar hasta cada una cuesta— y la humedad de la celda sube el punto de`,
      `  ignición. Es una COTA DE ARRIBA, así que el 0/20 es firme: en el mundo de verdad`,
      `  es peor, no mejor.`,
    )
    log(filas)

    // ─── LA AFIRMACIÓN, Y SE ESCRIBIÓ AL REVÉS ─────────────────────────────
    //
    // Este bloque se escribió con `expect(cocinan).toBeGreaterThan(0)`, esperando
    // que la materia existiera y que la cota fuera el atador. Da CERO, y con la
    // búsqueda mixta completa —la misma que `la-escalera-construible` tuvo que
    // aprender a hacer—, así que el cero no es de haber buscado poco.
    expect(cocinan).toBe(0)
    // Y el número que dice de qué tamaño es lo que falta. Si algún día esto pasa de
    // 253, el criterio (5) queda a tiro y hay que venir a borrar el `it.fails` de la
    // mente.
    expect(elTecho).toBeGreaterThan(VENTANA_DE_LA_COCCION.minima / 2)
    expect(elTecho).toBeLessThan(VENTANA_DE_LA_COCCION.minima)
    // Y LA COTA DEL TRASPASO, RE-MEDIDA: el atador no es lo que frena. La semilla
    // con más potencia ARMABLE —la que tiene las dos cosas— también se queda corta,
    // así que darle atadores a todo el mundo no cerraría nada.
    expect(conAtadores).toBe(0)
    expect(elTechoArmable.potencia).toBeGreaterThan(0)
    expect(elTechoArmable.potencia).toBeLessThan(VENTANA_DE_LA_COCCION.minima)
  }, 300_000)

  it('5 · QUÉ ABRIRÍA LA PUERTA: las tres palancas, con el número de cada una', () => {
    // El bloque 4 dice cuánto falta. Éste dice qué habría que mover para taparlo, y
    // NO propone ninguna: las tres son del mundo y las decide el usuario. Lo que
    // este bloque aporta es que ninguna quede como «habría que...» sin número.
    const p = phys()
    const fosforo = elMejorFosforo(p)
    const techoHoy = hastaDondeCalienta(
      cuerpo('v', fosforo.sustancia, fosforo.masa, { temperature: TECHO_DE_FROTAR }),
    )

    // (a) `MAX_PARTS`. Con las piezas que hay, ¿cuántas harían falta?
    const cuantasPiezas: number[] = []
    for (let k = 0; k < SEMILLAS; k += 1) {
      const { piezas } = loQueElDiosPone(SEMILLA_BASE + BigInt(k))
      const prendibles = piezas
        .filter((x) => x.ign < techoHoy)
        .map((x) => x.potencia)
        .sort((a, b) => b - a)
      let suma = 0
      let n = 0
      while (n < prendibles.length && suma < VENTANA_DE_LA_COCCION.minima) {
        suma += prendibles[n] as number
        n += 1
      }
      if (suma >= VENTANA_DE_LA_COCCION.minima) cuantasPiezas.push(n)
    }
    const ordenadas = [...cuantasPiezas].sort((a, b) => a - b)
    const mediana = ordenadas[Math.floor(ordenadas.length / 2)]

    // (b) UN FÓSFORO MÁS CALIENTE: cuánto tanque haría falta para prender el primer
    // escalón que hoy queda arriba del techo.
    const objetivo = SUSTANCIAS_SEMILLA.filter((s) => potenciaDe(cuerpo('x', s.id, 1), p) > 0)
      .map((s) => ({ s: s.id, ign: qualityOf(cuerpo('x', s.id, 1), 'ignitionPoint', p) }))
      .filter((x) => x.ign > techoHoy)
      .sort((a, b) => a.ign - b.ign)[0]
    let tanqueQueHariaFalta = Number.POSITIVE_INFINITY
    let masaDelFosforoCaliente = 0
    if (objetivo !== undefined) {
      let bajo = fosforo.masa
      let alto = 4
      for (let i = 0; i < 12; i += 1) {
        const medio = (bajo + alto) / 2
        const llega = hastaDondeCalienta(
          cuerpo('v', fosforo.sustancia, medio, { temperature: TECHO_DE_FROTAR }),
        )
        if (llega > objetivo.ign) alto = medio
        else bajo = medio
      }
      masaDelFosforoCaliente = alto
      tanqueQueHariaFalta = costoDeEncender(cuerpo('v', fosforo.sustancia, alto), p)
    }

    // Y LA PREGUNTA QUE NO SE PUEDE DEJAR SIN CONTESTAR: pagar esos 2,61 abre una
    // sustancia más, ¿y con eso ALCANZA? Un número accionable que no dice si sirve
    // no es accionable — es el mismo vicio del «~25 a 1» que este tramo corrigió.
    const techoCaliente =
      objetivo === undefined
        ? techoHoy
        : hastaDondeCalienta(
            cuerpo('v', fosforo.sustancia, masaDelFosforoCaliente, { temperature: TECHO_DE_FROTAR }),
          )
    let cocinanConElCaliente = 0
    let elTechoCaliente = 0
    for (let k = 0; k < SEMILLAS; k += 1) {
      const { piezas } = loQueElDiosPone(SEMILLA_BASE + BigInt(k))
      const mejor = elMejorCuerpo(piezas, techoCaliente)
      const potencia = mejor?.potencia ?? 0
      if (potencia > elTechoCaliente) elTechoCaliente = potencia
      if (potencia >= VENTANA_DE_LA_COCCION.minima) cocinanConElCaliente += 1
    }

    // (c) PIEZAS MÁS GORDAS: con `MAX_PARTS` como está, ¿de cuánto tendría que ser
    // cada pieza de la mejor sustancia?
    const porKiloDeHojaSeca = potenciaDe(cuerpo('x', 'hoja-seca', 1), p)
    const masaPorPieza = VENTANA_DE_LA_COCCION.minima / MAX_PARTS / porKiloDeHojaSeca

    // El techo de hoy, para poder decir cuánto lo mueve cada palanca.
    let techoDeHoy = 0
    for (let k = 0; k < SEMILLAS; k += 1) {
      const { piezas } = loQueElDiosPone(SEMILLA_BASE + BigInt(k))
      const potencia = elMejorCuerpo(piezas, techoHoy)?.potencia ?? 0
      if (potencia > techoDeHoy) techoDeHoy = potencia
    }

    log([
      '─── LAS TRES PALANCAS, Y NINGUNA SE MUEVE ACÁ ───',
      '',
      `  (a) SUBIR \`MAX_PARTS\` — hoy ${String(MAX_PARTS)}. Con las piezas que el dios ya pone harían falta`,
      `      ${mediana === undefined ? 'más piezas de las que hay en ninguna semilla' : `${String(mediana)} piezas (mediana de las ${String(cuantasPiezas.length)}/${String(SEMILLAS)} semillas donde alcanza sumando todas)`}.`,
      `      Es una constante de \`@anima/physics\` y toca \`unir\` en todo el mundo.`,
      '',
      `  (b) UN FÓSFORO MÁS CALIENTE — hoy calienta hasta ${dos(techoHoy)} °C con ${fosforo.masa.toFixed(4)} kg de ${fosforo.sustancia}.`,
      objetivo === undefined
        ? '      no hay ningún escalón arriba del techo actual.'
        : `      El primer escalón que queda afuera es ${objetivo.s} (${objetivo.ign.toFixed(0)} °C). Para prenderlo hace` +
          `\n      falta un fósforo de ${masaDelFosforoCaliente.toFixed(4)} kg, que sale ${dos(tanqueQueHariaFalta)} contra un tanque de ${String(TANQUE_CANONICO)}:` +
          `\n      **le faltan ${dos(tanqueQueHariaFalta - TANQUE_CANONICO)} de aliento**, que es el número más chico de los tres por lejos.` +
          `\n      ¿Y ALCANZA? Con ese fósforo el techo sube a ${dos(techoCaliente)} °C y el mejor cuerpo armable pasa` +
          `\n      de ${dos(techoDeHoy)} a ${dos(elTechoCaliente)}: cocinan ${String(cocinanConElCaliente)}/${String(SEMILLAS)} semillas. ` +
          `${cocinanConElCaliente > 0 ? '**SÍ, y con 2,61 de aliento.**' : 'NO alcanza sola.'}`,
      '',
      `  (c) PIEZAS MÁS GORDAS — con \`MAX_PARTS\` en ${String(MAX_PARTS)}, cada pieza de hoja-seca tendría que`,
      `      pesar ${masaPorPieza.toFixed(4)} kg. Hoy vienen de ~0,077. Es del oráculo, no de la ley.`,
      '',
      `  Y LA QUE NO ESTÁ EN LA LISTA: bajar los ${String(VENTANA_DE_LA_COCCION.minima)} de la ventana de cocción. No es una`,
      `  perilla —sale de la ley 5 y del montaje \`parrilla\`— y bajarla haría que un fuego`,
      `  chico cocine, que es justo lo que la ventana existe para impedir.`,
      '',
      `  EL ORDEN QUE ESTO SUGIERE, y es lo único que este bloque recomienda: la (b) es`,
      `  la más barata y NO CIERRA, así que quedan la (a) y la (c). Las dos son del`,
      `  mismo tamaño de decisión —una constante de la ley contra la tabla de biomas— y`,
      `  la (c) tiene una ventaja: no toca \`unir\` en todo el mundo.`,
    ])

    // Que las tres existan y estén acotadas: un «habría que» sin número no sirve
    // para decidir, y este bloque existe para que no quede ninguno.
    expect(masaPorPieza).toBeGreaterThan(0.077)
    expect(objetivo).toBeDefined()
    expect(tanqueQueHariaFalta).toBeGreaterThan(TANQUE_CANONICO)
    // Que la (b) sea la más barata de las tres: es lo que decide en qué orden se
    // miran. Si dejara de serlo, hay que releer el bloque.
    expect(tanqueQueHariaFalta - TANQUE_CANONICO).toBeLessThan(TANQUE_CANONICO / 10)
    // ─── Y QUE NO ALCANCE, QUE ES LO QUE ESTE SEGUIMIENTO VINO A BUSCAR ────
    //
    // Pagar los 2,61 abre `medula` y el mejor cuerpo armable no se mueve NI UN
    // DECIMAL: 239,36 antes y 239,36 después. O sea que el escalón que se abre no
    // está en el mundo, o las piezas que hay de él son demasiado chicas para
    // cambiar la suma. Sin este `expect`, el 2,61 se habría publicado como «la
    // salida barata» y habría mandado a alguien a pagar por nada — que es
    // exactamente el vicio del «~25 a 1» que el tramo N corrigió.
    expect(cocinanConElCaliente).toBe(0)
    expect(elTechoCaliente).toBeCloseTo(techoDeHoy, 6)
  }, 300_000)
})
