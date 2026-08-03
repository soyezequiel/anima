// ─── LA FRAGUA DEL JUEGO: pedir afuera, juzgar acá ──────────────────────────
//
// El otro extremo de `POST /forjar`. El depósito hizo lo caro —el viaje al
// modelo y el typecheck— y lo que llega es texto. Acá pasa lo que necesita el
// mundo delante: montar, juzgar, y devolver un veredicto que `Ordenes` sepa leer.
//
// La línea entre las dos mitades no la elegimos: sale de la tabla medida de
// `@anima/forge`, contra la ventana de un tick que son 50 ms.
//
//     el viaje al modelo   6 a 25 s   → afuera
//     la puerta            56 ms      → afuera
//     montar               2,4 ms     → acá
//     juzgar               2,9 ms     → acá
//
// ═══ EL CONTRATO SALE DE ESTE LADO, Y NO PODÍA SALIR DE OTRO ═══════════════
//
// Es lo que hacía que enchufar la fragua no sirviera de nada. El juez necesita un
// contrato para armar los mundos donde probar la habilidad, y sin contrato
// contesta `injuzgable` — o sea que TODO lo que el modelo escriba se descarta con
// la misma cara que si no hubiera escrito nada.
//
// `contratoDelGap` lo deriva, y para eso necesita saber una cosa que sólo existe
// acá: **qué de lo que el hueco pide ya lo trae la materia que la criatura tiene
// en la mano**. De ese reparto sale si una condición es una precondición («tenés
// esto») o una promesa («dejame esto otro»), y ponerlas al revés hace que el juez
// ablacione justo lo que se le está pidiendo a la habilidad.
//
// Medido en la partida que originó todo: de las seis condiciones del hueco del
// fuego, la vara de madera cumplía cinco. La que faltaba era `moisture`.

// ─── DEL SUBPATH Y NO DEL ÍNDICE, y no es estilo ────────────────────────────
//
// `@anima/forge` exporta con `export *`, así que importar del índice se trae
// TODO el paquete — incluida `puerta.ts`, que hace `readFileSync` de `node:fs`
// para servirle el `.d.ts` al compilador de TypeScript. En Node eso está bien;
// en un navegador, Vite lo reemplaza por un stub que tira al usarlo y **el juego
// entero no arranca**.
//
// Y no arranca en silencio, que es lo peor: no hay excepción en la consola. Lo
// que se ve es un mapa negro, el tick clavado en 0 y las dos lámparas en
// «preguntando…» para siempre — o sea que parece un problema del depósito. El
// error real sólo aparece si uno importa el módulo a mano desde la consola.
//
// El subpath deja entrar la única pieza de la fragua que es del navegador. El
// depósito sigue importando del índice, que es donde `node:fs` corresponde.
import { contratoDelGap } from '@anima/forge/contrato-del-gap'
// `import type` se borra al compilar, así que esto no arrastra nada en runtime.
import type { PedidoDeLaMente } from '@anima/forge'
import { juzgar } from '@anima/judge'
import { qualityOf, type Physics, type QualityTest } from '@anima/physics'
import type { WorldState } from '@anima/world'
import { done, fail, mount, shadowScope, type Skill } from '@anima/skills'
import { Contexto, type Partida } from '@anima/perceive'

import type { Forjado } from './ordenes.js'

/** Una candidata como vuelve del depósito: texto y nada más. */
interface Forjada {
  readonly nombre: string
  readonly desenlace: string
  readonly codigo: string
  readonly js: string
  readonly puntos: number
  readonly conceptos: readonly string[]
}

interface LoQueVuelve {
  readonly ok?: unknown
  readonly forjadas?: unknown
  readonly candidatas?: unknown
  readonly porque?: unknown
}

/**
 * ¿LA MATERIA QUE TIENE A MANO YA CUMPLE ESTO?
 *
 * Se mira lo que la criatura LLEVA ENCIMA y no el mundo entero, y la diferencia
 * importa: el contrato describe con qué va a correr la habilidad, y lo que va a
 * tener a mano es lo que ya agarró. Un tronco perfecto a treinta celdas no es
 * una precondición cumplida — es otro problema.
 *
 * Si no tiene nada en la mano, ninguna condición se da por cumplida y
 * `contratoDelGap` contesta `no-hay-de-donde-agarrar`, que es la verdad.
 */
function loQueTraeLaMateria(st: WorldState, quien: string, phys: Physics): (t: QualityTest) => boolean {
  const actor = st.actors.get(quien)
  const enMano = (actor?.holding ?? []).map((id) => st.bodies.get(id)?.body).filter((b) => b !== undefined)
  return (t) => {
    for (const b of enMano) {
      let v: number
      try {
        v = qualityOf(b, t.q, phys)
      } catch {
        continue
      }
      const pasa = t.op === '>=' ? v >= t.v : t.op === '<=' ? v <= t.v : t.op === '>' ? v > t.v : v < t.v
      if (pasa) return true
    }
    return false
  }
}

/**
 * DE TEXTO A HABILIDAD VIVA.
 *
 * `modules` sirve la superficie a mano porque el sandbox no lee del disco: es lo
 * mismo que hace el criterio del Hito 4 con las quince innatas. `done` y `fail`
 * son las dos únicas funciones de verdad que la API exporta.
 *
 * Y `shadowScope()` es la segunda de las tres puertas: lo que el modelo escribió
 * no ve `fetch`, ni `Date`, ni nada que le permita salir de acá.
 */
function montar(js: string, nombre: string): { skill: Skill<Record<string, never>>; cell: ReturnType<typeof mount>['cell'] } {
  const m = mount(js, {
    scope: shadowScope(),
    modules: { '../../src/skill-api.js': { done, fail } },
  })
  const f = m.exports[nombre]
  if (typeof f !== 'function') throw new Error(`${nombre} no quedó montada`)
  return { skill: f as Skill<Record<string, never>>, cell: m.cell }
}

/**
 * ═══ LOS ARGUMENTOS, QUE ES POR DONDE SE CAÍA TODO ═════════════════════════
 *
 * El juez le pasa a la habilidad lo que `argsDe` devuelva, y en TODO este
 * repositorio eso era `() => ({})` — en los tests del episodio, en los cuatro
 * demos de la fragua, en todos lados. Nunca se notó porque los muñecos de esos
 * tests no toman argumentos: *«el muñeco no toma args, así que el juez no tiene
 * nada que buscar»*, dice el comentario.
 *
 * Un modelo de verdad sí los toma. Medido con lo primero que Codex escribió para
 * el hueco de una partida:
 *
 *     export function* secarVaraPorEspera(ctx: Ctx, args: { vara: BodyView })
 *
 * Con `{}` adentro, `args.vara` es `undefined` y la habilidad muere en su primera
 * línea. El veredicto que salía era **«no llegó en 9 mundos que debería
 * resolver»**, o sea el juez culpando a la habilidad de un vacío del arnés. Es el
 * peor tipo de rojo que hay: el que parece un veredicto.
 *
 * ─── DE DÓNDE SALE EL NOMBRE, y por qué del TypeScript y no del JS ─────────
 *
 * El JS instrumentado ya perdió los tipos, así que ahí `args` es un objeto sin
 * forma. El TypeScript crudo cruza igual —se guarda para poder mostrarlo— y su
 * firma dice los nombres y de qué tipo son. Es leer lo que el modelo declaró, no
 * adivinar.
 */
const LA_FIRMA = /function\s*\*\s*[A-Za-z0-9_$]+\s*\([^)]*?args\s*:\s*\{([^}]*)\}/
const UN_CAMPO = /([A-Za-z0-9_$]+)\s*\??\s*:\s*([A-Za-z0-9_$<>[\]| ]+)/g

/** Los campos que la habilidad declaró en `args`, con su tipo. */
export function argumentosQuePide(codigoTS: string): readonly { readonly nombre: string; readonly tipo: string }[] {
  const m = LA_FIRMA.exec(codigoTS)
  if (m?.[1] === undefined) return []
  const out: { nombre: string; tipo: string }[] = []
  for (const c of m[1].matchAll(UN_CAMPO)) {
    const nombre = c[1]
    const tipo = c[2]?.trim()
    if (nombre !== undefined && tipo !== undefined) out.push({ nombre, tipo })
  }
  return out
}

/**
 * LO QUE SE LE PASA A LA HABILIDAD EN CADA MUNDO DEL BANCO.
 *
 * El banco pone la criatura y, si el contrato pide materia, **un solo cuerpo al
 * lado**. Así que «el objetivo» no es ambiguo: es el único que no es ella. Es la
 * misma forma que usa `argsDeSostener` en los tests del juez, que hasta hoy era
 * el único lugar del repo donde alguien armaba argumentos de verdad.
 *
 * `undefined` cuando no se puede armar, y eso NO cuenta como fracaso de la
 * habilidad: `correrEn` lo lee como «este mundo no la puede ni largar» y lo
 * saltea. Son dos casos y los dos son honestos — que el mundo no tenga objetivo,
 * y que la habilidad pida un argumento que no es un cuerpo (un número, una
 * cantidad) y que este arnés no sabe inventar.
 */
function losArgumentos(codigoTS: string): (p: Partida) => Record<string, never> | undefined {
  const pide = argumentosQuePide(codigoTS)
  return (p) => {
    if (pide.length === 0) return {} as Record<string, never>
    const ctx = new Contexto(p.proyeccion, { actor: QUIEN_JUZGA, rng: p.dado.tirar, lugares: p.lugares }).ctx
    const otros = ctx.see([]).filter((b: { id: string }) => b.id !== `${QUIEN_JUZGA}-cuerpo`)
    const objetivo = otros[0]
    const args: Record<string, unknown> = {}
    for (const a of pide) {
      if (!a.tipo.includes('BodyView')) return undefined
      if (objetivo === undefined) return undefined
      args[a.nombre] = objetivo
    }
    return args as Record<string, never>
  }
}

/** El actor que el banco del juez pone en cada mundo. Es una constante suya. */
const QUIEN_JUZGA = 'acusada'

export interface OpcionesDeLaFragua {
  readonly donde: string
  readonly phys: Physics
  readonly quien: string
  /** El mundo de AHORA. Función y no valor: el estado cambia en cada tick. */
  readonly mundo: () => WorldState
  /** Para que el hueco viaje también en castellano, que es la forma medida. */
  readonly enCastellano: (firma: string) => string
  /**
   * CÓMO SE PIDE, y entra por parámetro para poder probarlo sin tocar el global.
   *
   * ─── LO QUE PASÓ CUANDO NO ESTABA, y es de los que enseñan ────────────────
   *
   * El test de este módulo pisaba `globalThis.fetch` con `vi.stubGlobal`, y eso
   * **no es de este archivo: es del proceso**. Vitest corre varios archivos en el
   * mismo worker, así que el stub salpicaba a otro test —el del inventario, que
   * pide sprites— y lo hacía fallar una corrida sí y una no. Aislado pasaba
   * siempre, que es la firma de este tipo de bug y por lo que cuesta encontrarlo.
   *
   * Un `afterEach` no alcanza: la ventana existe MIENTRAS el test corre, no
   * después. Lo único que la cierra es no tener nada global que pisar.
   */
  readonly fetch?: typeof globalThis.fetch
}

/**
 * LA FRAGUA DEL JUEGO. Se le pasa a `OpcionesDeOrdenes.fragua`.
 *
 * Devuelve `undefined` cuando no salió nada que valga la pena mirar, y **tira**
 * cuando el camino falló. Es la misma distinción que el proveedor del chat: una
 * cosa es que el modelo no supo y otra que no llegamos a preguntarle, y hay una
 * lámpara esperando cada una.
 */
export function forjarPorElDeposito(
  o: OpcionesDeLaFragua,
): (p: PedidoDeLaMente & { readonly gap: string }, signal?: AbortSignal) => Promise<Forjado | undefined> {
  const pedir = o.fetch ?? ((u: string | URL | Request, i?: RequestInit) => globalThis.fetch(u, i))
  return async (p, signal) => {
    const st = o.mundo()
    const yaLoTrae = loQueTraeLaMateria(st, o.quien, o.phys)

    // ─── EL CONTRATO SE ARMA ANTES DE PAGAR EL VIAJE ───────────────────────
    //
    // Y no después, que es lo que saldría natural. Si el hueco no da un contrato
    // juzgable, todo lo que el modelo escriba va a terminar en `injuzgable` y se
    // va a tirar: preguntar primero sería pagar 25 segundos y una consulta para
    // llegar a la misma conclusión que se puede sacar acá, gratis.
    const c = contratoDelGap(p.gap, 'forjada', yaLoTrae)
    if (c.k !== 'contrato') {
      return {
        nombre: 'forjada',
        grado: 'injuzgable',
        porQue:
          c.porque === 'no-es-de-materia'
            ? 'eso que falta no es una cosa que se pueda agarrar'
            : c.porque === 'no-falta-nada'
              ? 'lo que falta ya lo tengo: el problema es otro'
              : 'no tengo nada en la mano con qué empezar',
      }
    }

    const r = await pedir(`${o.donde}/forjar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        gap: p.gap,
        meta: p.meta,
        porQue: p.porQue,
        tick: p.tick,
        enCastellano: o.enCastellano(p.gap),
        // Lo que se le va a verificar, en las palabras del contrato. Sin esto el
        // modelo inventa qué quiere decir «algo que sirva» — está medido, y las
        // dos candidatas de esa corrida fallaron por lo mismo.
        queVerificar: c.contrato.establece.map((x) => `${x.q} ${x.op} ${String(x.v)}`),
      }),
      ...(signal === undefined ? {} : { signal }),
    })
    if (!r.ok) {
      const porque = await r
        .json()
        .then((j: LoQueVuelve) => (typeof j.porque === 'string' ? j.porque : ''))
        .catch(() => '')
      throw new Error(`la fragua contestó ${String(r.status)}${porque === '' ? '' : `: ${porque}`}`)
    }

    const j = (await r.json()) as LoQueVuelve
    const forjadas = (Array.isArray(j.forjadas) ? j.forjadas : []) as Forjada[]
    if (forjadas.length === 0) return undefined

    // ─── SE JUZGAN TODAS Y GANA LA QUE PROMUEVE ────────────────────────────
    //
    // Y no la primera: el viaje pide K candidatas justamente porque un modelo que
    // escribe una sola no tiene con qué equivocarse distinto. Quedarse con la
    // primera tiraría la buena cuando la mala salió antes.
    let ultimo: Forjado | undefined
    for (const f of forjadas) {
      if (f.desenlace === 'rota' || f.js === '') {
        ultimo ??= {
          nombre: f.nombre,
          grado: 'injuzgable',
          porQue:
            f.conceptos.length === 0
              ? 'lo que escribió no compila'
              : `lo que escribió usa cosas que este mundo no tiene: ${f.conceptos.join(', ')}`,
        }
        continue
      }
      let montada: ReturnType<typeof montar>
      try {
        montada = montar(f.js, f.nombre)
      } catch (e) {
        // El sandbox la rechazó. Es la segunda puerta haciendo su trabajo, y no
        // un error nuestro: se cuenta como un veredicto y se sigue.
        ultimo ??= {
          nombre: f.nombre,
          grado: 'injuzgable',
          porQue: `no la pude montar: ${e instanceof Error ? e.message : 'falló el sandbox'}`,
        }
        continue
      }
      const d = juzgar(
        {
          acusada: { nombre: f.nombre, contrato: { ...c.contrato, nombre: f.nombre } },
          skill: montada.skill,
          cell: montada.cell,
          argsDe: losArgumentos(f.codigo),
        },
        o.phys,
      )
      const veredicto: Forjado = {
        nombre: f.nombre,
        grado: d.grado,
        // Los cargos del juez en sus palabras, que es lo que el canal muestra. Se
        // corta: un dictamen entero no entra en una línea de chat.
        porQue: d.cargos.map((x) => x.porque).join(' · ').slice(0, 200),
      }
      if (d.grado === 'promueve') return veredicto
      ultimo ??= veredicto
    }
    return ultimo
  }
}
