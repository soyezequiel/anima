// ═══ EL ADVERSARIO DEL DETECTOR ═════════════════════════════════════════════
//
// La tanda anterior de detectores se cayó entera y dejó dos reglas que valen más
// que la lista de nueve:
//
//   1. EL DETECTOR LLAMA A LAS FUNCIONES EXPORTADAS DEL MOTOR. Seis de diez
//      transcribían una fórmula y tres la transcribían MAL.
//   2. CADA SECUENCIA DECLARA QUÉ LA PAGA. Sin stamina, calorías, tiempo o
//      supervivencia de por medio no es emergencia: es coreografía.
//
// Y el documento de la lista agrega, en su §1, las dos que este archivo usa como
// herramienta principal:
//
//   REGLA 4 · la situación tiene que existir en el mundo decretado;
//   REGLA 6 · SI LA CONDICIÓN DEL DETECTOR LA PUEDE PRODUCIR EL MOTOR SOLO, NO ES
//             UNA CONDUCTA.
//
// Este archivo demuestra, y desde la tanda del reparador también CUIDA: cada
// bloque es un mundo —corrido con `stepWorld` cuando alcanza, armado a mano cuando
// hace falta la situación exacta— donde el detector decía que sí y la criatura no
// había decidido nada. Los mundos no se tocaron; lo que cambió es lo que el juez
// contesta sobre ellos, y cada bloque lo dice con el número que lo cerró.
//
// ═══ LO QUE SE ENCONTRÓ, Y QUÉ QUEDÓ DE CADA COSA ═══════════════════════════
//
//   (1) REPARADO · `el-fardo-de-corteza` FIRMABA EL FUEGO QUE SE FROTÓ. `unir`
//       hereda el estado del cuerpo `a` —`state: { ...otro.state, ...a.state }`,
//       `physics/src/leyes.ts:1735`— así que atar una vara ARDIENDO devuelve un
//       ensamble ardiendo con un id NUEVO, que no está en `frotados`. Corrido de
//       punta a punta con `stepWorld`: la criatura frota `vara` (0,5 kg, prende en
//       el tick 47, 701,8286 de stamina), la ata a una corteza con un junco, y el
//       juez firmaba «nació de una union completa … y ardió … SIN QUE NADIE LO
//       FROTARA NUNCA». No hubo propagación: hubo un cambio de nombre. **El
//       detector pide ahora que el ensamble haya nacido POR DEBAJO de su punto de
//       ignición y lo haya cruzado DESPUÉS** —`Ensamble.nacioApagado` y
//       `fuego.primerTick > ensamble.tick`, las dos preguntas a `qualityOf`— y
//       sobre esta misma corrida contesta que no.
//
//   (2) REPARADO · `el-leno-mas-grande-que-todavia-cocina` DISPARABA CON CERO
//       INTENCIONES. Un mundo con una fogata ya prendida y seis pescados en el
//       piso, 3000 ticks sin que nadie emita nada: el juez decía SÍ y la evidencia
//       que imprimía era «prendió por contacto teniendo a tiro «pez-0» de 2,0000
//       kg». El pescado tiene `fuelEnergy` 2 (medido acá), así que entraba al
//       conjunto de leños. **Ahora el detector pide un acto sobre el cuerpo que
//       ardió —`heldBy` o un `puso`— y saca la comida del conjunto de leños con
//       `calories > 0`**, y sobre este mismo mundo contesta que no.
//
//   (3) REPARADO · LA ALTERNATIVA DE LOS DETECTORES 1 Y 2 NO ARDÍA. El rol `a` de
//       `friccion` pide `rigidity >= 0,5`; `piedra` tiene 0,95 y `fuelEnergy` 0
//       (medido), y `agua-dulce` la siembra con peso 3, de 0,2 a 3 kg
//       (`bioma.ts:296`). Con una piedra chica al lado el 2 firmaba «se salteó el
//       más liviano»; con una grande el 1 firmaba «tenía a tiro uno más pesado y
//       no lo tocó». **`candidatosDeFriccion` le pregunta ahora a
//       `potenciaSiArdiera` si el candidato entregaría algo**, y las dos piedras
//       salen del conjunto.
//
//   (4) SIGUE ABIERTO, Y ESTÁ DECLARADO EN EL DOCUMENTO · LOS DETECTORES 1 Y 2 SON
//       UN SOLO ACTO. Una fricción con tres candidatos de masas distintas que
//       prende y cocina dispara los dos. §4 entrada 2 lo llama «adyacencia
//       declarada» y manda publicar las dos cifras por separado; con nueve
//       entradas y un piso de cuatro, frotar un palo una vez entrega la mitad del
//       criterio.
//
//   (5) REPARADO · `taparlo-con-lo-que-respira` ESTABA CONFUNDIDO CON LA MASA. La
//       duración es exactamente lineal en la masa —199 / 499 / 1499 / 2500 ticks
//       para 0,2 / 0,5 / 1,5 / 2,5 kg, medido acá— y el detector comparaba la racha
//       del fuego tapado contra la del más largo SIN tapar de la partida, sin
//       controlar la masa. Un leño de 2,5 kg tapado con MADERA —permeabilidad 0,12,
//       la fila que la tabla del documento marca como «CRUDO, ni se movió»— le
//       ganaba a una ramita de 0,2 kg al aire. **El testigo tiene que pesar lo
//       mismo al centésimo, y la cocción tiene que estar A TIRO del fuego tapado.**
//
//   (6) REPARADO · `cocinar-el-lote-en-un-solo-fuego` NO PEDÍA UN SOLO FUEGO. El
//       intervalo es global y `cocidas` juntaba las piezas de todos los fuegos. Dos
//       fogatas a diez celdas con dos piezas cada una contaban cuatro. **El conteo
//       se mudó a `Fuego.cocidasCerca`: por cuerpo que arde y con `chebyshev`.**
//
//   (7) REPARADO · `comerla-en-el-pico-de-calorias` NO MEDÍA UN PICO. Corrido: el
//       pescado topa en 13,7459 calorías en el tick 129 y se queda por encima del
//       90% del pico durante 19.943 de los 20.000 ticks. Comerlo en el tick 19.999
//       —mil segundos de mundo después del máximo— disparaba igual. **La tolerancia
//       se mide ahora en TICKS alrededor del `argmax`, y la ventana de después dura
//       lo que duró la subida**: sale de la curva de la pieza y no de una constante.
//
//   (8) REPARADO · EL INFORME IMPRIMÍA `SÍ … (no medida)` Y EL RESUMEN LO CONTABA
//       IGUAL. `resumir` sumaba `aparecioEn` sin mirar `situacion`, así que una
//       secuencia cuyo contra-detector niega el problema podía llegar al piso de
//       cuatro. **`cuenta` pide ahora `aparecioEn >= 2 && situacionEn > 0`**, la
//       tabla imprime `?!` con «CONTRADICE AL CONTRA-DETECTOR» y el informe publica
//       `contradictorioEn`.
//
//   (9) SIGUE ABIERTO · EL CONTRA-DETECTOR DEL FARDO NO MIRA EL TANQUE.
//       `sePodiaArmarLaCadena` usa `TECHO_DE_LA_FRICCION = 0,7132`, que es el techo
//       con un tanque de 1000, y la corrida canónica del criterio arranca con 310.
//       Medido acá: encender una vara de 0,5 kg cuesta 701,8286, o sea 1398,857 por
//       kilo, y la vara de 0,71 que abre la cadena sale 995,6. Con 310 el techo real
//       es 0,2199 kg —por debajo de la madera más liviana que `agua-dulce` siembra,
//       0,3— y el contra-detector contesta `true` igual, con los dos tanques. No se
//       repara acá porque no hay función exportada que devuelva el precio de
//       encender y `sePodiaArmarLaCadena` ni siquiera recibe al actor: es un hueco
//       del arnés, declarado en §1 del documento.
//
//   (10) SIGUE ABIERTO, Y RE-MEDIDO DESPUÉS DE LAS SIETE REPARACIONES ·
//        EL RUIDO DEL AZAR: **TRES DE LAS NUEVE, Y EL CRITERIO PIDE CUATRO.**
//        Una criatura que elige la FORMA del acto y los CUERPOS con el dado del
//        mundo —`dadoDe(crearDios(semilla))`, nunca `Math.random`— y que no
//        consulta una sola cualidad, sobre 20 semillas y 20.000 ticks:
//
//          · sin fuego regalado (tanque 1000, vivió 3133 ticks en promedio):
//            `no-frotar-lo-que-no-alcanza-a-encender` en **20/20**, con la
//            situación en 20/20. La única de las nueve cuyo acto es NO ACTUAR la
//            firma un bicho que frota al azar.
//          · con el fuego regalado (tanque 40.000, vivió 365 ticks en promedio
//            porque se quema al lado de la fogata): `cocinar-el-lote-en-un-solo-
//            fuego` en **20/20** y `el-leno-mas-grande-que-todavia-cocina` en
//            **20/20**, las dos con situación 20/20.
//
//        La unión es **3 de 9**. El criterio publicado pide 4 de 10 y §10 del
//        documento resolvió que con nueve entradas el número no se mueve: el ruido
//        del azar cubre **tres de las cuatro** que el proyecto necesita para
//        seguir. Y las dos concesiones —regalar el fuego y agrandar el tanque— van
//        a favor del control, así que 3 es un PISO y no un techo.
//
// ═══ CÓMO SE MIDE ACÁ ═══════════════════════════════════════════════════════
//
// Todo lo que se afirma está corrido en este archivo. Los mundos armados a mano
// usan `banco.ts`, con sustancias y masas que `agua-dulce` siembra (REGLA 5); los
// dos hallazgos más caros —(1) y (2)— están corridos contra `stepWorld` sin un
// solo estado escrito a mano después del tick 0.
//
// Y lo que no se cumple no se ablanda: los `it.fails` son las propiedades que un
// detector honesto tendría que tener y no tiene, con la salida medida al lado.
// Verde acá quiere decir «el agujero está donde digo que está».

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  cumpleRol,
  estaEnVentanaDeCoccion,
  EXTRACCION,
  FRICCION,
  HZ_DE_REFERENCIA,
  qualityOf,
  temperaturaDeEquilibrio,
  UNION,
  unir,
} from '@anima/physics'
import type { Body, Physics } from '@anima/physics'
import { apply, chebyshev, drop, eat, mapaDeActores, mapaDeCuerpos, stepWorld, take } from '@anima/world'
import type { Actor, Intent, WorldBody, WorldState } from '@anima/world'

import {
  Detector,
  resumir,
  ROL_A_DE_FRICCION,
  SECUENCIAS,
  TECHO_DE_LA_FRICCION,
  sePodiaArmarLaCadena,
} from '../src/index.js'
import type { NombreDeSecuencia, Veredicto } from '../src/index.js'

import {
  actor,
  criatura,
  cuerpo,
  EN,
  enElPiso,
  enLaMano,
  haciendo,
  nacio,
  partida,
  PHYS,
  proceso,
  puso,
  tapando,
} from './banco.js'
import type { Paso } from './banco.js'
import { correrElControl, ruidoDelAzar, tablaDelControl } from './azar.js'

// ─── El arnés propio: mundos CORRIDOS, sin un estado escrito a mano ──────────

/** Un cuerpo con temperatura escrita. Sin eso nace a 0 °C y toda medición miente. */
function pieza(id: string, substance: string, mass: number, t = 15): Body {
  return { id, form: 'vara', parts: [{ substance, mass, q: {} }], joints: [], state: { temperature: t } }
}

/** El cuerpo de la criatura, con su tanque. `carne`, como en el resto del repo. */
function cuerpoDeAna(stamina: number): Body {
  return { id: 'ana-cuerpo', form: 'vara', parts: [{ substance: 'carne', mass: 2, q: {} }], joints: [], state: { temperature: 15, stamina } }
}

function unActor(holding: readonly string[] = []): Actor {
  return { id: 'ana', body: 'ana-cuerpo', holding, capacity: 3, permits: 'irreversible' }
}

function mundoCorrido(bodies: readonly WorldBody[], actors: readonly Actor[], phys: Physics = PHYS): WorldState {
  return {
    tick: 0,
    hz: HZ_DE_REFERENCIA,
    phys,
    bodies: mapaDeCuerpos(bodies),
    actors: mapaDeActores(actors),
    cells: new Map(),
    nextId: 1,
  }
}

function vio(v: Veredicto, n: NombreDeSecuencia): boolean {
  for (const f of v.filas) if (f.nombre === n) return f.aparecio
  throw new Error(`no existe la fila ${n}`)
}

function situacionDe(v: Veredicto, n: NombreDeSecuencia): boolean {
  for (const f of v.filas) if (f.nombre === n) return f.situacion
  throw new Error(`no existe la fila ${n}`)
}

function evidenciaDe(v: Veredicto, n: NombreDeSecuencia): string {
  for (const f of v.filas) if (f.nombre === n) return f.evidencia ?? ''
  throw new Error(`no existe la fila ${n}`)
}

function juez(pasos: readonly Paso[]): Veredicto {
  const d = new Detector()
  d.observarTodo(partida(pasos))
  return d.veredicto()
}

const QUIEN = { by: 'ana', seq: 1 } as const

/**
 * La orilla del contra-detector del fardo: una vara de 0,71 kg —tres gramos por
 * debajo del techo de 0,7132— un junco que ata y dos cortezas que, unidas por
 * `unir`, dan el fardo de 1 kg que la vara alcanza a prender por contacto.
 */
function laOrillaDeLaCadena(stamina: number): WorldState {
  return mundoCorrido(
    [
      { body: cuerpoDeAna(stamina), at: EN(0, 0) },
      { body: pieza('vara', 'madera', 0.71), at: EN(1, 0) },
      { body: pieza('junco', 'junco', 0.3), at: EN(1, 1) },
      { body: pieza('corteza-1', 'corteza', 0.5), at: EN(0, 1) },
      { body: pieza('corteza-2', 'corteza', 0.5), at: EN(2, 0) },
    ],
    [unActor()],
  )
}

function frotarLaVara(): Intent {
  const i = apply(QUIEN, PHYS, FRICCION.id, [
    { name: 'a', body: 'vara' },
    { name: 'b', body: 'vb' },
    { name: 'actor', body: 'ana-cuerpo' },
  ])
  if (i === undefined) throw new Error('el catálogo ya no tiene `friccion`')
  return i
}

// ═══ FRENTE 1 · ¿EL DETECTOR MIDE SU PROPIA COPIA? ══════════════════════════

describe('frente 1 · las funciones que dice llamar existen, y la única constante que no', () => {
  it('las nueve declaran `llama`, y cada nombre es una función exportada que contesta', () => {
    // No alcanza con que `tsc` compile: `llama` es un campo de TEXTO y podría
    // nombrar una función que no existe sin que nada se rompa. Acá se resuelve
    // cada nombre contra el motor de verdad y se lo hace contestar.
    const vara = pieza('v', 'madera', 0.5, 700)
    const pez = pieza('p', 'pescado', 2, 100)
    const junco = pieza('j', 'junco', 0.3)
    const contesta: Readonly<Record<string, () => unknown>> = {
      qualityOf: () => qualityOf(vara, 'emitsPower', PHYS),
      cumpleRol: () => cumpleRol(vara, ROL_A_DE_FRICCION(), PHYS),
      estaEnVentanaDeCoccion: () => estaEnVentanaDeCoccion(pez, PHYS),
      temperaturaDeEquilibrio: () => temperaturaDeEquilibrio(150, 0, 'contacto'),
      chebyshev: () => chebyshev(EN(0, 0), EN(3, 1)),
      'FRICCION.roles': () => FRICCION.roles.length,
      'EXTRACCION.roles': () => EXTRACCION.roles.length,
      unir: () => unir(vara, pez, junco, PHYS, 'x'),
    }
    const huerfanas: string[] = []
    for (const s of SECUENCIAS) {
      expect(s.llama.length, `${s.nombre} no declara qué llama`).toBeGreaterThan(0)
      for (const n of s.llama) {
        const f = contesta[n]
        if (f === undefined) huerfanas.push(`${s.nombre} → ${n}`)
        else expect(f(), `${n} devolvió undefined`).toBeDefined()
      }
    }
    // Ninguna función inventada: ése era el hallazgo más grave posible, y no está.
    expect(huerfanas).toEqual([])
  })

  it('y las del motor contestan en el sentido que el detector supone', () => {
    expect(qualityOf(pieza('v', 'madera', 0.5, 700), 'emitsPower', PHYS)).toBeGreaterThan(0)
    expect(qualityOf(pieza('v', 'madera', 0.5, 15), 'emitsPower', PHYS)).toBe(0)
    expect(estaEnVentanaDeCoccion(pieza('p', 'pescado', 2, 100), PHYS)).toBe(true)
    expect(estaEnVentanaDeCoccion(pieza('p', 'pescado', 2, 15), PHYS)).toBe(false)
    expect(temperaturaDeEquilibrio(150, 0, 'contacto')).toBeGreaterThan(temperaturaDeEquilibrio(150, 0, 'parrilla'))
  })

  it('HALLAZGO · el contra-detector del fardo usa el techo de un tanque de 1000, y la corrida arranca con 310', () => {
    // Primero, lo que cuesta encender: MEDIDO corriendo el mundo, no derivado.
    let w = mundoCorrido(
      [
        { body: cuerpoDeAna(1000), at: EN(0, 0) },
        { body: pieza('vara', 'madera', 0.5), at: EN(0, 0), heldBy: 'ana' },
        { body: pieza('vb', 'madera', 0.5), at: EN(0, 0), heldBy: 'ana' },
      ],
      [unActor(['vara', 'vb'])],
    )
    const frotar = frotarLaVara()
    let prendioEn = -1
    for (let t = 0; t < 200; t++) {
      w = stepWorld(w, [frotar]).state
      const v = w.bodies.get('vara')
      if (v !== undefined && qualityOf(v.body, 'emitsPower', PHYS) > 0) {
        prendioEn = t
        break
      }
    }
    const cuerpoAna = w.bodies.get('ana-cuerpo')
    const precio = 1000 - (cuerpoAna === undefined ? 0 : qualityOf(cuerpoAna.body, 'stamina', PHYS))
    const porKilo = (precio - 2.4) / 0.5
    const techoCon310 = (310 - 2.4) / porKilo
    console.log(
      `\n  encender 0,5 kg de madera: prendió en el tick ${String(prendioEn)}, costó ${precio.toFixed(4)} de stamina` +
        ` → ${porKilo.toFixed(3)} por kilo · techo con el tanque de 310: ${techoCon310.toFixed(4)} kg`,
    )
    expect(prendioEn).toBe(47)
    expect(precio).toBeCloseTo(701.8286, 3)
    // El techo con 310 cae por debajo de la madera más liviana que siembra
    // `agua-dulce` (0,3 kg, `bioma.ts:295`): no hay UNA pieza que esa criatura
    // pueda encender frotando.
    expect(techoCon310).toBeLessThan(0.3)

    // Y el juez no se entera: el mismo mundo con 310 y con 1000 contesta igual.
    // La vara pesa 0,71 kg —adentro del techo de 0,7132 por 3 gramos— y por eso el
    // contra-detector dice que la cadena estaba servida. Lo que esa vara cuesta,
    // con el precio por kilo MEDIDO tres renglones más arriba, es 995,6: el 99,6%
    // de un tanque de 1000 y el 321% de uno de 310.
    const conMil = sePodiaArmarLaCadena(laOrillaDeLaCadena(1000), EN(0, 0))
    const conElDeLaCorrida = sePodiaArmarLaCadena(laOrillaDeLaCadena(310), EN(0, 0))
    const loQueSaleLaVara = porKilo * 0.71 + 2.4
    console.log(
      `  la vara de 0,71 kg sale ${loQueSaleLaVara.toFixed(1)} de stamina · sePodiaArmarLaCadena` +
        ` con tanque 1000: ${String(conMil)} · con tanque 310: ${String(conElDeLaCorrida)}`,
    )
    expect(loQueSaleLaVara).toBeGreaterThan(310)
    expect(conMil).toBe(true)
    // EL HALLAZGO: la misma respuesta con un tanque que no paga ni un tercio.
    expect(conElDeLaCorrida).toBe(conMil)
    expect(TECHO_DE_LA_FRICCION).toBe(0.7132)
  })

  it.fails('lo que un contra-detector honesto haría: preguntarle al tanque de la criatura', () => {
    // HUECO, no reparación. `sePodiaArmarLaCadena(w, centro)` ni siquiera recibe al
    // actor: recorre `w.bodies` y compara masas contra una constante escrita.
    // Mientras el tanque de arranque sea un parámetro del banco —310 en la corrida
    // canónica, 1000 en el control— este contra-detector contesta por el de 1000.
    expect(sePodiaArmarLaCadena(laOrillaDeLaCadena(310), EN(0, 0))).toBe(false)
  })
})

// ═══ FRENTE 6 (primero, porque es el más grave) · LO QUE EL MOTOR FIRMA SOLO ═

/** El guion de la corrida (1): frotar hasta prender, y atar la vara ARDIENDO. */
function corridaDelFardo(): Detector {
  let w = mundoCorrido(
    [
      { body: cuerpoDeAna(100_000), at: EN(0, 0) },
      { body: pieza('vara', 'madera', 0.5), at: EN(0, 0), heldBy: 'ana' },
      { body: pieza('vb', 'madera', 0.5), at: EN(0, 0), heldBy: 'ana' },
      { body: pieza('corteza', 'corteza', 0.5), at: EN(0, 0) },
      { body: pieza('junco', 'junco', 0.3), at: EN(0, 0) },
    ],
    [unActor(['vara', 'vb'])],
  )
  const atar = apply(QUIEN, PHYS, UNION.id, [
    { name: 'binder', body: 'junco' },
    { name: 'a', body: 'vara' },
    { name: 'b', body: 'corteza' },
  ])
  if (atar === undefined) throw new Error('el catálogo ya no tiene `union`')
  const frotar = frotarLaVara()
  const guion: readonly Intent[] = [
    ...Array.from({ length: 60 }, () => frotar),
    drop(QUIEN, 'vb'),
    take(QUIEN, 'corteza'),
    take(QUIEN, 'junco'),
    ...Array.from({ length: 40 }, () => atar),
  ]
  const d = new Detector()
  d.observar({ state: w, events: [] })
  for (const i of guion) {
    const out = stepWorld(w, [i])
    w = out.state
    d.observar({ state: w, events: out.events })
  }
  return d
}

describe('frente 6 · la REGLA 6: dos secuencias que el motor escribía sin que nadie pensara', () => {
  it('EL MECANISMO, que no cambió: `unir` hereda la temperatura y el fuego frotado cambia de nombre', () => {
    // Corrido con `stepWorld` de punta a punta. La criatura hace tres cosas y
    // ninguna es propagar fuego: frota una vara hasta prenderla, suelta la otra,
    // levanta una corteza y un junco, y ATA la vara ardiendo a la corteza.
    //
    // `unir` devuelve `state: { ...otro.state, ...a.state }`
    // (`physics/src/leyes.ts:1735`): el ensamble hereda la TEMPERATURA de `a`. Nace
    // ardiendo y con un id nuevo que no está en `frotados`, porque el que se frotó
    // se llamaba `vara`. Eso sigue siendo verdad del MOTOR y por eso se afirma acá
    // aparte: lo que se reparó es el juez, no `unir`.
    const d = corridaDelFardo()
    console.log(`\n  frotados: [${[...d.cronica.frotados].join(', ')}]`)
    expect([...d.cronica.frotados]).toEqual(['vara'])
    expect(d.cronica.ensambles.length).toBe(1)
    // El ensamble NACIÓ ya por encima de su punto de ignición —el fuego empieza en
    // el mismo tick en que nace el cuerpo— y por eso no se propagó nada.
    const ensamble = d.cronica.ensambles[0]
    expect(ensamble).toBeDefined()
    const fuego = ensamble === undefined ? undefined : d.cronica.fuegos.get(ensamble.id)
    expect(fuego?.primerTick).toBe(ensamble?.tick)
    expect(ensamble?.nacioApagado).toBe(false)
  })

  it('REPARADO · el detector 7 ya no firma ese renombre: pide nacer apagado y cruzar después', () => {
    // Antes de la reparación el juez escribía sobre esta misma corrida: «nació de
    // una union completa de ana en el tick 83 y ardió desde el 83 con 282,81 de
    // potencia, SIN QUE NADIE LO FROTARA NUNCA» — sobre un fuego que la criatura
    // había encendido con las manos cuarenta ticks antes, y con la contradicción
    // servida al lado, porque el contra-detector decía que el mundo nunca puso la
    // cadena delante. Las dos condiciones nuevas son preguntas al motor:
    // `qualityOf(·,'temperature') < qualityOf(·,'ignitionPoint')` en el tick del
    // nacimiento, y `emitsPower > 0` en algún tick POSTERIOR.
    const v = corridaDelFardo().veredicto()
    expect(vio(v, 'el-fardo-de-corteza')).toBe(false)
    // Y el contra-detector sigue diciendo que la cadena no estaba servida, que es
    // lo coherente: acá no había con qué propagar nada.
    expect(situacionDe(v, 'el-fardo-de-corteza')).toBe(false)
  })

  /** El mundo del hallazgo (2): una fogata prendida, seis pescados, nadie actuando. */
  function corridaSinIntenciones(): Veredicto {
    const bodies: WorldBody[] = [
      { body: cuerpoDeAna(1_000_000), at: EN(9, 9) },
      { body: pieza('fogata', 'madera', 2.5, 700), at: EN(0, 0) },
    ]
    for (let i = 0; i < 6; i++) bodies.push({ body: pieza(`pez-${String(i)}`, 'pescado', 2), at: EN(i, 0) })
    let w = mundoCorrido(bodies, [unActor()])
    const d = new Detector()
    d.observar({ state: w, events: [] })
    for (let t = 0; t < 3000; t++) {
      const out = stepWorld(w, [])
      w = out.state
      d.observar({ state: w, events: out.events })
    }
    return d.veredicto()
  }

  it('REPARADO · `el-leno-mas-grande-que-todavia-cocina` ya no dispara con CERO intenciones', () => {
    // El detector 8 pedía tres cosas y el motor firmaba las tres solo:
    //   (a) un cuerpo que ardió y NO fue el rol `a` de una fricción — la fogata
    //       nunca se frotó, ya venía prendida;
    //   (b) que NO fuera el más liviano de los `fuelEnergy > 0` a tiro — el pescado
    //       tiene `fuelEnergy` 2, así que contaba como leño;
    //   (c) que después algo entrara en ventana de cocción — los pescados de al lado
    //       del fuego entran solos.
    //
    // Las dos condiciones nuevas cierran (a) y (b) por separado: el cuerpo que ardió
    // tiene que haber pasado por una mano o por un `puso` —acá no hay ni una
    // intención en 3000 ticks, así que no— y la comida sale del conjunto de leños
    // porque `calories > 0`. El dato del pescado sigue siendo el mismo y por eso se
    // sigue midiendo: es lo que hacía de un pescado un leño alternativo.
    expect(qualityOf(pieza('p', 'pescado', 2), 'fuelEnergy', PHYS)).toBe(2)
    expect(qualityOf(pieza('p', 'pescado', 2), 'calories', PHYS)).toBeGreaterThan(0)
    const v = corridaSinIntenciones()
    console.log(`  8 · cero intenciones · aparecio=${String(vio(v, 'el-leno-mas-grande-que-todavia-cocina'))}`)
    expect(vio(v, 'el-leno-mas-grande-que-todavia-cocina')).toBe(false)
    // Y lo que sí ocurrió en ese mundo, para que se vea que el mundo no está vacío:
    // hubo fuego y hubo cocción. Lo que no hubo es una conducta.
    expect(v.ticks).toBe(3000)
  })

  it('y el fuego de esa corrida sigue estando: lo que falta es el acto, no el fenómeno', () => {
    // El control del control. Si el detector hubiera dejado de disparar porque la
    // crónica dejó de ver el fuego, la reparación sería una ceguera y no un
    // arreglo. La fogata está en `fuegos` y hubo piezas en cocción; lo único que
    // falta es que alguien la haya levantado.
    const d = new Detector()
    const bodies: WorldBody[] = [
      { body: cuerpoDeAna(1_000_000), at: EN(9, 9) },
      { body: pieza('fogata', 'madera', 2.5, 700), at: EN(0, 0) },
    ]
    for (let i = 0; i < 6; i++) bodies.push({ body: pieza(`pez-${String(i)}`, 'pescado', 2), at: EN(i, 0) })
    let w = mundoCorrido(bodies, [unActor()])
    d.observar({ state: w, events: [] })
    for (let t = 0; t < 300; t++) {
      const out = stepWorld(w, [])
      w = out.state
      d.observar({ state: w, events: out.events })
    }
    expect(d.cronica.fuegos.has('fogata')).toBe(true)
    expect(d.cronica.ultimoTickDeCoccion).toBeDefined()
    expect(d.cronica.tocados.has('fogata')).toBe(false)
  })
})

// ═══ FRENTE 4 · ¿EL NEGATIVO ES DE VERDAD NEGATIVO? ═════════════════════════

describe('frente 4 · la alternativa que los detectores 1 y 2 dicen medir NO ARDE', () => {
  // `piedra` es la trampa y está sembrada donde está el pescado: `agua-dulce` la
  // siembra con peso 3, de 0,2 a 3 kg (`oracle/src/bioma.ts:296`). Pasa el rol `a`
  // de `friccion` y tiene `fuelEnergy` 0: frotarla no enciende nada nunca.
  it('el dato: la piedra cumple el rol `a` y no tiene con qué arder', () => {
    const p = pieza('p', 'piedra', 1)
    expect(qualityOf(p, 'rigidity', PHYS)).toBe(0.95)
    expect(cumpleRol(p, ROL_A_DE_FRICCION(), PHYS)).toBe(true)
    expect(qualityOf(p, 'fuelEnergy', PHYS)).toBe(0)
    expect(qualityOf({ ...p, state: { temperature: 2000 } }, 'emitsPower', PHYS)).toBe(0)
  })

  const ROLES = [
    { name: 'a', body: 'vara' },
    { name: 'b', body: 'vb' },
    { name: 'actor', body: 'ana-cuerpo' },
  ]

  /** Una vara que se frota, su compañera, y DOS PIEDRAS de adorno. */
  const conPiedras = (tVara: number, tPez: number, doing: boolean): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enLaMano(cuerpo('vara', 'madera', 0.5, { temperature: tVara }), EN(0, 0), 'ana'),
      enLaMano(cuerpo('vb', 'madera', 0.5, { temperature: 15 }), EN(0, 0), 'ana'),
      // La chica hace que la vara «no sea la más liviana» → detector 2.
      enElPiso(cuerpo('guijarro', 'piedra', 0.2, { temperature: 15 }), EN(1, 0)),
      // La grande hace que «hubo uno más pesado sin tocar» → detector 1.
      enElPiso(cuerpo('canto', 'piedra', 2.5, { temperature: 15 }), EN(1, 1)),
      enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 1)),
    ],
    actors: [actor('ana', doing ? { doing: haciendo('friccion', ROLES) } : {})],
    events: doing ? [proceso('ana', 'friccion')] : [],
  })

  const GUION: readonly Paso[] = [
    conPiedras(15, 15, false),
    conPiedras(15, 15, true),
    conPiedras(700, 15, true),
    conPiedras(700, 100, false),
  ]

  it('REPARADO · con dos piedras de adorno, los detectores 1 y 2 ya no firman nada', () => {
    // Antes: el 2 escribía «ana eligió «vara» de 0,5000 kg teniendo a mano
    // «guijarro» de 0,2000 kg; prendió y después algo entró en cocción» y el 1
    // escribía «tenía a tiro «canto» de 2,5000 kg, que cumplía el mismo rol y no
    // tocó nunca». Las dos alternativas eran incombustibles: elegirlas no enciende
    // nada, y una decisión entre lo que sirve y lo que no existe no es una
    // decisión. `candidatosDeFriccion` le pregunta ahora al motor, con
    // `potenciaSiArdiera`, si el candidato entregaría algo.
    //
    // Y el mundo es el mismo: había UNA sola vara encendible y la criatura la
    // frotó. Que no dispare nada es exactamente lo correcto.
    const v = juez(GUION)
    expect([
      vio(v, 'la-vara-mas-liviana-que-igual-cocina'),
      vio(v, 'no-frotar-lo-que-no-alcanza-a-encender'),
    ]).toEqual([false, false])
  })

  it('y el contra-detector tampoco: la piedra dejó de ser «el candidato pesado» de la trampa', () => {
    // La otra mitad del mismo arreglo, y es la que evita que el cero se lea mal. El
    // contra-detector de la entrada 1 pide «un candidato del rol `a` por encima de
    // 0,72 kg»; el canto pesa 2,5 y confirmaba la trampa mirando la misma piedra
    // que el detector. Ahora ninguno de los dos la ve, así que la fila sale como
    // NO MEDIDA —que es la verdad de esta escena— y no como ausencia.
    const v = juez(GUION)
    expect(situacionDe(v, 'no-frotar-lo-que-no-alcanza-a-encender')).toBe(false)
    expect(situacionDe(v, 'la-vara-mas-liviana-que-igual-cocina')).toBe(false)
  })

  it('y NO es que el detector se haya quedado ciego: con dos VARAS de masas distintas dispara', () => {
    // El control de la reparación. Mismo guion, con las dos piedras cambiadas por
    // dos maderas de las mismas masas: 0,2 y 2,5 kg, los dos extremos de lo que
    // `agua-dulce` siembra (`bioma.ts:295`). Ahí la alternativa SÍ arde y los dos
    // detectores vuelven a firmar. Sin este renglón, la reparación de arriba sería
    // indistinguible de haber roto los dos detectores.
    const conVaras = (tVara: number, tPez: number, doing: boolean): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('vara', 'madera', 0.5, { temperature: tVara }), EN(0, 0), 'ana'),
        enLaMano(cuerpo('vb', 'madera', 0.5, { temperature: 15 }), EN(0, 0), 'ana'),
        enElPiso(cuerpo('ramita', 'madera', 0.2, { temperature: 15 }), EN(1, 0)),
        enElPiso(cuerpo('tronco', 'madera', 2.5, { temperature: 15 }), EN(1, 1)),
        enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 1)),
      ],
      actors: [actor('ana', doing ? { doing: haciendo('friccion', ROLES) } : {})],
      events: doing ? [proceso('ana', 'friccion')] : [],
    })
    const v = juez([conVaras(15, 15, false), conVaras(15, 15, true), conVaras(700, 15, true), conVaras(700, 100, false)])
    console.log(`\n  2 · ${evidenciaDe(v, 'la-vara-mas-liviana-que-igual-cocina')}`)
    console.log(`  1 · ${evidenciaDe(v, 'no-frotar-lo-que-no-alcanza-a-encender')}`)
    expect([
      vio(v, 'la-vara-mas-liviana-que-igual-cocina'),
      vio(v, 'no-frotar-lo-que-no-alcanza-a-encender'),
    ]).toEqual([true, true])
    expect(evidenciaDe(v, 'la-vara-mas-liviana-que-igual-cocina')).toContain('ramita')
    expect(evidenciaDe(v, 'no-frotar-lo-que-no-alcanza-a-encender')).toContain('tronco')
  })
})

describe('frente 4 · `taparlo-con-lo-que-respira` está confundido con la masa', () => {
  it('el dato, corrido: la duración es exactamente lineal en la masa', () => {
    const medido: [number, number][] = []
    for (const m of [0.2, 0.5, 1.5, 2.5]) {
      let w = mundoCorrido(
        [
          { body: cuerpoDeAna(1_000_000), at: EN(9, 9) },
          { body: pieza('f', 'madera', m, 700), at: EN(0, 0) },
        ],
        [unActor()],
      )
      let ticks = 0
      for (let t = 0; t < 4000; t++) {
        w = stepWorld(w, []).state
        const f = w.bodies.get('f')
        if (f === undefined || qualityOf(f.body, 'emitsPower', PHYS) <= 0) break
        ticks += 1
      }
      medido.push([m, ticks])
    }
    console.log(`\n  duración por masa: ${medido.map(([m, t]) => `${String(m)} kg → ${String(t)} ticks`).join(' · ')}`)
    expect(medido).toEqual([
      [0.2, 199],
      [0.5, 499],
      [1.5, 1499],
      [2.5, 2500],
    ])
  })

  /** El leño grande tapado con MADERA contra la ramita al aire, que se apaga. */
  const escenaDeLaTapa = (t: number): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enElPiso(cuerpo('grande', 'madera', 2.5, { temperature: 700 }), EN(0, 0)),
      tapando(cuerpo('tabla', 'madera', 0.3, { temperature: 15 }), EN(0, 0), 'grande'),
      enElPiso(cuerpo('ramita', 'madera', 0.2, { temperature: t >= 3 ? 15 : 700 }), EN(5, 5)),
      enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(0, 0)),
    ],
    actors: [actor('ana')],
    events: t === 0 ? [puso('ana', 'tabla', EN(0, 0))] : [],
  })
  const GUION_DE_LA_TAPA: readonly Paso[] = [0, 1, 2, 3, 4, 5, 6].map((t) => escenaDeLaTapa(t))

  it('REPARADO · el leño grande tapado con MADERA ya no le gana a una ramita al aire', () => {
    // El detector comparaba `rachaMaxima` del fuego tapado contra la del más largo
    // SIN tapar de la misma partida. No controlaba la masa, y la masa es lo que
    // manda: 2,5 kg contra 0,2 kg son 2500 ticks contra 199, medido tres renglones
    // más arriba en este mismo archivo.
    //
    // Y lo que tapa es MADERA, permeabilidad 0,12 — la fila que la tabla medida del
    // documento (§4, entrada 3) marca como «CRUDO, ni se movió». La secuencia se
    // llama `taparlo-con-lo-que-RESPIRA` y esto era taparlo con lo que ahoga. El
    // testigo tiene que pesar lo mismo al centésimo, y acá no hay ninguno.
    expect(qualityOf(pieza('t', 'madera', 0.3), 'permeability', PHYS)).toBe(0.12)
    expect(vio(juez(GUION_DE_LA_TAPA), 'taparlo-con-lo-que-respira')).toBe(false)
  })

  it('y con un testigo de la MISMA masa el detector vuelve a firmar: no quedó ciego', () => {
    // El control de la reparación. La ramita pasa de 0,2 a 2,5 kg —la masa del leño
    // tapado— y arde menos ticks; ahí sí hay una comparación que quiere decir algo,
    // porque lo único distinto entre los dos fuegos es la tapa.
    const conTestigo = (t: number): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('grande', 'madera', 2.5, { temperature: 700 }), EN(0, 0)),
        tapando(cuerpo('tabla', 'junco', 0.3, { temperature: 15 }), EN(0, 0), 'grande'),
        enElPiso(cuerpo('testigo', 'madera', 2.5, { temperature: t >= 3 ? 15 : 700 }), EN(5, 5)),
        enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(0, 0)),
      ],
      actors: [actor('ana')],
      events: t === 0 ? [puso('ana', 'tabla', EN(0, 0))] : [],
    })
    const v = juez([0, 1, 2, 3, 4, 5, 6].map(conTestigo))
    console.log(`  3 · ${evidenciaDe(v, 'taparlo-con-lo-que-respira')}`)
    expect(vio(v, 'taparlo-con-lo-que-respira')).toBe(true)
    expect(evidenciaDe(v, 'taparlo-con-lo-que-respira')).toContain('pesaba lo mismo')
  })
})

describe('frente 4 · `cocinar-el-lote-en-un-solo-fuego` no pide un solo fuego', () => {
  // El intervalo de fuego es GLOBAL —«del primer tick en que algo arde al primero
  // posterior en que no arde nada»— y `cocidas` es un `Set` de la partida, no del
  // fuego. Dos fogatas a diez celdas, dos pescados en cada una.
  const dosFuegos = (): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enElPiso(cuerpo('f1', 'madera', 0.5, { temperature: 700 }), EN(0, 0)),
      enElPiso(cuerpo('p1', 'pescado', 2, { temperature: 100 }), EN(0, 0)),
      enElPiso(cuerpo('p2', 'pescado', 2, { temperature: 100 }), EN(1, 0)),
      enElPiso(cuerpo('f2', 'madera', 0.5, { temperature: 700 }), EN(10, 10)),
      enElPiso(cuerpo('p3', 'pescado', 2, { temperature: 100 }), EN(10, 10)),
      enElPiso(cuerpo('p4', 'pescado', 2, { temperature: 100 }), EN(11, 10)),
    ],
    actors: [actor('ana')],
  })

  it('REPARADO · dos fuegos con dos piezas cada uno ya no cuentan cuatro', () => {
    // Antes el juez firmaba «4 piezas distintas en cocción dentro del intervalo de
    // fuego [0..2]: p1, p2, p3, p4», y entre las cuatro estaba `p3`, que nunca
    // estuvo a menos de diez celdas del primer fuego. El costo fijo que la
    // secuencia dice amortizar es el de UN fuego —659,86 de stamina—: dos fuegos
    // son dos costos y no uno amortizado.
    const v = juez([dosFuegos(), dosFuegos(), dosFuegos()])
    expect(vio(v, 'cocinar-el-lote-en-un-solo-fuego')).toBe(false)
    // Y la crónica lo dice con números: cada fuego se acredita DOS piezas, que es
    // lo que cada uno cocinó.
    const d = new Detector()
    d.observarTodo(partida([dosFuegos(), dosFuegos(), dosFuegos()]))
    const cuentas = [...d.cronica.fuegos.values()].map((f) => [f.id, f.cocidasCerca.size])
    console.log(`  6 · piezas por fuego: ${cuentas.map(([i, n]) => `${String(i)}→${String(n)}`).join(' · ')}`)
    expect(cuentas).toEqual([
      ['f1', 2],
      ['f2', 2],
    ])
  })

  it('y con las cuatro piezas alrededor de UN solo fuego vuelve a firmar', () => {
    // El control de la reparación: el mismo mundo con el segundo fuego apagado y
    // sus dos piezas movidas al primero. Ahí las cuatro cuelgan del mismo costo
    // fijo, que es exactamente lo que la entrada dice medir.
    const unSoloFuego = (): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('f1', 'madera', 0.5, { temperature: 700 }), EN(0, 0)),
        enElPiso(cuerpo('p1', 'pescado', 2, { temperature: 100 }), EN(0, 0)),
        enElPiso(cuerpo('p2', 'pescado', 2, { temperature: 100 }), EN(1, 0)),
        enElPiso(cuerpo('p3', 'pescado', 2, { temperature: 100 }), EN(0, 1)),
        enElPiso(cuerpo('p4', 'pescado', 2, { temperature: 100 }), EN(1, 1)),
      ],
      actors: [actor('ana')],
    })
    const v = juez([unSoloFuego(), unSoloFuego(), unSoloFuego()])
    console.log(`  6 · ${evidenciaDe(v, 'cocinar-el-lote-en-un-solo-fuego')}`)
    expect(vio(v, 'cocinar-el-lote-en-un-solo-fuego')).toBe(true)
    expect(evidenciaDe(v, 'cocinar-el-lote-en-un-solo-fuego')).toContain('a tiro de «f1»')
  })
})

describe('frente 4 · `comerla-en-el-pico-de-calorias` no medía un pico', () => {
  it('REPARADO · comer MIL SEGUNDOS después del máximo ya no pasa por «el pico»', () => {
    // Corrido: un pescado de 2 kg apoyado sobre una vara encendida de 0,47 kg —el
    // fuego más barato que cocina, §3 del documento— y mil segundos de mundo. En el
    // último tick, la criatura come.
    const bodies: readonly WorldBody[] = [
      { body: cuerpoDeAna(1_000_000), at: EN(1, 1) },
      { body: pieza('fuego', 'madera', 0.47, 700), at: EN(0, 0) },
      { body: pieza('pez', 'pescado', 2), at: EN(0, 0), supportedBy: 'fuego' },
    ]
    let w = mundoCorrido(bodies, [unActor()])
    const d = new Detector()
    d.observar({ state: w, events: [] })
    // La serie se junta entera y el máximo se busca DESPUÉS: un máximo corriente
    // compararía los primeros ticks contra un techo que todavía no subió, y la
    // cuenta daría 20.000 por construcción.
    const serie: number[] = []
    const TOPE = 20_000
    for (let t = 0; t < TOPE; t++) {
      const out = stepWorld(w, t === TOPE - 1 ? [eat(QUIEN, 'pez')] : [])
      w = out.state
      d.observar({ state: w, events: out.events })
      const p = w.bodies.get('pez')
      serie.push(p === undefined ? (serie[serie.length - 1] ?? 0) : qualityOf(p.body, 'calories', PHYS))
    }
    let max = 0
    let tMax = -1
    for (const [i, c] of serie.entries()) {
      if (c > max) {
        max = c
        tMax = i
      }
    }
    let dentro = 0
    for (const c of serie) if (c >= 0.9 * max) dentro += 1
    const v = d.veredicto()
    console.log(
      `\n  5 · pico ${max.toFixed(4)} en el tick ${String(tMax)} · ticks con >= 90% del pico: ${String(dentro)}/${String(TOPE)}` +
        ` · comió en el ${String(TOPE - 1)}, o sea ${String(TOPE - 1 - tMax)} ticks después`,
    )
    expect(tMax).toBe(129)
    expect(max).toBeCloseTo(13.7459, 3)
    expect(dentro).toBe(19943)
    // LO QUE LA MEDICIÓN DICE: `calories` sube en 129 ticks y tarda más de 19.870
    // en perder el 10%, o sea que la puerta del 90% del máximo está abierta el
    // 99,7% de la partida. Cualquier umbral porcentual equivale a no poner
    // ninguno, y por eso la tolerancia se mide ahora en TICKS alrededor del
    // `argmax`, con la ventana de después durando lo que duró la subida.
    expect(vio(v, 'comerla-en-el-pico-de-calorias')).toBe(false)
    // Y la crónica guarda el argmax, que es el dato que faltaba.
    const p = d.cronica.piezas.get('pez')
    console.log(`      la crónica: pico en el tick ${String(p?.tickMaximas)} de una pieza vista desde el ${String(p?.primerTick)}`)
    expect(p?.tickMaximas).toBe(130)
  })

  it('y comerla EN el pico sí dispara: la reparación acota el tiempo, no lo cierra', () => {
    // El control de la reparación, sobre el mismo mundo corrido. La criatura come
    // en el tick 200 —setenta después del máximo, adentro de la ventana que dura lo
    // que duró la subida— y el juez firma. Sin este renglón, el `false` de arriba
    // sería indistinguible de un detector que no dispara nunca.
    const bodies: readonly WorldBody[] = [
      { body: cuerpoDeAna(1_000_000), at: EN(1, 1) },
      { body: pieza('fuego', 'madera', 0.47, 700), at: EN(0, 0) },
      { body: pieza('pez', 'pescado', 2), at: EN(0, 0), supportedBy: 'fuego' },
    ]
    let w = mundoCorrido(bodies, [unActor()])
    const d = new Detector()
    d.observar({ state: w, events: [] })
    const CUANDO_COME = 200
    for (let t = 0; t < 260; t++) {
      const out = stepWorld(w, t === CUANDO_COME ? [eat(QUIEN, 'pez')] : [])
      w = out.state
      d.observar({ state: w, events: out.events })
    }
    const v = d.veredicto()
    console.log(`  5 · ${evidenciaDe(v, 'comerla-en-el-pico-de-calorias')}`)
    expect(vio(v, 'comerla-en-el-pico-de-calorias')).toBe(true)
  })
})

// ═══ FRENTE 3 · ¿DOS DETECTORES SON EL MISMO? ═══════════════════════════════

describe('frente 3 · un solo acto que firma dos secuencias', () => {
  const ROLES = [
    { name: 'a', body: 'media' },
    { name: 'b', body: 'vb' },
    { name: 'actor', body: 'ana-cuerpo' },
  ]
  const tresVaras = (tVara: number, tPez: number, doing: boolean): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enLaMano(cuerpo('media', 'madera', 0.5, { temperature: tVara }), EN(0, 0), 'ana'),
      enLaMano(cuerpo('vb', 'madera', 0.5, { temperature: 15 }), EN(0, 0), 'ana'),
      enElPiso(cuerpo('chica', 'madera', 0.3, { temperature: 15 }), EN(1, 0)),
      enElPiso(cuerpo('grande', 'madera', 2.5, { temperature: 15 }), EN(1, 1)),
      enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 1)),
    ],
    actors: [actor('ana', doing ? { doing: haciendo('friccion', ROLES) } : {})],
    events: doing ? [proceso('ana', 'friccion')] : [],
  })
  const UN_ACTO: readonly Paso[] = [
    tresVaras(15, 15, false),
    tresVaras(15, 15, true),
    tresVaras(700, 15, true),
    tresVaras(700, 100, false),
  ]

  it('HALLAZGO · una sola fricción dispara la 1 y la 2 a la vez, y acá la alternativa SÍ arde', () => {
    // Tres candidatos de masas distintas, todos madera: no hay truco de piedras.
    // La criatura frota el del medio, prende, y algo se cocina.
    //   · el 1 dispara porque quedó uno MÁS PESADO sin tocar;
    //   · el 2 dispara porque no eligió el MÁS LIVIANO.
    // El documento declara la adyacencia —«son los dos lados del mismo umbral»— y
    // el informe igual las suma como dos. Con nueve entradas y un piso de cuatro,
    // frotar un palo una vez entrega la mitad del criterio.
    const v = juez(UN_ACTO)
    console.log(`\n  un solo acto → ${v.aparecidas.join(' + ')}`)
    expect(vio(v, 'no-frotar-lo-que-no-alcanza-a-encender')).toBe(true)
    expect(vio(v, 'la-vara-mas-liviana-que-igual-cocina')).toBe(true)
    expect(v.aparecidas.length).toBe(2)
  })

  it('HALLAZGO · y un solo fardo, ahora BIEN ARMADO, sigue disparando la 7 y la 8 a la vez', () => {
    // La 8 es «la 2 con `friccion` cambiado por lo prendió el fuego» y la 7 es
    // «nació atado, apagado, y después ardió». Todo cuerpo que dispara la 7 es un
    // fuego que no se frotó, o sea el candidato exacto de la 8: sólo le falta un
    // combustible más liviano a tiro y que algo se cocine, que es lo que la cadena
    // del fardo trae.
    //
    // LA ESCENA CAMBIÓ Y EL HALLAZGO NO. Antes alcanzaba con un fardo que nacía ya
    // a 700 °C y que nadie había tocado; con los detectores reparados eso no firma
    // nada, y correspondía. Acá el fardo se arma como la entrada 7 lo describe:
    // nace APAGADO en el tick 1, en la mano de la criatura —o sea que pasó por el
    // acto que la 8 pide—, y recién en el 2 cruza sus 250 °C. La adyacencia
    // sobrevive a la reparación, y ése es el punto: con nueve entradas y un piso
    // de cuatro, una sola maniobra sigue entregando dos.
    const escena = (t: number): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enLaMano(cuerpo('fardo', 'corteza', 1, { temperature: t <= 1 ? 15 : 700 }), EN(0, 0), 'ana'),
        enElPiso(cuerpo('ramita', 'corteza', 0.05, { temperature: 15 }), EN(1, 0)),
        enElPiso(cuerpo('pez', 'pescado', 2, { temperature: t >= 3 ? 100 : 15 }), EN(0, 1)),
      ],
      actors: [actor('ana', { holding: ['fardo'] })],
      events: t === 1 ? [proceso('ana', 'union', true), nacio('ana', 'fardo')] : [],
    })
    const v = juez([escena(0), escena(1), escena(2), escena(3), escena(4)])
    console.log(`  un solo fardo → ${v.aparecidas.join(' + ')}`)
    expect(vio(v, 'el-fardo-de-corteza')).toBe(true)
    expect(vio(v, 'el-leno-mas-grande-que-todavia-cocina')).toBe(true)
  })
})

// ═══ FRENTE 5 · ¿SOBREVIVE A UN RENOMBRE? ═══════════════════════════════════

describe('frente 5 · el orden de los cuerpos, el de los eventos y los ids', () => {
  const ROLES = [
    { name: 'a', body: 'media' },
    { name: 'b', body: 'vb' },
    { name: 'actor', body: 'ana-cuerpo' },
  ]
  const escena = (tVara: number, tPez: number, doing: boolean): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(0, 0)),
      enLaMano(cuerpo('media', 'madera', 0.5, { temperature: tVara }), EN(0, 0), 'ana'),
      enLaMano(cuerpo('vb', 'madera', 0.5, { temperature: 15 }), EN(0, 0), 'ana'),
      enElPiso(cuerpo('chica', 'madera', 0.3, { temperature: 15 }), EN(1, 0)),
      enElPiso(cuerpo('grande', 'madera', 2.5, { temperature: 15 }), EN(1, 1)),
      enElPiso(cuerpo('pez', 'pescado', 2, { temperature: tPez }), EN(0, 1)),
    ],
    actors: [actor('ana', doing ? { doing: haciendo('friccion', ROLES) } : {})],
    events: doing ? [proceso('ana', 'friccion')] : [],
  })
  const GUION: readonly Paso[] = [escena(15, 15, false), escena(15, 15, true), escena(700, 15, true), escena(700, 100, false)]

  it('el veredicto no cambia si se da vuelta el orden de los cuerpos', () => {
    const alReves = GUION.map((p) => ({ ...p, bodies: [...(p.bodies ?? [])].reverse() }))
    expect(juez(alReves).aparecidas).toEqual(juez(GUION).aparecidas)
  })

  it('ni si se da vuelta el orden de los eventos dentro de cada tick', () => {
    // Vale probarlo aunque hoy cada tick traiga uno solo: la crónica lee los `nacio`
    // y los `proceso` en DOS pasadas justamente porque `rendir` empuja el `nacio`
    // antes que el `proceso`. Acá se le agrega ruido delante y detrás.
    const conRuido = GUION.map((p) => ({
      ...p,
      events: [...(p.events ?? []), proceso('ana', 'deshilachar')].reverse(),
    }))
    expect(juez(conRuido).aparecidas).toEqual(juez(GUION).aparecidas)
  })

  it('ni si se renombran todos los cuerpos: sólo cambian los nombres de la evidencia', () => {
    const mapa: Readonly<Record<string, string>> = {
      media: 'zzz-media',
      vb: 'aaa-vb',
      chica: 'zzz-chica',
      grande: 'aaa-grande',
      pez: 'mmm-pez',
    }
    const ren = (id: string): string => mapa[id] ?? id
    const renombrado = GUION.map((p) => ({
      ...p,
      bodies: (p.bodies ?? []).map((c) => ({ ...c, body: { ...c.body, id: ren(c.body.id) } })),
      actors: (p.actors ?? []).map((a) =>
        a.doing === undefined
          ? a
          : { ...a, doing: { ...a.doing, roles: a.doing.roles.map((r) => ({ ...r, body: ren(r.body) })) } },
      ),
    }))
    const v = juez(renombrado)
    expect(v.aparecidas).toEqual(juez(GUION).aparecidas)
    expect(evidenciaDe(v, 'la-vara-mas-liviana-que-igual-cocina')).toContain('zzz-chica')
  })
})

// ═══ FRENTE 2 · EL RUIDO DEL AZAR ═══════════════════════════════════════════
//
// El número que hace significativo a todos los demás, y que hasta esta tanda no
// tenía nadie. La criatura al azar y las dos corridas viven en `tests/azar.ts`,
// que las explica enteras; están afuera de este archivo porque **el banco del
// criterio tiene que publicar este número al lado del de la mente**, y un control
// que sólo existe adentro del archivo del adversario no se puede publicar.
//
// Acá quedan los tres tests que lo miden y el dato que obliga a que el azar
// persevere, que es lo que hace que el control no dé cero por construcción.

describe('frente 2 · EL RUIDO DEL AZAR, que es el número que le faltaba al banco', () => {
  it('el dato que obliga a que el azar persevere: un proceso no avanza solo', () => {
    let w = mundoCorrido(
      [
        { body: cuerpoDeAna(1000), at: EN(0, 0) },
        { body: pieza('vara', 'madera', 0.5), at: EN(0, 0), heldBy: 'ana' },
        { body: pieza('vb', 'madera', 0.5), at: EN(0, 0), heldBy: 'ana' },
      ],
      [unActor(['vara', 'vb'])],
    )
    w = stepWorld(w, [frotarLaVara()]).state
    for (let t = 0; t < 100; t++) w = stepWorld(w, []).state
    const v = w.bodies.get('vara')
    expect(v).toBeDefined()
    expect(qualityOf(v?.body ?? pieza('x', 'madera', 1), 'temperature', PHYS)).toBeCloseTo(15, 3)
    expect(w.actors.get('ana')?.doing).toBeUndefined()
  })

  it('HALLAZGO · el azar SIN fuego dispara `no-frotar-lo-que-no-alcanza-a-encender` en 20 de 20', () => {
    // El resultado que menos me esperaba y el más caro de los diez. La criatura al
    // azar, con el tanque del documento y sin nada regalado, dispara la entrada 1
    // EN LAS VEINTE PARTIDAS.
    //
    // Y se entiende leyendo el detector: pide (a) que haya habido al menos una
    // fricción, (b) que TODAS hayan terminado en ignición y (c) que en alguna
    // hubiera a tiro un candidato del rol `a` más pesado sin tocar. Un bicho que
    // agarra dos cosas y las frota ochenta ticks prende una madera de 0,3–0,5 kg
    // —422 a 702 de stamina, adentro del tanque— y (c) se lo regala el mundo:
    // `agua-dulce` siembra piedra hasta 3 kg y madera hasta 2,5.
    //
    // La entrada 1 es LA ÚNICA cuyo acto es NO ACTUAR —«se niega si ninguno entra
    // en el tanque»— y la firma que el detector le puso la produce el azar sin
    // negarse a nada.
    const c = correrElControl('EL AZAR SIN FUEGO', false, 1000)
    console.log(`\n${tablaDelControl(c)}`)
    expect(c.cuentan).toEqual(['no-frotar-lo-que-no-alcanza-a-encender'])
    // EL TIEMPO EXPLÍCITO, y no es una concesión: veinte partidas de 20.000 ticks
    // tardan **3,6 s** solas contra el default de 5 s de vitest, o sea que este `it`
    // vivía al 72% de su plazo y se ponía rojo cada vez que la máquina estaba
    // ocupada corriendo el resto del árbol. Es un rojo intermitente, que es la
    // clase de rojo que enseña a ignorar el rojo.
    //
    // Medido a los dos lados del ADR II-0013 para descartar que lo hubiera movido
    // el cobro del veneno: 3612 ms antes y 3699 ms después. No es la carga de
    // trabajo lo que cambió; es la carga de la máquina. Ninguna aserción se toca.
  }, 60_000)

  it('HALLAZGO · el azar CON el fuego regalado dispara la 6 y la 8 en 20 de 20', () => {
    // Regalarle el fuego a la criatura al azar es lo que separa «el detector es
    // duro» de «el mundo es duro»: siete de las nueve cuelgan de que haya fuego. El
    // tanque también se agranda, porque con 1000 se muere de puro vivir antes de
    // que el fuego grande se apague. Las dos son concesiones AL CONTROL, o sea que
    // esto es un PISO del ruido y no un techo.
    const c = correrElControl('EL AZAR CON EL FUEGO REGALADO', true, 40_000)
    console.log(`\n${tablaDelControl(c)}`)
    expect([...c.cuentan].sort()).toEqual([
      'cocinar-el-lote-en-un-solo-fuego',
      'el-leno-mas-grande-que-todavia-cocina',
    ])
  })

  it('EL NÚMERO · el azar firma TRES de las nueve, y el criterio pide cuatro', () => {
    // La unión de los dos controles. Ninguna de las tres necesitó que la criatura
    // mirara una masa, una permeabilidad ni una caloría: las tres las firma un
    // bicho que elige cuerpos con el dado.
    //
    //   1 · `no-frotar-lo-que-no-alcanza-a-encender`   20/20 sin fuego
    //   6 · `cocinar-el-lote-en-un-solo-fuego`         20/20 con fuego
    //   8 · `el-leno-mas-grande-que-todavia-cocina`    20/20 con fuego
    //
    // El criterio publicado pide CUATRO de diez, y §10 del documento resolvió que
    // con nueve el número no se mueve. O sea que el ruido del azar cubre TRES DE
    // LAS CUATRO que el proyecto necesita para seguir.
    const union = ruidoDelAzar()
    console.log(`\n  ══ EL RUIDO DEL AZAR: ${String(union.length)} DE 9 ══ ${union.join(' · ')}`)
    expect(union).toEqual([
      'cocinar-el-lote-en-un-solo-fuego',
      'el-leno-mas-grande-que-todavia-cocina',
      'no-frotar-lo-que-no-alcanza-a-encender',
    ])
  })

  it.fails('SIGUE ABIERTO · las siete reparaciones NO movieron el ruido: sigue en tres de nueve', () => {
    // ─── EL NÚMERO RE-MEDIDO DESPUÉS DE REPARAR, y hay que decirlo entero ─────
    //
    // El hallazgo del adversario pedía «arreglar los detectores 1, 6 y 8 y volver a
    // correr el control antes de leer cualquier resultado de la mente». Se
    // arreglaron los siete que eran de detector —los tres de esa lista incluidos— y **el control se
    // volvió a correr acá arriba, con las mismas 20 semillas y los mismos 20.000
    // ticks**. Da lo mismo que antes: 20/20, 20/20 y 20/20.
    //
    // POR QUÉ NO SE MOVIÓ, secuencia por secuencia, leído de las dos tablas:
    //
    //   1 · el filtro de `potenciaSiArdiera` saca las piedras del conjunto de
    //       candidatos, pero `agua-dulce` siembra MADERA de 0,3 a 2,5 kg y con diez
    //       sueltas casi siempre hay dos: el bicho frota una, prende, y queda otra
    //       más pesada sin tocar. La entrada 1 es la única cuyo acto es NO ACTUAR y
    //       su firma es un desenlace, no una abstención.
    //   6 · el conteo pasó a ser por cuerpo que arde, pero con el fuego REGALADO en
    //       (2,2) y cuatro pescados sembrados en un cuadrado de 4×4 las cuatro
    //       piezas están a tiro del mismo fuego y se cocinan solas. La cocción no
    //       pide un acto en ningún lado del detector.
    //   8 · el `puso`/`heldBy` y el filtro de la comida cierran el mundo de CERO
    //       intenciones, pero no el del azar: un bicho que agarra cuerpos al azar
    //       agarra también la fogata, y con eso el acto está.
    //
    // LO QUE ESTO ES: un hueco de la LISTA y no de los detectores, y por eso queda
    // en rojo en vez de repararse. Las tres entradas miden un DESENLACE —prendió,
    // se cocinó, no era el más liviano— y un desenlace lo puede producir el azar.
    // Cerrarlo pide cambiar lo que las entradas dicen medir, y la lista está
    // cerrada: §0 sólo deja tocar un error de detector, no una entrada.
    //
    // LO QUE OBLIGA MIENTRAS TANTO, y va escrito acá porque es la regla que el
    // banco tiene que aplicar al leer: **ninguna de estas tres puede contar para el
    // piso de cuatro**, así que el criterio real que la mente tiene que cruzar es
    // 4 sobre las 6 que quedan, y no 4 sobre 9.
    expect(ruidoDelAzar()).toEqual([])
  })
})

// ═══ EL INFORME ═════════════════════════════════════════════════════════════

describe('el informe · `SÍ … (no medida)` era una contradicción, y el resumen la sumaba', () => {
  const conFogata = (t: number): Paso => ({
    bodies: [
      enElPiso(criatura('ana'), EN(9, 9)),
      enElPiso(cuerpo('fogata', 'madera', 2.5, { temperature: 700 }), EN(0, 0)),
      enElPiso(cuerpo('ramita', 'corteza', 0.05, { temperature: 15 }), EN(1, 0)),
      enElPiso(cuerpo('pez', 'pescado', 2, { temperature: t >= 1 ? 100 : 15 }), EN(0, 1)),
    ],
    actors: [actor('ana')],
  })

  it('REPARADO por los dos lados · la escena que lo producía ya no dispara nada', () => {
    // ─── QUÉ ERA ESTO, y por qué la escena se queda ──────────────────────────
    //
    // `Detector.veredicto` tiene escrito que «una secuencia que apareció no puede
    // ser no medida», y lo cumplía SÓLO para la lista `noMedidas`: la fila salía
    // con `aparecio: true, situacion: false`, `tabla()` la imprimía como
    // `SÍ … (no medida)` y `resumir` la sumaba a `aparecioEn` igual. Medido en su
    // momento sobre esta misma escena: «apareció en 2/2 con situación en 0/2 →
    // cuenta: true».
    //
    // Ahora la escena no dispara: la fogata la puso el banco y no la criatura, así
    // que el detector 8 no la firma. La contradicción se cerró donde nacía —en el
    // detector— y la aritmética del informe se cerró aparte, en
    // `los-detectores.test.ts`, con un veredicto armado a mano. Las dos cosas
    // hacen falta: un detector puede volver a producir la combinación mañana.
    const v = juez([conFogata(0), conFogata(1), conFogata(2)])
    const fila = v.filas.find((f) => f.nombre === 'el-leno-mas-grande-que-todavia-cocina')
    console.log(`\n  informe · aparecio=${String(fila?.aparecio)} situacion=${String(fila?.situacion)}`)
    expect(fila?.aparecio).toBe(false)
    expect(fila?.situacion).toBe(false)
    const res = resumir([v, v])
    const f = res.filas.find((x) => x.nombre === 'el-leno-mas-grande-que-todavia-cocina')
    expect([f?.aparecioEn, f?.situacionEn, f?.contradictorioEn, f?.cuenta]).toEqual([0, 0, 0, false])
    // Y ninguna de las nueve queda contradiciendo a su contra-detector.
    expect(res.filas.filter((x) => x.contradictorioEn > 0)).toEqual([])
  })
})

// ═══ FRENTE 6 · DE CUÁL DE LAS TRES CAUSAS ES CADA CERO ═════════════════════

describe('frente 6 · los nueve ceros de la corrida, atribuidos', () => {
  it('la causa NO es la mente ni la muerte: el mundo no materializa lo que el dios siembra', () => {
    // `Decreto.chunk.sueltas` no tiene UN SOLO consumidor en `@anima/world`. Se lee
    // el directorio —así un módulo nuevo entra solo, igual que el guardián de la
    // regla 2— y se cuentan las apariciones fuera de comentarios.
    //
    // Con eso, la atribución de los nueve ceros de la corrida canónica es:
    //
    //   1, 2    · EL MUNDO. Hacen falta DOS candidatos del rol `a` y el arnés pone
    //             una sola vara; el mundo no agrega ninguna.
    //   3       · EL MUNDO. Pide un fuego y dos permeabilidades a mano.
    //   4       · EL MUNDO. Pide `sharpness >= 0,15`, y lo que hay es carne, madera
    //             y liana.
    //   5, 6    · EL MUNDO. Piden cocción, o sea fuego.
    //   7, 8, 9 · EL MUNDO. Piden corteza, un segundo combustible y una piedra.
    //
    // NINGUNO de los nueve es «la mente no llega» ni «se murió antes», y eso está
    // separado en la corrida: el control con el tanque lleno llega al 96,5% del
    // presupuesto y sigue dando 0 de 9 con 9 sin medir.
    const dir = fileURLToPath(new URL('../../world/src/', import.meta.url))
    const usos: string[] = []
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts'))) {
      const texto = readFileSync(dir + f, 'utf8')
      for (const [n, l] of texto.split('\n').entries()) {
        const t = l.trimStart()
        if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue
        if (/\bsueltas\b/.test(l)) usos.push(`${f}:${String(n + 1)}`)
      }
    }
    console.log(`\n  consumidores de \`sueltas\` en world/src, fuera de comentarios: ${usos.length === 0 ? 'NINGUNO' : usos.join(', ')}`)
    expect(usos).toEqual([])
  })

  it('y la 9 mide cero por el MUNDO y no por el detector: con los cuerpos delante dispara sola', () => {
    // El contraste que cierra el frente. `la-piedra-primero` es la única de las tres
    // nuevas que no depende de la 7, y con una fogata, una losa y un pescado apoyado
    // encima el detector firma en el primer tick. Su cero de la corrida es del
    // mundo, no del juez.
    const escena = (): Paso => ({
      bodies: [
        enElPiso(criatura('ana'), EN(0, 0)),
        enElPiso(cuerpo('fogata', 'madera', 2.5, { temperature: 700 }), EN(0, 0)),
        { ...enElPiso(cuerpo('losa', 'piedra', 1, { temperature: 15 }), EN(0, 0)), supportedBy: 'fogata' },
        { ...enElPiso(cuerpo('pez', 'pescado', 2, { temperature: 100 }), EN(0, 0)), supportedBy: 'losa' },
      ],
      actors: [actor('ana')],
    })
    const v = juez([escena(), escena()])
    console.log(`  9 · ${evidenciaDe(v, 'la-piedra-primero-y-la-comida-encima')}`)
    expect(vio(v, 'la-piedra-primero-y-la-comida-encima')).toBe(true)
  })
})
