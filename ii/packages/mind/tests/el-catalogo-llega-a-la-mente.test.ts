// ─── EL CATÁLOGO LLEGA A LA MENTE ───────────────────────────────────────────
//
// La otra mitad de la costura del **tramo A del Gate 5→6**. La primera vive en
// `plan/tests/el-catalogo-es-una-vista.test.ts` y demuestra que `plan()` consume
// una vista; ésta demuestra que **la mente se la pasa**, que era la mitad que el
// gate anotó como faltante:
//
//   > «la mente NO la usa, y además precalcula» — gate-5-6, §6
//
// Y hay una razón para que este archivo exista aparte de la simetría: **todos los
// tests de `@anima/mind` siguen verdes sin él**. El default de `MenteOptions.catalogo`
// es `CATALOGO_CORE`, o sea exactamente la tabla que la mente leía antes, así que
// la conducta no se mueve un tick y ninguna suite existente puede distinguir una
// costura que funciona de una firma que se acepta y se tira. Lo único que separa
// esas dos cosas es un test que le pase un catálogo DISTINTO y mire si algo cambia.
//
// ─── LOS CUATRO SITIOS QUE SE MIDIERON, Y CUÁL SE DESATÓ ────────────────────
//
// El doc del gate decía que la mente tenía UN precalculado. Son cuatro, en tres
// archivos, y no todos son deuda:
//
//   escalera.ts     `LO_QUE_SE_SABE_ESTABLECER` → `vocabularioDe(c)`   DESATADO
//   escalera.ts     `HAY_ESTABLECIDAS_QUE_NO_SE_LEEN` → función        DESATADO
//   oportunidades.ts `LO_QUE_CUESTA_ESTABLECER` → `preciosDe(c)`       DESATADO
//   creencias.ts    `delEsquema('catch>0',…)` dentro de `RASGOS`       LEE EL CORE
//
// El cuarto se deja leyendo el core A PROPÓSITO y el porqué está escrito arriba
// de `delEsquema`: `CUANTAS_FORMAS` y `SIN_CUERPO` salen de `RASGOS.length`, así
// que rasgos que siguieran al epoch dejarían la memoria de afordancias entera en
// cubetas que ya no nombran nada. Un overlay agrega filas, no las reemplaza, así
// que la del core que se busca ahí no se puede ir.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  CATALOGO_CORE,
  catalogoDe,
  conOverlay,
  interpretar,
  type CatalogCapability,
  type ConstructionSchema,
  type PlannerCatalogView,
} from '@anima/plan'

import { alientoDelEsquema } from '../src/oportunidades.js'
import { sinVocabulario } from '../src/escalera.js'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

// ─── Una capacidad inventada, que el core no tiene ──────────────────────────

/**
 * `sharpness>=0.9` no lo establece ninguna fila del core, y el test lo AFIRMA
 * antes de usarlo en vez de darlo por sentado: el día que alguien agregue una
 * fila de afilar, este archivo tiene que decir por qué dejó de medir, no pasar
 * en verde midiendo otra cosa.
 */
const AFILADO = 'sharpness>=0.9'

function filaQueAfila(segundos: number): ConstructionSchema {
  return {
    k: 'proceso',
    via: 'friccion',
    establishes: AFILADO,
    roleHints: { a: [{ q: 'rigidity', op: '>=', v: 0.5 }] },
    segundos,
  }
}

function capacidad(esquema: ConstructionSchema): CatalogCapability {
  return { clase: 'usar', de: 'la-piedra-de-afilar@1', esquema }
}

const CON_AFILAR: PlannerCatalogView = conOverlay(CATALOGO_CORE, [capacidad(filaQueAfila(4))])

// ─── El vocabulario ─────────────────────────────────────────────────────────

describe('el vocabulario de metas sigue al catálogo y no a la constante de módulo', () => {
  it('la premisa: el core NO sabe afilar', () => {
    expect(sinVocabulario(AFILADO, CATALOGO_CORE)).toBe(true)
  })

  it('con la capacidad registrada, la meta se puede querer', () => {
    // Éste es el test que estaba faltando y el que le da sentido al tramo: sin
    // él, una capacidad que la criatura inventara quedaría vetada en D2/D3 por
    // un vocabulario calculado al arrancar el proceso, ANTES de que existiera.
    expect(sinVocabulario(AFILADO, CON_AFILAR)).toBe(false)
  })

  it('y el default sigue siendo el core: la conducta vieja no se movió', () => {
    expect(sinVocabulario(AFILADO)).toBe(sinVocabulario(AFILADO, CATALOGO_CORE))
  })

  it('EL CONTROL QUE HACE VALIOSO AL ANTERIOR: el portón no se apagó entero', () => {
    // `sinVocabulario` tiene un interruptor conservador: si alguna firma del
    // catálogo NO la sabe leer `interpretar`, la función se APAGA y contesta que
    // todo se puede querer. O sea que un `false` puede significar dos cosas muy
    // distintas — «sí, hay esquema» o «me apagué»— y sin este bloque el test de
    // arriba pasaría igual con una fila inventada que no interpreta, midiendo el
    // interruptor en vez de la costura.
    //
    // Con el portón encendido, una meta MÁS EXIGENTE que lo que la fila promete
    // sigue siendo imposible: un esquema que deja `sharpness>=0.9` no implica
    // `sharpness>=0.99`. Si esto contestara `false`, el catálogo estaría apagado.
    expect(sinVocabulario('sharpness>=0.99', CON_AFILAR)).toBe(true)
  })

  it('un catálogo PELADO no sabe querer nada de lo que el core sí', () => {
    // El control con el signo al revés: si `sinVocabulario` ignorara el
    // argumento, esto seguiría contestando `false` y el bloque de arriba
    // también. Hacen falta los dos para separar «lee el catálogo» de «devuelve
    // lo que ya devolvía».
    expect(sinVocabulario('catch>0', CATALOGO_CORE)).toBe(false)
    expect(sinVocabulario('catch>0', catalogoDe([]))).toBe(true)
  })
})

// ─── El precio ──────────────────────────────────────────────────────────────

describe('el precio de una meta sale del catálogo de ESTA partida', () => {
  it('sin la fila cuesta el piso de una intención; con ella, lo que la fila dice', () => {
    const p = interpretar(AFILADO)
    expect(p, 'la firma inventada tiene que interpretar, o el test no mide nada').toBeDefined()
    if (p === undefined) return

    const sinSaber = alientoDelEsquema(p, CATALOGO_CORE)
    const sabiendo = alientoDelEsquema(p, CON_AFILAR)
    expect(sabiendo).not.toBe(sinSaber)
  })

  it('y una fila MÁS BARATA baja el precio: se toma la mínima, como la regresión', () => {
    const p = interpretar(AFILADO)
    if (p === undefined) return
    const barata = conOverlay(CON_AFILAR, [capacidad(filaQueAfila(1))])
    expect(alientoDelEsquema(p, barata)).toBeLessThan(alientoDelEsquema(p, CON_AFILAR))
  })
})

// ─── La caché por epoch ─────────────────────────────────────────────────────

describe('la caché por epoch no contamina entre catálogos', () => {
  it('dos vistas alternadas contestan bien LAS DOS, cincuenta veces', () => {
    // El control de la única pieza de estado mutable que este tramo agregó. La
    // caché es de una entrada, así que dos catálogos alternando se desalojan
    // mutuamente: si la llave estuviera mal —o si no hubiera llave— la segunda
    // vuelta contestaría con la tabla de la primera y nadie lo notaría hasta
    // tener dos partidas vivas.
    for (let i = 0; i < 50; i++) {
      expect(sinVocabulario(AFILADO, CATALOGO_CORE)).toBe(true)
      expect(sinVocabulario(AFILADO, CON_AFILAR)).toBe(false)
    }
  })

  it('dos vistas con el MISMO contenido comparten entrada, aunque sean objetos distintos', () => {
    // La llave es el `catalogEpoch`, que es del CONTENIDO: dos vistas armadas por
    // caminos distintos con las mismas filas son el mismo catálogo para la
    // caché, y tienen que contestar lo mismo sin recalcular.
    const gemela = conOverlay(CATALOGO_CORE, [capacidad(filaQueAfila(4))])
    expect(gemela).not.toBe(CON_AFILAR)
    expect(gemela.catalogEpoch).toBe(CON_AFILAR.catalogEpoch)
    expect(sinVocabulario(AFILADO, gemela)).toBe(false)
  })
})

// ─── El guardián: que no aparezca un lector nuevo ───────────────────────────

describe('la mente no tiene una segunda puerta al catálogo global', () => {
  it('ningún fuente de `mind/src/` nombra `ESQUEMAS` ni `SCHEMA_INDEX`', () => {
    // El gemelo del guardián de `@anima/plan`, y acá pesa más: la deuda que este
    // tramo pagó fue exactamente ésta —cuatro lectores que nadie había contado— y
    // lo que la hizo crecer es que agregar el quinto no rompía nada.
    //
    // No hay lista de permitidos: en `@anima/mind` NINGÚN archivo tiene por qué
    // nombrarlos. Lo que se lee es `CATALOGO_CORE`, que es una vista.
    const intrusos: string[] = []
    for (const archivo of readdirSync(SRC).filter((f) => f.endsWith('.ts'))) {
      const codigo = readFileSync(SRC + archivo, 'utf8')
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
        })
        .join('\n')
      const m = codigo.match(/\bSCHEMA_INDEX\b|\bESQUEMAS\b/)
      if (m !== null) intrusos.push(`${archivo}: «${m[0]}» — el catálogo se lee por la vista`)
    }
    expect(intrusos).toEqual([])
  })
})
