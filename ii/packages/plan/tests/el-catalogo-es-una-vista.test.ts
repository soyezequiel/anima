// ─── EL CATÁLOGO ES UNA VISTA, NO UNA CONSTANTE DE MÓDULO ───────────────────
//
// Éste es el criterio del **tramo A del Gate 5→6**, escrito antes de implementar
// nada. Cubre cuatro de los doce puntos de `ii/docs/gate-5-6-objetos-emergentes.md`:
//
//   (2) registro en un overlay AISLADO POR SESIÓN
//   (3) PUBLICACIÓN DE CAPACIDADES al planificador
//   (4) AUSENCIA DE MUTACIÓN GLOBAL de `SCHEMA_INDEX`
//   (7) DOS PARTIDAS NO SE CONTAMINAN
//
// Los otros ocho no son de este archivo y no se fingen acá: el 1, el 5, el 6 y
// el 8 piden `BlueprintDefinition`, que todavía no existe; el 9, el 10 y el 11
// piden sellos, journal y descriptor; el 12 se verifica grepeando producción.
//
// ─── QUÉ PROBLEMA RESUELVE, EN UNA FRASE ────────────────────────────────────
//
// Hoy el catálogo de esquemas es `ESQUEMAS`, una constante de `@anima/plan`, y
// todo el que lo consume lo lee de ahí. Eso alcanza mientras el catálogo lo
// escriban humanos y no cambie nunca. El día que la criatura invente un objeto,
// el catálogo pasa a tener una parte que es de ESTA partida, y una tabla global
// mutable convertiría dos partidas en la misma partida.
//
// La forma que el gate eligió es **core inmutable + biblioteca + overlay de la
// sesión** ([ADR II-0018](../../docs/decisions/II-0018-el-catalogo-es-core-mas-overlay-por-sesion.md)),
// publicada al planificador como una `PlannerCatalogView`.
//
// ─── POR QUÉ EL DIGEST ES CANÓNICO Y NO CONSERVA EL ORDEN ───────────────────
//
// Porque el orden de la tabla **no cambia el plan**, y no es una intuición: está
// medido y verde en `ataque-determinismo.test.ts`, bloque «y con la tabla de
// esquemas revuelta, también» (`[...ESQUEMAS].reverse()` da el mismo plan al
// carácter). Dos catálogos que planifican igual tienen que tener la misma
// identidad — si no, un `catalogEpoch` distinto tiraría fronteras que eran
// perfectamente válidas y la criatura re-planificaría de gusto.
//
// ─── POR QUÉ `catalogEpoch` NO ES UN CONTADOR ───────────────────────────────
//
// La alternativa obvia —un entero que sube en cada registro— es más barata y es
// insegura de una manera callada: dos sesiones distintas que registraron una cosa
// cada una están las dos en el epoch 1, con catálogos que no tienen nada que ver.
// El día que un estado guardado cruce de una sesión a la otra, la comparación de
// epochs dice «es el mismo catálogo» y no lo es. Derivado del contenido, ese caso
// no existe, y lo único que se pierde es poder decir cuál de dos es más nuevo,
// que ninguno de los doce puntos pide.

import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import type { QualityId } from '@anima/physics'
import { evalQuality, specOf } from '@anima/physics'
import type { BodyId, BodyView, Cell, CellQuality, Clock, SelfView, Tag, Where } from '@anima/skills'

import {
  CATALOGO_CORE,
  catalogoDe,
  conOverlay,
  esquemasDe,
  type CatalogCapability,
  type PlannerCatalogView,
} from '../src/catalogo.js'
import { ESQUEMAS, SCHEMA_INDEX } from '../src/esquemas.js'
import { plan } from '../src/regresion.js'
import type { GoalNode, PlanResult, Predicado, VistaDelPlan } from '../src/tipos.js'

const SRC = fileURLToPath(new URL('../src/', import.meta.url))

// ─── La escena: la misma orilla que usa el ataque al determinismo ───────────

type Cualidades = Partial<Record<QualityId, number>>

function cuerpo(id: BodyId, x: number, y: number, tags: readonly Tag[] = []): BodyView {
  return { id, at: { x, y }, name: id, tags, madeByMe: false, joints: [] }
}

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

const AGUA: readonly Cell[] = [{ x: 8, y: 0 }]

function criatura(): SelfView {
  return {
    id: 'yo',
    at: { x: 0, y: 0 },
    name: 'criatura',
    tags: [],
    madeByMe: false,
    joints: [],
    holding: [],
    capacity: 3,
    stamina: 1000,
    permits: 'reversible',
  }
}

const RELOJ: Clock = { phase: 'dia', secondsToNightfall: 100, dayLength: 200 }

function vista(cuerpos: readonly BodyView[], qs: ReadonlyMap<BodyId, Cualidades>): VistaDelPlan {
  const self = criatura()
  const qde = (b: BodyView, q: QualityId): number => {
    if (b.id === self.id && q === 'stamina') return self.stamina
    const puesta = qs.get(b.id)?.[q]
    if (puesta !== undefined) return puesta
    return q === 'portable' ? portableDe(qde(b, 'mass')) : 0
  }
  return {
    see: (w: Where): readonly BodyView[] =>
      cuerpos.filter((b) =>
        w.every((t) => {
          const v = qde(b, t.q)
          return t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
        }),
      ),
    recall: () => [],
    q: qde,
    qAt: (at: Cell, q: CellQuality): number =>
      q === 'wet' && AGUA.some((c) => c.x === at.x && c.y === at.y) ? 1 : 0,
    self,
    clock: RELOJ,
  }
}

const CUERPOS_DEL_RIO: readonly BodyView[] = [cuerpo('matorral', 2, 0), cuerpo('vara', 5, 0), cuerpo('pozo', 8, 0)]

const QS_DEL_RIO = new Map<BodyId, Cualidades>([
  ['matorral', { flexibility: 0.9, tensile: 0.72, mass: 3, reach: 1.2, rigidity: 0.1 }],
  ['vara', { reach: 4, rigidity: 0.7, tensile: 0.55, flexibility: 0.2, heatCapacity: 1.7, mass: 1 }],
  ['pozo', { mass: 50 }],
])

const COMER: Predicado = { k: 'sostiene', tag: 'carnoso' }

function meta(goal: Predicado): GoalNode {
  return { id: 'g0', goal, after: [], porque: 'el criterio del gate' }
}

/** Planificar la pesca en la orilla con el catálogo que se le pase. */
function pescarCon(catalogo: PlannerCatalogView): PlanResult {
  return plan(meta(COMER), vista(CUERPOS_DEL_RIO, QS_DEL_RIO), 500, undefined, { catalogo })
}

/**
 * Las capacidades de la pesca, publicadas como overlay.
 *
 * Son LAS MISMAS filas del core, y ésa es la gracia del experimento: si el
 * planificador las consume desde el overlay tiene que salir EL MISMO PLAN al
 * carácter. Una fila inventada para el test mediría el test, no la costura.
 */
const CAPACIDADES_DE_LA_PESCA: readonly CatalogCapability[] = ESQUEMAS.map((e) => ({
  clase: 'construir',
  de: 'la-pesca@1',
  esquema: e,
}))

/** Un catálogo con el core VACÍO: no sabe hacer nada por su cuenta. */
const CATALOGO_PELADO = catalogoDe([])

// ─── (4) Ausencia de mutación global ────────────────────────────────────────

describe('(4) registrar una capacidad no toca el catálogo global', () => {
  it('`ESQUEMAS` y `SCHEMA_INDEX` son los MISMOS objetos después de registrar', () => {
    // Identidad de referencia y no de contenido: `toBe` sobre el array y sobre
    // el mapa. Un `toEqual` pasaría aunque alguien hubiera reemplazado la
    // constante por una copia con una fila de más, que es exactamente la falla
    // que este punto ataja.
    const antesLista = ESQUEMAS
    const antesIndice = SCHEMA_INDEX
    const antesLargo = ESQUEMAS.length
    const antesFirmas = [...SCHEMA_INDEX.keys()]

    conOverlay(CATALOGO_CORE, CAPACIDADES_DE_LA_PESCA)
    conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA)

    expect(ESQUEMAS).toBe(antesLista)
    expect(SCHEMA_INDEX).toBe(antesIndice)
    expect(ESQUEMAS.length).toBe(antesLargo)
    expect([...SCHEMA_INDEX.keys()]).toEqual(antesFirmas)
  })

  it('LA COSTURA NO TIENE UNA SEGUNDA PUERTA: nadie más lee el catálogo global', () => {
    // El guardián de verdad del punto 4, y es de texto porque el daño es de
    // texto: `ReadonlyMap` es una promesa del compilador que se borra al
    // compilar, así que mirar el objeto no prueba nada. Lo que hay que impedir
    // es que aparezca un lector NUEVO — un módulo que lea `ESQUEMAS` derecho es
    // un sitio más que el overlay no alcanza, y no se nota en ningún test de
    // planificación porque el core y el overlay coinciden mientras no haya nada
    // registrado.
    //
    // Tres archivos tienen permiso y cada uno por su motivo:
    //   `esquemas.ts`  los declara;
    //   `catalogo.ts`  deriva el core de ellos, que es su trabajo;
    //   `index.ts`     los re-exporta para los tests y para `@anima/mind`.
    //
    // Éste es el test que se habría puesto rojo cuando `regresion.ts` leía
    // `ESQUEMAS` derecho, que es exactamente lo que este tramo vino a sacar.
    const CON_PERMISO = new Set(['esquemas.ts', 'catalogo.ts', 'index.ts'])
    const intrusos: string[] = []
    for (const archivo of readdirSync(SRC).filter((f) => f.endsWith('.ts'))) {
      if (CON_PERMISO.has(archivo)) continue
      const codigo = readFileSync(SRC + archivo, 'utf8')
        .split('\n')
        .filter((l) => {
          const t = l.trimStart()
          return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*')
        })
        .join('\n')
      const m = codigo.match(/\bSCHEMA_INDEX\b|\bESQUEMAS\b/)
      if (m !== null) intrusos.push(`${archivo}: «${m[0]}» fuera de la vista del catálogo`)
    }
    expect(intrusos).toEqual([])
  })

  it('la vista no comparte el array del core con `ESQUEMAS`', () => {
    // Si `coreSchemas` FUERA `ESQUEMAS`, un `push` en cualquier consumidor
    // envenenaría el módulo. Que sea otro array es la barrera barata.
    expect(CATALOGO_CORE.coreSchemas).not.toBe(ESQUEMAS)
    expect(CATALOGO_CORE.coreSchemas).toEqual(ESQUEMAS)
  })
})

// ─── (2) El overlay es de la sesión ─────────────────────────────────────────

describe('(2) el overlay se registra en una vista nueva y no en la base', () => {
  it('`conOverlay` devuelve otra vista y deja la base intacta', () => {
    const base = CATALOGO_PELADO
    const antes = {
      build: base.buildCapabilities.length,
      skill: base.skillCapabilities.length,
      epoch: base.catalogEpoch,
      digest: base.registryDigest,
    }

    const conUna = conOverlay(base, CAPACIDADES_DE_LA_PESCA)

    expect(conUna).not.toBe(base)
    expect(base.buildCapabilities.length).toBe(antes.build)
    expect(base.skillCapabilities.length).toBe(antes.skill)
    expect(base.catalogEpoch).toBe(antes.epoch)
    expect(base.registryDigest).toBe(antes.digest)
    expect(conUna.buildCapabilities.length).toBe(CAPACIDADES_DE_LA_PESCA.length)
  })

  it('dos overlays sobre la misma base no se ven entre sí', () => {
    const a = conOverlay(CATALOGO_PELADO, [CAPACIDADES_DE_LA_PESCA[0] as CatalogCapability])
    const b = conOverlay(CATALOGO_PELADO, [CAPACIDADES_DE_LA_PESCA[1] as CatalogCapability])

    expect(a.buildCapabilities.length).toBe(1)
    expect(b.buildCapabilities.length).toBe(1)
    expect(a.buildCapabilities[0]?.esquema).not.toBe(b.buildCapabilities[0]?.esquema)
    expect(a.registryDigest).not.toBe(b.registryDigest)
  })

  it('registrar dos veces sobre la misma vista ACUMULA, y sobre la base no', () => {
    const uno = conOverlay(CATALOGO_PELADO, [CAPACIDADES_DE_LA_PESCA[0] as CatalogCapability])
    const dos = conOverlay(uno, [CAPACIDADES_DE_LA_PESCA[1] as CatalogCapability])

    expect(dos.buildCapabilities.length).toBe(2)
    expect(uno.buildCapabilities.length).toBe(1)
    expect(CATALOGO_PELADO.buildCapabilities.length).toBe(0)
  })
})

// ─── (3) Publicación de capacidades ─────────────────────────────────────────

describe('(3) el planificador consume lo que la vista publica', () => {
  it('con el core pelado no sabe pescar, y es un `gap` y no un error', () => {
    const r = pescarCon(CATALOGO_PELADO)
    expect(r.k).toBe('gap')
  })

  it('publicadas las capacidades, sale EL MISMO PLAN que con el core', () => {
    // La prueba de que la costura es real y no una firma que se acepta y se
    // ignora: las filas son las del core, entradas por la otra puerta. Si el
    // plan saliera distinto, el planificador estaría leyendo `ESQUEMAS` por
    // atrás en algún lado.
    const porElCore = pescarCon(CATALOGO_CORE)
    const porElOverlay = pescarCon(conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA))

    expect(porElCore.k).toBe('plan')
    expect(JSON.stringify(porElOverlay)).toBe(JSON.stringify(porElCore))
  })

  it('`esquemasDe` entrega core, construir y usar, y nada más', () => {
    const v = conOverlay(CATALOGO_CORE, CAPACIDADES_DE_LA_PESCA)
    expect(esquemasDe(v).length).toBe(
      v.coreSchemas.length + v.buildCapabilities.length + v.skillCapabilities.length,
    )
  })
})

// ─── (7) Dos partidas no se contaminan ──────────────────────────────────────

describe('(7) dos partidas con overlays distintos planifican distinto', () => {
  it('la que sabe pesca y la que no, no', () => {
    const partidaA = conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA)
    const partidaB = CATALOGO_PELADO

    expect(pescarCon(partidaA).k).toBe('plan')
    expect(pescarCon(partidaB).k).toBe('gap')

    // Y el orden no importa: correr A primero no le enseña nada a B. Es el
    // control que atrapa una caché memoizada por meta, que es la forma más
    // probable de que esto se rompa sin que nadie la escriba a propósito.
    expect(pescarCon(partidaB).k).toBe('gap')
    expect(pescarCon(partidaA).k).toBe('plan')
  })

  it('sus dos identidades son distintas, y las dos son estables', () => {
    const a = conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA)
    const b = CATALOGO_PELADO

    expect(a.registryDigest).not.toBe(b.registryDigest)
    expect(a.catalogEpoch).not.toBe(b.catalogEpoch)

    // Estables: la misma vista preguntada dos veces no cambia de identidad.
    expect(conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA).registryDigest).toBe(a.registryDigest)
  })
})

// ─── La identidad del catálogo ──────────────────────────────────────────────

describe('la identidad del catálogo es su CONTENIDO', () => {
  it('las mismas filas en distinto orden dan el mismo digest y el mismo epoch', () => {
    // El porqué está en el encabezado: barajar la tabla no cambia el plan, y eso
    // ya está medido. Dos catálogos que planifican igual son el mismo catálogo.
    const derecho = catalogoDe(ESQUEMAS)
    const alReves = catalogoDe([...ESQUEMAS].reverse())

    expect(alReves.registryDigest).toBe(derecho.registryDigest)
    expect(alReves.catalogEpoch).toBe(derecho.catalogEpoch)
  })

  it('y el orden en que se REGISTRAN las capacidades tampoco cambia la identidad', () => {
    const dosCap = CAPACIDADES_DE_LA_PESCA.slice(0, 2)
    const unOrden = conOverlay(CATALOGO_PELADO, dosCap)
    const elOtro = conOverlay(CATALOGO_PELADO, [...dosCap].reverse())

    expect(elOtro.registryDigest).toBe(unOrden.registryDigest)
    expect(elOtro.catalogEpoch).toBe(unOrden.catalogEpoch)
  })

  it('una fila de menos cambia el digest', () => {
    const entero = catalogoDe(ESQUEMAS)
    const sinLaPrimera = catalogoDe(ESQUEMAS.slice(1))
    expect(sinLaPrimera.registryDigest).not.toBe(entero.registryDigest)
  })

  it('mover un NÚMERO adentro de una fila cambia el digest', () => {
    // El control que hace valioso al anterior: si el digest sólo mirara los
    // `establishes`, dos catálogos con la misma lista de firmas y distintos
    // precios darían el mismo, y el epoch dejaría pasar fronteras que se armaron
    // con otra economía.
    const original = ESQUEMAS[0] as (typeof ESQUEMAS)[number]
    const tocado = { ...original, segundos: original.segundos + 1 }
    expect(catalogoDe([tocado, ...ESQUEMAS.slice(1)]).registryDigest).not.toBe(
      catalogoDe(ESQUEMAS).registryDigest,
    )
  })

  it('el orden de las CLAVES de un `roleHints` no cambia el digest', () => {
    // La trampa fina: `Record<RoleName, Where>` conserva el orden de inserción y
    // dos filas idénticas construidas en distinto orden serializarían distinto
    // con un `JSON.stringify` pelado. El digest tiene que ser canónico, o el
    // mismo catálogo reconstruido cambia de identidad al reiniciar.
    const con = ESQUEMAS.find((e) => Object.keys(e.roleHints).length >= 2)
    expect(con, 'ninguna fila tiene dos roles: el control no controla nada').toBeDefined()
    if (con === undefined) return

    const alReves = Object.fromEntries(Object.entries(con.roleHints).reverse())
    const gemelo = { ...con, roleHints: alReves } as (typeof ESQUEMAS)[number]

    expect(catalogoDe([gemelo]).registryDigest).toBe(catalogoDe([con]).registryDigest)
  })

  it('`catalogEpoch` es función del digest y no un contador', () => {
    // Escrito como test y no sólo como comentario: dos vistas con el mismo
    // digest tienen que tener el mismo epoch, hayan pasado por los registros que
    // hayan pasado. Un contador daría 0 y 2 acá.
    const directo = conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA.slice(0, 2))
    const enDosPasos = conOverlay(
      conOverlay(CATALOGO_PELADO, CAPACIDADES_DE_LA_PESCA.slice(0, 1)),
      CAPACIDADES_DE_LA_PESCA.slice(1, 2),
    )

    expect(enDosPasos.registryDigest).toBe(directo.registryDigest)
    expect(enDosPasos.catalogEpoch).toBe(directo.catalogEpoch)
  })
})
