// ─── LO QUE SE VE DE LA CRIATURA ────────────────────────────────────────────
//
// La mitad que la escena NO hace, y a propósito. `ActorEnEscena` publica
// `aliento`, `haciendo` y `esperando` en crudo —un `ProcessId`, unos segundos, un
// entero— y deja afuera el máximo del aliento, el total del proceso y el nombre
// en castellano. Las tres cosas se arman acá, y las tres salen de la `Physics`,
// que esta capa ya tiene.
//
// Que esté en un archivo aparte y no adentro del bucle no es orden por el orden:
// es lo único de la pantalla que tiene decisiones adentro, y así se puede probar
// sin abrir un navegador.

import type { Physics } from '@anima/physics'
import type { ActorEnEscena, Escena } from '@anima/world'

/** Una barra: cuánto lleva, de cuánto, y la fracción ya resuelta. */
export interface Barra {
  readonly valor: number
  readonly de: number
  /** Entre 0 y 1, topada. Una barra que se pase del borde es un bug que se ve. */
  readonly fraccion: number
}

export interface EnCurso {
  /** El verbo en castellano: sale de `Process.lexeme.nombre`. */
  readonly que: string
  readonly segundos: number
  /**
   * `undefined` cuando el proceso NO declara `completion`.
   *
   * No es un caso raro que convenga esconder: `friccion` es exactamente eso, y su
   * comentario lo dice —frotar no termina, termina la criatura—. Una barra ahí
   * sería una mentira con un porcentaje adentro, así que la pantalla muestra el
   * tiempo que lleva y ninguna barra.
   */
  readonly barra?: Barra
  /** Sobre qué está actuando, en palabras. Vacío si los cuerpos no se ven. */
  readonly sobre: readonly string[]
}

export interface LaCriatura {
  readonly aliento: Barra
  readonly manos: readonly string[]
  readonly haciendo?: EnCurso
  readonly esperando?: Barra
}

function barra(valor: number, de: number): Barra {
  if (!(de > 0)) return { valor, de, fraccion: 0 }
  const f = valor / de
  return { valor, de, fraccion: f < 0 ? 0 : f > 1 ? 1 : f }
}

/**
 * CÓMO SE NOMBRA UN CUERPO CON LO QUE LA ESCENA PUBLICA.
 *
 * Forma más núcleo, y nada más: son los dos campos del `RenderDescriptor` que
 * dicen qué es la cosa. No se arma un nombre más rico —«la vara chamuscada que
 * lleva en la mano»— porque eso ya es texto narrativo, y el que sabe hacerlo es
 * `@anima/lang`. Acá alcanza con que el jugador reconozca qué agarró.
 */
function nombrar(e: Escena, id: string): string | undefined {
  const c = e.cuerpos.get(id)
  return c === undefined ? undefined : `${c.d.forma} de ${c.d.nucleo}`
}

/**
 * EL MÁXIMO DEL ALIENTO, leído del catálogo y no escrito acá.
 *
 * `stamina` declara `range: [0, 1000]` en `quality.ts`, y ese tope no es
 * decorativo: comer se recorta contra él —`conCualidad` lo aplica— y de ahí sale
 * que una criatura llena rechace lo que una flaca acepta. Copiar el 1000 en esta
 * capa sería tener dos verdades sobre el mismo tanque.
 */
function techoDelAliento(phys: Physics): number {
  return phys.qualities.find((q) => q.id === 'stamina')?.range[1] ?? 0
}

export function loQueSeVeDe(a: ActorEnEscena, e: Escena, phys: Physics): LaCriatura {
  const manos = a.holding.map((id) => nombrar(e, id) ?? id)

  let haciendo: EnCurso | undefined
  if (a.haciendo !== undefined) {
    const p = phys.processes.get(a.haciendo.proceso)
    const at = p?.completion?.at
    haciendo = {
      // El id crudo si el proceso no está en el catálogo. Pasa de verdad: la
      // fragua da de alta procesos en vivo, y una pantalla que reventara por eso
      // se caería justo cuando la criatura hace algo que nadie le enseñó.
      que: p?.lexeme.nombre ?? a.haciendo.proceso,
      segundos: a.haciendo.segundos,
      sobre: a.haciendo.roles.map((r) => nombrar(e, r.body)).filter((s): s is string => s !== undefined),
      ...(at === undefined ? {} : { barra: barra(a.haciendo.segundos, at) }),
    }
  }

  return {
    aliento: barra(a.aliento, techoDelAliento(phys)),
    manos,
    ...(haciendo === undefined ? {} : { haciendo }),
    ...(a.esperando === undefined ? {} : { esperando: barra(a.esperando.segundos, a.esperando.pedido) }),
  }
}
