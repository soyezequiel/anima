/**
 * LA PUERTA COMPILABA CONTRA EL DOM — Hito 8, tramo H.
 *
 * ─── El hallazgo, y salió de medir otra cosa ────────────────────────────────
 *
 * El tramo H empezó preguntando cuánto cuesta la puerta contra una ventana de
 * tick (50 ms), y el número no cerraba: **p50 109 ms**, cuando el banco del Hito
 * 0 mide **46 ms** para la misma ranura fija, en esta misma máquina y sobre el
 * mismo corpus. Dos veces y media, sin explicación.
 *
 * La diferencia estaba en dos líneas que el banco tenía y la puerta no:
 *
 *   lib: ['lib.es2022.d.ts'],   // sin DOM, como los paquetes deterministas de ii/
 *   types: [],                  // sin auto-incluir @types/*
 *
 * Sin ellas, TypeScript carga la librería por omisión —**que incluye el DOM**— y
 * se auto-agrega todos los `@types/*` que encuentre en `node_modules`. Eso
 * explicaba la mitad del tiempo. Y de paso destapaba lo otro.
 *
 * ─── Lo que la puerta dejaba pasar ──────────────────────────────────────────
 *
 * Medido con la puerta tal como estaba escrita:
 *
 *   con fetch          COMPILA
 *   con document       COMPILA
 *   con setTimeout     COMPILA
 *   con localStorage   COMPILA
 *   con process        COMPILA
 *
 * **Las cinco están en `FORBIDDEN_GLOBALS`**, la lista de `aislamiento.ts` que
 * dice qué no existe adentro de una habilidad.
 *
 * ─── Por qué NO es un agujero de seguridad, y sí es un agujero ──────────────
 *
 * No lo es porque `mount()` tapa esos nombres por alcance léxico (`shadowScope`)
 * y la habilidad revienta al llamarlos. La caja aguanta.
 *
 * Lo es porque **la puerta existe para rechazar sin gastar**. Una candidata que
 * pide `fetch` se iba entera al montaje y al juez —trece mundos, cuarenta ticks
 * cada uno— para morir allá. Decirle que no acá cuesta 56 ms.
 *
 * Y hay una razón más, que es la del Hito 6: **la `.d.ts` contra la que se
 * compila ES el prompt**. Un `lib` de más es una API que el modelo puede usar y
 * que el mundo no tiene.
 *
 * ─── EL CONTROL, porque una puerta que rechaza todo no prueba nada ──────────
 *
 * Dos, y los dos importan:
 *
 *   · una habilidad sana sigue compilando (si no, la puerta se cerró de más);
 *   · el corpus de 27 borradores rechaza **las mismas 24** antes y después,
 *     medido con las tres variantes de opciones en la misma corrida. Es lo que
 *     deja en pie las cuentas del tramo C —el 86%, los 34 conceptos, los 7
 *     typos—: si el cambio hubiera movido qué borrador falla, esos números
 *     habría que volver a sacarlos. Quien los afirma sigue siendo
 *     `las-reparaciones.test.ts`, que corre el corpus entero y no se movió.
 */

import { FORBIDDEN_GLOBALS } from '@anima/skills'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { Puerta } from '../src/puerta.js'

const CABECERA = [
  "import type { Ctx, Intent, Outcome, StepResult } from '../../src/skill-api.js'",
  "import { done } from '../../src/skill-api.js'",
  '',
].join('\n')

/** Una habilidad mínima que usa `nombre` como si existiera. */
function laQueUsa(nombre: string): string {
  return `${CABECERA}export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase(String(${nombre}))
  return done()
}
`
}

const SANA = `${CABECERA}export function* f(ctx: Ctx): Generator<Intent, Outcome, StepResult> {
  ctx.phase('sana')
  return done()
}
`

/**
 * Los códigos con los que TypeScript dice «ese nombre no existe acá».
 *
 * Son TRES y no uno, y hubo que medirlo: TypeScript cambia el código según a
 * quién le eche la culpa de la falta.
 *
 *   2304  `Cannot find name` — el genérico. `fetch`, `setTimeout`, `localStorage`
 *   2584  «…do you need to change your target library?» — `document`
 *   2591  «…install type definitions for node?» — `process`
 *
 * Los dos últimos son la confesión de que el compilador **conoce** el nombre y
 * no lo tiene cargado, que es exactamente lo que se le pidió.
 */
const NO_EXISTE_ESE_NOMBRE = [2304, 2584, 2591]

describe('LA PUERTA y los globals que el sandbox prohíbe', () => {
  const p = new Puerta(ts)

  it('EL CONTROL: una habilidad sana sigue compilando', () => {
    // Sin esto, todo lo de abajo lo cumpliría una puerta que rechaza cualquier
    // cosa — que es la forma más fácil de tener este archivo en verde.
    expect(p.revisar(SANA).k).toBe('compila')
  })

  it('los cinco que el tramo H encontró pasando: hoy los rechaza a los cinco', () => {
    const cinco = ['fetch', 'document', 'setTimeout', 'localStorage', 'process']
    for (const n of cinco) {
      const v = p.revisar(laQueUsa(n))
      expect(v.k, `${n} COMPILA: la puerta volvió a ver el navegador`).toBe('no-compila')
      // Y por el motivo correcto: el nombre no existe en la librería, no un
      // error derivado de otra cosa. Sin esto, un typo en el molde daría verde.
      if (v.k === 'no-compila') {
        expect(
          v.errores.some((e) => NO_EXISTE_ESE_NOMBRE.includes(e.codigo)),
          `${n}: ${v.errores[0]?.mensaje}`,
        ).toBe(true)
      }
    }
  })

  it('LA LISTA ENTERA de `FORBIDDEN_GLOBALS`, contada — cuántos ve la puerta', () => {
    const pasan: string[] = []
    const caen: string[] = []
    for (const n of Object.keys(FORBIDDEN_GLOBALS)) {
      const v = p.revisar(laQueUsa(n))
      ;(v.k === 'compila' ? pasan : caen).push(n)
    }
    console.log(
      `\n  de ${String(caen.length + pasan.length)} globals prohibidos, la puerta rechaza ${String(caen.length)}` +
        `\n  siguen compilando: ${pasan.join(', ')}\n`,
    )

    // ─── 31 de 40, y los nueve que quedan NO son un descuido ────────────────
    //
    // Los nueve son globals **del lenguaje**, no del navegador: `Date`, `Intl`,
    // `Promise`, `Function`, `globalThis`, `SharedArrayBuffer`, `Atomics`,
    // `WeakRef` y `FinalizationRegistry` están en ES2022 y **ningún `lib` los
    // puede sacar**. Un typecheck no los va a ver nunca.
    //
    // Y los dos primeros son justo los caros: `Date` es el titular de la regla 2
    // —«el tiempo del mundo se lee con `ctx.tick`»— y una habilidad que lo use
    // hace divergir el replay sin que nada se ponga rojo acá.
    //
    // A ésos los caza otra cosa: `scanDeterminism` de `aislamiento.ts`, que lee
    // el ÁRBOL en vez de preguntarle a la librería. **Hoy la fragua no lo
    // llama** — `forjarUna` es puerta, reparación y puerta, y nada más. Queda
    // dicho acá con el número al lado, que es donde se va a leer el día que
    // haga falta: son 9 de 40 los que la puerta no puede tapar sola.
    expect(caen.length + pasan.length).toBe(40)
    expect(pasan).toEqual([
      'Date',
      'Intl',
      'globalThis',
      'Function',
      'Promise',
      'SharedArrayBuffer',
      'Atomics',
      'WeakRef',
      'FinalizationRegistry',
    ])
  })
})
