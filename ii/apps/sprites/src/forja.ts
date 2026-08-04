// ─── LA MITAD DE AFUERA DEL EPISODIO DE LA FRAGUA ───────────────────────────
//
// `@anima/forge` ya trae el episodio partido en dos, y la línea no la eligió
// nadie: sale de una tabla medida contra la ventana de un tick, que son 50 ms.
//
//     AFUERA          el viaje al modelo (6 a 25 s) · la puerta (56 ms) · reparar
//     EN LA FRONTERA  instrumentar · montar · juzgar · instalar
//
// Este archivo es «afuera», y le toca por la misma razón que le tocó dibujar:
// **el navegador no puede hacer `spawn`**, y el compilador de TypeScript pesa
// siete megas que nadie quiere bajar para jugar. Del otro lado del `/forjar`
// queda lo barato, que es lo que necesita el objeto montado — y un objeto con
// funciones adentro no cruza una respuesta HTTP.
//
// ─── LO QUE ESTE ARCHIVO AGREGA AL EPISODIO, y es una sola cosa ────────────
//
// Instrumentar. En `forge/demo/hilo.ts` —el worker de Node— se hace del lado de
// la frontera, porque ahí los dos lados comparten proceso y `ts` está en los dos.
// Acá no: cruzar el TS crudo obligaría al navegador a traerse el compilador para
// una transformación que ya se puede hacer de este lado.
//
// El ORDEN se respeta y es lo que importa: **primero typechequea el fuente y
// después se instrumenta**. Está escrito en `instrument()` y no es negociable —
// el código inyectado hace `yield __fuelSuspend` adentro de un generador, así
// que el instrumentado NO compila contra la API y nunca tiene que hacerlo.
//
// ─── LAS TRES PUERTAS SIGUEN SIENDO TRES ───────────────────────────────────
//
// El sandbox del Hito 4 pide que entre el modelo y la ejecución haya tres, y
// ninguna trabaja sobre algo ya evaluado. Repartidas, quedan:
//
//     1. el typecheck contra el `.d.ts`     acá
//     2. el `mount` con `shadowScope()`     en el navegador
//     3. el juez                            en el navegador
//
// Instrumentar no es una puerta: es preparación, y va pegada a la primera.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

import {
  Puerta,
  encargoDe,
  leerCandidatas,
  loQueVaAfuera,
  textoDe,
  type Candidata,
  type PedidoDeLaMente,
} from '@anima/forge'
import { buildSeedPhysics } from '@anima/physics'
import { instrument } from '@anima/skills'

/**
 * CUÁNTAS CANDIDATAS SE PIDEN POR VIAJE.
 *
 * Dos y no una: un modelo que escribe una sola habilidad no tiene con qué
 * equivocarse distinto. Y no cinco, porque **quien paga el typecheck es esta
 * ruta** y cada candidata es una pasada por la puerta.
 */
const K_POR_VIAJE = 2

/** Lo que se le concede a un episodio entero, modelo incluido. */
const ESPERA_MS = Number.parseInt(process.env['ANIMA_CODEX_ESPERA_FRAGUA'] ?? '180000', 10)

/**
 * LA SUPERFICIE: el `.d.ts` contra el que la candidata va a compilar.
 *
 * Se lee del disco UNA vez y se recuerda. Es lo que `puerta.ts` dice con todas
 * las letras —*«la superficie contra la que se compila ES el prompt»*— así que no
 * se resume ni se recorta: va entero.
 *
 * Del disco y no importado como string porque es un `.d.ts`: no hay forma de
 * `import`arlo como texto sin un plugin, y este proceso ya lee archivos.
 */
const DONDE_LA_API = fileURLToPath(new URL('../../../packages/skills/src/skill-api.d.ts', import.meta.url))
let api: string | undefined

async function laApi(): Promise<string> {
  api ??= await readFile(DONDE_LA_API, 'utf8')
  return api
}

/**
 * UNA SOLA PUERTA PARA TODO EL PROCESO, y es lo que compra los 56 ms.
 *
 * El `LanguageService` tiene que sobrevivir entre candidatas o no hay estructura
 * que reusar: una puerta por pedido son los +319 ms por candidata que el banco
 * del Hito 0 midió para `createProgram`. Es la misma decisión que toma el worker
 * de `@anima/forge`, por el mismo motivo.
 */
let puerta: Puerta | undefined

/**
 * Y EL PRIMER TYPECHECK PAGA EL PROGRAMA ENTERO: 428 ms contra 56 de los que
 * siguen. Se paga con la primera forja de la sesión y no se vuelve a pagar.
 */
function laPuerta(): Puerta {
  if (puerta === undefined) {
    puerta = new Puerta(ts)
    puerta.revisar('export const tibia = 1\n')
  }
  return puerta
}

/** Una candidata forjada, tal como cruza a la pantalla: texto y nada más. */
export interface Forjada {
  readonly nombre: string
  readonly desenlace: string
  /** El TypeScript que escribió el modelo, para poder mostrarlo y guardarlo. */
  readonly codigo: string
  /** El JavaScript instrumentado, que es lo que el navegador monta. */
  readonly js: string
  /** Cuántos puntos de inyección tenía. Va al informe del juez. */
  readonly puntos: number
  /** Cuántas pasadas por la puerta costó. Una pasada ≈ una ventana de tick. */
  readonly puertazos: number
  /** Los nombres que pidió y el mundo no tiene. Vacío salvo en `rota`. */
  readonly conceptos: readonly string[]
}

export interface Forja {
  readonly ok: boolean
  readonly forjadas: readonly Forjada[]
  /** Cuántos bloques devolvió el modelo antes de cortar en K. */
  readonly candidatas: number
  readonly porque?: string
}

/**
 * ═══ EL EPISODIO PARTIDO AL MEDIO, y por qué ═══════════════════════════════
 *
 * `forjar()` hace las dos mitades de un tirón y sigue siendo el camino cuando
 * este depósito tiene modelo propio. Pero desde que la cuenta la puede poner el
 * que juega (ADR 0089), el viaje al modelo pasa a hacerlo el NAVEGADOR, y las
 * dos mitades quedan separadas por una respuesta HTTP entera:
 *
 *     `elPromptDeLaForja`   armar el encargo y el texto     ← acá
 *     (el navegador le pregunta a SU modelo)
 *     `leerLoForjado`       typechequear e instrumentar     ← acá también
 *
 * Lo que NO se mueve es la parte cara y la parte que hay que creerle a alguien:
 * el `.d.ts` entero de la superficie sigue saliendo de este lado, y el
 * typecheck también. El navegador viaja al modelo; no decide si lo que volvió
 * compila.
 *
 * El `encargo` es lo que las dos mitades comparten, y por eso sale en el
 * resultado de la primera: `leerCandidatas` lo necesita para leer lo que el
 * modelo escribió, y rearmarlo del otro lado sería tener dos encargos que
 * tarde o temprano difieren.
 */
export interface PromptDeLaForja {
  readonly prompt: string
  /** El encargo, que la segunda mitad necesita para leer lo que volvió. */
  readonly encargo: ReturnType<typeof encargoDe>
  /** Cuánto se le concede al viaje. Lo decide esta capa, no quien pregunta. */
  readonly esperaMs: number
}

export async function elPromptDeLaForja(
  p: PedidoDeLaMente,
  enCastellano?: string,
  queVerificar?: readonly string[],
): Promise<PromptDeLaForja> {
  const phys = buildSeedPhysics()
  const encargo = encargoDe(p, phys, enCastellano)
  const prompt = textoDe(encargo, {
    api: await laApi(),
    desde: '../../src/skill-api.js',
    cuantas: K_POR_VIAJE,
    ...(queVerificar === undefined || queVerificar.length === 0 ? {} : { queVerificar }),
  })
  return { prompt, encargo, esperaMs: ESPERA_MS }
}

/** La segunda mitad: lo que el modelo escribió, pasado por la puerta. */
export function leerLoForjado(texto: string, encargo: PromptDeLaForja['encargo']): Forja {
  const cs: readonly Candidata[] = leerCandidatas(texto, encargo, K_POR_VIAJE)
  if (cs.length === 0) {
    // NO es una falla del camino: el modelo contestó y no escribió una habilidad.
    // El juego lo pinta distinto que un CLI que no arrancó.
    return { ok: true, forjadas: [], candidatas: 0 }
  }

  const forjadas: Forjada[] = []
  for (const f of loQueVaAfuera(cs, laPuerta())) {
    // Las rotas cruzan igual y sin `js`: no hay nada que montar, pero sus
    // `conceptos` son lo que alimenta el encargo de la vuelta siguiente. Tirarlas
    // acá sería tirar la única información que un fracaso deja.
    const js = f.desenlace === 'rota' ? '' : instrument(ts, f.codigo)
    forjadas.push({
      nombre: f.nombre,
      desenlace: f.desenlace,
      codigo: f.codigo,
      js: typeof js === 'string' ? js : js.js,
      puntos: typeof js === 'string' ? 0 : js.points,
      puertazos: f.puertazos,
      conceptos: f.conceptos,
    })
  }
  return { ok: true, forjadas, candidatas: cs.length }
}

/**
 * EL EPISODIO DE AFUERA, ENTERO — el camino de cuando el depósito tiene modelo.
 *
 * `preguntar` entra por parámetro y no se importa: es lo mismo que el servidor
 * hace con el dibujante, y por el mismo motivo — la suite corre esta función
 * completa sin gastar una consulta ni spawnear un proceso.
 */
export async function forjar(
  p: PedidoDeLaMente,
  preguntar: (prompt: string, timeoutMs: number) => Promise<{ ok: boolean; texto: string; porque?: string }>,
  enCastellano?: string,
  queVerificar?: readonly string[],
): Promise<Forja> {
  const { prompt, encargo, esperaMs } = await elPromptDeLaForja(p, enCastellano, queVerificar)
  const salida = await preguntar(prompt, esperaMs)
  if (!salida.ok) return { ok: false, forjadas: [], candidatas: 0, porque: salida.porque ?? 'el modelo no contestó' }
  return leerLoForjado(salida.texto, encargo)
}
