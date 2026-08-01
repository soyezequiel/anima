/**
 * QUÉ SE LE PIDE AL MODELO — Hito 8, tramo D. El punto 9.
 *
 * ─── La frontera es la del Hito 6, y no se rehace ───────────────────────────
 *
 * `@anima/lang` ya resolvió esto: el paquete **describe** la consulta como DATO
 * y el llamador —que sí puede esperar— la manda. Su `Consulta` lleva adentro
 * hasta el vocabulario del que el modelo puede elegir, y el porqué está escrito
 * allá: *«el catálogo es core más overlay por sesión; un prompt con una lista
 * fija le ofrecería al modelo metas que esta partida no puede alcanzar»*.
 *
 * Lo mismo vale acá y por lo mismo. `Encargo` es dato.
 *
 * ─── EL PUNTO 9: la candidata que falla alimenta a la siguiente ─────────────
 *
 * > *«en caso de que el código sea malo, ¿eso entra como contexto para el
 * > siguiente? Capaz que con un pequeño cambio se lo arregla, en vez de crear
 * > una habilidad nueva desde cero»* — el usuario.
 *
 * Y el tramo C midió que **hay dos clases de fallo y sólo una llega hasta acá**:
 *
 * | clase | cuántas | quién la resuelve |
 * |---|---|---|
 * | un **typo** (`ticksToNightfall`) | 7 | la reparación, gratis. **No llega al modelo** |
 * | un **concepto que el mundo no tiene** (`hunger`, `smoke`) | 34 | **esto** |
 *
 * Así que el segundo intento no dice «falló, probá de nuevo». Dice **qué pidió
 * que no existe**, que es lo único que la primera vuelta no podía saber.
 *
 * ─── LA TRAMPA, Y CÓMO SE ATAJA POR CONSTRUCCIÓN ────────────────────────────
 *
 * Si se le cuentan los mundos donde falló, **aprende los mundos y no la
 * habilidad** — es decirle a alguien las preguntas del recuperatorio.
 *
 * La decisión ya estaba tomada: se le cuenta **el QUÉ y el PORQUÉ, no el DÓNDE**.
 * Y al escribirlo apareció que eso se puede garantizar **estructuralmente** en
 * vez de filtrando: **este archivo no tiene ninguna forma de nombrar un mundo**.
 * No recibe ids, no los lee del dictamen, no los imprime.
 *
 * Un filtro se puede olvidar de una lista; no tener el dato no se olvida. Hay un
 * test que lo afirma sobre un dictamen lleno de ids: **ninguno aparece en el
 * texto**.
 */

import type { Cambio } from './reparar.js'
import type { Error } from './puerta.js'
import { nombreInventado } from './reparar.js'

/**
 * LO QUE LA CANDIDATA ANTERIOR HIZO MAL, sin decir dónde.
 *
 * Las tres formas están separadas porque **se arreglan distinto**, y un mensaje
 * que las mezcla le pide al modelo que adivine cuál es cuál.
 */
export interface LoQueFallo {
  /** Nombres que pidió y el mundo no tiene. Es la clase grande (34 de 41). */
  readonly conceptosQueNoExisten: readonly string[]
  /** Lo que la puerta arregló sola. Va para que no lo vuelva a escribir igual. */
  readonly typosCorregidos: readonly Cambio[]
  /**
   * Qué cargo del juez salió mal y por qué, **en castellano llano**.
   *
   * Sale del `porque` del `Veredicto`, que se escribió así para que un panel lo
   * mostrara sin traducir (Hito 7). Resulta que también sirve para esto.
   */
  readonly cargosQueFallaron: readonly { readonly cargo: string; readonly porque: string }[]
}

export const NADA_FALLO: LoQueFallo = {
  conceptosQueNoExisten: [],
  typosCorregidos: [],
  cargosQueFallaron: [],
}

/**
 * Los conceptos inventados, sacados de los errores que la reparación NO pudo
 * arreglar.
 *
 * Se lee de los errores que quedaron **después** de reparar, y no de los de
 * antes: un typo que la puerta ya corrigió no es un concepto que falte, y
 * mandarlo confundiría al modelo con un problema que ya no existe.
 */
export function conceptosDe(erroresQueQuedaron: readonly Error[]): readonly string[] {
  const out = new Set<string>()
  for (const e of erroresQueQuedaron) {
    const n = nombreInventado(e)
    if (n !== undefined) out.add(n)
  }
  return [...out].sort()
}

/**
 * LO QUE FALLÓ, ARMADO DESDE UN DICTAMEN — y la firma es el guardián.
 *
 * Recibe **sólo los cargos**, no el dictamen entero. No es una comodidad: un
 * `Dictamen` trae `regresiones`, y ahí adentro está `semilla`, que **es el id
 * del mundo**. Si esta función recibiera el dictamen, filtrar sería una
 * disciplina que alguien puede olvidar en el próximo cambio.
 *
 * Pidiendo sólo los cargos, **el dato del mundo no entra al paquete**. Es la
 * misma forma que el `CanalDeHabla` del Hito 6 —que no tiene un solo import para
 * que no pueda tocar el tick— llevada a un tipo de argumento.
 *
 * El tipo se escribe estructural y no se importa de `@anima/judge`: la fragua no
 * necesita al juez para armar un encargo, y una dependencia de más es una razón
 * de más para que alguien pase el objeto entero.
 */
export function loQueFalloDe(
  cargos: readonly { readonly cargo: string; readonly grado: string; readonly porque: string }[],
  conceptosQueNoExisten: readonly string[] = [],
  typosCorregidos: readonly Cambio[] = [],
): LoQueFallo {
  return {
    conceptosQueNoExisten,
    typosCorregidos,
    // Sólo los que fallaron: contarle los verdes le pide al modelo que adivine
    // cuál arreglar, y alarga el mensaje con lo que ya está bien.
    cargosQueFallaron: cargos
      .filter((c) => c.grado === 'no-promueve')
      .map((c) => ({ cargo: c.cargo, porque: c.porque })),
  }
}

export interface Encargo {
  /** Qué capacidad hace falta, en los términos del mundo. */
  readonly gap: string
  /**
   * EL VOCABULARIO DEL QUE PUEDE ELEGIR.
   *
   * Va en el encargo y no en el prompt del llamador, por la misma razón que las
   * `firmas` de la `Consulta` del Hito 6: cambia entre partidas, y una lista fija
   * le ofrecería al modelo cosas que esta partida no tiene.
   */
  readonly seSabeNombrar: readonly string[]
  /** Qué vuelta es. La primera no lleva `loQueFallo`. */
  readonly vuelta: number
  readonly loQueFallo: LoQueFallo
}

export function primerEncargo(gap: string, seSabeNombrar: readonly string[]): Encargo {
  return { gap, seSabeNombrar, vuelta: 1, loQueFallo: NADA_FALLO }
}

export function otraVuelta(anterior: Encargo, loQueFallo: LoQueFallo): Encargo {
  return { ...anterior, vuelta: anterior.vuelta + 1, loQueFallo }
}

/**
 * EL TEXTO DEL ENCARGO.
 *
 * En castellano y no en inglés porque todo el repo lo está, y porque el modelo
 * que se probó en el Hito 6 contesta igual de bien — se midió con Claude.
 *
 * **Lo que este texto NO puede contener, y no por disciplina sino porque el dato
 * no está acá: el nombre de un mundo.** Ver el encabezado.
 */
export interface Superficie {
  /**
   * EL `.d.ts` CONTRA EL QUE SE COMPILA, entero.
   *
   * `puerta.ts` ya lo decía con estas palabras: *«la superficie contra la que se
   * compila **ES el prompt**»*. Faltaba que alguien la pusiera adentro.
   */
  readonly api: string
  /** De dónde importarla, tal como la candidata lo tiene que escribir. */
  readonly desde: string
  /** Cuántas candidatas se piden en este viaje. */
  readonly cuantas: number
}

/**
 * EL ENCARGO SIN SUPERFICIE NO ERA UN PROMPT, y está medido en vivo.
 *
 * Se le mandó el encargo pelado a Claude —167 caracteres: el gap y el
 * vocabulario— y **no escribió una línea de código**. Leyó «escribí una
 * habilidad» como una tarea de Claude Code y contestó pidiendo herramientas:
 *
 *     Necesito ver la habilidad que escribiste. Déjame explorar el proyecto.
 *     <function_calls><name>Glob</name>…
 *     ¿Dónde escribiste esa habilidad? ¿En qué archivo está?
 *
 *     candidatas parseadas: 0 · US$ 0,008
 *
 * Faltaban las tres cosas que un prompt tiene y una nota no: **el marco** (sos
 * un programador, no tenés herramientas), **la superficie** (los tipos contra
 * los que va a compilar) y **la forma de la respuesta** (bloques cercados y nada
 * más).
 *
 * La superficie entra por parámetro y no se lee de disco: `@anima/forge` corre
 * también en el navegador y `src/` no abre archivos. Es la misma frontera de
 * siempre — el paquete describe, el llamador provee.
 */
const MARCO = [
  'Sos un programador. Escribís una habilidad para una criatura de un juego.',
  '',
  'NO tenés herramientas, no podés leer archivos y no hay ningún proyecto que',
  'explorar: todo lo que necesitás está en este mensaje.',
]

/**
 * EL MOLDE DE LA RESPUESTA, Y EL IMPORT VA ADENTRO.
 *
 * La primera versión mostraba sólo la firma de la función. Medido en vivo, las
 * dos candidatas de Claude salieron `rota` por lo mismo:
 *
 *     2304: Cannot find name 'Ctx'
 *     2304: Cannot find name 'Intent'
 *     2304: Cannot find name 'Outcome'
 *     2304: Cannot find name 'StepResult'
 *
 * **El modelo copia el molde exacto.** Si el molde no tiene el import, el código
 * no lo tiene. No es que no supiera: escribió `yield ctx.goTo(...)` y
 * `ctx.see([...])` bien — le faltaba la línea de arriba, y la línea de arriba es
 * responsabilidad del que da el molde.
 */
function comoContestar(cuantas: number, desde: string): readonly string[] {
  return [
    '',
    '── CÓMO CONTESTAR ──',
    '',
    `Devolvé ${String(cuantas)} bloques de código y NADA MÁS: sin explicación antes,`,
    'sin comentario después. Cada bloque ENTERO y con sus dos imports, así:',
    '',
    '```ts',
    `import type { BodyView, Ctx, Intent, Outcome, StepResult } from '${desde}'`,
    `import { done, fail } from '${desde}'`,
    '',
    'export function* nombreDeLaHabilidad(ctx: Ctx): Generator<Intent, Outcome, StepResult> {',
    "  ctx.phase('lo-que-esta-haciendo')",
    '  // …',
    '  return done()',
    '}',
    '```',
    '',
    `Que las ${String(cuantas)} sean ENFOQUES DISTINTOS, no la misma con otro nombre.`,
  ]
}

export function textoDe(e: Encargo, s?: Superficie): string {
  const cabeza =
    s === undefined
      ? [
          `Escribí una habilidad para: ${e.gap}`,
          '',
          `El mundo sabe nombrar estas cosas y ninguna otra:`,
          `  ${e.seSabeNombrar.join(' · ')}`,
        ]
      : [
          ...MARCO,
          '',
          '── LO QUE HAY QUE CONSEGUIR ──',
          '',
          e.gap,
          '',
          'El mundo sabe nombrar estas cosas y ninguna otra:',
          `  ${e.seSabeNombrar.join(' · ')}`,
          '',
          '── LA ÚNICA API QUE EXISTE ──',
          '',
          `Importá de '${s.desde}'. Todo lo que no esté acá abajo NO EXISTE:`,
          'inventar un nombre es el error más común y no compila.',
          '',
          '```ts',
          s.api.trimEnd(),
          '```',
        ]

  // El «cómo contestar» va SIEMPRE AL FINAL, y por eso no está adentro de
  // `cabeza`: en la vuelta 2 el cuerpo se mete en el medio, y una instrucción
  // tapada por texto se cumple menos. Misma lección que el prompt del chat.
  const cola = s === undefined ? [] : comoContestar(s.cuantas, s.desde)

  if (e.vuelta === 1) return [...cabeza, ...cola].join('\n')

  const f = e.loQueFallo
  const cuerpo: string[] = ['', `— Intento ${String(e.vuelta)}. Lo que pasó con el anterior —`]

  if (f.conceptosQueNoExisten.length > 0) {
    cuerpo.push(
      '',
      'Pediste cosas que este mundo NO TIENE. No son errores de tipeo: no existe',
      'nada parecido, así que hay que resolverlo con lo que sí hay.',
      `  ${f.conceptosQueNoExisten.join(' · ')}`,
    )
  }

  if (f.typosCorregidos.length > 0) {
    cuerpo.push(
      '',
      'Y esto lo corregí solo, para que no lo vuelvas a escribir igual:',
      ...f.typosCorregidos.map((c) => `  ${c.de} → ${c.a}`),
    )
  }

  if (f.cargosQueFallaron.length > 0) {
    cuerpo.push('', 'Compiló, pero al probarla:', ...f.cargosQueFallaron.map((c) => `  ${c.cargo}: ${c.porque}`))
  }

  return [...cabeza, ...cuerpo, ...cola].join('\n')
}
