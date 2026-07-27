// ─── @anima/oracle/extraccion.ts ─────────────────────────────────────────────
//
// EL DADO DE SACAR ES DEL MUNDO.
//
// Decidir QUÉ EXISTE es del dios: cuántos peces hay en este río, a qué ritmo se
// repone, qué rinde. Decidir SI ESTA VEZ PICÓ es del MUNDO: es una acción, pasa
// en un instante, la hace alguien y cambia el futuro.
//
// Esa separación es lo único que hace que PENSAR NO LE CORRA EL DADO A LA
// PARTIDA. Si estimar las chances consumiera azar, dos partidas con la misma
// semilla y las mismas órdenes divergirían según cuánto dudó la criatura antes
// de tirar la caña — y ese bug no da error, no da excepción y no aparece en
// ningún test que no compare hashes de partidas largas. Por eso
// `probabilidadDePicar` está separada de `draw` y NO consume nada: estimar es
// gratis, sacar cuesta una tirada.
//
// Por eso también `draw` pide el MUNDO entero y no una función suelta: una
// función suelta se la pasa cualquiera, y `WorldRng` —tipo nominal distinto de
// `DiosRng`— hace que `tsc` rechace el dado del dios en este lugar.
//
// ─── Este archivo NO lleva la cuenta ────────────────────────────────────────
//
// La contabilidad del stock —cuántos hay, cuánto repuso, cuántos quedan después
// de sacar uno— es del dios y vive en `ley.ts` (`population`, `retirarUno`). Acá
// no se reimplementa ni una línea de eso, y no es prolijidad: dos
// implementaciones de la misma cuenta divergen, y este repo ya se comió esa
// lección con `capacidadTermica`. Lo que aporta este archivo es exactamente una
// cosa que el dios no puede hacer: TIRAR EL DADO DEL MUNDO.
//
// De ahí que el tiempo entre acá sea `Duracion` —SEGUNDOS de mundo— y no ticks
// (ADR II-0008). El documento de arquitectura escribe `draw(w, s, gear, tick)` y
// `perMilleTick`, pero eso es anterior al ADR: con la tasa por tick, bajar la
// frecuencia para que el juego corriera mejor haría que el río se repusiera más
// lento, o sea las dos perillas del ADR II-0007 vueltas a atar en una.
//
// ─── Ver agua no revela el stock ────────────────────────────────────────────
//
// La percepción entrega la FORMA del cuerpo de agua (`WaterBody`: sus celdas, su
// ancla) y la cualidad `wet` de esas celdas. No hay ningún campo por el que se
// pueda leer una población. El stock se resuelve la primera vez que alguien
// pesca o inspecciona de cerca —el grano FINO del ledger— y esa frontera tiene
// un nombre acá: `resolverAlPescar`.
//
// La expectativa —«probablemente haya pescado»— es CREENCIA de la criatura, no
// dato del mundo, y por eso puede equivocarse. Que a veces no haya pescado es
// exactamente lo que hace que la vez que sí hay valga algo.
//
// Determinismo: acá no hay `Math.random`, `Date`, `performance`, `Intl`,
// `localeCompare` ni `Math` trascendente. Solo `* /` y `Math.min`, que están
// especificados bit a bit en ECMAScript.

import type { Body, Duracion, Fixed, Physics, SubstanceId } from '@anima/physics'
import { fx, qualityOf, unfx } from '@anima/physics'

import type { WaterBody } from './compromiso.js'
import { InvariantError } from './ledger.js'
import type { Stock } from './ley.js'
import { crearStock, population, retirarUno } from './ley.js'
import { keyOf, type WorldRng } from './pregunta.js'
import { milicaloriasDe, type LibroCalorico } from './presupuesto.js'

// ─── Lo que la extracción necesita del mundo ────────────────────────────────

/**
 * El mínimo estructural del mundo para poder sacar: el catálogo y el dado.
 *
 * Se declara acá y no se importa `WorldState` de `@anima/world` porque **el
 * oráculo no depende del mundo**: la flecha va del mundo al dios, y en los dos
 * sentidos sería un ciclo de paquetes. Un `WorldState` que tenga un `rng` entra
 * por estructura, sin adaptador.
 *
 * Y hoy `WorldState` NO tiene `rng`: el mundo saca su variedad del reloj (el
 * rumbo de `explore` sale del tick). Cuando lo tenga, es este campo. Lo que no
 * puede pasar nunca es que lo tenga el dios — `DiosRng` no es asignable a
 * `WorldRng`, y eso lo verifica `tsc` sin que nadie tenga que acordarse.
 */
export interface MundoConDado {
  readonly phys: Physics
  /**
   * El dado del mundo. Tiene ESTADO: cada llamada avanza la partida, y por eso
   * llamarlo es un acto y no una consulta.
   */
  readonly rng: WorldRng
  /**
   * EL LIBRO CALÓRICO, y es OBLIGATORIO a propósito.
   *
   * El agujero que este campo cierra —el riesgo 4 del documento— no era que la
   * cuenta estuviera mal: era que **no había cuenta**. `presupuestoCalorico` se
   * calculaba, se guardaba en el `ChunkFacts` y no lo leía nadie. Un campo
   * opcional lo habría dejado abierto exactamente igual, porque el llamador que
   * se olvida es el mismo que se olvidó la primera vez.
   *
   * Siendo obligatorio, la puerta la cierra `tsc`: **no se puede escribir una
   * extracción sin decir contra qué presupuesto se cobra**. Es el mismo recurso
   * con el que este paquete separa el dado del dios del dado del mundo — barato
   * de prevenir, carísimo de descubrir seis meses después.
   */
  readonly calorias: LibroCalorico
}

// ─── La probabilidad, que es pensar y no cuesta nada ────────────────────────

/**
 * Recorta a [0, 1] **y manda el `NaN` a cero**.
 *
 * El `NaN` es la mitad del valor de esta función. Escrito como
 * `v < 0 ? 0 : v > 1 ? 1 : v`, un `NaN` cae en el `else` y sale como `NaN`;
 * después `w.rng() >= NaN` es FALSO y la extracción tiene éxito SIEMPRE. Un
 * agujero que regala comida y no lanza ningún error. La comparación `v > 0` es
 * falsa para `NaN`, y de ahí sale el cero.
 */
export function clamp01(v: number): number {
  if (!(v > 0)) return 0
  return v > 1 ? 1 : v
}

/**
 * La probabilidad de que esta vez pique. **No consume el dado de nadie.**
 *
 * `p = (población / capacidad) × enganche × min(1, alcance / profundidad)`
 *
 * Los tres factores son tres frases:
 *   - **población / capacidad**: un río vaciado no rinde. Es lo que hace que la
 *     criatura tenga que moverse en vez de pescar el mismo pozo para siempre.
 *   - **enganche** (`catch` del aparejo): sin punta suelta no hay con qué
 *     agarrar. Una mano pelada tiene `catch` cero y `p` cero, y por eso hace
 *     falta la caña sin que nadie escriba «caña».
 *   - **min(1, alcance / profundidad)**: llegar más lejos que la profundidad no
 *     ayuda más; no llegar, castiga proporcional. El `min` es lo que impide que
 *     una caña de veinte metros sea veinte veces mejor que la que llega justo.
 *
 * Es pública y está separada de `draw` a propósito: la criatura la va a usar
 * para estimar antes de decidir, y estimar tiene que ser gratis en el sentido
 * fuerte —no cambia el mundo—. Que sea la MISMA cuenta que usa `draw` es lo que
 * hace que la estimación no mienta.
 */
export function probabilidadDePicar(s: Stock, gear: Body, phys: Physics, t: Duracion): number {
  const pob = population(s, t)
  // Sin población no hay chance, y además es la rama que protege la división:
  // un stock de capacidad cero solo puede tener población cero.
  if (pob <= 0) return 0
  const alcance = qualityOf(gear, 'reach', phys)
  const enganche = qualityOf(gear, 'catch', phys)
  // Profundidad cero o negativa es «no hay que llegar a ningún lado»: el factor
  // es 1. Sin esta rama, `0 / 0` da `NaN` y `alcance / 0` da infinito, y las dos
  // cosas se cuelan hasta `p`.
  const profundidad = unfx(s.depth)
  const factorDeAlcance = profundidad <= 0 ? 1 : Math.min(1, alcance / profundidad)
  return clamp01((pob / s.capacity) * enganche * factorDeAlcance)
}

// ─── Sacar, que es un acto ──────────────────────────────────────────────────

/**
 * Por qué salió lo que salió. Cuatro y no un booleano porque las cuatro son
 * historias distintas y la criatura tiene que poder contarlas: «no hay»,
 * «no picó» y «este lugar ya dio todo lo que tenía» piden decisiones opuestas.
 */
export type RazonDeExtraccion = 'saco' | 'vacio' | 'no-pico' | 'sin-presupuesto'

/** Lo que dejó un intento de extracción. */
export interface ResultadoDeExtraccion {
  /** Qué salió, o `null` si esta vez no picó. */
  readonly yields: SubstanceId | null
  /**
   * La masa de lo que salió, en `Fixed`. Cero cuando no salió nada.
   *
   * Sin este campo **no se puede saber cuántas calorías entregó un chunk**, y
   * eso era literalmente la mitad del agujero del techo calórico: `draw`
   * devolvía un `SubstanceId` pelado y una sustancia sin masa no tiene calorías.
   */
  readonly masa: Fixed
  /** Lo que esto le costó al presupuesto del chunk, en milicalorías enteras. */
  readonly milicalorias: number
  /**
   * Si se tiró el dado del mundo. Lo necesita la crónica y lo necesitan los
   * tests: **cuántas veces se tiró el dado es parte de la identidad de la
   * partida**, así que tiene que ser observable y no una cuenta interna.
   */
  readonly tiro: boolean
  readonly razon: RazonDeExtraccion
}

/** Lo que se devuelve cuando no salió nada. La masa cero está escrita una vez. */
function nada(razon: RazonDeExtraccion, tiro: boolean): ResultadoDeExtraccion {
  return { yields: null, masa: fx(0), milicalorias: 0, tiro, razon }
}

/**
 * SACAR. El dado es el del mundo; la cuenta, del dios.
 *
 * ─── Cuando no hay nada, no se tira ─────────────────────────────────────────
 *
 * Con población cero se devuelve `null` sin tocar el dado. Es lo que dice el
 * documento y además es lo correcto: tirar es un acto del mundo, y meter la mano
 * en un pozo vacío no tiene ningún resultado posible que valga una tirada. Que
 * tirar o no dependa del ESTADO no rompe nada, porque el estado es determinista;
 * lo que rompería todo es que dependiera de cuántas veces alguien PENSÓ en
 * pescar.
 *
 * ─── Cuando no pica, no se toca nada ────────────────────────────────────────
 *
 * Y esto es más fino de lo que parece: la reposición se integra desde `atSecond`
 * (ver `population`), así que re-anclar la marca en un intento FALLIDO —que
 * parece inofensivo, porque la población es la misma en ese instante— haría que
 * el río se repusiera más lento cuanto más lo intentaran. Nadie encontraría eso
 * mirando el código de la reposición. Por eso el único camino que escribe es el
 * que salió bien, y lo escribe `retirarUno`, que es de quien lleva la cuenta.
 *
 * ─── Y CUANDO EL CHUNK YA DIO TODO, TAMPOCO SE TIRA ─────────────────────────
 *
 * Es el mismo argumento que el del pozo vacío, con el techo en vez de la
 * población: si el lugar no puede entregar ni las calorías de UNA pieza, no hay
 * resultado posible que valga una tirada del dado del mundo. Y se chequea ANTES
 * de tirar y no después, que es lo que hace que la cuenta no se pueda saltar:
 * tirar primero y arrepentirse después dejaría el dado corrido igual, y con él
 * la partida.
 *
 * Que tirar o no dependa del presupuesto no rompe la regla madre —«pensar no le
 * corre el dado a la partida»— porque el presupuesto es ESTADO determinista del
 * mundo, no una consecuencia de cuántas veces alguien pensó: `probabilidadDePicar`
 * sigue sin tocar nada y sigue sin cobrar nada.
 */
export function draw(w: MundoConDado, s: Stock, gear: Body, t: Duracion): ResultadoDeExtraccion {
  const pob = population(s, t)
  if (pob <= 0) return nada('vacio', false)

  // Lo que costaría una pieza de este stock. Se calcula con la cualidad derivada
  // `calories` de la física, o sea con la misma cuenta con la que la criatura va
  // a ganar al comérselo.
  const costo = milicaloriasDe(s.yields, s.masaPorUnidad, w.phys)
  if (!w.calorias.alcanza(s.cx, s.cy, costo)) return nada('sin-presupuesto', false)

  const p = probabilidadDePicar(s, gear, w.phys, t)
  // Una sola tirada, acá, y ninguna en ningún otro camino de esta función.
  if (w.rng() >= p) return nada('no-pico', true)

  // La contabilidad es del dios: `retirarUno` baja el stock y re-ancla la
  // reposición. No tira ningún dado, y por eso se lo puede llamar desde acá sin
  // que el dios le corra la suerte a nadie.
  const yields = retirarUno(s, t)
  if (yields === null) return nada('vacio', true)

  // Y recién acá se cobra: lo que salió del mundo lo paga el chunk. `cobrar`
  // ya no puede devolver `false` —`alcanza` se preguntó doce líneas arriba y
  // nada tocó el libro entre medio—, y si alguna vez lo devolviera sería una
  // corrupción y no un caso: el bocado ya está afuera y el stock ya bajó.
  if (!w.calorias.cobrar({ cx: s.cx, cy: s.cy, substance: yields, masa: s.masaPorUnidad, milicalorias: costo, at: t })) {
    throw new InvariantError({
      k: 'techo-calorico',
      chunk: keyOf({ k: 'chunk', cx: s.cx, cy: s.cy }),
      techo: w.calorias.techo(s.cx, s.cy),
      aportado: w.calorias.aportado(s.cx, s.cy) + costo,
    })
  }
  return { yields, masa: s.masaPorUnidad, milicalorias: costo, tiro: true, razon: 'saco' }
}

// ─── Ver agua no es ver el pescado ──────────────────────────────────────────

/**
 * EL GRANO FINO: el stock se resuelve la primera vez que alguien pesca o
 * inspecciona de cerca.
 *
 * Son dos líneas y existe por dos cosas que no son dos líneas:
 *
 *   1. **nombra la frontera**. `WaterBody → Stock` no ocurre en ningún otro lado
 *      del paquete, así que «ver agua no revela el stock» deja de ser una
 *      promesa de comentario y pasa a ser una función que se puede buscar,
 *      contar y testear. Un `WaterBody` —lo que la percepción entrega— no tiene
 *      ningún campo del que se pueda leer una población, y esa ausencia es el
 *      diseño entero: de lejos se ve agua, y qué vive adentro es otro hecho.
 *   2. **revisa lo que el grano fino comprometió**. El resolvedor es el ledger, y
 *      lo que devuelva entra directo al mundo. Un stock incoherente tiene que
 *      morir acá, en la puerta, y no cuatro capas más abajo adentro de una
 *      probabilidad: con `capacity` roto, `p` sería `NaN` y —ver `clamp01`— la
 *      extracción tendría éxito siempre.
 */
export function resolverAlPescar(agua: WaterBody, resolver: (a: WaterBody) => Stock): Stock {
  return crearStock(resolver(agua))
}
