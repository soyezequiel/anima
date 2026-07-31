// ─── LOS ESQUEMAS, Y SI SON FÍSICA O SON UN RECETARIO ────────────────────────
//
// `ConstructionSchema` es conocimiento humano sobre las leyes, no una
// consecuencia de ellas: `establishes` es un array de strings que escribe quien
// propone el proceso, y un índice derivado de ahí estaría VACÍO justo donde
// importa —`extraccion` pide `catch > 0` y ningún proceso declara `catch`—. La
// contracara de escribirlo a mano es que hay que poder distinguir una tabla
// verificada de una lista de recetas, y eso es lo que mide este archivo.
//
// ─── LOS CINCO CRITERIOS, ESCRITOS ANTES DE IMPLEMENTAR ─────────────────────
//
//   (a) el índice está DERIVADO de la lista, no escrito dos veces;
//   (b) todo `via` y todo nombre de rol existe en el catálogo;
//   (c) TODO `establishes` declarado por los cuatro procesos tiene su esquema —y
//       si falta alguno, el test dice CUÁL, no lista los que sí están;
//   (d) el inverso, que es el que atrapa la mentira: todo esquema que NO sale de
//       un `establishes` está marcado como puente, con su evidencia, y todo lo
//       que se marca como puente lo es de verdad;
//   (e) los dos números de calibración que este módulo aporta se cruzan contra
//       el catálogo y contra el mundo, así que se ponen rojos si alguno se mueve.
//
// La verificación PESADA de cada fila contra una partida real es de otra fase.
// Lo que sí está acá es la comprobación liviana de los dos puentes —una llamada
// a `unir` y dos a `qualityOf`—, porque un puente sin ni una medición al lado es
// exactamente el paso de más que este archivo vino a impedir.

import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  baseRoleName,
  buildSeedPhysics,
  qualityOf,
  specOf,
  temperaturaDeEquilibrio,
  unir,
  DIGESTIBILIDAD_TECHO,
  EXPOSICION,
  FRICCION,
  SEED_PROCESSES,
  SUSTANCIAS_SEMILLA,
  T_AMBIENTE,
  type Body,
  type Physics,
  type Process,
  type QualityId,
  type QualityTest,
} from '@anima/physics'
import { FRACCION_DE_HEBRA } from '@anima/world'

import {
  ESQUEMAS,
  FIRMA_DE_LO_COCIDO,
  GEOMETRIAS_DE_LA_COCCION,
  IGNICION_QUE_ALCANZA_FROTANDO,
  POTENCIA_QUE_COCINA_LO_CARNOSO,
  PUENTES,
  SCHEMA_INDEX,
  SEGUNDOS_DE_COCCION,
  TECHO_DE_LO_DESHILACHABLE,
  TECHO_DE_YESCA,
  VENTANA_CARNOSA,
  YESCAS_DE_COCINA,
  YESCAS_IMPOSIBLES,
  claveDeVia,
  esquemasPara,
} from '../src/esquemas.js'
import { interpretar } from '../src/predicado.js'
import type { ConstructionSchema, EsquemaDeLey, EsquemaDeProceso, PredicateSignature } from '../src/tipos.js'

/**
 * LAS FILAS QUE VAN POR UN PROCESO, que son sobre las que hablan casi todos los
 * criterios de este archivo: los cinco se escribieron cuando `ConstructionSchema`
 * era una sola cosa, y cuatro de ellos —el `via` del catálogo, los roles del
 * proceso, las seis promesas declaradas, el `segundos` de `completion`— son
 * preguntas que sólo tienen sentido sobre un proceso.
 *
 * Las de ley se miden aparte y con sus propios criterios, abajo. No se saltean: el
 * `describe` del final las barre entero y cruza que la partición no pierda ninguna.
 */
const DE_PROCESO: readonly EsquemaDeProceso[] = ESQUEMAS.filter(
  (e): e is EsquemaDeProceso => e.k === 'proceso',
)
const DE_LEY: readonly EsquemaDeLey[] = ESQUEMAS.filter((e): e is EsquemaDeLey => e.k === 'ley')

const PHYS: Physics = buildSeedPhysics()

/** La raíz de `ii/`, para poder abrir los archivos que la evidencia cita. */
const RAIZ = new URL('../../../', import.meta.url)

/**
 * Las firmas que los cuatro procesos DECLARAN, normalizadas como las normaliza
 * `promesasCanonicas` de `physics/src/admit.ts`: se parte por `&` y se le sacan
 * los espacios.
 *
 * Está escrito acá y no llamando a `firmaDe` porque `firmaDe` todavía tira —lo
 * está escribiendo otra fase—. Cuando exista, esta función se borra y en su
 * lugar va el `it.todo` del final, que es el que cruza las dos.
 */
function firmasDeclaradas(p: Process): readonly PredicateSignature[] {
  const out: PredicateSignature[] = []
  for (const bruto of p.establishes) {
    for (const trozo of bruto.split('&')) {
      const s = trozo.replace(/\s+/g, '')
      if (s.length > 0) out.push(s)
    }
  }
  return out
}

/** Todas las firmas declaradas de la semilla, con quién las declara. */
function declaradasDeLaSemilla(): readonly { readonly via: string; readonly firma: PredicateSignature }[] {
  const out: { via: string; firma: PredicateSignature }[] = []
  for (const p of SEED_PROCESSES) for (const firma of firmasDeclaradas(p)) out.push({ via: p.id, firma })
  return out
}

/** ¿Este esquema sale de un `establishes` del proceso que dice usar? */
function esDeclarado(e: ConstructionSchema): boolean {
  // Una fila de ley NUNCA es declarada, y no por accidente: las leyes no proponen
  // nada, corren solas, así que no tienen `establishes` que declarar. Es lo que la
  // vuelve puente por construcción y lo que el criterio (d) verifica.
  if (e.k !== 'proceso') return false
  const p = SEED_PROCESSES.find((x) => x.id === e.via)
  return p !== undefined && firmasDeclaradas(p).includes(e.establishes)
}

function procesoDe(via: string): Process {
  const p = SEED_PROCESSES.find((x) => x.id === via)
  if (p === undefined) throw new Error(`el test pidió un proceso que no está: ${via}`)
  return p
}

// ─── (a) EL ÍNDICE ESTÁ DERIVADO, NO ESCRITO DOS VECES ──────────────────────

describe('(a) `SCHEMA_INDEX` sale de `ESQUEMAS` y de ningún otro lado', () => {
  it('no hay ni una firma en el mapa que no esté en la lista', () => {
    const enLaLista = new Set(ESQUEMAS.map((e) => e.establishes))
    const colados = [...SCHEMA_INDEX.keys()].filter((f) => !enLaLista.has(f))
    expect(colados).toEqual([])
  })

  it('ni un esquema de la lista que el mapa no tenga, y son EL MISMO objeto', () => {
    // La identidad importa: si el mapa tuviera copias, alguien podría «arreglar»
    // una fila en la lista y el índice seguiría sirviendo la vieja.
    const huerfanos: string[] = []
    for (const e of ESQUEMAS) {
      const grupo = SCHEMA_INDEX.get(e.establishes)
      if (grupo === undefined || !grupo.includes(e)) huerfanos.push(`${claveDeVia(e)} → ${e.establishes}`)
    }
    expect(huerfanos).toEqual([])
  })

  it('y el mapa no agrega nada: aplanado da exactamente la lista, en orden', () => {
    const aplanado: ConstructionSchema[] = []
    for (const grupo of SCHEMA_INDEX.values()) aplanado.push(...grupo)
    expect(aplanado.length).toBe(ESQUEMAS.length)
    // Por firma y vía, que es lo legible cuando se rompe.
    expect([...aplanado].map((e) => `${claveDeVia(e)}:${e.establishes}`).sort()).toEqual(
      [...ESQUEMAS].map((e) => `${claveDeVia(e)}:${e.establishes}`).sort(),
    )
  })

  it('`esquemasPara` contesta lo mismo que el mapa, y vacío sin alocar', () => {
    for (const e of ESQUEMAS) expect(esquemasPara(e.establishes)).toBe(SCHEMA_INDEX.get(e.establishes))
    expect(esquemasPara('no-existe-esta-firma')).toEqual([])
    // La misma lista vacía las dos veces: la regresión llama a esto una vez por
    // nodo expandido, y el caso sin esquema es el caso interesante (el `gap`).
    expect(esquemasPara('otra-que-tampoco')).toBe(esquemasPara('no-existe-esta-firma'))
  })

  it('no hay dos filas con el mismo par (firma, vía)', () => {
    const vistos = new Set<string>()
    const repetidos: string[] = []
    for (const e of ESQUEMAS) {
      const k = `${claveDeVia(e)}:${e.establishes}`
      if (vistos.has(k)) repetidos.push(k)
      vistos.add(k)
    }
    expect(repetidos).toEqual([])
  })

  it('el orden de la lista es estable y no depende de cómo se armó ningún `Map`', () => {
    // Agrupada por proceso, en el orden de `SEED_PROCESSES`. De este orden
    // depende qué esquema prueba primero la regresión cuando dos empatan.
    const orden = SEED_PROCESSES.map((p) => p.id)
    const indices = DE_PROCESO.map((e) => orden.indexOf(e.via))
    expect(indices).toEqual([...indices].sort((x, y) => x - y))
    expect(indices.includes(-1)).toBe(false)
    // Y las de ley van DESPUÉS de todas las de proceso, que es un orden y no una
    // preferencia: `regresar` prueba las vías en el orden de la tabla, y lo que un
    // proceso pueda establecer sale más barato que armar una situación y esperar.
    const primeraLey = ESQUEMAS.findIndex((e) => e.k === 'ley')
    const ultimoProceso = ESQUEMAS.map((e) => e.k).lastIndexOf('proceso')
    if (primeraLey >= 0) expect(primeraLey).toBeGreaterThan(ultimoProceso)
  })
})

// ─── (b) TODO NOMBRE QUE EL ESQUEMA USA EXISTE EN EL CATÁLOGO ───────────────

describe('(b) los esquemas hablan del catálogo y no de un mundo inventado', () => {
  it('cada `via` es un `ProcessId` de `SEED_PROCESSES`', () => {
    const ids = new Set(SEED_PROCESSES.map((p) => p.id))
    const desconocidos = DE_PROCESO.filter((e) => !ids.has(e.via)).map((e) => e.via)
    expect(desconocidos).toEqual([])
  })

  it('cada nombre de rol de `roleHints` es un rol de ESE proceso, sin el `?`', () => {
    const mal: string[] = []
    for (const e of DE_PROCESO) {
      const roles = new Set(procesoDe(e.via).roles.map((r) => baseRoleName(r.name)))
      for (const nombre of Object.keys(e.roleHints)) {
        if (!roles.has(nombre)) mal.push(`${e.via} → ${e.establishes}: rol «${nombre}» no existe`)
      }
    }
    expect(mal).toEqual([])
    // Una ley no tiene roles en ningún catálogo: los nombra ella. Lo que sí se
    // puede exigir es la simétrica, que es la que ataja un `roleHint` decorativo:
    // que todo rol con condiciones esté en la pila o sea el sujeto, o sea que haya
    // algún cuerpo que las tenga que cumplir.
    const sueltos: string[] = []
    for (const e of DE_LEY) {
      for (const nombre of Object.keys(e.roleHints)) {
        if (e.pila.includes(nombre) || e.sujeto === nombre) continue
        sueltos.push(`ley ${e.ley} → ${e.establishes}: el rol «${nombre}» no está en la pila ni es el sujeto`)
      }
    }
    expect(sueltos).toEqual([])
  })

  it('cada cualidad de cada `roleHint` está en el catálogo cerrado', () => {
    const mal: string[] = []
    for (const e of ESQUEMAS) {
      for (const [rol, where] of Object.entries(e.roleHints)) {
        for (const t of where) {
          try {
            specOf(t.q)
          } catch {
            mal.push(`${claveDeVia(e)} → ${e.establishes}: ${rol}.${String(t.q)} no es una cualidad`)
          }
          if (!Number.isFinite(t.v)) {
            mal.push(`${claveDeVia(e)} → ${e.establishes}: ${rol}.${String(t.q)} pide ${String(t.v)}`)
          }
        }
      }
    }
    expect(mal).toEqual([])
  })

  it('ningún `roleHint` contradice lo que el proceso ya le pide al mismo rol', () => {
    // Un esquema que pidiera `flexibility <= 0.5` sobre un rol que el proceso
    // exige `>= 0.8` typechequea perfecto y no lo puede llenar nadie nunca: la
    // regresión buscaría para siempre algo que no existe.
    const imposibles: string[] = []
    for (const e of DE_PROCESO) {
      for (const r of procesoDe(e.via).roles) {
        const hint = e.roleHints[baseRoleName(r.name)]
        if (hint === undefined) continue
        for (const a of r.where) {
          for (const b of hint) {
            if (a.q !== b.q) continue
            if (!compatibles(a, b)) {
              imposibles.push(`${e.via} → ${e.establishes}: ${r.name} pide ${texto(a)} y el esquema ${texto(b)}`)
            }
          }
        }
      }
    }
    expect(imposibles).toEqual([])
  })

  it('`segundos` sale del catálogo y no de una estimación', () => {
    // Los tres que TERMINAN traen su duración en `completion.at`, en segundos de
    // mundo (ADR II-0008). `friccion` no termina: empuja, y lo que tarda es lo
    // que tarda el `drive` en cruzar lo que promete desde el ambiente.
    const esperado = new Map<string, number>()
    for (const p of SEED_PROCESSES) {
      const at = p.completion?.at
      if (at !== undefined) esperado.set(p.id, at)
    }
    expect([...esperado.entries()].sort()).toEqual([
      ['deshilachar', 2],
      ['extraccion', 1.5],
      ['union', 1],
    ])
    const empuje = FRICCION.effects.find((x) => x.k === 'drive')
    if (empuje === undefined || empuje.k !== 'drive') throw new Error('`friccion` perdió su `drive`')
    esperado.set(FRICCION.id, (empuje.toward - T_AMBIENTE) / empuje.porSegundo)
    const mal = DE_PROCESO.filter((e) => e.segundos !== esperado.get(e.via)).map(
      (e) => `${e.via} → ${e.establishes}: ${String(e.segundos)} y el catálogo dice ${String(esperado.get(e.via))}`,
    )
    expect(mal).toEqual([])
    // Y el número de `friccion`, escrito: 385 grados a 120 por segundo.
    expect(esperado.get('friccion')).toBeCloseTo(3.2083, 4)
  })

  it('y el de una LEY sale de su `mientras`, que es el único costo que tiene', () => {
    // Una ley no está en el catálogo de procesos, así que no hay `completion.at`
    // del que leer una duración: lo que cuesta es el tiempo que hay que dejar la
    // situación armada. Que los dos números sean el MISMO campo y no dos es lo que
    // impide que alguien cotice barato y espere caro — la cola de `plan()` se
    // ordena por `segundos` y quien espera es `mientras`.
    const mal = DE_LEY.filter((e) => e.segundos !== e.mientras).map(
      (e) => `ley ${e.ley} → ${e.establishes}: segundos ${String(e.segundos)} y mientras ${String(e.mientras)}`,
    )
    expect(mal).toEqual([])
    for (const e of DE_LEY) expect(e.mientras).toBeGreaterThan(0)
  })
})

function texto(t: QualityTest): string {
  return `${String(t.q)}${t.op}${String(t.v)}`
}

/** ¿Los dos tests sobre la misma cualidad se pueden cumplir a la vez? */
function compatibles(a: QualityTest, b: QualityTest): boolean {
  const piso = (t: QualityTest): number => (t.op === '>=' ? t.v : t.op === '>' ? t.v : -Infinity)
  const techo = (t: QualityTest): number => (t.op === '<=' ? t.v : t.op === '<' ? t.v : Infinity)
  const lo = Math.max(piso(a), piso(b))
  const hi = Math.min(techo(a), techo(b))
  return lo < hi || (lo === hi && a.op !== '>' && a.op !== '<' && b.op !== '>' && b.op !== '<')
}

// ─── (c) TODO `establishes` DECLARADO TIENE SU ESQUEMA ──────────────────────

describe('(c) los cuatro procesos, recorridos: ninguna promesa se queda sin esquema', () => {
  it('EL CRITERIO: y si falta alguna, acá dice cuál', () => {
    // Lo que este test ataja es la forma más cómoda de mentir con una tabla
    // escrita a mano: cubrir las filas fáciles, dejar afuera la incómoda, y que
    // la suite quede verde porque solo se afirmó sobre las que sí están.
    const sinEsquema: string[] = []
    for (const { via, firma } of declaradasDeLaSemilla()) {
      const hay = DE_PROCESO.some((e) => e.via === via && e.establishes === firma)
      if (!hay) sinEsquema.push(`${via} declara «${firma}» y ningún esquema lo establece`)
    }
    expect(sinEsquema).toEqual([])
  })

  it('y son seis, contadas del catálogo: si mañana hay siete, este test avisa', () => {
    // La cuenta va acá para que AGREGAR un `establishes` a un proceso —o un
    // proceso entero— no pase inadvertido: el de arriba lo detecta, y éste dice
    // que el número cambió aunque alguien haya agregado la fila.
    expect(declaradasDeLaSemilla().length).toBe(6)
    expect(ESQUEMAS.filter(esDeclarado).length).toBe(6)
  })
})

// ─── (d) Y EL INVERSO, QUE ES EL QUE ATRAPA LA MENTIRA ──────────────────────

describe('(d) todo lo que no sale del catálogo está marcado como puente, con evidencia', () => {
  it('ningún esquema entra de contrabando: lo que no es declarado está en `PUENTES`', () => {
    const marcados = new Set(PUENTES.map((p) => `${p.por}:${p.establishes}`))
    const contrabando = ESQUEMAS.filter((e) => !esDeclarado(e))
      .filter((e) => !marcados.has(`${claveDeVia(e)}:${e.establishes}`))
      .map((e) => `${claveDeVia(e)} → ${e.establishes}: no sale de ningún \`establishes\` y no está en PUENTES`)
    expect(contrabando).toEqual([])
  })

  it('y nadie infla la lista: todo lo marcado como puente ES un puente', () => {
    // El error simétrico del de arriba, y es el que hace que una tabla parezca
    // más verificada de lo que está: marcar como «conocimiento humano medido»
    // algo que el catálogo ya decía solo.
    const mal: string[] = []
    for (const p of PUENTES) {
      const e = ESQUEMAS.find((x) => claveDeVia(x) === p.por && x.establishes === p.establishes)
      if (e === undefined) {
        mal.push(`${p.por} → ${p.establishes}: marcado como puente y no hay esquema`)
        continue
      }
      if (esDeclarado(e)) mal.push(`${p.por} → ${p.establishes}: lo declara el propio proceso, no es puente`)
    }
    expect(mal).toEqual([])
  })

  it('cada puente dice POR QUÉ y DÓNDE está medido, y los archivos existen', () => {
    // Una evidencia que apunta a un archivo que no existe es peor que ninguna:
    // parece verificación y no lo es. Se abren todos.
    const rotas: string[] = []
    for (const p of PUENTES) {
      if (p.porque.trim().length < 80) rotas.push(`${p.establishes}: el «por qué» no dice nada`)
      if (p.medidoEn.length === 0) rotas.push(`${p.establishes}: no cita dónde está medido`)
      for (const ruta of p.medidoEn) {
        if (!existsSync(new URL(ruta, RAIZ))) rotas.push(`${p.establishes}: no existe ${ruta}`)
      }
    }
    expect(rotas).toEqual([])
  })

  it('son ocho, y cada una nombra el hallazgo que la hizo falta', () => {
    // El orden es el de la tabla, agrupado por vía, así que agregar una fila la
    // corre acá y hay que venir a mirar. Las siete, y qué dice cada una que el
    // catálogo no dice:
    //
    //   catch>0            atar sin el rol `b` deja una punta suelta; `union` no lo declara
    //   emitsPower>0       cruzar el `ignitionPoint` hace fuente de calor; `friccion` no lo declara
    //   emitsPower ACOTADO frotar puede hacer un fuego DE UN TAMAÑO, y el tamaño sale
    //                      de acotar los dos factores del producto que es `emitsPower`
    //   heatCapacity<=0.9  deshilachar fabrica cosas LIVIANAS; `deshilachar` no lo declara
    //   holding(...cocido) ×3 — NINGUNA ley declara nada: no proponen, corren. Y son
    //                      tres porque son tres geometrías, no tres promesas.
    // Las dos puntas de la ventana son DOS filas y no una conjuntiva: ver
    // `firmaDelPiso` en `esquemas.ts`, que explica que una llave conjuntiva apaga el
    // portón de `sinVocabulario` en `@anima/mind`.
    const laVentana = DE_PROCESO.filter(
      (e) => e.via === 'friccion' && e.establishes.startsWith('emitsPower') && e.establishes !== 'emitsPower>0',
    )
    expect(laVentana.length, 'no están las dos filas del fuego acotado').toBe(2)
    for (const e of laVentana) expect(e.establishes).not.toContain('&')
    expect(PUENTES.map((p) => p.establishes)).toEqual([
      'catch>0',
      'emitsPower>0',
      ...laVentana.map((e) => e.establishes),
      'heatCapacity<=0.9',
      ...DE_LEY.map(() => FIRMA_DE_LO_COCIDO),
    ])
    // Los puentes que no van por un proceso son los de la ley, uno por geometría: si
    // mañana apareciera otro, entra acá y hay que verificarlo contra el mundo igual.
    expect(PUENTES.filter((p) => p.por.startsWith('ley:')).length).toBe(DE_LEY.length)
    // DOS y no tres: el montaje `piso` se barre y se descarta, porque es la AUSENCIA
    // de apoyo y una pila es una lista de apoyos. Ver `GEOMETRIAS_DESCARTADAS`.
    expect(DE_LEY.length).toBe(2)
  })
})

// ─── (e) LOS DOS PUENTES, COMPROBADOS CONTRA EL MUNDO ───────────────────────
//
// Es la comprobación LIVIANA —una llamada a `unir` y unas cuantas a `qualityOf`,
// medidas en milisegundos—. La pesada, sobre una partida corriendo, es de otra
// fase. Está acá igual porque un puente cuya única prueba es un comentario que
// dice «medido» no es un puente: es una receta.

function cuerpo(id: string, substance: string, mass: number, form: 'vara' | 'hebra'): Body {
  return { id, form, parts: [{ substance, mass, q: {} }], joints: [], state: {} }
}

const q = (b: Body, cual: QualityId): number => qualityOf(b, cual, PHYS)

describe('(e) el puente de `catch>0`: la caña, y el rol opcional que la mata', () => {
  const vara = cuerpo('vara', 'madera', 1, 'vara')
  const otraVara = cuerpo('vara2', 'madera', 1, 'vara')
  const hebra = cuerpo('h', 'liana', 0.2, 'hebra')

  it('ningún proceso de la semilla declara `catch`, y `extraccion` lo exige', () => {
    // EL HALLAZGO QUE ORDENA EL MÓDULO ENTERO. Si esto dejara de ser cierto —si
    // alguien pusiera `catch>0` en el `establishes` de `union`— el puente
    // sobraría, y el test (d) de arriba se pondría rojo pidiendo que se borre.
    const declaran = SEED_PROCESSES.filter((p) => firmasDeclaradas(p).some((f) => f.startsWith('catch')))
    expect(declaran.map((p) => p.id)).toEqual([])
    const gear = procesoDe('extraccion').roles.find((r) => r.name === 'gear')
    expect(gear?.where.map(texto)).toEqual(['reach>=2', 'catch>0'])
  })

  it('ni la vara ni la hebra, solas, llenan el rol `gear`', () => {
    // La vara llega lejos y no engancha nada; la hebra engancha y no llega. Es
    // la aritmética de la que sale la caña, y está escrita igual en
    // `oracle/src/resolubilidad.ts` (`FORMAS_SEMBRABLES`).
    expect(q(vara, 'reach')).toBeCloseTo(4, 10)
    expect(q(vara, 'catch')).toBe(0)
    expect(q(hebra, 'reach')).toBeCloseTo(1.2, 10)
    expect(q(hebra, 'reach')).toBeLessThan(2)
    expect(q(hebra, 'catch')).toBeCloseTo(0.3, 10)
  })

  it('atadas SIN el rol opcional `b`, sí: catch 0,15 y reach 4,8', () => {
    const cana = unir(vara, undefined, hebra, PHYS, 'cana')
    if (cana === undefined) throw new Error('no se pudo atar la caña')
    expect(q(cana, 'catch')).toBeGreaterThan(0)
    expect(q(cana, 'catch')).toBeCloseTo(0.15, 10)
    expect(q(cana, 'reach')).toBeCloseTo(4.8, 10)
  })

  it('y CON `b` el atador se gasta en la atadura: catch CERO', () => {
    // Es la razón por la que los esquemas de `union` omiten la clave `b` de sus
    // `roleHints`. Si alguien la agregara «para completar», la pesca se
    // terminaría — y no habría ningún error, solo una caña que no engancha.
    const tensa = unir(vara, otraVara, hebra, PHYS, 'tensa')
    if (tensa === undefined) throw new Error('no se pudo atar')
    expect(q(tensa, 'catch')).toBe(0)
    expect(q(tensa, 'reach')).toBeCloseTo(8, 10)
    const conB = DE_PROCESO.filter((e) => e.via === 'union').filter((e) =>
      Object.prototype.hasOwnProperty.call(e.roleHints, 'b'),
    )
    expect(conB.map((e) => e.establishes)).toEqual([])
  })
})

describe('(e) el puente de la yesca: `deshilachar` fabrica cosas livianas', () => {
  it('el techo se despeja del catálogo, y 0,9 entra abajo de él', () => {
    // `stamina` topa donde dice el catálogo, la eficiencia sale del `poweredBy`
    // de `friccion`, y el salto es del ambiente hasta lo que el proceso promete.
    // Ninguno de los tres números está escrito acá.
    const empuje = FRICCION.effects.find((x) => x.k === 'drive')
    if (empuje === undefined || empuje.k !== 'drive' || empuje.poweredBy === undefined) {
      throw new Error('`friccion` perdió su `drive` con `poweredBy`')
    }
    const tanque = specOf(empuje.poweredBy.q).range[1]
    const promete = 400
    const techo = (tanque * empuje.poweredBy.efficiency) / (promete - T_AMBIENTE)
    // Era 0,909091 con la eficiencia de `friccion` en 0,35 y es 2,207792 con 0,85
    // (tramo N): el techo de lo que un tanque lleno puede llevar hasta los 400 °C
    // subió de 909 gramos a 2,2 kg. Lo que el bloque afirma no es el número sino la
    // relación de abajo —que `TECHO_DE_YESCA` entre debajo del techo—, y esa se
    // sostiene con más aire que antes.
    expect(techo).toBeCloseTo(2.207792, 6)
    expect(TECHO_DE_YESCA).toBeLessThanOrEqual(techo)
  })

  it('y el leño de 1 kg no entra, y la hebra que sale de él sí', () => {
    const leno = cuerpo('leno', 'madera', 1, 'vara')
    const yesca = cuerpo('yesca', 'madera', FRACCION_DE_HEBRA, 'hebra')
    expect(q(leno, 'heatCapacity')).toBeCloseTo(1.7, 10)
    expect(q(leno, 'heatCapacity')).toBeGreaterThan(TECHO_DE_YESCA)
    expect(q(yesca, 'heatCapacity')).toBeCloseTo(0.17, 10)
    expect(q(yesca, 'heatCapacity')).toBeLessThanOrEqual(TECHO_DE_YESCA)
    // Y conserva lo que `friccion` le pide al rol `a`: la rigidez es intensiva y
    // sobrevive al grano. Sin esto la yesca no se podría frotar.
    const rigidez = procesoDe('friccion').roles.find((r) => r.name === 'a')?.where[0]
    if (rigidez === undefined) throw new Error('`friccion` perdió lo que le pide al rol `a`')
    expect(q(yesca, rigidez.q)).toBeGreaterThanOrEqual(rigidez.v)
  })

  it('el techo de lo deshilachable es el de la yesca dividido por lo que se lleva la hebra', () => {
    // `FRACCION_DE_HEBRA` vive en `@anima/world` y este paquete no lo importa en
    // `src/`. Que la relación se verifique CONTRA la constante real —y no contra
    // una copia— es lo que hace que mover el 0,1 del mundo ponga rojo esto.
    expect(FRACCION_DE_HEBRA).toBe(0.1)
    expect(TECHO_DE_LO_DESHILACHABLE * FRACCION_DE_HEBRA).toBeCloseTo(TECHO_DE_YESCA, 12)
  })

  it('`deshilachar` NO fabrica flexibilidad, y por eso su esquema se la pide al `source`', () => {
    // El `establishes` más engañoso de la semilla: `flexibility` es INTENSIVA,
    // así que la hebra sale con la flexibilidad de la sustancia de la que salió.
    // La madera (0,2) no se vuelve atadora por partirla; la liana (0,9) ya lo era.
    const deMadera = cuerpo('hm', 'madera', 0.1, 'hebra')
    const deLiana = cuerpo('hl', 'liana', 0.02, 'hebra')
    expect(q(deMadera, 'flexibility')).toBeCloseTo(0.2, 10)
    expect(q(deLiana, 'flexibility')).toBeCloseTo(0.9, 10)
    const e = DE_PROCESO.find((x) => x.via === 'deshilachar' && x.establishes === 'flexibility>=0.8')
    expect(e?.roleHints['source']).toEqual([{ q: 'flexibility', op: '>=', v: 0.8 }])
  })
})

// ─── (e) LOS DOS PUENTES NUEVOS: EL FUEGO Y LA COCCIÓN ──────────────────────
//
// Mismo criterio que los dos de arriba: cada número de la fila se cruza contra el
// catálogo del que salió, así que se pone rojo si alguien recalibra. Lo pesado
// —armar la pila en una partida y esperar— vive en
// `tests/los-esquemas-contra-el-mundo.test.ts`.

describe('(e) el puente de `emitsPower>0`: encender no es una acción', () => {
  it('los 400 del `roleHint` son los del `drive` de `friccion` y no un número escrito', () => {
    const empuje = FRICCION.effects.find((x) => x.k === 'drive')
    if (empuje === undefined || empuje.k !== 'drive') throw new Error('`friccion` perdió su `drive`')
    expect(IGNICION_QUE_ALCANZA_FROTANDO).toBe(empuje.toward)
    // Y la madera entra: se prende a 300, que es abajo de lo que frotar promete.
    const leno = cuerpo('l', 'madera', 0.2, 'vara')
    expect(q(leno, 'ignitionPoint')).toBeLessThanOrEqual(IGNICION_QUE_ALCANZA_FROTANDO)
  })

  it('una vara fría no emite y la misma vara pasada su ignición sí: el `step` del ADR II-0001', () => {
    const fria: Body = { ...cuerpo('f', 'madera', 0.2, 'vara'), state: { temperature: T_AMBIENTE } }
    const ardiendo: Body = { ...cuerpo('a', 'madera', 0.2, 'vara'), state: { temperature: 400 } }
    expect(q(fria, 'emitsPower')).toBe(0)
    expect(q(ardiendo, 'emitsPower')).toBeGreaterThan(0)
  })
})

describe('(e) el puente de la cocción: la parrilla sale de la resta', () => {
  it('la ventana de lo carnoso son los dos bordes del catálogo, y no dos números elegidos', () => {
    // El piso es el `denaturesAt` MÁS ALTO y el techo el `ignitionPoint` MÁS BAJO
    // de las sustancias orgánicas con tag `carnoso`. Se recalcula acá desde
    // `SUSTANCIAS_SEMILLA` en vez de transcribirse: si mañana el oráculo agrega una
    // carne que se prende antes, la ventana se angosta sola y esto lo dice.
    let piso = Number.NEGATIVE_INFINITY
    let techo = Number.POSITIVE_INFINITY
    const filas: string[] = []
    for (const s of SUSTANCIAS_SEMILLA) {
      if (!s.tags.includes('carnoso') || !s.tags.includes('organico')) continue
      const d = s.perUnitMass.denaturesAt
      const ig = s.perUnitMass.ignitionPoint
      if (d === undefined || ig === undefined) continue
      filas.push(`${s.id}: cocina desde ${String(d)} °C y se prende a ${String(ig)} °C`)
      if (d > piso) piso = d
      if (ig < techo) techo = ig
    }
    expect(VENTANA_CARNOSA.piso).toBe(piso)
    expect(VENTANA_CARNOSA.techo).toBe(techo)
    expect(VENTANA_CARNOSA.cuantas).toBe(filas.length)
    // No vacía, y con margen: si los dos bordes se cruzaran no habría cocción para
    // el tag entero y la fila sería una promesa imposible.
    expect(piso).toBeLessThan(techo)
    console.log(
      `\n── LA VENTANA DE LO CARNOSO ${'─'.repeat(40)}\n` +
        filas.map((f) => `  ${f}`).join('\n') +
        `\n  ventana del TAG: [${piso.toFixed(0)} ; ${techo.toFixed(0)}) °C\n`,
    )
  })

  it('LA MISMA FOGATA COCINA, QUEMA O NO HACE NADA SEGÚN DÓNDE SE APOYE', () => {
    // ─── EL RESULTADO QUE REORDENA EL PROBLEMA ─────────────────────────────
    //
    // La fogata que el Hito 0 calibró tiene `emitsPower` 300. Con las tres
    // exposiciones del motor y el acoplamiento con el ambiente, esa misma fogata
    // deja la comida en tres temperaturas muy distintas según cómo se apoye, y sólo
    // una de las tres está adentro de la ventana de arriba.
    //
    // Acá esto se leía como «la parrilla es LA geometría». Leído al revés —que es
    // como hay que leerlo, porque el fuego lo trae la suerte y el lugar lo pone la
    // mano— dice otra cosa: **la parrilla es la geometría DE ESA fogata**, y cada
    // fuego tiene la suya. Por eso hay una fila por montaje y no una sola.
    const FOGATA = 300
    const t = (m: 'piso' | 'parrilla' | 'contacto'): number => temperaturaDeEquilibrio(FOGATA, 0, m)
    const adentro = (x: number): boolean => x >= VENTANA_CARNOSA.piso && x < VENTANA_CARNOSA.techo
    expect(adentro(t('piso'))).toBe(false)
    expect(adentro(t('parrilla'))).toBe(true)
    expect(adentro(t('contacto'))).toBe(false)
    // Y falla por el motivo que se afirma y no por otro: por abajo el `piso` y por
    // arriba el `contacto`. Sin esto, los dos podrían estar fuera por la misma punta.
    expect(t('piso')).toBeLessThan(VENTANA_CARNOSA.piso)
    expect(t('contacto')).toBeGreaterThanOrEqual(VENTANA_CARNOSA.techo)
    // Y la fogata de 300 cae, de las tres ventanas de la tabla, EXACTAMENTE en una:
    // la de la parrilla. Eso es lo mismo dicho del lado de las filas.
    const sirven = GEOMETRIAS_DE_LA_COCCION.filter((g) => FOGATA >= g.minima && FOGATA < g.maxima)
    expect(sirven.map((g) => g.montaje)).toEqual(['parrilla'])
    console.log(
      `\n── LOS TRES MONTAJES SOBRE UNA FOGATA DE ${String(FOGATA)} ${'─'.repeat(24)}\n` +
        (['piso', 'parrilla', 'contacto'] as const)
          .map(
            (m) =>
              `  ${m.padEnd(9)} exposición ${String(EXPOSICION[m]).padStart(5)} → ` +
              `${t(m).toFixed(2).padStart(7)} °C  ${adentro(t(m)) ? '← COCINA' : ''}`,
          )
          .join('\n') +
        `\n  la ventana es [${VENTANA_CARNOSA.piso.toFixed(0)} ; ${VENTANA_CARNOSA.techo.toFixed(0)}) °C\n`,
    )
  })

  it('cada geometría tiene SU ventana, cada fila la escribe con sus dos bordes, y son dos', () => {
    // El piso de cada ventana NO es el borde de abajo de la ventana de cocción, y
    // ésa es la decisión: ahí la ley empuja a tasa cero (`k = (T − denaturesAt)/100`),
    // así que el `mientras` sería infinito. Es el punto medio, que es el único punto
    // de adentro que los dos bordes determinan.
    const medio = (VENTANA_CARNOSA.piso + VENTANA_CARNOSA.techo) / 2
    expect(GEOMETRIAS_DE_LA_COCCION.length).toBe(2)
    expect(GEOMETRIAS_DE_LA_COCCION.map((g) => g.montaje)).toEqual(['parrilla', 'contacto'])
    const filas: string[] = []
    for (const g of GEOMETRIAS_DE_LA_COCCION) {
      expect(g.minima).toBeLessThan(g.maxima)
      // Las dos puntas las contesta el MOTOR, no una copia de la fórmula.
      expect(temperaturaDeEquilibrio(g.minima, g.distancia, g.montaje)).toBeCloseTo(medio, 9)
      expect(temperaturaDeEquilibrio(g.maxima, g.distancia, g.montaje)).toBeCloseTo(VENTANA_CARNOSA.techo, 9)
      // Y el `roleHint` del rol `fuego` de SU fila es exactamente esos dos bordes.
      const fila = DE_LEY.find((e) => e.pila.join('>') === g.pila.join('>') && e.distancia === g.distancia)
      expect(fila, `no está la fila de «${g.montaje}»`).toBeDefined()
      expect(fila?.roleHints['fuego']).toEqual([
        { q: 'emitsPower', op: '>=', v: g.minima },
        { q: 'emitsPower', op: '<', v: g.maxima },
      ])
      filas.push(
        `  ${g.montaje.padEnd(9)} d=${String(g.distancia)}  [${g.minima.toFixed(4)} ; ${g.maxima.toFixed(4)})  ` +
          `${(g.maxima / g.minima).toFixed(2)}× de ancho  pila [${g.pila.join(' > ')}]`,
      )
    }
    // El ancho relativo es el MISMO para las tres, y no es casualidad: la ley 1 es
    // afín en la potencia, así que cambiar de montaje o de distancia escala la
    // ventana entera sin deformarla. De ahí que un fuego que sirve para un montaje
    // no sirva para otro por un factor, y no por poquito.
    const anchos = GEOMETRIAS_DE_LA_COCCION.map((g) => g.maxima / g.minima)
    for (const a of anchos) expect(a).toBeCloseTo(anchos[0] ?? 0, 9)
    console.log(`\n── LAS TRES VENTANAS DE POTENCIA ${'─'.repeat(35)}\n${filas.join('\n')}\n`)
  })

  it('y `POTENCIA_QUE_COCINA_LO_CARNOSO` sigue siendo la de la PARRILLA, que es lo que otros paquetes leen', () => {
    // El nombre viejo se conserva porque `@anima/mind` lo lee. Lo que cambió es que
    // ya no es LA ventana: es una de tres, y se cruza contra la fila que le
    // corresponde para que no se despegue en silencio.
    const parrilla = GEOMETRIAS_DE_LA_COCCION.find((g) => g.montaje === 'parrilla')
    expect(POTENCIA_QUE_COCINA_LO_CARNOSO.minima).toBe(parrilla?.minima)
    expect(POTENCIA_QUE_COCINA_LO_CARNOSO.maxima).toBe(parrilla?.maxima)
  })

  it('LA CRIATURA PUEDE ENCENDER, Y DE LAS TRES VENTANAS SÓLO LLEGA A UNA — medido', () => {
    // ─── EL DATO QUE ORDENA EL TRAMO, Y NO SE ESCONDE ──────────────────────
    //
    // Los puentes de `friccion` se tocan con los de la cocción: uno dice hasta dónde
    // se puede encender frotando (`heatCapacity <= 0,9`, el techo de la yesca) y los
    // otros qué potencia hace falta en cada lugar. La cuenta cierra sola:
    //
    //   la madera más pesada que se prende frotando (0,5294 kg) emite 159,14
    //   parrilla pide desde  253,00  → NO
    //   contacto pide desde  105,42  → SÍ
    //
    // Mientras la tabla tuvo una sola fila —la de la parrilla— eso se leía como «la
    // criatura sabe encender y no sabe cocinar», y era falso: sabía encender el
    // fuego de cocinar EN CONTACTO y nadie le había escrito la geometría.
    const sh = q(cuerpo('m', 'madera', 1, 'vara'), 'heatCapacity')
    const masaMaxima = TECHO_DE_YESCA / sh
    const laMasGrande: Body = {
      ...cuerpo('g', 'madera', masaMaxima, 'vara'),
      state: { temperature: IGNICION_QUE_ALCANZA_FROTANDO },
    }
    const potencia = q(laMasGrande, 'emitsPower')
    expect(q(laMasGrande, 'heatCapacity')).toBeCloseTo(TECHO_DE_YESCA, 9)
    const alcanza = GEOMETRIAS_DE_LA_COCCION.filter((g) => potencia >= g.minima && potencia < g.maxima)
    expect(alcanza.map((g) => g.montaje)).toEqual(['contacto'])
    // Y la tabla lo dice sola: hay UNA yesca de cocina y una imposible, y la
    // imposible no lo es por potencia sino por ALIENTO.
    expect(YESCAS_DE_COCINA.length).toBe(1)
    expect(YESCAS_IMPOSIBLES.length).toBe(1)
    for (const y of YESCAS_IMPOSIBLES) expect(y.porque).toContain('no entra en el tanque')
    console.log(
      `\n── LO MÁS GRANDE QUE SE PRENDE FROTANDO ${'─'.repeat(28)}\n` +
        `  madera de ${masaMaxima.toFixed(4)} kg (heatCapacity ${TECHO_DE_YESCA.toFixed(2)}, el techo de la yesca)\n` +
        `  ardiendo emite ${potencia.toFixed(4)}, y de las tres ventanas:\n` +
        GEOMETRIAS_DE_LA_COCCION.map(
          (g) =>
            `    ${g.montaje.padEnd(9)} [${g.minima.toFixed(2)} ; ${g.maxima.toFixed(2)})  ` +
            `${potencia >= g.minima && potencia < g.maxima ? '← ALCANZA' : `falta ${(g.minima / potencia).toFixed(2)}×`}`,
        ).join('\n') +
        '\n',
    )
  })

  it('la parrilla tiene que aguantar el CONTACTO, y sólo se la pide la fila que la usa', () => {
    // La parrilla no está en `parrilla`: está tocando el fuego. Le toca 0,6 y el
    // equilibrio más alto de los tres, y de ahí sale su única condición.
    const conParrilla = DE_LEY.filter((e) => e.pila.includes('parrilla'))
    expect(conParrilla.length).toBe(1)
    const coccion = conParrilla[0]
    const pide = coccion?.roleHints['parrilla']?.[0]
    if (coccion === undefined || pide === undefined) throw new Error('la fila de la parrilla no le pide nada')
    // El umbral sale de la ventana DE ESA FILA y no de una constante del módulo.
    const suMaxima = coccion.roleHints['fuego']?.find((t) => t.op === '<')?.v ?? Number.NaN
    const peor = temperaturaDeEquilibrio(suMaxima, 0, 'contacto')
    expect(pide).toEqual({ q: 'ignitionPoint', op: '>', v: peor })
    // La piedra entra y la madera no, que es lo que hace que una parrilla de madera
    // no sea una parrilla sino más leña.
    expect(q(cuerpo('p', 'piedra', 0.5, 'vara'), 'ignitionPoint')).toBeGreaterThan(peor)
    expect(q(cuerpo('w', 'madera', 0.5, 'vara'), 'ignitionPoint')).toBeLessThan(peor)

    // ─── Y LO QUE ESTA CONDICIÓN NO DICE, QUE ES LA PREGUNTA INCÓMODA ───────
    //
    // El esquema no dice que la parrilla NO SEA COMIDA. Un `roleHints` es una lista
    // de pruebas sobre cualidades y «no es lo que quiero cocinar» no es una
    // cualidad, así que en principio el pescado de al lado calificaría de parrilla y
    // el plan sacrificaría uno para asar el otro.
    //
    // Lo que cierra ese agujero HOY no es la fila: es el catálogo, y por eso se mide
    // en vez de argumentarse. Las seis sustancias carnosas se prenden entre 220 y
    // 300 °C, o sea muy por debajo de los 507 que la parrilla tiene que aguantar, así
    // que ninguna pasa. Queda escrito para que el día que el oráculo invente una
    // carne refractaria no parezca un accidente.
    const carnosasQuePasarian = SUSTANCIAS_SEMILLA.filter(
      (s) => s.tags.includes('carnoso') && (s.perUnitMass.ignitionPoint ?? 0) > peor,
    ).map((s) => s.id)
    expect(carnosasQuePasarian).toEqual([])
    // Y la otra que no dice, dicha: que AGUANTE EL PESO. `footing` es una cualidad
    // que existe (ley 8) y la fila no la mira. Hoy no muerde porque lo que se apoya
    // pesa kilos y no toneladas.
    expect(coccion.roleHints['parrilla']?.some((t) => t.q === 'footing')).toBe(false)
    // Y las otras dos filas NO le piden nada a ninguna parrilla, porque no hay tercer
    // cuerpo: un `roleHint` sobre un rol que la pila no nombra es una condición que
    // nadie cumple, y `armarMarco` la rechaza. Esto lo ataja antes.
    for (const e of DE_LEY) {
      if (e.pila.includes('parrilla')) continue
      expect(e.roleHints['parrilla']).toBeUndefined()
    }
    console.log(`\n  la parrilla aguanta hasta ${peor.toFixed(2)} °C de contacto con el fuego más grande\n`)
  })

  it('lo que la fila promete es AL MENOS lo que `comer` tolera', () => {
    // El 0,2 vive como literal adentro de `skills/src/innatas/comer.ts` y no se
    // puede importar. Lo que se puede hacer —y es lo que hace este test— es cruzar
    // que la promesa no quede más floja que la tolerancia: si alguien afloja
    // `comer`, esto no se entera; si alguien afloja la fila, sí.
    const TOLERANCIA_DE_COMER = 0.2
    const p = interpretarFirma(FIRMA_DE_LO_COCIDO)
    const tox = (p.tests ?? []).find((t) => t.q === 'toxicity')
    const dig = (p.tests ?? []).find((t) => t.q === 'digestibility')
    expect(p.tag).toBe('carnoso')
    expect(tox?.op).toBe('<=')
    expect(tox?.v).toBeLessThanOrEqual(TOLERANCIA_DE_COMER)
    // Y la digestibilidad prometida está abajo del techo REAL de la ley, que es
    // asintótico: prometer el techo sería prometer un `mientras` infinito.
    expect(dig?.v).toBeLessThan(DIGESTIBILIDAD_TECHO)
    expect(SEGUNDOS_DE_COCCION).toBeGreaterThan(0)
  })
})

/** La firma de lo cocido, leída con el intérprete del paquete y no partida a mano. */
function interpretarFirma(f: string): { tag: string; tests?: readonly QualityTest[] } {
  const p = interpretar(f)
  if (p === undefined || p.k !== 'sostiene') throw new Error(`«${f}» dejó de leerse como `.concat('`sostiene`'))
  return p
}

// ─── LO QUE LE TOCA A LA FASE QUE VIENE ─────────────────────────────────────

describe('lo que este archivo NO puede cerrar todavía', () => {
  it.todo(
    'cruzar `firmaDe(crudo) === esquema.establishes` para los seis `establishes` de la semilla: ' +
      'hoy las firmas de `ESQUEMAS` están escritas como literales y este archivo las normaliza ' +
      'con una copia de `promesasCanonicas`, porque `firmaDe` todavía tira. Cuando exista, ' +
      '`firmasDeclaradas` de acá se borra y se reemplaza por ella — y ahí se sabe si las dos ' +
      'normalizaciones coinciden, que es lo único que hace que el índice se pueda buscar por texto',
  )
})
