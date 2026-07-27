// ─── @anima/world/reloj.ts ───────────────────────────────────────────────────
//
// EL DÍA Y LA NOCHE, DERIVADOS DEL TICK. ADR II-0009, decisión 4.
//
// Este archivo no guarda nada. `WorldState` ya tiene `tick` y `hz`, y con esos
// dos números el reloj entero es una cuenta: no hay un tercer campo que se pueda
// desincronizar, porque no hay un tercer campo.
//
// ─── Por qué derivado y no guardado ─────────────────────────────────────────
//
// Un reloj guardado es una SEGUNDA COPIA del tick, y dos copias del mismo hecho
// se separan — es la historia de `DSL_REFERENCE` en Ánima I, y es la razón por la
// que `oracle/tests/presupuesto.test.ts` tiene un guardián sobre tres constantes
// copiadas a mano. Y las cuentas cierran del mismo lado: guardarlo costaría tres
// campos en el estado, tres en el hash y tres en cada delta de cada tick **para
// no agregar un solo bit de información**; derivarlo cuesta cero y sale ya
// hasheado, porque `tick` y `hz` están adentro del hash desde el ADR II-0008.
//
// ─── Por qué `Clock` está declarado DOS VECES en el árbol ───────────────────
//
// La otra copia es `skills/src/tipos.ts:255` —y su reflejo generado en
// `skills/src/skill-api.d.ts`—, y **las dos tienen que coincidir campo por campo
// y nombre por nombre**. No se pueden unificar todavía, y no por comodidad:
// `@anima/skills` DEPENDE de `@anima/world`, así que importar el tipo desde acá
// para allá se puede pero al revés no, y quien construye el `Clock` es el mundo.
// Mudar la declaración a `@anima/skills` invertiría la dependencia; mudarla acá y
// que `tipos.ts` la importe obligaría al sandbox de habilidades —que sólo ve
// `skill-api.d.ts`, un archivo GENERADO y sin imports— a arrastrar el paquete del
// mundo entero adentro del aislamiento.
//
// Lo que las mantiene juntas mientras tanto es el TIPADO ESTRUCTURAL: el tramo de
// runtime, que es el único que depende de los dos paquetes, le pasa lo que
// devuelve `relojDe` al `ctx.clock` de una habilidad, y esa asignación no compila
// si las dos formas dejan de ser la misma. El día que exista ese tramo, `tsc` deja
// de creerle a este comentario y pasa a verificarlo.

import { esFrecuenciaAdmisible, FRECUENCIAS_ADMISIBLES } from '@anima/physics'

/**
 * Cuántos SEGUNDOS DE MUNDO dura un día entero, luz más noche. Mitad y mitad, y
 * el tick 0 es el amanecer.
 *
 * El 200 sale de tres cosas y de ningún gusto (ADR II-0009):
 *
 *   1. **es un entero de segundos**, así que `LARGO_DEL_DIA × hz` es entero a las
 *      cinco frecuencias admisibles y toda la cuenta del reloj se hace con
 *      enteros hasta la última división;
 *   2. **la luz alcanza para lo más lento que se puede hacer, más de una vez**: lo
 *      más lento del catálogo semilla es cocinar el cuero, 41 segundos medidos en
 *      `physics/tests/el-tiempo-en-segundos.test.ts`, y en cien segundos de luz
 *      entran dos cueros y sobra para ir y volver. Con menos, el día sería una
 *      interrupción; con mucho más, la noche dejaría de ser una restricción;
 *   3. **divide el criterio del Hito 5**: 20.000 ticks a 20 Hz son 1000 segundos,
 *      o sea exactamente CINCO DÍAS. «Sobrevive 20.000 ticks sola» pasa a decirse
 *      «sobrevive cinco días», que es una frase que se sostiene en la cabeza sin
 *      hacer ninguna cuenta.
 *
 * No entra en ningún hash: `hashPhysics` cubre el catálogo de la física y las
 * constantes de `@anima/world` viajan con el build. Un guardado replayado contra
 * otro build calibra distinto y el hash del tick 0 coincide igual.
 */
export const LARGO_DEL_DIA = 200

/**
 * El reloj que ve la criatura.
 *
 * Es —campo por campo— el `Clock` de `skills/src/tipos.ts:255`. Ver arriba por
 * qué está escrito dos veces y qué lo mantiene sincronizado.
 */
export interface Clock {
  readonly phase: 'dia' | 'noche'
  /**
   * SEGUNDOS de mundo, no ticks. Guarecerse antes de que caiga la noche es una
   * decisión de ritmo, y el ritmo no se mide en muestras.
   *
   * De NOCHE vale 0, y no «lo que falta para el próximo anochecer»: el anochecer
   * ya pasó. `skills/src/innatas/guarecerse.ts:114` ya escribía
   * `phase === 'noche' ? 0 : secondsToNightfall`, o sea que la habilidad que lo
   * lee ya esperaba este cero antes de que existiera quien se lo contestara.
   */
  readonly secondsToNightfall: number
  /** La duración del día completo, en segundos. */
  readonly dayLength: number
}

/**
 * Lo que hace falta para saber la hora: el contador de ticks y la frecuencia.
 *
 * Un `WorldState` lo cumple, y también lo cumple un `{ tick, hz }` escrito a
 * mano. Se pide la forma y no el estado entero porque el reloj no mira ni un
 * cuerpo: pedir el mundo completo para leer dos números invitaría a que mañana
 * mire un tercero.
 */
export interface ConReloj {
  readonly tick: number
  readonly hz: number
}

/**
 * La hora del mundo.
 *
 * Todo con enteros hasta la ÚLTIMA división —la misma disciplina de `sumarPaso`,
 * que acumula en micros enteros y divide una sola vez— y sin `Math` trascendente,
 * así que pasa el guardián de la regla 2 sin excepciones y da el mismo bit en
 * cualquier motor.
 *
 * Y da el MISMO `secondsToNightfall` a las cinco frecuencias admisibles para el
 * mismo segundo de mundo, que es el ADR II-0008 aplicado al reloj: subir el
 * muestreo porque el render se ve entrecortado no puede adelantar la noche.
 *
 * **Lanza** con una frecuencia inadmisible, igual que `dtDeFrecuencia`: si `hz`
 * no divide 10⁶ tampoco es entero contra `LARGO_DEL_DIA`, y un reloj que
 * redondeara en silencio sería una partida que corre a otro ritmo del que su
 * crónica dice.
 */
export function relojDe(s: ConReloj): Clock {
  const hz = s.hz
  if (!esFrecuenciaAdmisible(hz)) {
    throw new RangeError(
      `frecuencia inadmisible: ${String(hz)} Hz no da un reloj entero contra un día de ${String(LARGO_DEL_DIA)} s. Admisibles: ${FRECUENCIAS_ADMISIBLES.join(', ')}`,
    )
  }
  const ticksPorDia = LARGO_DEL_DIA * hz
  // Entero porque `LARGO_DEL_DIA` es PAR: la mitad de un día impar de segundos
  // caería a medio tick y el amanecer dependería de la frecuencia.
  const mitad = ticksPorDia / 2
  // El doble resto normaliza un tick negativo. No lo produce `stepWorld` —el
  // contador sólo sube— pero sí lo puede traer un guardado editado a mano, y un
  // reloj que conteste `secondsToNightfall` negativo mandaría a la criatura a
  // guarecerse para siempre.
  const tickDelDia = ((s.tick % ticksPorDia) + ticksPorDia) % ticksPorDia
  const faltan = mitad - tickDelDia
  return {
    phase: faltan > 0 ? 'dia' : 'noche',
    secondsToNightfall: faltan > 0 ? faltan / hz : 0,
    dayLength: LARGO_DEL_DIA,
  }
}
