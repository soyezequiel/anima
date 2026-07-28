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
  unir,
  FRICCION,
  SEED_PROCESSES,
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
  PUENTES,
  SCHEMA_INDEX,
  TECHO_DE_LO_DESHILACHABLE,
  TECHO_DE_YESCA,
  esquemasPara,
} from '../src/esquemas.js'
import type { ConstructionSchema, PredicateSignature } from '../src/tipos.js'

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
      if (grupo === undefined || !grupo.includes(e)) huerfanos.push(`${e.via} → ${e.establishes}`)
    }
    expect(huerfanos).toEqual([])
  })

  it('y el mapa no agrega nada: aplanado da exactamente la lista, en orden', () => {
    const aplanado: ConstructionSchema[] = []
    for (const grupo of SCHEMA_INDEX.values()) aplanado.push(...grupo)
    expect(aplanado.length).toBe(ESQUEMAS.length)
    // Por firma y via, que es lo legible cuando se rompe.
    expect([...aplanado].map((e) => `${e.via}:${e.establishes}`).sort()).toEqual(
      [...ESQUEMAS].map((e) => `${e.via}:${e.establishes}`).sort(),
    )
  })

  it('`esquemasPara` contesta lo mismo que el mapa, y vacío sin alocar', () => {
    for (const e of ESQUEMAS) expect(esquemasPara(e.establishes)).toBe(SCHEMA_INDEX.get(e.establishes))
    expect(esquemasPara('no-existe-esta-firma')).toEqual([])
    // La misma lista vacía las dos veces: la regresión llama a esto una vez por
    // nodo expandido, y el caso sin esquema es el caso interesante (el `gap`).
    expect(esquemasPara('otra-que-tampoco')).toBe(esquemasPara('no-existe-esta-firma'))
  })

  it('no hay dos filas con el mismo par (firma, proceso)', () => {
    const vistos = new Set<string>()
    const repetidos: string[] = []
    for (const e of ESQUEMAS) {
      const k = `${e.via}:${e.establishes}`
      if (vistos.has(k)) repetidos.push(k)
      vistos.add(k)
    }
    expect(repetidos).toEqual([])
  })

  it('el orden de la lista es estable y no depende de cómo se armó ningún `Map`', () => {
    // Agrupada por proceso, en el orden de `SEED_PROCESSES`. De este orden
    // depende qué esquema prueba primero la regresión cuando dos empatan.
    const orden = SEED_PROCESSES.map((p) => p.id)
    const indices = ESQUEMAS.map((e) => orden.indexOf(e.via))
    expect(indices).toEqual([...indices].sort((x, y) => x - y))
    expect(indices.includes(-1)).toBe(false)
  })
})

// ─── (b) TODO NOMBRE QUE EL ESQUEMA USA EXISTE EN EL CATÁLOGO ───────────────

describe('(b) los esquemas hablan del catálogo y no de un mundo inventado', () => {
  it('cada `via` es un `ProcessId` de `SEED_PROCESSES`', () => {
    const ids = new Set(SEED_PROCESSES.map((p) => p.id))
    const desconocidos = ESQUEMAS.filter((e) => !ids.has(e.via)).map((e) => e.via)
    expect(desconocidos).toEqual([])
  })

  it('cada nombre de rol de `roleHints` es un rol de ESE proceso, sin el `?`', () => {
    const mal: string[] = []
    for (const e of ESQUEMAS) {
      const roles = new Set(procesoDe(e.via).roles.map((r) => baseRoleName(r.name)))
      for (const nombre of Object.keys(e.roleHints)) {
        if (!roles.has(nombre)) mal.push(`${e.via} → ${e.establishes}: rol «${nombre}» no existe`)
      }
    }
    expect(mal).toEqual([])
  })

  it('cada cualidad de cada `roleHint` está en el catálogo cerrado', () => {
    const mal: string[] = []
    for (const e of ESQUEMAS) {
      for (const [rol, where] of Object.entries(e.roleHints)) {
        for (const t of where) {
          try {
            specOf(t.q)
          } catch {
            mal.push(`${e.via} → ${e.establishes}: ${rol}.${String(t.q)} no es una cualidad`)
          }
          if (!Number.isFinite(t.v)) mal.push(`${e.via} → ${e.establishes}: ${rol}.${String(t.q)} pide ${String(t.v)}`)
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
    for (const e of ESQUEMAS) {
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
    const mal = ESQUEMAS.filter((e) => e.segundos !== esperado.get(e.via)).map(
      (e) => `${e.via} → ${e.establishes}: ${String(e.segundos)} y el catálogo dice ${String(esperado.get(e.via))}`,
    )
    expect(mal).toEqual([])
    // Y el número de `friccion`, escrito: 385 grados a 120 por segundo.
    expect(esperado.get('friccion')).toBeCloseTo(3.2083, 4)
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
      const hay = ESQUEMAS.some((e) => e.via === via && e.establishes === firma)
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
    const marcados = new Set(PUENTES.map((p) => `${p.via}:${p.establishes}`))
    const contrabando = ESQUEMAS.filter((e) => !esDeclarado(e))
      .filter((e) => !marcados.has(`${e.via}:${e.establishes}`))
      .map((e) => `${e.via} → ${e.establishes}: no sale de ningún \`establishes\` y no está en PUENTES`)
    expect(contrabando).toEqual([])
  })

  it('y nadie infla la lista: todo lo marcado como puente ES un puente', () => {
    // El error simétrico del de arriba, y es el que hace que una tabla parezca
    // más verificada de lo que está: marcar como «conocimiento humano medido»
    // algo que el catálogo ya decía solo.
    const mal: string[] = []
    for (const p of PUENTES) {
      const e = ESQUEMAS.find((x) => x.via === p.via && x.establishes === p.establishes)
      if (e === undefined) {
        mal.push(`${p.via} → ${p.establishes}: marcado como puente y no hay esquema`)
        continue
      }
      if (esDeclarado(e)) mal.push(`${p.via} → ${p.establishes}: lo declara el propio proceso, no es puente`)
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

  it('son dos, y las dos nombran el hallazgo que las hizo falta', () => {
    expect(PUENTES.map((p) => p.establishes)).toEqual(['catch>0', 'heatCapacity<=0.9'])
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
    const conB = ESQUEMAS.filter((e) => e.via === 'union').filter((e) =>
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
    expect(techo).toBeCloseTo(0.909091, 6)
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
    const e = ESQUEMAS.find((x) => x.via === 'deshilachar' && x.establishes === 'flexibility>=0.8')
    expect(e?.roleHints['source']).toEqual([{ q: 'flexibility', op: '>=', v: 0.8 }])
  })
})

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
