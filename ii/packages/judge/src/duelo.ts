/**
 * EL DUELO — Hito 8, punto 7.
 *
 *   > una candidata **peor no reemplaza nada** y queda archivada como regresión
 *
 * ─── Por qué vive acá y no en la fragua ─────────────────────────────────────
 *
 * Porque el criterio lo dice con todas las letras: *«el juez del Hito 7 es quien
 * contesta el 6 y el 7. No hay que escribir un segundo criterio de "mejor"»*. Y
 * porque el orden de gravedad de los grados es de este paquete: ponerlo en la
 * fragua sería una segunda copia de `GRAVEDAD` que queda vieja en silencio.
 *
 * ─── EL HALLAZGO QUE DEFINIÓ LA REGLA, y es duro ────────────────────────────
 *
 * **Hoy ningún dictamen de habilidad puede salir `promueve`. Nunca.** Medido
 * sobre las innatas:
 *
 *   sostener → inconcluso     frotar → no-promueve    esperar → no-promueve
 *     plano         promueve    plano         promueve
 *     construccion  promueve    construccion  no-promueve
 *     uso           promueve    uso           inconcluso
 *     utilidad      INCONCLUSO  utilidad      INCONCLUSO
 *
 * `utilidad` sale `inconcluso` siempre —«no hay contra qué: nadie le pide nada a
 * una habilidad hasta que haya objetivos»— y `elPeor()` toma el peor cargo, no el
 * promedio. Lo mejor que puede sacar una habilidad es `inconcluso`.
 *
 * O sea que **un duelo que compare el grado global no puede tener ganador
 * jamás**: las dos salen `inconcluso` y empatan siempre. Sería el sexto verde por
 * omisión del hito, y de los caros — «una candidata peor no reemplaza nada»
 * pasaría con un duelo que no reemplaza nunca.
 *
 * Por eso se compara **cargo por cargo**.
 *
 * ─── LA REGLA: DOMINA O NO REEMPLAZA ────────────────────────────────────────
 *
 * La retadora reemplaza si es **mejor o igual en TODOS los cargos y estrictamente
 * mejor en al menos uno**. Cualquier otra cosa —un empate, o ganar uno y perder
 * otro— deja a la titular.
 *
 * Las dos mitades tienen su motivo:
 *
 *   · **el empate no reemplaza** porque reemplazar sin ganar nada es puro
 *     movimiento: se paga el reemplazo, se pierde la titular que ya se probó en
 *     partida, y no se compra nada. El criterio pide que la GANADORA reemplace, y
 *     en un empate no hay ganadora;
 *   · **ganar uno y perder otro tampoco**, y es la más importante. Sin esta
 *     mitad, una candidata que arregla `uso` y rompe `construccion` entra igual —
 *     y `construccion` es el cargo que dice «anduvo donde su propio contrato dice
 *     que no puede». Cambiar un rojo por otro rojo no es mejorar.
 *
 * Es un orden PARCIAL a propósito. Un orden total —sumar los cargos, promediar—
 * obligaría a elegir cuánto vale cada cargo, y eso es exactamente el número
 * puesto a dedo que este repositorio viene sacando.
 *
 * ─── Y el desempate DENTRO de un cargo, que hace falta ──────────────────────
 *
 * Con cuatro grados y cuatro cargos, dos habilidades distintas empatan seguido.
 * Así que a grado igual se mira **cuántos mundos aprobó**, que es el número que
 * el cargo ya trae adentro (`Veredicto.corrida`). No es un invento: es el mismo
 * dato que el panel del Hito 7 imprime.
 */

import { elPeor } from './tipos.js'
import type { Cargo, Dictamen, Grado, Veredicto } from './tipos.js'

/**
 * EL ORDEN DE GRAVEDAD, otra vez y exportado.
 *
 * `elPeor` ya lo tenía adentro y privado, y para el duelo no alcanza con saber
 * cuál es el peor: hace falta poder decir si UNO es mejor que OTRO. Se exporta
 * en vez de copiarse — dos tablas de gravedad que se separan un día es la clase
 * de error que nadie ve hasta que un duelo elige mal.
 */
export const GRAVEDAD_DE: Readonly<Record<Grado, number>> = {
  promueve: 0,
  inconcluso: 1,
  'no-promueve': 2,
  injuzgable: 3,
}

export type QuienGana = 'titular' | 'retadora' | 'empate'

export interface Cotejo {
  readonly cargo: Cargo
  readonly titular: Grado
  readonly retadora: Grado
  /** Los mundos aprobados de cada una, que es el desempate a grado igual. */
  readonly aprobadosTitular: number
  readonly aprobadosRetadora: number
  readonly gana: QuienGana
}

export interface Duelo {
  readonly reemplaza: boolean
  /** En castellano llano, como los `porque` del juez. Va al informe y al encargo. */
  readonly porque: string
  readonly porCargo: readonly Cotejo[]
  /** Cuántos cargos ganó cada una. Es el resumen que el panel imprime. */
  readonly ganaTitular: number
  readonly ganaRetadora: number
}

function veredictoDe(d: Dictamen, c: Cargo): Veredicto | undefined {
  return d.cargos.find((x) => x.cargo === c)
}

function cotejar(cargo: Cargo, t: Veredicto | undefined, r: Veredicto | undefined): Cotejo {
  // Un cargo que una de las dos no trae se cuenta como `injuzgable`, que es el
  // peor: no saber no es empatar. Con `inconcluso` —la otra opción— una candidata
  // que ni corrió le ganaría a una que corrió y salió mal.
  const gt = t?.grado ?? 'injuzgable'
  const gr = r?.grado ?? 'injuzgable'
  const at = t?.corrida.aprobados ?? 0
  const ar = r?.corrida.aprobados ?? 0

  let gana: QuienGana = 'empate'
  if (GRAVEDAD_DE[gr] < GRAVEDAD_DE[gt]) gana = 'retadora'
  else if (GRAVEDAD_DE[gr] > GRAVEDAD_DE[gt]) gana = 'titular'
  else if (ar > at) gana = 'retadora'
  else if (ar < at) gana = 'titular'

  return { cargo, titular: gt, retadora: gr, aprobadosTitular: at, aprobadosRetadora: ar, gana }
}

/**
 * LOS DOS DICTÁMENES, CARGO POR CARGO.
 *
 * ─── «En sus propios mundos», que es lo que el criterio pide ────────────────
 *
 * El criterio dice que el duelo compara «dos dictámenes sobre **los mismos
 * mundos**», y acá eso no se verifica: se garantiza aguas arriba. `bancoDe`
 * deriva el banco del CONTRATO de la acusada, así que dos habilidades juzgadas
 * con el mismo contrato corrieron el mismo banco — y una retadora es, por
 * definición, una re-forja de la misma capacidad.
 *
 * Lo que sí se afirma acá es lo único que este archivo puede ver: que los dos
 * dictámenes hablen de los mismos cargos. Si alguien duelea dos contratos
 * distintos, el `porque` lo va a decir con los números al lado.
 */
/**
 * CÓMO SE LEE UN COTEJO, y por qué no alcanza con los dos grados.
 *
 * Cuando el desempate lo puso el número de mundos, los dos grados son el mismo y
 * `plano promueve→promueve` se lee como un error del informe. Medido en la
 * primera corrida contra material real, donde salía exactamente esa línea. Así
 * que cuando los grados empatan, se muestran los mundos, que es lo que decidió.
 */
function comoSeLee(c: Cotejo): string {
  return c.titular === c.retadora
    ? `${c.cargo} ${c.titular} en los dos, ${String(c.aprobadosTitular)}→${String(c.aprobadosRetadora)} mundos`
    : `${c.cargo} ${c.titular}→${c.retadora}`
}

export function duelo(titular: Dictamen, retadora: Dictamen): Duelo {
  const cargos: readonly Cargo[] = titular.cargos.map((c) => c.cargo)
  const porCargo = cargos.map((c) => cotejar(c, veredictoDe(titular, c), veredictoDe(retadora, c)))

  const ganaRetadora = porCargo.filter((c) => c.gana === 'retadora').length
  const ganaTitular = porCargo.filter((c) => c.gana === 'titular').length

  // DOMINA: ni un cargo peor, y al menos uno mejor.
  const reemplaza = ganaTitular === 0 && ganaRetadora > 0

  const porque = reemplaza
    ? `mejora en ${String(ganaRetadora)} cargo(s) y no empeora en ninguno: ${porCargo
        .filter((c) => c.gana === 'retadora')
        .map((c) => comoSeLee(c))
        .join(', ')}`
    : ganaRetadora === 0 && ganaTitular === 0
      ? 'empató en los cuatro cargos: reemplazar no compra nada y la titular ya se probó en partida'
      : `empeora en ${String(ganaTitular)} cargo(s): ${porCargo
          .filter((c) => c.gana === 'titular')
          .map((c) => comoSeLee(c))
          .join(', ')}`

  return { reemplaza, porque, porCargo, ganaTitular, ganaRetadora }
}

/**
 * LA PERDEDORA, ARCHIVADA — la segunda mitad del punto 7.
 *
 * > «y queda **archivada como regresión**»
 *
 * `Regresion` de `tipos.ts` NO sirve para esto y hay que decirlo: guarda un fallo
 * POR MUNDO —con su `semilla` adentro— y lo que hace falta acá es una candidata
 * perdedora entera, con por qué perdió. Son dos cosas distintas con el mismo
 * nombre en castellano.
 *
 * Lo que se guarda es **el código y el porqué**, no el dictamen entero: el
 * dictamen trae las semillas de los mundos, y el archivo de regresiones es lo que
 * después alimenta un encargo. Es la misma trampa del punto 9 —*si se le cuentan
 * los mundos donde falló, aprende los mundos y no la habilidad*— y se cierra
 * igual: el dato no entra.
 */
export interface Archivada {
  readonly nombre: string
  readonly codigo: string
  /** En castellano llano. Sale del `porque` del duelo, que no nombra ningún mundo. */
  readonly porque: string
  /** En qué vuelta del carril de mejora perdió. */
  readonly vuelta: number
}

export function archivar(nombre: string, codigo: string, d: Duelo, vuelta: number): Archivada {
  return { nombre, codigo, porque: d.porque, vuelta }
}

/**
 * EL GRADO DE UN DICTAMEN, para quien quiera el resumen de una.
 *
 * Se re-exporta el cálculo y no el campo `grado` porque el campo puede venir de
 * un dictamen armado a mano; esto lo deriva de los cargos, que es lo que el duelo
 * mira.
 */
export function gradoDe(d: Dictamen): Grado {
  return elPeor(d.cargos.map((c) => c.grado))
}
