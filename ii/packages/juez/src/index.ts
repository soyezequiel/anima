// ─── @anima/juez ─────────────────────────────────────────────────────────────
//
// EL DETECTOR AUTOMÁTICO DE SECUENCIAS del criterio de emergencia del Hito 5.
//
//   tipos       los nueve nombres, la muestra, la fila del informe.
//   lectura     lo único que el juez sabe hacer: preguntarle al motor.
//   cronica     lo que recuerda de una partida, tick a tick. Un solo recorrido.
//   secuencias  las nueve, en el orden del documento y sin moverse.
//   detector    la máquina, el veredicto y el resumen del banco.
//
// ─── QUÉ ES ESTE PAQUETE Y POR QUÉ ESTÁ SOLO ────────────────────────────────
//
// El documento de arquitectura pide diez secuencias que nadie implementó, un
// detector automático, veinte partidas con semillas distintas y un piso de cuatro
// apariciones — y pide que el juez sea EXTERNO, porque «“aparece un cuarto
// comportamiento que nadie diseñó” evaluado por el autor de las tablas no es un
// test». La lista cerrada, con las nueve que sobrevivieron a tres tandas de
// adversarios, está en `ii/docs/hito-5-las-diez-secuencias.md`.
//
// Este paquete NO depende de `@anima/mind` EN RUNTIME: sus `dependencies` son dos
// —el motor— y `src/` tiene prohibido nombrar a la mente, al planificador, a las
// habilidades y a la percepción. No es una omisión que se pueda reparar: es la
// exigencia del documento escrita en el grafo de dependencias.
//
// Y la excepción, dicha acá y no escondida: el criterio hay que CORRERLO, así que
// UN archivo de `tests/` —`hito-5-la-emergencia.test.ts`, la corrida de las veinte
// partidas— sí importa la mente para armar la criatura. Le pasa al `Detector` lo
// mismo que cualquier otro banco: `{ state, events }` por tick. Que sea uno solo
// lo afirma `tests/ataque-determinismo.test.ts`.
//
// ─── LAS TRES REGLAS QUE LO GOBIERNAN ───────────────────────────────────────
//
//   1. EL DETECTOR LLAMA A LAS FUNCIONES EXPORTADAS DEL MOTOR. Todo lo que el
//      juez sabe del mundo pasa por `lectura.ts`, y ahí adentro no hay ni una
//      fórmula de física propia. De los diez detectores de la tanda anterior,
//      seis transcribían una fórmula y tres la transcribían MAL.
//   2. CADA SECUENCIA DECLARA QUÉ LA PAGA, con número y fuente. Está en el campo
//      `paga` de cada una, y es dato: sin stamina, calorías, tiempo o
//      supervivencia de por medio no es emergencia, es coreografía.
//   3. MEDIR EL CATÁLOGO NO ES MEDIR EL MUNDO. El contra-detector del fardo no
//      suma masas a mano ni nombra ninguna sustancia: ARMA el fardo con `unir`,
//      le pregunta a `temperaturaDeEquilibrio` si la vara que hay a tiro lo
//      prendería, y compara contra el `ignitionPoint` que el ensamble tenga.
//      Porque la criatura puede COMBINAR, y una conclusión sacada de piezas
//      sueltas ignora exactamente eso — que es lo que costó una tanda entera.

export type { Aparicion, Fila, Muestra, NombreDeSecuencia, Veredicto } from './tipos.js'

export {
  ALCANCE,
  TECHO_DE_LA_FRICCION,
  alAlcance,
  candidatosDeFriccion,
  candidatosDeRol,
  combustiblesCerca,
  cuerposDeActores,
  elMasLiviano,
  esPieza,
  hayMasasDistintas,
  masasIguales,
  potenciaSiArdiera,
  rolDe,
  ROL_A_DE_FRICCION,
  ROL_BINDER_DE_UNION,
  ROL_GEAR_DE_EXTRACCION,
  sePodiaArmarLaCadena,
} from './lectura.js'
export type { Pesado } from './lectura.js'

export { Cronica } from './cronica.js'
export type { Ensamble, Friccion, Fuego, Intervalo, Parrilla, Pieza, Situaciones } from './cronica.js'

export { SECUENCIAS } from './secuencias.js'
export type { Secuencia } from './secuencias.js'

export {
  Detector,
  NO_MEDIDAS_QUE_ARRUINAN_EL_BANCO,
  PARTIDAS_QUE_HACEN_UNA_APARICION,
  juzgar,
  resumir,
  tabla,
} from './detector.js'
export type { FilaDelBanco, Resumen } from './detector.js'
