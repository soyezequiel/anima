// ─── QUIÉN HAY DETRÁS, Y CUÁNTO CUESTA AVERIGUARLO ──────────────────────────
//
// El juego quiere mostrar con qué modelo está enganchado. El navegador no puede
// saberlo solo: Codex y Claude son PROCESOS de esta máquina —la misma razón por
// la que `codex.ts` vive acá y no en la página—, así que el backend los sondea y
// lo publica en `/salud`.
//
// ─── LA REGLA QUE ORDENA TODO ESTE ARCHIVO: NO SE GASTA UNA CONSULTA ───────
//
// Preguntar «¿estás?» mandando un prompt costaría plata cada vez que alguien
// abre el juego, y encima mediría lo que no queremos: si la cuenta tiene saldo.
// `--version` no toca la red, no toca la cuenta y contesta en milisegundos.
//
// La contracara hay que decirla, porque el rótulo de la pantalla depende de
// esto: **vivir es que el CLI conteste, no que la cuenta ande**. Un `codex` sin
// sesión iniciada figura vivo acá y falla al primer dibujo. Es lo mismo que ver
// la lucecita del módem: dice que el cable está, no que internet ande.
//
// ─── Y POR QUÉ HAY UN VIGÍA Y NO UN SONDEO POR PEDIDO ─────────────────────
//
// `/salud` es lo primero que el juego pregunta al abrir, y de esa respuesta
// depende que cargue el depósito. Dos `spawn` adentro de esa ruta le sumarían
// medio segundo al arranque de la página para contestar algo que casi nunca
// cambia. Así que el vigía guarda lo último que vio y contesta con eso;
// refrescar es cosa suya y pasa por atrás.

import { spawn } from 'node:child_process'

/** Un CLI de esta máquina: si contesta, y qué versión dijo. */
export interface Modelo {
  readonly vive: boolean
  /** Lo que imprimió `--version`, recortado. Sólo si vive. */
  readonly version?: string
}

export interface Modelos {
  readonly codex: Modelo
  readonly claude: Modelo
}

const TIMEOUT_MS = 8000

/**
 * Cuánto vale un sondeo antes de volver a preguntar.
 *
 * Treinta segundos sale de qué se pierde si está desactualizado: que alguien
 * instale un CLI con el juego abierto y tarde medio minuto en verlo prendido.
 * Más corto sería spawnear dos procesos por minuto para enterarse de algo que
 * cambia una vez por mes.
 */
export const VIGENCIA_MS = 30_000

/**
 * `<cli> --version`, y nunca lanza: no estar es una respuesta.
 *
 * `shell: true` por lo mismo que en `codex.ts`: en Windows estos comandos son
 * shims `.cmd` y sin shell el `spawn` no los encuentra. Los nombres son
 * constantes de este archivo —no hay nada de afuera en la línea de comandos—,
 * así que no hay dónde inyectar.
 */
export function preguntarleAlCLI(cli: string): Promise<Modelo> {
  return new Promise((resolve) => {
    const hijo = spawn(`${cli} --version`, { shell: true, windowsHide: true })
    let salida = ''
    let listo = false
    const terminar = (m: Modelo): void => {
      if (listo) return
      listo = true
      clearTimeout(reloj)
      resolve(m)
    }
    const reloj = setTimeout(() => {
      hijo.kill()
      terminar({ vive: false })
    }, TIMEOUT_MS)

    hijo.stdout?.on('data', (c: Buffer) => (salida += c.toString()))
    // Un CLI que no está hace fallar al shell, no al `spawn`: por eso el veredicto
    // lo da el código de salida y no sólo este `error`.
    hijo.on('error', () => {
      terminar({ vive: false })
    })
    hijo.on('close', (codigo) => {
      const texto = salida.trim().split('\n')[0]?.trim() ?? ''
      terminar(codigo === 0 && texto !== '' ? { vive: true, version: texto.slice(0, 60) } : { vive: false })
    })
  })
}

/** Los dos, a la vez: son procesos independientes y esperarlos en fila no gana nada. */
export async function sondearLosDos(): Promise<Modelos> {
  const [codex, claude] = await Promise.all([preguntarleAlCLI('codex'), preguntarleAlCLI('claude')])
  return { codex, claude }
}

export interface Vigia {
  /** Lo último que se vio. `undefined` mientras no haya sondeado ni una vez. */
  readonly ultimo: () => Modelos | undefined
  /**
   * «Fijate si sigue siendo cierto». Dispara un sondeo si el que hay venció y
   * **no lo espera**: quien pregunta se lleva lo de antes, que es el punto.
   */
  readonly mirar: () => void
}

/**
 * EL VIGÍA. El reloj entra por parámetro y por eso esto se prueba sin esperar
 * treinta segundos: la suite le pasa un contador y adelanta el tiempo a mano.
 *
 * El `mirando` no es prolijidad: sin él, tres pedidos seguidos con el sondeo
 * vencido lanzarían tres pares de procesos para escribir lo mismo.
 */
export function vigilar(
  sondear: () => Promise<Modelos> = sondearLosDos,
  o: { readonly vigenciaMs?: number; readonly ahora?: () => number } = {},
): Vigia {
  const vigencia = o.vigenciaMs ?? VIGENCIA_MS
  const ahora = o.ahora ?? Date.now
  let visto: Modelos | undefined
  let cuando = -Infinity
  let mirando = false

  const mirar = (): void => {
    if (mirando || ahora() - cuando < vigencia) return
    mirando = true
    void sondear()
      .then((m) => {
        visto = m
        cuando = ahora()
      })
      .catch(() => {
        // Un sondeo que revienta no puede tirar el servidor ni borrar lo que ya
        // sabíamos: queda lo de antes y se reintenta cuando venza.
        cuando = ahora()
      })
      .finally(() => {
        mirando = false
      })
  }

  return { ultimo: () => visto, mirar }
}
