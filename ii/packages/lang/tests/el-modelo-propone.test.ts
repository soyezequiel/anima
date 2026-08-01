/**
 * EL MODELO PROPONE, EL CÓDIGO LOCAL DISPONE.
 *
 * Es el tramo que la enmienda del ADR II-0024 pidió, y existe porque el criterio
 * tenía un agujero que sólo se ve cuando se juntan dos de sus puntos:
 *
 * > **Los cinco puntos se cumplen igual con el proveedor DESCONECTADO.** El
 * > punto 2 —«colgado da el mismo p95»— es trivialmente verde si el proveedor no
 * > existe.
 *
 * O sea que el criterio medía que el modelo no estorbe, y no medía que sirva.
 * Este archivo mide la otra mitad, y son dos cosas:
 *
 * 1. **el modelo SUBE la cobertura** — la tercera corrida del criterio;
 * 2. **`revisar` NUNCA empeora una lectura**, ni con basura, ni con una llave
 *    vencida, ni pisando lo que el lector local sí supo leer.
 *
 * La segunda es la que hace seguro tener esto puesto. Un invariante sin control
 * positivo es una intención, así que hay un bloque que le manda basura a
 * propósito.
 */

import { buildSeedPhysics } from '@anima/physics'
import { ESQUEMAS } from '@anima/plan'
import { describe, expect, it } from 'vitest'
import { PUENTE } from '../src/alias.js'
import { consultaDe, llaveDe, revisar } from '../src/consulta.js'
import type { RespuestaDelModelo } from '../src/consulta.js'
import { leer } from '../src/leer.js'
import { lexicoDe } from '../src/lexico.js'
import { clave } from '../src/normalizar.js'
import { CORPUS } from './corpus.js'

const phys = buildSeedPhysics()
const lexico = lexicoDe(phys, PUENTE)
const FIRMAS = [...new Set(ESQUEMAS.map((e) => e.establishes))]
const ESTABLECIBLES = new Set(FIRMAS)
const OPC = { phys, lexico, sabeElCatalogo: (f: string): boolean => ESTABLECIBLES.has(f) }

/**
 * UN MODELO SIMULADO, y lo que simula es lo ÚNICO que un modelo puede hacer acá:
 * elegir una firma de la lista que le mandaron.
 *
 * No inventa nada y no lee texto libre. Lo que hace es lo que un modelo de verdad
 * haría bien: mirar la frase, mirar el vocabulario de este mundo, y decir «esto
 * es una forma de pedir eso otro».
 *
 * Su tabla es chica a propósito. **No está acá para ser bueno, está acá para que
 * la corrida con proveedor exista y se pueda comparar contra la de sin.** Un
 * modelo simulado que acertara todo mediría el simulador, no el enganche.
 */
const LO_QUE_EL_MODELO_SABRIA: readonly (readonly [pista: string, firma: string])[] = [
  // «andá al río» — el lector local sale por `orientacion` porque `Predicado` no
  // habla del lugar. Un modelo puede leerlo como «quiere que vaya a pescar».
  ['rio', 'holding(tag:carnoso)'],
  ['pescar', 'holding(tag:carnoso)'],
  // «juntá leña» — el local llega a `holding(tag:fibroso)`, que no tiene camino.
  // El modelo puede saber que juntar leña es para hacer fuego.
  ['lena', 'emitsPower>0'],
  ['troncos', 'emitsPower>0'],
  ['tronco', 'emitsPower>0'],
  // Órdenes de Ánima I que este mundo no tiene, y que un modelo traduce a lo más
  // cercano que este mundo SÍ sabe hacer.
  ['choza', 'reach>=2'],
  ['silla', 'reach>=2'],
  ['muro', 'reach>=2'],
  ['manzana', 'holding(tag:carnoso)'],
]

/** Lo que contestaría el modelo a una consulta. `undefined` si no sabe. */
function proveedor(
  texto: string,
  llave: string,
  clausulas: readonly number[],
): RespuestaDelModelo | undefined {
  // `clave()` y no `toLowerCase()`: la primera version comparaba «rio» contra el
  // texto crudo «andá al río» y no enganchaba nada. Un modelo de verdad ve el
  // texto con acentos; la tabla de pistas esta normalizada, asi que el que se
  // tiene que mover es el texto — con la MISMA normalizacion que usa el lector,
  // no con una parecida.
  const t = clave(texto)
  const out: { indice: number; firma: string }[] = []
  for (const i of clausulas) {
    for (const [pista, firma] of LO_QUE_EL_MODELO_SABRIA) {
      if (t.includes(pista)) {
        out.push({ indice: i, firma })
        break
      }
    }
  }
  return out.length === 0 ? undefined : { llave, clausulas: out }
}

/** Cuántas cláusulas del corpus llegan a una meta. */
function cobertura(conModelo: boolean): { entendidas: number; total: number; porModelo: number } {
  let entendidas = 0
  let total = 0
  let porModelo = 0
  for (const f of CORPUS) {
    let l = leer(f.texto, OPC)
    if (conModelo) {
      const c = consultaDe(l, lexico, FIRMAS)
      if (c !== undefined) {
        const r = proveedor(c.texto, c.llave, c.clausulas)
        if (r !== undefined) l = revisar(l, r, lexico, { ofrecidas: c.firmas, sabeElCatalogo: OPC.sabeElCatalogo })
      }
    }
    for (const c of l.clausulas) {
      total++
      if (c.grado === 'entendida') entendidas++
      if (c.leidaPor === 'modelo') porModelo++
    }
  }
  return { entendidas, total, porModelo }
}

describe('(3) CON EL PROVEEDOR CONTESTANDO, LA COBERTURA SUBE', () => {
  it('y es la mitad del criterio que faltaba', () => {
    const sin = cobertura(false)
    const con = cobertura(true)
    const pct = (x: { entendidas: number; total: number }): string =>
      `${String(x.entendidas)}/${String(x.total)} = ${String(Math.round((x.entendidas * 100) / x.total))}%`

    console.log('\n── COBERTURA DEL CORPUS ──')
    console.log(`  sin proveedor .... ${pct(sin)}`)
    console.log(`  con proveedor .... ${pct(con)}   (${String(con.porModelo)} cláusulas las leyó el modelo)`)
    console.log('')

    // La afirmación del punto 3. Sin ella, el criterio entero se cumple con el
    // proveedor desconectado y nadie se entera.
    expect(con.entendidas).toBeGreaterThan(sin.entendidas)
    expect(con.porModelo).toBeGreaterThan(0)
    // Y el control de que la corrida SIN no está tocada: el mismo total.
    expect(con.total).toBe(sin.total)
  })

  it('y lo que el modelo leyó queda MARCADO, para que el léxico no se oxide', () => {
    // La tentación que el ADR II-0024 anota: con el modelo disponible, la salida
    // barata para cada frase que no se entiende es mandarla al modelo en vez de
    // arreglar el léxico. Si esta columna crece, el léxico se está oxidando.
    const l = leer('andá al río', OPC)
    const c = consultaDe(l, lexico, FIRMAS)
    expect(c).toBeDefined()
    const r = proveedor(c!.texto, c!.llave, c!.clausulas)
    const revisada = revisar(l, r!, lexico, { ofrecidas: c!.firmas, sabeElCatalogo: OPC.sabeElCatalogo })
    expect(revisada.clausulas[0]?.leidaPor).toBe('modelo')
    expect(revisada.clausulas[0]?.firma).toBe('holding(tag:carnoso)')
    console.log(`  «andá al río» → ${String(revisada.clausulas[0]?.porque)}`)
  })
})

describe('la consulta se DESCRIBE, no se llama', () => {
  it('`leer` no sabe que existe un modelo', () => {
    // El mecanismo del punto 2, dicho por el lado del tipo: `leer` no recibe
    // ningún proveedor, así que no puede esperar a ninguno ni por accidente.
    const l = leer('andá al río', OPC)
    expect(l.acuse.length).toBeGreaterThan(0)
    expect(l instanceof Promise).toBe(false)
  })

  it('y la consulta lleva el vocabulario de ESTE mundo', () => {
    const c = consultaDe(leer('andá al río', OPC), lexico, FIRMAS)
    expect(c?.vocabulario.length).toBe(lexico.entradas.size)
    expect(c?.firmas).toEqual(FIRMAS)
    // La llave lleva el léxico adentro: si el mundo cambia de vocabulario, la
    // respuesta vieja deja de aplicar sola.
    const otroLexico = lexicoDe(
      buildSeedPhysics({
        substances: [
          ...phys.substances.values(),
          {
            id: 'vidrio-de-rio',
            lexeme: { nombre: 'vidrio de río', genero: 'm', sinonimos: [] },
            tags: ['mineral'],
            perUnitMass: {},
            specificHeat: 0.8,
            provenance: { by: 'oraculo' },
          },
        ],
      }),
      PUENTE,
    )
    expect(llaveDe('andá al río', otroLexico)).not.toBe(c?.llave)
  })

  it('no se consulta lo que ya se entendió, ni lo que no tiene camino', () => {
    // `entendida` no se consulta: ya hay algo que hacer, y preguntar costaría
    // plata para confirmar lo que se sabe.
    expect(consultaDe(leer('hacé fuego', OPC), lexico, FIRMAS)).toBeUndefined()
    // `sin-camino` TAMPOCO, y es la decisión menos obvia: ahí el problema no es
    // la lectura sino el mundo. Preguntarle al modelo cómo se dice no arregla
    // que ningún esquema lo establezca — eso es del Hito 8.
    const palo = leer('traé un palo', OPC)
    expect(palo.clausulas[0]?.grado).toBe('sin-camino')
    expect(consultaDe(palo, lexico, FIRMAS)).toBeUndefined()
  })
})

describe('EL INVARIANTE: `revisar` nunca empeora', () => {
  const base = leer('andá al río', OPC)
  const llave = llaveDe('andá al río', lexico)

  it('una llave vencida se rechaza entera', () => {
    const r: RespuestaDelModelo = {
      llave: 'de-otro-texto',
      clausulas: [{ indice: 0, firma: 'emitsPower>0' }],
    }
    // El MISMO objeto, no una copia igual: quien llame puede comparar por
    // identidad para saber si hubo cambio.
    expect(revisar(base, r, lexico)).toBe(base)
  })

  it('una firma que el planificador no sabe leer se descarta', () => {
    const r: RespuestaDelModelo = {
      llave,
      clausulas: [{ indice: 0, firma: 'magnetismo>=1' }],
    }
    expect(revisar(base, r, lexico)).toBe(base)
  })

  it('un índice que no existe, o que ni es entero, no rompe nada', () => {
    for (const indice of [99, -1, 1.5, Number.NaN]) {
      const r: RespuestaDelModelo = { llave, clausulas: [{ indice, firma: 'emitsPower>0' }] }
      expect(revisar(base, r, lexico), `índice ${String(indice)}`).toBe(base)
    }
  })

  it('y NO puede pisar una cláusula que el lector local sí entendió', () => {
    // El caso que más importa: el modelo insiste sobre algo que ya se entendió
    // bien, con una firma legítima. Se ignora. Si la lectura local llegó a una
    // meta, esa meta la produjo el léxico de ESTE mundo y vale más que una
    // propuesta de afuera.
    const fuego = leer('hacé fuego', OPC)
    expect(fuego.clausulas[0]?.firma).toBe('emitsPower>0')
    const r: RespuestaDelModelo = {
      llave: llaveDe('hacé fuego', lexico),
      clausulas: [{ indice: 0, firma: 'catch>0' }],
    }
    const despues = revisar(fuego, r, lexico)
    expect(despues).toBe(fuego)
    expect(despues.clausulas[0]?.firma).toBe('emitsPower>0')
  })

  it('el barrido: NINGUNA frase del corpus empeora con basura del modelo', () => {
    // ─── LA QUINTA CLASE, Y ES LA QUE SE COLABA ──────────────────────────────
    //
    // Las cuatro primeras mueren todas en `interpretar`, así que este barrido
    // daba «0 empeoradas» sin haber tocado nunca el agujero de verdad. Un
    // adversario lo midió: **62 cláusulas del corpus entraban como `entendida`
    // con una firma inalcanzable**.
    //
    // Lo que se colaba es una firma **legible y fuera de lugar** —`toxicity>=1`
    // es sintaxis perfecta y no se ofreció nunca— que es exactamente la forma
    // que tiene una alucinación de modelo. La basura evidente no prueba nada
    // contra un modelo: un modelo no escribe `no-es-una-firma`, escribe algo
    // que parece.
    const basura: readonly string[] = [
      '',
      'no-es-una-firma',
      'magnetismo>=1',
      'holding(tag:inventado)',
      // LEGIBLE, y jamás ofrecida.
      'toxicity>=1',
      // Legible, ofrecida... para otra cosa. El modelo puede confundirse ADENTRO
      // de la lista, y contra eso no hay portón: es el riesgo que «el modelo
      // propone» acepta. Lo que sí tiene que pasar es que no suba de grado.
      'holding(tag:mineral)',
    ]
    let pisadas = 0
    const detalle: string[] = []
    for (const f of CORPUS) {
      const antes = leer(f.texto, OPC)
      const k = llaveDe(f.texto, lexico)
      const c = consultaDe(antes, lexico, FIRMAS)
      for (const firma of basura) {
        const r: RespuestaDelModelo = {
          llave: k,
          clausulas: antes.clausulas.map((_x, i) => ({ indice: i, firma })),
        }
        const despues = revisar(antes, r, lexico, {
          ofrecidas: c?.firmas ?? FIRMAS,
          sabeElCatalogo: OPC.sabeElCatalogo,
        })
        for (const [i, cl] of despues.clausulas.entries()) {
          const a = antes.clausulas[i]
          if (a === undefined) continue
          // «Empeorar» es prometer más de lo que había: pasar a `entendida` con
          // una firma que el catálogo no establece. Cambiar de firma sin subir
          // de grado no es empeorar.
          if (cl.grado === 'entendida' && !OPC.sabeElCatalogo(cl.firma ?? '')) {
            pisadas++
            if (detalle.length < 5) detalle.push(`«${f.texto}» ← ${firma}`)
          }
        }
      }
    }
    expect(pisadas, `${String(pisadas)} coladas: ${detalle.join(' · ')}`).toBe(0)
    console.log(
      `  ${String(CORPUS.length)} frases × ${String(basura.length)} clases de basura · 0 coladas`,
    )
  })

  it('y el CONTROL POSITIVO: sin los portones nuevos, se cuelan', () => {
    // Sin esto, el bloque de arriba es un cero que sale de no tener qué medir —
    // que es el modo de falla número 20 de `como-se-trabaja.md`. Se corre el
    // MISMO barrido sin pasarle las opciones, o sea con los cuatro portones
    // viejos, y tiene que colarse de verdad.
    let coladas = 0
    for (const f of CORPUS) {
      const antes = leer(f.texto, OPC)
      const r: RespuestaDelModelo = {
        llave: llaveDe(f.texto, lexico),
        clausulas: antes.clausulas.map((_x, i) => ({ indice: i, firma: 'toxicity>=1' })),
      }
      // Sin `ofrecidas` ni `sabeElCatalogo`: el estado anterior a la reparación.
      const despues = revisar(antes, r, lexico)
      for (const cl of despues.clausulas) {
        if (cl.leidaPor === 'modelo' && !OPC.sabeElCatalogo(cl.firma ?? '')) coladas++
      }
    }
    console.log(`  sin los portones nuevos se colarían ${String(coladas)} cláusulas`)
    expect(coladas, 'el barrido de arriba no estaría midiendo nada').toBeGreaterThan(20)
  })
})
