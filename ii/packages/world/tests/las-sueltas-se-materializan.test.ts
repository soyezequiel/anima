// ─── LO QUE EL DIOS DECRETA, EN EL PISO ──────────────────────────────────────
//
// Hasta el tramo J, `stepWorld` materializaba UNA sola cosa de todo lo que el dios
// decreta: el banco de peces. `grep -rn "sueltas" world/src` devolvía un renglón y
// era un comentario que hablaba de otra cosa. Medido entonces, con una criatura
// sola en la orilla de `20260728n`:
//
//     el dios decretó en los 3×3 chunks de alrededor .......... 90 sueltas
//     el mundo materializó ................................... 0
//     lo único que trajo: pozo:-5:-2, pozo:-5:-3, pozo:-6:-2
//
// De ahí salían, todas juntas: que la orilla no tuviera leña ni junco ni corteza;
// que los dos arneses del Hito 5 plantaran su escena a mano —y que las dos
// conclusiones que hubo que corregir («no puede haber fuego», «el mundo no permite
// las secuencias») fueran conclusiones sobre la escena y no sobre el mundo—; y que
// la criatura no tuviera con qué trabajar.
//
// Este archivo mide la reparación, y mide sobre todo sus cuatro precios:
// determinismo, idempotencia, la celda ocupada y el costo. Los cuatro son formas
// distintas de la misma pregunta —qué pasa cuando el mundo empieza a crecer
// mientras alguien camina— y ninguno se contesta con «anda».

import { describe, expect, it } from 'vitest'
import type { Body, Physics } from '@anima/physics'
import { buildSeedPhysics, HZ_DE_REFERENCIA, qualityOf, T_AMBIENTE } from '@anima/physics'
import type { Cell } from '../src/cell.js'
import { chunkCoord, chunkFromKey, chunkKey } from '../src/cell.js'
import type { EstadoDelDios } from '../src/dios.js'
import { crearDios, decretoDe, idDeSuelta, PREFIJO_SUELTA } from '../src/dios.js'
import { hashWorld } from '../src/hash.js'
import type { Intent, Placement } from '../src/intent.js'
import { goTo, take } from '../src/intent.js'
import { revisarEstado } from '../src/invariants.js'
import { restoreWorld, worldSlots } from '../src/mundo.js'
import type { Actor, WorldBody, WorldState } from '../src/step.js'
import { mapaDeActores, mapaDeCuerpos, stepWorld } from '../src/step.js'
import { huella } from './mundo-minimo.js'

// ─── La escena ───────────────────────────────────────────────────────────────
//
// Una criatura sola, en el origen, con un dios detrás. NADA plantado alrededor:
// todo lo que aparezca en el piso lo puso el mundo, que es justamente lo que se
// mide. La `stamina` es alta para que el metabolismo no la mate en medio de un
// barrido de 20.000 ticks — lo que se mide acá es el mundo, no el hambre.

/** La semilla del banco del Hito 5. La misma con la que se midió el cero. */
const SEMILLA = 20260728n

const HAMBRE_QUE_NO_ESTORBA = 1_000_000

function criatura(id: string, at: Placement, stamina = HAMBRE_QUE_NO_ESTORBA): WorldBody {
  return {
    body: {
      id: `${id}-cuerpo`,
      form: 'bloque',
      parts: [{ substance: 'carne', mass: 2, q: {} }],
      joints: [],
      state: { temperature: T_AMBIENTE, stamina },
    },
    at,
  }
}

function actor(id: string): Actor {
  return { id, body: `${id}-cuerpo`, holding: [], capacity: 6, permits: 'irreversible' }
}

interface Escena {
  readonly state: WorldState
  readonly phys: Physics
  readonly dios: EstadoDelDios
}

/**
 * `buildSeedPhysics()` NUEVA en cada escena, y no es cosmética: `decretoDe`
 * memoiza por `(Physics, "cx:cy")` **sin la semilla**, así que dos dioses
 * distintos que compartan el objeto `Physics` decretan un solo mundo. Es el mismo
 * rodeo que `nuevaFisica()` del juez, y por el mismo agujero.
 */
function escena(o: { desde?: Placement; cuantas?: number; semilla?: bigint } = {}): Escena {
  const phys = buildSeedPhysics()
  const dios = crearDios(o.semilla ?? SEMILLA)
  const desde = o.desde ?? { x: 0, y: 0 }
  const cuerpos: WorldBody[] = []
  const actores: Actor[] = []
  for (let k = 0; k < (o.cuantas ?? 1); k++) {
    // En fila, una celda por criatura: dos cuerpos sólidos no comparten celda y
    // apilarlas sería fabricar una relación espacial que nadie pidió.
    cuerpos.push(criatura(`a${String(k)}`, { x: desde.x + k, y: desde.y }))
    actores.push(actor(`a${String(k)}`))
  }
  return {
    phys,
    dios,
    state: {
      tick: 0,
      hz: HZ_DE_REFERENCIA,
      phys,
      bodies: mapaDeCuerpos(cuerpos),
      actors: mapaDeActores(actores),
      cells: new Map(),
      nextId: 1,
      dios,
    },
  }
}

/** Los nueve chunks alrededor de una celda, en el orden de `NUEVE` del paso. */
function alrededor(at: Placement): readonly (readonly [number, number])[] {
  const cx = chunkCoord(at.x)
  const cy = chunkCoord(at.y)
  const out: (readonly [number, number])[] = []
  for (const dy of [-1, 0, 1]) for (const dx of [-1, 0, 1]) out.push([cx + dx, cy + dy] as const)
  return out
}

/** Cuántas sueltas decretó el dios en los 3×3 chunks alrededor de una celda. */
function decretadasAlrededor(e: Escena, at: Placement): number {
  let n = 0
  for (const [cx, cy] of alrededor(at)) n += decretoDe(e.dios, e.phys, cx, cy).chunk.sueltas.length
  return n
}

function sueltasDe(w: WorldState): readonly string[] {
  return [...w.bodies.keys()].filter((id) => id.startsWith(PREFIJO_SUELTA))
}

/** Un paso sin intenciones, `n` veces. */
function correr(w: WorldState, n: number, guion?: (w: WorldState, t: number) => readonly Intent[]): WorldState {
  let s = w
  for (let t = 0; t < n; t++) s = stepWorld(s, guion === undefined ? [] : guion(s, t)).state
  return s
}

function donde(w: WorldState, quien: string): Placement {
  return (w.bodies.get(`${quien}-cuerpo`) as WorldBody).at
}

/**
 * UN CAMINANTE QUE NO SE CLAVA, y hace falta por un hallazgo de este mismo tramo.
 *
 * Un `goTo` a un punto lejano da UN paso por tick con `unPasoHacia`, y si la celda
 * de destino tiene un sólido sin `footing` el paso se rechaza con `celda-ocupada`
 * — y como el destino no cambia, se rechaza para siempre. **Antes de este tramo
 * eso casi no pasaba, porque el piso estaba vacío.** Medido acá: con el decreto
 * materializado, un `goTo` en línea recta a (40,0) avanzó 18 celdas en 100 ticks y
 * después se clavó, y otro a (40,40) se clavó en la celda 6 y perdió 114 ticks.
 *
 * Es información sobre el mundo y no un defecto del test: el piso ahora tiene
 * cosas y caminar en línea recta ya no alcanza. La mente lo resuelve con `explorar`
 * y con el planificador; acá alcanza con desviar el destino un poco en `y` según
 * el tick, que es lo mínimo para que el paso pruebe tres celdas distintas y rodee
 * un obstáculo suelto. Es función del tick y de la posición, o sea determinista.
 */
const DESVIO = [0, 1, -1] as const

function haciaElEste(quien: string) {
  return (w: WorldState, t: number): readonly Intent[] => {
    const at = donde(w, quien)
    return [goTo({ by: quien, seq: t }, { x: at.x + 64, y: at.y + (DESVIO[t % 3] as number) }, 0)]
  }
}

// ═══ (1) EL DECRETO LLEGA AL PISO ════════════════════════════════════════════

describe('(1) las sueltas del decreto se vuelven cuerpos', () => {
  it('EL CRITERIO DEL TRAMO: lo que el dios decretó en los 9 chunks está en el mundo', () => {
    const e = escena()
    const decretadas = decretadasAlrededor(e, { x: 0, y: 0 })
    const w = correr(e.state, 1)
    const sueltas = sueltasDe(w)
    console.log(
      `\n─── EL DECRETO LLEGA AL PISO ───\n` +
        `  decretadas en los 3×3 chunks ... ${String(decretadas)}\n` +
        `  materializadas ................. ${String(sueltas.length)}\n` +
        `  bancos de peces ................ ${String([...w.bodies.keys()].filter((i) => i.startsWith('pozo:')).length)}\n`,
    )
    // El número exacto no está clavado a propósito: lo decide la semilla, y
    // clavarlo sería volver a medir el arnés. Lo que sí se afirma es que el dios
    // siembra de verdad y que **no se pierde ni una**.
    expect(decretadas).toBeGreaterThan(50)
    expect(sueltas.length).toBe(decretadas)
  })

  it('los ids son del LUGAR, no del contador: `nextId` no se movió', () => {
    // Es la misma decisión que `idDePozo`, y acá pesa diez veces más porque son
    // diez cuerpos por chunk: con `nuevoId`, el nombre de cada rama dependería de
    // cuántas se materializaron antes, o sea del camino de la criatura.
    const e = escena()
    const w = correr(e.state, 1)
    expect(w.nextId).toBe(e.state.nextId)
    const dec = decretoDe(e.dios, e.phys, 0, 0).chunk.sueltas
    expect(dec.length).toBeGreaterThan(0)
    for (let n = 0; n < dec.length; n++) expect(w.bodies.has(idDeSuelta(0, 0, n))).toBe(true)
  })

  it('la sustancia, la masa y la celda salen del decreto y no de acá', () => {
    const e = escena()
    const w = correr(e.state, 1)
    const dec = decretoDe(e.dios, e.phys, 0, 0).chunk.sueltas
    let enSuCelda = 0
    for (let n = 0; n < dec.length; n++) {
      const s = dec[n] as { substance: string; masa: number; i: number }
      const c = w.bodies.get(idDeSuelta(0, 0, n))
      expect(c).toBeDefined()
      const b = c as WorldBody
      expect(b.body.parts[0]?.substance).toBe(s.substance)
      // `masa` es `Fixed` (escala 1000). No se compara contra un número escrito
      // acá: se compara contra el decreto, dividido por la MISMA escala.
      expect(qualityOf(b.body, 'mass', w.phys)).toBeCloseTo(s.masa / 1000, 10)
      const x = 0 * 16 + (s.i % 16)
      const y = 0 * 16 + Math.floor(s.i / 16)
      if (b.at.x === x && b.at.y === y) enSuCelda += 1
    }
    // La inmensa mayoría cae exactamente donde el dios dijo; las que no, son las
    // que chocaron y se corrieron (bloque 4).
    expect(enSuCelda).toBeGreaterThan(dec.length - 5)
  })

  it('nacen a la temperatura del chunk y no a 0 °C', () => {
    // Un cuerpo con `state: {}` vale 0 °C para `qualityOf`. Una rama tirada en un
    // chunk a 15 °C no está a cero, y sin esto la ley 1 la relaja hacia el
    // ambiente durante los primeros ticks: el mundo entregaría piedras heladas que
    // se templan solas mientras la criatura las mira.
    const e = escena()
    const w = correr(e.state, 1)
    const ambiente = decretoDe(e.dios, e.phys, 0, 0).chunk.terreno.temperatura
    const dec = decretoDe(e.dios, e.phys, 0, 0).chunk.sueltas
    const primera = w.bodies.get(idDeSuelta(0, 0, 0)) as WorldBody
    expect(dec.length).toBeGreaterThan(0)
    expect(primera.body.state.temperature).toBe(ambiente)
    expect(ambiente).not.toBe(0)
  })
})

// ═══ (2) IDEMPOTENCIA ════════════════════════════════════════════════════════

describe('(2) un chunk se abre UNA vez', () => {
  it('cien ticks quietos no traen ni un cuerpo más', () => {
    const e = escena()
    const w1 = correr(e.state, 1)
    const w100 = correr(w1, 99)
    expect(sueltasDe(w100).length).toBe(sueltasDe(w1).length)
    expect(w100.dios?.sembrados).toEqual(w1.dios?.sembrados)
  })

  it('IR, VOLVER Y NO ENCONTRAR EL DOBLE', () => {
    const e = escena()
    // Ida al este, y vuelta al oeste por el mismo pasillo.
    const ida = correr(e.state, 300, haciaElEste('a0'))
    const lejos = donde(ida, 'a0')
    const vuelta = correr(ida, 400, (w, t) => {
      const at = donde(w, 'a0')
      return [goTo({ by: 'a0', seq: t }, { x: at.x - 64, y: at.y + (DESVIO[t % 3] as number) }, 0)]
    })
    const ids = sueltasDe(vuelta)
    const abiertos = vuelta.dios?.sembrados ?? []
    console.log(
      `\n─── IR Y VOLVER ───\n` +
        `  llegó a x=${String(lejos.x)} y volvió a x=${String(donde(vuelta, 'a0').x)}\n` +
        `  chunks abiertos ${String(abiertos.length)} · sueltas vivas ${String(ids.length)}\n`,
    )
    // Ningún id repetido, que es lo que una segunda materialización produciría.
    expect(new Set(ids).size).toBe(ids.length)
    // Y el mundo creció al caminar, o esto no prueba nada.
    expect(abiertos.length).toBeGreaterThan(9)
    // La cuenta cerrada: hay exactamente lo que decretaron los chunks abiertos,
    // ni una de más. Nadie tocó nada, así que no hay bajas que descontar.
    let decretadasEnLoAbierto = 0
    for (const k of abiertos) {
      const { cx, cy } = chunkFromKey(k)
      decretadasEnLoAbierto += decretoDe(e.dios, e.phys, cx, cy).chunk.sueltas.length
    }
    expect(ids.length).toBe(decretadasEnLoAbierto)
  })

  it('LO QUE SE LLEVÓ NO REAPARECE, y es lo que `d.bodies.has()` no habría visto', () => {
    // ─── EL CASO QUE DECIDE EL DISEÑO ────────────────────────────────────────
    //
    // La idempotencia barata sería `if (d.bodies.has(id)) continue`. Anda para lo
    // que se levanta —el cuerpo sigue en el mapa, en la mano— y **miente para lo
    // que desaparece**: la criatura frota dos varas, las quema, el cuerpo se va del
    // mundo, y al tick siguiente el chunk lo pariría de nuevo. Leña infinita.
    //
    // Acá se simula la desaparición de la forma más honesta que hay: se saca el
    // cuerpo del estado a mano —que es lo que la ley 4 y `comer` hacen— y se
    // vuelve a correr el mundo.
    const e = escena()
    const w = correr(e.state, 1)
    const victima = sueltasDe(w)[0] as string
    const sinElla = new Map(w.bodies)
    sinElla.delete(victima)
    const quemado: WorldState = { ...w, bodies: sinElla }
    const despues = correr(quemado, 5)
    expect(despues.bodies.has(victima)).toBe(false)
    expect(sueltasDe(despues).length).toBe(sueltasDe(w).length - 1)
  })

  it('y lo que se llevó EN LA MANO tampoco se duplica', () => {
    const e = escena()
    const w0 = correr(e.state, 1)
    // La primera suelta que esté a mano de la criatura.
    const mia = w0.bodies.get('a0-cuerpo') as WorldBody
    const cerca = sueltasDe(w0).find((id) => {
      const c = w0.bodies.get(id) as WorldBody
      return Math.max(Math.abs(c.at.x - mia.at.x), Math.abs(c.at.y - mia.at.y)) <= 1
    })
    if (cerca === undefined) return
    const w = correr(w0, 20, (_s, t) => (t === 0 ? [take({ by: 'a0', seq: t }, cerca)] : []))
    const ids = sueltasDe(w)
    expect(new Set(ids).size).toBe(ids.length)
    expect(w.actors.get('a0')?.holding).toContain(cerca)
  })

  it('GUARDAR Y CARGAR no vuelve a abrir los chunks: los `sembrados` sobreviven a JSON', () => {
    // Es el mismo agujero que el diario del libro calórico existe para tapar del
    // lado de la pesca, y lo encontró el criterio (d) de `hito-5-la-pesca` en el
    // primer viaje por JSON: sin esta línea en `restaurarDios`, cargar la partida
    // le devolvía al mundo todos sus chunks cerrados.
    const e = escena()
    const w = correr(e.state, 3)
    const enDisco = JSON.parse(JSON.stringify([...worldSlots(w)])) as [string, unknown][]
    const vuelto = restoreWorld(new Map(enDisco))
    expect(vuelto.dios?.sembrados).toEqual(w.dios?.sembrados)
    expect(hashWorld(worldSlots(vuelto))).toBe(hashWorld(worldSlots(w)))
    // Y al seguir corriendo no aparece nada nuevo.
    expect(sueltasDe(correr(vuelto, 5)).length).toBe(sueltasDe(w).length)
  })

  it('un mundo SIN dios no gana un solo cuerpo, y su hash no se movió', () => {
    // La guarda de la primera línea: los ocho paquetes están llenos de mundos sin
    // dios, y ninguno tiene que enterarse de este tramo. El campo `sembrados` se
    // OMITE mientras esté vacío justamente para eso.
    const { dios: _sin, ...pelado } = escena().state
    const w: WorldState = pelado
    const r = correr(w, 10)
    expect(r.bodies.size).toBe(w.bodies.size)
    expect(worldSlots(r).has('dios')).toBe(false)
  })
})

// ═══ (3) DETERMINISMO ════════════════════════════════════════════════════════

describe('(3) el determinismo, que es lo que este tramo podía romper', () => {
  it('dos partidas gemelas que caminan igual dan el MISMO hash', () => {
    const a = correr(escena().state, 300, haciaElEste('a0'))
    const b = correr(escena().state, 300, haciaElEste('a0'))
    expect(hashWorld(worldSlots(a))).toBe(hashWorld(worldSlots(b)))
    expect(huella(a)).toBe(huella(b))
  })

  it('DOS ÓRDENES DE EXPLORACIÓN: los mismos chunks abiertos y la misma materia', () => {
    // ─── QUÉ SE AFIRMA ACÁ, Y QUÉ NO ─────────────────────────────────────────
    //
    // El criterio del Hito 3 es sobre el DECRETO: el mismo mundo mirado en dos
    // órdenes decreta lo mismo. Lo que este tramo agrega es que el mundo
    // MATERIALIZA ese decreto, y ahí hay una cosa que sí depende del camino y está
    // declarada en `materializarLoDecretado`: **cuántos chunks se abrieron**. Un
    // mundo donde alguien ya caminó hasta el río no es el mismo que uno donde no.
    //
    // Lo que NO puede depender del camino es lo de adentro de un chunk abierto:
    // qué NOMBRE tiene cada cosa, DE QUÉ está hecha y EN QUÉ CELDA está. Se compara
    // eso y no la masa ni el hash entero, y la razón es fina y hay que decirla: un
    // chunk abierto en el tick 3 tiene DOS TICKS MÁS de leyes encima que el mismo
    // chunk abierto en el tick 5, así que la ley 11 le secó un poco más y la masa
    // difiere. Exigir el hash entero sería exigir que el tiempo no pase.
    //
    // El recorrido se hace TELETRANSPORTANDO a la criatura de un punto a otro, y
    // eso es el arnés eligiendo el orden de exploración —igual que el criterio del
    // Hito 3 decreta los 81 chunks en tres órdenes—. Caminar no serviría: con el
    // piso lleno, un `goTo` se clava (ver `haciaElEste`) y los dos recorridos no
    // llegarían a los mismos lugares.
    const puntos: readonly Placement[] = [
      { x: 0, y: 0 },
      { x: 48, y: 0 },
      { x: 48, y: 48 },
      { x: 0, y: 48 },
    ]
    const recorrer = (orden: readonly Placement[]): WorldState => {
      const e = escena()
      let w = e.state
      for (const p of orden) {
        const cuerpo = w.bodies.get('a0-cuerpo') as WorldBody
        w = { ...w, bodies: mapaDeCuerpos([...w.bodies.values()].map((c) => (c.body.id === 'a0-cuerpo' ? { ...cuerpo, at: p } : c))) }
        w = stepWorld(w, []).state
      }
      return w
    }
    const a = recorrer(puntos)
    const b = recorrer([...puntos].reverse())
    // Los mismos chunks abiertos: los dos recorridos pisan los mismos lugares.
    expect(a.dios?.sembrados).toEqual(b.dios?.sembrados)
    // Y la misma materia adentro: nombre, sustancia y celda.
    const inventario = (w: WorldState): readonly string[] =>
      sueltasDe(w)
        .map((id) => {
          const c = w.bodies.get(id) as WorldBody
          return `${id} ${c.body.parts.map((p) => p.substance).join('+')} @${String(c.at.x)},${String(c.at.y)}`
        })
        .sort()
    expect(inventario(a)).toEqual(inventario(b))
    expect(inventario(a).length).toBeGreaterThan(100)
    console.log(
      `\n─── DOS ÓRDENES, EL MISMO MUNDO ───\n` +
        `  chunks abiertos ${String(a.dios?.sembrados?.length)} · sueltas ${String(inventario(a).length)}\n`,
    )
  })

  it('la clave de un chunk abierto es `chunkKey`, y el arreglo sale ORDENADO', () => {
    const e = escena()
    const w = correr(e.state, 1)
    const esperados = alrededor({ x: 0, y: 0 })
      .map(([cx, cy]) => chunkKey(cx, cy))
      .sort((x, y) => x - y)
    expect(w.dios?.sembrados).toEqual(esperados)
  })

  it('DOS ACTORES: el orden en que llegan las intenciones no cambia el mundo', () => {
    // El recorrido de la materialización es `d.actors.values()` × `NUEVE`, los dos
    // con orden declarado. Lo que se ataca acá es lo otro: que el resultado no
    // dependa de en qué ORDEN vino el arreglo de intenciones, que es el orden en
    // que contestaron las mentes y no puede decidir nada.
    const guion = (w: WorldState, t: number): readonly Intent[] => {
      const p = donde(w, 'a0')
      const q = donde(w, 'a1')
      return [
        goTo({ by: 'a0', seq: t }, { x: p.x + 64, y: p.y + (DESVIO[t % 3] as number) }, 0),
        goTo({ by: 'a1', seq: t }, { x: q.x - 64, y: q.y + (DESVIO[t % 3] as number) }, 0),
      ]
    }
    const wa = correr(escena({ cuantas: 2 }).state, 120, guion)
    const wb = correr(escena({ cuantas: 2 }).state, 120, (w, t) => [...guion(w, t)].reverse())
    expect(hashWorld(worldSlots(wa))).toBe(hashWorld(worldSlots(wb)))
    expect((wa.dios?.sembrados ?? []).length).toBeGreaterThan(9)
  })
})

// ═══ (4) LA CELDA OCUPADA ════════════════════════════════════════════════════

// ─── El título de este bloque decía «el mundo no apila» y medía UNA semilla ──
//
// Sobre veinte no era cierto, y el adversario lo cobró: `pozo:6:0` con
// `suelta:6:0:3` en la 20260740 y `pozo:7:1` con `suelta:7:1:4` en la 20260747.
// El agujero era que el banco de peces entra con `ponerCuerpo` sin preguntarle a
// `estorbo`, y está reparado (`abrirChunk` le reserva su celda al banco). Lo que
// se corrige acá es lo otro que el hallazgo decía: **un testigo de una sola
// semilla no puede sostener un título en plural**, así que ahora barre veinte.
describe('(4) la celda ocupada: `scatter` sortea con reposición y el mundo no apila', () => {
  /** Las mismas veinte del barrido del adversario, para que los dos midan lo mismo. */
  const VEINTE = Array.from({ length: 20 }, (_v, n) => BigInt(20260728 + n))

  it('EL INVARIANTE NO SE ROMPE: ni un `solidos-solapados` en 9 chunks abiertos de golpe', () => {
    const malos = VEINTE.flatMap((semilla) =>
      revisarEstado(correr(escena({ semilla }).state, 3)).filter((v) => v.k === 'solidos-solapados'),
    )
    expect(malos).toEqual([])
  }, 60_000)

  it('y tampoco caminando 300 ticks, que es cuando se abren chunks con alguien adentro', () => {
    const w = correr(escena().state, 300, (_s, t) => [
      goTo({ by: 'a0', seq: t }, { x: (t * 7) % 90, y: (t * 3) % 90 }, 0),
    ])
    expect(revisarEstado(w).filter((v) => v.k === 'solidos-solapados')).toEqual([])
  })

  it('LA QUE CHOCA NO SE PIERDE: entra donde el dios dijo y la piedra se corre', () => {
    // ─── LA DECISIÓN, ATACADA DE FRENTE ──────────────────────────────────────
    //
    // La celda repetida ocurre de tres maneras: `scatter` sortea CON REPOSICIÓN
    // —dos sueltas del mismo chunk en la misma celda—, el decreto puede darle a una
    // suelta la celda del banco de peces, y alguien puede estar parado ahí. Sobre
    // `20260728n` la primera no se da en los 9 chunks del arranque (se cuenta abajo
    // y da 0), así que en vez de esperar a que la semilla haga el favor, se PLANTA
    // el choque: una piedra en la celda exacta donde el decreto dice que va la
    // primera suelta del chunk (0,0).
    //
    // Las cuatro respuestas posibles y por qué se eligió la cuarta están en
    // `abrirChunk`. **Este test decía lo contrario hasta el tramo K bis**: afirmaba
    // que la que se corría era la SUELTA, y eso era el bug — preguntarle al mundo
    // dónde había lugar ataba la celda de una piedra sembrada al camino de la
    // criatura y rompía el criterio publicado del Hito 3 (dos órdenes, dos hashes:
    // `2f63c2f9eabd29b6` contra `a4fc2879124b0d36`). Ahora la celda sale del decreto
    // y el que se corre es el que estaba. Lo que este test afirma es el resultado:
    // la suelta entra DONDE EL DIOS DIJO, la piedra queda pegada, y no hay
    // solapamiento.
    const e = escena()
    const s0 = decretoDe(e.dios, e.phys, 0, 0).chunk.sueltas[0] as { i: number }
    const suCelda: Cell = { x: s0.i % 16, y: Math.floor(s0.i / 16) }
    const piedra: Body = {
      id: 'piedra-plantada',
      form: 'bloque',
      parts: [{ substance: 'piedra', mass: 5, q: {} }],
      joints: [],
      state: { temperature: T_AMBIENTE },
    }
    const conPiedra: WorldState = {
      ...e.state,
      bodies: mapaDeCuerpos([...e.state.bodies.values(), { body: piedra, at: suCelda }]),
    }
    expect(qualityOf(piedra, 'solid', e.phys)).toBeGreaterThan(0)
    const w = correr(conPiedra, 1)
    const nacida = w.bodies.get(idDeSuelta(0, 0, 0)) as WorldBody
    const corrida = w.bodies.get('piedra-plantada') as WorldBody
    // Entró…
    expect(nacida).toBeDefined()
    // …EXACTAMENTE donde el decreto decía, que es la propiedad que hace que dos
    // partidas gemelas exploradas en distinto orden den el mismo hash…
    expect(nacida.at).toEqual(suCelda)
    // …la piedra que estaba se corrió, y quedó pegada…
    expect(corrida.at).not.toEqual(suCelda)
    expect(Math.max(Math.abs(corrida.at.x - suCelda.x), Math.abs(corrida.at.y - suCelda.y))).toBe(1)
    // …nadie se apoyó en nadie (apilar habría sido la otra respuesta, y es la peor)…
    expect(nacida.supportedBy).toBeUndefined()
    expect(corrida.supportedBy).toBeUndefined()
    // …y el invariante quedó limpio.
    expect(revisarEstado(w).filter((v) => v.k === 'solidos-solapados')).toEqual([])
    // Y no se perdió NADA: entraron todas igual.
    expect(sueltasDe(w).length).toBe(decretadasAlrededor(e, { x: 0, y: 0 }))

    // El otro lado del choque, medido: cuántas celdas repite el decreto solo.
    let repetidas = 0
    const celdas = new Set<string>()
    for (const [cx, cy] of alrededor({ x: 0, y: 0 })) {
      for (const s of decretoDe(e.dios, e.phys, cx, cy).chunk.sueltas) {
        const clave = `${String(cx * 16 + (s.i % 16))},${String(cy * 16 + Math.floor(s.i / 16))}`
        if (celdas.has(clave)) repetidas += 1
        celdas.add(clave)
      }
    }
    console.log(
      `\n─── LA CELDA OCUPADA ───\n` +
        `  la primera suelta de (0,0) iba a ${JSON.stringify(suCelda)} y entró en ${JSON.stringify(nacida.at)}\n` +
        `  la piedra que estaba ahí terminó en ${JSON.stringify(corrida.at)}\n` +
        `  celdas que el decreto repite por su cuenta en los 9 chunks: ${String(repetidas)}\n` +
        `  decretadas ${String(decretadasAlrededor(e, { x: 0, y: 0 }))} · materializadas ${String(sueltasDe(w).length)}\n`,
    )
  })

  it('la criatura no queda solapada con lo que le nació encima', () => {
    // Es el mismo choque, del lado del que ya estaba parado ahí. Sobre esta
    // semilla no se da en el arranque, así que se planta: la criatura EN la celda
    // que el decreto le eligió a la primera suelta del chunk (0,0).
    const e0 = escena()
    const s0 = decretoDe(e0.dios, e0.phys, 0, 0).chunk.sueltas[0] as { i: number }
    const e = escena({ desde: { x: s0.i % 16, y: Math.floor(s0.i / 16) } })
    const w = correr(e.state, 1)
    const mia = w.bodies.get('a0-cuerpo') as WorldBody
    const encima = sueltasDe(w).filter((id) => {
      const c = w.bodies.get(id) as WorldBody
      return c.at.x === mia.at.x && c.at.y === mia.at.y && qualityOf(c.body, 'solid', w.phys) > 0
    })
    expect(encima).toEqual([])
    expect(revisarEstado(w).filter((v) => v.k === 'solidos-solapados')).toEqual([])
  })
})

// ═══ (5) EL COSTO, QUE ES LO QUE HAY QUE PRESENTAR ═══════════════════════════

describe('(5) la población y el tick: cuánto crece el mundo mientras alguien camina', () => {
  it('LA TABLA: cuántos cuerpos trae caminar, y qué le pasa al tick', () => {
    // ═══ EL HALLAZGO DE COSTO DE ESTE TRAMO, Y NO SE TAPA ═══════════════════
    //
    // El criterio del Hito 5 es **p99 < 5 ms de tick con 5000 cuerpos**, y ya
    // fallaba por 6,8× con un mundo casi vacío (33,90 ms, ACEPTADO por el usuario y
    // vigilado con una guarda en 45 ms). Materializar el decreto no hace más caro
    // el tick: **hace más grande el mundo**, y el tick cuesta por cuerpo.
    //
    // MEDIDO, con UNA criatura caminando hacia adelante sin parar —el peor caso a
    // propósito; una criatura de verdad se queda a pescar y a hacer fuego—:
    //
    //     tick     cuerpos   chunks abiertos   llegó a   ms/tick
    //      1.000     2.078         201          x=  983    2,535
    //      2.000     4.493         384          x= 1967    7,550
    //      5.000    11.541         942          x= 4936   28,019
    //     10.000    23.353       1.869          x= 9874   74,064
    //     20.000    23.472       1.878          x= 9934   87,743
    //
    // Los 20.000 no siguen creciendo porque **la criatura se clavó en la celda
    // 9934**: con el piso lleno, un `goTo` en línea recta termina contra un sólido
    // sin `footing` y no sale más (ver `haciaElEste`). O sea que la última fila es
    // el mismo mundo del tick 10.000 corriendo diez mil ticks más.
    //
    // ─── LO QUE ESTO QUIERE DECIR, DICHO SIN ADORNOS ────────────────────────
    //
    //   · el mundo cruza los **5000 cuerpos alrededor del tick 2.200**, o sea que
    //     una partida de 20.000 ticks pasa el 90% de su vida por encima de la
    //     población con la que el criterio está escrito;
    //   · la población crece **LINEAL con lo caminado**, no cuadrático: avanzar en
    //     una dirección abre tres chunks nuevos cada 16 celdas y no nueve. A ~12
    //     cuerpos por chunk eso son ~2,2 cuerpos por celda caminada;
    //   · el tick crece con la población y no con el tiempo: 87,7 ms es
    //     **17,5× el techo del criterio**, contra los 6,8× que ya estaban aceptados.
    //
    // ─── Y LA PREGUNTA DE DISEÑO QUE ESTO ABRE, QUE NO SE DECIDE ACÁ ────────
    //
    // El mundo materializa y **nunca olvida**: `sembrados` sólo crece. Las tres
    // salidas, en orden de cuánto rompen:
    //
    //   (a) que el tick deje de ser O(cuerpos) —es el mismo problema que el p99 ya
    //       aceptado, y es donde de verdad está: 98,8% del tick es `paso()` de
    //       `@anima/physics` (`world/tests/el-tick-remedido.test.ts`);
    //   (b) que un chunk lejano se pueda DESMATERIALIZAR y volver a decretarse. Es
    //       caro de verdad: lo que la criatura quemó, ató o se llevó no se puede
    //       recalcular de la semilla, así que habría que guardar la desviación —o
    //       sea el mismo `sembrados` con más adentro—;
    //   (c) materializar sólo lo que está CERCA de alguien en vez del chunk entero.
    //       No lo resuelve: mueve el problema al radio y le agrega dependencia del
    //       camino adentro del chunk.
    //
    // Ninguna es de este tramo, y ninguna se elige por cuenta propia.
    //
    // ─── POR QUÉ ESTE TEST NO AFIRMA UN RELOJ, Y POR QUÉ CORTA EN 2.000 ─────
    //
    // Un test de rendimiento adentro de la suite normal es un test flaky, y un test
    // flaky enseña a ignorar el rojo. Lo que se AFIRMA es el MECANISMO —que la
    // población crece con los chunks abiertos y no con el tiempo, y que crece
    // lineal— y lo que se IMPRIME es el reloj.
    //
    // Y la corrida normal llega a 2.000 y no a 20.000 por una razón medida: los
    // 20.000 tardan **más de quince minutos** (se comieron un plazo de 900 s), que
    // es más que toda la suite del paquete junta. Los hitos largos van con
    // `ANIMA_BANCO=1`, que es el mismo patrón que `banco-el-tick.test.ts`.
    const MIDIENDO_EN_SERIO = process.env['ANIMA_BANCO'] === '1'
    const guion = haciaElEste('a0')
    const hitos = MIDIENDO_EN_SERIO ? ([1000, 2000, 5000, 10_000, 20_000] as const) : ([1000, 2000] as const)
    const filas: string[] = []
    let w = escena().state
    let t = 0
    let anterior = 0
    const medido = new Map<number, { cuerpos: number; abiertos: number; msPorTick: number; x: number }>()
    for (const hasta of hitos) {
      const t0 = performance.now()
      for (; t < hasta; t++) w = stepWorld(w, guion(w, t)).state
      const ms = (performance.now() - t0) / (hasta - anterior)
      anterior = hasta
      medido.set(hasta, {
        cuerpos: w.bodies.size,
        abiertos: (w.dios?.sembrados ?? []).length,
        msPorTick: ms,
        x: donde(w, 'a0').x,
      })
      filas.push(
        `  tick ${String(hasta).padStart(6)} · cuerpos ${String(w.bodies.size).padStart(6)} · ` +
          `chunks abiertos ${String((w.dios?.sembrados ?? []).length).padStart(5)} · ` +
          `caminó hasta x=${String(donde(w, 'a0').x).padStart(6)} · ${ms.toFixed(3)} ms/tick`,
      )
    }
    const ultimo = hitos[hitos.length - 1] as number
    console.log(
      `\n─── LO QUE CUESTA QUE EL MUNDO SIGA A LA CRIATURA ───\n` +
        `  UNA criatura, caminando hacia adelante sin parar (el peor caso)\n${filas.join('\n')}\n` +
        `  el techo del Hito 5 son 5 ms/tick con 5000 cuerpos` +
        `${MIDIENDO_EN_SERIO ? '' : '   (ANIMA_BANCO=1 para llegar hasta los 20.000)'}\n`,
    )
    const a1 = medido.get(1000) as { cuerpos: number; abiertos: number }
    const fin = medido.get(ultimo) as { cuerpos: number; abiertos: number; msPorTick: number }
    // EL MECANISMO: la población crece con los chunks abiertos y no con el tiempo,
    // porque un chunk se abre una sola vez.
    expect(fin.abiertos).toBeGreaterThan(a1.abiertos)
    expect(fin.cuerpos).toBeGreaterThan(a1.cuerpos)
    // Y crece LINEAL con lo caminado, no cuadrático: avanzar en una dirección abre
    // tres chunks nuevos cada 16 celdas, y no nueve.
    expect(fin.abiertos).toBeLessThanOrEqual(3 * Math.ceil(ultimo / 16) + 9)
    // Y EL NÚMERO QUE HAY QUE TENER A LA VISTA, afirmado sobre el CONTEO y no sobre
    // el reloj: **dos mil ticks de caminata dejan el mundo a un paso de los 5000
    // cuerpos con los que está escrito el criterio del Hito 5** —4493 medidos, y la
    // tabla de arriba cruza los 5000 alrededor del tick 2.200—. El 5000 no es un
    // umbral elegido acá: es la población del banco del tick.
    expect(fin.cuerpos).toBeGreaterThan(4000)
  }, 900_000)

  it('un tick en un mundo YA abierto no paga por los chunks abiertos', () => {
    // El precio de abrir es de UNA vez. Lo que se afirma es el mecanismo: después
    // de abrir, el paso no vuelve a tocar el decreto de esos chunks, y la prueba
    // sin cronómetro es que el estado del dios sale POR IDENTIDAD —`diosDeSalida`
    // devuelve el objeto anterior cuando nadie lo tocó—, que es exactamente lo que
    // hace que la ranura no entre en el delta del snapshot.
    const e = escena()
    const w1 = correr(e.state, 1)
    const w2 = stepWorld(w1, []).state
    expect(w2.dios).toBe(w1.dios)
  })
})
