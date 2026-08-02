// ─── @anima/mind ─────────────────────────────────────────────────────────────
//
// LA MENTE SIN LLM. El Hito 5, que es el criterio de corte del proyecto: si pasa,
// hay producto aunque el modelo nunca se conecte.
//
//   necesidades    qué le duele a la criatura, derivado del cuerpo y del reloj.
//   creencias      la memoria de afordancias Beta: qué rinde qué, y con cuánta
//                  evidencia. Con sus cinco filas de instinto, dichas sin maquillaje.
//   oportunidades  necesidad × creencia × escasez, ordenado.
//   escalera       D0 a D5, con corte al primero que decide y sin bajar del
//                  último sin una intención.
//   mente          la clase que monta todo eso sobre una `Partida`.

export type {
  AffordanceMemory,
  Beta,
  Bocado,
  Conducta,
  ContextKey,
  Decision,
  Drive,
  Intencion,
  MenteOptions,
  NeedVector,
  Opportunity,
  PedidoALaFragua,
  Peldano,
  VistaDeLaMente,
} from './tipos.js'
export {
  cuantasVeces,
  media,
  MARGEN_DE_HISTERESIS,
  OPORTUNIDADES_QUE_MIRA,
  PERMANENCIA_EN_TICKS,
} from './tipos.js'

export {
  caloriasDelPeorDeTag,
  necesidades,
  promesaDeCalorias,
  satisfaccion,
  satisfaccionDe,
  TANQUE_DE_ALIENTO,
} from './necesidades.js'
export { Creencias, contextoDe, INSTINTO } from './creencias.js'
export {
  opportunities,
  costoEstimado,
  metaComestibleDe,
  META_DEL_BOCADO,
  venenoQueBanca,
} from './oportunidades.js'
export {
  decidir,
  aterrizar,
  avanzarReloj,
  clonarEstado,
  nuevoEstado,
  sinVocabulario,
  type EstadoDeLaEscalera,
} from './escalera.js'
export { Mente, vivir, aHabilidad, type Correr, type Traduccion, type Vida } from './mente.js'
